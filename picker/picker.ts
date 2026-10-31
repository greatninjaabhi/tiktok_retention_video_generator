/**
 * The picker (brief §8): Thompson sampling with discounting over arms
 * format × topic_type × hook_pattern. Recent videos weigh more (trends shift), untried arms get
 * explored naturally (their posteriors are wide). Learns which TYPES of topics/hooks hold
 * viewers, never which political side.
 */
import { createRng, type Rng } from '../render/rng';
import type { Store, VideoRecord } from '../analytics/store';
import { reward } from '../analytics/metrics';

export type Arm = { format: string; topic_type: string; hook_pattern: string };
export const armKey = (a: Arm) => `${a.format}|${a.topic_type}|${a.hook_pattern}`;
export type Posterior = { alpha: number; beta: number; n: number };

/** Discounted Beta posteriors: the k-th most recent rewarded video counts gamma^k. */
export function posteriors(store: Store, gamma = 0.92): Map<string, Posterior> {
  const vids = Object.values(store.videos).filter((v) => v.postedAt).sort((a, b) => (a.postedAt! < b.postedAt! ? 1 : -1));
  const all = Object.values(store.videos);
  const post = new Map<string, Posterior>();
  vids.forEach((v: VideoRecord, k) => {
    const r = reward(v, all);
    if (!r) return;
    const w = gamma ** k;
    const p = post.get(armKey(v.arm)) ?? { alpha: 1, beta: 1, n: 0 };
    p.alpha += w * r.value;
    p.beta += w * (1 - r.value);
    p.n += 1;
    post.set(armKey(v.arm), p);
  });
  return post;
}

// Beta(a, b) sampling via two Gamma draws (Marsaglia–Tsang), from our seeded RNG.
function normal(rng: Rng): number {
  const u = Math.max(1e-12, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gamma(rng: Rng, k: number): number {
  if (k < 1) return gamma(rng, k + 1) * Math.pow(Math.max(1e-12, rng.next()), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(rng), v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rng.next();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
export function sampleBeta(rng: Rng, a: number, b: number): number {
  const x = gamma(rng, a), y = gamma(rng, b);
  return x / (x + y);
}

export type StoryLite = { headline: string; score: number; format: string; topicType: string };
export type PlanItem = { story: StoryLite; arm: Arm; sampled: number; value: number; mode: 'exploit' | 'explore' };

/** Pick `n` videos for today: one per story, best (sampled arm value × story score). */
export function dailyPlan(stories: StoryLite[], hookPatterns: string[], post: Map<string, Posterior>, seed: string, n = 3): PlanItem[] {
  const rng = createRng(seed + '|picker');
  const theta = new Map<string, number>();
  const sample = (a: Arm) => {
    const k = armKey(a);
    if (!theta.has(k)) { const p = post.get(k) ?? { alpha: 1, beta: 1, n: 0 }; theta.set(k, sampleBeta(rng, p.alpha, p.beta)); }
    return theta.get(k)!;
  };
  const items: PlanItem[] = [];
  for (const story of stories.slice(0, 12)) {
    const formats = story.format === 'fact_check' ? ['fact_check', 'explainer'] : ['explainer'];
    let best: PlanItem | null = null;
    for (const format of formats) {
      for (const hook_pattern of hookPatterns) {
        if (hook_pattern === 'said_check' && format !== 'fact_check') continue;
        const arm = { format, topic_type: story.topicType, hook_pattern };
        const s = sample(arm);
        const value = s * (0.5 + story.score);
        if (!best || value > best.value) best = { story, arm, sampled: s, value, mode: (post.get(armKey(arm))?.n ?? 0) >= 2 ? 'exploit' : 'explore' };
      }
    }
    if (best) items.push(best);
  }
  return items.sort((a, b) => b.value - a.value).slice(0, n);
}
