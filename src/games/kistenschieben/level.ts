/**
 * Box Push — die Level als reines Textraster.
 *
 * **Von Hand gebaut, nicht erzeugt.** Bei Color Pour und Flow Link wird
 * gewürfelt, hier ausdrücklich nicht: Gute Schiebe-Rätsel leben von einer
 * Idee („die Kiste muss erst nach links, obwohl sie nach rechts soll"), und
 * die kann kein Zufall. Ein Erzeuger liefert entweder Triviales oder
 * Unlösbares.
 *
 * Dass jedes Level wirklich lösbar ist, prüft dafür ein **Suchlauf im
 * Test** — dieselbe Absicherung wie der Lösbarkeits-Suchlauf bei Color Pour,
 * nur zur Bauzeit statt zur Laufzeit.
 *
 * Zeichen (die übliche Schreibweise für diese Art Rätsel):
 *
 * | `#` | Wand |
 * | ` ` | Boden |
 * | `$` | Kiste |
 * | `.` | Zielfeld |
 * | `*` | Kiste steht schon auf einem Ziel |
 * | `@` | Spieler |
 * | `+` | Spieler steht auf einem Ziel |
 *
 * Bewusst klein gehalten: Auf einem 375 Pixel breiten Handy muss jedes Feld
 * noch mit dem Daumen zu treffen sein, und mehr als vier Kisten überfordern
 * ein Kind eher, als dass sie es fordern.
 */
export const LEVEL: readonly (readonly string[])[] = [
  // 1 — Ein einziger Schub nach unten. Zeigt die Regel, mehr nicht.
  [
    '#######',
    '#     #',
    '#  @  #',
    '#  $  #',
    '#  .  #',
    '#     #',
    '#######',
  ],
  // 2 — Erst außen herum, dann schieben. Wer stur draufzuläuft, schiebt falsch.
  [
    '########',
    '#      #',
    '#  $  .#',
    '#  @   #',
    '#      #',
    '########',
  ],
  // 3 — Zwei Kisten, zwei Ziele, keine Falle. Reihenfolge egal.
  [
    '########',
    '#      #',
    '# $   .#',
    '#      #',
    '# $   .#',
    '#  @   #',
    '########',
  ],
  // 4 — Die Kiste muss über Eck. Erst nach unten, dann nach rechts.
  [
    '########',
    '#      #',
    '#  $   #',
    '#      #',
    '#     .#',
    '#  @   #',
    '########',
  ],
  // 5 — Eine Wand zwingt zum Umweg.
  [
    '########',
    '#      #',
    '#  $   #',
    '# ###  #',
    '#     .#',
    '#  @   #',
    '########',
  ],
  // 6 — Drei Kisten. Ab hier muss man sich die Reihenfolge überlegen.
  [
    '#########',
    '#       #',
    '# $ $ $ #',
    '#       #',
    '#       #',
    '# . . . #',
    '#   @   #',
    '#########',
  ],
  // 7 — Eine Kiste steht schon richtig. Wer sie anfasst, macht es kaputt.
  [
    '########',
    '#      #',
    '#  *   #',
    '#      #',
    '# $   .#',
    '#  @   #',
    '########',
  ],
  // 8 — Ein Wandblock zwingt die Kiste auf einen Umweg nach links.
  [
    '########',
    '#      #',
    '#  $   #',
    '#  ##  #',
    '#      #',
    '#   .  #',
    '#  @   #',
    '########',
  ],
  // 9 — Zwei Kisten, beide müssen außen herum. Geradeaus ist verbaut.
  [
    '#########',
    '#       #',
    '#  $ $  #',
    '#       #',
    '#  ###  #',
    '#  . .  #',
    '#   @   #',
    '#########',
  ],
  // 10 — Das Ziel liegt hinter der Kiste: erst vorbei, dann zurückschieben.
  [
    '#########',
    '#       #',
    '#  ###  #',
    '#  $ .  #',
    '#  ###  #',
    '#   @   #',
    '#########',
  ],
  // 11 — Vier Kisten von außen in die Mitte. Wer falsch anfängt, baut sich zu.
  [
    '##########',
    '#        #',
    '#  $  $  #',
    '#   ..   #',
    '#   ..   #',
    '#  $  $  #',
    '#   @    #',
    '##########',
  ],
  // 12 — Der Knoten: Die untere Kiste muss ganz außen herum — und **vor**
  // den beiden anderen, sonst ist ihr Weg zugestellt.
  [
    '#########',
    '#       #',
    '#  ###  #',
    '# $...$ #',
    '#  ###  #',
    '#   $   #',
    '#   @   #',
    '#########',
  ],
];
