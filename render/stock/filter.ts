import { tokens } from '../tokens';
import type { StockCandidate } from './types';

/** No AI-generated stock (brief §1.4). Sources don't flag it reliably, so we also screen tags/titles. */
const AI_HINTS = /\b(ai[- ]?generated|generated (by|with) ai|ai[- ]art|generative ai|midjourney|stable[- ]diffusion|dall[- ]?e|text[- ]to[- ]image|neural network art)\b/i;

export type Rejection = { id: string; reason: string };

/** Read the real format and size from the bytes; a provider's metadata and file extension can both be wrong. */
export function imageInfo(b: Buffer): { format: 'jpeg' | 'png'; width: number; height: number } | null {
  if (b.length > 24 && b.toString('latin1', 1, 4) === 'PNG') return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1]!;
    if (marker === 0xff) { i++; continue; }
    // SOF0–SOF15 hold the frame size (C4, C8 and CC are other segments).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { format: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** Why a downloaded file can't be used, or null if it's fine. The renderer only decodes real JPEG and PNG. */
export function screenFile(b: Buffer): string | null {
  const info = imageInfo(b);
  if (!info) return `not a real JPEG or PNG (starts ${b.toString('latin1', 0, 4).replace(/[^ -~]/g, '.')})`;
  if (info.width < tokens.stock.minWidthPx) return `too small (${info.width}px actual)`;
  return null;
}

export function screen(cands: StockCandidate[]): { ok: StockCandidate[]; rejected: Rejection[] } {
  const ok: StockCandidate[] = [];
  const rejected: Rejection[] = [];
  for (const c of cands) {
    if (AI_HINTS.test(c.text)) rejected.push({ id: c.id, reason: 'looks AI-generated' });
    else if (c.attributionRequired) rejected.push({ id: c.id, reason: 'license requires attribution' });
    else if (c.width && c.width < tokens.stock.minWidthPx) rejected.push({ id: c.id, reason: `too small (${c.width}px)` });
    else ok.push(c);
  }
  return { ok, rejected };
}
