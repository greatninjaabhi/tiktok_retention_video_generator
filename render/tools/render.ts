/**
 * `npm run render -- scripts/videos/<id>.yaml [--draft]`
 * Lints the script, voices it (ElevenLabs if configured, else estimated timings + no voice),
 * re-lints with real timings, then writes out/<id>/video.mp4, cover.png, post.txt.
 * --draft renders scripts that aren't human-edited yet, stamped "DRAFT: NOT FOR POSTING".
 */
import { loadBeatSheet } from '../../scripts/beatsheet';
import { planVideo, renderVideo } from '../video';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: npm run render -- scripts/videos/<id>.yaml [--draft]');
  process.exit(2);
}
try {
  const plan = await planVideo(loadBeatSheet(file), { draft: args.includes('--draft') });
  console.log(`voice: ${plan.voice.provider}${plan.voice.provider === 'estimate' ? ' (no narration; set ELEVENLABS_API_KEY + voice_id for real voice)' : ''}`);
  for (const i of plan.lint.issues) console.log(`  ${i.level === 'error' ? '✗' : '!'} [${i.rule}]${i.beat ? ` ${i.beat}:` : ''} ${i.message}`);
  if (plan.lint.issues.some((i) => i.level === 'error')) {
    console.error('Script fails with the real voice timings; fix the beat sheet and re-render.');
    process.exit(1);
  }
  const t0 = Date.now();
  const dir = await renderVideo(plan);
  const rel = dir.slice(dir.indexOf('out/'));
  console.log(`✓ ${rel}video.mp4  (${(plan.totalFrames / 30).toFixed(1)} s, ${plan.sfx.length} SFX, rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`✓ ${rel}cover.png\n✓ ${rel}post.txt`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
