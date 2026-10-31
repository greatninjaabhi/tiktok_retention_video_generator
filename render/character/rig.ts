/** Forward kinematics: pose angles → joint positions (in HU, ground-center origin, y down). */
import { type Pt, deg } from '../draw/geometry';
import type { LimbAngles, Pose, Proportions } from './types';

export type Joints = {
  hip: Pt; neck: Pt; shoulder: Pt; headCenter: Pt; headAngle: number;
  elbowL: Pt; handL: Pt; elbowR: Pt; handR: Pt;
  kneeL: Pt; footL: Pt; kneeR: Pt; footR: Pt;
};

const dir = (a: number): Pt => ({ x: Math.sin(deg(a)), y: Math.cos(deg(a)) });
const step = (p: Pt, a: number, l: number): Pt => ({ x: p.x + dir(a).x * l, y: p.y + dir(a).y * l });

function limb(from: Pt, angles: LimbAngles, l1: number, l2: number, base = 0): [Pt, Pt] {
  const mid = step(from, base + angles.a, l1);
  return [mid, step(mid, base + angles.a + angles.b, l2)];
}

/**
 * @param breathe  -1…1, scales the torso a touch so the chest rises and falls.
 * @param breatheHU amplitude of that rise in HU.
 */
export function solve(pose: Pose, P: Proportions, breathe = 0, breatheHU = 0): Joints {
  const hip0: Pt = { x: 0, y: 0 };
  const [kneeL0, footL0] = limb(hip0, pose.legL, P.thigh, P.shin);
  const [kneeR0, footR0] = limb(hip0, pose.legR, P.thigh, P.shin);

  // Ground lock: the lowest foot touches y = 0 (minus lift).
  const drop = Math.max(footL0.y, footR0.y);
  const off = { x: 0, y: -drop - pose.lift };
  const sh = (p: Pt): Pt => ({ x: p.x + off.x, y: p.y + off.y });
  const hip = sh(hip0);

  // dir(180 - lean) points up, tilted toward screen-right for positive lean.
  const torso = P.torso + breathe * breatheHU;
  const neck = step(hip, 180 - pose.lean, torso);
  const shoulder = step(hip, 180 - pose.lean, torso - P.shoulderDrop);
  const headAngle = pose.lean + pose.headTilt;
  const headCenter = step(neck, 180 - headAngle, P.neck + P.head / 2);

  // Arms follow half the lean so leaning doesn't swing them wildly.
  const [elbowL, handL] = limb(shoulder, pose.armL, P.upperArm, P.forearm, pose.lean * 0.5);
  const [elbowR, handR] = limb(shoulder, pose.armR, P.upperArm, P.forearm, pose.lean * 0.5);

  return {
    hip, neck, shoulder, headCenter, headAngle,
    elbowL, handL, elbowR, handR,
    kneeL: sh(kneeL0), footL: sh(footL0), kneeR: sh(kneeR0), footR: sh(footR0),
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const ll = (x: LimbAngles, y: LimbAngles): LimbAngles => ({ a: l(x.a, y.a), b: l(x.b, y.b) });
  return {
    lean: l(a.lean, b.lean), headTilt: l(a.headTilt, b.headTilt),
    armL: ll(a.armL, b.armL), armR: ll(a.armR, b.armR), legL: ll(a.legL, b.legL), legR: ll(a.legR, b.legR),
    lift: l(a.lift, b.lift), look: l(a.look, b.look),
  };
}
