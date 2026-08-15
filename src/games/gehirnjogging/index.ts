import type { GameApi } from '../../core/types';
import { Gehirnjogging } from './Gehirnjogging';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const gehirnjogging: GameApi = {
  id: 'gehirnjogging',
  title: 'Gehirnjogging',
  blurb: 'Kopfrechnen, Merk-Folgen und Muster erkennen im Wechsel — Level für Level schwerer.',
  accent: '#f59e0b',
  symbol: '🧮',
  Component: Gehirnjogging,
};
