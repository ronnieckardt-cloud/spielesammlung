import { describe, it, expect } from 'vitest';
import {
  AUFGABEN_PRO_LEVEL,
  aufgabeAbschliessen,
  naechsteAufgabe,
  neuesLevel,
  punkteFuerAntwort,
  varianteFuerLevel,
} from './logik';

describe('varianteFuerLevel', () => {
  it('rotiert reihum: Kopfrechnen, Merk-Folgen, Muster', () => {
    expect(varianteFuerLevel(1)).toBe('kopfrechnen');
    expect(varianteFuerLevel(2)).toBe('merkfolgen');
    expect(varianteFuerLevel(3)).toBe('muster');
    expect(varianteFuerLevel(4)).toBe('kopfrechnen');
    expect(varianteFuerLevel(90)).toBe('muster');
    expect(varianteFuerLevel(91)).toBe('kopfrechnen');
  });
});

describe('neuesLevel', () => {
  it('erzeugt genau AUFGABEN_PRO_LEVEL Aufgaben derselben Variante wie das Level', () => {
    for (const level of [1, 2, 3, 17, 90, 200]) {
      const z = neuesLevel(level);
      expect(z.aufgaben).toHaveLength(AUFGABEN_PRO_LEVEL);
      for (const a of z.aufgaben) expect(a.art).toBe(varianteFuerLevel(level));
      expect(z.index).toBe(0);
      expect(z.ergebnis).toBeNull();
      expect(z.vorbei).toBe(false);
      expect(z.punkte).toBe(0);
      expect(z.richtigeAnzahl).toBe(0);
      expect(z.serie).toBe(0);
    }
  });

  it('ist deterministisch: gleiche Levelnummer ergibt dieselben Aufgaben', () => {
    const a = neuesLevel(42);
    const b = neuesLevel(42);
    expect(a.aufgaben).toEqual(b.aufgaben);
  });
});

describe('punkteFuerAntwort', () => {
  it('gibt bei falscher Antwort null Punkte', () => {
    expect(punkteFuerAntwort(false, 0)).toBe(0);
    expect(punkteFuerAntwort(false, 5)).toBe(0);
  });

  it('gibt bei richtiger Antwort Basis-Punkte plus Serien-Bonus, gedeckelt', () => {
    expect(punkteFuerAntwort(true, 1)).toBe(10);
    expect(punkteFuerAntwort(true, 2)).toBe(12);
    expect(punkteFuerAntwort(true, 11)).toBe(30);
    expect(punkteFuerAntwort(true, 50)).toBe(30);
  });
});

describe('aufgabeAbschliessen', () => {
  it('setzt das Ergebnis und zählt Punkte, richtige Antworten und Serie hoch', () => {
    const z1 = aufgabeAbschliessen(neuesLevel(1), true);
    expect(z1.ergebnis).toBe(true);
    expect(z1.richtigeAnzahl).toBe(1);
    expect(z1.serie).toBe(1);
    expect(z1.punkte).toBe(10);

    const z2 = aufgabeAbschliessen(z1, false);
    // Zweiter Aufruf auf derselben Aufgabe ist ein No-op — erst naechsteAufgabe schaltet weiter.
    expect(z2).toEqual(z1);
  });

  it('setzt die Serie bei einer falschen Antwort zurück', () => {
    let z = neuesLevel(1);
    z = aufgabeAbschliessen(z, true);
    z = naechsteAufgabe(z);
    z = aufgabeAbschliessen(z, false);
    expect(z.serie).toBe(0);
    expect(z.richtigeAnzahl).toBe(1);
  });
});

describe('naechsteAufgabe', () => {
  it('ist ein No-op, solange die aktuelle Aufgabe noch kein Ergebnis hat', () => {
    const z = neuesLevel(1);
    expect(naechsteAufgabe(z)).toEqual(z);
  });

  it('schaltet nach einem Ergebnis weiter und setzt es für die neue Aufgabe zurück', () => {
    let z = neuesLevel(1);
    z = aufgabeAbschliessen(z, true);
    z = naechsteAufgabe(z);
    expect(z.index).toBe(1);
    expect(z.ergebnis).toBeNull();
    expect(z.vorbei).toBe(false);
  });

  it('meldet die Runde nach der letzten Aufgabe als vorbei', () => {
    let z = neuesLevel(1);
    for (let i = 0; i < AUFGABEN_PRO_LEVEL; i++) {
      z = aufgabeAbschliessen(z, true);
      z = naechsteAufgabe(z);
    }
    expect(z.vorbei).toBe(true);
    expect(z.richtigeAnzahl).toBe(AUFGABEN_PRO_LEVEL);
  });
});
