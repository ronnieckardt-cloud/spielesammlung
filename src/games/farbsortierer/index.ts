import type { GameApi } from '../../core/types';
import { Farbsortierer } from './Farbsortierer';
import { FarbsortiererIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const farbsortierer: GameApi = {
  id: 'farbsortierer',
  title: 'Color Pour',
  accent: '#a855f7',
  Icon: FarbsortiererIcon,
  Component: Farbsortierer,
};
