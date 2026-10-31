/**
 * The one shared drawing engine (brief §1.3). The stickman, every prop, and later
 * the panels and covers are drawn ONLY through these primitives, so they all share
 * the same hand: same stroke widths, same wobble, same palette.
 *
 * Output is plain data (a list of Items); `svg.ts` turns it into SVG, and the
 * renderer will turn the same data into React elements.
 */
import { createRng, type Rng } from '../rng';
import { tokens, type ColorName, type StrokeWidthName, type TextSizeName, type FontRole } from '../tokens';
import {
  type Pt, type BBox, type Transform, IDENTITY,
  add, sub, scale, len, applyTransform, compose, bboxOf, resample, smoothPath, linePath,
  scanline, rotatePt, deg, ellipsePoly, rectPoly,
} from './geometry';

export type StrokeItem = {
  kind: 'stroke'; element: string; d: string; color: ColorName; width: StrokeWidthName; opacity: number; bbox: BBox;
};
export type FillItem = { kind: 'fill'; element: string; d: string; color: ColorName; bbox: BBox };
export type TextItem = {
  kind: 'text'; element: string; text: string; x: number; y: number; size: TextSizeName; font: FontRole;
  color: ColorName; outline: ColorName | null; rotateDeg: number; bbox: BBox;
};
export type Item = StrokeItem | FillItem | TextItem;

export type LineStyle = { color?: ColorName; width?: StrokeWidthName; opacity?: number };
export type ShapeStyle = LineStyle & { fill?: ColorName | null; outline?: boolean };

const W = tokens.wobble;

export type PenOptions = {
  /** Usually the video id. Same seed + same calls = identical drawing. */
  seed: string;
  /** Which boil frame we're on (frame / (fps / boil.fps)). Changes the wobble, not the shape. */
  boilFrame?: number;
};

export class Pen {
  readonly items: Item[] = [];
  private readonly seed: string;
  private readonly boilFrame: number;
  private transform: Transform = IDENTITY;
  private elementPath: string[] = [];
  private counters = new Map<string, number>();

  constructor(opts: PenOptions) {
    this.seed = opts.seed;
    this.boilFrame = opts.boilFrame ?? 0;
  }

  // ---------------------------------------------------------------- scoping

  /** Name a group of marks. Seeds are derived from the element path, so adding a mark
   *  in one element never changes the wobble of another. */
  element<T>(id: string, fn: () => T): T {
    this.elementPath.push(id);
    try {
      return fn();
    } finally {
      this.elementPath.pop();
    }
  }

  /** Draw in a local coordinate frame (translate / rotate in radians / mirror). */
  at<T>(t: Partial<Transform>, fn: () => T): T {
    const prev = this.transform;
    this.transform = compose(prev, { ...IDENTITY, ...t });
    try {
      return fn();
    } finally {
      this.transform = prev;
    }
  }

  private get elementId(): string {
    return this.elementPath.join('/') || 'root';
  }

  private rng(): Rng {
    const id = this.elementId;
    const n = this.counters.get(id) ?? 0;
    this.counters.set(id, n + 1);
    return createRng(`${this.seed}|${id}|${n}|b${this.boilFrame}`);
  }

  private world(points: Pt[]): Pt[] {
    return points.map((p) => applyTransform(this.transform, p));
  }

  // ------------------------------------------------------------- primitives

  /** Open wobbly line through the points (a limb, an arrow, a crease). */
  line(points: Pt[], style: LineStyle & { overshoot?: boolean } = {}): void {
    const rng = this.rng();
    let pts = this.world(points);
    if (style.overshoot !== false) pts = extendEnds(pts, rng);
    const wob = wobble(pts, rng, ampFor(lengthOf(pts)));
    this.pushStroke(wob, false, style);
  }

