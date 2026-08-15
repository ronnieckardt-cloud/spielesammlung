import type { GameApi } from '../../core/types';
import { FlowLink } from './FlowLink';
import { VerbindenIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const verbinden: GameApi = {
  id: 'verbinden',
  title: 'Flow Link',
  accent: '#818cf8',
  Icon: VerbindenIcon,
  iconVollflaechig: true,
  // Gleiche Levelnummer ergibt dasselbe Rätsel — damit duellfähig.
  duellFaehig: true,
  Component: FlowLink,
};
