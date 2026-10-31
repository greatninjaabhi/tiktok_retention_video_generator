/** npm run preflight -- scripts/videos/<id>.yaml */
import { loadBeatSheet } from '../scripts/beatsheet';
import { MANUAL_STEPS, preflight } from './preflight';

const file = process.argv[2];
if (!file) { console.error('usage: npm run preflight -- scripts/videos/<id>.yaml'); process.exit(2); }
const checks = preflight(loadBeatSheet(file));
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}${c.detail ? `  (${c.detail})` : ''}`);
console.log('\nBefore you post (manual):');
for (const s of MANUAL_STEPS) console.log(`  ☐ ${s}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `\n✗ ${failed} check(s) failed: not ready to post.` : '\n✓ ready to post.');
process.exit(failed ? 1 : 0);
