/**
 * Derived metrics and the picker's reward (brief §5.7.1, §8):
 * reward = weighted z-scores vs the channel's own last 20 videos of
 *   average % viewed (CSV) · full-watch rate (CSV) · 48 h view velocity (API) · shares per 1K (API).
 * Until a video has Studio CSV data its reward is marked provisional (velocity + shares only).
 */
import type { VideoRecord } from './store';

export type Derived = { avgPctViewed?: number; fullWatchRate?: number; views48h?: number; sharesPer1k?: number; followsPer1k?: number; latestViews: number };

/** Views at `hours` after posting, interpolated between snapshots (undefined if not reached yet). */
export function viewsAt(v: VideoRecord, hours: number): number | undefined {
  if (!v.postedAt) return undefined;
  const t0 = +new Date(v.postedAt);
  const pts = [{ h: 0, views: 0 }, ...v.snapshots.map((s) => ({ h: (+new Date(s.at) - t0) / 3.6e6, views: s.views }))].sort((a, b) => a.h - b.h);
  const after = pts.find((p) => p.h >= hours);
  if (!after) return undefined;
  const before = [...pts].reverse().find((p) => p.h <= hours)!;
  if (after.h === before.h) return after.views;
  return before.views + ((after.views - before.views) * (hours - before.h)) / (after.h - before.h);
}

export function derive(v: VideoRecord): Derived {
  const latest = [...v.snapshots].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
  const views = latest?.views ?? 0;
  return {
    avgPctViewed: v.studio?.avgWatchSec !== undefined && v.durationSec ? v.studio.avgWatchSec / v.durationSec : undefined,
    fullWatchRate: v.studio?.fullWatchRate,
    views48h: viewsAt(v, 48),
    sharesPer1k: views > 0 ? ((latest?.shares ?? 0) / views) * 1000 : undefined,
    followsPer1k: views > 0 && v.studio?.follows !== undefined ? (v.studio.follows / views) * 1000 : undefined,
    latestViews: views,
  };
}

const WEIGHTS = { avgPctViewed: 0.35, fullWatchRate: 0.25, views48h: 0.25, sharesPer1k: 0.15 } as const;
type Key = keyof typeof WEIGHTS;
const transform = (k: Key, x: number) => (k === 'views48h' ? Math.log10(1 + x) : x); // views are heavy-tailed

export type Reward = { value: number; z: number; provisional: boolean; used: Key[] };

/** Reward in [0, 1] (logistic of the weighted z-score) vs the previous `window` videos. */
export function reward(v: VideoRecord, history: VideoRecord[], window = 20): Reward | undefined {
  const d = derive(v);
  const prior = history.filter((h) => h.id !== v.id && h.postedAt && v.postedAt && h.postedAt < v.postedAt)
    .sort((a, b) => (b.postedAt! < a.postedAt! ? -1 : 1)).slice(0, window).map(derive);
  let z = 0, wsum = 0;
  const used: Key[] = [];
  for (const k of Object.keys(WEIGHTS) as Key[]) {
    const x = d[k];
    const xs = prior.map((p) => p[k]).filter((y): y is number => y !== undefined).map((y) => transform(k, y));
    if (x === undefined || xs.length < 3) continue;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1e-9;
    z += WEIGHTS[k] * Math.max(-3, Math.min(3, (transform(k, x) - mean) / sd));
    wsum += WEIGHTS[k];
    used.push(k);
  }
  if (!wsum) return undefined;
  const zn = z / wsum;
  return { value: 1 / (1 + Math.exp(-zn)), z: zn, provisional: !used.includes('avgPctViewed') && !used.includes('fullWatchRate'), used };
}
