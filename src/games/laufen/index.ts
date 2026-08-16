import type { GameApi } from '../../core/types';
import { DashCity } from './DashCity';
import { LaufenIcon } from './Icon';

/**
 * Alles, was die Hülle von diesem Spiel sehen darf.
 *
 * **Nicht duellfähig:** Es gibt keine Levelnummer, die Strecke wird endlos
 * aus einer Saat erzeugt. Ein Duell wäre hier zwar denkbar (gleiche Saat für
 * beide), bräuchte aber einen eigenen Weg durch die Hülle — bewusst nicht
 * mit hineingemischt.
 */
export const laufen: GameApi = {
  id: 'laufen',
  title: 'Dash City',
  accent: '#ea3eca',
  Icon: LaufenIcon,
  iconVollflaechig: true,
  Component: DashCity,
};
