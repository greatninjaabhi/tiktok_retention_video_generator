/**
 * Per-video analytics store (brief §5.7.1). A JSON file for v0 (a few hundred videos);
 * swap for SQLite when it grows. Lives in analytics/data/ (git-ignored: it's account data).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Snapshot = { at: string; views: number; likes: number; comments: number; shares: number; source: 'api' | 'csv' };
export type StudioStats = { avgWatchSec?: number; fullWatchRate?: number; follows?: number; profileVisits?: number; importedAt: string };
export type VideoRecord = {
  id: string; // beat sheet id
  tiktokId?: string;
  postedAt?: string;
  durationSec: number;
  arm: { format: string; topic_type: string; hook_pattern: string };
  snapshots: Snapshot[];
  studio?: StudioStats;
};
export type Store = { videos: Record<string, VideoRecord> };

export const DB_PATH = fileURLToPath(new URL('./data/db.json', import.meta.url));

export function readStore(path = DB_PATH): Store {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Store) : { videos: {} };
}
export function writeStore(s: Store, path = DB_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2) + '\n');
}
export function byTiktokId(s: Store, tiktokId: string): VideoRecord | undefined {
  return Object.values(s.videos).find((v) => v.tiktokId === tiktokId);
}
