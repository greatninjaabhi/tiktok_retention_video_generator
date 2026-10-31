import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { estimateTimings } from '../render/captions/timing';
import { charsToWords, type CharAlignment } from './align';
import type { VoiceProvider, VoiceResult } from './types';

const CACHE = fileURLToPath(new URL('./cache/', import.meta.url));

/**
 * ElevenLabs text-to-speech WITH timestamps: one call returns audio + character timings
 * (brief §6). Results are cached by (text, voice, model) so re-renders don't spend credits.
 * Needs ELEVENLABS_API_KEY and a voice id (channel.yaml voice_id or ELEVENLABS_VOICE_ID).
 */
export function elevenLabs(voiceId: string | null, model = 'eleven_multilingual_v2'): VoiceProvider {
  const vid = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? null;
  return {
    id: 'elevenlabs',
    available: () => !!process.env.ELEVENLABS_API_KEY && !!vid,
    async synthesize(text): Promise<VoiceResult> {
      const key = createHash('sha256').update(`${vid}|${model}|${text}`).digest('hex').slice(0, 16);
      mkdirSync(CACHE, { recursive: true });
      const mp3 = `${CACHE}${key}.mp3`, json = `${CACHE}${key}.json`;
      if (!existsSync(json)) {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}/with-timestamps?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model_id: model }),
        });
        if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const body = (await res.json()) as { audio_base64: string; alignment: CharAlignment };
        writeFileSync(mp3, Buffer.from(body.audio_base64, 'base64'));
        writeFileSync(json, JSON.stringify(body.alignment));
      }
      const words = charsToWords(JSON.parse(readFileSync(json, 'utf8')) as CharAlignment);
      return { audioFile: mp3, words, durationSec: (words[words.length - 1]?.end ?? 0) + 0.3, provider: 'elevenlabs' };
    },
  };
}

/** Offline stand-in: estimated word timings and NO audio. Renders are marked as such. */
export function estimateVoice(wpm: number): VoiceProvider {
  return {
    id: 'estimate',
    available: () => true,
    async synthesize(text) {
      const words = estimateTimings(text, wpm);
      return { audioFile: null, words, durationSec: (words[words.length - 1]?.end ?? 0) + 0.4, provider: 'estimate' };
    },
  };
}

export function pickVoice(voiceId: string | null, wpm: number, model?: string): VoiceProvider {
  const el = elevenLabs(voiceId, model);
  return el.available() ? el : estimateVoice(wpm);
}
