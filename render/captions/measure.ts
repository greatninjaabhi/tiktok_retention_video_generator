/** Text measurement from the actual font file, so line wrapping matches what's rendered. */
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { tokens, type FontRole } from '../tokens';

const cache = new Map<string, opentype.Font>();

function font(role: FontRole): opentype.Font {
  const f = tokens.fonts[role];
  if (typeof f !== 'object' || !f.file) throw new Error(`font role "${role}" has no file`);
  let loaded = cache.get(f.file);
  if (!loaded) {
    loaded = opentype.loadSync(fileURLToPath(new URL(`../../assets/fonts/${f.file}`, import.meta.url)));
    cache.set(f.file, loaded);
  }
  return loaded;
}

/** Width of a caption line: words + the token word gap (not a font space, which the outline eats). */
export function lineWidth(texts: string[], sizePx: number, gapPx: number, role: FontRole = 'caption'): number {
  return texts.reduce((a, t) => a + measureText(t, sizePx, role), 0) + gapPx * Math.max(0, texts.length - 1);
}

export function measureText(text: string, sizePx: number, role: FontRole = 'caption'): number {
  return font(role).getAdvanceWidth(text, sizePx);
}
