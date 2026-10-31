import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './providers';
import { local } from './local';
import { screen, type Rejection } from './filter';
import { CACHE_DIR, readManifest, upsert, writeManifest } from './manifest';
import type { StockCandidate, StockProvider } from './types';

export type SearchReport = { candidates: StockCandidate[]; rejected: Rejection[]; errors: string[]; skippedProviders: string[] };

/** Search providers in preference order (local drop folder first) until we have `n` usable images. */
export async function searchStock(query: string, n = 3, providers: StockProvider[] = [local, ...PROVIDERS]): Promise<SearchReport> {
  const report: SearchReport = { candidates: [], rejected: [], errors: [], skippedProviders: [] };
  for (const p of providers) {
    if (report.candidates.length >= n) break;
    if (!p.available()) { report.skippedProviders.push(`${p.id} (no API key)`); continue; }
    try {
      const { ok, rejected } = screen(await p.search(query, n * 2));
      report.candidates.push(...ok.slice(0, n - report.candidates.length));
      report.rejected.push(...rejected);
    } catch (e) {
      report.errors.push(`${p.id}: ${(e as Error).message}${(e as Error).cause ? ` (${String((e as Error).cause)})` : ''}`);
    }
  }
  return report;
}

const ext = (url: string) => (/\.png($|\?)/i.test(url) ? 'png' : 'jpg');
export const cachePath = (c: StockCandidate) => `${CACHE_DIR}${c.id.replace(/[^\w.-]+/g, '_')}.${ext(c.downloadUrl)}`;

/** Download into assets/stock/cache/ and log the license in the manifest. Returns the local file. */
export async function download(c: StockCandidate, query: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(c);
  if (!existsSync(file)) {
    if (c.downloadUrl.startsWith('file://')) copyFileSync(fileURLToPath(c.downloadUrl), file);
    else {
      const res = await fetch(c.downloadUrl);
      if (!res.ok) throw new Error(`download ${c.id} failed: ${res.status}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
  }
  writeManifest(upsert(readManifest(), c, query, file.slice(file.indexOf('assets/'))));
  return file;
}

export function dataUri(file: string): string {
  const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}
