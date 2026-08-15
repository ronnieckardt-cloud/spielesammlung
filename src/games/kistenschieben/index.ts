import type { GameApi } from '../../core/types';
import { BoxPush } from './BoxPush';
import { KistenIcon } from './Icon';

/**
 * Alles, was die Hülle von diesem Spiel sehen darf.
 *
 * **Duellfähig:** Die Level sind fest von Hand gebaut — gleiche Nummer heißt
 * also bei allen wirklich dasselbe Rätsel, sogar noch verlässlicher als bei
 * den gewürfelten Spielen.
 */
export const kistenschieben: GameApi = {
  id: 'kistenschieben',
  title: 'Box Push',
  accent: '#f59e0b',
  Icon: KistenIcon,
  iconVollflaechig: true,
  duellFaehig: true,
  Component: BoxPush,
};
