/**
 * `npm run stock -- "piggy bank savings" [--n 3]`: search the commercial-use sources,
 * screen out AI-tagged / attribution-required / too-small images, download the rest into
 * assets/stock/cache/ and log their licenses in assets/stock/manifest.json.
 */
import { download, repoPath, searchStock } from '../stock/fetch';
import { localCandidates } from '../stock/local';

const args = process.argv.slice(2);
const nIdx = args.indexOf('--n');
const n = nIdx >= 0 ? Number(args[nIdx + 1]) : 3;
const query = args.filter((_, i) => nIdx < 0 || (i !== nIdx && i !== nIdx + 1)).join(' ').trim();
if (!query) {
  console.error('usage: npm run stock -- "search words" [--n 3]');
  process.exit(2);
}

for (const s of localCandidates().skipped) console.warn(`! inbox/stock/${s}`);
const r = await searchStock(query, n);
for (const p of r.skippedProviders) console.log(`- skipped ${p}`);
for (const e of r.errors) console.error(`✗ ${e}`);
for (const x of r.rejected) console.log(`- rejected ${x.id}: ${x.reason}`);
let saved = 0;
for (const c of r.candidates) {
  try {
    const file = await download(c, query);
    saved++;
    console.log(`✓ ${c.id}  ${c.width}×${c.height}  ${c.license}  by ${c.creator}\n  ${c.pageUrl}\n  → ${repoPath(file)}`);
  } catch (e) {
    console.log(`- rejected ${(e as Error).message}`);
  }
}
if (!saved) {
  console.error(`No usable images for "${query}".`);
  process.exit(1);
}
