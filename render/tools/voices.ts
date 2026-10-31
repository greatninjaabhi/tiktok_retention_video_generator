/**
 * `npm run voices [-- am_michael af_heart ...]`: render the same test line in several Kokoro voices
 * to out/voices/<voice>.wav, so the owner can pick by ear (brief §12). Tests number/name pronunciation too.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { kokoroVoice } from '../../voice/providers';
import { loadChannel } from '../channel';

const LINE = ["Why can't Congress pass anything?", 'Most bills need sixty votes, not fifty-one.', 'Honestly? I think keeping it is a choice.'];
const voices = process.argv.slice(2).length ? process.argv.slice(2) : ['af_heart', 'af_bella', 'am_michael', 'am_fenrir', 'am_puck'];
const ch = loadChannel('politics');
const out = fileURLToPath(new URL('../../out/voices/', import.meta.url));
mkdirSync(out, { recursive: true });
for (const v of voices) {
  let r;
  try {
    r = await kokoroVoice({ ...ch.voice, voice: v }).synthesize(LINE);
  } catch (e) {
    console.error(`✗ ${v}: ${(e as Error).message.split('\n')[0]} (first run downloads the model from huggingface.co; check network access)`);
    process.exit(1);
  }
  writeFileSync(`${out}${v}.wav`, readFileSync(r.audioFile!));
  const words = r.words.length;
  console.log(`✓ out/voices/${v}.wav  ${r.durationSec.toFixed(1)} s  (~${Math.round((words / r.durationSec) * 60)} wpm at speed ${ch.voice.speed})`);
}
