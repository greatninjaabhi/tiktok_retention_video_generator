/**
 * Groups words into on-screen phrases (owner: at 180 WPM single words flash by too fast).
 * Breaks at sentence ends, prefers commas, caps at maxWordsPerChunk and at maxLines of
 * maxLineWidthPx, and tops up short chunks (< minWordsPerChunk) by borrowing from the previous phrase of the same sentence.
 */
import { tokens } from '../tokens';
import { lineWidth } from './measure';
import type { CaptionChunk, Word } from './types';

const C = tokens.captions;
const display = (w: Word) => (C.uppercase ? w.text.toUpperCase() : w.text);
const sentenceEnd = (w: Word) => /[.!?]["')]?$/.test(w.text);
const clauseEnd = (w: Word) => /[,;:—]$/.test(w.text);

/** Width in px of one line made of these display texts. */
export type Measure = (texts: string[]) => number;
const defaultMeasure: Measure = (texts) => lineWidth(texts, C.sizePx, C.wordGapPx);

/** Split words into ≤ maxLines lines; two lines are balanced so neither is much longer. */
export function layoutLines(words: Word[], measure: Measure = defaultMeasure): Word[][] | null {
  const width = (ws: Word[]) => measure(ws.map(display));
  const one = width(words);
  if (one <= C.maxLineWidthPx && (words.length <= 3 || one <= C.maxLineWidthPx * 0.72)) return [words];
  if (C.maxLines < 2 || words.length < 2) return one <= C.maxLineWidthPx ? [words] : null;
  let best: Word[][] | null = null;
  let bestMax = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k), b = words.slice(k);
    const m = Math.max(width(a), width(b));
    if (m <= C.maxLineWidthPx && m < bestMax) { best = [a, b]; bestMax = m; }
  }
  return best ?? (one <= C.maxLineWidthPx ? [words] : null);
}

export function chunkWords(words: Word[], measure: Measure = defaultMeasure): CaptionChunk[] {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  for (const w of words) {
    cur.push(w);
    if (cur.length > 1 && !layoutLines(cur, measure)) {
      cur.pop();
      flush();
      cur.push(w);
    }
    if (sentenceEnd(w)) flush();
    else if (clauseEnd(w) && cur.length >= C.minWordsPerChunk) flush();
    else if (cur.length >= C.maxWordsPerChunk) flush();
  }
  flush();

  // Rebalance orphans: borrow trailing words from the previous chunk of the same sentence.
  for (let i = 1; i < groups.length; i++) {
    const prev = groups[i - 1]!, g = groups[i]!;
    while (g.length < C.minWordsPerChunk && prev.length > C.minWordsPerChunk && !sentenceEnd(prev[prev.length - 1]!)) {
      g.unshift(prev.pop()!);
      if (!layoutLines(g, measure)) { prev.push(g.shift()!); break; }
    }
  }

  return groups.map((g, i) => ({
    words: g,
    lines: layoutLines(g, measure) ?? [g],
    start: g[0]!.start,
    end: groups[i + 1]?.[0]?.start ?? g[g.length - 1]!.end + 0.4,
  }));
}

export { display as displayText };
