/**
 * assets/stock/manifest.json: every stock image we've downloaded, with its license.
 * The publisher will refuse to export a video that uses an image not in here (brief §1.7).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StockCandidate } from './types';

export type ManifestEntry = Omit<StockCandidate, 'text'> & { query: string; file: string; downloadedAt: string; usedIn: string[] };
export type Manifest = { images: Record<string, ManifestEntry> };

export const MANIFEST_PATH = fileURLToPath(new URL('../../assets/stock/manifest.json', import.meta.url));
export const CACHE_DIR = fileURLToPath(new URL('../../assets/stock/cache/', import.meta.url));

export function readManifest(path = MANIFEST_PATH): Manifest {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Manifest) : { images: {} };
}

export function upsert(m: Manifest, c: StockCandidate, query: string, file: string, now = new Date()): Manifest {
  const { text: _text, ...rest } = c;
  const prev = m.images[c.id];
  m.images[c.id] = { ...rest, query, file, downloadedAt: prev?.downloadedAt ?? now.toISOString(), usedIn: prev?.usedIn ?? [] };
  return m;
}

export function markUsed(m: Manifest, id: string, videoId: string): Manifest {
  const e = m.images[id];
  if (!e) throw new Error(`stock image ${id} is not in the manifest; refusing to use an unlogged image`);
  if (!e.usedIn.includes(videoId)) e.usedIn.push(videoId);
  return m;
}

export function writeManifest(m: Manifest, path = MANIFEST_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(m.images).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, JSON.stringify({ images: sorted }, null, 2) + '\n');
}
