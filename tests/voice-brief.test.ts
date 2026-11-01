import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { approvedExamples, exampleScriptText, loadVoice, roboticHits } from '../scripts/voice';
import { briefMarkdown, briefSystemPrompt, generateBrief, type WriterBrief } from '../scripts/brief';
import { draftScript, userPrompt, type Draft, type DraftInput } from '../scripts/draft';
import { lintScript } from '../scripts/lint';
import { loadHookPatterns } from '../scripts/hooks';
import { loadChannel } from '../render/channel';
import { parseBeatSheet } from '../scripts/beatsheet';

const voice = loadVoice('politics');
const ch = { ...loadChannel('politics'), wpm: 170 }; // the fixtures are timed for this pace
const sampleText = readFileSync(new URL('../scripts/videos/2026-11-01-filibuster.yaml', import.meta.url), 'utf8');
const input: DraftInput = { headline: 'Story', date: '2026-11-01', firstSeen: new Date().toISOString(), sources: [{ url: 'https://x.gov', outlet: 'X', lean: 'primary', title: 't' }] };

const brief: WriterBrief = {
  angle: 'He told a Michigan guy to go home. He is home.', viewer: 'Gen Z, mostly not following the race', emotional_core: 'that is absurd',
  why_viewer_cares: 'Michigan votes Tuesday', funniest_true_detail: 'He was born in Michigan', hook_directions: ['a', 'b', 'c'],
  punchline_options: ['Bro\'s already home.'], outline: ['setup', 'reveal'], voice_notes: ['deadpan'], avoid: ['"sparked outrage"'],
  sample_lines: ['Okay. So where\'d he come from?'], verify: ['exact quote'],
};

describe('robotic phrasing', () => {
  it('flags newsreader phrases and datelines, passes human lines', () => {
    expect(roboticHits("So let's check it.", voice)).toContain("let's check it");
    expect(roboticHits('The move comes amid growing tension.', voice)).toEqual(expect.arrayContaining(['the move comes', 'amid']));
    expect(roboticHits('Friday in Florida, he said it again.', voice)).toContain('starts like a news dateline');
    expect(roboticHits("Okay. So where'd he come from?", voice)).toEqual([]);
    expect(roboticHits('Bro is already home.', voice)).toEqual([]);
  });
  it('the linter warns on robotic lines', () => {
    const b = parseBeatSheet(sampleText);
    b.beats[0]!.line = "It's worth noting the filibuster.";
    expect(lintScript(b, ch, { draft: true }).issues.find((i) => i.rule === 'robotic')?.beat).toBe(b.beats[0]!.id);
  });
});

describe('approved examples', () => {
  it('uses only human-edited scripts, preferring the same format and topic', () => {
    const dir = mkdtempSync(join(tmpdir(), 'videos-')) + '/';
    const mk = (id: string, format: string, type: string, edited: boolean) =>
      writeFileSync(`${dir}${id}.yaml`, sampleText.replace(/^id: .*/m, `id: ${id}`).replace('format: explainer', `format: ${format}`).replace('type: policy_fight', `type: ${type}`).replace('human_edited: false', `human_edited: ${edited}`).replace(format === 'fact_check' ? 'tags: [steelman]' : '#', format === 'fact_check' ? 'tags: [steelman]' : '#'));
    mk('a-explainer-policy', 'explainer', 'policy_fight', true);
    mk('b-explainer-scandal', 'explainer', 'scandal', true);
    mk('c-not-approved', 'explainer', 'scandal', false);
    const ex = approvedExamples('explainer', 'scandal', 2, dir);
    expect(ex.map((s) => s.id)).toEqual(['b-explainer-scandal', 'a-explainer-policy']);
    expect(exampleScriptText(ex[0]!)).toMatch(/^\(explainer, scandal\)/);
  });
});

describe('writer brief (step 1)', () => {
  it('system prompt carries the channel voice and stays deterministic', () => {
    expect(briefSystemPrompt(ch, voice)).toBe(briefSystemPrompt(ch, voice));
    expect(briefSystemPrompt(ch, voice)).toContain("Bro's already home");
  });
  it('renders an editable markdown prompt', () => {
    const md = briefMarkdown(brief, input, 'fact_check', 'election_mechanics');
    expect(md).toMatch(/^# Writer brief: Story/);
    expect(md).toContain('**Funniest true detail:** He was born in Michigan');
    expect(md).toContain('## Verify before posting');
  });
  it('generateBrief calls Claude with structured output and returns markdown', async () => {
    const client = { beta: { messages: { parse: async (req: { model: string; messages: { content: string }[] }) => {
      expect(req.model).toBe('claude-opus-5-5');
      expect(req.messages[0]!.content).toContain('<topic_type>election_mechanics');
      return { stop_reason: 'end_turn', parsed_output: brief, content: [], usage: { input_tokens: 1, output_tokens: 1 } };
    } } } } as unknown as Anthropic;
    const r = await generateBrief(input, ch, voice, 'fact_check', 'election_mechanics', client);
    expect(r.markdown).toContain(brief.angle);
  });
});

describe('script (step 2) uses the brief and fixes robotic lines', () => {
  it('puts the brief in the prompt', () => {
    expect(userPrompt({ ...input, brief: '# Writer brief: X' })).toContain('<writer_brief>');
  });
  it('sends robotic lines back for a rewrite', async () => {
    const { sampleAsDraft } = await import('./draft.test.helpers');
    const good: Draft = sampleAsDraft(parseBeatSheet(sampleText));
    const robotic: Draft = { ...good, beats: good.beats.map((b, i) => (i === 2 ? { ...b, line: "Let's break it down: sixty votes." } : b)) };
    const sent: string[] = [];
    const replies = [robotic, good];
    const client = { beta: { messages: { parse: async (req: { messages: { content: unknown }[] }) => {
      sent.push(String(req.messages.at(-1)!.content));
      const out = replies.shift()!;
      return { stop_reason: 'end_turn', parsed_output: out, content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } };
    } } } } as unknown as Anthropic;
    const r = await draftScript(input, ch, loadHookPatterns('politics'), voice, { client });
    expect(r.rounds).toBe(2);
    expect(sent[1]).toMatch(/sound robotic/);
    expect(sent[1]).toContain("let's break it down");
  });
});
