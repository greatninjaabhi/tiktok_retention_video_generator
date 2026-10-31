import { describe, expect, it } from 'vitest';
import { lintProp, lintPropSources, lintTokens } from '../render/lint/style-lint';
import { defineProp, px } from '../render/props/api';
import { PROPS } from '../assets/props/index';

describe('style lint', () => {
  it('tokens pass (contrast, fonts)', () => expect(lintTokens()).toEqual([]));
  it('prop sources only use the prop API', () => expect(lintPropSources()).toEqual([]));
  it.each(Object.keys(PROPS))('%s passes', (name) => expect(lintProp(PROPS[name]!)).toEqual([]));

  it('catches a prop drawn off the size grid', () => {
    const bad = defineProp({ name: 'bad', version: 1, heightHU: 1, accents: [], carry: 'side', draw: (pen) => pen.rect(0, px(-3), px(1), px(3)) });
    expect(lintProp(bad).map((i) => i.rule)).toContain('size-grid');
  });
  it('catches the reserved character color and undeclared accents', () => {
    const bad = defineProp({ name: 'bad', version: 1, heightHU: 1, accents: [], carry: 'side', draw: (pen) => pen.rect(0, px(-1), px(1), px(1), { fill: 'signature' }) });
    const rules = lintProp(bad).map((i) => i.rule);
    expect(rules).toContain('reserved-color');
    expect(rules).toContain('accents');
  });
});
