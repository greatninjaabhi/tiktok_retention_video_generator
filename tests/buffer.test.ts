import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
