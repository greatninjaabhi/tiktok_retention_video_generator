/** npm run plan -- out/radar/<date>.json [--n 3]: today's videos = radar stories × what's been working. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readStore } from '../analytics/store';
import { loadHookPatterns } from '../scripts/hooks';
import { dailyPlan, posteriors } from './picker';
import type { ScoredStory } from '../research/radar/score';

const args = process.argv.slice(2);
const radar = args.find((a) => a.endsWith('.json'));
if (!radar) { console.error('usage: npm run plan -- out/radar/<date>.json [--n 3]'); process.exit(2); }
const n = Number(args[args.indexOf('--n') + 1]) || 3;
const report = JSON.parse(readFileSync(radar, 'utf8')) as { date: string; stories: ScoredStory[] };
const store = readStore();
const post = posteriors(store);
const plan = dailyPlan(report.stories, loadHookPatterns('politics').map((p) => p.id), post, report.date, n);
const rated = [...post.values()].reduce((a, p) => a + p.n, 0);

const md = [`# Plan: ${report.date}`, '', `Picker: Thompson sampling over format × topic type × hook pattern, from ${rated} rated video(s)${rated < 20 ? ' (still exploring: under ~20 videos)' : ''}.`, '',
  ...plan.map((p, i) => `${i + 1}. **${p.story.headline}**\n   - make it a **${p.arm.format}** with a **${p.arm.hook_pattern}** hook (${p.arm.topic_type}) · ${p.mode}\n   - draft: \`npm run draft -- --radar ${radar} --story ${report.stories.indexOf(p.story as ScoredStory) + 1} --format ${p.arm.format} --notes "use a ${p.arm.hook_pattern} hook"\``)].join('\n') + '\n';
const out = fileURLToPath(new URL(`../out/plan/${report.date}.md`, import.meta.url));
mkdirSync(fileURLToPath(new URL('../out/plan/', import.meta.url)), { recursive: true });
writeFileSync(out, md);
console.log(md);
