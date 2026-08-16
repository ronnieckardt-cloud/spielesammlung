import { describe, expect, it } from 'vitest';
import { statistikGesamt, statistikZeilen } from './statistik';
import type { SpielStatistik } from './fortschritt';
import type { Eintrag } from './speicher';

const IDS = ['a', 'b', 'c'] as const;

function stat(teil: Partial<SpielStatistik>): SpielStatistik {
  return { partien: 0, siege: 0, bestwert: 0, besteSterne: 0, ...teil };
}

describe('statistikZeilen', () => {
  it('baut für jede id eine Zeile, auch ohne Daten', () => {
    const zeilen = statistikZeilen(IDS, {}, {});
    expect(zeilen).toHaveLength(3);
    expect(zeilen.every((z) => z.partien === 0 && z.zuletzt === null)).toBe(true);
  });

  it('übernimmt Runden, Siege, Sterne und Bestwert unverändert aus jeSpiel', () => {
    const zeilen = statistikZeilen(
      ['a'],
      { a: stat({ partien: 7, siege: 3, besteSterne: 2, bestwert: 450 }) },
      {},
    );
    expect(zeilen[0]).toMatchObject({ partien: 7, siege: 3, besteSterne: 2, bestwert: 450 });
  });

  it('nimmt das jüngste Datum aus der Bestenliste, nicht das erste', () => {
    const bestenliste: Eintrag[] = [
      { punkte: 900, datum: '2026-01-01T00:00:00.000Z' }, // beste Punktzahl, aber älter
      { punkte: 300, datum: '2026-06-15T00:00:00.000Z' }, // schwächer, aber neuer
    ];
    const zeilen = statistikZeilen(['a'], { a: stat({ partien: 2 }) }, { a: bestenliste });
    expect(zeilen[0]!.zuletzt).toBe('2026-06-15T00:00:00.000Z');
  });

  it('sortiert gespielte Spiele nach dem jüngsten Datum, neueste zuerst', () => {
    const zeilen = statistikZeilen(
      IDS,
      { a: stat({ partien: 1 }), b: stat({ partien: 1 }), c: stat({ partien: 1 }) },
      {
        a: [{ punkte: 1, datum: '2026-03-01' }],
        b: [{ punkte: 1, datum: '2026-05-01' }],
        c: [{ punkte: 1, datum: '2026-01-01' }],
      },
    );
    expect(zeilen.map((z) => z.id)).toEqual(['b', 'a', 'c']);
  });

  it('stellt nie gespielte Spiele ans Ende, in der ursprünglichen Reihenfolge', () => {
    const zeilen = statistikZeilen(
      IDS,
      { b: stat({ partien: 5 }) },
      { b: [{ punkte: 1, datum: '2026-01-01' }] },
    );
    // b ist gespielt und steht vorn; a und c folgen in ihrer Ausgangsreihenfolge.
    expect(zeilen.map((z) => z.id)).toEqual(['b', 'a', 'c']);
  });

  it('fehlt ein Eintrag ganz, wird er wie „nie gespielt" behandelt statt zu werfen', () => {
    expect(() => statistikZeilen(IDS, {}, {})).not.toThrow();
  });
});

describe('statistikGesamt', () => {
  it('summiert über alle Zeilen', () => {
    const zeilen = statistikZeilen(
      IDS,
      {
        a: stat({ partien: 3, siege: 1, besteSterne: 2 }),
        b: stat({ partien: 5, siege: 4, besteSterne: 3 }),
      },
      {},
    );
    expect(statistikGesamt(zeilen)).toEqual({ partien: 8, siege: 5, sterne: 5, ausprobiert: 2 });
  });

  it('bei komplett leerem Fortschritt sind alle Werte 0', () => {
    const zeilen = statistikZeilen(IDS, {}, {});
    expect(statistikGesamt(zeilen)).toEqual({ partien: 0, siege: 0, sterne: 0, ausprobiert: 0 });
  });
});
