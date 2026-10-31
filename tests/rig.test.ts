import { describe, expect, it } from 'vitest';
import { solve } from '../render/character/rig';
import { stickman, POSE_NAMES } from '../assets/characters/stickman/character';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const P = stickman.proportions;

describe('rig', () => {
  it.each(POSE_NAMES)('%s: lowest foot is on the ground (minus lift)', (name) => {
    const pose = stickman.poses[name];
    const j = solve(pose, P);
    expect(Math.max(j.footL.y, j.footR.y)).toBeCloseTo(-pose.lift, 6);
  });
  it.each(POSE_NAMES)('%s: limb lengths are preserved', (name) => {
    const j = solve(stickman.poses[name], P);
    expect(dist(j.shoulder, j.elbowL)).toBeCloseTo(P.upperArm, 6);
    expect(dist(j.elbowR, j.handR)).toBeCloseTo(P.forearm, 6);
    expect(dist(j.hip, j.kneeL)).toBeCloseTo(P.thigh, 6);
    expect(dist(j.kneeR, j.footR)).toBeCloseTo(P.shin, 6);
    expect(dist(j.hip, j.neck)).toBeCloseTo(P.torso, 6);
  });
  it('point_up actually points up (toward the top panel)', () => {
    const j = solve(stickman.poses.point_up, P);
    expect(j.handR.y).toBeLessThan(j.headCenter.y);
  });
  it('thinking puts a hand near the chin', () => {
    const j = solve(stickman.poses.thinking, P);
    const chin = { x: j.headCenter.x, y: j.headCenter.y + P.head / 2 };
    expect(dist(j.handR, chin)).toBeLessThan(0.45);
  });
});
