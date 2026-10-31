import { describe, expect, it } from 'vitest';
import { applyBlocking, blockingAt, moveFrames, type StageCue } from '../render/character/blocking';
import { autoBlock } from '../render/character/director';
import { stickman } from '../assets/characters/stickman/character';
import { tokens } from '../render/tokens';

const fps = 30;
const M = tokens.layout.stageMarksX;

describe('blocking', () => {
  const cues: StageCue[] = [
    { frame: 0, x: M.left, move: 'walk', tiltDeg: 0 },
    { frame: 30, x: M.right, move: 'walk', tiltDeg: 5 },
    { frame: 90, x: M.center, move: 'hop', tiltDeg: 0, spin: true },
  ];
  it('starts on the first mark and arrives at the next one', () => {
    expect(blockingAt(cues, 0, fps).x).toBe(M.left);
    const arrive = 30 + moveFrames(M.right - M.left, fps);
    expect(blockingAt(cues, arrive, fps).x).toBeCloseTo(M.right);
    expect(blockingAt(cues, 30 + 2, fps).walkPhase).not.toBeNull();
    expect(blockingAt(cues, arrive + 1, fps).dir).toBe(0);
  });
  it('settles into the cue tilt', () => {
    expect(blockingAt(cues, 80, fps).rotDeg).toBeCloseTo(5);
  });
  it('hops lift off the ground mid-move', () => {
    const mid = 90 + Math.floor(moveFrames(M.center - M.right, fps) / 2);
    expect(blockingAt(cues, mid, fps).liftHU).toBeGreaterThan(0.3);
  });
  it('a spin turns a full circle and ends upright', () => {
    const start = 90 + moveFrames(M.center - M.right, fps);
    const rots = Array.from({ length: tokens.stage.spinFrames + 2 }, (_, i) => blockingAt(cues, start + i, fps).rotDeg);
    expect(Math.max(...rots)).toBeGreaterThan(300);
    expect(rots[rots.length - 1]!).toBeCloseTo(0);
  });
  it('walking swings the legs in opposite directions', () => {
    const p = applyBlocking(stickman.poses.idle, { x: 0, rotDeg: 0, liftHU: 0, walkPhase: Math.PI / 2, dir: 1 });
    expect(Math.sign(p.legL.a + 6)).not.toBe(Math.sign(p.legR.a - 6));
    expect(p.look).toBeGreaterThan(0);
  });
});

describe('director', () => {
  const beats = Array.from({ length: 12 }, (_, i) => ({ frame: i * 60, pose: i === 7 ? 'celebrate' : 'idle' }));
  it('is deterministic per seed and differs across seeds', () => {
    expect(autoBlock(beats, 'v1')).toEqual(autoBlock(beats, 'v1'));
    expect(autoBlock(beats, 'v1')).not.toEqual(autoBlock(beats, 'v2'));
  });
  it('starts off-center and changes something every beat', () => {
    const c = autoBlock(beats, 'v1');
    expect(c[0]!.x).not.toBe(M.center);
    for (let i = 1; i < c.length; i++) expect(c[i]!.x !== c[i - 1]!.x || c[i]!.tiltDeg !== c[i - 1]!.tiltDeg).toBe(true);
  });
  it('spins at most once, only on a celebration', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const spins = autoBlock(beats, seed).map((c, i) => (c.spin ? i : -1)).filter((i) => i >= 0);
      expect(spins.length).toBeLessThanOrEqual(1);
      for (const i of spins) expect(beats[i]!.pose).toBe('celebrate');
    }
  });
});
