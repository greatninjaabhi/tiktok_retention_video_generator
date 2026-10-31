/**
 * `npm run preview`: renders out/preview.mp4, a ~20 s format test of a political explainer:
 * stock-photo top panel (or a marked placeholder) with transitions, drawn meme cutaways,
 * phrase-group captions at 180 WPM, and a big stickman who moves around the stage, tilts,
 * talks in sync with the words, and reacts.
 *
 * Stand-ins until later steps: word timings are ESTIMATED (voice step gives real ones), there's
 * no audio yet, and the beat list below is hand-written (beat-sheet step replaces it).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pen } from '../draw/pen';
import { itemsToSvg, svgToPng, toSvg } from '../draw/svg';
import { drawCharacter } from '../character/draw';
import { backOut, boilFrame, stateAt, type Timeline } from '../character/animate';
import { applyBlocking, blockingAt } from '../character/blocking';
import { autoBlock, propXFor } from '../character/director';
import { drawProp } from '../props/place';
import { HU, tokens } from '../tokens';
import { estimateTimings } from '../captions/timing';
import { chunkWords } from '../captions/chunk';
import { captionSvg } from '../captions/render';
import { PANEL, stockPanelSvg, type PanelShot } from '../stock/panel';
import { readManifest } from '../stock/manifest';
import { dataUri } from '../stock/fetch';
import { loadChannel } from '../channel';
import { stickman, type PoseName } from '../../assets/characters/stickman/character';
import { PROPS } from '../../assets/props/index';
import { MEMES } from '../../assets/memes/index';

const { width: W, height: H, fps } = tokens.canvas;
const SEED = 'preview-filibuster';
const channel = loadChannel('politics');
const root = fileURLToPath(new URL('../../', import.meta.url));

// Sample script. Facts: Senate cloture on most bills needs 3/5 of senators (60); the filibuster
// comes from Senate rules, not the Constitution; the Senate lowered the threshold for
// nominations to a simple majority in 2013 (most nominations) and 2017 (Supreme Court).
const SCRIPT =
  "Why can't Congress pass anything? Meet the filibuster. Most bills need 60 votes in the Senate just to end debate. " +
  "It's not in the Constitution. It's a Senate rule, and rules can change. " +
  "In 2013 and 2017, the Senate already dropped it for nominations. So, honestly? Keeping it is a choice.";

type Beat = { word: number; pose: PoseName; prop?: string; stock?: string; meme?: { name: string; text?: Record<string, string> } };
const beats: Beat[] = [
  { word: 0, pose: 'shrug', prop: 'capitol', stock: 'us capitol building' },      // Why can't Congress…
  { word: 5, pose: 'present', prop: 'megaphone', stock: 'senate chamber' },        // Meet the filibuster.
  { word: 8, pose: 'point_up', prop: 'ballot_box', stock: 'vote count tally' },    // Most bills need 60 votes…
  { word: 20, pose: 'shocked', meme: { name: 'expectation_reality', text: { left: 'CONSTITUTION', right: 'SENATE RULE' } } }, // It's not in the Constitution.
  { word: 25, pose: 'present', prop: 'gavel', stock: 'gavel law' },                // It's a Senate rule, and rules can change.
  { word: 33, pose: 'thinking', stock: 'senate floor debate', meme: { name: 'nobody_me', text: { who: 'THE SENATE IN 2013' } } }, // In 2013 and 2017…
  { word: 44, pose: 'shrug' },                                                      // So, honestly?
  { word: 46, pose: 'idle', meme: { name: 'zoom_stare' } },                         // Keeping it is a choice.
];

const words = estimateTimings(SCRIPT, 180);
const chunks = chunkWords(words);
const beatSec = beats.map((b) => words[b.word]!.start);
const total = Math.ceil((words[words.length - 1]!.end + 1.0) * fps);

const poseTimeline: Timeline<PoseName> = {
  fps,
  cues: beats.map((b, i) => ({ frame: Math.round(beatSec[i]! * fps), pose: b.pose })),
  // Mouth follows the word timings: open on syllables inside a word, closed between words.
  talk: (f) => {
    const t = f / fps;
    const w = words.find((x) => t >= x.start && t < x.end);
    if (!w) return 0;
    const syll = Math.max(1, Math.round(w.text.replace(/[^aeiouy]/gi, '').length * 0.8));
    return 0.3 + 0.7 * Math.abs(Math.sin((Math.PI * syll * (t - w.start)) / (w.end - w.start)));
  },
};
const stage = autoBlock(poseTimeline.cues, SEED);

// Stock shots: use a cached licensed image whose query matches, else a marked placeholder.
const manifest = readManifest();
const findImage = (q: string) => {
  const hit = Object.values(manifest.images).find((e) => e.query === q && existsSync(root + e.file));
  return hit ? { id: hit.id, dataUri: dataUri(root + hit.file) } : null;
};
const shots: PanelShot[] = beats.flatMap((b, i) => (b.stock ? [{ start: beatSec[i]!, query: b.stock, image: findImage(b.stock) }] : []));

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function frameSvg(f: number): string {
  const t = f / fps;
  const bf = boilFrame(f, fps);
  const bi = beats.findLastIndex((_, i) => beatSec[i]! <= t);
  const beat = beats[Math.max(0, bi)]!;
  const since = t - beatSec[Math.max(0, bi)]!;
  const meme = beat.meme ? MEMES[beat.meme.name] : undefined;
  const memeActive = meme && since < meme.durationSec ? meme : undefined;

  // ---- top panel: stock shot, or a panel meme cutaway
  let panel: string;
  if (memeActive?.kind === 'panel') {
    const pen = new Pen({ seed: SEED + '|meme' + bi, boilFrame: bf });
    memeActive.draw(pen, { box: PANEL, progress: since / memeActive.durationSec, text: beat.meme!.text ?? {} });
    const frame = new Pen({ seed: SEED + '|frame', boilFrame: bf });
    frame.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, { width: 'bold' });
    panel = `<defs><clipPath id="memeClip"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}"/></clipPath></defs>` +
      `<g clip-path="url(#memeClip)">${itemsToSvg(pen.items)}</g>${itemsToSvg(frame.items)}`;
  } else {
    panel = stockPanelSvg(shots, t, fps, SEED, bf);
  }

  // ---- stage: character with blocking, props, camera memes
  const pen = new Pen({ seed: SEED, boilFrame: bf });
  const block = blockingAt(stage, f, fps);
  const state = stateAt(stickman, poseTimeline, f, SEED);
  state.pose = applyBlocking(state.pose, block);
  if (memeActive?.kind === 'camera') {
    state.expression = memeActive.camera.expression;
    state.mouth = memeActive.camera.mouth;
  }
  const anchors = drawCharacter(pen, stickman, state, { x: block.x, y: tokens.layout.groundY, rotDeg: block.rotDeg });

  let propSvg = '';
  if (beat.prop && !(memeActive?.kind === 'camera')) {
    const prop = PROPS[beat.prop]!;
    const cue = stage[Math.max(0, bi)]!;
    const at = prop.carry === 'hands' && beat.pose === 'hold'
      ? { x: anchors.hold.x, y: anchors.hold.y + (prop.heightHU * HU) / 2 }
      : { x: propXFor(cue.x), y: tokens.layout.groundY };
    const pp = new Pen({ seed: SEED, boilFrame: bf });
    drawProp(pp, prop, at);
    const s = Math.max(0.001, backOut((since * fps) / tokens.motion.pop.durationFrames, tokens.motion.pop.overshoot));
    const cx = at.x, cy = at.y - (prop.heightHU * HU) / 2;
    propSvg = `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(3)}) translate(${-cx} ${-cy})">${itemsToSvg(pp.items)}</g>`;
  }

  let stageSvg = itemsToSvg(pen.items) + propSvg;
  if (memeActive?.kind === 'camera') {
    const z = 1 + (memeActive.camera.zoomTo - 1) * easeInOut(Math.min(1, since / (memeActive.durationSec * 0.7)));
    const fx = anchors.headTop.x, fy = anchors.headTop.y + 0.5 * HU;
    // Zoom toward the face, keeping it where it is on screen (clipped to the stage area).
    stageSvg = `<defs><clipPath id="stageClip"><rect x="0" y="${tokens.layout.topPanelPx}" width="${W}" height="${H - tokens.layout.topPanelPx}"/></clipPath></defs>` +
      `<g clip-path="url(#stageClip)"><g transform="translate(${fx} ${fy}) scale(${z.toFixed(3)}) translate(${-fx} ${-fy})">${stageSvg}</g></g>`;
  }

  const captions = captionSvg(chunks, t, fps, channel.caption_words);
  return toSvg(panel + stageSvg + captions, { width: W, height: H });
}

mkdirSync(root + 'out', { recursive: true });
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', root + 'out/preview.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let f = 0; f < total; f++) {
  if (!ff.stdin.write(svgToPng(frameSvg(f)))) await new Promise((r) => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise<void>((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
const placeholders = shots.filter((s) => !s.image).length;
console.log(`wrote out/preview.mp4 (${(total / fps).toFixed(1)} s, ${W}x${H}); ${shots.length - placeholders}/${shots.length} stock shots had a cached licensed image`);
