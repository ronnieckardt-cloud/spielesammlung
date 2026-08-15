import type { GameApi } from '../../core/types';
import { Geisterjagd } from './Geisterjagd';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const geisterjagd: GameApi = {
  id: 'geisterjagd',
  title: 'Geisterjagd',
  blurb: 'Punkte fressen, vier Geistern mit je eigener Taktik ausweichen.',
  accent: '#a78bfa',
  symbol: '👻',
  Component: Geisterjagd,
};
