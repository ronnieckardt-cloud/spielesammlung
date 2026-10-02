import { describe, it, expect } from 'vitest';
import { STUFEN, fragenSchluessel, pruefeFrage, schwereAnStufe } from '../../core/leiter';
import { fragenFuerLevel } from './logik';
import { RECHTSCHREIBUNG, WORTFRAGEN } from './pool';
import { WOERTER } from './woerter';

describe('Wortpool von Word Play', () => {
  it('enthält alle neunzig Rechtschreib-Wörter, mit der Stufe als Schwere und der Regel als Erklärung', () => {
    expect(RECHTSCHREIBUNG).toHaveLength(WOERTER.length);
    RECHTSCHREIBUNG.forEach((f, i) => {
      const w = WOERTER[i]!;
      expect(f.schwere).toBe(w.stufe);
      expect(f.erklaerung).toBe(w.regel);
      expect(f.antworten[f.richtig]).toBe(w.antworten[w.richtig]);
      expect(f.kategorie).toBe('Rechtschreibung');
    });
  });

  it('kommt aus allen Fragendateien zusammen und ist groß genug', () => {
    expect(WORTFRAGEN.length).toBeGreaterThanOrEqual(240);
  });

  it('jede Schwere trägt zwölf Level ohne eine einzige Wiederholung (je drei Fragen)', () => {
    for (let schwere = 1; schwere <= 5; schwere++) {
      const anzahl = WORTFRAGEN.filter((f) => f.schwere === schwere).length;
      expect(anzahl, `Schwere ${schwere}`).toBeGreaterThanOrEqual(36);
    }
  });

  it('keine Frage kommt im ganzen Pool zweimal vor', () => {
    const schluessel = WORTFRAGEN.map(fragenSchluessel);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });

  it('jede Frage besteht die Formprüfung', () => {
    for (const f of WORTFRAGEN) expect(pruefeFrage(f), `${f.frage} ${f.antworten}`).toEqual([]);
  });

  it('außer Rechtschreibung gibt es Wortschatz, Redewendungen und Grammatik — in jeder Schwere gemischt', () => {
    const kategorien = new Set(WORTFRAGEN.map((f) => f.kategorie));
    for (const k of ['Rechtschreibung', 'Gegenteil', 'Synonym', 'Bedeutung', 'Redewendung', 'Sprichwort', 'Grammatik']) {
      expect(kategorien.has(k), k).toBe(true);
    }
    for (let schwere = 1; schwere <= 5; schwere++) {
      const arten = new Set(WORTFRAGEN.filter((f) => f.schwere === schwere).map((f) => f.kategorie));
      expect(arten.size, `Schwere ${schwere}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Ein Level von Word Play', () => {
  it('besteht aus fünfzehn Fragen, deren Schwere zur Stufe passt', () => {
    for (const level of [1, 2, 7, 25, 120]) {
      const fragen = fragenFuerLevel(level);
      expect(fragen).toHaveLength(STUFEN);
      fragen.forEach((f, stufe) => expect(f.schwere, `Level ${level}, Stufe ${stufe + 1}`).toBe(schwereAnStufe(stufe)));
    }
  });

  it('gleiches Level ergibt dieselben Fragen, ein anderes Level andere — Voraussetzung für das Duell', () => {
    expect(fragenFuerLevel(9)).toEqual(fragenFuerLevel(9));
    expect(fragenFuerLevel(9)).not.toEqual(fragenFuerLevel(10));
  });

  it('keine Frage kommt in einem Level zweimal vor — auch nicht, wenn mehrere dieselbe Frage stellen', () => {
    for (let level = 1; level <= 40; level++) {
      const schluessel = fragenFuerLevel(level).map(fragenSchluessel);
      expect(new Set(schluessel).size, `Level ${level}`).toBe(STUFEN);
    }
  });

  it('mehr als ein Rechtschreib-Wort je Level ist möglich (der Ausschluss sperrt nicht alle gleichlautenden Fragen)', () => {
    let mehrere = 0;
    for (let level = 1; level <= 40; level++) {
      if (fragenFuerLevel(level).filter((f) => f.kategorie === 'Rechtschreibung').length >= 2) mehrere++;
    }
    expect(mehrere).toBeGreaterThan(20);
  });

  it('die ersten zwölf Level wiederholen keine Frage', () => {
    const gesehen = new Set<string>();
    for (let level = 1; level <= 12; level++) {
      for (const f of fragenFuerLevel(level)) {
        const k = fragenSchluessel(f);
        expect(gesehen.has(k), `Level ${level}: „${f.frage}" ${f.antworten} kam schon vor`).toBe(false);
        gesehen.add(k);
      }
    }
  });

  it('ungültige Levelnummern stürzen nicht ab', () => {
    for (const level of [0, -5, 1.7, 100000]) expect(fragenFuerLevel(level)).toHaveLength(STUFEN);
  });
});