  /** Wobbly ellipse drawn like a quick hand circle: random start, slight overlap. */
  ellipse(cx: number, cy: number, rx: number, ry: number, style: ShapeStyle = {}): void {
    const rng = this.rng();
    const r = Math.max(rx, ry);
    const amp = W.amplitudePx * Math.min(1, r / 40);
    if (style.fill) this.pushFill(this.world(jitterPoly(ellipsePoly(cx, cy, rx, ry, 28), rng, amp)), style.fill, rng);
    if (style.outline === false) return;
    const start = rng.range(0, Math.PI * 2);
    const sweep = Math.PI * 2 + W.circleOverlapRad * rng.range(0.5, 1);
    const ex = rx * (1 + rng.range(-0.03, 0.03));
    const ey = ry * (1 + rng.range(-0.03, 0.03));
    const steps = Math.max(10, Math.ceil((sweep * r) / W.segmentPx));
    const pts: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = start + (sweep * i) / steps;
      const k = 1 + (amp / r) * rng.noise((a * r) / W.wavelengthPx);
      // spiral in very slightly so the overlap reads as one stroke, not a closed ring
      const spiral = 1 - 0.04 * (i / steps) * (amp / Math.max(amp, 1));
      pts.push({ x: cx + Math.cos(a) * ex * k * spiral, y: cy + Math.sin(a) * ey * k * spiral });
    }
    this.pushStroke(this.world(pts), false, style);
  }

  circle(cx: number, cy: number, r: number, style: ShapeStyle = {}): void {
    this.ellipse(cx, cy, r, r, style);
  }

  /** Rectangle as four separate edges with small corner overshoots (sketch look). */
  rect(x: number, y: number, w: number, h: number, style: ShapeStyle = {}): void {
    const poly = rectPoly(x, y, w, h);
    if (style.fill) {
      const rng = this.rng();
      this.pushFill(this.world(jitterPoly(poly, rng, W.amplitudePx)), style.fill, rng);
    }
    if (style.outline === false) return;
    for (let i = 0; i < 4; i++) this.line([poly[i]!, poly[(i + 1) % 4]!], style);
  }

  /** Closed shape drawn as one continuous stroke that slightly overlaps its start. */
  polygon(points: Pt[], style: ShapeStyle = {}): void {
    const rng = this.rng();
    if (style.fill) this.pushFill(this.world(jitterPoly(points, rng, W.amplitudePx)), style.fill, rng);
    if (style.outline === false) return;
    const closed = [...points, points[0]!];
    const first = points[0]!, second = points[1] ?? first;
    closed.push(add(first, scale(sub(second, first), rng.range(0.08, 0.2))));
    const pts = this.world(closed);
    this.pushStroke(wobble(pts, rng, ampFor(lengthOf(pts))), false, style);
  }

  /** Small solid blob (eyes, buttons, the dot on a coin). */
  dot(cx: number, cy: number, r: number, color: ColorName = 'ink'): void {
    const rng = this.rng();
    const poly = jitterPoly(ellipsePoly(cx, cy, r, r * rng.range(0.9, 1.1), 16), rng, r * 0.1);
    const w = this.world(poly);
    this.items.push({ kind: 'fill', element: this.elementId, d: smoothPath(w, true), color, bbox: bboxOf(w) });
  }

  /** Back-and-forth scribble texture clipped to a polygon (marker shading). */
  scribbleFill(poly: Pt[], color: ColorName, opts: { spacing?: number; angleDeg?: number; width?: StrokeWidthName } = {}): void {
    const rng = this.rng();
    const spacing = opts.spacing ?? tokens.texture.scribbleSpacingPx;
    const angle = deg(opts.angleDeg ?? tokens.texture.scribbleAngleDeg);
    const spans = spansOf(poly, angle, spacing, rng);
    if (spans.length === 0) return;
    const zig: Pt[] = [];
    spans.forEach(([a, b], i) => (i % 2 === 0 ? zig.push(a, b) : zig.push(b, a)));
    const w = this.world(zig);
    this.items.push({
      kind: 'stroke', element: this.elementId, d: linePath(w), color,
      width: opts.width ?? 'fine', opacity: 1, bbox: bboxOf(w),
    });
  }

  /** Parallel hatch lines clipped to a polygon (shadows, roofs, texture). */
  hatch(poly: Pt[], color: ColorName = 'ink', opts: { spacing?: number; angleDeg?: number } = {}): void {
    const rng = this.rng();
    const spacing = opts.spacing ?? tokens.texture.hatchSpacingPx;
    const angle = deg(opts.angleDeg ?? tokens.texture.hatchAngleDeg);
    const spans = spansOf(poly, angle, spacing, rng);
    if (spans.length === 0) return;
    const all: Pt[] = [];
    const d = spans
      .map(([a, b]) => {
        const [wa, wb] = this.world([a, b]) as [Pt, Pt];
        all.push(wa, wb);
        return linePath([wa, wb]);
      })
      .join('');
    this.items.push({ kind: 'stroke', element: this.elementId, d, color, width: 'fine', opacity: 1, bbox: bboxOf(all) });
  }

  /** Text in a house font, nudged by a tiny random tilt so it sits in the doodle. */
  label(text: string, x: number, y: number, opts: { size?: TextSizeName; color?: ColorName; font?: FontRole; outline?: ColorName | null } = {}): void {
    const rng = this.rng();
    const size = opts.size ?? 'medium';
    const px = tokens.text.sizesPx[size];
    const p = applyTransform(this.transform, { x, y });
    const rot = (this.transform.rot * 180) / Math.PI + rng.range(-1, 1) * tokens.text.maxRotateDeg;
    const halfW = text.length * px * 0.27;
    this.items.push({
      kind: 'text', element: this.elementId, text, x: round(p.x), y: round(p.y), size,
      font: opts.font ?? 'title', color: opts.color ?? 'ink', outline: opts.outline ?? null,
      rotateDeg: round(rot), bbox: { minX: p.x - halfW, maxX: p.x + halfW, minY: p.y - px / 2, maxY: p.y + px / 2 },
    });
  }

  // ---------------------------------------------------------------- output

  private pushStroke(points: Pt[], closed: boolean, style: LineStyle): void {
    this.items.push({
      kind: 'stroke', element: this.elementId, d: smoothPath(points, closed),
      color: style.color ?? 'ink', width: style.width ?? 'main', opacity: style.opacity ?? 1, bbox: bboxOf(points),
    });
  }

  /** Flat color fill, slightly mis-registered from its outline like a marker fill. */
  private pushFill(worldPoly: Pt[], color: ColorName, rng: Rng): void {
    const a = rng.range(0, Math.PI * 2);
    const off = { x: Math.cos(a) * W.fillOffsetPx, y: Math.sin(a) * W.fillOffsetPx };
    const moved = worldPoly.map((p) => add(p, off));
    this.items.push({ kind: 'fill', element: this.elementId, d: smoothPath(moved, true), color, bbox: bboxOf(moved) });
  }
}

