import { BREITE, HOEHE, aufloesen, legen, passtAn, volleZeilenUndSpalten } from './logik';
import type { Raster, Zustand } from './logik';
import { formMasken, legenMasken, loesbar, maskenAus } from './loeser';

/**
 * Spieler für die Prüfung — keine Oberfläche, nur Entscheidungen.
 *
 * Ein Bot, der ein neues Spielsystem nur „durchspielt", beweist nichts: Er
 * muss an der richtigen Stelle scheitern. Deshalb gibt es hier drei, die
 * sich in einem einzigen Punkt unterscheiden — wie viel sie vom Tablett
 * **vorausschauen**:
 *
 * - `zufaelligerZug`: irgendein erlaubter Zug. Der Boden der Skala.
 * - `gierigerZug`: ein Teil, ein Zug Vorausschau, gute Stellung. Ein Kind,
 *   das gerade gut spielt.
 * - `sichererZug`: kennt die Lösung des Tabletts und legt nur Züge, nach
 *   denen sie noch geht. Der „perfekte" Spieler — er darf nie sterben, und
 *   gerade das beweist, dass jedes Ende vermeidbar war.
 */

export type Zug = { index: number; x: number; y: number };

export function alleZuege(z: Zustand): Zug[] {
  const zuege: Zug[] = [];
  z.tablett.forEach((teil, index) => {
    if (!teil) return;
    for (let y = 0; y < HOEHE; y++) {
      for (let x = 0; x < BREITE; x++) {
        if (passtAn(z.raster, teil.form, x, y)) zuege.push({ index, x, y });
      }
    }
  });
  return zuege;
}

/**
 * Wie gut steht ein Brett? Löcher (leere Felder, die ringsum zu sind) und
 * zerklüftete Ränder zählen schlecht, jedes belegte Feld ein bisschen — ein
 * Bot, der nur Linien zählt, baut sich zu.
 */
export function stellung(raster: Raster): number {
  let loecher = 0;
  let uebergaenge = 0;
  let belegt = 0;
  const voll = (x: number, y: number) => x < 0 || y < 0 || x >= BREITE || y >= HOEHE || raster[y]![x] !== null;
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      if (raster[y]![x] !== null) belegt++;
      else {
        const zu = [voll(x - 1, y), voll(x + 1, y), voll(x, y - 1), voll(x, y + 1)].filter(Boolean).length;
        if (zu >= 3) loecher += zu === 4 ? 3 : 1;
      }
      if (x + 1 < BREITE && voll(x, y) !== voll(x + 1, y)) uebergaenge++;
      if (y + 1 < HOEHE && voll(x, y) !== voll(x, y + 1)) uebergaenge++;
    }
  }
  return -loecher * 6 - uebergaenge * 1.2 - belegt * 0.8;
}

function wert(z: Zustand, zug: Zug): number {
  const teil = z.tablett[zug.index]!;
  const nach = legen(z.raster, teil.form, zug.x, zug.y, teil.farbe);
  const { zeilen, spalten } = volleZeilenUndSpalten(nach);
  const rest = aufloesen(nach, zeilen, spalten);
  return (zeilen.length + spalten.length) * 40 + stellung(rest);
}

export function zufaelligerZug(z: Zustand, zufall: () => number): Zug {
  const zuege = alleZuege(z);
  return zuege[Math.floor(zufall() * zuege.length)]!;
}

export function gierigerZug(z: Zustand): Zug {
  let bester: Zug | null = null;
  let besterWert = -Infinity;
  for (const zug of alleZuege(z)) {
    const w = wert(z, zug);
    if (w > besterWert) {
      besterWert = w;
      bester = zug;
    }
  }
  return bester!;
}

/**
 * Der Spieler, der die Lösung kennt: Von allen Zügen kommen nur die in
 * Frage, nach denen sich der Rest des Tabletts noch ablegen lässt. Unter
 * diesen gewinnt die beste Stellung. Gibt es keinen (das Tablett war schon
 * vorher nicht zu schaffen), bleibt nur der gierige Zug.
 */
export function sichererZug(z: Zustand): Zug {
  const brett = maskenAus(z.raster);
  let bester: Zug | null = null;
  let besterWert = -Infinity;
  for (const zug of alleZuege(z)) {
    const teil = z.tablett[zug.index]!;
    const nach = legenMasken(brett, formMasken(teil.form), zug.x, zug.y);
    if (!nach) continue;
    const rest = z.tablett.filter((t, i) => t !== null && i !== zug.index).map((t) => formMasken(t!.form));
    if (!loesbar(nach, rest)) continue;
    const w = wert(z, zug);
    if (w > besterWert) {
      besterWert = w;
      bester = zug;
    }
  }
  return bester ?? gierigerZug(z);
}

/**
 * Ein Spieler mit Aussetzern: meist der gierige Zug, mit der Wahrscheinlichkeit
 * `fehlerquote` aber ein beliebiger. So kommt die Ungenauigkeit eines Menschen
 * ins Spiel, ohne dass der Bot dafür schlechter *rechnen* müsste.
 */
export function unsichererZug(z: Zustand, fehlerquote: number, zufall: () => number): Zug {
  return zufall() < fehlerquote ? zufaelligerZug(z, zufall) : gierigerZug(z);
}
