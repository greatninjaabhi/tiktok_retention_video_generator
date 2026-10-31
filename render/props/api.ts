/**
 * The ONLY module a prop file may import (enforced by the style lint).
 * Props are drawn in head units with origin at bottom-center (y negative = up),
 * so every prop shares the stickman's scale grid (brief §1.3).
 */
import { HU, type ColorName } from '../tokens';
import { type Pt, pt, sub, len, add, scale } from '../draw/geometry';
import type { Pen } from '../draw/pen';

export type { Pen, Pt, ColorName };
export { HU };

export type PropDef = {
  name: string;
  /** Bump when the drawing changes on purpose (snapshots are approved per version). */
  version: number;
  /** Declared height in head units; the lint checks the drawing matches it. */
  heightHU: number;
  /** Accent colors this prop uses (besides ink/white). Max 2, never `signature`. */
  accents: ColorName[];
  /** How the stickman holds it: 'hands' = centered between the hands; 'side' = next to him. */
  carry: 'hands' | 'side';
  draw(pen: Pen): void;
};

export const defineProp = (def: PropDef): PropDef => def;

/** Head units → px point. */
export const u = (x: number, y: number): Pt => pt(x * HU, y * HU);
/** Head units → px. */
export const px = (v: number): number => v * HU;
/** List of [x, y] pairs in HU → px points. */
export const path = (...xy: [number, number][]): Pt[] => xy.map(([x, y]) => u(x, y));

/** Triangle arrowhead at `tip`, pointing away from `from` (both in px). */
export function arrowHead(tip: Pt, from: Pt, sizePx: number): Pt[] {
  const d = sub(tip, from);
  const L = len(d) || 1;
  const back = scale(d, -sizePx / L);
  const side = { x: (-d.y / L) * sizePx * 0.6, y: (d.x / L) * sizePx * 0.6 };
  return [add(tip, scale(d, (sizePx * 0.25) / L)), add(add(tip, back), side), add(add(tip, back), scale(side, -1))];
}
