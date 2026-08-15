import type { GameApi } from '../../core/types';
import { Wortspiel } from './Wortspiel';
import { WortspielIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const wortspiel: GameApi = {
  id: 'wortspiel',
  title: 'Word Play',
  accent: '#ec4899',
  Icon: WortspielIcon,
  Component: Wortspiel,
};
