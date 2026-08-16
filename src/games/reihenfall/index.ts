import type { GameApi } from '../../core/types';
import { Reihenfall } from './Reihenfall';
import { ReihenfallIcon } from './Icon';

/**
 * Alles, was die Hülle von diesem Spiel sehen darf.
 *
 * Der Akzent liegt jetzt in der Farbfamilie des App-Symbols (Verlauf
 * `#4338ca → #4c1d95 → #1e1b4b`, siehe `Icon.tsx`). Vorher war er Rose
 * (`#f43f5e`) — ein rosa Schlagschatten unter einer indigo-violetten Kachel,
 * als gehörten Symbol und Kachel nicht zusammen. Von allen zwanzig Spielen
 * waren nur Line Fall und Quiz Time so gebaut, alle anderen achtzehn bleiben
 * in ihrer Familie.
 *
 * **Nicht** der Verlaufsstopp `#4338ca` selbst: Die Hülle setzt den Akzent
 * auch als Textfarbe (Spieltitel in der Kopfzeile, Endpunktzahl) und als
 * Hintergrund des „Nochmal"-Knopfes mit dunkler Schrift darauf. `#4338ca`
 * ist dafür zu dunkel — auf dem dunklen Grund kämen nur noch gut 2:1
 * Kontrast heraus, lesbar ist das nicht mehr. `#818cf8` ist der helle
 * Geschwisterton derselben Familie und liegt überall über 5:1. Genauso
 * machen es Ghost Chase und Ring Rise, deren Verläufe ähnlich dunkel sind.
 */
export const reihenfall: GameApi = {
  id: 'reihenfall',
  title: 'Line Fall',
  accent: '#818cf8',
  Icon: ReihenfallIcon,
  iconVollflaechig: true,
  Component: Reihenfall,
};
