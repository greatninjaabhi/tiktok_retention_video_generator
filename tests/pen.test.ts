import { describe, expect, it } from 'vitest';
import { Pen } from '../render/draw/pen';

const draw = (seed: string, boilFrame = 0, extra = false) => {
  const pen = new Pen({ seed, boilFrame });
  pen.element('a', () => { pen.rect(0, 0, 100, 50, { fill: 'money' }); if (extra) pen.circle(0, 0, 10); });
  pen.element('b', () => pen.line([{ x: 0, y: 0 }, { x: 200, y: 20 }]));
  return pen.items;
};

describe('pen', () => {
  it('same seed → identical drawing (re-renders are identical)', () => {
    expect(draw('v1')).toEqual(draw('v1'));
  });
  it('a new boil frame changes the wobble but not the shape', () => {
    const a = draw('v1', 0), b = draw('v1', 1);
    expect(a.map((i) => i.kind === 'text' ? '' : i.d)).not.toEqual(b.map((i) => i.kind === 'text' ? '' : i.d));
    a.forEach((it, k) => {
      expect(Math.abs(it.bbox.minX - b[k]!.bbox.minX)).toBeLessThan(10);
      expect(Math.abs(it.bbox.maxY - b[k]!.bbox.maxY)).toBeLessThan(10);
    });
  });
  it('adding a mark to one element never changes another element', () => {
    const a = draw('v1', 0, false).filter((i) => i.element === 'b');
    const b = draw('v1', 0, true).filter((i) => i.element === 'b');
    expect(a).toEqual(b);
  });
  it('transforms place marks in world space', () => {
    const pen = new Pen({ seed: 's' });
    pen.at({ x: 500, y: 300 }, () => pen.dot(0, 0, 5));
    const box = pen.items[0]!.bbox;
    expect((box.minX + box.maxX) / 2).toBeCloseTo(500, 0);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(300, 0);
  });
});
