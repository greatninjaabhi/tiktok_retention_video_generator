/**
 * `npm run radar [-- --from <dir>]`: daily shortlist of current political stories.
 * Live mode fetches every feed in channels/politics/sources.yaml. `--from <dir>` reads saved
 * feed files instead (<outlet-slug>.xml, e.g. "fox-news.xml"), for offline runs and testing.
 * Writes out/radar/<date>.md and .json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchFeed, loadRadarConfig, parseFeed, type Item } from './feeds';
import { cluster, reportMarkdown, scoreStories } from './score';
import { loadChannel } from '../../render/channel';

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const fromDir = fromIdx >= 0 ? args[fromIdx + 1] : undefined;
const cfg = loadRadarConfig('politics');
const channel = loadChannel('politics');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const items: Item[] = [];
const failures: string[] = [];
await Promise.all(cfg.feeds.map(async (src) => {
  try {
    if (fromDir) {
      const f = `${fromDir}/${slug(src.outlet)}.xml`;
      if (!existsSync(f)) return;
      items.push(...parseFeed(readFileSync(f, 'utf8'), src));
    } else {
      items.push(...await fetchFeed(src));
    }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    failures.push(`${src.outlet} (${src.url}): ${err.cause?.code ?? err.message}`);
  }
}));

const now = new Date();
const trends = items.filter((i) => i.kind === 'trends');
const stories = scoreStories(cluster(items.filter((i) => i.kind !== 'trends')), trends, cfg, now, channel.max_topic_age_hours);
const date = now.toISOString().slice(0, 10);
const outDir = fileURLToPath(new URL('../../out/radar/', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}${date}.md`, reportMarkdown(stories, date, failures));
writeFileSync(`${outDir}${date}.json`, JSON.stringify({ date, stories, failures }, null, 2));

console.log(`${items.length} headlines from ${cfg.feeds.length - failures.length}/${cfg.feeds.length} feeds → ${stories.length} stories`);
for (const [i, s] of stories.slice(0, 10).entries()) {
  console.log(`${String(i + 1).padStart(2)}. [${s.score.toFixed(2)}] ${s.format === 'fact_check' ? '🔎' : '  '} L${s.coverage.left}/C${s.coverage.center}/R${s.coverage.right}  ${s.headline}`);
}
if (failures.length) console.log(`\n${failures.length} feed(s) failed:\n` + failures.map((f) => `  - ${f}`).join('\n'));
console.log(`\nwrote out/radar/${date}.md`);
