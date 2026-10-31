/** Builders for the contact sheets (shared by the CLI tool and the visual regression tests). */
import { Pen, type Item } from '../draw/pen';
import { drawCharacter, drawHead, type CharacterState } from '../character/draw';
import { drawProp } from '../props/place';
import { HU, COLOR_NAMES } from '../tokens';
import type { PropDef } from '../props/api';
import type { CharacterDef, ExpressionName, MouthShape } from '../character/types';

export const still = (def: CharacterDef, pose: string, over: Partial<CharacterState> = {}): CharacterState => {
  const p = def.poses[pose]!;
  return { pose: p, expression: p.expression, mouth: null, blink: false, breathe: 0, breatheHU: 0, tieFlapDeg: 0, ...over };
};

export type Sheet = { items: Item[]; width: number; height: number };

/** Every pose, expression, talking mouth shape and prop on one page. */
export function contactSheet(def: CharacterDef, poseNames: readonly string[], props: PropDef[], seed = 'contact-sheet'): Sheet {
  const pen = new Pen({ seed });
  const col = 200;
  const perRow = Math.max(poseNames.length, props.length, 8);
  const width = col * perRow;
  let y = 70;
  const title = (t: string) => { y += 40; pen.label(t, width / 2, y, { size: 'medium' }); y += 60; };

  title(`${def.id} v${def.version}: poses`);
  const charH = 6.2 * HU;
  poseNames.forEach((name, i) => {
    const x = col / 2 + (i % perRow) * col;
    pen.element(`pose:${name}`, () => drawCharacter(pen, def, still(def, name), { x, y: y + charH }));
    pen.label(name, x, y + charH + 34, { size: 'small' });
  });
  y += charH + 100;

  title('expressions');
  const exprs = Object.keys(def.expressions) as ExpressionName[];
  const faceH = 2.2 * HU;
  exprs.forEach((e, i) => {
    const x = col / 2 + i * col;
    pen.element(`expr:${e}`, () => headOnly(pen, def, still(def, 'idle', { expression: e }), x, y + faceH));
    pen.label(e, x, y + faceH + 20, { size: 'small' });
  });
  y += faceH + 80;

  title('talking mouth shapes (+ blink)');
  const mouths: (MouthShape | 'blink')[] = [...new Set(def.mouthByOpenness.map((m) => m.shape)), 'blink'];
  mouths.forEach((m, i) => {
    const x = col / 2 + i * col;
    const s = m === 'blink' ? still(def, 'idle', { blink: true }) : still(def, 'idle', { mouth: m });
    pen.element(`mouth:${m}`, () => headOnly(pen, def, s, x, y + faceH));
    pen.label(m, x, y + faceH + 20, { size: 'small' });
  });
  y += faceH + 80;

  title('props (drawn to the same head-unit grid as the character)');
  const propRowH = 2.6 * HU;
  props.forEach((p, i) => {
    const x = col / 2 + (i % perRow) * col;
    const row = Math.floor(i / perRow);
    drawProp(pen, p, { x, y: y + propRowH + row * (propRowH + 80) });
    pen.label(p.name, x, y + propRowH + row * (propRowH + 80) + 34, { size: 'small' });
  });
  y += Math.ceil(props.length / perRow) * (propRowH + 80) + 40;

  title('palette');
  COLOR_NAMES.forEach((c, i) => {
    const x = col / 2 + i * col;
    pen.element(`swatch:${c}`, () => pen.rect(x - 60, y, 120, 70, { fill: c }));
    pen.label(c, x, y + 100, { size: 'small' });
  });
  y += 150;

  return { items: pen.items, width, height: Math.ceil(y) };
}

function headOnly(pen: Pen, def: CharacterDef, s: CharacterState, x: number, yBottom: number): void {
  pen.element('face', () => drawHead(pen, def, s, { x, y: yBottom - HU * 0.75 }));
}

/** One prop alone, for its thumbnail. */
export function propSheet(p: PropDef, seed = 'thumb'): Sheet {
  const pen = new Pen({ seed });
  const size = 4 * HU;
  drawProp(pen, p, { x: size / 2, y: size / 2 + (p.heightHU * HU) / 2 });
  return { items: pen.items, width: size, height: size };
}
