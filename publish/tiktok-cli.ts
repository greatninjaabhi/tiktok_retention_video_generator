/**
 * npm run tiktok -- auth                                   # connect your TikTok account (once)
 * npm run tiktok -- post scripts/videos/<id>.yaml          # Direct Post with caption + hashtags
 * npm run tiktok -- post scripts/videos/<id>.yaml --inbox  # send to your TikTok drafts instead
 * npm run tiktok -- post <...> --private-test              # test the integration: SELF_ONLY, skips preflight
 *
 * Follows TikTok's Direct Post expectations: shows the account, the caption, a privacy choice
 * with no default, interaction and disclosure settings, and posts only after explicit consent.
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { loadBeatSheet } from '../scripts/beatsheet';
import { buildCaption } from './caption';
import { preflight } from './preflight';
import { accessToken, authorizeUrl, exchangeCode, saveToken } from './tiktok-auth';
import { directPostBody, initDirectPost, initInboxUpload, queryCreatorInfo, TikTokApiError, uploadVideo, waitForPublish } from './tiktok-api';
import { readStore, writeStore } from '../analytics/store';
import { registerVideo } from '../analytics/register';

const [cmd, ...rest] = process.argv.slice(2);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q: string) => (await rl.question(q)).trim();
const yes = async (q: string, def: boolean) => { const a = (await ask(`${q} [${def ? 'Y/n' : 'y/N'}] `)).toLowerCase(); return a ? a.startsWith('y') : def; };

try {
  if (cmd === 'auth') {
    const state = randomBytes(8).toString('hex');
    console.log(`1. Open this URL, log in, and approve:\n\n${authorizeUrl(state)}\n`);
    const redirected = await ask('2. Paste the full URL you were redirected to: ');
    const u = new URL(redirected);
    if (u.searchParams.get('state') !== state) throw new Error('state mismatch: start again');
    const code = u.searchParams.get('code');
    if (!code) throw new Error(`no code in the URL (${u.searchParams.get('error') ?? 'unknown error'})`);
    const token = await exchangeCode(fetch, code);
    saveToken(token);
    console.log(`✓ connected (scopes: ${token.scope})`);
  } else if (cmd === 'post') {
    const file = rest.find((a) => !a.startsWith('--'));
    if (!file) throw new Error('usage: npm run tiktok -- post scripts/videos/<id>.yaml [--inbox] [--private-test]');
    const inbox = rest.includes('--inbox'), privateTest = rest.includes('--private-test');
    const sheet = loadBeatSheet(file);
    const video = fileURLToPath(new URL(`../out/${sheet.id}/video.mp4`, import.meta.url));

    if (!privateTest) {
      const failed = preflight(sheet).filter((c) => !c.ok);
      if (failed.length) throw new Error(`preflight failed: ${failed.map((c) => c.label).join('; ')} (run npm run preflight)`);
    }
    const token = await accessToken(fetch);
    const bytes = new Uint8Array(readFileSync(video));
    const caption = buildCaption(sheet);

    if (inbox) {
      const init = await initInboxUpload(fetch, token, statSync(video).size);
      await uploadVideo(fetch, init.upload_url, bytes);
      const s = await waitForPublish(fetch, token, init.publish_id);
      console.log(`✓ sent to your TikTok drafts (${s.status}). Open TikTok, paste this caption, and post:\n\n${caption}\n`);
    } else {
      const info = await queryCreatorInfo(fetch, token);
      console.log(`\nPosting to: ${info.creator_nickname ?? '?'} (@${info.creator_username ?? '?'})`);
      console.log(`Video: out/${sheet.id}/video.mp4\nCaption:\n---\n${caption}\n---`);
      const options = privateTest ? ['SELF_ONLY'] : info.privacy_level_options;
      if (privateTest && !info.privacy_level_options.includes('SELF_ONLY')) throw new Error('SELF_ONLY is not offered for this account');
      options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
      const pick = Number(await ask('Who can view this video? (number, no default): '));
      const privacy = options[pick - 1];
      if (!privacy) throw new Error('no privacy level chosen');
      const disable_comment = info.comment_disabled ? true : !(await yes('Allow comments?', true));
      const disable_duet = info.duet_disabled ? true : !(await yes('Allow duets?', true));
      const disable_stitch = info.stitch_disabled ? true : !(await yes('Allow stitches?', true));
      const paid = sheet.disclosures.length > 0;
      const brand_content_toggle = await yes(`Paid partnership / branded content?${paid ? ` (beat sheet lists: ${sheet.disclosures.map((d) => d.sponsor).join(', ')})` : ''}`, paid);
      const brand_organic_toggle = await yes('Promoting your own business or brand?', false);
      console.log("\nBy posting, you agree to TikTok's Music Usage Confirmation.");
      if ((await ask('Type "post" to publish: ')).toLowerCase() !== 'post') throw new Error('cancelled');

      const body = directPostBody({ caption, privacy_level: privacy, disable_comment, disable_duet, disable_stitch, brand_content_toggle, brand_organic_toggle }, info, bytes.length);
      const init = await initDirectPost(fetch, token, body);
      await uploadVideo(fetch, init.upload_url, bytes);
      console.log('uploaded; waiting for TikTok to process…');
      const s = await waitForPublish(fetch, token, init.publish_id);
      if (s.status !== 'PUBLISH_COMPLETE') throw new Error(`publish ended with ${s.status}${s.fail_reason ? `: ${s.fail_reason}` : ''}`);
      console.log(`✓ posted (${privacy})`);
      if (s.post_ids[0]) {
        const store = readStore();
        registerVideo(store, sheet, s.post_ids[0]);
        writeStore(store);
        console.log(`✓ registered for analytics as TikTok ${s.post_ids[0]}`);
      } else {
        console.log('No public post id yet (private posts have none). Register it later: npm run analytics -- register ...');
      }
      console.log('Next: pin a comment with the sources from post.txt.');
    }
  } else {
    console.error('usage: npm run tiktok -- auth | post scripts/videos/<id>.yaml [--inbox] [--private-test]');
    process.exitCode = 2;
  }
} catch (e) {
  if (e instanceof TikTokApiError && e.code === 'unaudited_client_can_only_post_to_private_accounts') {
    console.error('TikTok: your app is not audited yet, so it can only post privately. Use --private-test, or --inbox to post from the app.');
  } else console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
