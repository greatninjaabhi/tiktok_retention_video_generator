import type { Pen } from '../draw/pen';
import type { PropDef } from './api';

/** Draw a prop with its bottom-center at (x, y). Seeds come from the prop name, so a prop looks the same wherever it appears in a video. */
export function drawProp(pen: Pen, def: PropDef, at: { x: number; y: number; rot?: number }): void {
  pen.at({ x: at.x, y: at.y, rot: at.rot ?? 0 }, () => pen.element(`prop:${def.name}`, () => def.draw(pen)));
}
