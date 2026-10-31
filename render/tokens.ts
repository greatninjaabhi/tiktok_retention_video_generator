import raw from '../style.tokens.json';

export const tokens = raw;
export type Tokens = typeof raw;

export type ColorName = Exclude<keyof Tokens['colors'], '_comment'>;
export type StrokeWidthName = keyof Tokens['stroke']['widths'];
export type TextSizeName = keyof Tokens['text']['sizesPx'];
export type FontRole = Exclude<keyof Tokens['fonts'], '_comment'>;

export const COLOR_NAMES = Object.keys(tokens.colors).filter((k) => !k.startsWith('_')) as ColorName[];
export const STROKE_WIDTH_NAMES = Object.keys(tokens.stroke.widths) as StrokeWidthName[];

export const HU = tokens.scale.headUnitPx;

export function colorHex(name: ColorName): string {
  return tokens.colors[name];
}
