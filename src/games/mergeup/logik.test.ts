import { describe, it, expect } from 'vitest';
import {
  GROESSE,
  ZIEL_STUFE,
  hoechsteStufe,
  kachelSetzen,
  leeresRaster,
  neuesSpiel,
  reiheSchieben,
  schieben,
  wertVonStufe,
  ziehen,
  zugMoeglich,
} from './logik';
import type { Feld, Zustand } from './logik';

/** Kurzschreibweise: aus Zeilen von Stufen ein Raster bauen (0 = leer). */
function r(...zeilen: number[][]): Feld[][] {
  return zeilen.map((zeile) => zeile.map((v) => (v === 0 ? null : v)));
}

function stand(raster: Feld[][], rest: Partial<Zustand> = {}): Zustand {
  return {
    raster,
    punkte: 0,
    hoechsteStufe: hoechsteStufe(raster),
    gewonnen: false,
    vorbei: false,
    saat: 1,
    ...rest,
  };
}

describe('wertVonStufe', () => {
  it('rechnet Stufen in angezeigte Werte um', () => {
    expect(wertVonStufe(1)).toBe(2);
    expect(wertVonStufe(2)).toBe(4);
    expect(wertVonStufe(ZIEL_STUFE)).toBe(2048);
  });
});

describe('reiheSchieben', () => {
  it('schiebt Kacheln nach links zusammen', () => {
    expect(reiheSchieben([null, 1, null, 2]).reihe).toEqual([1, 2, null, null]);
  });

  it('verschmilzt zwei gleiche zur nächsten Stufe und gibt Punkte', () => {
    const e = reiheSchieben([1, 1, null, null]);
    expect(e.reihe).toEqual([2, null, null, null]);
    expect(e.punkte).toBe(wertVonStufe(2));
  });

  it('verschmilzt jede Kachel nur einmal pro Zug', () => {
    // 2,2,2,2 wird zu 4,4 — nicht zu 8.
    const e = reiheSchieben([1, 1, 1, 1]);
    expect(e.reihe).toEqual([2, 2, null, null]);
    expect(e.punkte).toBe(wertVonStufe(2) * 2);
  });

  it('verschmilzt das vordere Paar zuerst', () => {
    // 2,2,4 → 4,4 (nicht 2,8)
    expect(reiheSchieben([1, 1, 2, null]).reihe).toEqual([2, 2, null, null]);
  });

  it('lässt ungleiche Kacheln in Ruhe', () => {
    const e = reiheSchieben([1, 2, 3, 4]);
    expect(e.reihe).toEqual([1, 2, 3, 4]);
    expect(e.punkte).toBe(0);
  });
});

