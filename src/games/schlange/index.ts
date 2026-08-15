import type { GameApi } from '../../core/types';
import { Schlange } from './Schlange';
import { SchlangeIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const schlange: GameApi = {
  id: 'schlange',
  title: 'Snake Rush',
  accent: '#22c55e',
  Icon: SchlangeIcon,
  iconVollflaechig: true,
  Component: Schlange,
};
