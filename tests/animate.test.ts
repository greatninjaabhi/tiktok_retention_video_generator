import { describe, expect, it } from 'vitest';
import { backOut, boilFrame, isBlinking, mouthFor, stateAt, type Timeline } from '../render/character/animate';
import { stickman, type PoseName } from '../assets/characters/stickman/character';
import { tokens } from '../render/tokens';

describe('animation', () => {
  it('backOut starts at 0, ends at 1 and overshoots', () => {
    expect(backOut(0, 1.6)).toBeCloseTo(0);
    expect(backOut(1, 1.6)).toBeCloseTo(1);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => backOut(i / 50, 1.6)))).toBeGreaterThan(1);
  });
  it('lines boil at the token rate', () => {
    expect(boilFrame(0, 30)).toBe(0);
    expect(boilFrame(30, 30)).toBe(tokens.boil.fps);
  });
  it('reaches the target pose after the transition and overshoots on the way', () => {
    const tl: Timeline<PoseName> = { fps: 30, cues: [{ frame: 0, pose: 'idle' }, { frame: 30, pose: 'celebrate' }] };
    const end = stateAt(stickman, tl, 30 + tokens.motion.pose.durationFrames, 's');
    expect(end.pose.armR.a).toBeCloseTo(stickman.poses.celebrate.armR.a);
    const peak = Math.max(...Array.from({ length: 9 }, (_, i) => stateAt(stickman, tl, 30 + i, 's').pose.armR.a));
    expect(peak).toBeGreaterThan(stickman.poses.celebrate.armR.a);
    expect(end.expression).toBe('excited');
  });
  it('blinks are deterministic and happen every few seconds', () => {
    const frames = Array.from({ length: 30 * 12 }, (_, f) => isBlinking('vid', f, 30));
    expect(frames).toEqual(Array.from({ length: 30 * 12 }, (_, f) => isBlinking('vid', f, 30)));
    const starts = frames.filter((b, i) => b && !frames[i - 1]).length;
    expect(starts).toBeGreaterThanOrEqual(2);
    expect(starts).toBeLessThanOrEqual(7);
  });
  it('maps mouth openness to shapes', () => {
    expect(mouthFor(stickman, 0)).toBe('closed');
    expect(mouthFor(stickman, 1)).toBe('wide');
  });
  it('the tie swings when the body moves', () => {
    const tl: Timeline<PoseName> = { fps: 30, cues: [{ frame: 0, pose: 'idle' }, { frame: 10, pose: 'celebrate' }] };
    const flaps = Array.from({ length: 10 }, (_, i) => Math.abs(stateAt(stickman, tl, 10 + i, 's').tieFlapDeg));
    expect(Math.max(...flaps)).toBeGreaterThan(tokens.motion.tieFlap.idleSwayDeg);
  });
});
