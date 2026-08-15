import type { GameApi } from '../../core/types';
import { Gehirnjogging } from './Gehirnjogging';
import { GehirnjoggingIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const gehirnjogging: GameApi = {
  id: 'gehirnjogging',
  title: 'Gehirnjogging',
  accent: '#f59e0b',
  Icon: GehirnjoggingIcon,
  iconVollflaechig: true,
  Component: Gehirnjogging,
};
