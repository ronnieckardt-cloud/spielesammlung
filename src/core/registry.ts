import type { GameApi } from './types';
import { platzhalter } from '../games/platzhalter';
import { farbsortierer } from '../games/farbsortierer';
import { blockblitz } from '../games/blockblitz';
import { reihenfall } from '../games/reihenfall';
import { geisterjagd } from '../games/geisterjagd';
import { quiz } from '../games/quiz';
import { gehirnjogging } from '../games/gehirnjogging';
import { wortspiel } from '../games/wortspiel';
import { schlange } from '../games/schlange';
import { mergeup } from '../games/mergeup';
import { bubblepop } from '../games/bubblepop';
import { paare } from '../games/paare';
import { messerwurf } from '../games/messerwurf';
import { viererreihe } from '../games/viererreihe';
import { farbringe } from '../games/farbringe';

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
  wortspiel,
  schlange,
  mergeup,
  bubblepop,
  paare,
  messerwurf,
  viererreihe,
  farbringe,
];

export function spielFinden(id: string): GameApi | undefined {
  return spiele.find((spiel) => spiel.id === id);
}
