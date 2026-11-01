/**
 * Beat sheet: one YAML file per video (scripts/videos/<id>.yaml). The human edits this;
 * everything downstream (voice, render, publish) reads it. Brief §7.1, adapted for §0.5.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export const BEAT_TAGS = ['fact', 'opinion', 'steelman', 'rehook', 'scenario', 'emotion', 'joke', 'cta', 'callback', 'claim', 'verdict', 'caveat', 'what_it_means'] as const;
export type BeatTag = (typeof BEAT_TAGS)[number];
export const VERDICTS = ['TRUE', 'FALSE', 'MISLEADING', 'NEEDS_CONTEXT', 'UNPROVEN'] as const;
export type Verdict = (typeof VERDICTS)[number];
export const LEANS = ['left', 'lean_left', 'center', 'lean_right', 'right', 'primary', 'fact_checker'] as const;

export type Source = { url: string; type: string; note?: string };
export type Claim = { text: string; sources: Source[] };

export type Beat = {
  id: string;
  line: string;
  tags: BeatTag[];
  pose: string;
  expression?: string;
  prop?: string;
  panel?: { stock: string; caption?: string; crop?: 'top' | 'center' } | { meme: string; text?: Record<string, string> };
  camera?: string; // camera meme, e.g. zoom_stare
  claims?: Claim[];
  verdict?: { label: Verdict; sources: Source[] };
  opens?: string; // open-loop id
  closes?: string;
};

export type BeatSheet = {
  id: string;
  channel: string;
  format: 'explainer' | 'fact_check';
  character: string;
  wpm?: number;
  topic: { title: string; type: string; first_seen: string; radar_id?: string };
  hook: { spoken: string; on_screen: string; pattern: string };
  claim?: { speaker: string; quote: string; said_at: string; source: Source };
  research: { url: string; outlet: string; lean: (typeof LEANS)[number] }[];
  beats: Beat[];
  human_edited: boolean;
  disclosures: { sponsor: string; type: string }[];
  caption?: string;
  hashtags?: string[];
};

export class BeatSheetError extends Error {}

/** The most that fits on one line across the photo panel. */
export const MAX_PHOTO_CAPTION = 46;

const req = (cond: unknown, msg: string) => {
  if (!cond) throw new BeatSheetError(msg);
};

/** Parse + structural validation. Content rules live in the linter. */
export function parseBeatSheet(yamlText: string): BeatSheet {
  const b = parse(yamlText) as BeatSheet;
  req(b && typeof b === 'object', 'empty beat sheet');
  for (const k of ['id', 'channel', 'format', 'character'] as const) req(typeof b[k] === 'string', `missing "${k}"`);
  req(['explainer', 'fact_check'].includes(b.format), `format must be explainer or fact_check`);
  req(b.topic?.title && b.topic?.type && b.topic?.first_seen, 'topic needs title, type, first_seen');
  req(b.hook?.spoken && b.hook?.on_screen && b.hook?.pattern, 'hook needs spoken, on_screen, pattern');
  req(Array.isArray(b.beats) && b.beats.length > 0, 'beats must be a non-empty list');
  b.research ??= [];
  b.disclosures ??= [];
  b.human_edited ??= false;
  const ids = new Set<string>();
  for (const [i, beat] of b.beats.entries()) {
    req(beat.id && !ids.has(beat.id), `beat ${i}: missing or duplicate id`);
    ids.add(beat.id);
    req(typeof beat.line === 'string' && beat.line.trim(), `beat ${beat.id}: empty line`);
    req(typeof beat.pose === 'string', `beat ${beat.id}: missing pose`);
    beat.tags ??= [];
    for (const t of beat.tags) req((BEAT_TAGS as readonly string[]).includes(t), `beat ${beat.id}: unknown tag "${t}"`);
    if (beat.panel && 'caption' in beat.panel && beat.panel.caption) req(beat.panel.caption.length <= MAX_PHOTO_CAPTION, `beat ${beat.id}: photo caption is over ${MAX_PHOTO_CAPTION} characters`);
    if (beat.verdict) req((VERDICTS as readonly string[]).includes(beat.verdict.label), `beat ${beat.id}: verdict must be one of ${VERDICTS.join(', ')}`);
  }
  if (b.format === 'fact_check') req(b.claim?.quote && b.claim.source?.url, 'fact_check needs claim.quote and claim.source.url');
  return b;
}

export const loadBeatSheet = (path: string) => parseBeatSheet(readFileSync(path, 'utf8'));

/** The full spoken script, in order: hook first, then every beat line. */
export function spokenScript(b: BeatSheet): string[] {
  return [b.hook.spoken, ...b.beats.map((x) => x.line)];
}
