/**
 * Script linter (brief §7.2 + §2.8.7 + §0.5). Errors block rendering; warnings are shown.
 * Timings are ESTIMATED from the text until the voice step gives real ones (pass `wordTimings`).
 */
import { estimateTimings } from '../render/captions/timing';
import type { Word } from '../render/captions/types';
import type { ChannelConfig } from '../render/channel';
import { stickman } from '../assets/characters/stickman/character';
import { PROPS } from '../assets/props/index';
import { MEMES } from '../assets/memes/index';
import { spokenScript, type BeatSheet } from './beatsheet';

export type Level = 'error' | 'warn';
export type ScriptIssue = { level: Level; rule: string; message: string; beat?: string };
export type Segment = { id: string; start: number; end: number; words: number };
export type LintResult = { issues: ScriptIssue[]; segments: Segment[]; durationSec: number };

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const lc = (s: string) => s.toLowerCase();
const norm = (s: string) => lc(s).replace(/[“”"‘’'.,!?;:—-]/g, '').replace(/\s+/g, ' ').trim();

/** Per-segment timing (hook = "hook", then each beat) from word timings over the full script. */
export function segmentTimes(b: BeatSheet, timings: Word[]): Segment[] {
  const parts = spokenScript(b);
  const ids = ['hook', ...b.beats.map((x) => x.id)];
  let k = 0;
  return parts.map((p, i) => {
    const n = words(p).length;
    const ws = timings.slice(k, k + n);
    k += n;
    return { id: ids[i]!, start: ws[0]?.start ?? 0, end: ws[ws.length - 1]?.end ?? 0, words: n };
  });
}

export type LintOptions = { wordTimings?: Word[]; now?: Date; draft?: boolean };

export function lintScript(b: BeatSheet, ch: ChannelConfig, opts: LintOptions = {}): LintResult {
  const issues: ScriptIssue[] = [];
  const err = (rule: string, message: string, beat?: string) => issues.push({ level: 'error', rule, message, beat });
  const warn = (rule: string, message: string, beat?: string) => issues.push({ level: 'warn', rule, message, beat });

  const timings = opts.wordTimings ?? estimateTimings(spokenScript(b).join(' '), b.wpm ?? ch.wpm);
  const segs = segmentTimes(b, timings);
  const duration = (timings[timings.length - 1]?.end ?? 0) + 0.4;
  const seg = (id: string) => segs.find((s) => s.id === id)!;

  // ---- hook (R1–R4, R3)
  const hw = words(b.hook.spoken).length;
  if (hw < 6 || hw > 12) err('hook-length', `spoken hook is ${hw} words (6–12)`);
  const ow = words(b.hook.on_screen).length;
  if (ow < 3 || ow > 8) err('hook-onscreen', `on-screen hook is ${ow} words (3–8)`);
  for (const p of ch.banned_hook_patterns) {
    if (lc(b.hook.spoken + ' ' + b.hook.on_screen).includes(lc(p))) err('hook-banned', `hook uses banned pattern "${p}"`);
  }
  const first3 = timings.filter((w) => w.start < 3).map((w) => lc(w.text)).join(' ');
  if (/\b(follow|subscribe|like and|smash)\b/.test(first3) || first3.includes(lc(ch.handle))) err('branding-first-3s', 'no branding or follow asks in the first 3 s (R3)');

  // ---- length & structure (R9, R10, R14)
  if (duration < 61 || duration > 75) err('duration', `estimated ${duration.toFixed(1)} s (61–75 s)`);
  if (b.beats.length < 3) err('beats-min', 'needs at least 3 beats (R10)');
  for (const s of segs) {
    if (s.end - s.start > 4.5) err('visual-cadence', `${(s.end - s.start).toFixed(1)} s without a visual change; split it (R7: ≤ 4 s)`, s.id);
  }

  // ---- re-hook & open loops (R11–R13)
  const rehooks = b.beats.filter((x) => x.tags.includes('rehook'));
  if (!rehooks.some((x) => seg(x.id).start >= 24 && seg(x.id).start <= 31)) {
    err('rehook', `needs a "rehook" beat starting at 25–30 s (±1 s estimate); found at ${rehooks.map((x) => seg(x.id).start.toFixed(1) + ' s').join(', ') || 'none'}`);
  }
  const opened = new Map<string, number>();
  for (const x of b.beats) {
    if (x.closes && !opened.has(x.closes)) err('open-loops', `closes "${x.closes}" before it was opened`, x.id);
    if (x.closes) opened.delete(x.closes);
    if (x.opens) opened.set(x.opens, seg(x.id).start);
  }
  for (const [id] of opened) err('open-loops', `open loop "${id}" is never closed (R13)`);
  const hooksAt = [0, ...b.beats.filter((x) => x.opens || x.tags.includes('rehook') || x.tags.includes('verdict')).map((x) => seg(x.id).start)].sort((a, c) => a - c);
  for (let i = 1; i < hooksAt.length; i++) {
    if (hooksAt[i]! - hooksAt[i - 1]! > 15) warn('open-loops', `${(hooksAt[i]! - hooksAt[i - 1]!).toFixed(0)} s between re-hooks/open loops (aim ≤ 15 s, R12)`);
  }
  if (duration - (hooksAt[hooksAt.length - 1] ?? 0) > 25) warn('open-loops', 'long stretch with no open loop before the end (R12)');

  // ---- required tags per format (§0.5)
  for (const t of ch.required_tags[b.format] ?? []) {
    if (!b.beats.some((x) => x.tags.includes(t as never))) err('required-tags', `${b.format} needs a beat tagged "${t}"`);
  }

  // ---- honesty: sources, opinions, quotes, voting info (§0.5, §2.8.2)
  for (const x of b.beats) {
    const hasSource = (x.claims ?? []).some((c) => c.sources?.some((s) => /^https?:\/\//.test(s.url))) || (x.verdict?.sources ?? []).some((s) => /^https?:\/\//.test(s.url));
    if ((x.tags.includes('fact') || x.tags.includes('verdict')) && !hasSource) err('sources', 'factual beat needs at least one source URL', x.id);
    if (x.tags.includes('opinion') && !ch.opinion_markers.some((m) => lc(x.line).includes(m))) {
      err('opinion-marker', `opinion must read as one (e.g. "${ch.opinion_markers[0]}", "${ch.opinion_markers[1]}")`, x.id);
    }
    for (const q of x.line.matchAll(/[“"]([^”"]{8,})[”"]/g)) {
      const quoted = norm(q[1]!);
      if (b.claim) {
        if (!norm(b.claim.quote).includes(quoted)) err('quotes', `quoted text isn't verbatim from claim.quote: "${q[1]}"`, x.id);
      } else if (!(x.claims ?? []).some((c) => c.sources.some((s) => ['on_record_quote', 'full_video', 'transcript'].includes(s.type)))) {
        err('quotes', 'a quote needs a source of type on_record_quote / full_video / transcript', x.id);
      }
    }
    if (/\b(register(ed)? to vote|polling (place|location)|vote (early|by mail)|mail-in|absentee|voting deadline|where to vote|how to vote)\b/i.test(x.line)) {
      const isGov = (u: string) => { try { return new URL(u).hostname.endsWith('.gov'); } catch { return false; } };
      const ok = (x.claims ?? []).some((c) => c.sources.some((s) => ch.voting_info_sources.some((v) => s.url.startsWith(v)) || isGov(s.url)));
      if (!ok) err('voting-info', 'voting procedure info must cite vote.gov or an official .gov election source', x.id);
    }
    if (/\b(i|we) (made|earned|was there|were there|personally saw|met him|met her)\b/i.test(x.line)) warn('first-person', 'the stickman makes no real personal claims (§2.8.2)', x.id);
  }
  for (const p of ch.banned_phrases) {
    for (const [i, line] of spokenScript(b).entries()) if (lc(line).includes(lc(p))) err('banned-phrase', `"${p}"`, i === 0 ? 'hook' : b.beats[i - 1]!.id);
  }

  // ---- fact-check format (§0.5 format 2)
  if (b.format === 'fact_check') {
    if (!['full_video', 'transcript', 'on_record_quote'].includes(b.claim!.source.type)) err('fact-check', 'claim.source must be the full video, transcript or on-record quote');
    const verdicts = b.beats.filter((x) => x.verdict);
    if (verdicts.length < 2) err('fact-check', 'needs at least 2 checks with a verdict');
    for (const v of verdicts) if (!v.verdict!.sources.length) err('fact-check', 'every verdict needs a primary source', v.id);
    const firstClaim = b.beats.findIndex((x) => x.tags.includes('claim'));
    const firstVerdict = b.beats.findIndex((x) => x.verdict);
    if (firstClaim < 0 || (firstVerdict >= 0 && firstClaim > firstVerdict)) err('fact-check', 'state the claim (tag "claim") before the first verdict');
  }

  // ---- research balance (owner: left AND right sources)
  const leans = new Set(b.research.map((r) => r.lean));
  if (!['left', 'lean_left'].some((l) => leans.has(l as never)) || !['right', 'lean_right'].some((l) => leans.has(l as never))) {
    warn('research-balance', 'research should include at least one left and one right outlet');
  }

  // ---- assets exist
  for (const x of b.beats) {
    if (!(x.pose in stickman.poses)) err('assets', `unknown pose "${x.pose}"`, x.id);
    if (x.expression && !(x.expression in stickman.expressions)) err('assets', `unknown expression "${x.expression}"`, x.id);
    if (x.prop && !PROPS[x.prop]) err('assets', `unknown prop "${x.prop}"`, x.id);
    if (x.panel && 'meme' in x.panel && MEMES[x.panel.meme]?.kind !== 'panel') err('assets', `unknown panel meme "${x.panel.meme}"`, x.id);
    if (x.camera && MEMES[x.camera]?.kind !== 'camera') err('assets', `unknown camera meme "${x.camera}"`, x.id);
  }

  // ---- ending, freshness, publishing gates
  const last = b.beats[b.beats.length - 1]!;
  if (!last.tags.some((t) => t === 'callback' || t === 'cta')) warn('ending', 'end on a callback to the hook or a soft CTA (R15)');
  b.beats.slice(0, -1).forEach((x) => x.tags.includes('cta') && warn('ending', 'CTA belongs in the last beat', x.id));
  const ageH = ((opts.now ?? new Date()).getTime() - new Date(b.topic.first_seen).getTime()) / 3.6e6;
  if (ageH > ch.max_topic_age_hours) warn('freshness', `topic first seen ${ageH.toFixed(0)} h ago (> ${ch.max_topic_age_hours} h); tie it to something current`);
  for (const d of b.disclosures) if (ch.forbidden_sponsor_types.includes(d.type)) err('disclosures', `no paid political content: sponsor type "${d.type}" is forbidden (§5.4b)`);
  if (!b.ai_voice_label) err('ai-label', 'videos with an AI voice must use the AI-generated label (§5.2)');
  if (!b.human_edited) (opts.draft ? warn : err)('human-edit', 'a human must edit the angle, an example and the punchline, then set human_edited: true (§2.8.5)');

  return { issues, segments: segs, durationSec: duration };
}
