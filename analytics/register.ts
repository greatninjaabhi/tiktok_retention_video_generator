import type { BeatSheet } from '../scripts/beatsheet';
import { lintScript } from '../scripts/lint';
import { loadChannel } from '../render/channel';
import type { Store } from './store';

/** Link a beat sheet to its TikTok post so the analytics + picker can learn from it. */
export function registerVideo(store: Store, sheet: BeatSheet, tiktokId: string, postedAt = new Date().toISOString()): void {
  const dur = lintScript(sheet, loadChannel(sheet.channel), { draft: true }).durationSec;
  store.videos[sheet.id] = {
    id: sheet.id, tiktokId, postedAt, durationSec: Math.round(dur * 10) / 10,
    arm: { format: sheet.format, topic_type: sheet.topic.type, hook_pattern: sheet.hook.pattern },
    snapshots: store.videos[sheet.id]?.snapshots ?? [],
  };
}
