/**
 * `npm run preview`: renders out/preview.mp4, an 8 s motion test of the character
 * (line boil, blinks, breathing, eased pose changes with overshoot, tie flap,
 * talking mouth, prop pop-ins). NOT the real layout: the split-screen renderer is Milestone 1 step 4.
 * The mouth is driven by fake "audio" until the voice step provides real levels.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pen } from '../draw/pen';
import { itemsToSvg, svgToPng, toSvg } from '../draw/svg';
import { drawCharacter } from '../character/draw';
import { backOut, boilFrame, stateAt, type Timeline } from '../character/animate';
import { drawProp } from '../props/place';
import { createRng } from '../rng';
import { HU, tokens } from '../tokens';
import { stickman, type PoseName } from '../../assets/characters/stickman/character';
import { PROPS } from '../../assets/props/index';

const { width: W, height: H, fps } = tokens.canvas;
const SEED = 'preview-001';
const seconds = 8;

type Beat = { at: number; pose: PoseName; prop: string; keyword: string; color: 'highlight' | 'money' | 'loss' };
const beats: Beat[] = [
  { at: 0.0, pose: 'present', prop: 'bill', keyword: 'YOUR BANK', color: 'highlight' },
  { at: 1.4, pose: 'shocked', prop: 'arrow_down', keyword: '0.01%', color: 'loss' },
  { at: 2.8, pose: 'thinking', prop: 'piggy_bank', keyword: 'HYSA?', color: 'highlight' },
  { at: 4.2, pose: 'hold', prop: 'money_bag', keyword: '4%', color: 'money' },
  { at: 5.6, pose: 'point_up', prop: 'house', keyword: 'LOOK UP', color: 'highlight' },
  { at: 6.8, pose: 'celebrate', prop: 'arrow_up', keyword: '+$400', color: 'money' },
];

const talkRng = createRng(SEED + '|talk');
const timeline: Timeline<PoseName> = {
  fps,
  cues: beats.map((b) => ({ frame: Math.round(b.at * fps), pose: b.pose })),
  // Stand-in for audio volume: syllable-ish pulses with short pauses between beats.
  talk: (f) => {
    const t = f / fps;
    if (beats.some((b) => t > b.at - 0.15 && t < b.at + 0.05) && t > 0.2) return 0;
    const syll = Math.max(0, Math.sin(t * 2 * Math.PI * 4.2));
    return Math.min(1, syll * (0.55 + 0.45 * talkRng.noise(t * 3)));
  },
};

const groundY = H - 120;
const charX = W * 0.36;

function frameSvg(f: number): string {
  const pen = new Pen({ seed: SEED, boilFrame: boilFrame(f, fps) });
  const state = stateAt(stickman, timeline, f, SEED);
  const beatIdx = beats.findLastIndex((b) => f >= Math.round(b.at * fps));
  const beat = beats[beatIdx]!;
  const since = f - Math.round(beat.at * fps);

  pen.element('seam', () => pen.line([{ x: 40, y: tokens.layout.topPanelPx }, { x: W - 40, y: tokens.layout.topPanelPx }], { width: 'main' }));
  const anchors = drawCharacter(pen, stickman, state, { x: charX, y: groundY });

  // Prop: pops in with overshoot each beat; held props sit between the hands.
  const prop = PROPS[beat.prop]!;
  const held = prop.carry === 'hands' && beat.pose === 'hold';
  const at = held
    ? { x: anchors.hold.x, y: anchors.hold.y + (prop.heightHU * HU) / 2 }
    : { x: W * 0.74, y: groundY };
  const propPen = new Pen({ seed: SEED, boilFrame: boilFrame(f, fps) });
  drawProp(propPen, prop, at);
  const s = Math.max(0.001, backOut(since / tokens.motion.pop.durationFrames, tokens.motion.pop.overshoot));
  const cx = at.x, cy = at.y - (prop.heightHU * HU) / 2;
  const propSvg = `<g transform="translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})">${itemsToSvg(propPen.items)}</g>`;

  // Keyword (stand-in for the caption band) pops too.
  const kwPen = new Pen({ seed: SEED + beatIdx });
  kwPen.label(beat.keyword, W / 2, 620, { size: 'large', color: beat.color, outline: 'ink' });
  const k = Math.max(0.001, backOut(since / tokens.motion.pop.durationFrames, tokens.motion.pop.overshoot)) * 2.4;
  const kwSvg = `<g transform="translate(${W / 2} 620) scale(${k}) translate(${-W / 2} -620)">${itemsToSvg(kwPen.items)}</g>`;

  return toSvg(itemsToSvg(pen.items) + propSvg + kwSvg, { width: W, height: H });
}

const out = fileURLToPath(new URL('../../out/', import.meta.url));
mkdirSync(out, { recursive: true });
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out + 'preview.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = seconds * fps;
for (let f = 0; f < total; f++) {
  const ok = ff.stdin.write(svgToPng(frameSvg(f)));
  if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise<void>((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
console.log(`wrote out/preview.mp4 (${seconds}s, ${W}x${H}, ${fps} fps)`);
