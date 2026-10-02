import { describe, it, expect } from 'vitest';
import { STUFEN, fragenSchluessel, pruefeFrage, schwereAnStufe } from '../../core/leiter';
import { KOPFNUSS_STUFEN, fragenFuerLevel } from './logik';
import { WISSENSFRAGEN } from './pool';

/** Wie viele Wissensfragen eine Schwere je Level braucht: Stufen je Abschnitt minus die Kopfnüsse darin. */
const WISSEN_JE_SCHWERE = [1, 2, 3, 4, 5].map((s) => [0, 1, 2].map((k) => (s - 1) * 3 + k).filter((st) => !KOPFNUSS_STUFEN.has(st)).length);

describe('Wissenspool von Quiz Time', () => {
  it('ist aus allen Fragendateien zusammengesetzt und groß genug', () => {
    expect(WISSENSFRAGEN.length).toBeGreaterThanOrEqual(250);
  });

  it('jede Schwere trägt zwölf Level ohne eine einzige Wiederholung', () => {
    // Das ist die Zusage an den Spieler: Zwölf Runden lang kommt nichts zweimal. Bei weniger Fragen
    // wiederholt sich eine Schwere früher.
    for (let schwere = 1; schwere <= 5; schwere++) {
      const anzahl = WISSENSFRAGEN.filter((f) => f.schwere === schwere).length;
      expect(anzahl, `Schwere ${schwere}`).toBeGreaterThanOrEqual(12 * WISSEN_JE_SCHWERE[schwere - 1]!);
    }
  });

  it('keine Frage kommt im ganzen Pool zweimal vor', () => {
    const schluessel = WISSENSFRAGEN.map(fragenSchluessel);
    expect(new Set(schluessel).size).toBe(schluessel.length);
    const texte = WISSENSFRAGEN.map((f) => f.frage.trim().toLowerCase());
    expect(new Set(texte).size).toBe(texte.length);
  });

  it('jede Frage besteht die Formprüfung', () => {
    for (const f of WISSENSFRAGEN) expect(pruefeFrage(f), f.frage).toEqual([]);
  });

  it('es gibt viele Kategorien, und die schweren Schweren sind nicht auf eine einzige beschränkt', () => {
    expect(new Set(WISSENSFRAGEN.map((f) => f.kategorie)).size).toBeGreaterThanOrEqual(12);
    for (const schwere of [3, 4, 5]) {
      const kategorien = new Set(WISSENSFRAGEN.filter((f) => f.schwere === schwere).map((f) => f.kategorie));
      expect(kategorien.size, `Schwere ${schwere}`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('Ein Level von Quiz Time', () => {
  it('besteht aus fünfzehn Fragen, deren Schwere zur Stufe passt', () => {
    for (const level of [1, 2, 7, 25, 120]) {
      const fragen = fragenFuerLevel(level);
      expect(fragen).toHaveLength(STUFEN);
      fragen.forEach((f, stufe) => expect(f.schwere, `Level ${level}, Stufe ${stufe + 1}`).toBe(schwereAnStufe(stufe)));
    }
  });

  it('Kopfnüsse stehen genau an den vorgesehenen Stufen — und die letzten drei Fragen sind immer Wissen', () => {
    for (const level of [1, 5, 33]) {
      fragenFuerLevel(level).forEach((f, stufe) => {
        expect(f.kategorie === 'Kopfnuss', `Level ${level}, Stufe ${stufe + 1}`).toBe(KOPFNUSS_STUFEN.has(stufe));
      });
    }
    expect([...KOPFNUSS_STUFEN].every((s) => s < STUFEN - 3)).toBe(true);
  });

  it('gleiches Level ergibt dieselben Fragen, ein anderes Level andere — Voraussetzung für das Duell', () => {
    expect(fragenFuerLevel(9)).toEqual(fragenFuerLevel(9));
    expect(fragenFuerLevel(9)).not.toEqual(fragenFuerLevel(10));
  });

  it('keine Frage kommt in einem Level zweimal vor', () => {
    for (let level = 1; level <= 40; level++) {
      const schluessel = fragenFuerLevel(level).map(fragenSchluessel);
      expect(new Set(schluessel).size, `Level ${level}`).toBe(STUFEN);
    }
  });

  it('die Wissensfragen der ersten zwölf Level wiederholen sich nicht', () => {
    const gesehen = new Set<string>();
    for (let level = 1; level <= 12; level++) {
      for (const f of fragenFuerLevel(level).filter((x) => x.kategorie !== 'Kopfnuss')) {
        const k = fragenSchluessel(f);
        expect(gesehen.has(k), `Level ${level}: „${f.frage}" kam schon vor`).toBe(false);
        gesehen.add(k);
      }
    }
  });

  it('jede Frage jedes Levels besteht die Formprüfung — auch die gerechneten', () => {
    for (let level = 1; level <= 60; level++) {
      for (const f of fragenFuerLevel(level)) expect(pruefeFrage(f), `Level ${level}: ${f.frage}`).toEqual([]);
    }
  });

  it('ungültige Levelnummern stürzen nicht ab', () => {
    for (const level of [0, -5, 1.7, 100000]) expect(fragenFuerLevel(level)).toHaveLength(STUFEN);
  });
});
