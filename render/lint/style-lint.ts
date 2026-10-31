/**
 * Style lint (brief §1.3). Fails on anything that would make one video look different
 * from another: off-palette colors, unknown stroke widths, props off the size grid,
 * too many accents, raw SVG or hex colors in prop files, unreadable text contrast.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOR_NAMES, HU, STROKE_WIDTH_NAMES, tokens, type ColorName } from '../tokens';
import { unionBBox } from '../draw/geometry';
import { Pen, type Item } from '../draw/pen';
import type { PropDef } from '../props/api';
import { drawProp } from '../props/place';
import { contrast } from './contrast';

export type Issue = { target: string; rule: string; message: string };

const NEUTRALS: ColorName[] = ['ink', 'white', 'paper'];
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function lintItems(target: string, items: Item[]): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: string, message: string) => issues.push({ target, rule, message });
  for (const it of items) {
    if (!COLOR_NAMES.includes(it.color)) add('palette', `unknown color "${it.color}" in ${it.element}`);
    if (it.kind === 'text' && it.outline && !COLOR_NAMES.includes(it.outline)) add('palette', `unknown outline color "${it.outline}"`);
    if (it.kind === 'stroke' && !STROKE_WIDTH_NAMES.includes(it.width)) add('stroke-width', `unknown stroke width "${it.width}" in ${it.element}`);
    if (it.kind === 'text' && !(it.size in tokens.text.sizesPx)) add('text-size', `unknown text size "${it.size}"`);
    if (it.kind !== 'text' && /NaN|Infinity/.test(it.d)) add('geometry', `invalid path in ${it.element}`);
  }
  return issues;
}

export function lintProp(def: PropDef): Issue[] {
  const target = `prop:${def.name}`;
  const pen = new Pen({ seed: 'lint' });
  drawProp(pen, def, { x: 0, y: 0 });
  const issues = lintItems(target, pen.items);
  const add = (rule: string, message: string) => issues.push({ target, rule, message });
  const L = tokens.lint;

  if (pen.items.length > L.maxItemsPerProp) add('complexity', `${pen.items.length} marks > max ${L.maxItemsPerProp}`);

  const box = unionBBox(pen.items.map((i) => i.bbox));
  const hHU = (box.maxY - box.minY) / HU;
  const wHU = (box.maxX - box.minX) / HU;
  if (Math.abs(hHU - def.heightHU) > def.heightHU * L.propSizeTolerance)
    add('size-grid', `drawn height ${hHU.toFixed(2)} HU vs declared ${def.heightHU} HU (±${L.propSizeTolerance * 100}%)`);
  if (wHU > L.maxPropWidthHU) add('size-grid', `drawn width ${wHU.toFixed(2)} HU > max ${L.maxPropWidthHU} HU`);
  if (Math.abs(box.maxY) > HU * 0.1) add('origin', `prop should sit on its baseline (bottom at y=0), got ${(box.maxY / HU).toFixed(2)} HU`);

  const used = new Set<ColorName>();
  for (const it of pen.items) {
    used.add(it.color);
    if (it.kind === 'text' && it.outline) used.add(it.outline);
  }
  const accents = [...used].filter((c) => !NEUTRALS.includes(c));
  for (const c of accents) {
    if ((L.propForbiddenColors as string[]).includes(c)) add('reserved-color', `"${c}" is reserved for the character`);
    if (!def.accents.includes(c)) add('accents', `uses undeclared accent "${c}"`);
  }
  if (def.accents.length > L.maxAccentColorsPerProp) add('accents', `${def.accents.length} accents > max ${L.maxAccentColorsPerProp}`);
  return issues;
}

/** Props may only import the prop API, and may not smuggle in raw SVG or hex colors. */
export function lintPropSources(dir = join(ROOT, 'assets/props')): Issue[] {
  const issues: Issue[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && n !== 'index.ts')) {
    const src = readFileSync(join(dir, f), 'utf8');
    const add = (rule: string, message: string) => issues.push({ target: `assets/props/${f}`, rule, message });
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (m[1] !== '../../render/props/api') add('primitives-only', `imports "${m[1]}" (only ../../render/props/api is allowed)`);
    }
    if (/#[0-9a-fA-F]{3,8}\b/.test(src)) add('palette', 'hard-coded hex color (use token names)');
    if (/<(path|svg|g|rect|circle)\b|\bd\s*[:=]\s*['"`]M/.test(src)) add('primitives-only', 'raw SVG markup or path data');
  }
  return issues;
}

export function lintTokens(): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: string, message: string) => issues.push({ target: 'style.tokens.json', rule, message });
  const c = tokens.colors;
  const min = tokens.lint.minContrast;
  const inkPaper = contrast(c.ink, c.paper);
  if (inkPaper < min.inkOnPaper) add('contrast', `ink on paper ${inkPaper.toFixed(2)} < ${min.inkOnPaper}`);
  // Caption/keyword text = colored fill with an ink outline (brief §1.5).
  for (const fill of ['white', 'highlight', 'money', 'loss'] as const) {
    const r = contrast(c[fill], c.ink);
    if (r < min.captionFillOnOutline) add('contrast', `${fill} text on ink outline ${r.toFixed(2)} < ${min.captionFillOnOutline}`);
  }
  for (const [role, f] of Object.entries(tokens.fonts)) {
    if (typeof f !== 'object' || !f.file) continue;
    if (!existsSync(join(ROOT, 'assets/fonts', f.file))) add('fonts', `font file for "${role}" missing: assets/fonts/${f.file}`);
  }
  return issues;
}
