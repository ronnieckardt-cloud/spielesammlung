import type { GameApi } from './types';
import { platzhalter } from '../games/platzhalter';
import { farbsortierer } from '../games/farbsortierer';
import { blockblitz } from '../games/blockblitz';

/**
 * Die einzige Liste aller Spiele. Ein neues Spiel wird hier eingetragen —
 * und sonst nirgends. Die Reihenfolge ist die Reihenfolge im Menü.
 */
export const spiele: readonly GameApi[] = [platzhalter, farbsortierer, blockblitz];

export function spielFinden(id: string): GameApi | undefined {
  return spiele.find((spiel) => spiel.id === id);
}
