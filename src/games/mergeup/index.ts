import type { GameApi } from '../../core/types';
import { MergeUp } from './MergeUp';
import { MergeUpIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const mergeup: GameApi = {
  id: 'mergeup',
  title: 'Merge Up',
  accent: '#0891b2',
  Icon: MergeUpIcon,
  Component: MergeUp,
};
