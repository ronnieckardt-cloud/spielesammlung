import type { GameApi } from '../../core/types';
import { BubblePop } from './BubblePop';
import { BubblePopIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const bubblepop: GameApi = {
  id: 'bubblepop',
  title: 'Bubble Pop',
  accent: '#d946ef',
  Icon: BubblePopIcon,
  iconVollflaechig: true,
  Component: BubblePop,
};
