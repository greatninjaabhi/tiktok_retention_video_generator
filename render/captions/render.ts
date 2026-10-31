/** Caption band renderer: the current phrase, word-positioned, active word popped and highlighted. */
import { colorHex, tokens, type ColorName } from '../tokens';
import { backOut } from '../character/animate';
import { measureText } from './measure';
import { displayText } from './chunk';
import { classifyWord, type WordLists } from './classify';
import type { CaptionChunk } from './types';

const C = tokens.captions;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function activeChunk(chunks: CaptionChunk[], t: number): CaptionChunk | null {
  return chunks.find((c) => t >= c.start && t < c.end) ?? null;
}

export function captionSvg(chunks: CaptionChunk[], t: number, fps: number, words: WordLists): string {
  const chunk = activeChunk(chunks, t);
  if (!chunk) return '';
  const size = C.sizePx;
  const space = C.wordGapPx;
  const lh = size * C.lineHeight;
  const family = tokens.fonts[C.font as 'caption'].family;
  const pop = 0.7 + 0.3 * backOut((t - chunk.start) * fps / C.popFrames, tokens.motion.pop.overshoot);

  // The word being spoken (or, in a pause, the last one spoken) stays highlighted.
  const activeWord = [...chunk.words].reverse().find((w) => w.start <= t) ?? null;
  let out = '';
  chunk.lines.forEach((line, li) => {
    const texts = line.map(displayText);
    const widths = texts.map((s) => measureText(s, size));
    const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = C.centerX - total / 2;
    const baseline = C.bandCenterY + (li - (chunk.lines.length - 1) / 2) * lh + size * 0.36;
    line.forEach((w, wi) => {
      const isActive = w === activeWord;
      const cls = classifyWord(w.text, words);
      const color: ColorName = cls === 'good' ? (C.goodColor as ColorName) : cls === 'bad' ? (C.badColor as ColorName) : isActive ? (C.activeColor as ColorName) : (C.color as ColorName);
      const cx = x + widths[wi]! / 2;
      const s = isActive ? C.activeScale : 1;
      out += `<text x="${(x).toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${family}" font-size="${size}" fill="${colorHex(color)}" stroke="${colorHex('ink')}" stroke-width="${C.outlinePx}" stroke-linejoin="round" paint-order="stroke"${s !== 1 ? ` transform="translate(${cx.toFixed(1)} ${(baseline - size * 0.36).toFixed(1)}) scale(${s}) translate(${(-cx).toFixed(1)} ${(-(baseline - size * 0.36)).toFixed(1)})"` : ''}>${esc(texts[wi]!)}</text>`;
      x += widths[wi]! + space;
    });
  });
  const cy = C.bandCenterY;
  return `<g transform="translate(${C.centerX} ${cy}) scale(${pop.toFixed(3)}) translate(${-C.centerX} ${-cy})">${out}</g>`;
}
