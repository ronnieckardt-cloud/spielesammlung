import { describe, it, expect } from 'vitest';
import { musterAufgabe, STUFEN, stufeFuerLevel } from './muster';
import { saatAus } from '../../core/rng';

/** Läuft die Folge mit immer derselben Differenz? */
function gleichmaessig(folge: readonly number[]): boolean {
  const differenz = folge[1]! - folge[0]!;
  return folge.every((wert, i) => i === 0 || wert - folge[i - 1]! === differenz);
}

describe('musterAufgabe', () => {
  it('ist deterministisch: gleiche Saat und Level ergeben dieselbe Aufgabe', () => {
    const a = musterAufgabe(123, 30);
    const b = musterAufgabe(123, 30);
    expect(a).toEqual(b);
  });

  it('hat für viele Level und Saaten eine vierstellige Folge und vier eindeutige Antworten', () => {
    for (let level = 1; level <= 95; level += 3) {
      for (let saat = 0; saat < 5; saat++) {
        const a = musterAufgabe(saat * 1000 + level, level);
        expect(a.folge).toHaveLength(4);
        expect(new Set(a.antworten).size).toBe(4);
        expect(a.richtig).toBeGreaterThanOrEqual(0);
        expect(a.richtig).toBeLessThanOrEqual(3);
        for (const wert of a.folge) {
          expect(wert).toBeGreaterThan(0);
          expect(Number.isInteger(wert)).toBe(true);
        }
      }
    }
  });

  it('ist auf Stufe 0 (Level 1-15) immer eine echte arithmetische Folge mit konstanter Differenz', () => {
    for (let saat = 0; saat < 20; saat++) {
      const a = musterAufgabe(saat, 5);
      const diff = a.folge[1]! - a.folge[0]!;
      for (let i = 1; i < a.folge.length; i++) {
        expect(a.folge[i]! - a.folge[i - 1]!).toBe(diff);
      }
      // Die richtige Antwort setzt dieselbe Differenz fort.
      const naechster = a.folge[a.folge.length - 1]! + diff;
      expect(a.antworten[a.richtig]).toBe(naechster);
    }
  });
});

/**
 * Die Stufen hatten sich paarweise geglichen (0 wie 1, 2 wie 3, 4 wie 5), aus
 * sechs Stufen wurden dadurch drei. Diese drei Prüfungen halten fest, dass
 * jede Stufe wirklich etwas ändert und nichts zurückgeht — dieselbe Absicht
 * wie bei `schwierigkeit.test.ts` im Farbsortierer.
 */
describe('Schwierigkeit', () => {
  it('unterscheidet jede Stufe von der vorigen', () => {
    for (let i = 1; i < STUFEN.length; i++) {
      expect(STUFEN[i]).not.toEqual(STUFEN[i - 1]);
    }
  });

  it('geht nie zurück: Regeln, Schrittweiten und Richtungsfreiheit wachsen nur', () => {
    for (let i = 1; i < STUFEN.length; i++) {
      const vorher = STUFEN[i - 1]!;
      const jetzt = STUFEN[i]!;
      // Keine Regel fällt wieder weg.
      for (const regel of vorher.regeln) expect(jetzt.regeln).toContain(regel);
      expect(jetzt.schrittMax).toBeGreaterThanOrEqual(vorher.schrittMax);
      expect(jetzt.wechselMax).toBeGreaterThanOrEqual(vorher.wechselMax);
      // Einmal erlaubtes Rückwärtslaufen bleibt erlaubt.
      if (vorher.abwaerts) expect(jetzt.abwaerts).toBe(true);
    }
  });

  it('bringt schon in Stufe 1 Folgen, die nicht mehr gleichmäßig steigen', () => {
    // „Muster erkennen" ist nur jedes dritte Level dran: Stufe 0 sind die
    // Muster-Level 3 bis 15, Stufe 1 die Level 18 bis 30. Vorher war Level 30
    // von Level 3 nicht zu unterscheiden.
    expect(stufeFuerLevel(15)).toBe(0);
    expect(stufeFuerLevel(18)).toBe(1);

    for (let saat = 0; saat < 40; saat++) {
      expect(gleichmaessig(musterAufgabe(saat, 15).folge)).toBe(true);
    }
    const andersartige = Array.from({ length: 40 }, (_, saat) =>
      musterAufgabe(saat, 18),
    ).filter((a) => !gleichmaessig(a.folge));
    expect(andersartige.length).toBeGreaterThan(0);
  });
});

describe('Antwortknöpfe', () => {
  /*
   * Geprüft werden die **Antworten**, nicht nur die sichtbare Folge.
   * Genau darin lag der Fehler: Die Folge war immer sauber, die drei
   * Ablenker daneben aber nicht. Bei fallenden Folgen richtete sich ihr
   * Abstand nach der Schrittweite (bis 20), während die richtige Antwort
   * nur zwischen 5 und 30 lag — Level 33, fünfte Aufgabe zeigte unter
   * „29, 23, 17, 11, ?" die Auswahl −1 / 5 / 1 / 11.
   *
   * Es läuft über `saatAus` mit denselben Werten wie im Spiel, nicht über
   * ausgedachte Saaten: Ein Test mit anderen Saaten kann grün sein,
   * während das echte Spiel den Fehler zeigt.
   */
  it('zeigt nie Null oder eine negative Zahl', () => {
    const schlechte: string[] = [];
    for (let level = 1; level <= 90; level++) {
      for (let i = 0; i < 40; i++) {
        const a = musterAufgabe(saatAus('gehirnjogging', level, i), level);
        for (const wert of a.antworten) {
          if (!Number.isInteger(wert) || wert < 1) {
            schlechte.push(`Level ${level}, Aufgabe ${i}: ${a.folge.join(', ')} → ${a.antworten.join(' / ')}`);
          }
        }
      }
    }
    expect(schlechte.slice(0, 5)).toEqual([]);
  });

  it('liefert vier verschiedene Zahlen, darunter die richtige', () => {
    for (let level = 1; level <= 90; level += 7) {
      for (let i = 0; i < 12; i++) {
        const a = musterAufgabe(saatAus('gehirnjogging', level, i), level);
        expect(new Set(a.antworten).size).toBe(4);
        // `richtig` ist der Index in `antworten` — die Aufgabe muss ihre
        // eigene Lösung auch wirklich anbieten.
        expect(a.antworten[a.richtig]).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('unsinnige Levelnummern', () => {
  /*
   * Im **Duell** kommt die Levelnummer vom Server, nicht aus der
   * Oberfläche — die klemmt zwar mit `Math.max(1, …)`, aber darauf darf
   * sich die Rechnung nicht verlassen. Seit die Stellschrauben in einer
   * Tabelle stehen, war `STUFEN[-1]` schlicht `undefined` und der nächste
   * Zugriff warf; die frühere if-Kette hatte das nie gekonnt.
   */
  for (const level of [0, -1, -100]) {
    it(`Level ${level} stürzt nicht ab, sondern gibt die leichteste Stufe`, () => {
      expect(stufeFuerLevel(level)).toBe(0);
      expect(() => musterAufgabe(saatAus('gehirnjogging', level, 0), level)).not.toThrow();
      const a = musterAufgabe(saatAus('gehirnjogging', level, 0), level);
      expect(a.folge).toHaveLength(4);
      expect(a.antworten).toHaveLength(4);
    });
  }
});
