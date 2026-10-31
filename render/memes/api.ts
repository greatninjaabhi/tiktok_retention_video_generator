/**
 * The ONLY module a meme file may import (enforced by the style lint), so memes are drawn
 * with the same pen, character and palette as everything else (brief §1.8).
 * Memes are meme FORMATS redrawn by us, never copies of specific copyrighted images.
 */
import type { Pen } from '../draw/pen';
import { drawCharacter } from '../character/draw';
import { still } from '../tools/sheets';
import { HU, tokens } from '../tokens';
import { stickman } from '../../assets/characters/stickman/character';
import type { ExpressionName, MouthShape } from '../character/types';

export type { Pen, ExpressionName };
export { HU };

export type Box = { x: number; y: number; w: number; h: number };

export type PanelMemeContext = {
  /** Panel area in px (the top panel frame). */
  box: Box;
  /** 0…1 progress through the meme beat. */
  progress: number;
  /** Text slots filled from the beat sheet (e.g. { who: "CONGRESS AT 3AM" }). */
  text: Record<string, string>;
};

export type MemeDef =
  | { name: string; version: number; kind: 'panel'; slots: string[]; durationSec: number; draw(pen: Pen, ctx: PanelMemeContext): void }
  | {
      name: string; version: number; kind: 'camera'; slots: string[]; durationSec: number;
      /** Camera zoom toward the character's head over the beat, plus the face to pull. */
      camera: { zoomTo: number; expression: ExpressionName; mouth: MouthShape | null };
    };

export const defineMeme = <T extends MemeDef>(def: T): T => def;

/** The stickman from the chest up, standing so his head sits at (x, headY). Clip to the box to crop. */
export function bust(pen: Pen, pose: string, x: number, headY: number, over: { expression?: ExpressionName; mouth?: MouthShape | null } = {}) {
  const s = still(stickman, pose, over);
  // Ground is ~4.6 HU below the head center for a standing pose.
  return drawCharacter(pen, stickman, s, { x, y: headY + 4.6 * HU });
}

export const textSizes = tokens.text.sizesPx;
