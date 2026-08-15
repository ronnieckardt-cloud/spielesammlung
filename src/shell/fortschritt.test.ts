import { describe, expect, it } from 'vitest';
import {
  ALLE_ERFOLGE,
  LEERER_FORTSCHRITT,
  fortschrittBereinigen,
  heute,
  rundeVerbuchen,
  serieFortschreiben,
  stufeAus,
  xpFuerStufe,
  type Fortschritt,
} from './fortschritt';

const SPIELE = 20;

/** Kurzform: eine Runde verbuchen und nur den neuen Stand behalten. */
function spielen(
  stand: Fortschritt,
  teil: Partial<Parameters<typeof rundeVerbuchen>[1]> = {},
): Fortschritt {
  return rundeVerbuchen(
    stand,
    { spielId: 'quiz', punkte: 10, gewonnen: false, bestwertVorher: 0, tag: '2026-08-15', ...teil },
    SPIELE,
  ).nachher;
}

describe('Stufen', () => {
  it('fängt bei Stufe 1 an', () => {
    const s = stufeAus(0);
    expect(s.stufe).toBe(1);
    expect(s.imLevel).toBe(0);
    expect(s.anteil).toBe(0);
  });

  it('steigt genau bei der Schwelle, nicht davor', () => {
    expect(stufeAus(xpFuerStufe(1) - 1).stufe).toBe(1);
    expect(stufeAus(xpFuerStufe(1)).stufe).toBe(2);
  });

  it('rechnet den Balken innerhalb der Stufe richtig', () => {
    // Genau eine Stufe geschafft plus die Hälfte der nächsten.
    const xp = xpFuerStufe(1) + xpFuerStufe(2) / 2;
    const s = stufeAus(xp);
    expect(s.stufe).toBe(2);
    expect(s.imLevel).toBe(xpFuerStufe(2) / 2);
    expect(s.anteil).toBeCloseTo(0.5);
  });

  it('bleibt über viele Stufen widerspruchsfrei', () => {
    // Die aufsummierten Kosten müssen exakt zur errechneten Stufe führen.
    let xp = 0;
    for (let stufe = 1; stufe <= 30; stufe++) {
      expect(stufeAus(xp).stufe).toBe(stufe);
      xp += xpFuerStufe(stufe);
    }
    expect(stufeAus(xp).stufe).toBe(31);
  });

  it('wird nie leichter, je höher die Stufe', () => {
    for (let stufe = 1; stufe < 40; stufe++) {
      expect(xpFuerStufe(stufe + 1)).toBeGreaterThan(xpFuerStufe(stufe));
    }
  });

  it('hängt sich bei unsinnig großen Werten nicht auf', () => {
    expect(stufeAus(Number.MAX_SAFE_INTEGER).stufe).toBeLessThanOrEqual(200);
    expect(stufeAus(-5).stufe).toBe(1);
  });
});

