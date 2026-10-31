import type { Word } from './types';

/**
 * ESTIMATED word timings for previews and the linter's duration check only.
 * Real videos use the voice provider's timestamps (brief §6). Spreads words at `wpm`,
 * weighting longer words, and adds the pauses a narrator takes at commas and full stops.
 */
export function estimateTimings(script: string, wpm = 180, startSec = 0.2): Word[] {
  const texts = script.split(/\s+/).filter(Boolean);
  const weight = (t: string) => 0.6 + Math.min(12, t.replace(/[^\w$%]/g, '').length) * 0.08;
  const pause = (t: string) => (/[.!?]$/.test(t) ? 0.28 : /[,;:]$/.test(t) ? 0.12 : 0);
  const totalWeight = texts.reduce((a, t) => a + weight(t), 0);
  const speechSec = (texts.length / wpm) * 60;
  let t = startSec;
  return texts.map((text) => {
    const d = (weight(text) / totalWeight) * speechSec;
    const w = { text, start: t, end: t + d };
    t += d + pause(text);
    return w;
  });
}
