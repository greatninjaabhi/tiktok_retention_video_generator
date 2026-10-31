import { tokens } from '../tokens';
import type { StockCandidate } from './types';

/** No AI-generated stock (brief §1.4). Sources don't flag it reliably, so we also screen tags/titles. */
const AI_HINTS = /\b(ai[- ]?generated|generated (by|with) ai|ai[- ]art|generative ai|midjourney|stable[- ]diffusion|dall[- ]?e|text[- ]to[- ]image|neural network art)\b/i;

export type Rejection = { id: string; reason: string };

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