describe('Erfahrung je Runde', () => {
  it('gibt für die allererste Runde den Neu-Bonus', () => {
    const a = rundeVerbuchen(
      LEERER_FORTSCHRITT,
      { spielId: 'quiz', punkte: 5, gewonnen: false, bestwertVorher: 0, tag: '2026-08-15' },
      SPIELE,
    );
    // Runde 10 + drei Sterne 30 (erste Runde mit Punkten) + Bestleistung 25
    // + neues Spiel 50.
    expect(a.xpGewinn).toBe(115);
    expect(a.bestleistung).toBe(true);
  });

  it('gibt den Neu-Bonus nur einmal je Spiel', () => {
    const nach1 = spielen(LEERER_FORTSCHRITT, { punkte: 100 });
    const zweite = rundeVerbuchen(
      nach1,
      { spielId: 'quiz', punkte: 100, gewonnen: false, bestwertVorher: 100, tag: '2026-08-15' },
      SPIELE,
    );
    // Kein Neu-Bonus mehr, keine Bestleistung (gleich, nicht besser):
    // 10 + 3 Sterne * 10 = 40.
    expect(zweite.xpGewinn).toBe(40);
    expect(zweite.bestleistung).toBe(false);
  });

  it('belohnt einen Sieg zusätzlich', () => {
    const ohne = rundeVerbuchen(
      { ...LEERER_FORTSCHRITT, jeSpiel: { paare: { partien: 3, siege: 0, bestwert: 90, besteSterne: 3 } } },
      { spielId: 'paare', punkte: 50, gewonnen: false, bestwertVorher: 90, tag: '2026-08-15' },
      SPIELE,
    );
    const mit = rundeVerbuchen(
      { ...LEERER_FORTSCHRITT, jeSpiel: { paare: { partien: 3, siege: 0, bestwert: 90, besteSterne: 3 } } },
      { spielId: 'paare', punkte: 50, gewonnen: true, bestwertVorher: 90, tag: '2026-08-15' },
      SPIELE,
    );
    expect(mit.xpGewinn).toBeGreaterThan(ohne.xpGewinn);
    expect(mit.nachher.siege).toBe(1);
  });

  it('gibt bei null Punkten am wenigsten, aber nie nichts', () => {
    const a = rundeVerbuchen(
      { ...LEERER_FORTSCHRITT, jeSpiel: { quiz: { partien: 1, siege: 0, bestwert: 50, besteSterne: 2 } } },
      { spielId: 'quiz', punkte: 0, gewonnen: false, bestwertVorher: 50, tag: '2026-08-15' },
      SPIELE,
    );
    expect(a.sterne).toBe(1);
    expect(a.xpGewinn).toBe(20);
    expect(a.xpGewinn).toBeGreaterThan(0);
  });

  it('meldet den Stufenaufstieg genau in der Runde, die ihn auslöst', () => {
    // Kurz vor der Schwelle stehen bleiben.
    const knappDavor: Fortschritt = {
      ...LEERER_FORTSCHRITT,
      xp: xpFuerStufe(1) - 1,
      partien: 5,
      jeSpiel: { quiz: { partien: 5, siege: 0, bestwert: 999, besteSterne: 3 } },
    };
    const a = rundeVerbuchen(
      knappDavor,
      { spielId: 'quiz', punkte: 1, gewonnen: false, bestwertVorher: 999, tag: '2026-08-15' },
      SPIELE,
    );
    expect(a.neueStufe).toBe(2);

    // Eine Runde später darf es nicht noch einmal gemeldet werden.
    const b = rundeVerbuchen(
      a.nachher,
      { spielId: 'quiz', punkte: 1, gewonnen: false, bestwertVorher: 999, tag: '2026-08-15' },
      SPIELE,
    );
    expect(b.neueStufe).toBeUndefined();
  });

  it('lässt den Bestwert je Spiel nie sinken', () => {
    let stand = spielen(LEERER_FORTSCHRITT, { punkte: 500 });
    stand = spielen(stand, { punkte: 20, bestwertVorher: 500 });
    expect(stand.jeSpiel.quiz!.bestwert).toBe(500);
    expect(stand.jeSpiel.quiz!.partien).toBe(2);
  });
});

describe('Serie', () => {
  it('beginnt bei eins', () => {
    expect(serieFortschreiben(LEERER_FORTSCHRITT, '2026-08-15')).toBe(1);
  });

  it('zählt am Folgetag hoch', () => {
    const stand = { ...LEERER_FORTSCHRITT, serie: 3, letzterTag: '2026-08-14' };
    expect(serieFortschreiben(stand, '2026-08-15')).toBe(4);
  });

  it('bleibt am selben Tag stehen — zweimal spielen ist kein zweiter Tag', () => {
    const stand = { ...LEERER_FORTSCHRITT, serie: 3, letzterTag: '2026-08-15' };
    expect(serieFortschreiben(stand, '2026-08-15')).toBe(3);
  });

  it('reißt nach einem ausgelassenen Tag', () => {
    const stand = { ...LEERER_FORTSCHRITT, serie: 9, letzterTag: '2026-08-13' };
    expect(serieFortschreiben(stand, '2026-08-15')).toBe(1);
  });

  it('rechnet über Monats- und Jahresgrenzen richtig', () => {
    expect(serieFortschreiben({ ...LEERER_FORTSCHRITT, serie: 2, letzterTag: '2026-07-31' }, '2026-08-01')).toBe(3);
    expect(serieFortschreiben({ ...LEERER_FORTSCHRITT, serie: 2, letzterTag: '2025-12-31' }, '2026-01-01')).toBe(3);
    // Schaltjahr: 2028 ist eines.
    expect(serieFortschreiben({ ...LEERER_FORTSCHRITT, serie: 1, letzterTag: '2028-02-28' }, '2028-02-29')).toBe(2);
    expect(serieFortschreiben({ ...LEERER_FORTSCHRITT, serie: 2, letzterTag: '2028-02-29' }, '2028-03-01')).toBe(3);
  });

  it('merkt sich die längste Serie, auch wenn die laufende reißt', () => {
    let stand = LEERER_FORTSCHRITT;
    for (const tag of ['2026-08-10', '2026-08-11', '2026-08-12']) {
      stand = spielen(stand, { tag });
    }
    expect(stand.serie).toBe(3);
    stand = spielen(stand, { tag: '2026-08-20' });
    expect(stand.serie).toBe(1);
    expect(stand.laengsteSerie).toBe(3);
  });
});

