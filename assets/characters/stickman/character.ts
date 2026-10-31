/**
 * mascot_v1: placeholder name until the owner picks one (brief §12).
 * Signature trait: a bold blue necktie (`signature` color), always the same.
 * This file is DATA only: proportions, poses (joint angles), expressions, mouth shapes.
 * Drawing happens in render/character/draw.ts with the shared pen.
 */
import type { CharacterDef } from '../../../render/character/types';

export const POSE_NAMES = ['idle', 'point_up', 'present', 'shocked', 'thinking', 'shrug', 'celebrate', 'hold'] as const;
export type PoseName = (typeof POSE_NAMES)[number];

const legs = { legL: { a: -11, b: 2 }, legR: { a: 11, b: -2 } };

export const stickman: CharacterDef<PoseName> = {
  id: 'mascot_v1',
  version: 1,
  proportions: {
    head: 1, neck: 0.18, torso: 1.75, shoulderDrop: 0.22,
    upperArm: 0.95, forearm: 0.9, thigh: 1.1, shin: 1.05, foot: 0.24,
  },
  poses: {
    idle: {
      lean: 0, headTilt: 0, lift: 0, look: 0, expression: 'neutral', ...legs,
      armL: { a: -14, b: -8 }, armR: { a: 14, b: 8 },
    },
    point_up: {
      // points up-right at the top panel, other hand on hip
      lean: 4, headTilt: -10, lift: 0, look: 0.45, expression: 'excited', ...legs,
      armL: { a: -42, b: 105 }, armR: { a: 148, b: 6 },
    },
    present: {
      // "here's the thing": open arm out to the side
      lean: -3, headTilt: 4, lift: 0, look: 0.35, expression: 'smug', ...legs,
      armL: { a: -14, b: -8 }, armR: { a: 72, b: 28 },
    },
    shocked: {
      lean: -5, headTilt: -4, lift: 0, look: 0, expression: 'shocked',
      legL: { a: -16, b: 4 }, legR: { a: 16, b: -4 },
      armL: { a: -128, b: -40 }, armR: { a: 128, b: 40 },
    },
    thinking: {
      // hand to chin (elbow out), other hand on hip
      lean: 2, headTilt: 9, lift: 0, look: -0.35, expression: 'thinking', ...legs,
      armL: { a: -42, b: 105 }, armR: { a: 78, b: 155 },
    },
    shrug: {
      lean: 0, headTilt: 10, lift: 0, look: 0.15, expression: 'side_eye', ...legs,
      armL: { a: -58, b: -88 }, armR: { a: 58, b: 88 },
    },
    celebrate: {
      lean: 0, headTilt: 0, lift: 0.22, look: 0, expression: 'excited',
      legL: { a: -20, b: 22 }, legR: { a: 20, b: -22 },
      armL: { a: -148, b: -14 }, armR: { a: 148, b: 14 },
    },
    hold: {
      // both hands in front of the belly, holding the beat's prop
      lean: 0, headTilt: 3, lift: 0, look: 0.1, expression: 'neutral', ...legs,
      armL: { a: -58, b: 116 }, armR: { a: 58, b: -116 },
    },
  },
  expressions: {
    neutral: { eyes: 'dot', brows: null, mouth: 'flat' },
    smug: { eyes: 'lidded', brows: { l: -8, r: 14, raise: 0.04 }, mouth: 'smirk' },
    shocked: { eyes: 'wide', brows: { l: 10, r: 10, raise: 0.1 }, mouth: 'round' },
    sad: { eyes: 'dot', brows: { l: -18, r: -18, raise: 0.03 }, mouth: 'frown' },
    thinking: { eyes: 'dot', brows: { l: 0, r: 16, raise: 0.05 }, mouth: 'flat', glance: 0.6 },
    excited: { eyes: 'happy', brows: { l: 6, r: 6, raise: 0.08 }, mouth: 'grin' },
    side_eye: { eyes: 'lidded', brows: { l: -4, r: -4, raise: 0 }, mouth: 'flat', glance: 0.9 },
  },
  mouthByOpenness: [
    { upTo: 0.12, shape: 'closed' },
    { upTo: 0.35, shape: 'small' },
    { upTo: 0.6, shape: 'open' },
    { upTo: 0.8, shape: 'round' },
    { upTo: 1.01, shape: 'wide' },
  ],
};
