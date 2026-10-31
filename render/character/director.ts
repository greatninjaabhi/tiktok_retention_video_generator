/**
 * Auto-blocking: picks where the character goes on each beat when the beat sheet doesn't say.
 * Deterministic per video seed. Rules: start off-center (room for a prop), never "move" to the
 * mark you're on, change at least the tilt when not moving, spin at most once per video and
 * only on a celebration beat. The variety helps the R7 cadence (brief §2.3) and §5.1 originality.
 */
import { createRng, type Rng } from '../rng';
import { tokens } from '../tokens';
import type { MoveKind, StageCue } from './blocking';

export type BeatCue = { frame: number; pose: string };

const S = tokens.stage;
const MARKS = tokens.layout.stageMarksX;

function pickWeighted(rng: Rng, weights: Record<MoveKind, number>): MoveKind {
  const entries = Object.entries(weights) as [MoveKind, number][];
  let r = rng.next() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) if ((r -= w) < 0) return k;
  return entries[0]![0];
}

export function autoBlock(beats: BeatCue[], seed: string, spinPoses: string[] = ['celebrate']): StageCue[] {
  const rng = createRng(seed + '|director');
  const marks = [MARKS.left, MARKS.center, MARKS.right];
  let x = rng.next() < 0.5 ? MARKS.left : MARKS.right;
  let tilt = 0;
  let spun = false;
  return beats.map((b, i) => {
    if (i === 0) return { frame: b.frame, x, move: 'walk', tiltDeg: 0 };
    const moves = rng.next() < S.moveProbability;
    const move = pickWeighted(rng, S.moveWeights);
    if (moves) {
      const options = marks.filter((m) => m !== x);
      x = options[Math.floor(rng.next() * options.length)]!;
    }
    const tilts = S.tiltChoicesDeg.filter((t) => moves || t !== tilt);
    tilt = tilts[Math.floor(rng.next() * tilts.length)]!;
    const spin = !spun && spinPoses.includes(b.pose) && rng.next() < 0.8;
    if (spin) spun = true;
    return { frame: b.frame, x, move, tiltDeg: tilt, spin };
  });
}

/** Props go on the open side of the stage, away from the character. */
export function propXFor(charX: number): number {
  return charX < tokens.canvas.width / 2 ? 800 : 270;
}
