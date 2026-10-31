import { defineProp, path, px, u } from '../../render/props/api';

export default defineProp({
  name: 'gavel', version: 1, heightHU: 1.5, accents: ['highlight'], carry: 'hands',
  draw(pen) {
    pen.rect(px(-0.75), px(-0.22), px(1.5), px(0.22), { fill: 'white' });
    pen.at({ x: px(-0.15), y: px(-0.95), rot: -0.6 }, () => {
      pen.line([u(0.1, 0), u(1.25, 0)], { width: 'bold' });
      pen.rect(px(-0.5), px(-0.24), px(0.62), px(0.48), { fill: 'highlight' });
      pen.line(path([-0.35, -0.24], [-0.35, 0.24]), { width: 'fine', overshoot: false });
      pen.line(path([-0.03, -0.24], [-0.03, 0.24]), { width: 'fine', overshoot: false });
    });
    pen.line(path([-0.95, -0.55], [-1.15, -0.65]), { width: 'fine' });
    pen.line(path([-0.95, -0.35], [-1.2, -0.35]), { width: 'fine' });
  },
});
