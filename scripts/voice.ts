/** Channel voice: rules, robotic-phrase detection, and examples for prompts (channels/<id>/voice.yaml). */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { parseBeatSheet, type BeatSheet } from './beatsheet';

export type VoiceConfig = {
  persona: string;
  rules: string[];
  robotic_patterns: string[];
  dateline_regex: string;
  format_notes: Record<string, string>;
  topic_notes: Record<string, string>;
  examples: { before: string; after: string }[];
};

export function loadVoice(channel: string): VoiceConfig {
  return parse(readFileSync(fileURLToPath(new URL(`../channels/${channel}/voice.yaml`, import.meta.url)), 'utf8')) as VoiceConfig;
}

/** Robotic / newsreader phrasing in a line (empty = sounds human enough). */
export function roboticHits(line: string, v: VoiceConfig): string[] {
  const l = line.toLowerCase();
  const hits = v.robotic_patterns.filter((p) => new RegExp(`(^|\\W)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(l));
  if (new RegExp(v.dateline_regex, 'i').test(line.trim())) hits.push('starts like a news dateline');
  return hits;
}

/**
 * Example scripts in the channel's voice: approved (human_edited) sheets, preferring the same
 * format and topic type, most recent first. These keep the writer sounding like the channel.
 */
export function approvedExamples(format: string, topicType: string, max = 2, dir = fileURLToPath(new URL('./videos/', import.meta.url))): BeatSheet[] {
  const sheets = readdirSync(dir).filter((f) => f.endsWith('.yaml')).flatMap((f) => {
    try { return [parseBeatSheet(readFileSync(dir + f, 'utf8'))]; } catch { return []; }
  }).filter((s) => s.human_edited);
  const score = (s: BeatSheet) => (s.format === format ? 2 : 0) + (s.topic.type === topicType ? 1 : 0);
  return sheets.sort((a, b) => score(b) - score(a) || b.id.localeCompare(a.id)).slice(0, max);
}

export function exampleScriptText(s: BeatSheet): string {
  return [`(${s.format}, ${s.topic.type}) ${s.topic.title}`, `HOOK: ${s.hook.spoken}`, ...s.beats.map((b) => `- ${b.line}`)].join('\n');
}
