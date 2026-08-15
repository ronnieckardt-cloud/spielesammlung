import type { GameApi } from '../../core/types';
import { Reihenfall } from './Reihenfall';
import { ReihenfallIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const reihenfall: GameApi = {
  id: 'reihenfall',
  title: 'Line Fall',
  accent: '#f43f5e',
  Icon: ReihenfallIcon,
  Component: Reihenfall,
};
