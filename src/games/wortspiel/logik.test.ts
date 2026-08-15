import { describe, it, expect } from 'vitest';
import {
  WOERTER_PRO_LEVEL,
  antwortWaehlen,
  maxStufeFuerLevel,
  naechstesWort,
  neuesLevel,
  punkteFuerAntwort,
} from './logik';
import { WOERTER } from './woerter';

describe('maxStufeFuerLevel', () => {
  it('erlaubt bis Level 20 nur Stufe 1, bis Level 50 bis Stufe 2, danach alles', () => {
    expect(maxStufeFuerLevel(1)).toBe(1);
    expect(maxStufeFuerLevel(20)).toBe(1);
    expect(maxStufeFuerLevel(21)).toBe(2);
    expect(maxStufeFuerLevel(50)).toBe(2);
    expect(maxStufeFuerLevel(51)).toBe(3);
    expect(maxStufeFuerLevel(9000)).toBe(3);
  });
});

describe('neuesLevel', () => {
  it('zieht bis Level 20 nur Wörter der Stufe 1', () => {
    const z = neuesLevel(10);
    expect(z.woerter.length).toBe(WOERTER_PRO_LEVEL);
    for (const w of z.woerter) expect(w.stufe).toBe(1);
  });

  it('zieht ab Level 51 auch aus allen drei Stufen', () => {
    // Über mehrere Level hinweg sollte mindestens einmal Stufe 3 dabei sein.
    let hatStufeDrei = false;
    for (let level = 51; level < 70; level++) {
      const z = neuesLevel(level);
      if (z.woerter.some((w) => w.stufe === 3)) hatStufeDrei = true;
    }
    expect(hatStufeDrei).toBe(true);
  });

  it('ist deterministisch: gleiche Levelnummer ergibt dieselben Wörter', () => {
    const a = neuesLevel(42);
    const b = neuesLevel(42);
    expect(a.woerter).toEqual(b.woerter);
  });

  it('startet mit leerem Fortschritt', () => {
    const z = neuesLevel(1);
    expect(z.index).toBe(0);
    expect(z.ausgewaehlt).toBeNull();
    expect(z.vorbei).toBe(false);
    expect(z.punkte).toBe(0);
    expect(z.richtigeAnzahl).toBe(0);
  });
});

describe('punkteFuerAntwort', () => {
  it('gibt bei falscher Antwort null Punkte', () => {
    expect(punkteFuerAntwort(false, 0)).toBe(0);
  });

  it('gibt bei richtiger Antwort Basis-Punkte plus Serien-Bonus, gedeckelt', () => {
    expect(punkteFuerAntwort(true, 1)).toBe(10);
    expect(punkteFuerAntwort(true, 2)).toBe(12);
    expect(punkteFuerAntwort(true, 50)).toBe(30);
  });
});

describe('antwortWaehlen', () => {
  it('erkennt die richtige Schreibweise aus dem Wortpool', () => {
    const wort = WOERTER[0]!;
    const z = neuesLevel(1);
    // Erstes Wort der Runde ersetzen, um einen bekannten Fall zu testen.
    const zMitBekanntemWort = { ...z, woerter: [wort, ...z.woerter.slice(1)] };
    const nach = antwortWaehlen(zMitBekanntemWort, wort.richtig);
    expect(nach.richtigeAnzahl).toBe(1);
    expect(nach.punkte).toBe(10);
  });

  it('lässt sich nicht zweimal für dasselbe Wort beantworten', () => {
    const z1 = antwortWaehlen(neuesLevel(1), 0);
    const z2 = antwortWaehlen(z1, 1);
    expect(z2).toEqual(z1);
  });
});

describe('naechstesWort', () => {
  it('ist ein No-op, solange das aktuelle Wort noch nicht beantwortet ist', () => {
    const z = neuesLevel(1);
    expect(naechstesWort(z)).toEqual(z);
  });

  it('meldet die Runde nach dem letzten Wort als vorbei', () => {
    let z = neuesLevel(1);
    for (let i = 0; i < WOERTER_PRO_LEVEL; i++) {
      z = antwortWaehlen(z, 0);
      z = naechstesWort(z);
    }
    expect(z.vorbei).toBe(true);
  });
});
