/**
 * Das Labyrinth als Textraster — genau hier ändern, wenn ein anderes
 * Layout gewünscht ist. Zeichen:
 *   # Wand
 *   . Punkt
 *   o Kraftpille
 *   (Leerzeichen) freies Feld ohne Punkt (im Geisterkäfig)
 *   P Start des Spielers
 *   G Start eines Geists (genau vier)
 *
 * Alle Zeilen müssen gleich lang sein. Die mittlere Zeile hat an beiden
 * Rändern kein # — das ist der Tunnel.
 */
export const ROHES_LABYRINTH: readonly string[] = [
  '#####################',
  '#....##.......##....#',
  '#.o...............o.#',
  '#.##...........##...#',
  '#...###.......###...#',
  '#...###.......###...#',
  '#.......#...#.......#',
  '#.......#...#.......#',
  '#...................#',
  '#........G G........#',
  '.........G G.........',
  '#...................#',
  '#.......#...#.......#',
  '#.......#...#.......#',
  '#...###.......###...#',
  '#...###.......###...#',
  '#.##...........##...#',
  '#.........P.........#',
  '#.o...............o.#',
  '#....##.......##....#',
  '#...................#',
  '#####################',
];

export type Position = { x: number; y: number };

export type Labyrinth = {
  breite: number;
  hoehe: number;
  waende: ReadonlySet<string>;
  spielerStart: Position;
  geisterStarts: readonly Position[];
  punkteStart: ReadonlySet<string>;
  kraftpillenStart: ReadonlySet<string>;
};

export function schluessel(x: number, y: number): string {
  return `${x},${y}`;
}

export function istWand(labyrinth: Labyrinth, x: number, y: number): boolean {
  if (y < 0 || y >= labyrinth.hoehe) return true;
  // Spalten außerhalb der Breite sind nur im Tunnel gültig — das übernimmt
  // die Bewegung selbst über Modulo, hier zählt eine ungültige Spalte als Wand.
  if (x < 0 || x >= labyrinth.breite) return true;
  return labyrinth.waende.has(schluessel(x, y));
}

export function labyrinthParsen(zeilen: readonly string[]): Labyrinth {
  const hoehe = zeilen.length;
  const breite = zeilen[0]!.length;

  const waende = new Set<string>();
  const punkteStart = new Set<string>();
  const kraftpillenStart = new Set<string>();
  const geisterStarts: Position[] = [];
  let spielerStart: Position | null = null;

  zeilen.forEach((zeile, y) => {
    for (let x = 0; x < breite; x++) {
      const zeichen = zeile[x] ?? ' ';
      if (zeichen === '#') waende.add(schluessel(x, y));
      else if (zeichen === '.') punkteStart.add(schluessel(x, y));
      else if (zeichen === 'o') kraftpillenStart.add(schluessel(x, y));
      else if (zeichen === 'P') spielerStart = { x, y };
      else if (zeichen === 'G') geisterStarts.push({ x, y });
    }
  });

  if (!spielerStart) throw new Error('Labyrinth ohne Spieler-Start (P)');
  if (geisterStarts.length !== 4) {
    throw new Error(`Labyrinth braucht genau vier Geister-Starts (G), gefunden: ${geisterStarts.length}`);
  }

  return { breite, hoehe, waende, spielerStart, geisterStarts, punkteStart, kraftpillenStart };
}

export const LABYRINTH: Labyrinth = labyrinthParsen(ROHES_LABYRINTH);
