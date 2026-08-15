import type { GameApi } from '../../core/types';
import { BladeToss } from './BladeToss';
import { BladeTossIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const messerwurf: GameApi = {
  id: 'messerwurf',
  title: 'Blade Toss',
  accent: '#d97706',
  Icon: BladeTossIcon,
  iconVollflaechig: true,
  Component: BladeToss,
};
