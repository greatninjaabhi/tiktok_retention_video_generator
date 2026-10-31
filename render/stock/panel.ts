/**
 * The top panel: one licensed stock photo per beat with the SAME house treatment every time
 * (brief §1.7): fixed crop inside a wobbly doodle frame, one warm color grade, a slow push-in
 * while held, and a transition from the §1.5 preset library on every change.
 * With no image available, a clearly marked placeholder is drawn instead (never a fake photo).
 */
import { Pen } from '../draw/pen';
import { itemsToSvg } from '../draw/svg';
import { backOut } from '../character/animate';
import { createRng } from '../rng';
import { tokens } from '../tokens';

export type Transition = 'whip' | 'punch' | 'flash';
export type PanelShot = {
  start: number; // seconds
  query: string;
  image: { id: string; dataUri: string } | null;
};

const ST = tokens.stock;
const W = tokens.canvas.width;
const pad = tokens.layout.panelPaddingPx;
export const PANEL = { x: pad, y: pad, w: W - 2 * pad, h: tokens.layout.topPanelPx - 2 * pad };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Deterministic per video, never the same transition twice in a row. */
export function transitionsFor(count: number, seed: string): Transition[] {
  const rng = createRng(seed + '|transitions');
  const all = ST.transitions as Transition[];
  const out: Transition[] = [];
  for (let i = 0; i < count; i++) {
    const options = all.filter((t) => t !== out[i - 1]);
    out.push(options[Math.floor(rng.next() * options.length)]!);
  }
  return out;
}

function shotSvg(shot: PanelShot, kenBurns: number, dx: number, boilFrame: number, seed: string): string {
  const cx = PANEL.x + PANEL.w / 2, cy = PANEL.y + PANEL.h / 2;
  const move = `translate(${dx.toFixed(1)} 0) translate(${cx} ${cy}) scale(${kenBurns.toFixed(4)}) translate(${-cx} ${-cy})`;
  if (shot.image) {
    return `<g clip-path="url(#panelClip)"><g transform="${move}"><image href="${shot.image.dataUri}" x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" preserveAspectRatio="xMidYMid slice" filter="url(#grade)"/></g></g>`;
  }
  // Placeholder: obviously not a photo.
  const pen = new Pen({ seed: seed + '|placeholder', boilFrame });
  pen.at({ x: dx }, () => {
    pen.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, { fill: 'white', outline: false });
    pen.hatch([{ x: PANEL.x, y: PANEL.y }, { x: PANEL.x + PANEL.w, y: PANEL.y }, { x: PANEL.x + PANEL.w, y: PANEL.y + PANEL.h }, { x: PANEL.x, y: PANEL.y + PANEL.h }], 'paper', { spacing: 34 });
    pen.label('STOCK PHOTO SLOT', cx, cy - 40, { size: 'medium' });
    pen.label(`"${shot.query}"`, cx, cy + 40, { size: 'small', color: 'loss' });
  });
  return `<g clip-path="url(#panelClip)">${itemsToSvg(pen.items)}</g>`;
}

export function stockPanelSvg(shots: PanelShot[], t: number, fps: number, seed: string, boilFrame = 0): string {
  let i = -1;
  for (let k = 0; k < shots.length; k++) if (shots[k]!.start <= t) i = k;
  if (i < 0) return '';
  const shot = shots[i]!;
  const prev = shots[i - 1];
  const trans = transitionsFor(shots.length, seed)[i]!;
  const since = (t - shot.start) * fps;
  const tf = ST.transitionFrames;
  const hold = (shots[i + 1]?.start ?? shot.start + 3) - shot.start;
  const kb = (s: PanelShot, until: number) => 1 + (ST.pushScaleEnd - 1) * clamp01((until - s.start) / hold);

  const sat = ST.saturation, w = ST.warmth;
  const defs =
    `<defs><clipPath id="panelClip"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}"/></clipPath>` +
    `<filter id="grade" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${sat}"/>` +
    `<feColorMatrix type="matrix" values="${1 + w} 0 0 0 0  0 1 0 0 0  0 0 ${1 - w} 0 0  0 0 0 1 0"/></filter></defs>`;

  let body = '';
  if (i > 0 && since < tf && prev) {
    const p = clamp01(since / tf);
    if (trans === 'whip') {
      body += shotSvg(prev, kb(prev, t), -W * easeInOut(p), boilFrame, seed);
      body += shotSvg(shot, kb(shot, t), W * (1 - easeInOut(p)), boilFrame, seed);
    } else if (trans === 'punch') {
      body += shotSvg(shot, kb(shot, t) * (1.18 - 0.18 * backOut(p, 1.4)), 0, boilFrame, seed);
    } else {
      body += shotSvg(shot, kb(shot, t), 0, boilFrame, seed);
      const flash = Math.max(0, 1 - since / 3);
      if (flash > 0) body += `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" fill="#FFFFFF" opacity="${flash.toFixed(2)}"/>`;
    }
  } else {
    body += shotSvg(shot, kb(shot, t), 0, boilFrame, seed);
  }

  // The doodle frame is drawn by the shared pen, so it boils like everything else.
  const frame = new Pen({ seed: seed + '|frame', boilFrame });
  frame.element('panelFrame', () => frame.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, { width: 'bold' }));
  return defs + body + itemsToSvg(frame.items);
}
