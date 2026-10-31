/** Draws a rigged character with the shared pen. Pure function of (character, state, placement). */
import { Pen } from '../draw/pen';
import { type Pt, type Transform, IDENTITY, applyTransform, compose, deg, pt } from '../draw/geometry';
import { HU } from '../tokens';
import { solve, type Joints } from './rig';
import type { CharacterDef, ExpressionName, MouthShape, MouthStyle, Pose } from './types';

export type CharacterState = {
  pose: Pose;
  expression: ExpressionName;
  /** Talking mouth shape; null = the expression's resting mouth. */
  mouth: MouthShape | null;
  blink: boolean;
  /** -1…1 breathing phase. */
  breathe: number;
  breatheHU: number;
  /** Tie swing in degrees (secondary motion). */
  tieFlapDeg: number;
};

/** Where the character stands (ground point, px). `rotDeg` spins/tilts the whole body around the hips. */
export type Placement = { x: number; y: number; flipX?: boolean; rotDeg?: number };

export type Anchors = { handL: Pt; handR: Pt; hold: Pt; headTop: Pt; joints: Joints };

export function drawCharacter(pen: Pen, def: CharacterDef, s: CharacterState, place: Placement): Anchors {
  const P = def.proportions;
  const j = solve(s.pose, P, s.breathe, s.breatheHU);
  const px = (p: Pt): Pt => pt(p.x * HU, p.y * HU);

  // ground point → hips (pivot) → rotate → back down: the body turns around its hips, not its feet.
  const pivotY = j.hip.y * HU;
  const t: Transform = compose(
    compose({ ...IDENTITY, x: place.x, y: place.y + pivotY, rot: deg(place.rotDeg ?? 0) }, { ...IDENTITY, y: -pivotY }),
    { ...IDENTITY, flipX: place.flipX ?? false },
  );

  pen.at(t, () =>
    pen.element(def.id, () => {
      const footTip = (foot: Pt, side: -1 | 1): Pt => pt(foot.x + side * P.foot, foot.y);
      pen.element('legL', () => pen.line([j.hip, j.kneeL, j.footL, footTip(j.footL, -1)].map(px)));
      pen.element('legR', () => pen.line([j.hip, j.kneeR, j.footR, footTip(j.footR, 1)].map(px)));

      const headBottom = pt(
        j.headCenter.x - Math.sin(deg(j.headAngle)) * (P.head / 2),
        j.headCenter.y + Math.cos(deg(j.headAngle)) * (P.head / 2),
      );
      pen.element('torso', () => pen.line([j.hip, j.neck, headBottom].map(px), { overshoot: false }));
      // Arms go behind the tie so it stays a clean, readable shape (the signature trait).
      pen.element('armL', () => pen.line([j.shoulder, j.elbowL, j.handL].map(px)));
      pen.element('armR', () => pen.line([j.shoulder, j.elbowR, j.handR].map(px)));
      pen.element('tie', () => drawTie(pen, j, s));
      drawHead(pen, def, s, px(j.headCenter), j.headAngle);
    }),
  );

  const world = (p: Pt): Pt => applyTransform(t, pt(p.x * HU, p.y * HU));
  const hold = pt((j.handL.x + j.handR.x) / 2, Math.max(j.handL.y, j.handR.y) + 0.05);
  return {
    handL: world(j.handL), handR: world(j.handR), hold: world(hold),
    headTop: world(pt(j.headCenter.x, j.headCenter.y - P.head / 2)), joints: j,
  };
}

/** Head + face at a px center (also used alone for close-ups and the contact sheet). */
export function drawHead(pen: Pen, def: CharacterDef, s: CharacterState, center: Pt, angleDeg = 0): void {
  const R = (def.proportions.head / 2) * HU;
  pen.element('head', () => {
    pen.circle(center.x, center.y, R, { fill: 'white' });
    pen.at({ x: center.x, y: center.y, rot: deg(angleDeg) }, () => drawFace(pen, def, s, R));
  });
}

