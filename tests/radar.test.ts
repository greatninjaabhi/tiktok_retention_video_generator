import { describe, expect, it } from 'vitest';
import { loadRadarConfig, parseFeed, type FeedSource } from '../research/radar/feeds';
import { cluster, reportMarkdown, scoreStories, tokens } from '../research/radar/score';

// Fictional headlines, for testing only.
const now = new Date('2026-11-01T12:00:00Z');
const rss = (items: [string, string][]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${items.map(([t, d]) => `<item><title>${t}</title><link>https://example.com/${encodeURIComponent(t)}</link><pubDate>${d}</pubDate></item>`).join('')}</channel></rss>`;
const atom = (items: [string, string][]) =>
  `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${items.map(([t, d]) => `<entry><title>${t}</title><link href="https://example.org/${encodeURIComponent(t)}"/><updated>${d}</updated></entry>`).join('')}</feed>`;
const src = (outlet: string, lean: FeedSource['lean'], kind: FeedSource['kind'] = 'news'): FeedSource => ({ outlet, lean, kind, url: 'https://example.com/feed' });
const recent = 'Sat, 01 Nov 2026 09:00:00 GMT';
const old = 'Mon, 20 Oct 2026 09:00:00 GMT';

const items = [
  ...parseFeed(rss([['Senate fight over Widget Tax bill erupts as vote nears', recent], ['Local zoo welcomes baby otter', recent]]), src('Leftish Daily', 'lean_left')),
  ...parseFeed(atom([['Widget Tax bill vote: senators clash over cost', recent]]), src('Rightish Post', 'right')),
  ...parseFeed(rss([['Widget Tax: Senate bill faces backlash', recent]]), src('Center Wire', 'center')),
  ...parseFeed(rss([['Governor claims Widget Tax bill doubles prices', recent]]), src('CheckIt', 'fact_checker', 'fact_checker')),
  ...parseFeed(rss([['Old story about a ribbon cutting ceremony downtown', old]]), src('Center Wire', 'center')),
];
const trends = parseFeed(rss([['widget tax', recent]]), src('Google Trends US', 'trends', 'trends'));
const cfg = loadRadarConfig('politics');

describe('feed parsing', () => {
  it('reads RSS and Atom with dates and links', () => {
    const r = items.find((i) => i.outlet === 'Rightish Post')!;
    expect(r.link).toMatch(/^https:\/\/example\.org\//);
    expect(+r.published).toBe(+new Date(recent));
  });
  it('tokenizes without stop words', () => expect([...tokens('The Senate says the Widget Tax bill is new')]).toEqual(['senate', 'widget', 'tax', 'bill']));
});

describe('clustering + scoring', () => {
  const stories = scoreStories(cluster(items), trends, cfg, now, 72);
  it('groups the same story across outlets and drops stale ones', () => {
    expect(stories[0]!.outlets.sort()).toEqual(['CheckIt', 'Center Wire', 'Leftish Daily', 'Rightish Post'].sort());
    expect(stories.some((s) => /ribbon/.test(s.headline))).toBe(false);
  });
  it('rewards both-sides coverage, conflict, claims and search trends', () => {
    const top = stories[0]!;
    expect(top.signals.bothSides).toBe(1);
    expect(top.signals.conflict).toBe(1);
    expect(top.trending).toBe(true);
    expect(top.format).toBe('fact_check');
    expect(top.topicType).toBe('policy_fight');
    expect(top.score).toBeGreaterThan(stories.find((s) => /otter/.test(s.headline))!.score);
  });
  it('writes a readable report with L/C/R coverage and failures', () => {
    const md = reportMarkdown(stories, '2026-11-01', ['Some Feed: ENOTFOUND']);
    expect(md).toMatch(/L 1 · C 1 · R 1/);
    expect(md).toMatch(/covered on both sides/);
    expect(md).toMatch(/Some Feed: ENOTFOUND/);
  });
});
