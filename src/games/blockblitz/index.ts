import type { GameApi } from '../../core/types';
import { Blockblitz } from './Blockblitz';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const blockblitz: GameApi = {
  id: 'blockblitz',
  title: 'Blockblitz',
  blurb: 'Ziehe Teile aufs Raster und lös volle Reihen und Spalten auf.',
  accent: '#38bdf8',
  symbol: '🧩',
  Component: Blockblitz,
};
