import { rng, saatAus } from '../../core/rng';

/**
 * Anzeige-Farben — reine Präsentation, die Logik kennt nur Zahlen (0, 1, 2 …).
 * Jede Farbe hat eine eigene, stabile Kennung (`id`), damit sich Verläufe
 * eindeutig zuordnen lassen, auch wenn für ein Level eine andere Auswahl
 * und Reihenfolge aus der Palette gezogen wird.
 */

export type FarbEintrag = {
  id: string;
  hex: string;
  dunkel: string;
  name: string;
};

export const FARBEN: readonly FarbEintrag[] = [
  { id: 'rot', hex: '#ef4444', dunkel: '#9f1d1d', name: 'Rot' },
  { id: 'orange', hex: '#f97316', dunkel: '#b1520c', name: 'Orange' },
  { id: 'gelb', hex: '#eab308', dunkel: '#9e6a06', name: 'Gelb' },
  { id: 'gruen', hex: '#22c55e', dunkel: '#157a3f', name: 'Grün' },
  { id: 'tuerkis', hex: '#14b8a6', dunkel: '#0e7568', name: 'Türkis' },
  { id: 'blau', hex: '#3b82f6', dunkel: '#1d4ea3', name: 'Blau' },
  { id: 'lila', hex: '#a855f7', dunkel: '#7620c2', name: 'Lila' },
  { id: 'pink', hex: '#ec4899', dunkel: '#a91762', name: 'Pink' },
];

/**
 * Welche Farben ein Level bekommt — aus der Levelnummer gemischt, damit
 * nicht immer dieselben ersten drei Farben (Rot/Orange/Gelb) drankommen,
 * aber bei gleicher Levelnummer bei allen dieselbe Auswahl.
 */
export function farbpaletteFuerLevel(level: number, anzahl: number): readonly FarbEintrag[] {
  const gemischt = rng(saatAus('farbsortierer-palette', level)).mischen(FARBEN);
  return gemischt.slice(0, anzahl);
}
