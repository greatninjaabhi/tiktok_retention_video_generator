/**
 * Stage blocking: where the character stands and how he gets there (owner: "he should move
 * locations and sometimes rotations too"). Pure function of (cues, frame), like the pose timeline.
 */
import { tokens } from '../tokens';
import { backOut } from './animate';
import type { Pose } from './types';

export type MoveKind = 'walk' | 'slide' | 'hop';
export type StageCue = {
  frame: number;
  /** Target x on the stage, px (ground point). */
  x: number;
  move: MoveKind;
  /** Whole-body tilt to settle into, degrees. */
  tiltDeg: number;
  /** A full 360° spin on arrival (use rarely). */
  spin?: boolean;
};

export type Blocking = {
  x: number;
  rotDeg: number;
  /** Extra lift in HU (hops, walk bob). */
  liftHU: number;
  /** Walk cycle phase in radians while walking, else null. */
  walkPhase: number | null;
  /** -1 moving left, 1 moving right, 0 standing. */
  dir: -1 | 0 | 1;
};

const S = tokens.stage;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function moveFrames(dx: number, fps: number): number {
  return Math.max(S.minMoveFrames, Math.round((Math.abs(dx) / S.walkSpeedPxPerSec) * fps));
}

export function blockingAt(cues: StageCue[], frame: number, fps: number): Blocking {
  let idx = -1;
  for (let i = 0; i < cues.length; i++) if (cues[i]!.frame <= frame) idx = i;
  const first = cues[0]!;
  if (idx <= 0) return { x: first.x, rotDeg: first.tiltDeg, liftHU: 0, walkPhase: null, dir: 0 };

  const cue = cues[idx]!;
  const prev = blockingAt(cues.slice(0, idx), cue.frame, fps); // where we were when this cue started
  const since = frame - cue.frame;
  const dx = cue.x - prev.x;
  const dur = dx === 0 ? 0 : moveFrames(dx, fps);
  const t = dur === 0 ? 1 : clamp01(since / dur);
  const moving = dur > 0 && t < 1;
  const dir = (moving ? Math.sign(dx) : 0) as -1 | 0 | 1;

  let x: number, liftHU = 0, walkPhase: number | null = null;
  switch (cue.move) {
    case 'walk':
      x = prev.x + dx * easeInOut(t);
      if (moving) {
        walkPhase = (since / fps) * S.stepsPerSec * Math.PI;
        liftHU = 0.06 * Math.abs(Math.sin(walkPhase));
      }
      break;
    case 'slide':
      x = prev.x + dx * backOut(t, 1.2);
      break;
    case 'hop':
      x = prev.x + dx * easeInOut(t);
      liftHU = moving ? S.hopHeightHU * 4 * t * (1 - t) : 0;
      break;
  }

  // Tilt eases in with overshoot; slides lean into the motion; a spin adds 360° after arrival.
  const tiltT = clamp01(since / tokens.motion.pose.durationFrames);
  let rotDeg = prev.rotDeg + (cue.tiltDeg - prev.rotDeg) * backOut(tiltT, tokens.motion.pose.overshoot);
  if (cue.move === 'slide' && moving) rotDeg += -dir * 7 * Math.sin(Math.PI * t);
  if (cue.spin) {
    const st = clamp01((since - dur) / S.spinFrames);
    if (st > 0 && st < 1) rotDeg += 360 * easeInOut(st);
  }
  return { x, rotDeg, liftHU, walkPhase, dir };
}

/** Legs walk (and arms counter-swing if they're hanging) while the pose's upper body stays. */
export function applyBlocking(pose: Pose, b: Blocking): Pose {
  const out: Pose = { ...pose, lift: pose.lift + b.liftHU };
  if (b.dir !== 0) out.look = b.dir * 0.7;
  if (b.walkPhase === null) return out;
  const s = Math.sin(b.walkPhase);
  const swing = tokens.stage.walkLegSwingDeg;
  out.legL = { a: -6 + swing * s, b: 18 * Math.max(0, -s) };
  out.legR = { a: 6 - swing * s, b: -18 * Math.max(0, s) };
  const hanging = (a: number) => Math.abs(a) < 30;
  if (hanging(pose.armL.a)) out.armL = { a: pose.armL.a - 14 * s, b: pose.armL.b };
  if (hanging(pose.armR.a)) out.armR = { a: pose.armR.a - 14 * s, b: pose.armR.b };
  return out;
}

