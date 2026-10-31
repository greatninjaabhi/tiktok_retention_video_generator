import type { Word } from '../render/captions/types';

export type VoiceResult = {
  /** WAV path, or null when no real voice is available (estimate provider). */
  audioFile: string | null;
  words: Word[];
  durationSec: number;
  provider: string;
  /** Why a fallback happened, if it did. */
  note?: string;
};

/**
 * Swappable voice (brief §6). `segments` = the hook + each beat line, in order; providers voice
 * them back-to-back so beat boundaries in the timings are exact.
 */
export interface VoiceProvider {
  id: string;
  synthesize(segments: string[]): Promise<VoiceResult>;
}
