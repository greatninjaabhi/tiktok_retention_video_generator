import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'megaphone', version: 1, heightHU: 1.3, accents: ['highlight'], carry: 'side',
  draw(pen) {
    pen.line(path([-0.55, -0.42], [-0.45, 0]), { width: 'bold' });
    pen.polygon(path([-1.0, -0.82], [-0.55, -0.82], [0.55, -1.25], [0.55, -0.15], [-0.55, -0.55], [-1.0, -0.55]), { fill: 'highlight' });
    pen.ellipse(px(0.55), px(-0.7), px(0.12), px(0.55), { fill: 'white' });
    for (const [a, b] of [[-1.15, -1.3], [-0.7, -0.7], [-0.25, -0.1]] as const) pen.line(path([0.85, a * 0.55 - 0.1], [1.15, b * 0.55 - 0.1]), { width: 'main' });
  },
});
