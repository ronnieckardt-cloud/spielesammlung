import type { GameApi } from '../../core/types';
import { Gehirnjogging } from './Gehirnjogging';
import { GehirnjoggingIcon } from './Icon';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const gehirnjogging: GameApi = {
  id: 'gehirnjogging',
  title: 'Brain Blitz',
  // Violett statt des früheren Bernstein: Das App-Symbol steht seit dem
  // Umbau auf Indigo/Violett (siehe Icon.tsx), und der Akzent färbt den
  // Schatten unter der Kachel, den Rand in der Bestenliste und die Tönung
  // der Spieloberfläche — ein bernsteinfarbener Schein unter einem
  // violetten Symbol sah nach Versehen aus.
  accent: '#e7ea3e',
  Icon: GehirnjoggingIcon,
  iconVollflaechig: true,
  // Gleiche Levelnummer ergibt dasselbe Rätsel — damit duellfähig.
  duellFaehig: true,
  Component: Gehirnjogging,
};
