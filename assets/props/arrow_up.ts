import { arrowHead, defineProp, path, px, u } from '../../render/props/api';

export default defineProp({
  name: 'arrow_up', version: 1, heightHU: 1.8, accents: ['money'], carry: 'side',
  draw(pen) {
    pen.line(path([-1.0, 0], [-0.4, -0.72], [0, -0.46], [0.7, -1.4]), { width: 'bold', color: 'money' });
    pen.polygon(arrowHead(u(0.82, -1.56), u(0.7, -1.4), px(0.32)), { fill: 'money', width: 'fine', color: 'money' });
  },
});
