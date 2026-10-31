import type { Word } from '../render/captions/types';

export type VoiceResult = {
  /** MP3/WAV path, or null when no real voice is available (estimate provider). */
  audioFile: string | null;
  words: Word[];
  durationSec: number;
  provider: string;
};

/** Swappable so a human voiceover (forced alignment) can replace the AI voice later (brief §6). */
export interface VoiceProvider {
  id: string;
  available(): boolean;
  synthesize(text: string): Promise<VoiceResult>;
}
