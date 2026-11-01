import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BeatSheetError, parseBeatSheet, type BeatSheet } from '../scripts/beatsheet';
import { lintScript } from '../scripts/lint';
import { loadChannel } from '../render/channel';

const ch = { ...loadChannel('politics'), wpm: 170 }; // the fixtures are timed for this pace
const sampleText = readFileSync(new URL('../scripts/videos/2026-11-01-filibuster.yaml', import.meta.url), 'utf8');
const sample = () => parseBeatSheet(sampleText);
const now = new Date('2026-11-01T12:00:00Z');
const rules = (b: BeatSheet, draft = true) => lintScript(b, ch, { now, draft }).issues.filter((i) => i.level === 'error').map((i) => i.rule);

describe('beat sheet parsing', () => {
  it('parses the sample', () => expect(sample().beats.length).toBeGreaterThan(10));
  it('rejects unknown tags and verdicts', () => {
    expect(() => parseBeatSheet(sampleText.replace('tags: [steelman]', 'tags: [vibes]'))).toThrow(BeatSheetError);
  });
  it('fact_check needs a claim', () => {
    expect(() => parseBeatSheet(sampleText.replace('format: explainer', 'format: fact_check'))).toThrow(/claim/);
  });
});

describe('script linter', () => {
  it('the sample passes in draft mode and is 61–75 s', () => {
    const r = lintScript(sample(), ch, { now, draft: true });
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(r.durationSec).toBeGreaterThanOrEqual(61);
    expect(r.durationSec).toBeLessThanOrEqual(75);
  });
  it('blocks rendering until a human has edited it', () => {
    expect(rules(sample(), false)).toContain('human-edit');
  });
  it('catches a long hook and branding in the first 3 s', () => {
    const b = sample();
    b.hook.spoken = 'Follow me because today we are going to talk about why Congress cannot pass anything';
    expect(rules(b)).toEqual(expect.arrayContaining(['hook-length', 'branding-first-3s']));
  });
  it('requires sources on facts and markers on opinions', () => {
    const b = sample();
    b.beats[0]!.claims = [];
    b.beats.find((x) => x.tags.includes('opinion'))!.line = 'Keeping it is a choice.';
    expect(rules(b)).toEqual(expect.arrayContaining(['sources', 'opinion-marker']));
  });
  it('requires a re-hook at 25–30 s and closed loops', () => {
    const b = sample();
    b.beats.forEach((x) => (x.tags = x.tags.filter((t) => t !== 'rehook')));
    b.beats.find((x) => x.closes === 'L1')!.closes = undefined;
    expect(rules(b)).toEqual(expect.arrayContaining(['rehook', 'open-loops', 'required-tags']));
  });
  it('flags beats that sit too long without a visual change', () => {
    const b = sample();
    b.beats[1]!.line = 'Most bills need sixty votes just to end debate, which is a very high bar for almost anything at all';
    expect(rules(b)).toContain('visual-cadence');
  });
  it('voting procedure info must cite an official source', () => {
    const b = sample();
    b.beats[6]!.line = 'Check where to vote before Tuesday.';
    expect(rules(b)).toContain('voting-info');
    b.beats[6]!.claims = [{ text: 'polling place lookup', sources: [{ url: 'https://vote.gov/', type: 'official_data' }] }];
    expect(rules(b)).not.toContain('voting-info');
  });
  it('bans paid political sponsors and AI clichés', () => {
    const b = sample();
    b.disclosures = [{ sponsor: 'Some PAC', type: 'pac' }];
    b.beats[0]!.line = "Let's dive in: the filibuster.";
    expect(rules(b)).toEqual(expect.arrayContaining(['disclosures', 'banned-phrase']));
  });
  it('warns when research is one-sided', () => {
    const b = sample();
    b.research = b.research.filter((r) => r.lean !== 'right');
    expect(lintScript(b, ch, { now, draft: true }).issues.map((i) => i.rule)).toContain('research-balance');
  });
});

describe('fact-check format', () => {
  const fc = (): BeatSheet => {
    const b = sample();
    b.format = 'fact_check';
    b.claim = { speaker: 'A senator', quote: 'The filibuster has been around since the founding.', said_at: '2026-10-30', source: { url: 'https://example.gov/transcript', type: 'transcript' } };
    b.beats[0]!.tags = ['claim'];
    b.beats[0]!.line = 'He said "has been around since the founding."';
    b.beats[2]!.verdict = { label: 'FALSE', sources: [{ url: 'https://www.senate.gov/x', type: 'official_data' }] };
    b.beats[3]!.verdict = { label: 'NEEDS_CONTEXT', sources: [{ url: 'https://www.senate.gov/y', type: 'official_data' }] };
    b.beats[3]!.tags.push('verdict');
    return b;
  };
  it('a well-formed fact-check passes', () => expect(rules(fc())).toEqual([]));
  it('quotes must be verbatim from the claim', () => {
    const b = fc();
    b.beats[0]!.line = 'He said "the filibuster is in the Constitution."';
    expect(rules(b)).toContain('quotes');
  });
  it('needs two verdicts with sources, after the claim', () => {
    const b = fc();
    b.beats[3]!.verdict = undefined;
    b.beats[3]!.tags = b.beats[3]!.tags.filter((t) => t !== 'verdict');
    expect(rules(b)).toContain('fact-check');
  });
});