describe('Erfolge', () => {
  it('haben eindeutige ids und vollständige Texte', () => {
    const ids = ALLE_ERFOLGE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ALLE_ERFOLGE) {
      expect(e.titel.length).toBeGreaterThan(0);
      expect(e.beschreibung.length).toBeGreaterThan(0);
      expect(e.symbol.length).toBeGreaterThan(0);
    }
  });

  it('kommen in der Runde, die sie auslöst — nicht eine später', () => {
    let stand = LEERER_FORTSCHRITT;
    // Neun Runden: „Warmgelaufen" (10 Runden) darf noch nicht da sein.
    for (let i = 0; i < 9; i++) stand = spielen(stand, { bestwertVorher: 999 });
    expect(stand.erfolge).not.toContain('zehn-partien');

    const zehnte = rundeVerbuchen(
      stand,
      { spielId: 'quiz', punkte: 10, gewonnen: false, bestwertVorher: 999, tag: '2026-08-15' },
      SPIELE,
    );
    expect(zehnte.neueErfolge.map((e) => e.id)).toContain('zehn-partien');
  });

  it('werden nie doppelt vergeben', () => {
    let stand = LEERER_FORTSCHRITT;
    for (let i = 0; i < 30; i++) stand = spielen(stand, { bestwertVorher: 999 });
    const gezaehlt = new Set(stand.erfolge);
    expect(gezaehlt.size).toBe(stand.erfolge.length);

    const weitere = rundeVerbuchen(
      stand,
      { spielId: 'quiz', punkte: 10, gewonnen: false, bestwertVorher: 999, tag: '2026-08-15' },
      SPIELE,
    );
    expect(weitere.neueErfolge).toHaveLength(0);
  });

  it('schaltet „Alles ausprobiert" erst beim letzten Spiel frei', () => {
    let stand = LEERER_FORTSCHRITT;
    for (let i = 0; i < SPIELE - 1; i++) {
      stand = spielen(stand, { spielId: `spiel-${i}` });
    }
    expect(stand.erfolge).toContain('fuenf-spiele');
    expect(stand.erfolge).not.toContain('alle-spiele');

    const letztes = rundeVerbuchen(
      stand,
      { spielId: 'spiel-letztes', punkte: 10, gewonnen: false, bestwertVorher: 0, tag: '2026-08-15' },
      SPIELE,
    );
    expect(letztes.neueErfolge.map((e) => e.id)).toContain('alle-spiele');
  });

  it('gibt den Serien-Erfolg nach drei Tagen hintereinander', () => {
    let stand = LEERER_FORTSCHRITT;
    stand = spielen(stand, { tag: '2026-08-13' });
    stand = spielen(stand, { tag: '2026-08-14' });
    expect(stand.erfolge).not.toContain('serie-3');
    const dritter = rundeVerbuchen(
      stand,
      { spielId: 'quiz', punkte: 10, gewonnen: false, bestwertVorher: 999, tag: '2026-08-15' },
      SPIELE,
    );
    expect(dritter.neueErfolge.map((e) => e.id)).toContain('serie-3');
  });
});

describe('Gespeichertes bereinigen', () => {
  it('macht aus Unsinn einen brauchbaren Stand', () => {
    for (const müll of [null, undefined, 42, 'text', [], { xp: 'viel' }]) {
      const f = fortschrittBereinigen(müll);
      expect(f.xp).toBe(0);
      expect(f.jeSpiel).toEqual({});
      expect(f.erfolge).toEqual([]);
    }
  });

  it('wirft negative und gebrochene Zahlen weg', () => {
    const f = fortschrittBereinigen({
      xp: -100,
      partien: 3.7,
      jeSpiel: { quiz: { partien: -1, siege: 2, bestwert: 50.9, besteSterne: 99 } },
      erfolge: ['erste-runde', 7, null],
    });
    expect(f.xp).toBe(0);
    expect(f.partien).toBe(3);
    expect(f.jeSpiel.quiz).toEqual({ partien: 0, siege: 2, bestwert: 50, besteSterne: 3 });
    expect(f.erfolge).toEqual(['erste-runde']);
  });

  it('lässt einen gültigen Stand unverändert durch', () => {
    let stand = LEERER_FORTSCHRITT;
    stand = spielen(stand, { punkte: 120, gewonnen: true });
    expect(fortschrittBereinigen(stand)).toEqual(stand);
  });
});

describe('heute()', () => {
  it('liefert die Ortszeit im Format JJJJ-MM-TT', () => {
    expect(heute(new Date(2026, 7, 15, 23, 30))).toBe('2026-08-15');
    expect(heute(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});
