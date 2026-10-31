/** Loads channels/<id>/channel.yaml: everything niche-specific lives there (brief §2.8.6b). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export type ChannelConfig = {
  id: string;
  character: string;
  lens: string;
  voice_id: string | null;
  caption_words: { good: string[]; bad: string[] };
  topic_types: string[];
  max_topic_age_hours: number;
  banned_hook_patterns: string[];
  source_types: string[];
  voting_info_sources: string[];
  forbidden_sponsor_types: string[];
  caveat_rules: string[];
  wpm: number;
  handle: string;
  required_tags: Record<string, string[]>;
  opinion_markers: string[];
  banned_phrases: string[];
};

export function loadChannel(id: string): ChannelConfig {
  const path = fileURLToPath(new URL(`../channels/${id}/channel.yaml`, import.meta.url));
  const c = parse(readFileSync(path, 'utf8')) as ChannelConfig;
  if (!c?.caption_words?.good || !c.caption_words.bad) throw new Error(`${id}/channel.yaml: caption_words.good/bad required`);
  return c;
}
