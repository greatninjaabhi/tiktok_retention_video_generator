import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'ballot_box', version: 1, heightHU: 1.9, accents: ['money'], carry: 'hands',
  draw(pen) {
    pen.at({ x: px(0.1), y: px(-1.3), rot: 0.12 }, () => {
      pen.rect(px(-0.4), px(-0.6), px(0.8), px(0.9), { fill: 'white' });
      pen.line(path([-0.22, -0.12], [-0.06, 0.04], [0.24, -0.34]), { width: 'bold', color: 'money', overshoot: false });
    });
    pen.rect(px(-0.9), px(-1.25), px(1.8), px(1.25), { fill: 'white' });
    pen.rect(px(-0.5), px(-1.25), px(1.0), px(0.1), { fill: 'ink', width: 'fine' });
    pen.label('VOTE', 0, px(-0.6), { size: 'medium' });
  },
});
