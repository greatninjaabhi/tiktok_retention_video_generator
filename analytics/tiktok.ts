/**
 * TikTok numbers (brief §5.7.1), all inside TikTok's rules:
 *  1. Display API (official, own account): views/likes/comments/shares per video → velocity.
 *  2. TikTok Studio CSV export (weekly, manual download): watch time, full-watch rate.
 * ⚠ Verify the CSV columns on the first real export; the importer maps common header variants.
 */
import type { Snapshot, Store, StudioStats } from './store';
import { byTiktokId } from './store';

// ------------------------------------------------------------ Display API
export type DisplayVideo = { id: string; create_time: number; duration?: number; title?: string; view_count?: number; like_count?: number; comment_count?: number; share_count?: number; share_url?: string };

export function parseVideoList(json: unknown): { videos: DisplayVideo[]; cursor?: number; hasMore: boolean } {
  const d = (json as { data?: { videos?: DisplayVideo[]; cursor?: number; has_more?: boolean }; error?: { code?: string; message?: string } });
  if (d.error && d.error.code && d.error.code !== 'ok') throw new Error(`TikTok API: ${d.error.code} ${d.error.message ?? ''}`);
  return { videos: d.data?.videos ?? [], cursor: d.data?.cursor, hasMore: !!d.data?.has_more };
}

/** Needs a user access token with the video.list scope (Login Kit) in TIKTOK_ACCESS_TOKEN. */
export async function fetchAllVideos(token = process.env.TIKTOK_ACCESS_TOKEN): Promise<DisplayVideo[]> {
  if (!token) throw new Error('TIKTOK_ACCESS_TOKEN not set (Display API, video.list scope)');
  const fields = 'id,create_time,duration,title,view_count,like_count,comment_count,share_count,share_url';
  const out: DisplayVideo[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
    });
    const r = parseVideoList(await res.json());
    out.push(...r.videos);
    if (!r.hasMore) break;
    cursor = r.cursor;
  }
  return out;
}

export function recordSnapshots(store: Store, videos: DisplayVideo[], at = new Date()): number {
  let n = 0;
  for (const v of videos) {
    const rec = byTiktokId(store, v.id);
    if (!rec) continue;
    rec.postedAt ??= new Date(v.create_time * 1000).toISOString();
    const snap: Snapshot = { at: at.toISOString(), views: v.view_count ?? 0, likes: v.like_count ?? 0, comments: v.comment_count ?? 0, shares: v.share_count ?? 0, source: 'api' };
    rec.snapshots.push(snap);
    n++;
  }
  return n;
}

// ------------------------------------------------------------ Studio CSV
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
const FIELDS: Record<keyof Omit<StudioStats, 'importedAt'> | 'link' | 'views' | 'likes' | 'comments' | 'shares', RegExp> = {
  link: /(video )?(link|url)|post link/,
  views: /^(total )?(video )?views$|^video views$|^views$/,
  likes: /^(total )?likes$/,
  comments: /^(total )?comments$/,
  shares: /^(total )?shares$/,
  avgWatchSec: /average (watch|play) ?time|avg watch time/,
  fullWatchRate: /(watched|play(ed)?) (the )?full video|full video (rate|%)|completion rate/,
  follows: /new followers|followers gained|^follows$/,
  profileVisits: /profile (views|visits)/,
};

/** "12.4", "12.4s", "0:12", "00:00:12" → seconds; "34%", "34.0 %", "0.34" → 0–1. */
export function toSeconds(v: string): number | undefined {
  const s = v.trim();
  if (/^\d+(:\d+){1,2}$/.test(s)) return s.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return isNaN(n) ? undefined : n;
}
export function toRate(v: string): number | undefined {
  const n = parseFloat(v.replace(/[^\d.]/g, ''));
  if (isNaN(n)) return undefined;
  return v.includes('%') || n > 1 ? n / 100 : n;
}
const toInt = (v: string) => { const n = parseInt(v.replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; };

export type CsvImport = { matched: number; unmatched: string[]; columns: Record<string, string | null> };

/** Import a Studio export. Rows are matched to our videos by the numeric id in the video link. */
export function importStudioCsv(store: Store, csv: string, at = new Date()): CsvImport {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return { matched: 0, unmatched: [], columns: {} };
  const idx: Record<string, number> = {};
  const columns: Record<string, string | null> = {};
  for (const [field, re] of Object.entries(FIELDS)) {
    const i = header.findIndex((h) => re.test(norm(h)));
    idx[field] = i;
    columns[field] = i >= 0 ? header[i]! : null;
  }
  const get = (r: string[], f: string) => (idx[f]! >= 0 ? r[idx[f]!] ?? '' : '');
  let matched = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const link = get(r, 'link');
    const tiktokId = link.match(/video\/(\d+)/)?.[1] ?? (/^\d{8,}$/.test(link.trim()) ? link.trim() : undefined);
    const rec = tiktokId ? byTiktokId(store, tiktokId) : undefined;
    if (!rec) { unmatched.push(link || r.join(',').slice(0, 60)); continue; }
    rec.studio = {
      avgWatchSec: get(r, 'avgWatchSec') ? toSeconds(get(r, 'avgWatchSec')) : rec.studio?.avgWatchSec,
      fullWatchRate: get(r, 'fullWatchRate') ? toRate(get(r, 'fullWatchRate')) : rec.studio?.fullWatchRate,
      follows: get(r, 'follows') ? toInt(get(r, 'follows')) : rec.studio?.follows,
      profileVisits: get(r, 'profileVisits') ? toInt(get(r, 'profileVisits')) : rec.studio?.profileVisits,
      importedAt: at.toISOString(),
    };
    if (get(r, 'views')) rec.snapshots.push({ at: at.toISOString(), views: toInt(get(r, 'views')), likes: toInt(get(r, 'likes')), comments: toInt(get(r, 'comments')), shares: toInt(get(r, 'shares')), source: 'csv' });
    matched++;
  }
  return { matched, unmatched, columns };
}
