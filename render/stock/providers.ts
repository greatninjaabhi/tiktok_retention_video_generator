/**
 * Commercial-use stock sources. Parsers are pure (unit-tested); `search` does the HTTP call.
 * Keys: PEXELS_API_KEY, PIXABAY_API_KEY (both free). Openverse needs no key; we restrict it to
 * CC0 / public domain so no attribution is owed. ⚠️ Re-read each license before launch (brief §1.7).
 */
import type { StockCandidate, StockProvider } from './types';

export const USER_AGENT = 'tiktok-retention-video-generator/0.1 (stock photo search)';

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
    if (res.ok) return res.json();
    // Rate limits and gateway errors are usually temporary.
    if (attempt >= 2 || (res.status !== 429 && res.status < 500)) throw new Error(`${new URL(url).host} answered ${res.status}`);
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
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

// ------------------------------------------------------------ Wikimedia Commons
// Real places and events (brief §0.5, public-domain federal photos). Public domain / CC0 only.
type CommonsMeta = Record<string, { value?: string } | undefined>;
type CommonsPage = {
  pageid: number; index?: number; title: string;
  imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; url: string; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: CommonsMeta }[];
};
const plain = (s?: string) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export function parseWikimedia(json: unknown): StockCandidate[] {
  const pages = Object.values((json as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages ?? {});
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const i = p.imageinfo?.[0];
      const m = i?.extmetadata ?? {};
      const license = m.License?.value ?? '';
      if (!i || !['image/jpeg', 'image/png'].includes(i.mime)) return [];
      if ((license !== 'pd' && license !== 'cc0') || m.AttributionRequired?.value === 'true') return [];
      return [{
        id: `wikimedia:${p.pageid}`, provider: 'wikimedia' as const, pageUrl: i.descriptionurl,
        downloadUrl: i.thumburl ?? i.url, width: i.thumbwidth ?? i.width, height: i.thumbheight ?? i.height,
        creator: plain(m.Artist?.value) || 'unknown', license: m.LicenseShortName?.value ?? license,
        licenseUrl: m.LicenseUrl?.value ?? i.descriptionurl, attributionRequired: false,
        text: [p.title, plain(m.ImageDescription?.value)].join(' '),
      }];
    });
}
export const wikimedia: StockProvider = {
  id: 'wikimedia',
  available: () => true,
  search: async (q) => {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    const params = { action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '30', gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280' };
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return parseWikimedia(await getJson(u.href));
  },
};

/** Preference order: best stock quality first. */
export const PROVIDERS: StockProvider[] = [pexels, pixabay, wikimedia, openverse];
