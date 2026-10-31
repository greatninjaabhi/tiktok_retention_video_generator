import { describe, expect, it } from 'vitest';
import { charsToWords } from '../voice/align';
import { mixBed, scheduleSfx, SR, synth, toWav } from '../render/audio/sfx';
import { coverSvg, frameSvg, planVideo, postText } from '../render/video';
import { loadBeatSheet } from '../scripts/beatsheet';

describe('ElevenLabs character alignment → words', () => {
  it('merges characters into words, keeping written forms like $1,000', () => {
    const text = 'It costs $1,000 now.';
    const chars = [...text];
    const words = charsToWords({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.05),
      character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05),
    });
    expect(words.map((w) => w.text)).toEqual(['It', 'costs', '$1,000', 'now.']);
    expect(words[2]!.start).toBeCloseTo(9 * 0.05);
    expect(words[2]!.end).toBeCloseTo(15 * 0.05);
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
  const sheet = loadBeatSheet(new URL('../scripts/videos/2026-11-01-filibuster.yaml', import.meta.url).pathname);
  const plan = await planVideo(sheet, { draft: true });
  it('uses estimated timings without a key, and marks drafts', () => {
    expect(plan.voice.provider).toBe('estimate');
    expect(plan.draft).toBe(true);
    expect(frameSvg(plan, 10)).toContain('DRAFT: NOT FOR POSTING');
    expect(frameSvg(plan, 10)).toContain('NO VOICE');
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
    await expect(planVideo(sheet)).rejects.toThrow(/human-edit/);
  });
  it('writes a post with sources and the AI-label reminder', () => {
    const post = postText(plan);
    expect(post).toContain('https://www.senate.gov/');
    expect(post).toMatch(/AI-generated content/);
    expect(post).toMatch(/DRAFT/);
    expect(coverSvg(plan)).toContain('<text');
  });
});
