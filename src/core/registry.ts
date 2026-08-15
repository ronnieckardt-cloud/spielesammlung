import type { GameApi } from './types';
import { platzhalter } from '../games/platzhalter';
import { farbsortierer } from '../games/farbsortierer';
import { blockblitz } from '../games/blockblitz';
import { reihenfall } from '../games/reihenfall';
import { geisterjagd } from '../games/geisterjagd';
import { quiz } from '../games/quiz';
import { gehirnjogging } from '../games/gehirnjogging';

/**
 * Die einzige Liste aller Spiele. Ein neues Spiel wird hier eingetragen —
 * und sonst nirgends. Die Reihenfolge ist die Reihenfolge im Menü.
 */
export const spiele: readonly GameApi[] = [
  platzhalter,
  farbsortierer,
  blockblitz,
  reihenfall,
  geisterjagd,
  quiz,
  gehirnjogging,
];

export function spielFinden(id: string): GameApi | undefined {
  return spiele.find((spiel) => spiel.id === id);
}
