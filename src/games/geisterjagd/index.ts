import type { GameApi } from '../../core/types';
import { Geisterjagd } from './Geisterjagd';
import { GeisterjagdIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const geisterjagd: GameApi = {
  id: 'geisterjagd',
  title: 'Ghost Chase',
  accent: '#a78bfa',
  Icon: GeisterjagdIcon,
  Component: Geisterjagd,
};
