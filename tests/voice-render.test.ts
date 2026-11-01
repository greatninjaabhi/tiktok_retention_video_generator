import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { distributeWords, gapAfter, speechBounds } from '../voice/timing';
import { estimateVoice, kokoroVoice, type Tts } from '../voice/providers';
import { mixBed, scheduleSfx, SR, synth, toWav } from '../render/audio/sfx';
import { coverSvg, frameSvg, planVideo, postText } from '../render/video';
import { loadBeatSheet } from '../scripts/beatsheet';

describe('Kokoro voice (fake engine, no model download)', () => {
  const sr = 24000;
  // Fake TTS: 0.1 s silence, ~0.3 s of "speech" per word, 0.1 s silence.
  const fake: Tts = {
    generate: async (text) => {
      const n = text.split(/\s+/).length;
      const a = new Float32Array(Math.round(sr * (0.2 + 0.3 * n)));
      for (let i = Math.round(sr * 0.1); i < a.length - Math.round(sr * 0.1); i++) a[i] = 0.3 * Math.sin(i / 5);
      return { audio: a, sampling_rate: sr };
    },
  };
  it('trims silence, keeps beat boundaries exact, and writes one WAV', async () => {
    const r = await kokoroVoice({ voice: 'am_michael', speed: 1.1 }, fake).synthesize(['Why can\'t Congress pass anything?', 'Blame one rule.']);
    expect(r.provider).toBe('kokoro:am_michael');
    expect(r.words.map((w) => w.text)).toEqual(["Why", "can't", 'Congress', 'pass', 'anything?', 'Blame', 'one', 'rule.']);
    const firstEnd = r.words[4]!.end, secondStart = r.words[5]!.start;
    expect(secondStart - firstEnd).toBeGreaterThanOrEqual(0.2); // sentence pause
    expect(secondStart - firstEnd).toBeLessThan(0.4); // R8 dead air
    expect(r.audioFile).toMatch(/\.wav$/);
  });
  it('speech bounds and word spreading behave', () => {
    const a = new Float32Array(sr);
    for (let i = 6000; i < 18000; i++) a[i] = 0.5;
    const b = speechBounds(a, sr);
    expect(b.start).toBeLessThanOrEqual(6000);
    expect(b.end).toBeGreaterThanOrEqual(18000);
    const ws = distributeWords('Sixty votes, not fifty-one.', 1, 3);
    expect(ws[0]!.start).toBe(1);
    expect(ws.at(-1)!.end).toBeCloseTo(3);
    expect(gapAfter('Done.')).toBeGreaterThan(gapAfter('and then'));
  });
});

describe('synthesized SFX', () => {
  it('are deterministic, bounded and short', () => {
    for (const n of ['whoosh', 'pop', 'boom', 'stamp', 'ding', 'buzz'] as const) {
      const a = synth(n, 's'), b = synth(n, 's');
      expect(a).toEqual(b);
      expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.9001);
      expect(a.length / SR).toBeLessThan(1);
    }
  });
  it('never stacks two effects within the gap; higher priority wins', () => {
    const kept = scheduleSfx([{ t: 1, name: 'pop', priority: 0 }, { t: 1.4, name: 'boom', priority: 5 }, { t: 3, name: 'pop', priority: 0 }]);
    expect(kept.map((e) => e.name)).toEqual(['boom', 'pop']);
  });
  it('mixes into a valid WAV', () => {
    const wav = toWav(mixBed([{ t: 0.1, name: 'pop', priority: 0 }], 1));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.length).toBe(44 + SR * 2);
  });
});

describe('render plan (offline voice)', async () => {
  const sheet = loadBeatSheet(fileURLToPath(new URL('../scripts/videos/2026-11-01-filibuster.yaml', import.meta.url)));
  const plan = await planVideo(sheet, { draft: true, voice: estimateVoice(170) });
  it('uses estimated timings without a key, and marks drafts', () => {
    expect(plan.voice.provider).toBe('estimate');
    expect(plan.draft).toBe(true);
    expect(frameSvg(plan, 10)).toContain('DRAFT: NOT FOR POSTING');
    expect(frameSvg(plan, 10)).toContain('NO VOICE');
  });
  it('opens on the channel intro, then the hook frames', () => {
    expect(plan.introSec).toBeGreaterThan(0);
    expect(plan.words[0]!.start).toBeGreaterThanOrEqual(plan.introSec);
    expect(frameSvg(plan, 0)).toContain('WELCOME');
    expect(frameSvg(plan, Math.ceil(plan.introSec * 30))).not.toContain('WELCOME');
  });
  it('the intro sting is deterministic and bounded', () => {
    expect(synth('sting', 's')).toEqual(synth('sting', 's'));
    expect(Math.max(...synth('sting', 's').map(Math.abs))).toBeLessThanOrEqual(0.9001);
  });
  it('shows the on-screen hook on frame 0 (R1)', () => {
    expect(frameSvg(plan, 0)).toContain("WHY CONGRESS");
  });
  it('places SFX only on emphasis moments, at least a second apart', () => {
    const main = plan.sfx.filter((e) => e.name !== 'ding' && e.name !== 'buzz');
    for (let i = 1; i < main.length; i++) expect(main[i]!.t - main[i - 1]!.t).toBeGreaterThanOrEqual(1);
    expect(plan.sfx.some((e) => e.name === 'boom')).toBe(true); // the zoom_stare beat
  });
  it('refuses to plan a non-draft script that is not human-edited', async () => {
    await expect(planVideo(sheet, { voice: estimateVoice(170) })).rejects.toThrow(/human-edit/);
  });
  it('writes a post with sources and the AI-label reminder', () => {
    const post = postText(plan);
    expect(post).toContain('https://www.senate.gov/');
    expect(post).not.toMatch(/AI-generated/);
    expect(post).toMatch(/DRAFT/);
    expect(coverSvg(plan)).toContain('<text');
  });
});
