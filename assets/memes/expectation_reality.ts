import { bust, defineMeme } from '../../render/memes/api';

// Format: two-panel "expectation vs reality". Our own drawing of the structure.
export default defineMeme({
  name: 'expectation_reality', version: 1, kind: 'panel', slots: ['left', 'right'], durationSec: 2.2,
  draw(pen, { box, text, progress }) {
    const half = box.w / 2;
    pen.rect(box.x, box.y, box.w, box.h, { fill: 'white', outline: false });
    pen.line([{ x: box.x + half, y: box.y }, { x: box.x + half, y: box.y + box.h }], { width: 'bold' });
    pen.label(text.left ?? 'EXPECTATION', box.x + half / 2, box.y + 60, { size: 'medium' });
    pen.label(text.right ?? 'REALITY', box.x + half * 1.5, box.y + 60, { size: 'medium', color: 'loss' });
    pen.element('left', () => bust(pen, 'celebrate', box.x + half / 2, box.y + box.h * 0.48));
    // The reality side lands a beat later: that's the joke's timing.
    if (progress > 0.35) pen.element('right', () => bust(pen, 'idle', box.x + half * 1.5, box.y + box.h * 0.5, { expression: 'sad' }));
  },
});
