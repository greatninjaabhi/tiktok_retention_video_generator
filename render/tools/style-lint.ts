/** `npm run lint:style`: lints tokens, every prop, prop sources, and every pose × expression. Exit 1 on any issue. */
import { Pen } from '../draw/pen';
import { drawCharacter } from '../character/draw';
import { lintItems, lintProp, lintPropSources, lintTokens, type Issue } from '../lint/style-lint';
import { PROPS } from '../../assets/props/index';
import { stickman, POSE_NAMES } from '../../assets/characters/stickman/character';
import type { ExpressionName } from '../character/types';

const issues: Issue[] = [...lintTokens(), ...lintPropSources()];
for (const def of Object.values(PROPS)) issues.push(...lintProp(def));
for (const pose of POSE_NAMES) {
  for (const expression of Object.keys(stickman.expressions) as ExpressionName[]) {
    const pen = new Pen({ seed: 'lint' });
    drawCharacter(pen, stickman, { pose: stickman.poses[pose], expression, mouth: null, blink: false, breathe: 0, breatheHU: 0, tieFlapDeg: 0 }, { x: 0, y: 0 });
    issues.push(...lintItems(`${stickman.id}:${pose}:${expression}`, pen.items));
  }
}

if (issues.length) {
  for (const i of issues) console.error(`✗ ${i.target} [${i.rule}] ${i.message}`);
  console.error(`\n${issues.length} style issue(s).`);
  process.exit(1);
}
console.log(`✓ style lint passed: tokens, ${Object.keys(PROPS).length} props, ${POSE_NAMES.length} poses × ${Object.keys(stickman.expressions).length} expressions`);
