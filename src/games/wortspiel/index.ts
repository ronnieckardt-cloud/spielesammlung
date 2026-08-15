import type { GameApi } from '../../core/types';
import { Wortspiel } from './Wortspiel';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const wortspiel: GameApi = {
  id: 'wortspiel',
  title: 'Wortspiel',
  blurb: 'Welches Wort ist richtig geschrieben? Rechtschreibtraining, Level für Level schwerer.',
  accent: '#ec4899',
  symbol: '✏️',
  Component: Wortspiel,
};
