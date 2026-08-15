import type { GameApi } from '../../core/types';
import { DropFour } from './DropFour';
import { DropFourIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const viererreihe: GameApi = {
  id: 'viererreihe',
  title: 'Drop Four',
  accent: '#2563eb',
  Icon: DropFourIcon,
  iconVollflaechig: true,
  Component: DropFour,
};
