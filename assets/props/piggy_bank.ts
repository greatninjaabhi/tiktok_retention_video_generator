import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'piggy_bank', version: 1, heightHU: 1.5, accents: ['highlight'], carry: 'hands',
  draw(pen) {
    pen.line(path([-0.45, -0.3], [-0.45, 0]));
    pen.line(path([0.4, -0.3], [0.4, 0]));
    pen.line(path([-0.84, -0.82], [-1.02, -0.98], [-0.9, -1.08], [-0.86, -0.94]), { width: 'fine', overshoot: false });
    pen.ellipse(0, px(-0.74), px(0.86), px(0.58), { fill: 'white' });
    pen.polygon(path([0.26, -1.2], [0.44, -1.5], [0.58, -1.16]), { fill: 'white', width: 'fine' });
    pen.ellipse(px(0.88), px(-0.72), px(0.13), px(0.19), { fill: 'white', width: 'fine' });
    pen.dot(px(0.86), px(-0.77), px(0.03));
    pen.dot(px(0.86), px(-0.66), px(0.03));
    pen.dot(px(0.52), px(-0.9), px(0.05));
    pen.line(path([-0.24, -1.22], [0.12, -1.24]), { width: 'bold' });
    pen.circle(px(-0.06), px(-1.38), px(0.12), { fill: 'highlight', width: 'fine' });
  },
});
