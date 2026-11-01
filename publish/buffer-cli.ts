/**
 * npm run buffer -- channels                                  # list connected channels, find the TikTok one
 * npm run buffer -- post scripts/videos/<id>.yaml --url <URL> # save to Buffer as a DRAFT (publishes nothing)
 * npm run buffer -- post <...> --url <URL> --publish [--at 2026-11-02T18:00:00Z]
 *                                                             # queue or schedule it; needs preflight and a typed "post"
 * npm run buffer -- register scripts/videos/<id>.yaml <tiktok video id>  # link the live post to analytics
 *
 * Needs BUFFER_API_KEY (https://publish.buffer.com/settings/api), read from the gitignored .env file or the environment. Buffer takes video by public URL only,
 * so upload out/<id>/video.mp4 somewhere first. BUFFER_CHANNEL_ID or --channel picks a channel if there are several.
 */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { loadBeatSheet } from '../scripts/beatsheet';
import { preflight } from './preflight';
import { BufferApiError, bufferCaption, createVideoPost, isTikTok, listChannels, videoUrlProblem } from './buffer-api';
import { readStore, writeStore } from '../analytics/store';
import { registerVideo } from '../analytics/register';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
const fail = (msg: string): never => { console.error(msg); process.exit(1); };

function apiKey(): string {
  const envFile = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides a variable that's already set
  const key = process.env.BUFFER_API_KEY;
  if (!key || key === 'paste-your-key-here') return fail('Put your key in the .env file as BUFFER_API_KEY=... (https://publish.buffer.com/settings/api).');
  return key;
}

try {
  if (cmd === 'channels') {
    const channels = await listChannels(fetch, apiKey());
    for (const c of channels) console.log(`${isTikTok(c) ? '→' : ' '} ${c.id}  ${c.service}  ${c.name}`);
    if (!channels.some(isTikTok)) console.log('No TikTok channel is connected: https://publish.buffer.com/settings/channels');
  } else if (cmd === 'register') {
    const [file, tiktokId] = rest;
    if (!file || !tiktokId) fail('usage: npm run buffer -- register scripts/videos/<id>.yaml <tiktok video id>');
    const store = readStore();
    registerVideo(store, loadBeatSheet(file!), tiktokId!);
    writeStore(store);
    console.log(`✓ analytics will track ${tiktokId}`);
  } else if (cmd === 'post') {
    const file = rest.find((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
    const url = flag('--url');
    if (!file || !url) fail('usage: npm run buffer -- post scripts/videos/<id>.yaml --url <public https link to the mp4> [--publish] [--at <ISO time>]');
    const publish = rest.includes('--publish');
    const sheet = loadBeatSheet(file!);
    const video = fileURLToPath(new URL(`../out/${sheet.id}/video.mp4`, import.meta.url));
    if (!existsSync(video)) fail(`Render it first: out/${sheet.id}/video.mp4 is missing.`);

    if (publish) {
      const failed = preflight(sheet).filter((c) => !c.ok);
      if (failed.length) fail(`preflight failed: ${failed.map((c) => c.label).join('; ')} (run npm run preflight)`);
    }
    const problem = await videoUrlProblem(fetch, url!, statSync(video).size);
    if (problem) fail(problem);

    const key = apiKey();
    const channels = (await listChannels(fetch, key)).filter(isTikTok);
    const wanted = flag('--channel') ?? process.env.BUFFER_CHANNEL_ID;
    const channel = wanted ? channels.find((c) => c.id === wanted) : channels.length === 1 ? channels[0] : undefined;
    if (!channel) fail(`Pick one TikTok channel with --channel. Found: ${channels.map((c) => `${c.id} (${c.name})`).join(', ') || 'none'}`);

    const text = bufferCaption(sheet);
    const dueAt = flag('--at');
    console.log(`\nChannel: ${channel!.name}\nVideo: ${url}\nCaption:\n---\n${text}\n---`);
    if (publish) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(`Publishes PUBLICLY ${dueAt ? `at ${dueAt}` : 'from the Buffer queue'}. Type "post" to confirm: `)).trim();
      rl.close();
      if (answer !== 'post') fail('Not posted.');
    }
    const id = await createVideoPost(fetch, key, { channelId: channel!.id, text, videoUrl: url!, dueAt, draft: !publish });
    console.log(publish
      ? `✓ scheduled in Buffer (${id}). Once it's live: pin the sources from post.txt, then npm run buffer -- register ${file} <tiktok video id>`
      : `✓ saved as a Buffer draft (${id}). Nothing was published.`);
  } else {
    fail('usage: npm run buffer -- channels | post <yaml> --url <URL> [--publish] [--at <ISO>] | register <yaml> <tiktok id>');
  }
} catch (e) {
  if (e instanceof BufferApiError) fail(`Buffer: ${e.message}`);
  throw e;
}
