/**
 * Sound effects synthesized by our own code (no third-party samples, so no license risk; brief
 * §1.5). Deterministic per seed. Placement rule from the brief: SFX only on emphasis moments,
 * never on every cut, never two within `minGapSec`, mixed well under the voice.
 */
import { createRng } from '../rng';

export const SR = 44100;
export type SfxName = 'whoosh' | 'pop' | 'boom' | 'stamp' | 'ding' | 'buzz' | 'sting';
export type SfxEvent = { t: number; name: SfxName; priority: number; gain?: number };

const env = (t: number, tau: number) => Math.exp(-t / tau);

export function synth(name: SfxName, seed = 'sfx'): Float32Array {
  const rng = createRng(`${seed}|${name}`);
  const dur = { whoosh: 0.38, pop: 0.09, boom: 0.9, stamp: 0.28, ding: 0.75, buzz: 0.42, sting: 0.75 }[name];
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let lp = 0, phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    let s = 0;
    switch (name) {
      case 'whoosh': { // filtered noise, cutoff sweeping up then down
        const cutoff = 300 + 3800 * Math.sin(Math.PI * Math.min(1, u * 1.3));
        lp += (2 * Math.PI * cutoff / SR) * ((rng.next() * 2 - 1) - lp);
        s = lp * Math.sin(Math.PI * u) ** 2 * 2.5;
        break;
      }
      case 'pop': {
        phase += (2 * Math.PI * (300 + 600 * env(t, 0.015))) / SR;
        s = Math.sin(phase) * env(t, 0.022);
        break;
      }
      case 'boom': {
        phase += (2 * Math.PI * (38 + 52 * env(t, 0.12))) / SR;
        s = Math.tanh(2 * Math.sin(phase)) * env(t, 0.28) + (rng.next() * 2 - 1) * env(t, 0.004) * 0.3;
        break;
      }
      case 'stamp': {
        lp += (2 * Math.PI * 1200 / SR) * ((rng.next() * 2 - 1) - lp);
        phase += (2 * Math.PI * 120) / SR;
        s = lp * env(t, 0.03) * 3 + Math.sin(phase) * env(t, 0.08);
        break;
      }
      case 'ding':
        s = (Math.sin(2 * Math.PI * 1318.5 * t) + 0.5 * Math.sin(2 * Math.PI * 1975.5 * t)) * env(t, 0.25) * Math.min(1, t / 0.003);
        break;
      case 'sting': { // loud and abrupt: a noise hit and low thump under a fast rising brass stab
        const tone = (hz: number, at: number) => {
          const d = t - at;
          if (d < 0) return 0;
          return Math.tanh(2.5 * (Math.sin(2 * Math.PI * hz * d) + 0.5 * Math.sin(4 * Math.PI * hz * d))) * env(d, 0.3);
        };
        phase += (2 * Math.PI * (55 + 70 * env(t, 0.05))) / SR;
        s = (rng.next() * 2 - 1) * env(t, 0.03) + Math.sin(phase) * env(t, 0.16)
          + 0.5 * tone(392, 0) + 0.6 * tone(523.25, 0.05) + 0.7 * tone(659.25, 0.1) + 0.8 * tone(783.99, 0.15) + 0.5 * tone(1046.5, 0.15);
        s *= Math.min(1, (dur - t) / 0.05);
        break;
      }
      case 'buzz':
        s = (0.5 * Math.sign(Math.sin(2 * Math.PI * 110 * t)) + 0.5 * Math.sin(2 * Math.PI * 220 * t)) * Math.min(1, t / 0.01, (dur - t) / 0.05);
        break;
    }
    out[i] = s;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < n; i++) out[i]! /= peak / 0.9;
  return out;
}

/** Keep the higher-priority effect when two land within `minGapSec`. */
export function scheduleSfx(events: SfxEvent[], minGapSec = 1.0): SfxEvent[] {
  const kept: SfxEvent[] = [];
  for (const e of [...events].sort((a, b) => b.priority - a.priority || a.t - b.t)) {
    if (kept.every((k) => Math.abs(k.t - e.t) >= minGapSec)) kept.push(e);
  }
  return kept.sort((a, b) => a.t - b.t);
}

/** Mix effects into one mono bed at `gain` (linear; 0.2 ≈ −14 dB). */
export function mixBed(events: SfxEvent[], durationSec: number, gain = 0.2, seed = 'sfx'): Float32Array {
  const bed = new Float32Array(Math.ceil(durationSec * SR));
  const cache = new Map<SfxName, Float32Array>();
  for (const e of events) {
    const s = cache.get(e.name) ?? synth(e.name, seed);
    cache.set(e.name, s);
    const off = Math.round(e.t * SR);
    for (let i = 0; i < s.length && off + i < bed.length; i++) bed[off + i]! += s[i]! * (e.gain ?? gain);
  }
  return bed;
}

/** 16-bit PCM mono WAV. */
export function toWav(samples: Float32Array, sampleRate = SR): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return buf;
}
