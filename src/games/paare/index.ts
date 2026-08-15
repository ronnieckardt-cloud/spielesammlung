import type { GameApi } from '../../core/types';
import { PaarUp } from './PaarUp';
import { PaarUpIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const paare: GameApi = {
  id: 'paare',
  title: 'Pair Up',
  accent: '#6366f1',
  Icon: PaarUpIcon,
  iconVollflaechig: true,
  Component: PaarUp,
};
