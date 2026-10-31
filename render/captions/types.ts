/** A spoken word with its timing in seconds. Real timings come from the voice step (ElevenLabs alignment). */
export type Word = { text: string; start: number; end: number };

export type CaptionChunk = {
  words: Word[];
  /** Word indices per line (into `words`). */
  lines: Word[][];
  start: number;
  /** When the chunk leaves the screen (next chunk's start, so there's never a blank band mid-speech). */
  end: number;
};
