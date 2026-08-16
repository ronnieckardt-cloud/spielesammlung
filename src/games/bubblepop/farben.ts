/**
 * Kugelfarben. Bewusst gut unterscheidbare Töne, nicht nur helle Pastelle —
 * bei fünf Farben nebeneinander muss man sie auf einen Blick auseinander
 * halten können.
 */
const FARBEN: readonly { hex: string; name: string }[] = [
  { hex: '#f43f5e', name: 'Rot' },
  { hex: '#38bdf8', name: 'Blau' },
  { hex: '#4ade80', name: 'Grün' },
  { hex: '#facc15', name: 'Gelb' },
  { hex: '#c084fc', name: 'Violett' },
];

export function kugelFarbe(index: number): string {
  return FARBEN[index % FARBEN.length]!.hex;
}

/** Farbname fürs `aria-label` — Farbe ist nie das einzige Merkmal. */
export function kugelName(index: number): string {
  return FARBEN[index % FARBEN.length]!.name;
}

/**
 * Je Farbe ein eigenes Zeichen **in** der Kugel — Punkt, Ring, Dreieck,
 * Kreuz, Stern.
 *
 * Vorher unterschieden sich die fünf Sorten ausschließlich in der Füllfarbe:
 * gleiche Größe, gleicher Verlauf, gleicher Glanzpunkt. Bei einem Spiel, das
 * nur aus „welche drei gehören zusammen?" besteht, ist das für
 * farbfehlsichtige Spieler kaum lösbar — und es bricht die Projektregel
 * „Farbe nie als einziges Unterscheidungsmerkmal". Pair Up macht es mit
 * seinen Motiven genauso.
 *
 * Die Pfade liegen in einem Einheitsraster um den Nullpunkt: 1 entspricht
 * dem Kugelradius. Die Anzeige schiebt sie mit `translate` an ihren Platz
 * und skaliert mit `scale(RADIUS)` — dieselben Daten passen dadurch in die
 * große Kugel im Feld und in den kleinen Vorschau-Punkt daneben.
 *
 * Alle fünf sind reine Füllungen (kein `stroke`), damit das Skalieren die
 * Strichstärke nicht mitzieht. Der Ring braucht `fill-rule="evenodd"`, sonst
 * füllt der Browser sein Loch mit.
 */
const ZEICHEN: readonly string[] = [
  // Punkt
  'M0,-0.34A0.34,0.34 0 1,1 0,0.34A0.34,0.34 0 1,1 0,-0.34Z',
  // Ring (äußerer Kreis, innerer Kreis als Loch)
  'M0,-0.44A0.44,0.44 0 1,1 0,0.44A0.44,0.44 0 1,1 0,-0.44Z' +
    'M0,-0.22A0.22,0.22 0 1,1 0,0.22A0.22,0.22 0 1,1 0,-0.22Z',
  // Dreieck
  'M0,-0.44L0.4,0.28L-0.4,0.28Z',
  // Kreuz
  'M-0.14,-0.42H0.14V-0.14H0.42V0.14H0.14V0.42H-0.14V0.14H-0.42V-0.14H-0.14Z',
  // Stern
  'M0,-0.46L0.112,-0.154L0.438,-0.142L0.181,0.059L0.27,0.372' +
    'L0,0.19L-0.27,0.372L-0.181,0.059L-0.438,-0.142L-0.112,-0.154Z',
];

export function kugelZeichen(index: number): string {
  return ZEICHEN[index % ZEICHEN.length]!;
}

/** Name des Zeichens — für Vorlesehilfen, wenn die Farbe nicht ankommt. */
const ZEICHEN_NAMEN: readonly string[] = ['Punkt', 'Ring', 'Dreieck', 'Kreuz', 'Stern'];

export function kugelZeichenName(index: number): string {
  return ZEICHEN_NAMEN[index % ZEICHEN_NAMEN.length]!;
}

/**
 * Dunkle Tinte statt Weiß.
 *
 * Weiß wäre auf Rot und Violett gut zu sehen, auf Gelb (#facc15) aber fast
 * unsichtbar — und ausgerechnet dort wäre ein zweites Merkmal am nötigsten.
 * Dasselbe Dunkelblau liegt ohnehin schon als Schattenkante unter jeder
 * Kugel, das Zeichen wirkt dadurch wie ein Teil der Kugel und nicht wie ein
 * Aufkleber.
 */
export const ZEICHEN_FARBE = '#0b1020';
export const ZEICHEN_DECKUNG = 0.5;
