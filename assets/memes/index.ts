import type { MemeDef } from '../../render/memes/api';
import expectation_reality from './expectation_reality';
import nobody_me from './nobody_me';
import zoom_stare from './zoom_stare';

export const MEMES: Record<string, MemeDef> = Object.fromEntries(
  [expectation_reality, nobody_me, zoom_stare].map((m) => [m.name, m]),
);
