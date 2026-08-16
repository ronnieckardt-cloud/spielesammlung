import type { GameApi } from '../../core/types';
import { FlowMtb } from './FlowMtb';
import { MtbIcon } from './Icon';

/**
 * Nicht duellfähig: Es gibt keine Levelnummer — jede Runde ist eine eigene
 * Strecke. Ein Duell bräuchte für beide Spieler dieselbe Strecke, das wäre
 * eine spätere Erweiterung über `startLevel`.
 */
export const radfahren: GameApi = {
  id: 'radfahren',
  title: 'Flow MTB',
  accent: '#38d9a9',
  Icon: MtbIcon,
  iconVollflaechig: true,
  Component: FlowMtb,
};
