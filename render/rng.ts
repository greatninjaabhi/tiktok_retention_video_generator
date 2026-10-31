/**
 * Deterministic randomness (brief §1.3): every wobble, boil and blink is derived
 * from a string seed (video id + element id + boil frame), so re-renders are identical.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Smooth 1D value noise in [-1, 1], continuous in x. */
  noise(x: number): number;
};

/** mulberry32 PRNG seeded from a string. */
export function createRng(seed: string): Rng {
  let a = hashString(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Lattice values for value noise, generated lazily but deterministically
  // from an independent hash so noise() never disturbs the next() sequence.
  const base = hashString(seed + '#noise');
  const lattice = (i: number) => {
    let h = Math.imul((i | 0) ^ base, 0x27d4eb2d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    return ((h >>> 0) / 4294967296) * 2 - 1;
  };

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    noise: (x) => {
      const i = Math.floor(x);
      const f = x - i;
      const s = f * f * (3 - 2 * f); // smoothstep
      return lattice(i) * (1 - s) + lattice(i + 1) * s;
    },
  };
}
