import { describe, expect, it } from 'vitest';
import type { Store, VideoRecord } from '../analytics/store';
import { importStudioCsv, parseCsv, parseVideoList, recordSnapshots, toRate, toSeconds } from '../analytics/tiktok';
import { derive, reward, viewsAt } from '../analytics/metrics';
import { dailyPlan, posteriors, sampleBeta } from '../picker/picker';
import { createRng } from '../render/rng';
import { preflight } from '../publish/preflight';
import { loadBeatSheet } from '../scripts/beatsheet';

const vid = (i: number, over: Partial<VideoRecord> = {}): VideoRecord => ({
  id: `v${i}`, tiktokId: String(7000000000 + i), postedAt: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(), durationSec: 65,
  arm: { format: 'explainer', topic_type: 'policy_fight', hook_pattern: i % 2 ? 'just_happened' : 'question_blame' },
  snapshots: [{ at: new Date(Date.UTC(2026, 9, 3 + i)).toISOString(), views: 1000 * (i + 1), likes: 10, comments: 2, shares: 5 * (i + 1), source: 'api' }],
  studio: { avgWatchSec: 20 + i, fullWatchRate: 0.1 + i / 100, importedAt: '2026-10-30T00:00:00Z' },
  ...over,
});

describe('TikTok importers', () => {
  it('parses the Display API video list and records snapshots for our videos', () => {
    const store: Store = { videos: { v1: vid(1, { snapshots: [], postedAt: undefined }) } };
    const r = parseVideoList({ data: { videos: [{ id: '7000000001', create_time: 1761955200, view_count: 4200, like_count: 300, comment_count: 12, share_count: 40 }, { id: '999', create_time: 1 }], has_more: false }, error: { code: 'ok' } });
    expect(recordSnapshots(store, r.videos)).toBe(1);
    expect(store.videos.v1!.snapshots[0]).toMatchObject({ views: 4200, shares: 40, source: 'api' });
    expect(store.videos.v1!.postedAt).toBe(new Date(1761955200 * 1000).toISOString());
    expect(() => parseVideoList({ error: { code: 'access_token_invalid', message: 'bad' } })).toThrow(/access_token_invalid/);
  });
  it('maps Studio CSV columns flexibly (quoted cells, % and mm:ss)', () => {
    expect(parseCsv('a,"b, c",d\n1,"say ""hi""",3\n')).toEqual([['a', 'b, c', 'd'], ['1', 'say "hi"', '3']]);
    expect(toSeconds('0:23')).toBe(23);
    expect(toSeconds('18.5s')).toBe(18.5);
    expect(toRate('12.5%')).toBeCloseTo(0.125);
    const store: Store = { videos: { v1: vid(1, { studio: undefined }) } };
    const csv = 'Video link,Date posted,Video views,Likes,Comments,Shares,Average watch time,Watched full video,New followers\n' +
      'https://www.tiktok.com/@me/video/7000000001,2026-10-02,"12,000",900,40,120,0:31,22%,85\nhttps://www.tiktok.com/@me/video/123,2026-10-02,5,0,0,0,0:01,1%,0\n';
    const r = importStudioCsv(store, csv);
    expect(r.matched).toBe(1);
    expect(r.unmatched.length).toBe(1);
    expect(store.videos.v1!.studio).toMatchObject({ avgWatchSec: 31, fullWatchRate: 0.22, follows: 85 });
    expect(store.videos.v1!.snapshots.at(-1)).toMatchObject({ views: 12000, shares: 120, source: 'csv' });
  });
});

describe('metrics + reward', () => {
  it('interpolates views at 48 h and derives % viewed', () => {
    const v = vid(1, { postedAt: '2026-10-01T00:00:00Z', snapshots: [
      { at: '2026-10-02T00:00:00Z', views: 1000, likes: 0, comments: 0, shares: 10, source: 'api' },
      { at: '2026-10-04T00:00:00Z', views: 3000, likes: 0, comments: 0, shares: 30, source: 'api' },
    ] });
    expect(viewsAt(v, 48)).toBe(2000);
    expect(viewsAt(v, 200)).toBeUndefined();
    expect(derive(v).avgPctViewed).toBeCloseTo(21 / 65);
    expect(derive(v).sharesPer1k).toBeCloseTo(10);
  });
  it('rewards beating the channel baseline; provisional without Studio data', () => {
    const history = Array.from({ length: 10 }, (_, i) => vid(i));
    const great = vid(20, { studio: { avgWatchSec: 60, fullWatchRate: 0.6, importedAt: 'x' } });
    const r = reward(great, [...history, great])!;
    expect(r.value).toBeGreaterThan(0.8);
    expect(r.provisional).toBe(false);
    const noCsv = reward(vid(21, { studio: undefined }), [...history])!;
    expect(noCsv.provisional).toBe(true);
  });
});

describe('picker', () => {
  it('Beta sampling is deterministic and has the right mean', () => {
    const rng = createRng('beta');
    const xs = Array.from({ length: 4000 }, () => sampleBeta(rng, 8, 2));
    expect(xs.reduce((a, b) => a + b, 0) / xs.length).toBeCloseTo(0.8, 1);
    expect(sampleBeta(createRng('s'), 2, 5)).toBe(sampleBeta(createRng('s'), 2, 5));
  });
  it('learns which hook pattern wins and plans one video per story', () => {
    const store: Store = { videos: {} };
    // question_blame videos do great, just_happened ones do badly.
    for (let i = 0; i < 24; i++) {
      const good = i % 2 === 0;
      store.videos[`v${i}`] = vid(i, { studio: { avgWatchSec: good ? 50 : 10, fullWatchRate: good ? 0.5 : 0.05, importedAt: 'x' } });
    }
    const post = posteriors(store);
    const qb = post.get('explainer|policy_fight|question_blame')!, jh = post.get('explainer|policy_fight|just_happened')!;
    expect(qb.alpha / (qb.alpha + qb.beta)).toBeGreaterThan(jh.alpha / (jh.alpha + jh.beta));
    const stories = [
      { headline: 'A', score: 0.8, format: 'explainer', topicType: 'policy_fight' },
      { headline: 'B', score: 0.6, format: 'fact_check', topicType: 'scandal' },
    ];
    const plan = dailyPlan(stories, ['question_blame', 'just_happened', 'said_check'], post, '2026-11-01', 2);
    expect(plan.map((p) => p.story.headline).sort()).toEqual(['A', 'B']);
    expect(plan.find((p) => p.story.headline === 'A')!.mode).toBe('exploit');
    expect(plan.every((p) => p.arm.hook_pattern !== 'said_check' || p.arm.format === 'fact_check')).toBe(true);
  });
});

describe('preflight', () => {
  it('blocks the draft sample', () => {
    const checks = preflight(loadBeatSheet(new URL('../scripts/videos/2026-11-01-filibuster.yaml', import.meta.url).pathname));
    expect(checks.find((c) => c.label.startsWith('a human edited'))!.ok).toBe(false);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });
});
