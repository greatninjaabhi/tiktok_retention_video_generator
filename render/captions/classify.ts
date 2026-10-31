/**
 * Which caption words get the "good" (green) or "bad" (red) color (brief §1.5).
 * Number patterns are generic; the word lists come from channels/<id>/channel.yaml.
 */
export type WordClass = 'good' | 'bad' | null;
export type WordLists = { good: string[]; bad: string[] };

export function classifyWord(text: string, lists: WordLists): WordClass {
  const t = text.toLowerCase().replace(/^["'(]+|["'),.!?;:]+$/g, '');
  if (/^[-−]\$?\d/.test(t)) return 'bad';
  if (/^\+\$?\d/.test(t)) return 'good';
  if (lists.bad.includes(t)) return 'bad';
  if (lists.good.includes(t)) return 'good';
  return null;
}
