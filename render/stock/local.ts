/**
 * Local drop folder: inbox/stock/<name>.jpg|png + <name>.json with its license.
 * For images you downloaded yourself from a commercial-use source. No sidecar = not used.
 * Sidecar: { "pageUrl": "...", "creator": "...", "license": "Pexels License", "licenseUrl": "...", "tags": "piggy bank savings" }
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StockCandidate, StockProvider } from './types';

export const INBOX = fileURLToPath(new URL('../../inbox/stock/', import.meta.url));

type Sidecar = { pageUrl: string; creator: string; license: string; licenseUrl: string; tags?: string; attributionRequired?: boolean; width?: number; height?: number };

export function localCandidates(dir = INBOX): { cands: StockCandidate[]; skipped: string[] } {
  if (!existsSync(dir)) return { cands: [], skipped: [] };
  const cands: StockCandidate[] = [];
  const skipped: string[] = [];
  for (const f of readdirSync(dir).filter((n) => /\.(jpe?g|png)$/i.test(n))) {
    const base = f.replace(/\.[^.]+$/, '');
    const side = join(dir, base + '.json');
    if (!existsSync(side)) { skipped.push(`${f}: no ${base}.json license sidecar`); continue; }
    const s = JSON.parse(readFileSync(side, 'utf8')) as Sidecar;
    if (!s.license || !s.pageUrl) { skipped.push(`${f}: sidecar needs at least "license" and "pageUrl"`); continue; }
    cands.push({
      id: `local:${base}`, provider: 'local', pageUrl: s.pageUrl, downloadUrl: 'file://' + join(dir, f),
      width: s.width ?? 0, height: s.height ?? 0, creator: s.creator ?? 'unknown', license: s.license,
      licenseUrl: s.licenseUrl ?? '', attributionRequired: s.attributionRequired ?? false, text: `${base.replace(/[-_]/g, ' ')} ${s.tags ?? ''}`,
    });
  }
  return { cands, skipped };
}

export const local: StockProvider = {
  id: 'local',
  available: () => true,
  search: async (q) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return localCandidates().cands
      .map((c) => ({ c, score: words.filter((w) => c.text.toLowerCase().includes(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  },
};
