import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'house', version: 1, heightHU: 2.4, accents: ['highlight'], carry: 'side',
  draw(pen) {
    pen.rect(px(-0.95), px(-1.45), px(1.9), px(1.45), { fill: 'white' });
    const roof = path([-1.15, -1.38], [0, -2.4], [1.15, -1.38]);
    pen.polygon(roof, { fill: 'white' });
    pen.hatch(path([-0.8, -1.5], [0, -2.22], [0.8, -1.5]));
    pen.rect(px(-0.22), px(-0.78), px(0.44), px(0.78), { fill: 'highlight' });
    pen.dot(px(0.12), px(-0.38), px(0.04));
    for (const x of [-0.72, 0.4]) {
      pen.rect(px(x), px(-1.2), px(0.32), px(0.32), { width: 'fine' });
      pen.line(path([x + 0.16, -1.2], [x + 0.16, -0.88]), { width: 'fine', overshoot: false });
    }
  },
});