/** The signature necktie: knot just under the neck, blade hanging along the torso, swings on motion. */
function drawTie(pen: Pen, j: Joints, s: CharacterState): void {
  const lean = s.pose.lean;
  const knot = pt(j.neck.x - Math.sin(deg(lean)) * 0.14, j.neck.y + Math.cos(deg(lean)) * 0.14);
  const h = (x: number, y: number) => pt(x * HU, y * HU);
  pen.at({ x: knot.x * HU, y: knot.y * HU, rot: deg(lean - s.tieFlapDeg) }, () => {
    pen.polygon([h(-0.09, 0.1), h(0.09, 0.1), h(0.2, 0.86), h(0, 1.06), h(-0.2, 0.86)], { fill: 'signature', width: 'fine' });
    pen.polygon([h(-0.15, -0.08), h(0.15, -0.08), h(0.09, 0.12), h(-0.09, 0.12)], { fill: 'signature', width: 'fine' });
  });
}

function drawFace(pen: Pen, def: CharacterDef, s: CharacterState, R: number): void {
  const ex = def.expressions[s.expression];
  const look = s.pose.look;
  const eyeY = -0.08 * R;
  const glance = (ex.glance ?? 0) * 0.12 * R;

  for (const side of [-1, 1] as const) {
    const x = side * 0.36 * R + look * 0.25 * R;
    pen.element(side < 0 ? 'eyeL' : 'eyeR', () => {
      const style = s.blink ? 'closed' : ex.eyes;
      switch (style) {
        case 'dot':
          pen.dot(x + glance, eyeY, 0.13 * R);
          break;
        case 'wide':
          pen.circle(x, eyeY, 0.25 * R, { fill: 'white', width: 'fine' });
          pen.dot(x + glance, eyeY, 0.1 * R);
          break;
        case 'happy':
          pen.line([pt(x - 0.16 * R, eyeY + 0.06 * R), pt(x, eyeY - 0.12 * R), pt(x + 0.16 * R, eyeY + 0.06 * R)], { width: 'fine', overshoot: false });
          break;
        case 'lidded':
          pen.dot(x + glance, eyeY + 0.04 * R, 0.12 * R);
          pen.line([pt(x - 0.2 * R, eyeY - 0.06 * R), pt(x + 0.2 * R, eyeY - 0.06 * R)], { width: 'fine', overshoot: false });
          break;
        case 'closed':
          pen.line([pt(x - 0.17 * R, eyeY), pt(x + 0.17 * R, eyeY)], { width: 'fine', overshoot: false });
          break;
      }
      if (ex.brows) {
        const ang = side < 0 ? ex.brows.l : -ex.brows.r;
        const by = eyeY - 0.36 * R - ex.brows.raise * 2 * R;
        const a = deg(ang), half = 0.19 * R;
        pen.line([pt(x - Math.cos(a) * half, by - Math.sin(a) * half), pt(x + Math.cos(a) * half, by + Math.sin(a) * half)], { width: 'fine', overshoot: false });
      }
    });
  }

  pen.element('mouth', () => drawMouth(pen, s.mouth ?? ex.mouth, look * 0.2 * R, 0.42 * R, R));
}

function drawMouth(pen: Pen, m: MouthStyle, x: number, y: number, R: number): void {
  const P = (dx: number, dy: number) => pt(x + dx * R, y + dy * R);
  const line = (pts: Pt[]) => pen.line(pts, { width: 'fine', overshoot: false });
  const hole = (rx: number, ry: number) => pen.ellipse(x, y, rx * R, ry * R, { fill: 'ink', width: 'fine' });
  switch (m) {
    case 'closed': return line([P(-0.18, 0), P(0.18, 0)]);
    case 'flat': return line([P(-0.2, 0), P(0.2, 0.01)]);
    case 'small': return hole(0.13, 0.08);
    case 'open': return hole(0.2, 0.15);
    case 'round': return hole(0.13, 0.19);
    case 'smile': return line([P(-0.26, -0.04), P(0, 0.12), P(0.26, -0.04)]);
    case 'smirk': return line([P(-0.2, 0.04), P(0.06, 0.06), P(0.26, -0.08)]);
    case 'frown': return line([P(-0.22, 0.1), P(0, -0.04), P(0.22, 0.1)]);
    case 'wide':
    case 'grin':
      return pen.polygon([P(-0.3, -0.06), P(0.3, -0.06), P(0.2, 0.14), P(0, 0.22), P(-0.2, 0.14)], { fill: 'ink', width: 'fine' });
  }
}
