import type { BeatSheet } from '../scripts/beatsheet';
import type { Draft } from '../scripts/draft';

/** The hand-written sample, expressed as Claude's structured output. */
export function sampleAsDraft(b: BeatSheet): Draft {
  return {
    format: b.format, topic_title: 'The filibuster', topic_type: 'policy_fight',
    hooks: Array.from({ length: 10 }, (_, i) => ({ spoken: i === 0 ? b.hook.spoken : `Hook number ${i} about the Senate rule today`, on_screen: b.hook.on_screen, pattern: 'question_blame', why: 'x' })),
    chosen_hook: 0,
    claim: { speaker: '', quote: '', said_at: '', source_url: '', source_type: '' },
    research: b.research,
    beats: b.beats.map((x) => ({
      id: x.id, line: x.line, tags: x.tags, pose: x.pose as never, expression: x.expression ?? '', prop: x.prop ?? '',
      panel_kind: x.panel ? ('stock' in x.panel ? 'stock' : 'meme') : 'none',
      stock_query: x.panel && 'stock' in x.panel ? x.panel.stock : '',
      meme: x.panel && 'meme' in x.panel ? x.panel.meme : '',
      meme_text: x.panel && 'meme' in x.panel ? Object.entries(x.panel.text ?? {}).map(([slot, text]) => ({ slot, text })) : [],
      camera: x.camera ?? '', claims: (x.claims ?? []).map((c) => ({ text: c.text, sources: c.sources.map((s) => ({ url: s.url, type: s.type })) })),
      verdict_label: 'NONE', verdict_sources: [], opens: x.opens ?? '', closes: x.closes ?? '',
    })),
    caption: 'c', hashtags: ['#filibuster'], editor_notes: ['NEEDS SOURCE: 2013 date'],
  };
}

