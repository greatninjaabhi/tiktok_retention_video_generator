/**
 * The owner-approved look and pace (docs/PLAYBOOK.md). If one of these fails, the fix is almost
 * never to edit this file: change the script instead. Only the owner changes the house style.
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadChannel } from '../render/channel';
import { estimateVoice } from '../voice/providers';
import { frameSvg, planVideo } from '../render/video';
import { tokens } from '../render/tokens';
import { lintScript } from '../scripts/lint';
import { loadBeatSheet, type BeatSheet } from '../scripts/beatsheet';

const ch = loadChannel('politics');
const sample = () => loadBeatSheet(fileURLToPath(new URL('../scripts/videos/2026-10-31-trump-el-sayed-send-him-back.yaml', import.meta.url)));
const rules = (b: BeatSheet) => lintScript(b, ch, { draft: true }).issues.filter((i) => i.level === 'error').map((i) => i.rule);

describe('pace (owner: 1.05 and 7-word captions were "way too slow")', () => {
  it('keeps the voice fast', () => {
    expect(ch.voice.speed).toBeGreaterThanOrEqual(1.2);
    expect(ch.wpm).toBeGreaterThanOrEqual(190);
  });
  it('keeps captions in short groups', () => expect(tokens.captions.maxWordsPerChunk).toBeLessThanOrEqual(4));
});

describe('intro and ending (owner: loud, abrupt, short enough that the hook still lands)', () => {
  it('keeps the intro under a second', () => {
    expect(ch.intro?.text).toBe('WELCOME TO POLITICS');
    expect(ch.intro!.seconds).toBeLessThanOrEqual(1);
  });
  it('shows the intro with the hook, then the end card', async () => {
    const plan = await planVideo(sample(), { draft: true, voice: estimateVoice(ch.wpm) });
    expect(frameSvg(plan, 0)).toContain('WELCOME');
    expect(frameSvg(plan, 0)).toContain('WHERE?');
    expect(frameSvg(plan, plan.totalFrames - 5)).toContain('NEXT EPISODE');
  });
});

describe('linter blocks drift', () => {
  it('the approved script passes', () => expect(rules(sample())).toEqual([]));
  it('every photo needs a caption', () => {
    const s = sample();
    const shot = s.beats.find((x) => x !== s.beats[0] && x.panel && 'stock' in x.panel)!;
    delete (shot.panel as { caption?: string }).caption;
    expect(rules(s)).toContain('photo-caption');
  });
  it('the video must open on a photo', () => {
    const b = sample();
    delete b.beats[0]!.panel;
    expect(rules(b)).toContain('opening-photo');
  });
  it('the video must end on the follow line', () => {
    const b = sample();
    b.beats[b.beats.length - 1]!.tags = ['callback'];
    expect(rules(b)).toContain('outro');
  });
});
