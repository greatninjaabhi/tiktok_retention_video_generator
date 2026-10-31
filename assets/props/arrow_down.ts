import { arrowHead, defineProp, path, px, u } from '../../render/props/api';

export default defineProp({
  name: 'arrow_down', version: 1, heightHU: 1.8, accents: ['loss'], carry: 'side',
  draw(pen) {
    pen.line(path([-1.0, -1.8], [-0.4, -1.08], [0, -1.34], [0.62, -0.3]), { width: 'bold', color: 'loss' });
    pen.polygon(arrowHead(u(0.74, -0.12), u(0.62, -0.3), px(0.32)), { fill: 'loss', width: 'fine', color: 'loss' });
  },
});
