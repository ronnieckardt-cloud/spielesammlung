import { STUFEN, fragenAusPool, fragenSchluessel } from '../../core/leiter';
import type { LeiterFrage } from '../../core/leiter';
import { WORTFRAGEN } from './pool';

/**
 * Die fünfzehn Fragen eines Levels von Word Play.
 *
 * Die Regeln der Leiter (Preise, Joker, Sicherheitsstufen) stehen in `core/leiter.ts`; hier steht nur,
 * **welche Fragen** Word Play stellt: je drei pro Schwere, aus dem ganzen Wortpool — Rechtschreibung,
 * Gegenteile, Bedeutungen, Redewendungen, Grammatik. Reine Logik, ohne React.
 *
 * Gleiche Levelnummer, gleiche Fragen — überall, für immer (sonst wäre das Duell wertlos).
 */
export function fragenFuerLevel(level: number): LeiterFrage[] {
  const ergebnis: LeiterFrage[] = [];
  const benutzt = new Set<string>();

  for (let schwere = 1; schwere <= 5; schwere++) {
    let gezogen = fragenAusPool(WORTFRAGEN, 'wortspiel', level, schwere as 1 | 2 | 3 | 4 | 5, 3, benutzt);
    // Zu wenige Fragen in einer Schwere (Datei gelöscht): von der nächstliegenden auffüllen, statt eine leere Frage zu zeigen.
    for (let abstand = 1; gezogen.length < 3 && abstand < 5; abstand++) {
      for (const s of [schwere - abstand, schwere + abstand]) {
        if (s < 1 || s > 5 || gezogen.length >= 3) continue;
        gezogen = [...gezogen, ...fragenAusPool(WORTFRAGEN, 'wortspiel', level, s as 1 | 2 | 3 | 4 | 5, 3 - gezogen.length, benutzt)];
      }
    }
    gezogen.forEach((f) => benutzt.add(fragenSchluessel(f)));
    ergebnis.push(...gezogen);
  }
  return ergebnis.slice(0, STUFEN);
}
