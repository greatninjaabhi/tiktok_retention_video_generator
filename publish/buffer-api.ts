/**
 * Buffer GraphQL API (https://developers.buffer.com): schedules posts through Buffer's connection
 * to TikTok. Pure builders + a thin call, so it's testable without a key.
 * ⚠️ Buffer's docs disagree on whether createPost accepts TikTok, and it takes video by public URL
 * only. `npm run buffer -- channels` and a draft are the way to find out on a real account.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BeatSheet } from '../scripts/beatsheet';
import { buildCaption, MAX_CAPTION, sourcesOf } from './caption';
import type { Fetch } from './tiktok-api';

export const BUFFER_ENDPOINT = 'https://api.buffer.com';
/** Buffer rejects more than this on TikTok. */
export const MAX_BUFFER_HASHTAGS = 5;

export type BufferChannel = { id: string; name: string; service: string };
export type VideoPost = { channelId: string; text: string; videoUrl: string; dueAt?: string; draft: boolean };

export class BufferApiError extends Error {}

/** Keys live in the gitignored .env file; a variable that's already set wins. */
export function loadEnv(): void {
  const envFile = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function bufferKey(): string {
  loadEnv();
  const key = process.env.BUFFER_API_KEY;
  if (!key || key === 'paste-your-key-here') throw new BufferApiError('put your key in the .env file as BUFFER_API_KEY=... (https://publish.buffer.com/settings/api)');
  return key;
}

export async function gql<T>(f: Fetch, key: string, query: string): Promise<T> {
  const res = await f(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (res.status === 401 || res.status === 403) throw new BufferApiError(`Buffer rejected the API key (${res.status})`);
  if (!res.ok) throw new BufferApiError(`Buffer answered ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new BufferApiError(json.errors.map((e) => e.message).join('; '));
  return json.data as T;
}

export async function listChannels(f: Fetch, key: string): Promise<BufferChannel[]> {
  const { account } = await gql<{ account: { organizations: { id: string }[] } }>(f, key, 'query { account { organizations { id } } }');
  const out: BufferChannel[] = [];
  for (const org of account.organizations) {
    const { channels } = await gql<{ channels: BufferChannel[] }>(f, key, `query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name service } }`);
    out.push(...channels);
  }
  return out;
}

export const isTikTok = (c: BufferChannel) => /tiktok/i.test(c.service);

export async function pickTikTokChannel(f: Fetch, key: string, wanted?: string): Promise<BufferChannel> {
  const channels = (await listChannels(f, key)).filter(isTikTok);
  const channel = wanted ? channels.find((c) => c.id === wanted) : channels.length === 1 ? channels[0] : undefined;
  if (!channel) throw new BufferApiError(`pick one TikTok channel with --channel. Found: ${channels.map((c) => `${c.id} (${c.name})`).join(', ') || 'none'}`);
  return channel;
}

export function bufferCaption(sheet: BeatSheet): string {
  const caption = buildCaption({ ...sheet, hashtags: (sheet.hashtags ?? []).slice(0, MAX_BUFFER_HASHTAGS) });
  // Sources travel with the post, so nobody has to pin a comment by hand.
  const withSources = `${caption}\n\nSources:\n${sourcesOf(sheet).join('\n')}`;
  return withSources.length <= MAX_CAPTION ? withSources : caption;
}

export function createVideoPostMutation(p: VideoPost): string {
  const when = p.dueAt ? `mode: customScheduled, dueAt: ${JSON.stringify(p.dueAt)}` : 'mode: addToQueue';
  return `mutation {
  createPost(input: {
    text: ${JSON.stringify(p.text)},
    channelId: ${JSON.stringify(p.channelId)},
    schedulingType: automatic,
    ${when},
    saveToDraft: ${p.draft},
    assets: [{ video: { url: ${JSON.stringify(p.videoUrl)} } }]
  }) {
    ... on PostActionSuccess { post { id } }
    ... on MutationError { message }
  }
}`;
}

export async function createVideoPost(f: Fetch, key: string, p: VideoPost): Promise<string> {
  const { createPost } = await gql<{ createPost: { post?: { id: string }; message?: string } }>(f, key, createVideoPostMutation(p));
  if (!createPost.post) throw new BufferApiError(createPost.message ?? 'Buffer did not create the post');
  return createPost.post.id;
}

/** Buffer fetches the file itself, possibly days later, so catch a bad link now. Returns why it's unusable, or null. */
export async function videoUrlProblem(f: Fetch, url: string, localBytes?: number): Promise<string | null> {
  if (!url.startsWith('https://')) return 'the video URL must be https';
  let res: Response;
  try {
    res = await f(url, { method: 'HEAD' });
  } catch (e) {
    return `can't reach the video URL: ${(e as Error).message}`;
  }
  if (!res.ok) return `the video URL answered ${res.status}; it must load without a login`;
  const type = res.headers.get('content-type') ?? '';
  if (!/^video\/|octet-stream/i.test(type)) return `the URL serves "${type}", not a video; it must be a direct link to the file`;
  const size = Number(res.headers.get('content-length') ?? 0);
  if (localBytes && size && size !== localBytes) return `the hosted file is ${size} bytes but your render is ${localBytes}: it isn't this version of the video`;
  return null;
}
