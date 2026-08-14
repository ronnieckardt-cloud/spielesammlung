import type { GameApi } from '../../core/types';
import { Platzhalter } from './Platzhalter';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const platzhalter: GameApi = {
  id: 'platzhalter',
  title: 'Sternenfang',
  blurb: 'Fang mit deiner Katze Sterne, bevor die Zeit abläuft.',
  accent: '#7dd3fc',
  symbol: '★',
  Component: Platzhalter,
};
