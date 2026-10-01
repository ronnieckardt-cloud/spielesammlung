/**
 * Farb- und Lichthelfer für die Zeichnung von Flow MTB.
 *
 * Eigene Datei, damit `zeichnen.ts` (Bike, Gelände) und `fahrer.ts` (der
 * Mensch) dieselbe Mischfunktion benutzen können, ohne einander zu
 * importieren.
 */

/**
 * Zerlegt `#rrggbb` oder `rgb(r,g,b)` in drei Zahlen. Letzteres, damit sich
 * das Ergebnis von `mischen` erneut mischen lässt (etwa Grundfarbe → abgedunkelt
 * → aufgehellt). Farbnamen und `rgba(...)` kennt es bewusst nicht.
 */
export function rgb(s: string): [number, number, number] {
  if (s.startsWith('rgb(')) {
    const t = s.slice(4, -1).split(',').map((x) => Number(x));
    return [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0];
  }
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}

/** Mischt zwei `#rrggbb`-Farben; `anteil` 0 = a, 1 = b. */
export function mischen(a: string, b: string, anteil: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * anteil);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

/**
 * Die feste Lichtrichtung: oben links, leicht von vorn. Alles im Bild — Rohre,
 * Glieder, Helm, Boden — benutzt diese eine Richtung. Wer sie ändert, muss die
 * Verläufe überall mitdrehen (dieselbe Regel wie bei `core/AppSymbol`).
 */
export const LICHT_X = -0.55;
export const LICHT_Y = -0.84;
