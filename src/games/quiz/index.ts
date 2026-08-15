import type { GameApi } from '../../core/types';
import { Quiz } from './Quiz';
import { QuizIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const quiz: GameApi = {
  id: 'quiz',
  title: 'Quiz Time',
  accent: '#22c55e',
  Icon: QuizIcon,
  iconVollflaechig: true,
  Component: Quiz,
};
