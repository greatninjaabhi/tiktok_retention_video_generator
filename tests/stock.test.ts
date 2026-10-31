import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOpenverse, parsePexels, parsePixabay } from '../render/stock/providers';
import { screen } from '../render/stock/filter';
import { markUsed, upsert, type Manifest } from '../render/stock/manifest';
import { localCandidates } from '../render/stock/local';
import { transitionsFor } from '../render/stock/panel';
import type { StockCandidate } from '../render/stock/types';

// Response shapes follow each API's documented JSON (trimmed to the fields we read).
describe('provider parsers', () => {
  it('pexels', () => {
    const [c] = parsePexels({ photos: [{ id: 1, width: 4000, height: 2600, url: 'https://www.pexels.com/photo/1/', photographer: 'A', alt: 'capitol', src: { original: 'o.jpg', large2x: 'l.jpg' } }] });
    expect(c).toMatchObject({ id: 'pexels:1', downloadUrl: 'l.jpg', attributionRequired: false, license: 'Pexels License' });
  });
  it('pixabay', () => {
    const [c] = parsePixabay({ hits: [{ id: 2, pageURL: 'p', tags: 'vote, ballot', largeImageURL: 'L.jpg', imageWidth: 1920, imageHeight: 1280, user: 'B' }] });
    expect(c).toMatchObject({ id: 'pixabay:2', downloadUrl: 'L.jpg', text: 'vote, ballot' });
  });
  it('openverse keeps only CC0 / public domain (no attribution owed)', () => {
    const cs = parseOpenverse({ results: [
      { id: 'a', url: 'a.jpg', foreign_landing_url: 'pa', license: 'cc0', width: 2000, tags: [{ name: 'senate' }] },
      { id: 'b', url: 'b.jpg', foreign_landing_url: 'pb', license: 'by', width: 2000 },
      { id: 'c', url: 'c.jpg', foreign_landing_url: 'pc', license: 'pdm', width: 2000 },
    ] });
    expect(cs.map((c) => c.id)).toEqual(['openverse:a', 'openverse:c']);
  });
});

const cand = (over: Partial<StockCandidate>): StockCandidate => ({
  id: 'x:1', provider: 'pexels', pageUrl: 'p', downloadUrl: 'd.jpg', width: 2000, height: 1300, creator: 'c',
  license: 'Pexels License', licenseUrl: 'u', attributionRequired: false, text: '', ...over,
});

describe('screening', () => {
  it('rejects AI-tagged, attribution-required and too-small images', () => {
    const { ok, rejected } = screen([
      cand({ id: 'ok' }),
      cand({ id: 'ai', text: 'senate AI-generated illustration' }),
      cand({ id: 'mj', text: 'made with Midjourney' }),
      cand({ id: 'attr', attributionRequired: true }),
      cand({ id: 'small', width: 640 }),
    ]);
    expect(ok.map((c) => c.id)).toEqual(['ok']);
    expect(rejected.map((r) => r.id)).toEqual(['ai', 'mj', 'attr', 'small']);
  });
});

describe('license manifest', () => {
  it('logs downloads and refuses unlogged images', () => {
    const m: Manifest = { images: {} };
    upsert(m, cand({ id: 'pexels:9' }), 'capitol', 'assets/stock/cache/pexels_9.jpg', new Date('2026-10-31T00:00:00Z'));
    markUsed(m, 'pexels:9', 'vid-1');
    expect(m.images['pexels:9']).toMatchObject({ query: 'capitol', usedIn: ['vid-1'], downloadedAt: '2026-10-31T00:00:00.000Z' });
    expect(() => markUsed(m, 'pexels:404', 'vid-1')).toThrow(/not in the manifest/);
  });
});

describe('local drop folder', () => {
  it('only accepts images with a license sidecar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stock-'));
    writeFileSync(join(dir, 'capitol.jpg'), 'x');
    writeFileSync(join(dir, 'capitol.json'), JSON.stringify({ pageUrl: 'https://example.org/p', license: 'Public domain (US federal work)', creator: 'AOC', tags: 'congress' }));
    writeFileSync(join(dir, 'mystery.jpg'), 'x');
    const { cands, skipped } = localCandidates(dir);
    expect(cands.map((c) => c.id)).toEqual(['local:capitol']);
    expect(skipped[0]).toMatch(/mystery\.jpg: no mystery\.json/);
  });
});

describe('panel transitions', () => {
  it('never repeats the same transition twice in a row', () => {
    const t = transitionsFor(40, 'seed');
    for (let i = 1; i < t.length; i++) expect(t[i]).not.toBe(t[i - 1]);
  });
});
