/**
 * npm run ship -- scripts/videos/<id>.yaml [--render-only | --no-render] [--at <ISO time>] [--url <public mp4 link>] [--yes]
 *
 * From a checked script to queued on TikTok: clears the script to post, renders the final video
 * without the draft stamp, runs preflight, hosts the file and queues it in Buffer.
 * --render-only stops after the render so the video can be inspected; --no-render then queues it.
 * Asks you to type "post"; agents pass --yes as part of /make-video.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { loadBeatSheet } from '../scripts/beatsheet';
import { planVideo, renderVideo } from '../render/video';
import { preflight } from './preflight';
import { bufferCaption, bufferKey, createVideoPost, loadEnv, pickTikTokChannel, videoUrlProblem } from './buffer-api';
import { hostOnGitHub, repoFromRemote } from './github-host';

const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const fail = (msg: string): never => { console.error(msg); process.exit(1); };

const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!file) fail('usage: npm run ship -- scripts/videos/<id>.yaml [--at <ISO time>] [--url <public mp4 link>] [--yes]');

loadEnv();
const url = flag('--url');
const token = process.env.GITHUB_TOKEN;
if (!url && !token) fail('Add GITHUB_TOKEN to .env so the video can be hosted (or pass --url).');

// Fail on setup problems now, not after a nine-minute render.
const key = bufferKey();
const channel = await pickTikTokChannel(fetch, key, flag('--channel') ?? process.env.BUFFER_CHANNEL_ID);
const original = readFileSync(file!, 'utf8');
const sheet = loadBeatSheet(file!);
const text = bufferCaption(sheet);
const dueAt = flag('--at');

console.log(`\nChannel: ${channel.name}\nVideo: ${sheet.id}\nCaption:\n---\n${text}\n---`);
if (!args.includes('--yes') && !args.includes('--render-only')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`Publishes PUBLICLY ${dueAt ? `at ${dueAt}` : 'from the Buffer queue'}. Type "post" to confirm: `)).trim();
  rl.close();
  if (answer !== 'post') fail('Not posted.');
}

// Record what the sign-off really was: the owner chose auto-queueing and can remove a video in Buffer.
const today = new Date().toISOString().slice(0, 10);
writeFileSync(file!, original.replace(/human_edited: false/, `human_edited: true # cleared ${today}: fact-checked by the agent, auto-queued; owner can remove it in Buffer`));
try {
  const approved = loadBeatSheet(file!);
  if (!args.includes('--no-render')) {
    console.log('Rendering the final video (about 9 minutes; keep the PC awake)…');
    const plan = await planVideo(approved);
    const blocking = plan.lint.issues.filter((i) => i.level === 'error');
    if (blocking.length) throw new Error(`script fails with real timings: ${blocking.map((i) => i.message).join('; ')}`);
    await renderVideo(plan);
  }

  const failed = preflight(approved).filter((c) => !c.ok);
  if (failed.length) throw new Error(`preflight failed: ${failed.map((c) => c.label).join('; ')}`);
  if (args.includes('--render-only')) {
    console.log(`✓ out/${approved.id}/video.mp4 is ready. Inspect it, then: npm run ship -- ${file} --no-render --yes`);
    process.exit(0);
  }

  const video = fileURLToPath(new URL(`../out/${approved.id}/video.mp4`, import.meta.url));
  const repo = repoFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }));
  const link = url ?? (await hostOnGitHub(fetch, token!, repo, approved.id, new Uint8Array(readFileSync(video))));
  const problem = await videoUrlProblem(fetch, link, statSync(video).size);
  if (problem) throw new Error(problem);

  const id = await createVideoPost(fetch, key, { channelId: channel.id, text, videoUrl: link, dueAt, draft: false });
  console.log(`✓ queued in Buffer (${id})\n  Video: ${link}\n  Once it's live: npm run buffer -- register ${file} <tiktok video id>`);
} catch (e) {
  writeFileSync(file!, original); // not posted, so not approved
  fail(`Not posted: ${(e as Error).message}`);
}
