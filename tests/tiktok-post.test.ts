import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCaption, MAX_CAPTION } from '../publish/caption';
import { chunkPlan, directPostBody, initDirectPost, queryCreatorInfo, TikTokApiError, uploadVideo, waitForPublish, type CreatorInfo, type Fetch } from '../publish/tiktok-api';
import { accessToken, authorizeUrl } from '../publish/tiktok-auth';
import { loadBeatSheet } from '../scripts/beatsheet';

const sheet = loadBeatSheet(new URL('../scripts/videos/2026-11-01-filibuster.yaml', import.meta.url).pathname);
const info: CreatorInfo = { creator_nickname: 'Stick', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], duet_disabled: true };
const settings = { caption: 'c', privacy_level: 'PUBLIC_TO_EVERYONE', disable_comment: false, disable_duet: false, disable_stitch: false, brand_content_toggle: false, brand_organic_toggle: false };

/** Fake TikTok: records calls, answers like the API. */
function fakeTikTok(statuses = ['PROCESSING_UPLOAD', 'PUBLISH_COMPLETE']) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
  const f: Fetch = async (input, init) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method: init?.method ?? 'GET', headers, body: init?.body });
    const ok = (data: unknown) => new Response(JSON.stringify({ data, error: { code: 'ok', message: '' } }));
    if (url.endsWith('/creator_info/query/')) return ok(info);
    if (url.endsWith('/video/init/')) return ok({ publish_id: 'p1', upload_url: 'https://upload.example/u' });
    if (url.startsWith('https://upload.example/')) return new Response(null, { status: 201 });
    if (url.endsWith('/status/fetch/')) {
      const s = statuses.shift() ?? 'PUBLISH_COMPLETE';
      // Raw JSON with a real 64-bit id (a JS number literal would already be rounded).
      return new Response(`{"data":{"status":"${s}"${s === 'PUBLISH_COMPLETE' ? ',"publicaly_available_post_id":[7400000000000000001]' : ''}},"error":{"code":"ok","message":""}}`);
    }
    return new Response(JSON.stringify({ error: { code: 'not_found', message: url } }), { status: 404 });
  };
  return { f, calls };
}

describe('caption', () => {
  it('caption + deduped, normalized hashtags', () => {
    expect(buildCaption({ ...sheet, hashtags: ['Filibuster', '#filibuster', 'senate'] })).toBe(`${sheet.caption}\n\n#filibuster #senate`);
  });
  it('stays under the 2,200 limit by dropping hashtags first', () => {
    const c = buildCaption({ ...sheet, caption: 'x'.repeat(2150), hashtags: Array.from({ length: 30 }, (_, i) => `tag${i}`) });
    expect(c.length).toBeLessThanOrEqual(MAX_CAPTION);
    expect(c.startsWith('x'.repeat(2150))).toBe(true);
  });
});

describe('Direct Post request', () => {
  it('requires a privacy level the account offers and honors creator-disabled interactions', () => {
    expect(() => directPostBody({ ...settings, privacy_level: 'FOLLOWER_OF_CREATOR' }, info, 100)).toThrow(/not offered/);
    const b = directPostBody(settings, info, 15_000_000);
    expect(b.post_info.disable_duet).toBe(true);
    expect(b.post_info).not.toHaveProperty('is_aigc');
    expect(b.source_info).toEqual({ source: 'FILE_UPLOAD', video_size: 15_000_000, chunk_size: 15_000_000, total_chunk_count: 1 });
  });
  it('plans chunks for big files', () => {
    expect(chunkPlan(100 * 1024 * 1024)).toEqual({ chunk_size: 10 * 1024 * 1024, total_chunk_count: 10 });
  });
  it('runs the full flow: creator info → init → upload → status', async () => {
    const { f, calls } = fakeTikTok();
    const i = await queryCreatorInfo(f, 'tok');
    const init = await initDirectPost(f, 'tok', directPostBody(settings, i, 1000));
    await uploadVideo(f, init.upload_url, new Uint8Array(1000));
    const s = await waitForPublish(f, 'tok', init.publish_id, { delayMs: 0 });
    expect(s).toMatchObject({ status: 'PUBLISH_COMPLETE', post_ids: ['7400000000000000001'] }); // exact, not rounded
    expect(calls[0]!.headers.Authorization).toBe('Bearer tok');
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.headers['Content-Range']).toBe('bytes 0-999/1000');
    expect(JSON.parse(String(calls[1]!.body)).post_info.title).toBe('c');
  });
  it('splits uploads into chunks with correct ranges, remainder in the last', async () => {
    const { f, calls } = fakeTikTok();
    const size = 70 * 1024 * 1024 + 5;
    await uploadVideo(f, 'https://upload.example/u', new Uint8Array(size));
    const ranges = calls.filter((c) => c.method === 'PUT').map((c) => c.headers['Content-Range']);
    expect(ranges.length).toBe(7);
    expect(ranges.at(-1)).toBe(`bytes ${6 * 10 * 1024 * 1024}-${size - 1}/${size}`);
  });
  it('surfaces API errors with their code', async () => {
    const f: Fetch = async () => new Response(JSON.stringify({ error: { code: 'unaudited_client_can_only_post_to_private_accounts', message: 'x' } }), { status: 403 });
    await expect(queryCreatorInfo(f, 't')).rejects.toBeInstanceOf(TikTokApiError);
  });
});

describe('OAuth', () => {
  it('builds the authorize URL with all scopes', () => {
    const u = new URL(authorizeUrl('st', 'ck', 'https://example.com/cb'));
    expect(u.origin + u.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(u.searchParams.get('scope')).toBe('user.info.basic,video.publish,video.upload,video.list');
    expect(u.searchParams.get('state')).toBe('st');
  });
  it('refreshes an expiring token and saves it', async () => {
    process.env.TIKTOK_CLIENT_KEY = 'ck';
    process.env.TIKTOK_CLIENT_SECRET = 'cs';
    delete process.env.TIKTOK_ACCESS_TOKEN;
    const dir = mkdtempSync(join(tmpdir(), 'tt-'));
    const path = join(dir, 'token.json');
    const now = 1_000_000;
    writeFileSync(path, JSON.stringify({ access_token: 'old', refresh_token: 'r1', expires_at: now + 60_000, refresh_expires_at: now + 1e9, open_id: 'o', scope: 's' }));
    let sent = '';
    const f: Fetch = async (_u, init) => { sent = String(init?.body); return new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2', expires_in: 86400, refresh_expires_in: 1e6, open_id: 'o', scope: 's' })); };
    expect(await accessToken(f, path, now)).toBe('new');
    expect(sent).toContain('grant_type=refresh_token');
    expect(sent).toContain('refresh_token=r1');
    expect(await accessToken(f, path, now)).toBe('new'); // saved and still fresh
  });
});
