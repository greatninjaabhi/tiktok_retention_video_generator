/** TikTok caption = caption text + hashtags (the API's post_info.title; max 2,200 UTF-16 units). */
import type { BeatSheet } from '../scripts/beatsheet';

export const MAX_CAPTION = 2200;

/** Every source the script cites, in order. */
export function sourcesOf(sheet: BeatSheet): string[] {
  const urls = new Set<string>();
  if (sheet.claim) urls.add(sheet.claim.source.url);
  for (const b of sheet.beats) {
    for (const c of b.claims ?? []) c.sources.forEach((s) => urls.add(s.url));
    b.verdict?.sources.forEach((s) => urls.add(s.url));
  }
  return [...urls];
}

export function buildCaption(sheet: BeatSheet): string {
  const base = (sheet.caption ?? sheet.hook.spoken).trim();
  const tags = [...new Set((sheet.hashtags ?? []).map((h) => '#' + h.replace(/^#/, '').replace(/\s+/g, '').toLowerCase()).filter((h) => h.length > 1))];
  let caption = `${base}\n\n${tags.join(' ')}`.trim();
  // Drop trailing hashtags rather than cut words if it's too long (String#length counts UTF-16 units).
  while (caption.length > MAX_CAPTION && tags.length) caption = `${base}\n\n${tags.slice(0, --tags.length).join(' ')}`.trim();
  return caption.length > MAX_CAPTION ? caption.slice(0, MAX_CAPTION) : caption;
}
