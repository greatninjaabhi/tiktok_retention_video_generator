/**
 * Pre-post checklist (brief §5): refuses to green-light a video that isn't safe to post.
 * Machine checks fail hard; manual steps are listed for the human.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BeatSheet } from '../scripts/beatsheet';
import { lintScript } from '../scripts/lint';
import { loadChannel } from '../render/channel';
import { readManifest } from '../render/stock/manifest';

export type Check = { ok: boolean; label: string; detail?: string };
const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function preflight(sheet: BeatSheet, now = new Date()): Check[] {
  const ch = loadChannel(sheet.channel);
  const dir = `${ROOT}out/${sheet.id}/`;
  const checks: Check[] = [];
  const add = (ok: boolean, label: string, detail?: string) => checks.push({ ok, label, detail });

  const errors = lintScript(sheet, ch, { now }).issues.filter((i) => i.level === 'error');
  add(errors.length === 0, 'script passes the linter (not a draft)', errors.map((e) => `[${e.rule}] ${e.message}`).join('; ') || undefined);
  add(sheet.human_edited, 'a human edited the script (human_edited: true)');
  add(existsSync(dir + 'video.mp4'), 'video rendered', `out/${sheet.id}/video.mp4`);
  if (existsSync(dir + 'video.mp4')) {
    try {
      const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dir + 'video.mp4']).toString());
      add(d >= 61 && d <= 75, 'length is 61–75 s (Creator Rewards needs > 1 min)', `${d.toFixed(1)} s`);
    } catch { add(false, 'length check (ffprobe missing?)'); }
  }
  const post = existsSync(dir + 'post.txt') ? readFileSync(dir + 'post.txt', 'utf8') : '';
  add(!!post, 'post.txt (caption, hashtags, sources) exists');
  add(!/No real voice/.test(post), 'rendered with the real voice (not estimated timings)');
  add(!/DRAFT/.test(post), 'rendered from the final, non-draft script');
  const manifest = readManifest();
  const queries = sheet.beats.flatMap((b) => (b.panel && 'stock' in b.panel ? [b.panel.stock] : []));
  const missing = queries.filter((q) => !Object.values(manifest.images).some((e) => e.query === q));
  add(missing.length === 0, 'every stock photo slot has a licensed image in the manifest', missing.length ? `missing: ${missing.join(', ')}` : undefined);
  add(existsSync(dir + 'cover.png'), 'cover image exists');
  add(existsSync(ROOT + 'corrections.md'), 'corrections.md exists (public corrections log)');
  return checks;
}

export const MANUAL_STEPS = [
  'Look at npm run frames: can you name every photo\'s subject in one second? Does the opening photo grab?',
  'Pin a comment with the sources from post.txt.',
  'Account check: personal (not Business) account, holder 18+.',
  'Political content: no payment or perks from any campaign, party, PAC or advocacy group.',
  'Re-watch once at full speed on a phone: captions readable, nothing over the right-side buttons.',
];
