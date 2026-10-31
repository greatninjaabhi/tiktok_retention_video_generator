import type { Word } from '../render/captions/types';

export type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/**
 * ElevenLabs returns per-character timings. We use `alignment` (the text as written, so "$1,000"
 * stays "$1,000" in captions) and merge characters into whitespace-separated words.
 */
export function charsToWords(a: CharAlignment): Word[] {
  const out: Word[] = [];
  let text = '', start = 0, end = 0;
  const flush = () => {
    if (text) out.push({ text, start, end });
    text = '';
  };
  a.characters.forEach((c, i) => {
    if (/\s/.test(c)) return flush();
    if (!text) start = a.character_start_times_seconds[i]!;
    text += c;
    end = a.character_end_times_seconds[i]!;
  });
  flush();
  return out;
}
