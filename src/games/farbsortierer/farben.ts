import { rng, saatAus } from '../../core/rng';

/**
 * Anzeige-Farben — reine Präsentation, die Logik kennt nur Zahlen (0, 1, 2 …).
 * Jede Farbe hat eine eigene, stabile Kennung (`id`), damit sich Verläufe
 * eindeutig zuordnen lassen, auch wenn für ein Level eine andere Auswahl
 * und Reihenfolge aus der Palette gezogen wird.
 *
 * **Aufgeteilt in Helle und Dunkle.** Vorher lagen alle acht Farben auf
 * derselben Helligkeitsstufe (kräftiges Mittelblau, Mittelgrün, Mittelrot …).
 * Nebeneinander im Röhrchen sah das flau aus, weil sich nur der Farbton
 * unterschied und nicht die Helligkeit. Rückmeldung: „mehr Kontraste, so
 * hellgelb und dunkellila, nicht nur so normale Farben."
 *
 * Deshalb spannt die Palette jetzt beides auf, und `farbpaletteFuerLevel`
 * nimmt abwechselnd aus beiden Töpfen — jedes Level bekommt also von sich
 * aus helle *und* dunkle Farben, nicht zufällig fünf mitteldunkle.
 *
 * Nebeneffekt fürs Sehen: Helligkeitsunterschiede bleiben auch dann
 * erhalten, wenn Farbtöne schwer zu trennen sind. Die Farbnamen im
 * `aria-label` der Röhrchen gibt es zusätzlich weiterhin.
 */

export type FarbEintrag = {
  id: string;
  hex: string;
  dunkel: string;
  name: string;
};

/**
 * `dunkel` ist nur das untere Ende des Verlaufs in einer Schicht (siehe
 * `FarbMusterDefs.tsx`), **nicht** eine zweite Farbe. Deshalb bleibt es bei
 * den hellen Tönen bewusst hell: Mit einem kräftigen Absacker wurde aus
 * Hellgelb unten ein Oliv, und der ganze Sinn der Aufteilung war dahin.
 */

/** Helle Töne — hoher Weißanteil, Verlauf bleibt innerhalb der Stufe. */
const HELLE: readonly FarbEintrag[] = [
  { id: 'hellgelb', hex: '#fef08a', dunkel: '#facc15', name: 'Hellgelb' },
  { id: 'hellblau', hex: '#bae6fd', dunkel: '#38bdf8', name: 'Hellblau' },
  { id: 'hellgruen', hex: '#bbf7d0', dunkel: '#4ade80', name: 'Hellgrün' },
  { id: 'hellrosa', hex: '#fbcfe8', dunkel: '#f472b6', name: 'Hellrosa' },
];

/** Dunkle Töne — vier klar getrennte Farbtöne, damit sie sich nicht nur
 *  gegen die hellen, sondern auch untereinander unterscheiden. */
const DUNKLE: readonly FarbEintrag[] = [
  { id: 'dunkellila', hex: '#7e22ce', dunkel: '#4a0e7a', name: 'Dunkellila' },
  { id: 'dunkelrot', hex: '#b91c1c', dunkel: '#6d1010', name: 'Dunkelrot' },
  { id: 'dunkelblau', hex: '#1d4ed8', dunkel: '#122f80', name: 'Dunkelblau' },
  { id: 'dunkelgruen', hex: '#15803d', dunkel: '#0b4a23', name: 'Dunkelgrün' },
];

export const FARBEN: readonly FarbEintrag[] = [...HELLE, ...DUNKLE];

/**
 * Welche Farben ein Level bekommt — aus der Levelnummer gemischt, damit
 * nicht immer dieselben ersten Farben drankommen, aber bei gleicher
 * Levelnummer bei allen dieselbe Auswahl.
 *
 * Abwechselnd hell, dunkel, hell, dunkel …: So enthält jedes Level
 * garantiert beide Helligkeitsstufen. Würde einfach aus allen acht gezogen,
 * käme irgendwann ein Level mit vier dunklen Farben heraus — genau der
 * flaue Eindruck, der abgestellt werden sollte.
 */
export function farbpaletteFuerLevel(level: number, anzahl: number): readonly FarbEintrag[] {
  const zufall = rng(saatAus('farbsortierer-palette', level));
  const helle = zufall.mischen(HELLE);
  const dunkle = zufall.mischen(DUNKLE);
  // Bei ungerader Anzahl fängt mal die helle, mal die dunkle Gruppe an.
  const hellZuerst = zufall.zahl() < 0.5;
  const erste = hellZuerst ? helle : dunkle;
  const zweite = hellZuerst ? dunkle : helle;

  const auswahl: FarbEintrag[] = [];
  for (let i = 0; auswahl.length < anzahl; i++) {
    const naechste = i % 2 === 0 ? erste[i >> 1] : zweite[i >> 1];
    if (!naechste) break;
    auswahl.push(naechste);
  }
  return auswahl;
}
