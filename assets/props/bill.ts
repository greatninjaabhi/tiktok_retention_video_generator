import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'bill', version: 1, heightHU: 0.95, accents: ['money'], carry: 'hands',
  draw(pen) {
    pen.rect(px(-1), px(-0.95), px(2), px(0.95), { fill: 'money' });
    pen.rect(px(-0.84), px(-0.82), px(1.68), px(0.69), { width: 'fine' });
    pen.circle(0, px(-0.475), px(0.25), { fill: 'white', width: 'fine' });
    pen.label('$', 0, px(-0.475), { size: 'small', color: 'money' });
    pen.line(path([-0.66, -0.3], [-0.42, -0.3]), { width: 'fine', color: 'white' });
    pen.line(path([0.42, -0.65], [0.66, -0.65]), { width: 'fine', color: 'white' });
  },
});
