import { defineProp, path, px } from '../../render/props/api';

// Red on purpose: in our palette `loss` = debt / warning.
export default defineProp({
  name: 'credit_card', version: 1, heightHU: 1.15, accents: ['loss', 'highlight'], carry: 'hands',
  draw(pen) {
    pen.rect(px(-0.9), px(-1.15), px(1.8), px(1.15), { fill: 'loss' });
    pen.rect(px(-0.68), px(-0.86), px(0.34), px(0.26), { fill: 'highlight', width: 'fine' });
    for (let i = 0; i < 4; i++) {
      const x = -0.68 + i * 0.36;
      pen.line(path([x, -0.36], [x + 0.24, -0.36]), { width: 'main', color: 'white' });
    }
  },
});
