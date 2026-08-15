import type { GameApi } from '../../core/types';
import { EvenCut } from './EvenCut';
import { HalbierenIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const halbieren: GameApi = {
  id: 'halbieren',
  title: 'Even Cut',
  accent: '#14b8a6',
  Icon: HalbierenIcon,
  iconVollflaechig: true,
  // Gleiche Levelnummer ergibt dasselbe Rätsel — damit duellfähig.
  duellFaehig: true,
  Component: EvenCut,
};