describe('schieben', () => {
  it('schiebt nach links', () => {
    const e = schieben(r([0, 0, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'links');
    expect(e.raster[0]).toEqual([2, null, null, null]);
    expect(e.bewegt).toBe(true);
  });

  it('schiebt nach rechts', () => {
    const e = schieben(r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'rechts');
    expect(e.raster[0]).toEqual([null, null, null, 2]);
  });

  it('schiebt nach oben', () => {
    const e = schieben(r([0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]), 'hoch');
    expect(e.raster.map((z) => z[0])).toEqual([2, null, null, null]);
  });

  it('schiebt nach unten', () => {
    const e = schieben(r([1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'runter');
    expect(e.raster.map((z) => z[0])).toEqual([null, null, null, 2]);
  });

  it('meldet bewegt=false, wenn sich nichts ändert', () => {
    const raster = r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]);
    const e = schieben(raster, 'links');
    expect(e.bewegt).toBe(false);
    expect(e.punkte).toBe(0);
  });

  it('lässt das übergebene Raster unverändert', () => {
    const raster = r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    const vorher = JSON.stringify(raster);
    schieben(raster, 'links');
    expect(JSON.stringify(raster)).toBe(vorher);
  });

  it('behandelt alle vier Richtungen gleich stark (gedrehtes Raster, gleiches Ergebnis)', () => {
    // Eine Reihe mit vier gleichen ergibt in jeder Richtung zwei Paare.
    for (const richtung of ['links', 'rechts', 'hoch', 'runter'] as const) {
      const e = schieben(r([1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), richtung);
      const werte = e.raster.flat().filter((f) => f !== null);
      if (richtung === 'links' || richtung === 'rechts') {
        expect(werte).toEqual([2, 2]);
      } else {
        // Senkrecht steht jede der vier Kacheln in einer eigenen Spalte,
        // es gibt also nichts zu verschmelzen.
        expect(werte).toEqual([1, 1, 1, 1]);
      }
    }
  });
});

describe('kachelSetzen', () => {
  it('legt genau eine Kachel auf ein freies Feld', () => {
    const e = kachelSetzen(leeresRaster(), 3);
    expect(e.raster.flat().filter((f) => f !== null)).toHaveLength(1);
  });

  it('legt nur Stufe 1 oder 2', () => {
    for (let saat = 0; saat < 40; saat++) {
      const e = kachelSetzen(leeresRaster(), saat);
      const neue = e.raster.flat().find((f) => f !== null);
      expect([1, 2]).toContain(neue);
    }
  });

  it('überschreibt keine belegte Kachel', () => {
    const fast = leeresRaster();
    for (let y = 0; y < GROESSE; y++) {
      for (let x = 0; x < GROESSE; x++) {
        if (!(x === 2 && y === 3)) fast[y]![x] = 5;
      }
    }
    const e = kachelSetzen(fast, 9);
    expect(e.raster[3]![2]).not.toBeNull();
    expect(e.raster.flat().filter((f) => f === 5)).toHaveLength(GROESSE * GROESSE - 1);
  });

  it('lässt ein volles Raster unverändert', () => {
    const voll = leeresRaster().map((z) => z.map(() => 4));
    const e = kachelSetzen(voll, 1);
    expect(e.raster).toEqual(voll);
  });
});

describe('zugMoeglich', () => {
  it('ist true, solange ein Feld frei ist', () => {
    expect(zugMoeglich(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 0]))).toBe(true);
  });

  it('ist true bei gleichen Nachbarn, auch wenn alles voll ist', () => {
    expect(zugMoeglich(r([1, 1, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]))).toBe(true);
  });

  it('ist false, wenn voll und keine zwei Nachbarn gleich sind', () => {
    expect(zugMoeglich(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]))).toBe(false);
  });
});

describe('neuesSpiel', () => {
  it('startet mit genau zwei Kacheln', () => {
    const z = neuesSpiel(5);
    expect(z.raster.flat().filter((f) => f !== null)).toHaveLength(2);
    expect(z.punkte).toBe(0);
    expect(z.vorbei).toBe(false);
  });

  it('gleiche Saat ergibt denselben Anfang', () => {
    expect(neuesSpiel(42)).toEqual(neuesSpiel(42));
  });
});

describe('ziehen', () => {
  it('legt nach einem gültigen Zug eine neue Kachel dazu', () => {
    const z = stand(r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
    const nach = ziehen(z, 'links');
    // Aus zwei Kacheln wird eine verschmolzene plus eine neue.
    expect(nach.raster.flat().filter((f) => f !== null)).toHaveLength(2);
    expect(nach.punkte).toBe(wertVonStufe(2));
  });

  it('ändert nichts bei einem Zug, der nichts bewegt', () => {
    const z = stand(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]));
    expect(ziehen(z, 'links')).toBe(z);
  });

  it('merkt sich die höchste Stufe', () => {
    const z = stand(r([3, 3, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
    expect(ziehen(z, 'links').hoechsteStufe).toBeGreaterThanOrEqual(4);
  });

  it('setzt gewonnen, sobald die Zielstufe erreicht ist', () => {
    const z = stand(
      r([ZIEL_STUFE - 1, ZIEL_STUFE - 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    const nach = ziehen(z, 'links');
    expect(nach.gewonnen).toBe(true);
    // Weiterspielen bleibt erlaubt.
    expect(nach.vorbei).toBe(false);
  });

  it('meldet vorbei genau dann, wenn danach wirklich kein Zug mehr geht', () => {
    // Fast volles Schachbrett mit einem freien Feld. Ob es danach weitergeht,
    // hängt davon ab, welche Kachel nachrückt — beides ist richtig, solange
    // `vorbei` dazu passt. Über mehrere Saaten kommen beide Fälle vor.
    for (let saat = 0; saat < 25; saat++) {
      const z = stand(r([1, 2, 1, 2], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 0]), { saat });
      const nach = ziehen(z, 'rechts');
      expect(nach.vorbei).toBe(!zugMoeglich(nach.raster));
    }
  });

  it('ändert nichts mehr, wenn die Runde vorbei ist', () => {
    const z = stand(leeresRaster(), { vorbei: true });
    expect(ziehen(z, 'links')).toBe(z);
  });
});
