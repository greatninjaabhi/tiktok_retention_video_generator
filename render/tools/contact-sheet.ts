/**
 * `npm run contact-sheet`: renders the approved-look gallery (docs/gallery/contact-sheet.png)
 * and one thumbnail per prop (assets/props/thumbs/<name>.png). Review these by eye on every
 * style change; the geometry itself is locked by the snapshot tests in tests/visual/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { itemsToSvg, svgToPng, toSvg } from '../draw/svg';
import { contactSheet, propSheet } from './sheets';
import { PROPS } from '../../assets/props/index';
import { stickman, POSE_NAMES } from '../../assets/characters/stickman/character';

const root = fileURLToPath(new URL('../../', import.meta.url));
mkdirSync(root + 'docs/gallery', { recursive: true });
mkdirSync(root + 'assets/props/thumbs', { recursive: true });

const sheet = contactSheet(stickman, POSE_NAMES, Object.values(PROPS));
writeFileSync(root + 'docs/gallery/contact-sheet.png', svgToPng(toSvg(itemsToSvg(sheet.items), sheet)));
console.log('wrote docs/gallery/contact-sheet.png');

for (const p of Object.values(PROPS)) {
  const s = propSheet(p);
  writeFileSync(root + `assets/props/thumbs/${p.name}.png`, svgToPng(toSvg(itemsToSvg(s.items), s)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop thumbnails to assets/props/thumbs/`);
