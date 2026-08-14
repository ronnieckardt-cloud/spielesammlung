import type { GameApi } from '../../core/types';
import { Farbsortierer } from './Farbsortierer';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const farbsortierer: GameApi = {
  id: 'farbsortierer',
  title: 'Farbsortierer',
  blurb: 'Sortiere Farbschichten in Röhrchen — jedes Level lösbar, gleiche Nummer für alle.',
  accent: '#a855f7',
  symbol: '🧪',
  Component: Farbsortierer,
};
