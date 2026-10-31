export type Pt = { x: number; y: number };

export const pt = (x: number, y: number): Pt => ({ x, y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const len = (a: Pt): number => Math.hypot(a.x, a.y);
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const deg = (d: number): number => (d * Math.PI) / 180;

/** Rigid 2D transform: optional mirror on x, then rotate, then translate. */
export type Transform = { x: number; y: number; rot: number; flipX: boolean };
export const IDENTITY: Transform = { x: 0, y: 0, rot: 0, flipX: false };

export function applyTransform(t: Transform, p: Pt): Pt {
  const px = t.flipX ? -p.x : p.x;
  const c = Math.cos(t.rot);
  const s = Math.sin(t.rot);
  return { x: t.x + px * c - p.y * s, y: t.y + px * s + p.y * c };
}

/** Compose: result(p) = outer(inner(p)). */
export function compose(outer: Transform, inner: Transform): Transform {
  const origin = applyTransform(outer, { x: inner.x, y: inner.y });
  const innerRot = outer.flipX ? -inner.rot : inner.rot;
  return { x: origin.x, y: origin.y, rot: outer.rot + innerRot, flipX: outer.flipX !== inner.flipX };
}

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export function bboxOf(points: Pt[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function unionBBox(boxes: BBox[]): BBox {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

export function polylineLength(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += len(sub(points[i]!, points[i - 1]!));
  return total;
}

/** Resample a polyline at (approximately) even arc-length spacing. Keeps both ends. */
export function resample(points: Pt[], spacing: number): { p: Pt; s: number; n: Pt }[] {
  const total = polylineLength(points);
  const count = Math.max(2, Math.ceil(total / spacing) + 1);
  const out: { p: Pt; s: number; n: Pt }[] = [];
  let seg = 0;
  let segStart = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (seg < points.length - 2 && segStart + len(sub(points[seg + 1]!, points[seg]!)) < target) {
      segStart += len(sub(points[seg + 1]!, points[seg]!));
      seg++;
    }
    const a = points[seg]!;
    const b = points[seg + 1] ?? a;
    const L = len(sub(b, a)) || 1;
    const t = Math.min(1, Math.max(0, (target - segStart) / L));
    const d = sub(b, a);
    out.push({ p: lerpPt(a, b, t), s: target, n: { x: -d.y / L, y: d.x / L } });
  }
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(points: Pt[], closed = false): string {
  if (points.length < 2) return '';
  const P = (i: number): Pt => {
    if (closed) return points[(i + points.length) % points.length]!;
    return points[Math.max(0, Math.min(points.length - 1, i))]!;
  };
  const n = closed ? points.length : points.length - 1;
  let d = `M${r2(P(0).x)} ${r2(P(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return closed ? d + 'Z' : d;
}

/** Straight segments path (used for texture lines that are already wobbled). */
export function linePath(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x)} ${r2(p.y)}`).join('');
}

/** Intersections of a horizontal scanline y with a closed polygon, sorted by x. */
export function scanline(poly: Pt[], y: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  return xs.sort((p, q) => p - q);
}

export function rotatePt(p: Pt, angle: number, about: Pt = { x: 0, y: 0 }): Pt {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = p.x - about.x, dy = p.y - about.y;
  return { x: about.x + dx * c - dy * s, y: about.y + dx * s + dy * c };
}

/** Ellipse outline as a polygon (for fills, clipping and texture). */
export function ellipsePoly(cx: number, cy: number, rx: number, ry: number, steps = 32): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}

export function rectPoly(x: number, y: number, w: number, h: number): Pt[] {
  return [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
}
