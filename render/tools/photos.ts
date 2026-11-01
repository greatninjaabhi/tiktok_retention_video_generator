/**
 * `npm run photos -- "trump rally" [--n 12]`: see the candidates before choosing one. Writes a
 * numbered contact sheet to out/photos/<slug>.png and prints each photo's license and description.
 * Then fetch the winner with `npm run stock -- "<same query>" --pick <number>`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { svgToPng } from '../draw/svg';
import { searchStock, USER_AGENT_HEADERS } from '../stock/fetch';
import { imageInfo, screenFile } from '../stock/filter';
import { tokens } from '../tokens';

const args = process.argv.slice(2);
const nIdx = args.indexOf('--n');
const n = nIdx >= 0 ? Number(args[nIdx + 1]) : 12;
const query = args.filter((_, i) => nIdx < 0 || (i !== nIdx && i !== nIdx + 1)).join(' ').trim();
if (!query) {
  console.error('usage: npm run photos -- "search words" [--n 12]');
  process.exit(2);
}

const r = await searchStock(query, n);
for (const e of r.errors) console.error(`✗ ${e}`);
if (!r.candidates.length) {
  console.error(`No candidates for "${query}". Try the person's full name, or a broader or different subject.`);
  process.exit(1);
}

const CW = 400, CH = 280, COLS = 3;
let cells = '';
for (const [i, c] of r.candidates.entries()) {
  const pick = i + 1;
  const res = await fetch(c.downloadUrl, USER_AGENT_HEADERS);
  const bytes = Buffer.from(await res.arrayBuffer());
  const problem = res.ok ? screenFile(bytes) : `download failed: ${res.status}`;
  const info = imageInfo(bytes);
  console.log(`${String(pick).padStart(2)}. ${problem ? `UNUSABLE (${problem})` : `${info!.width}×${info!.height}`}  ${c.license}  by ${c.creator.slice(0, 50)}\n    ${c.text.replace(/\s+/g, ' ').slice(0, 220)}\n    ${c.pageUrl}`);
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
  const image = problem ? '' : `<image href="data:image/${info!.format};base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${CW}" height="${CH}" preserveAspectRatio="xMidYMid slice"/>`;
  cells += `${image}<rect x="${x}" y="${y}" width="56" height="48" fill="#000"/><text x="${x + 28}" y="${y + 36}" text-anchor="middle" font-family="${tokens.fonts.title.family}" font-size="34" fill="#fff">${pick}</text>`;
  await new Promise((d) => setTimeout(d, 1000)); // Commons rate-limits
}

const rows = Math.ceil(r.candidates.length / COLS);
const dir = fileURLToPath(new URL('../../out/photos/', import.meta.url));
mkdirSync(dir, { recursive: true });
const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
writeFileSync(`${dir}${slug}.png`, svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}"><rect width="100%" height="100%" fill="#fff"/>${cells}</svg>`));
console.log(`\n✓ out/photos/${slug}.png\nLook at it, then: npm run stock -- "${query}" --pick <number>`);
