import type { GameApi } from '../../core/types';
import { Platzhalter } from './Platzhalter';
import { PlatzhalterIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const platzhalter: GameApi = {
  id: 'platzhalter',
  title: 'Star Dash',
  accent: '#7dd3fc',
  Icon: PlatzhalterIcon,
  iconVollflaechig: true,
  Component: Platzhalter,
};
