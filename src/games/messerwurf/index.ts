import type { GameApi } from '../../core/types';
import { BladeToss } from './BladeToss';
import { BladeTossIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const messerwurf: GameApi = {
  id: 'messerwurf',
  title: 'Blade Toss',
  // Limette statt Bernstein: Der Akzent trägt den farbigen Schatten unter
  // der Kachel, und der lag mit `#d97706` praktisch auf dem `#f59e0b` von
  // Box Push. Zusammen mit dem neuen Waldgrün im Symbol sind die beiden
  // Kacheln jetzt auch bei 64 Pixeln auseinanderzuhalten.
  accent: '#84cc16',
  Icon: BladeTossIcon,
  iconVollflaechig: true,
  Component: BladeToss,
};
