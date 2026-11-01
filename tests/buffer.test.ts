import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hostOnGitHub, repoFromRemote } from '../publish/github-host';
import { BufferApiError, MAX_BUFFER_HASHTAGS, bufferCaption, createVideoPost, createVideoPostMutation, isTikTok, listChannels, videoUrlProblem } from '../publish/buffer-api';
import type { Fetch } from '../publish/tiktok-api';
import { loadBeatSheet } from '../scripts/beatsheet';

const sheet = loadBeatSheet(fileURLToPath(new URL('../scripts/videos/2026-10-31-two-dan-sullivans-alaska.yaml', import.meta.url)));

/** Fake Buffer: answers GraphQL by query shape and records requests. */
function fakeBuffer(createPost: unknown = { post: { id: 'post1' } }) {
  const bodies: string[] = [];
  const auth: string[] = [];
  const f: Fetch = async (_url, init) => {
    const { query } = JSON.parse(String(init?.body)) as { query: string };
    bodies.push(query);
    auth.push((init?.headers as Record<string, string>).Authorization!);
    if (query.includes('account')) return Response.json({ data: { account: { organizations: [{ id: 'org1' }] } } });
    if (query.includes('channels(')) return Response.json({ data: { channels: [{ id: 'c1', name: 'x', service: 'twitter' }, { id: 'c2', name: 'stick', service: 'tiktok' }] } });
    return Response.json({ data: { createPost } });
  };
  return { f, bodies, auth };
}

describe('Buffer posting', () => {
  const post = { channelId: 'c2', text: 'He said "hi"\n#tag', videoUrl: 'https://cdn.example/v.mp4', draft: true };

  it('finds the TikTok channel across organizations', async () => {
    const { f, auth } = fakeBuffer();
    const channels = await listChannels(f, 'k');
    expect(channels.filter(isTikTok).map((c) => c.id)).toEqual(['c2']);
    expect(auth[0]).toBe('Bearer k');
  });
  it('saves a draft by default shape and escapes the caption', () => {
    const m = createVideoPostMutation(post);
    expect(m).toContain('saveToDraft: true');
    expect(m).toContain('mode: addToQueue');
    expect(m).toContain(JSON.stringify(post.text));
  });
  it('schedules at a set time when publishing', () => {
    const m = createVideoPostMutation({ ...post, draft: false, dueAt: '2026-11-02T18:00:00Z' });
    expect(m).toContain('saveToDraft: false');
    expect(m).toContain('mode: customScheduled, dueAt: "2026-11-02T18:00:00Z"');
  });
  it('returns the post id and surfaces Buffer errors', async () => {
    expect(await createVideoPost(fakeBuffer().f, 'k', post)).toBe('post1');
    await expect(createVideoPost(fakeBuffer({ message: 'TikTok is not supported' }).f, 'k', post)).rejects.toThrow(new BufferApiError('TikTok is not supported'));
  });
  it('keeps to Buffer\'s hashtag limit', () => {
    const tags = bufferCaption({ ...sheet, hashtags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }).match(/#\w+/g)!;
    expect(tags).toHaveLength(MAX_BUFFER_HASHTAGS);
  });
});

describe('sources in the caption', () => {
  it('lists every source once, so nothing has to be pinned by hand', () => {
    const c = bufferCaption(sheet);
    expect(c).toContain('Sources:\nhttps://www.factcheck.org/');
    expect(c.match(/vote\.gov/g)).toHaveLength(1);
    expect(c.length).toBeLessThanOrEqual(2200);
  });
  it('drops the list rather than go over the limit', () => {
    const c = bufferCaption({ ...sheet, caption: 'x'.repeat(2000) });
    expect(c).not.toContain('Sources:');
  });
});

describe('GitHub video hosting', () => {
  it('reads the repo from either remote style', () => {
    expect(repoFromRemote('https://github.com/a/b.git\n')).toBe('a/b');
    expect(repoFromRemote('git@github.com:a/b.git')).toBe('a/b');
  });
  function fakeGitHub(existing: boolean) {
    const calls: string[] = [];
    const f: Fetch = async (url, init) => {
      const u = String(url), method = init?.method ?? 'GET';
      calls.push(`${method} ${u}`);
      if (method === 'GET') return existing
        ? Response.json({ upload_url: 'https://uploads.example/1/assets{?name,label}', assets: [{ id: 7, name: 'video.mp4', browser_download_url: 'old' }] })
        : new Response('{}', { status: 404 });
      if (method === 'DELETE') return new Response(null, { status: 204 });
      if (u.endsWith('/releases')) return Response.json({ upload_url: 'https://uploads.example/1/assets{?name,label}', assets: [] });
      return Response.json({ id: 8, name: 'video.mp4', browser_download_url: 'https://github.com/a/b/releases/download/video-v1/video.mp4' });
    };
    return { f, calls };
  }
  it('creates a release and uploads', async () => {
    const { f, calls } = fakeGitHub(false);
    expect(await hostOnGitHub(f, 't', 'a/b', 'v1', new Uint8Array(3))).toContain('/video-v1/video.mp4');
    expect(calls).toContain('POST https://api.github.com/repos/a/b/releases');
    expect(calls).toContain('POST https://uploads.example/1/assets?name=video.mp4');
  });
  it('replaces the old file on a re-render', async () => {
    const { f, calls } = fakeGitHub(true);
    await hostOnGitHub(f, 't', 'a/b', 'v1', new Uint8Array(3));
    expect(calls).toContain('DELETE https://api.github.com/repos/a/b/releases/assets/7');
  });
});

describe('hosted video check', () => {
  const host = (status: number, type: string, size?: number): Fetch => async () =>
    new Response(null, { status, headers: { 'content-type': type, ...(size ? { 'content-length': String(size) } : {}) } });
  it('accepts a direct https link to this render', async () => {
    expect(await videoUrlProblem(host(200, 'video/mp4', 100), 'https://x/v.mp4', 100)).toBeNull();
  });
  it('rejects http, logins, web pages and stale files', async () => {
    expect(await videoUrlProblem(host(200, 'video/mp4'), 'http://x/v.mp4')).toMatch(/https/);
    expect(await videoUrlProblem(host(403, 'text/html'), 'https://x/v.mp4')).toMatch(/403/);
    expect(await videoUrlProblem(host(200, 'text/html'), 'https://x/v.mp4')).toMatch(/not a video/);
    expect(await videoUrlProblem(host(200, 'video/mp4', 90), 'https://x/v.mp4', 100)).toMatch(/isn't this version/);
  });
});
