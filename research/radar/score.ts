/**
 * Topic radar: group headlines about the same story, then score each story for the brief's
 * rules (§0.5): fresh, widely covered, covered on BOTH sides (controversy), conflict words,
 * checkable claims (fact-check format), and whether people are searching for it.
 */
import type { Item, Lean, RadarConfig } from './feeds';

const STOP = new Set('a an the and or but of to in on at for with by from as is are was were be been it its this that these those his her their our your after before over under about into amid new says said will would could than more most just how why what who when where trump biden us u.s.'.split(' '));
// NOTE: names in STOP are only excluded from *similarity* so that "Trump says X" and "Trump says Y"
// don't merge into one story; they still appear in titles and reports.

export function tokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9$%\s-]/g, ' ').split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, '')).filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

export type Story = { items: Item[]; tokens: Set<string> };

/** Greedy single-pass clustering on headline token overlap (good enough for a daily shortlist). */
export function cluster(items: Item[], threshold = 0.22): Story[] {
  const stories: Story[] = [];
  for (const it of [...items].sort((a, b) => +b.published - +a.published)) {
    const tk = tokens(it.title);
    if (tk.size < 2) continue;
    let best: Story | null = null, bestSim = 0;
    for (const s of stories) {
      const sim = jaccard(tk, s.tokens);
      const shared = [...tk].filter((x) => s.tokens.has(x)).length;
      if ((sim >= threshold || shared >= 3) && sim > bestSim) { best = s; bestSim = sim; }
    }
    if (best) {
      best.items.push(it);
      for (const x of tk) best.tokens.add(x);
    } else stories.push({ items: [it], tokens: new Set(tk) });
  }
  return stories;
}

const LEFT: Lean[] = ['left', 'lean_left'];
const RIGHT: Lean[] = ['right', 'lean_right'];

export type ScoredStory = {
  headline: string;
  score: number;
  format: 'explainer' | 'fact_check';
  topicType: string;
  coverage: { left: number; center: number; right: number; factCheckers: number; primary: number };
  outlets: string[];
  ageHours: number;
  trending: boolean;
  signals: { recency: number; coverage: number; bothSides: number; conflict: number; claim: number; trend: number };
  links: { outlet: string; lean: Lean; title: string; link: string }[];
};

export function scoreStories(stories: Story[], trends: Item[], cfg: RadarConfig, now = new Date(), maxAgeHours = 72): ScoredStory[] {
  const trendTokens = trends.map((t) => tokens(t.title));
  const has = (s: Story, words: string[]) => s.items.some((i) => words.some((w) => new RegExp(`\\b${String(w).replace(/[-]/g, '\\-')}\\b`, 'i').test(i.title)));
  return stories
    .map((s): ScoredStory => {
      const news = s.items.filter((i) => i.kind !== 'trends');
      const newest = Math.max(...s.items.map((i) => +i.published));
      const ageHours = (+now - newest) / 3.6e6;
      const outlets = [...new Set(news.map((i) => i.outlet))];
      const cov = {
        left: new Set(news.filter((i) => LEFT.includes(i.lean)).map((i) => i.outlet)).size,
        center: new Set(news.filter((i) => i.lean === 'center').map((i) => i.outlet)).size,
        right: new Set(news.filter((i) => RIGHT.includes(i.lean)).map((i) => i.outlet)).size,
        factCheckers: news.filter((i) => i.kind === 'fact_checker').length,
        primary: news.filter((i) => i.kind === 'primary').length,
      };
      // A Google Trends query ("abdul el-sayed") matches when the story contains its words (up to 2).
      const trending = trendTokens.some((tt) => tt.size > 0 && [...tt].filter((x) => s.tokens.has(x)).length >= Math.min(2, tt.size));
      const signals = {
        recency: Math.pow(0.5, ageHours / 24),
        coverage: Math.min(1, outlets.length / 6),
        bothSides: cov.left > 0 && cov.right > 0 ? 1 : 0,
        conflict: has(s, cfg.conflict_words) ? 1 : 0,
        claim: cov.factCheckers > 0 ? 1 : has(s, cfg.claim_words) ? 0.5 : 0,
        trend: trending ? 1 : 0,
      };
      const score = 0.25 * signals.recency + 0.2 * signals.coverage + 0.2 * signals.bothSides + 0.15 * signals.conflict + 0.1 * signals.claim + 0.1 * signals.trend;
      const typeScores = Object.entries(cfg.topic_type_words).map(([t, ws]) => [t, ws.filter((w) => s.tokens.has(w)).length] as const);
      const topicType = typeScores.sort((a, b) => b[1] - a[1])[0]?.[1] ? typeScores[0]![0] : 'policy_fight';
      const rep = [...news].sort((a, b) => b.title.length - a.title.length).find((i) => i.kind === 'news') ?? news[0] ?? s.items[0]!;
      return {
        headline: rep.title, score: Math.round(score * 100) / 100, format: signals.claim >= 1 ? 'fact_check' : 'explainer', topicType,
        coverage: cov, outlets, ageHours: Math.round(ageHours), trending, signals,
        links: s.items.map((i) => ({ outlet: i.outlet, lean: i.lean, title: i.title, link: i.link })),
      };
    })
    .filter((s) => s.ageHours <= maxAgeHours && s.outlets.length > 0)
    .sort((a, b) => b.score - a.score);
}

export function reportMarkdown(stories: ScoredStory[], date: string, failures: string[], top = 15): string {
  const lines = [`# Topic radar: ${date}`, '', 'Ranked by recency, coverage, both-sides coverage, conflict, checkable claims and search trends (brief §0.5). Coverage is by approximate outlet lean (L / C / R).', ''];
  stories.slice(0, top).forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.headline}`);
    lines.push(`**Score ${s.score}** · ${s.format === 'fact_check' ? '🔎 fact-check candidate' : 'explainer'} · ${s.topicType} · ${s.ageHours} h old${s.trending ? ' · 📈 trending in search' : ''}`);
    lines.push(`Coverage: L ${s.coverage.left} · C ${s.coverage.center} · R ${s.coverage.right}${s.coverage.factCheckers ? ` · fact-checkers ${s.coverage.factCheckers}` : ''}${s.coverage.left && s.coverage.right ? ' · **covered on both sides**' : ''}`);
    for (const l of s.links.slice(0, 8)) lines.push(`- [${l.outlet}](${l.link}) (${l.lean}): ${l.title}`);
    lines.push('');
  });
  if (failures.length) lines.push('## Feeds that failed', ...failures.map((f) => `- ${f}`), '');
  lines.push('Reminder: outlets help find the story and each side\'s framing. Script facts need primary sources (§0.5).');
  return lines.join('\n') + '\n';
}
