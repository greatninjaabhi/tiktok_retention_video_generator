import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'tax_form', version: 1, heightHU: 1.8, accents: ['loss'], carry: 'hands',
  draw(pen) {
    pen.polygon(path([-0.7, -1.8], [0.38, -1.8], [0.7, -1.48], [0.7, 0], [-0.7, 0]), { fill: 'white' });
    pen.line(path([0.38, -1.8], [0.38, -1.48], [0.7, -1.48]), { width: 'fine', overshoot: false });
    pen.label('TAX', px(-0.12), px(-1.42), { size: 'medium', color: 'loss' });
    for (const y of [-1.0, -0.76, -0.52]) pen.line(path([-0.5, y], [0.5, y]), { width: 'fine' });
    pen.line(path([0.08, -0.24], [0.2, -0.32], [0.3, -0.2], [0.48, -0.3]), { width: 'fine', overshoot: false });
  },
});
