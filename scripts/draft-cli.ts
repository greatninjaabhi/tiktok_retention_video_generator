/**
 * Draft a beat sheet with Claude.
 *   npm run draft -- --radar out/radar/<date>.json --story 1 [--format fact_check] [--notes "..."]
 *   npm run draft -- --headline "..." --source "Outlet|lean|url|title" [--source ...]
 * Step 1 writes a per-video writer brief to scripts/prompts/<date>-<slug>.md; step 2 writes the script from it.
 *   --brief-only        stop after the brief (edit it, then rerun with --brief <file>)
 *   --brief <file>      skip step 1 and draft from an existing (edited) brief
 *   --topic-type <t>    override the topic type (default: radar's guess, else policy_fight)
 * Needs Anthropic credentials (ANTHROPIC_API_KEY or `ant auth login`).
 * Writes scripts/videos/<id>.yaml as a DRAFT (human_edited: false) with ranked hooks + editor notes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { stringify } from 'yaml';
import { loadChannel } from '../render/channel';
import { draftScript, type DraftInput } from './draft';
import { generateBrief } from './brief';
import { loadVoice } from './voice';
import { loadHookPatterns, scoreHook } from './hooks';
import { fetchArticleText } from './article';
import type { ScoredStory } from '../research/radar/score';

const args = process.argv.slice(2);
const get = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const all = (k: string) => args.flatMap((a, i) => (a === k && args[i + 1] ? [args[i + 1]!] : []));

const channel = loadChannel('politics');
const patterns = loadHookPatterns('politics');
const voice = loadVoice('politics');
let topicType = get('--topic-type') ?? 'policy_fight';
const today = new Date().toISOString().slice(0, 10);

let input: DraftInput;
if (get('--radar')) {
  const report = JSON.parse(readFileSync(get('--radar')!, 'utf8')) as { stories: ScoredStory[] };
  const story = report.stories[Number(get('--story') ?? '1') - 1];
  if (!story) throw new Error('no such story in the radar report');
  input = {
    headline: story.headline, date: today,
    firstSeen: new Date(Date.now() - story.ageHours * 3.6e6).toISOString(),
    sources: story.links.map((l) => ({ url: l.link, outlet: l.outlet, lean: l.lean, title: l.title })),
    formatHint: (get('--format') as DraftInput['formatHint']) ?? story.format,
    notes: get('--notes'),
  };
  topicType = get('--topic-type') ?? story.topicType;
} else if (get('--headline')) {
  input = {
    headline: get('--headline')!, date: today, firstSeen: new Date().toISOString(),
    sources: all('--source').map((s) => { const [outlet, lean, url, title] = s.split('|'); return { outlet: outlet!, lean: lean!, url: url!, title: title ?? outlet! }; }),
    formatHint: get('--format') as DraftInput['formatHint'], notes: get('--notes'),
  };
} else {
  console.error('usage: npm run draft -- --radar out/radar/<date>.json --story 1  |  --headline "..." --source "Outlet|lean|url|title"');
  process.exit(2);
}

if (!args.includes('--no-fetch')) {
  await Promise.all(input.sources.map(async (s) => { s.text = await fetchArticleText(s.url); }));
  console.log(`article text: ${input.sources.filter((s) => s.text).length}/${input.sources.length} sources readable`);
}

const slug = input.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const format = input.formatHint ?? 'explainer';

try {
  // Step 1: this video's writer brief (the per-video prompt), unless the owner passed an edited one.
  let briefPath = get('--brief');
  if (briefPath) {
    input.brief = readFileSync(briefPath, 'utf8');
  } else {
    const { markdown } = await generateBrief(input, channel, voice, format, topicType);
    const dir = fileURLToPath(new URL('./prompts/', import.meta.url));
    mkdirSync(dir, { recursive: true });
    briefPath = `scripts/prompts/${input.date}-${slug}.md`;
    writeFileSync(fileURLToPath(new URL(`../${briefPath}`, import.meta.url)), markdown);
    input.brief = markdown;
    console.log(`✓ writer brief: ${briefPath}`);
    if (args.includes('--brief-only')) {
      console.log(`edit it, then: npm run draft -- <same args> --brief ${briefPath}`);
      process.exit(0);
    }
  }
  // Step 2: the script, written from the brief.
  const r = await draftScript(input, channel, patterns, voice);
  const ranked = r.draft.hooks.map((h, i) => ({ i, h, s: scoreHook(h, channel) })).sort((a, b) => b.s.score - a.s.score);
  const header = [
    `# DRAFT by ${'claude-opus-5-5'} on ${today}. A human must verify every source, pick the hook, and`,
    `# rewrite the angle, one example and the punchline, then set human_edited: true (brief §2.8.5).`,
    `# Writer brief (this video's prompt): ${briefPath}`,
    '#',
    '# Hook candidates (ranked by the hook scorer; swap into `hook:` to use another):',
    ...ranked.map(({ i, h, s }) => `#  ${s.ok ? `[${s.score}]` : '[✗]'} #${i} ${h.pattern}: "${h.spoken}" / "${h.on_screen}"${i === r.draft.chosen_hook ? '  ← chosen' : ''}`),
    '#',
    '# Editor notes:',
    ...r.draft.editor_notes.map((n) => `#  - ${n}`),
    '#',
    '# Lint:',
    ...(r.issues.length ? r.issues.map((x) => `#  ${x.level === 'error' ? '✗' : '!'} [${x.rule}]${x.beat ? ` ${x.beat}:` : ''} ${x.message}`) : ['#  clean']),
    '',
  ].join('\n');
  const path = fileURLToPath(new URL(`./videos/${r.sheet.id}.yaml`, import.meta.url));
  if (existsSync(path) && !args.includes('--overwrite')) throw new Error(`${path} exists (use --overwrite)`);
  writeFileSync(path, header + stringify(r.sheet, { lineWidth: 0 }));
  const cost = (r.usage.input * 4 + r.usage.cachedRead * 0.2 + r.usage.output * 20) / 1e6;
  console.log(`✓ scripts/videos/${r.sheet.id}.yaml (${r.rounds} round(s), ~$${cost.toFixed(2)})`);
  console.log(`  ${r.issues.filter((x) => x.level === 'error').length} lint error(s), ${r.issues.filter((x) => x.level === 'warn').length} warning(s); editor notes: ${r.draft.editor_notes.length}`);
  console.log(`next: edit it, then npm run lint:script -- scripts/videos/${r.sheet.id}.yaml`);
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError) console.error('No valid Anthropic credentials: set ANTHROPIC_API_KEY or run `ant auth login`.');
  else if (e instanceof Anthropic.RateLimitError) console.error('Rate limited by the Anthropic API; try again shortly.');
  else if (e instanceof Anthropic.APIConnectionError) console.error('Could not reach the Anthropic API (network?).');
  else if (e instanceof Anthropic.APIError) console.error(`Anthropic API error ${e.status}: ${e.message}`);
  else console.error((e as Error).message);
  process.exit(1);
}