// ------------------------------------------------------------------ helpers

const round = (v: number) => Math.round(v * 100) / 100;

function lengthOf(pts: Pt[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += len(sub(pts[i]!, pts[i - 1]!));
  return t;
}

/** Short lines get less wobble so tiny marks don't look shaky. */
function ampFor(length: number): number {
  return W.amplitudePx * Math.min(1, Math.max(0.3, length / 120));
}

function extendEnds(pts: Pt[], rng: Rng): Pt[] {
  if (pts.length < 2) return pts;
  const ext = (from: Pt, to: Pt) => {
    const d = sub(to, from);
    const L = len(d) || 1;
    return add(to, scale(d, (rng.range(0, 1) * W.overshootPx) / L));
  };
  return [ext(pts[1]!, pts[0]!), ...pts.slice(1, -1), ext(pts[pts.length - 2]!, pts[pts.length - 1]!)];
}

function wobble(pts: Pt[], rng: Rng, amp: number): Pt[] {
  const phase = rng.range(0, 100);
  return resample(pts, W.segmentPx).map(({ p, s, n }) => {
    const o = amp * rng.noise(phase + s / W.wavelengthPx);
    return { x: p.x + n.x * o, y: p.y + n.y * o };
  });
}

/** Densify a closed polygon and wobble it along its normals, so smoothing keeps the shape. */
function jitterPoly(poly: Pt[], rng: Rng, amp: number): Pt[] {
  const phase = rng.range(0, 100);
  let perimeter = 0;
  for (let i = 0; i < poly.length; i++) perimeter += len(sub(poly[(i + 1) % poly.length]!, poly[i]!));
  const loop = resample([...poly, poly[0]!], Math.min(W.segmentPx, perimeter / 16));
  loop.pop();
  return loop.map(({ p, s, n }) => {
    const o = amp * rng.noise(phase + s / W.wavelengthPx);
    return { x: p.x + n.x * o, y: p.y + n.y * o };
  });
}

/** Clipped scan spans across a polygon at an angle, with slight hand jitter and inset. */
function spansOf(poly: Pt[], angle: number, spacing: number, rng: Rng): [Pt, Pt][] {
  const rotated = poly.map((p) => rotatePt(p, -angle));
  const ys = rotated.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spans: [Pt, Pt][] = [];
  for (let y = minY + spacing * 0.6; y < maxY - spacing * 0.3; y += spacing) {
    const yy = y + rng.range(-1, 1) * spacing * 0.15;
    const xs = scanline(rotated, yy);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const inset = Math.min(4, (xs[i + 1]! - xs[i]!) * 0.1);
      const a = rotatePt({ x: xs[i]! + inset + rng.range(-1.5, 1.5), y: yy }, angle);
      const b = rotatePt({ x: xs[i + 1]! - inset + rng.range(-1.5, 1.5), y: yy + rng.range(-1, 1) }, angle);
      spans.push([a, b]);
    }
  }
  return spans;
}
