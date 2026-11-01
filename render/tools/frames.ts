/**
 * `npm run frames -- scripts/videos/<id>.yaml [--draft]`: the look of a video in seconds, before
 * a full render. Voices the script, prints every lint issue with real timings, and writes the
 * intro, the hook, each photo, each verdict and the end card to out/<id>/frames/sheet.png.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { svgToPng } from '../draw/svg';
import { loadBeatSheet } from '../../scripts/beatsheet';
import { frameSvg, planVideo } from '../video';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: npm run frames -- scripts/videos/<id>.yaml [--draft]');
  process.exit(2);
}
const plan = await planVideo(loadBeatSheet(file), { draft: args.includes('--draft') });
const fps = 30;
const dir = fileURLToPath(new URL(`../../out/${plan.sheet.id}/frames/`, import.meta.url));
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const times = [
  ...(plan.introSec > 0 ? [plan.introSec / 2] : []),
  plan.introSec + 0.8,
  ...plan.shots.slice(1).map((s) => s.start + 1),
  ...plan.verdicts.map((v) => v.start + 0.3),
  plan.totalFrames / fps - 0.5,
].sort((a, b) => a - b);
times.forEach((t, i) => writeFileSync(`${dir}${String(i).padStart(2, '0')}.png`, svgToPng(frameSvg(plan, Math.round(t * fps)))));

const sheet = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', `${dir}%02d.png`, '-vf', 'scale=216:-1,tile=8x3:color=white', '-frames:v', '1', '-fps_mode', 'passthrough', `${dir}sheet.png`], { stdio: 'inherit' });

const rehook = plan.sheet.beats.findIndex((b) => b.tags.includes('rehook'));
console.log(`voice: ${plan.voice.provider}  length: ${(plan.totalFrames / fps).toFixed(1)} s  rehook at: ${rehook >= 0 ? plan.segs[rehook + 1]!.start.toFixed(1) : 'none'} s`);
for (const s of plan.shots) console.log(`  ${s.start.toFixed(1).padStart(5)} s  ${s.image ? 'photo' : 'NO PHOTO'}  ${s.caption ?? '(no caption)'}`);
for (const i of plan.lint.issues) console.log(`  ${i.level === 'error' ? '✗' : '!'} [${i.rule}]${i.beat ? ` ${i.beat}:` : ''} ${i.message}`);
console.log(sheet.status === 0 ? `✓ out/${plan.sheet.id}/frames/sheet.png  (look at it: can you name each photo's subject in one second?)` : '✗ contact sheet failed; the single frames are in the same folder');

const missing = plan.shots.filter((s) => !s.image).length;
if (plan.lint.issues.some((i) => i.level === 'error') || missing) {
  if (missing) console.error(`${missing} photo slot(s) have no image: npm run stock -- "<query>" --n 1`);
  process.exit(1);
}
