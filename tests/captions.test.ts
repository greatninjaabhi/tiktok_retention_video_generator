import { describe, expect, it } from 'vitest';
import { estimateTimings } from '../render/captions/timing';
import { chunkWords, layoutLines } from '../render/captions/chunk';
import { classifyWord } from '../render/captions/classify';
import { lineWidth } from '../render/captions/measure';
import { loadChannel } from '../render/channel';
import { tokens } from '../render/tokens';

const C = tokens.captions;
const SCRIPT = "Why can't Congress pass anything? Meet the filibuster. Most bills need 60 votes in the Senate just to end debate. It's not in the Constitution. It's a Senate rule, and rules can change.";

describe('timings (estimate)', () => {
  it('speaks at the target WPM, excluding pauses', () => {
    const w = estimateTimings(SCRIPT, 180);
    const speaking = w.reduce((a, x) => a + (x.end - x.start), 0);
    expect((w.length / speaking) * 60).toBeCloseTo(180, 0);
    for (let i = 1; i < w.length; i++) expect(w[i]!.start).toBeGreaterThanOrEqual(w[i - 1]!.end);
  });
});

describe('phrase-group captions', () => {
  const words = estimateTimings(SCRIPT, 180);
  const chunks = chunkWords(words);
  it('shows every word exactly once, in order', () => {
    expect(chunks.flatMap((c) => c.words)).toEqual(words);
    expect(chunks.flatMap((c) => c.lines.flat())).toEqual(words);
  });
  it('groups words into phrases, not single words', () => {
    for (const c of chunks) expect(c.words.length).toBeLessThanOrEqual(C.maxWordsPerChunk);
    const avg = words.length / chunks.length;
    expect(avg).toBeGreaterThanOrEqual(3);
  });
  it('fits the band: ≤ maxLines lines, each ≤ maxLineWidthPx', () => {
    for (const c of chunks) {
      expect(c.lines.length).toBeLessThanOrEqual(C.maxLines);
      for (const l of c.lines) expect(lineWidth(l.map((w) => w.text.toUpperCase()), C.sizePx, C.wordGapPx)).toBeLessThanOrEqual(C.maxLineWidthPx);
    }
  });
  it('never runs across a sentence end', () => {
    for (const c of chunks) c.words.slice(0, -1).forEach((w) => expect(w.text).not.toMatch(/[.!?]$/));
  });
  it('leaves no gap in the band between chunks', () => {
    for (let i = 1; i < chunks.length; i++) expect(chunks[i - 1]!.end).toBe(chunks[i]!.start);
  });
  it('returns null when one word is too wide for the band', () => {
    expect(layoutLines([{ text: 'X'.repeat(80), start: 0, end: 1 }])).toBeNull();
  });
});

describe('word colors come from the channel config', () => {
  const lists = loadChannel('politics').caption_words;
  it('classifies good/bad words and signed amounts', () => {
    expect(classifyWord('BANNED.', lists)).toBe('bad');
    expect(classifyWord('passed,', lists)).toBe('good');
    expect(classifyWord('-$400', lists)).toBe('bad');
    expect(classifyWord('+$400', lists)).toBe('good');
    expect(classifyWord('Senate', lists)).toBeNull();
  });
});
