/**
 * Procedural vector rig (brief §1.2 option 1). A character is pure data:
 * proportions in head units, poses as joint-angle sets, expressions and mouth shapes.
 *
 * Angle convention (degrees, screen space, y down):
 *   0 = pointing straight down, +90 = pointing to screen-right, ±180 = straight up, -90 = screen-left.
 * Limbs are named by SCREEN side (L = viewer's left), not the character's side.
 */

export type LimbAngles = { a: number; b: number }; // a = upper segment (absolute, plus lean for arms), b = bend at the middle joint (relative)

export type Pose = {
  /** Torso tilt from vertical, + leans toward screen-right. */
  lean: number;
  /** Head tilt relative to torso. */
  headTilt: number;
  armL: LimbAngles;
  armR: LimbAngles;
  legL: LimbAngles;
  legR: LimbAngles;
  /** Lift off the ground in HU (jumps). Negative = crouch. */
  lift: number;
  /** Where the face looks: -1 screen-left … 1 screen-right. */
  look: number;
};

export type ExpressionName = 'neutral' | 'smug' | 'shocked' | 'sad' | 'thinking' | 'excited' | 'side_eye';
export type MouthShape = 'closed' | 'small' | 'open' | 'wide' | 'round';

export type EyeStyle = 'dot' | 'wide' | 'happy' | 'lidded' | 'closed';
export type MouthStyle = MouthShape | 'smile' | 'smirk' | 'frown' | 'flat' | 'grin';

export type Expression = {
  eyes: EyeStyle;
  /** Brow angles in degrees (screen-left, screen-right); + raises that brow's OUTER end. raise = lift in HU. null = no brows. */
  brows: { l: number; r: number; raise: number } | null;
  /** Resting mouth when not talking. */
  mouth: MouthStyle;
  /** Extra sideways shift of the pupils (side-eye), -1…1. */
  glance?: number;
};

export type Proportions = {
  head: number; // diameter (= 1 HU by definition)
  neck: number;
  torso: number;
  shoulderDrop: number; // shoulders sit this far below the top of the torso
  upperArm: number;
  forearm: number;
  thigh: number;
  shin: number;
  foot: number;
};

export type CharacterDef<P extends string = string> = {
  id: string;
  version: number;
  proportions: Proportions;
  poses: Record<P, Pose & { expression: ExpressionName }>;
  expressions: Record<ExpressionName, Expression>;
  /** Talking mouth shapes keyed by openness (0 = closed … 1 = widest). */
  mouthByOpenness: { upTo: number; shape: MouthShape }[];
};
