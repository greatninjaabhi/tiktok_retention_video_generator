import { describe, expect, it } from 'vitest';
import { createRng, hashString } from '../render/rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('vid-1|head'), b = createRng('vid-1|head');
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
    expect(createRng('vid-2|head').next()).not.toEqual(createRng('vid-1|head').next());
  });
  it('stays in range', () => {
    const r = createRng('x');
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });
  it('noise is bounded and continuous', () => {
    const r = createRng('n');
    for (let x = 0; x < 20; x += 0.01) {
      expect(Math.abs(r.noise(x))).toBeLessThanOrEqual(1);
      expect(Math.abs(r.noise(x + 0.001) - r.noise(x))).toBeLessThan(0.01);
    }
  });
  it('hash is stable', () => expect(hashString('abc')).toBe(440920331));
});
