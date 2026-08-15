import type { GameApi } from '../../core/types';
import { TapRush } from './TapRush';
import { TempoIcon } from './Icon';

/**
 * Alles, was die Hülle von diesem Spiel sehen darf.
 *
 * **Nicht duellfähig:** Hier gibt es keine Levelnummer. Ein Duell bräuchte
 * hier nur dieselbe Rundenlänge — das wäre eine eigene Sache und ist
 * bewusst nicht mit hineingemischt.
 */
export const tempo: GameApi = {
  id: 'tempo',
  title: 'Tap Rush',
  accent: '#f43f5e',
  Icon: TempoIcon,
  iconVollflaechig: true,
  Component: TapRush,
};
