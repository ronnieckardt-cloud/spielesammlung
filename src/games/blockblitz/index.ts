import type { GameApi } from '../../core/types';
import { Blockblitz } from './Blockblitz';
import { BlockblitzIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const blockblitz: GameApi = {
  id: 'blockblitz',
  title: 'Block Burst',
  accent: '#38bdf8',
  Icon: BlockblitzIcon,
  Component: Blockblitz,
};
