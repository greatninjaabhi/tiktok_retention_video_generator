import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { parse } from 'yaml';

export type Lean = 'left' | 'lean_left' | 'center' | 'lean_right' | 'right' | 'fact_checker' | 'primary' | 'trends';
export type FeedSource = { outlet: string; lean: Lean; kind: 'news' | 'fact_checker' | 'primary' | 'trends'; url: string; verify?: boolean };
export type RadarConfig = {
  feeds: FeedSource[];
  conflict_words: string[];
  claim_words: string[];
  topic_type_words: Record<string, string[]>;
};
export type Item = { title: string; link: string; published: Date; outlet: string; lean: Lean; kind: FeedSource['kind'] };

export function loadRadarConfig(channel = 'politics'): RadarConfig {
  return parse(readFileSync(fileURLToPath(new URL(`../../channels/${channel}/sources.yaml`, import.meta.url)), 'utf8')) as RadarConfig;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : (v as { '#text'?: string })?.['#text'] ?? '');
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** RSS 2.0 or Atom → items. Undated items get `fallbackDate`. */
export function parseFeed(body: string, src: FeedSource, fallbackDate = new Date()): Item[] {
  const doc = xml.parse(body);
  const rssItems = arr(doc?.rss?.channel?.item);
  const atomEntries = arr(doc?.feed?.entry);
  const raw = rssItems.length
    ? rssItems.map((i: Record<string, unknown>) => ({ title: text(i.title), link: text(i.link), date: text(i.pubDate) || text(i['dc:date']) }))
    : atomEntries.map((e: Record<string, unknown>) => {
        const links = arr(e.link as { '@_href'?: string } | { '@_href'?: string }[]);
        return { title: text(e.title), link: links[0]?.['@_href'] ?? '', date: text(e.updated) || text(e.published) };
      });
  return raw
    .filter((r) => r.title.trim())
    .map((r) => {
      const d = r.date ? new Date(r.date) : fallbackDate;
      return { title: r.title.replace(/\s+/g, ' ').trim(), link: r.link.trim(), published: isNaN(+d) ? fallbackDate : d, outlet: src.outlet, lean: src.lean, kind: src.kind };
    });
}

export async function fetchFeed(src: FeedSource): Promise<Item[]> {
  const res = await fetch(src.url, { headers: { 'User-Agent': 'tiktok-retention-video-generator topic radar' } });
  if (!res.ok) throw new Error(`${res.status}`);
  return parseFeed(await res.text(), src);
}
