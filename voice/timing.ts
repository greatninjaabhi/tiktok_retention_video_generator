import type { Word } from '../render/captions/types';

/** Leading/trailing silence trim: first/last 10 ms window above `threshold` RMS. */
export function speechBounds(samples: Float32Array, sampleRate: number, threshold = 0.01): { start: number; end: number } {
  const win = Math.max(1, Math.round(sampleRate * 0.01));
  const loud = (i: number) => {
    let s = 0;
    for (let k = i; k < Math.min(samples.length, i + win); k++) s += samples[k]! * samples[k]!;
    return Math.sqrt(s / win) > threshold;
  };
  let start = 0, end = samples.length;
  while (start < samples.length && !loud(start)) start += win;
  while (end > start && !loud(Math.max(0, end - win))) end -= win;
  return { start: Math.max(0, start - win), end: Math.min(samples.length, end + win) };
}

/**
 * Spread a segment's spoken time across its words, weighted by length, with a little extra
 * room after commas (the voice pauses there). Good enough for ≤ 4 s beats; a forced-alignment
 * pass (Whisper) can refine it later.
 */
export function distributeWords(text: string, start: number, end: number): Word[] {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const weight = (w: string) => 1 + w.replace(/[^\w$%]/g, '').length * 0.35 + (/[,;:—]$/.test(w) ? 0.8 : 0);
  const total = ws.reduce((a, w) => a + weight(w), 0) || 1;
  let t = start;
  return ws.map((text) => {
    const d = ((end - start) * weight(text)) / total;
    const w = { text, start: t, end: t + d * (/[,;:—]$/.test(text) ? 0.75 : 1) };
    t += d;
    return w;
  });
}

/** Pause after a segment: longer after a sentence end. Stays under the 0.4 s dead-air limit (R8). */
export const gapAfter = (segment: string) => (/[.!?]["')]?$/.test(segment.trim()) ? 0.24 : 0.12);
