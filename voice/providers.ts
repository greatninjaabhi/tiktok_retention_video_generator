import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { estimateTimings } from '../render/captions/timing';
import { toWav } from '../render/audio/sfx';
import type { Word } from '../render/captions/types';
import { distributeWords, gapAfter, speechBounds } from './timing';
import type { VoiceProvider, VoiceResult } from './types';

const CACHE = fileURLToPath(new URL('./cache/', import.meta.url));

export type KokoroConfig = { voice: string; speed: number; model?: string; dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16' };
/** The slice of kokoro-js we use (injectable for tests). */
export type Tts = { generate(text: string, opts: { voice: string; speed: number }): Promise<{ audio: Float32Array; sampling_rate: number }> };

export const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';

async function loadKokoro(cfg: KokoroConfig): Promise<Tts> {
  const { KokoroTTS } = await import('kokoro-js');
  // First run downloads the model from Hugging Face (then it's cached locally).
  return (await KokoroTTS.from_pretrained(cfg.model ?? KOKORO_MODEL, { dtype: cfg.dtype ?? 'q8', device: 'cpu' })) as unknown as Tts;
}

/**
 * Kokoro-82M (Apache 2.0): free, runs locally on CPU. Each segment (hook, then each beat) is
 * voiced separately, silence-trimmed and joined with short pauses, so beat boundaries are exact.
 * Results are cached by (model, voice, speed, text).
 */
export function kokoroVoice(cfg: KokoroConfig, tts?: Tts): VoiceProvider {
  return {
    id: 'kokoro',
    async synthesize(segments): Promise<VoiceResult> {
      const key = createHash('sha256').update(JSON.stringify([cfg.model ?? KOKORO_MODEL, cfg.dtype ?? 'q8', cfg.voice, cfg.speed, segments])).digest('hex').slice(0, 16);
      const wav = `${CACHE}${key}.wav`, json = `${CACHE}${key}.json`;
      if (!tts && existsSync(wav) && existsSync(json)) return JSON.parse(readFileSync(json, 'utf8')) as VoiceResult;

      const engine = tts ?? (await loadKokoro(cfg));
      const parts: Float32Array[] = [];
      const words: Word[] = [];
      let sr = 24000, t = 0.15; // a breath of silence before the hook
      parts.push(new Float32Array(Math.round(sr * t)));
      for (const seg of segments) {
        const out = await engine.generate(seg, { voice: cfg.voice, speed: cfg.speed });
        sr = out.sampling_rate;
        const { start, end } = speechBounds(out.audio, sr);
        const speech = out.audio.subarray(start, end);
        words.push(...distributeWords(seg, t, t + speech.length / sr));
        parts.push(speech);
        t += speech.length / sr;
        const gap = gapAfter(seg);
        parts.push(new Float32Array(Math.round(sr * gap)));
        t += gap;
      }
      const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
      let o = 0;
      for (const p of parts) { all.set(p, o); o += p.length; }
      const result: VoiceResult = { audioFile: wav, words, durationSec: all.length / sr, provider: `kokoro:${cfg.voice}` };
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(wav, toWav(all, sr));
      writeFileSync(json, JSON.stringify(result));
      return result;
    },
  };
}

/** Offline stand-in: estimated word timings and NO audio. Renders are marked as such. */
export function estimateVoice(wpm: number, note?: string): VoiceProvider {
  return {
    id: 'estimate',
    async synthesize(segments) {
      const words = estimateTimings(segments.join(' '), wpm);
      return { audioFile: null, words, durationSec: (words[words.length - 1]?.end ?? 0) + 0.4, provider: 'estimate', note };
    },
  };
}

/** Kokoro, or the estimate stand-in if the model can't be loaded (e.g. no network on first run). */
export async function voiceScript(segments: string[], cfg: KokoroConfig, wpm: number): Promise<VoiceResult> {
  try {
    return await kokoroVoice(cfg).synthesize(segments);
  } catch (e) {
    return estimateVoice(wpm, `Kokoro unavailable: ${(e as Error).message.split('\n')[0]}`).synthesize(segments);
  }
}
