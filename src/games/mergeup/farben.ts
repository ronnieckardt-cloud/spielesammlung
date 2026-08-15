/**
 * Farbe je Kachelstufe. Bewusst eine eigene, kräftige Reihe (nicht die
 * beigen Töne, die man von ähnlichen Spielen kennt): von Blau über Grün und
 * Gelb bis Rot und Violett, damit man am Farbton allein schon sieht, wie
 * weit eine Kachel schon ist.
 */
const FARBEN: readonly string[] = [
  '#38bdf8', // 2
  '#22d3ee', // 4
  '#2dd4bf', // 8
  '#4ade80', // 16
  '#a3e635', // 32
  '#facc15', // 64
  '#fb923c', // 128
  '#f87171', // 256
  '#f472b6', // 512
  '#c084fc', // 1024
  '#a855f7', // 2048
];

/** Ab dieser Stufe wird die Schrift dunkel — helle Kacheln, heller Text ginge sonst unter. */
const HELLE_STUFEN = new Set([5, 6]); // 32 und 64

export function kachelFarbe(stufe: number): string {
  // Über der Liste bleibt es beim letzten Ton — so weit kommt man ohnehin
  // kaum, und ein fehlender Eintrag soll nie zu „undefined" führen.
  return FARBEN[Math.min(stufe, FARBEN.length) - 1] ?? FARBEN[0]!;
}

export function kachelTextFarbe(stufe: number): string {
  return HELLE_STUFEN.has(stufe) ? '#0b0f14' : '#ffffff';
}
