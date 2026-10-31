import { defineProp, px } from '../../render/props/api';

export default defineProp({
  name: 'coin', version: 1, heightHU: 0.9, accents: ['highlight'], carry: 'hands',
  draw(pen) {
    pen.circle(0, px(-0.45), px(0.45), { fill: 'highlight' });
    pen.circle(0, px(-0.45), px(0.31), { width: 'fine' });
    pen.label('$', 0, px(-0.45), { size: 'medium' });
  },
});
