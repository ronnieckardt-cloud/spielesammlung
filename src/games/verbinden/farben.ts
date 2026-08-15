/**
 * Die sechs Wegfarben.
 *
 * Zu jeder Farbe gehört ein **Zeichen** im Punkt. Bei einem Spiel, das aus
 * „welcher Punkt gehört zu welchem?" besteht, wäre reine Farbunterscheidung
 * für ein farbfehlsichtiges Kind unlösbar — und die beiden Punkte eines
 * Paares liegen ja gerade weit auseinander, man kann sie also nicht
 * nebeneinanderhalten und vergleichen.
 *
 * Die Zeichen sind bewusst grobe Formen und keine feinen Muster: Ein Punkt
 * ist auf einem 7×7-Feld nur wenige Millimeter groß.
 */

export type Wegfarbe = {
  hex: string;
  /** Dunkler Rand, damit der Punkt auch auf hellem Weg noch absetzt. */
  rand: string;
  name: string;
  /** Das Zeichen im Punkt — SVG-Pfad um den Nullpunkt, Radius etwa 3. */
  zeichen: string;
};

/** Kreis, Quadrat, Dreieck, Raute, Kreuz, Stern — sechs klar verschiedene Umrisse. */
export const FARBEN: readonly Wegfarbe[] = [
  {
    hex: '#f87171',
    rand: '#7f1d1d',
    name: 'Rot',
    zeichen: 'M0,-3 A3,3 0 1,0 0.01,-3 Z',
  },
  {
    hex: '#fbbf24',
    rand: '#78350f',
    name: 'Gelb',
    zeichen: 'M-2.6,-2.6 H2.6 V2.6 H-2.6 Z',
  },
  {
    hex: '#4ade80',
    rand: '#14532d',
    name: 'Grün',
    zeichen: 'M0,-3.2 L2.9,2.2 H-2.9 Z',
  },
  {
    hex: '#60a5fa',
    rand: '#1e3a8a',
    name: 'Blau',
    zeichen: 'M0,-3.4 L3.4,0 L0,3.4 L-3.4,0 Z',
  },
  {
    hex: '#e879f9',
    rand: '#701a75',
    name: 'Pink',
    zeichen: 'M-3.2,-1.1 H-1.1 V-3.2 H1.1 V-1.1 H3.2 V1.1 H1.1 V3.2 H-1.1 V1.1 H-3.2 Z',
  },
  {
    hex: '#22d3ee',
    rand: '#155e75',
    name: 'Türkis',
    zeichen: 'M0,-3.4 L1,-1 L3.4,-1 L1.5,0.6 L2.2,3.1 L0,1.6 L-2.2,3.1 L-1.5,0.6 L-3.4,-1 L-1,-1 Z',
  },
];

export function wegfarbe(index: number): Wegfarbe {
  return FARBEN[index % FARBEN.length]!;
}
