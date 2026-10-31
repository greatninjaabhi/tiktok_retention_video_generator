/**
 * Which words get money-green or loss-red (brief §1.5). Number patterns are generic;
 * the word lists are finance defaults and move to channels/finance/channel.yaml with the beat-sheet step.
 */
export type WordClass = 'money' | 'loss' | null;

const MONEY = new Set(['rich', 'richer', 'wealth', 'wealthy', 'profit', 'profits', 'earn', 'earns', 'interest', 'save', 'saved', 'savings', 'free', 'gains']);
const LOSS = new Set(['debt', 'fee', 'fees', 'lose', 'lost', 'losing', 'broke', 'nothing', 'scam', 'scams', 'poorer', 'penalty']);

export function classifyWord(text: string): WordClass {
  const t = text.toLowerCase().replace(/^["'(]+|["'),.!?;:]+$/g, '');
  if (/^[-−]\$?\d/.test(t)) return 'loss';
  if (/^\+?\$\d/.test(t) || /^\+?\d[\d,.]*%$/.test(t) || /^\+\d/.test(t)) return 'money';
  if (LOSS.has(t)) return 'loss';
  if (MONEY.has(t)) return 'money';
  return null;
}
