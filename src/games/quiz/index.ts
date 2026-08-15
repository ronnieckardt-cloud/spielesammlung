import type { GameApi } from '../../core/types';
import { Quiz } from './Quiz';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const quiz: GameApi = {
  id: 'quiz',
  title: 'Wissensquiz',
  blurb: 'Zehn Fragen pro Level — allgemeines Wissen, gleiche Nummer für alle.',
  accent: '#22c55e',
  symbol: '🧠',
  Component: Quiz,
};
