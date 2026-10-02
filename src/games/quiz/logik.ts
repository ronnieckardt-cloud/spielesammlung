import { STUFEN, fragenAusPool, fragenSchluessel, schwereAnStufe } from '../../core/leiter';
import type { LeiterFrage } from '../../core/leiter';
import { saatAus } from '../../core/rng';
import { kopfnuss } from './kopfnuss';
import { WISSENSFRAGEN } from './pool';

/**
 * Die fünfzehn Fragen eines Levels: Wissen, durchsetzt mit Kopfnüssen.
 *
 * Die Regeln der Leiter (Preise, Joker, Sicherheitsstufen) stehen in `core/leiter.ts`; hier steht nur,
 * **welche Fragen** Quiz Time stellt. Reine Logik, ohne React.
 */

/**
 * Welche Stufen (0 = erste Frage) eine Kopfnuss sind: die letzte jedes der ersten vier Abschnitte.
 *
 * Das sind vier von fünfzehn — „es werden mehr rechnen", aber das Spiel bleibt ein Wissensquiz. Die
 * letzten drei Fragen sind immer Wissen: Eine Rechenaufgabe als Frage um die Höchstzahl liest sich wie
 * ein Aufgabenblatt und nimmt dem Ende die Spannung.
 */
export const KOPFNUSS_STUFEN: ReadonlySet<number> = new Set([2, 5, 8, 11]);

/**
 * Das Level als Liste: gleiche Levelnummer, gleiche Fragen — überall, für immer (sonst wäre das Duell wertlos).
 *
 * Gibt es für eine Schwere zu wenige Wissensfragen (Datei vergessen, gelöscht), springt die Auswahl auf die
 * nächstliegende Schwere über, statt eine leere Frage anzuzeigen. Die Tests verlangen trotzdem einen
 * ausreichenden Pool — der Ersatz ist ein Sicherheitsnetz, kein Plan.
 */
export function fragenFuerLevel(level: number): LeiterFrage[] {
  const ergebnis: LeiterFrage[] = [];
  const benutzt = new Set<string>();

  for (let schwere = 1; schwere <= 5; schwere++) {
    const stufen = [0, 1, 2].map((k) => (schwere - 1) * 3 + k);
    const wissensStufen = stufen.filter((s) => !KOPFNUSS_STUFEN.has(s));
    let wissen = fragenAusPool(WISSENSFRAGEN, 'quiz', level, schwere as 1 | 2 | 3 | 4 | 5, wissensStufen.length, benutzt);
    for (let abstand = 1; wissen.length < wissensStufen.length && abstand < 5; abstand++) {
      for (const s of [schwere - abstand, schwere + abstand]) {
        if (s < 1 || s > 5 || wissen.length >= wissensStufen.length) continue;
        wissen = [...wissen, ...fragenAusPool(WISSENSFRAGEN, 'quiz', level, s as 1 | 2 | 3 | 4 | 5, wissensStufen.length - wissen.length, benutzt)];
      }
    }
    wissen.forEach((f) => benutzt.add(fragenSchluessel(f)));

    let k = 0;
    for (const stufe of stufen) {
      if (KOPFNUSS_STUFEN.has(stufe)) {
        ergebnis.push(kopfnuss(saatAus('quiz', 'kopfnuss', level, stufe), schwereAnStufe(stufe)));
      } else {
        const f = wissen[k++];
        if (f) ergebnis.push(f);
      }
    }
  }
  return ergebnis.slice(0, STUFEN);
}
