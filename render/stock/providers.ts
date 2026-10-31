/**
 * Commercial-use stock sources. Parsers are pure (unit-tested); `search` does the HTTP call.
 * Keys: PEXELS_API_KEY, PIXABAY_API_KEY (both free). Openverse needs no key; we restrict it to
 * CC0 / public domain so no attribution is owed. ⚠️ Re-read each license before launch (brief §1.7).
 */
import type { StockCandidate, StockProvider } from './types';

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': 'tiktok-retention-video-generator', ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

// --------------------------------------------------------------------- Pexels
type PexelsPhoto = { id: number; width: number; height: number; url: string; photographer: string; alt?: string; src: { original: string; large2x: string } };
export function parsePexels(json: unknown): StockCandidate[] {
  const photos = (json as { photos?: PexelsPhoto[] }).photos ?? [];
  return photos.map((p) => ({
    id: `pexels:${p.id}`, provider: 'pexels', pageUrl: p.url, downloadUrl: p.src.large2x || p.src.original,
    width: p.width, height: p.height, creator: p.photographer,
    license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', attributionRequired: false, text: p.alt ?? '',
  }));
}
export const pexels: StockProvider = {
  id: 'pexels',
  available: () => !!process.env.PEXELS_API_KEY,
  search: async (q, n) => parsePexels(await getJson(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=${n}`,
    { Authorization: process.env.PEXELS_API_KEY! },
  )),
};

// -------------------------------------------------------------------- Pixabay
type PixabayHit = { id: number; pageURL: string; tags: string; largeImageURL: string; imageWidth: number; imageHeight: number; user: string };
export function parsePixabay(json: unknown): StockCandidate[] {
  const hits = (json as { hits?: PixabayHit[] }).hits ?? [];
  return hits.map((h) => ({
    id: `pixabay:${h.id}`, provider: 'pixabay', pageUrl: h.pageURL, downloadUrl: h.largeImageURL,
    width: h.imageWidth, height: h.imageHeight, creator: h.user,
    license: 'Pixabay Content License', licenseUrl: 'https://pixabay.com/service/license-summary/', attributionRequired: false, text: h.tags,
  }));
}
export const pixabay: StockProvider = {
  id: 'pixabay',
  available: () => !!process.env.PIXABAY_API_KEY,
  search: async (q, n) => parsePixabay(await getJson(
    `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=${Math.max(3, n)}`,
  )),
};

// ------------------------------------------------------------------ Openverse
type OpenverseResult = {
  id: string; title?: string; url: string; foreign_landing_url: string; creator?: string; license: string;
  license_version?: string; license_url?: string; width?: number; height?: number; tags?: { name: string }[];
};
export function parseOpenverse(json: unknown): StockCandidate[] {
  const results = (json as { results?: OpenverseResult[] }).results ?? [];
  return results
    .filter((r) => r.license === 'cc0' || r.license === 'pdm') // no attribution owed
    .map((r) => ({
      id: `openverse:${r.id}`, provider: 'openverse', pageUrl: r.foreign_landing_url, downloadUrl: r.url,
      width: r.width ?? 0, height: r.height ?? 0, creator: r.creator ?? 'unknown',
      license: r.license === 'cc0' ? 'CC0 1.0' : 'Public Domain Mark 1.0',
      licenseUrl: r.license_url ?? (r.license === 'cc0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : 'https://creativecommons.org/publicdomain/mark/1.0/'),
      attributionRequired: false, text: [r.title ?? '', ...(r.tags ?? []).map((t) => t.name)].join(' '),
    }));
}
export const openverse: StockProvider = {
  id: 'openverse',
  available: () => true,
  search: async (q, n) => parseOpenverse(await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&category=photograph&page_size=${n}`,
  )),
};

/** Preference order: best stock quality first. */
export const PROVIDERS: StockProvider[] = [pexels, pixabay, openverse];
