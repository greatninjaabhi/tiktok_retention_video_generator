import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { tokens, colorHex } from '../tokens';
import type { Item } from './pen';

const FONT_DIR = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Items → SVG elements, in draw order (each primitive already emits its fill before its outline). */
export function itemsToSvg(items: Item[]): string {
  return items
    .map((it) => {
      switch (it.kind) {
        case 'fill':
          return `<path d="${it.d}" fill="${colorHex(it.color)}"/>`;
        case 'stroke':
          return `<path d="${it.d}" fill="none" stroke="${colorHex(it.color)}" stroke-width="${tokens.stroke.widths[it.width]}"${it.opacity < 1 ? ` stroke-opacity="${it.opacity}"` : ''}/>`;
        case 'text': {
          const px = tokens.text.sizesPx[it.size];
          const font = tokens.fonts[it.font].family;
          const outline = it.outline
            ? ` stroke="${colorHex(it.outline)}" stroke-width="${Math.round(px * 0.16)}" paint-order="stroke"`
            : '';
          return `<text x="${it.x}" y="${it.y + px * 0.36}" font-family="${font}" font-size="${px}" text-anchor="middle" fill="${colorHex(it.color)}"${outline} transform="rotate(${it.rotateDeg} ${it.x} ${it.y})">${esc(it.text)}</text>`;
        }
      }
    })
    .join('');
}

export type SvgOptions = { width: number; height: number; viewBox?: [number, number, number, number]; background?: string | null };

export function toSvg(body: string, opts: SvgOptions): string {
  const vb = opts.viewBox ?? [0, 0, opts.width, opts.height];
  const bg = opts.background === null ? '' : `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${opts.background ?? tokens.colors.paper}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="${vb.join(' ')}">` +
    `<g stroke-linecap="${tokens.stroke.cap}" stroke-linejoin="${tokens.stroke.join}">${bg}${body}</g></svg>`
  );
}

/** Rasterize with resvg (no browser; same pixels on every machine). Only our OFL fonts are loaded. */
export function svgToPng(svg: string): Buffer {
  const fontFiles = [...new Set(Object.values(tokens.fonts).flatMap((f) => (typeof f === 'object' && f.file ? [FONT_DIR + f.file] : [])))];
  const r = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: tokens.fonts.title.family } });
  return r.render().asPng();
}

export function fontBytes(file: string): Buffer {
  return readFileSync(FONT_DIR + file);
}
