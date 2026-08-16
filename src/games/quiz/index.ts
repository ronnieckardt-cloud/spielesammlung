import type { GameApi } from '../../core/types';
import { Quiz } from './Quiz';
import { QuizIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const quiz: GameApi = {
  id: 'quiz',
  title: 'Quiz Time',
  accent: '#3eea94',
  Icon: QuizIcon,
  iconVollflaechig: true,
  // Gleiche Levelnummer ergibt dasselbe Rätsel — damit duellfähig.
  duellFaehig: true,
  Component: Quiz,
};
