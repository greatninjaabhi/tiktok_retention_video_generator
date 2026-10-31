/**
 * npm run analytics -- register scripts/videos/<id>.yaml --tiktok-id <id> [--posted-at ISO]
 * npm run analytics -- pull                    # Display API snapshot (TIKTOK_ACCESS_TOKEN)
 * npm run analytics -- import [file.csv]       # TikTok Studio export(s); default: inbox/tiktok_exports/*.csv
 * npm run analytics -- report
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readStore, writeStore } from './store';
import { fetchAllVideos, importStudioCsv, recordSnapshots } from './tiktok';
import { derive, reward } from './metrics';
import { loadBeatSheet } from '../scripts/beatsheet';
import { lintScript } from '../scripts/lint';
import { loadChannel } from '../render/channel';

const [cmd, ...rest] = process.argv.slice(2);
const get = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
const store = readStore();

if (cmd === 'register') {
  const sheet = loadBeatSheet(rest[0]!);
  const tiktokId = get('--tiktok-id');
  if (!tiktokId) throw new Error('--tiktok-id required (the number in the video URL)');
  const dur = lintScript(sheet, loadChannel(sheet.channel), { draft: true }).durationSec;
  store.videos[sheet.id] = {
    id: sheet.id, tiktokId, postedAt: get('--posted-at') ?? new Date().toISOString(), durationSec: Math.round(dur * 10) / 10,
    arm: { format: sheet.format, topic_type: sheet.topic.type, hook_pattern: sheet.hook.pattern },
    snapshots: store.videos[sheet.id]?.snapshots ?? [],
  };
  writeStore(store);
  console.log(`✓ registered ${sheet.id} ↔ TikTok ${tiktokId}`);
} else if (cmd === 'pull') {
  const n = recordSnapshots(store, await fetchAllVideos());
  writeStore(store);
  console.log(`✓ ${n} snapshot(s) recorded`);
} else if (cmd === 'import') {
  const dir = fileURLToPath(new URL('../inbox/tiktok_exports/', import.meta.url));
  const files = rest[0] ? [rest[0]] : readdirSync(dir).filter((f) => f.endsWith('.csv')).map((f) => dir + f);
  for (const f of files) {
    const r = importStudioCsv(store, readFileSync(f, 'utf8'));
    console.log(`${f}: ${r.matched} matched, ${r.unmatched.length} unmatched`);
    console.log('  columns:', Object.entries(r.columns).map(([k, v]) => `${k}=${v ?? '∅'}`).join(', '));
  }
  writeStore(store);
} else if (cmd === 'report') {
  const all = Object.values(store.videos).sort((a, b) => ((a.postedAt ?? '') < (b.postedAt ?? '') ? 1 : -1));
  console.log('video'.padEnd(36), 'views'.padStart(8), '48h'.padStart(8), '%viewed'.padStart(8), 'full'.padStart(6), 'sh/1k'.padStart(6), 'reward');
  for (const v of all) {
    const d = derive(v), r = reward(v, all);
    const pct = (x?: number) => (x === undefined ? '–' : (x * 100).toFixed(0) + '%');
    console.log(v.id.slice(0, 36).padEnd(36), String(d.latestViews).padStart(8), String(Math.round(d.views48h ?? 0) || '–').padStart(8), pct(d.avgPctViewed).padStart(8), pct(d.fullWatchRate).padStart(6), (d.sharesPer1k?.toFixed(1) ?? '–').padStart(6), r ? `${r.value.toFixed(2)}${r.provisional ? ' (provisional)' : ''}` : '–');
  }
} else {
  console.error('usage: npm run analytics -- register|pull|import|report');
  process.exit(2);
}
