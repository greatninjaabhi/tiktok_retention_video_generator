/**
 * Turns a timeline of pose cues into a per-frame CharacterState (brief §1.2 "feel animated").
 * Everything is a pure function of (frame, timeline, seed), so any frame can be rendered alone.
 */
import { createRng } from '../rng';
import { tokens } from '../tokens';
import { lerpPose } from './rig';
import type { CharacterState } from './draw';
import type { CharacterDef, ExpressionName, MouthShape, Pose } from './types';

export type PoseCue<P extends string> = { frame: number; pose: P; expression?: ExpressionName };

export type Timeline<P extends string> = {
  fps: number;
  cues: PoseCue<P>[]; // sorted by frame; the first cue should be at frame 0
  /** Mouth openness 0…1 at a frame (from audio volume or visemes). Omit = not talking. */
  talk?: (frame: number) => number;
};

const M = tokens.motion;

/** Ease-out with overshoot and settle ("backOut"). */
export function backOut(t: number, overshoot: number): number {
  const u = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (overshoot + 1) * u * u * u + overshoot * u * u;
}

export function boilFrame(frame: number, fps: number): number {
  return Math.floor((frame * tokens.boil.fps) / fps);
}

function poseAt<P extends string>(def: CharacterDef<P>, cues: PoseCue<P>[], frame: number): Pose {
  let idx = -1;
  for (let i = 0; i < cues.length; i++) if (cues[i]!.frame <= frame) idx = i;
  if (idx < 0) return def.poses[cues[0]!.pose];
  const cue = cues[idx]!;
  const target = def.poses[cue.pose];
  if (idx === 0) return target;
  // Start from wherever the previous transition actually was (handles cues closer than the duration).
  const from = poseAt(def, cues.slice(0, idx), cue.frame);
  const t = (frame - cue.frame) / M.pose.durationFrames;
  return t >= 1 ? target : lerpPose(from, target, backOut(t, M.pose.overshoot));
}

function expressionAt<P extends string>(def: CharacterDef<P>, cues: PoseCue<P>[], frame: number): ExpressionName {
  let e: ExpressionName = def.poses[cues[0]!.pose].expression;
  for (const c of cues) if (c.frame <= frame) e = c.expression ?? def.poses[c.pose].expression;
  return e;
}

/** Deterministic blink schedule: irregular gaps between blink.minGapSec and maxGapSec. */
export function isBlinking(seed: string, frame: number, fps: number): boolean {
  const rng = createRng(seed + '|blink');
  let t = rng.range(0.5, 1.5) * fps;
  while (t <= frame) {
    if (frame < t + M.blink.durationFrames) return true;
    t += rng.range(M.blink.minGapSec, M.blink.maxGapSec) * fps;
  }
  return false;
}

export function mouthFor(def: CharacterDef, openness: number): MouthShape {
  for (const m of def.mouthByOpenness) if (openness < m.upTo) return m.shape;
  return def.mouthByOpenness[def.mouthByOpenness.length - 1]!.shape;
}

export function stateAt<P extends string>(def: CharacterDef<P>, tl: Timeline<P>, frame: number, seed: string): CharacterState {
  const pose = poseAt(def, tl.cues, frame);
  const prev = poseAt(def, tl.cues, Math.max(0, frame - 1));
  const sec = frame / tl.fps;

  // Secondary motion: the tie lags behind lean changes and jumps, plus a tiny idle sway.
  const velocity = (pose.lean - prev.lean) + (pose.lift - prev.lift) * 40 + (pose.armR.a - prev.armR.a) * 0.15;
  const sway = Math.sin(sec * 2 * Math.PI * 0.6) * M.tieFlap.idleSwayDeg;
  const flap = Math.max(-M.tieFlap.maxDeg, Math.min(M.tieFlap.maxDeg, velocity * M.tieFlap.gain + sway));

  const openness = tl.talk ? tl.talk(frame) : 0;
  return {
    pose,
    expression: expressionAt(def, tl.cues, frame),
    mouth: tl.talk && openness > 0.02 ? mouthFor(def, openness) : null,
    blink: isBlinking(seed, frame, tl.fps),
    breathe: Math.sin((sec / M.breathe.periodSec) * 2 * Math.PI),
    breatheHU: M.breathe.amplitudeHU,
    tieFlapDeg: flap,
  };
}
