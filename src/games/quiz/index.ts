import type { GameApi } from '../../core/types';
import { Quiz } from './Quiz';
import { QuizIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const quiz: GameApi = {
  id: 'quiz',
  title: 'Quiz Time',
  // Warmes Orange als Schatten unter dem marineblau-goldenen Symbol. Das reine Gold der Leiter (#fbbf24) lag nur 6°
  // neben Box Push und 18° neben Brain Blitz — `spielfarbe.test.ts` verlangt Abstand zwischen den Kachelfarben.
  // Die Oberfläche der Hülle tönt Quiz Time weiter in Indigo (`spielfarbe.ts`).
  accent: '#f97316',
  Icon: QuizIcon,
  iconVollflaechig: true,
  // Gleiche Levelnummer ergibt dasselbe Rätsel — damit duellfähig.
  duellFaehig: true,
  Component: Quiz,
};
