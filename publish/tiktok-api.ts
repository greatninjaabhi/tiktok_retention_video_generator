/**
 * TikTok Content Posting API (official). Flow: creator_info/query → video/init → upload → status/fetch.
 *  - Direct Post (scope video.publish): posts with caption + hashtags. ⚠ Until your app passes
 *    TikTok's audit, posts are restricted to private (SELF_ONLY) viewing.
 *  - Inbox upload (scope video.upload): sends the video to your TikTok drafts; you add the caption
 *    and post from the app (works publicly before the audit).
 * Endpoint paths and the private-only rule are confirmed from TikTok's docs; individual field names
 * marked VERIFY should be checked against developers.tiktok.com on the first real post.
 */
const API = 'https://open.tiktokapis.com';

export type Fetch = typeof fetch;
export type CreatorInfo = {
  creator_nickname?: string;
  creator_username?: string;
  privacy_level_options: string[]; // e.g. PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR, SELF_ONLY
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};
export type PostSettings = {
  caption: string;
  privacy_level: string;
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  /** Commercial content disclosure (VERIFY names): your own brand / a paid partnership. */
  brand_organic_toggle: boolean;
  brand_content_toggle: boolean;
  cover_timestamp_ms?: number;
};
export type InitResult = { publish_id: string; upload_url: string };
export type Status = { status: string; fail_reason?: string; post_ids: string[] };

export class TikTokApiError extends Error {
  constructor(public code: string, message: string) { super(`${code}: ${message}`); }
}

/** Post ids are 64-bit integers; JSON.parse would round them. Quote them before parsing. */
export function quoteBigIds(text: string): string {
  return text.replace(/("publicaly_available_post_id"\s*:\s*\[)([^\]]*)\]/g, (_m, head: string, list: string) =>
    head + list.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (x.startsWith('"') ? x : `"${x}"`)).join(',') + ']');
}

async function call<T>(f: Fetch, token: string, path: string, body: unknown): Promise<T> {
  const res = await f(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body ?? {}),
  });
  const json = JSON.parse(quoteBigIds(await res.text())) as { data?: T; error?: { code?: string; message?: string } };
  if (json.error?.code && json.error.code !== 'ok') throw new TikTokApiError(json.error.code, json.error.message ?? '');
  if (!res.ok) throw new TikTokApiError(String(res.status), 'HTTP error');
  return json.data as T;
}

export const queryCreatorInfo = (f: Fetch, token: string) => call<CreatorInfo>(f, token, '/v2/post/publish/creator_info/query/', {});

/** Upload plan: one chunk up to 64 MB, else 10 MB chunks with the remainder folded into the last (VERIFY limits). */
export function chunkPlan(size: number, chunk = 10 * 1024 * 1024): { chunk_size: number; total_chunk_count: number } {
  if (size <= 64 * 1024 * 1024) return { chunk_size: size, total_chunk_count: 1 };
  return { chunk_size: chunk, total_chunk_count: Math.floor(size / chunk) };
}

export function directPostBody(s: PostSettings, info: CreatorInfo, videoSize: number) {
  if (!info.privacy_level_options.includes(s.privacy_level)) throw new Error(`privacy_level ${s.privacy_level} not offered for this account (${info.privacy_level_options.join(', ')})`);
  return {
    post_info: {
      title: s.caption,
      privacy_level: s.privacy_level,
      disable_comment: s.disable_comment || !!info.comment_disabled,
      disable_duet: s.disable_duet || !!info.duet_disabled,
      disable_stitch: s.disable_stitch || !!info.stitch_disabled,
      brand_organic_toggle: s.brand_organic_toggle,
      brand_content_toggle: s.brand_content_toggle,
      ...(s.cover_timestamp_ms !== undefined ? { video_cover_timestamp_ms: s.cover_timestamp_ms } : {}),
      // AI-content label (is_aigc) intentionally not sent: owner decision 2026-10-31 (brief §5.2).
    },
    source_info: { source: 'FILE_UPLOAD', video_size: videoSize, ...chunkPlan(videoSize) },
  };
}

export const initDirectPost = (f: Fetch, token: string, body: ReturnType<typeof directPostBody>) =>
  call<InitResult>(f, token, '/v2/post/publish/video/init/', body);

export const initInboxUpload = (f: Fetch, token: string, videoSize: number) =>
  call<InitResult>(f, token, '/v2/post/publish/inbox/video/init/', { source_info: { source: 'FILE_UPLOAD', video_size: videoSize, ...chunkPlan(videoSize) } });

/** PUT each chunk with Content-Range: bytes first-last/total. */
export async function uploadVideo(f: Fetch, uploadUrl: string, bytes: Uint8Array): Promise<void> {
  const { chunk_size, total_chunk_count } = chunkPlan(bytes.length);
  for (let i = 0; i < total_chunk_count; i++) {
    const first = i * chunk_size;
    const last = i === total_chunk_count - 1 ? bytes.length - 1 : first + chunk_size - 1;
    const res = await f(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(last - first + 1), 'Content-Range': `bytes ${first}-${last}/${bytes.length}` },
      body: Buffer.from(bytes.buffer, bytes.byteOffset + first, last - first + 1) as unknown as BodyInit,
    });
    if (!res.ok) throw new TikTokApiError(String(res.status), `upload of chunk ${i + 1}/${total_chunk_count} failed`);
  }
}

export async function fetchStatus(f: Fetch, token: string, publishId: string): Promise<Status> {
  const d = await call<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(f, token, '/v2/post/publish/status/fetch/', { publish_id: publishId });
  // TikTok's field really is spelled "publicaly" (VERIFY).
  return { status: d.status, fail_reason: d.fail_reason, post_ids: (d.publicaly_available_post_id ?? []).map(String) };
}

export async function waitForPublish(f: Fetch, token: string, publishId: string, opts: { tries?: number; delayMs?: number } = {}): Promise<Status> {
  let s: Status = { status: 'UNKNOWN', post_ids: [] };
  for (let i = 0; i < (opts.tries ?? 40); i++) {
    s = await fetchStatus(f, token, publishId);
    if (['PUBLISH_COMPLETE', 'FAILED', 'SEND_TO_USER_INBOX'].includes(s.status)) return s;
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 3000));
  }
  return s;
}
