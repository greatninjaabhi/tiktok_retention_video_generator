/** `npm run lint:script -- scripts/videos/<id>.yaml [--draft]` */
import { loadBeatSheet } from './beatsheet';
import { lintScript } from './lint';
import { loadChannel } from '../render/channel';

const args = process.argv.slice(2);
const draft = args.includes('--draft');
const files = args.filter((a) => !a.startsWith('--'));
let failed = false;
for (const f of files) {
  const b = loadBeatSheet(f);
  const r = lintScript(b, loadChannel(b.channel), { draft });
  console.log(`\n${f}  (${b.format}, est. ${r.durationSec.toFixed(1)} s, ${b.beats.length} beats)`);
  for (const s of r.segments) console.log(`  ${s.id.padEnd(6)} ${s.start.toFixed(1).padStart(5)}–${s.end.toFixed(1).padStart(5)} s  ${s.words} words`);
  for (const i of r.issues) console.log(`  ${i.level === 'error' ? '✗' : '!'} [${i.rule}]${i.beat ? ` ${i.beat}:` : ''} ${i.message}`);
  const errors = r.issues.filter((i) => i.level === 'error').length;
  console.log(errors ? `  ${errors} error(s): cannot render` : '  ✓ ready to render');
  failed ||= errors > 0;
}
process.exit(failed ? 1 : 0);
