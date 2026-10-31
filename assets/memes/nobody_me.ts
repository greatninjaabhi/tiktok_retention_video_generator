import { bust, defineMeme } from '../../render/memes/api';

// Format: "Nobody: / X:" text setup, then the absurd reaction. Our own drawing.
export default defineMeme({
  name: 'nobody_me', version: 1, kind: 'panel', slots: ['who'], durationSec: 2.4,
  draw(pen, { box, text, progress }) {
    pen.rect(box.x, box.y, box.w, box.h, { fill: 'white', outline: false });
    pen.label('NOBODY:', box.x + box.w * 0.3, box.y + 80, { size: 'medium' });
    if (progress > 0.25) pen.label(`${text.who ?? 'ME'}:`, box.x + box.w * 0.3, box.y + 170, { size: 'medium', color: 'loss' });
    if (progress > 0.45) pen.element('react', () => bust(pen, 'shocked', box.x + box.w * 0.7, box.y + box.h * 0.45));
  },
});
