/**
 * Visual regression (brief §1.3). Every pose and prop is drawn with a fixed seed and the
 * resulting SVG geometry is compared with the approved snapshot in tests/visual/.
 * An unexpected diff fails CI. To approve an intentional change: `npm run test:update`,
 * then look at `npm run contact-sheet` output before committing.
 */
import { describe, expect, it } from 'vitest';
import { Pen } from '../render/draw/pen';
import { itemsToSvg, toSvg } from '../render/draw/svg';
import { drawCharacter } from '../render/character/draw';
import { drawProp } from '../render/props/place';
import { HU } from '../render/tokens';
import { still } from '../render/tools/sheets';
import { stickman, POSE_NAMES } from '../assets/characters/stickman/character';
import { PROPS } from '../assets/props/index';

const W = 6 * HU, H = 7 * HU;

describe('visual snapshots', () => {
  it.each(POSE_NAMES)('pose %s', async (name) => {
    const pen = new Pen({ seed: 'snapshot' });
    drawCharacter(pen, stickman, still(stickman, name), { x: W / 2, y: H - 0.5 * HU });
    await expect(toSvg(itemsToSvg(pen.items), { width: W, height: H })).toMatchFileSnapshot(`./visual/pose-${name}.svg`);
  });
  it.each(Object.keys(PROPS))('prop %s', async (name) => {
    const pen = new Pen({ seed: 'snapshot' });
    drawProp(pen, PROPS[name]!, { x: 2 * HU, y: 3.5 * HU });
    await expect(toSvg(itemsToSvg(pen.items), { width: 4 * HU, height: 4 * HU })).toMatchFileSnapshot(`./visual/prop-${name}.svg`);
  });
});

describe('meme snapshots', () => {
  it.each(['expectation_reality', 'nobody_me'])('meme %s', async (name) => {
    const { MEMES } = await import('../assets/memes/index');
    const { PANEL } = await import('../render/stock/panel');
    const m = MEMES[name]!;
    if (m.kind !== 'panel') throw new Error('panel meme expected');
    const pen = new Pen({ seed: 'snapshot' });
    m.draw(pen, { box: PANEL, progress: 1, text: {} });
    await expect(toSvg(itemsToSvg(pen.items), { width: 1080, height: 760 })).toMatchFileSnapshot(`./visual/meme-${name}.svg`);
  });
});
