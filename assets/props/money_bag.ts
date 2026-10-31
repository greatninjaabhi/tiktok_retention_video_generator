import { defineProp, path, px } from '../../render/props/api';

export default defineProp({
  name: 'money_bag', version: 1, heightHU: 1.55, accents: ['money'], carry: 'side',
  draw(pen) {
    pen.polygon(
      path([-0.2, -1.18], [-0.52, -0.98], [-0.72, -0.6], [-0.66, -0.2], [-0.38, -0.02], [0, 0], [0.38, -0.02], [0.66, -0.2], [0.72, -0.6], [0.52, -0.98], [0.2, -1.18]),
      { fill: 'white' },
    );
    pen.polygon(path([-0.2, -1.18], [-0.38, -1.5], [-0.12, -1.38], [0, -1.55], [0.12, -1.38], [0.38, -1.5], [0.2, -1.18]), { fill: 'white' });
    pen.line(path([-0.26, -1.2], [0.26, -1.17]), { width: 'bold', color: 'money' });
    pen.label('$', 0, px(-0.56), { size: 'large', color: 'money' });
  },
});
