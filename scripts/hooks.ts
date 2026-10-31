/**
 * Hook scoring for drafted candidates (brief §2.1 R1–R4, §0.5). Hard rules reject; soft signals rank.
 * The picker (§8) replaces the soft weights with what actually held viewers once there's data.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { ChannelConfig } from '../render/channel';

export type HookPattern = { id: string; template: string; use_when: string };
export type HookCandidate = { spoken: string; on_screen: string; pattern: string; why?: string };
export type HookScore = { ok: boolean; score: number; reasons: string[] };

export function loadHookPatterns(channel: string): HookPattern[] {
  const path = fileURLToPath(new URL(`../channels/${channel}/hooks.yaml`, import.meta.url));
  return (parse(readFileSync(path, 'utf8')) as { patterns: HookPattern[] }).patterns;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export function scoreHook(h: HookCandidate, ch: ChannelConfig): HookScore {
  const reasons: string[] = [];
  let ok = true, score = 0;
  const sw = words(h.spoken).length, ow = words(h.on_screen).length;
  if (sw < 6 || sw > 12) { ok = false; reasons.push(`spoken ${sw} words (6–12)`); }
  if (ow < 3 || ow > 8) { ok = false; reasons.push(`on-screen ${ow} words (3–8)`); }
  const text = `${h.spoken} ${h.on_screen}`.toLowerCase();
  for (const p of [...ch.banned_hook_patterns, ...ch.banned_phrases]) if (text.includes(p.toLowerCase())) { ok = false; reasons.push(`banned: "${p}"`); }
  if (/\b(follow|subscribe)\b/.test(text)) { ok = false; reasons.push('branding/follow ask in the hook'); }
  // Soft signals: specific beats vague (R4); conflict and direct address hold attention.
  if (/\d|\$|%/.test(h.spoken)) { score += 2; reasons.push('+ specific number'); }
  if (/\b(just|today|this week|right now)\b/i.test(h.spoken)) { score += 1; reasons.push('+ fresh'); }
  if (/\b(you|your)\b/i.test(h.spoken)) { score += 1; reasons.push('+ talks to the viewer'); }
  if (/\?|\bwhy\b|\bhow\b/i.test(h.spoken)) { score += 1; reasons.push('+ open question'); }
  if (/\b(furious|mad|fight|banned|blocked|lied|caught|nobody)\b/i.test(h.spoken)) { score += 1; reasons.push('+ conflict'); }
  if (/\b(insane|crazy|shocking|unbelievable)\b/i.test(h.spoken)) { score -= 2; reasons.push('- empty hype word'); }
  if (sw >= 8 && sw <= 10) score += 1;
  return { ok, score: ok ? score : -99, reasons };
}
