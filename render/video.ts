/**
 * Beat sheet → finished post: out/<id>/video.mp4 (+ voice + SFX), cover.png, post.txt.
 * Everything is a pure function of (beat sheet, voice timings, seed) so renders are repeatable.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pen } from './draw/pen';
import { itemsToSvg, svgToPng, toSvg } from './draw/svg';
import { colorHex, HU, tokens, type ColorName } from './tokens';
import { drawCharacter } from './character/draw';
import { backOut, boilFrame, stateAt, type Timeline } from './character/animate';
import { applyBlocking, blockingAt, type StageCue } from './character/blocking';
import { autoBlock, propXFor } from './character/director';
import { drawProp } from './props/place';
import { chunkWords } from './captions/chunk';
import { captionSvg } from './captions/render';
import { measureText } from './captions/measure';
import type { CaptionChunk, Word } from './captions/types';
import { PANEL, stockPanelSvg, transitionsFor, type PanelShot } from './stock/panel';
import { readManifest } from './stock/manifest';
import { dataUri } from './stock/fetch';
import { loadChannel, type ChannelConfig } from './channel';
import { mixBed, scheduleSfx, toWav, type SfxEvent } from './audio/sfx';
import { stickman, type PoseName } from '../assets/characters/stickman/character';
import { PROPS } from '../assets/props/index';
import { MEMES } from '../assets/memes/index';
import { spokenScript, type BeatSheet, type Verdict } from '../scripts/beatsheet';
import { lintScript, segmentTimes, type LintResult, type Segment } from '../scripts/lint';
import { pickVoice } from '../voice/providers';
import type { VoiceResult } from '../voice/types';

const { width: W, height: H, fps } = tokens.canvas;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

type Window = { start: number; end: number };
export type Plan = {
  sheet: BeatSheet;
  channel: ChannelConfig;
  voice: VoiceResult;
  lint: LintResult;
  words: Word[];
  segs: Segment[];
  beatStart: number[];
  totalFrames: number;
  poses: Timeline<PoseName>;
  stage: StageCue[];
  shots: PanelShot[];
  panelMemes: (Window & { name: string; text: Record<string, string> })[];
  cameraMemes: (Window & { name: string })[];
  verdicts: (Window & { label: Verdict })[];
  chunks: CaptionChunk[];
  sfx: SfxEvent[];
  draft: boolean;
};

export async function planVideo(sheet: BeatSheet, opts: { draft?: boolean } = {}): Promise<Plan> {
  const channel = loadChannel(sheet.channel);
  const pre = lintScript(sheet, channel, { draft: opts.draft });
  const preErrors = pre.issues.filter((i) => i.level === 'error');
  if (preErrors.length) throw new Error(`script has ${preErrors.length} error(s):\n` + preErrors.map((i) => `  [${i.rule}] ${i.beat ?? ''} ${i.message}`).join('\n'));

  const voice = await pickVoice(channel.voice_id, sheet.wpm ?? channel.wpm).synthesize(spokenScript(sheet).join(' '));
  const words = voice.words;
  // Re-lint with the real timings: duration and the 25–30 s re-hook depend on the actual voice.
  const lint = lintScript(sheet, channel, { draft: opts.draft, wordTimings: words });
  const segs = segmentTimes(sheet, words);
  const beatStart = sheet.beats.map((_, i) => (i === 0 ? 0 : segs[i + 1]!.start));
  const totalFrames = Math.ceil((voice.durationSec + 0.6) * fps);

  const poses: Timeline<PoseName> = {
    fps,
    cues: sheet.beats.map((b, i) => ({ frame: Math.round(beatStart[i]! * fps), pose: b.pose as PoseName, expression: b.expression as never })),
    talk: (f) => {
      const t = f / fps;
      const w = words.find((x) => t >= x.start && t < x.end);
      if (!w) return 0;
      const syll = Math.max(1, Math.round(w.text.replace(/[^aeiouy]/gi, '').length * 0.8));
      return 0.3 + 0.7 * Math.abs(Math.sin((Math.PI * syll * (t - w.start)) / Math.max(0.05, w.end - w.start)));
    },
  };
  const stage = autoBlock(poses.cues, sheet.id);

  const manifest = readManifest();
  const findImage = (q: string) => {
    const hit = Object.values(manifest.images).find((e) => e.query === q && existsSync(ROOT + e.file));
    return hit ? { id: hit.id, dataUri: dataUri(ROOT + hit.file) } : null;
  };
  const shots: PanelShot[] = sheet.beats.flatMap((b, i) => (b.panel && 'stock' in b.panel ? [{ start: beatStart[i]!, query: b.panel.stock, image: findImage(b.panel.stock) }] : []));
  if (shots[0]) shots[0].start = 0; // something is on screen from frame 0

  const panelMemes = sheet.beats.flatMap((b, i) =>
    b.panel && 'meme' in b.panel ? [{ name: b.panel.meme, text: b.panel.text ?? {}, start: beatStart[i]!, end: beatStart[i]! + MEMES[b.panel.meme]!.durationSec }] : []);
  const cameraMemes = sheet.beats.flatMap((b, i) => (b.camera ? [{ name: b.camera, start: beatStart[i]!, end: beatStart[i]! + MEMES[b.camera]!.durationSec }] : []));
  const verdicts = sheet.beats.flatMap((b, i) => (b.verdict ? [{ label: b.verdict.label, start: Math.max(beatStart[i]!, segs[i + 1]!.end - 0.35), end: (beatStart[i + 1] ?? voice.durationSec) + 0.4 }] : []));

  // SFX on emphasis moments only (brief §1.5).
  const trans = transitionsFor(shots.length, sheet.id);
  const sfx: SfxEvent[] = [
    ...shots.slice(1).map((s, k) => ({ t: s.start, name: trans[k + 1] === 'whip' ? ('whoosh' as const) : ('pop' as const), priority: 2 })),
    ...panelMemes.map((m) => ({ t: m.start, name: 'pop' as const, priority: 3 })),
    ...cameraMemes.map((m) => ({ t: m.start, name: 'boom' as const, priority: 5 })),
    ...verdicts.map((v) => ({ t: v.start, name: 'stamp' as const, priority: 6 })),
    ...sheet.beats.flatMap((b, i) => (b.prop ? [{ t: beatStart[i]!, name: 'pop' as const, priority: 0 }] : [])),
  ];
  const verdictTails: SfxEvent[] = verdicts.map((v) => ({ t: v.start + 0.25, name: v.label === 'TRUE' ? 'ding' : 'buzz', priority: 6 }));

  return {
    sheet, channel, voice, lint, words, segs, beatStart, totalFrames, poses, stage, shots, panelMemes, cameraMemes, verdicts,
    chunks: chunkWords(words), sfx: [...scheduleSfx(sfx, 1.0), ...verdictTails].sort((a, b) => a.t - b.t),
    draft: !sheet.human_edited,
  };
}

// ------------------------------------------------------------------- frames

const VERDICT_STYLE: Record<Verdict, { color: ColorName; text: string }> = {
  TRUE: { color: 'money', text: 'TRUE' },
  FALSE: { color: 'loss', text: 'FALSE' },
  MISLEADING: { color: 'highlight', text: 'MISLEADING' },
  NEEDS_CONTEXT: { color: 'highlight', text: 'NEEDS CONTEXT' },
  UNPROVEN: { color: 'ink', text: 'UNPROVEN' },
};

/** Big outlined title text, wrapped to ≤ 2 lines (hook on frame 0, cover). */
function titleSvg(text: string, cx: number, cy: number, size: number, maxW: number, fill: ColorName): string {
  const ws = text.toUpperCase().split(/\s+/);
  const gap = size * 0.3;
  const width = (xs: string[]) => xs.reduce((a, w) => a + measureText(w, size, 'title'), 0) + gap * (xs.length - 1);
  let lines = [ws];
  if (width(ws) > maxW) {
    let best = Infinity;
    for (let k = 1; k < ws.length; k++) {
      const m = Math.max(width(ws.slice(0, k)), width(ws.slice(k)));
      if (m < best) { best = m; lines = [ws.slice(0, k), ws.slice(k)]; }
    }
  }
  const scale = Math.min(1, maxW / Math.max(...lines.map(width)));
  const s = size * scale, lh = s * 1.05;
  return lines.map((l, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lh + s * 0.36;
    return `<text x="${cx}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${tokens.fonts.title.family}" font-size="${s.toFixed(1)}" fill="${colorHex(fill)}" stroke="${colorHex('ink')}" stroke-width="${(s * 0.18).toFixed(1)}" stroke-linejoin="round" paint-order="stroke">${l.join(' ').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
  }).join('');
}

function active<T extends Window>(xs: T[], t: number): T | undefined {
  return xs.find((x) => t >= x.start && t < x.end);
}

export function frameSvg(p: Plan, f: number): string {
  const t = f / fps;
  const bf = boilFrame(f, fps);
  const seed = p.sheet.id;
  let bi = 0;
  p.beatStart.forEach((s, i) => { if (s <= t) bi = i; });
  const beat = p.sheet.beats[bi]!;
  const since = t - p.beatStart[bi]!;

  // ---- top panel
  let panel: string;
  const pm = active(p.panelMemes, t);
  const memeDef = pm ? MEMES[pm.name] : undefined;
  if (pm && memeDef?.kind === 'panel') {
    const pen = new Pen({ seed: `${seed}|meme|${pm.start}`, boilFrame: bf });
    memeDef.draw(pen, { box: PANEL, progress: (t - pm.start) / (pm.end - pm.start), text: pm.text });
    const frame = new Pen({ seed: seed + '|frame', boilFrame: bf });
    frame.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, { width: 'bold' });
    panel = `<defs><clipPath id="memeClip"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}"/></clipPath></defs><g clip-path="url(#memeClip)">${itemsToSvg(pen.items)}</g>${itemsToSvg(frame.items)}`;
  } else {
    panel = stockPanelSvg(p.shots, t, fps, seed, bf);
  }

  // Verdict stamp slams onto the panel.
  const v = active(p.verdicts, t);
  if (v) {
    const st = VERDICT_STYLE[v.label];
    const k = (t - v.start) * fps;
    const scale = 1.7 - 0.7 * Math.min(1, backOut(k / 5, 1.2));
    const cx = PANEL.x + PANEL.w * 0.62, cy = PANEL.y + PANEL.h * 0.55;
    const sp = new Pen({ seed: `${seed}|stamp|${v.start}`, boilFrame: bf });
    sp.at({ x: cx, y: cy, rot: -0.18 }, () => {
      const w = Math.max(360, measureText(st.text, tokens.text.sizesPx.large, 'title') + 90);
      sp.rect(-w / 2, -95, w, 190, { fill: 'white', color: st.color === 'highlight' ? 'ink' : st.color, width: 'bold' });
      sp.label(st.text, 0, 0, { size: 'large', color: st.color, outline: st.color === 'highlight' ? 'ink' : null });
    });
    panel += `<g transform="translate(${cx} ${cy}) scale(${scale.toFixed(3)}) translate(${-cx} ${-cy})">${itemsToSvg(sp.items)}</g>`;
  }

  // On-screen hook: fully visible on frame 0 (R1), over the panel until the hook is spoken.
  if (t < p.segs[0]!.end + 0.3) panel += titleSvg(p.sheet.hook.on_screen, W / 2, PANEL.y + PANEL.h - 150, 104, PANEL.w - 80, 'highlight');

  // ---- stage
  const pen = new Pen({ seed, boilFrame: bf });
  const block = blockingAt(p.stage, f, fps);
  const state = stateAt(stickman, p.poses, f, seed);
  state.pose = applyBlocking(state.pose, block);
  const cm = active(p.cameraMemes, t);
  const cmDef = cm ? MEMES[cm.name] : undefined;
  if (cmDef?.kind === 'camera') {
    state.expression = cmDef.camera.expression;
    state.mouth = cmDef.camera.mouth ?? state.mouth;
  }
  const anchors = drawCharacter(pen, stickman, state, { x: block.x, y: tokens.layout.groundY, rotDeg: block.rotDeg });

  let propSvg = '';
  if (beat.prop && !cm) {
    const prop = PROPS[beat.prop]!;
    const held = prop.carry === 'hands' && beat.pose === 'hold';
    const at = held ? { x: anchors.hold.x, y: anchors.hold.y + (prop.heightHU * HU) / 2 } : { x: propXFor(p.stage[bi]!.x), y: tokens.layout.groundY };
    const pp = new Pen({ seed, boilFrame: bf });
    drawProp(pp, prop, at);
    // Frame 0 must be complete (R1), so the first beat's prop is already there; later props pop in.
    const s = bi === 0 ? 1 : Math.max(0.001, backOut((since * fps) / tokens.motion.pop.durationFrames, tokens.motion.pop.overshoot));
    const cx = at.x, cy = at.y - (prop.heightHU * HU) / 2;
    propSvg = `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(3)}) translate(${-cx} ${-cy})">${itemsToSvg(pp.items)}</g>`;
  }
  let stageSvg = itemsToSvg(pen.items) + propSvg;
  if (cm && cmDef?.kind === 'camera') {
    const z = 1 + (cmDef.camera.zoomTo - 1) * easeInOut(Math.min(1, (t - cm.start) / ((cm.end - cm.start) * 0.7)));
    const fx = anchors.headTop.x, fy = anchors.headTop.y + 0.5 * HU;
    stageSvg = `<defs><clipPath id="stageClip"><rect x="0" y="${tokens.layout.topPanelPx}" width="${W}" height="${H - tokens.layout.topPanelPx}"/></clipPath></defs>` +
      `<g clip-path="url(#stageClip)"><g transform="translate(${fx} ${fy}) scale(${z.toFixed(3)}) translate(${-fx} ${-fy})">${stageSvg}</g></g>`;
  }

  // ---- captions + honesty markers
  let overlay = captionSvg(p.chunks, t, fps, p.channel.caption_words);
  const marks = [p.draft ? 'DRAFT: NOT FOR POSTING' : '', p.voice.provider === 'estimate' ? 'NO VOICE: ESTIMATED TIMINGS' : ''].filter(Boolean);
  if (marks.length) {
    const mp = new Pen({ seed: seed + '|marks' });
    marks.forEach((m, i) => mp.label(m, W / 2, H - 50 - i * 46, { size: 'small', color: 'loss' }));
    overlay += itemsToSvg(mp.items);
  }
  return toSvg(panel + stageSvg + overlay, { width: W, height: H });
}

// -------------------------------------------------------------- cover + post

export function coverSvg(p: Plan): string {
  const first = p.sheet.beats[0]!;
  const pen = new Pen({ seed: p.sheet.id + '|cover' });
  drawCharacter(pen, stickman, { ...stateAt(stickman, p.poses, 0, p.sheet.id), mouth: 'open', blink: false }, { x: W * 0.36, y: tokens.layout.groundY });
  if (first.prop) drawProp(pen, PROPS[first.prop]!, { x: 800, y: tokens.layout.groundY });
  const title = titleSvg(p.sheet.hook.on_screen, W / 2, 560, 150, W - 160, 'highlight');
  return toSvg(itemsToSvg(pen.items) + title, { width: W, height: H });
}

export function postText(p: Plan): string {
  const urls = new Set<string>();
  if (p.sheet.claim) urls.add(p.sheet.claim.source.url);
  for (const b of p.sheet.beats) {
    for (const c of b.claims ?? []) c.sources.forEach((s) => urls.add(s.url));
    b.verdict?.sources.forEach((s) => urls.add(s.url));
  }
  return [
    p.sheet.caption ?? p.sheet.hook.spoken,
    (p.sheet.hashtags ?? []).map((h) => '#' + h.replace(/^#/, '')).join(' '),
    '',
    'Sources (pin as a comment):',
    ...[...urls].map((u) => `- ${u}`),
    '',
    'Before posting:',
    `- Turn ON TikTok's "AI-generated content" label (AI voice)${p.sheet.ai_voice_label ? '' : ' ⚠ ai_voice_label is false'}`,
    p.sheet.disclosures.length ? `- Turn ON content disclosure: ${p.sheet.disclosures.map((d) => d.sponsor).join(', ')}` : '- No sponsor: leave content disclosure off',
    p.draft ? '- ⚠ DRAFT: human_edited is false. Do not post.' : '',
    p.voice.provider === 'estimate' ? '- ⚠ No real voice: rendered with estimated timings and no narration.' : '',
  ].filter((l) => l !== '').join('\n') + '\n';
}

// ------------------------------------------------------------------- render

export async function renderVideo(p: Plan): Promise<string> {
  const dir = `${ROOT}out/${p.sheet.id}/`;
  mkdirSync(dir, { recursive: true });
  const dur = p.totalFrames / fps;
  writeFileSync(dir + 'sfx.wav', toWav(mixBed(p.sfx, dur, 0.22, p.sheet.id)));
  writeFileSync(dir + 'cover.png', svgToPng(coverSvg(p)));
  writeFileSync(dir + 'post.txt', postText(p));

  const audioIn = p.voice.audioFile ? ['-i', p.voice.audioFile] : [];
  const mix = p.voice.audioFile ? ['-filter_complex', '[1:a][2:a]amix=inputs=2:duration=first:normalize=0[a]', '-map', '0:v', '-map', '[a]'] : ['-map', '0:v', '-map', '1:a'];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-i', dir + 'sfx.wav', ...audioIn, ...mix,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-t', dur.toFixed(2), '-movflags', '+faststart', dir + 'video.mp4'],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < p.totalFrames; f++) {
    if (!ff.stdin.write(svgToPng(frameSvg(p, f)))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise<void>((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  return dir;
}
