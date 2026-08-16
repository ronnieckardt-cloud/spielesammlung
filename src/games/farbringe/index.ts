import type { GameApi } from '../../core/types';
import { RingRise } from './RingRise';
import { FarbringeIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const farbringe: GameApi = {
  id: 'farbringe',
  title: 'Ring Rise',
  accent: '#74ea3e',
  Icon: FarbringeIcon,
  iconVollflaechig: true,
  Component: RingRise,
};
