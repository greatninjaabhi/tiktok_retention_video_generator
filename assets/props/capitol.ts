import { defineProp, path, px } from '../../render/props/api';

// Generic domed government building (not a specific real building's exact design).
export default defineProp({
  name: 'capitol', version: 1, heightHU: 2.6, accents: [], carry: 'side',
  draw(pen) {
    pen.rect(px(-1.4), px(-0.22), px(2.8), px(0.22), { fill: 'white' });
    pen.rect(px(-1.2), px(-1.05), px(2.4), px(0.83), { fill: 'white' });
    for (const x of [-0.9, -0.5, -0.1, 0.3, 0.7]) pen.line(path([x + 0.1, -0.98], [x + 0.1, -0.3]), { width: 'fine', overshoot: false });
    pen.polygon(path([-1.3, -1.05], [0, -1.32], [1.3, -1.05]), { fill: 'white' });
    pen.rect(px(-0.45), px(-1.62), px(0.9), px(0.3), { fill: 'white' });
    pen.polygon(path([-0.52, -1.62], [-0.46, -1.95], [-0.3, -2.2], [0, -2.32], [0.3, -2.2], [0.46, -1.95], [0.52, -1.62]), { fill: 'white' });
    pen.hatch(path([-0.42, -1.66], [-0.36, -1.94], [0, -2.24], [0.36, -1.94], [0.42, -1.66]), 'ink', { spacing: 16 });
    pen.line(path([0, -2.32], [0, -2.6]), { width: 'main' });
  },
});
