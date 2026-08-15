import { describe, it, expect } from 'vitest';
import {
  MIN_GRUPPE,
  NACHSCHUB_NACH_SCHUESSEN,
  PUNKTE_JE_GEFALLEN,
  PUNKTE_JE_KUGEL,
  SPALTEN,
  START_ZEILEN,
  VERLUST_ZEILE,
  ZEILEN,
  andocken,
  gruppeAb,
  haengendeKugeln,
  istVersetzt,
  leereWabe,
  nachbarn,
  nachschubZeile,
  neuesSpiel,
  tiefsteZeile,
  vorhandeneFarben,
  wabeLeer,
} from './logik';
import type { Feld, Punkt, Zustand } from './logik';

function stand(wabe: Feld[][], rest: Partial<Zustand> = {}): Zustand {
  return {
    wabe,
    aktuell: 0,
    naechste: 1,
    punkte: 0,
    seitNachschub: 0,
    vorbei: false,
    gewonnen: false,
    saat: 1,
    ...rest,
  };
}

describe('nachbarn', () => {
  it('hat in der Mitte immer genau sechs Nachbarn', () => {
    // Zeile 4 (gerade) und Zeile 5 (versetzt), jeweils weit vom Rand.
    expect(nachbarn({ spalte: 3, zeile: 4 })).toHaveLength(6);
    expect(nachbarn({ spalte: 3, zeile: 5 })).toHaveLength(6);
  });

  it('bleibt am Rand innerhalb des Felds', () => {
    for (const p of nachbarn({ spalte: 0, zeile: 0 })) {
      expect(p.spalte).toBeGreaterThanOrEqual(0);
      expect(p.zeile).toBeGreaterThanOrEqual(0);
      expect(p.spalte).toBeLessThan(SPALTEN);
      expect(p.zeile).toBeLessThan(ZEILEN);
    }
  });

  it('ist gegenseitig — wer mein Nachbar ist, hat mich auch als Nachbarn', () => {
    // Der eigentliche Prüfstein beim Wabenraster: ein Vorzeichenfehler im
    // Versatz fällt hier sofort auf, im Spiel dagegen kaum.
    for (let zeile = 0; zeile < ZEILEN; zeile++) {
      for (let spalte = 0; spalte < SPALTEN; spalte++) {
        const mich: Punkt = { spalte, zeile };
        for (const n of nachbarn(mich)) {
          const zurueck = nachbarn(n);
          expect(
            zurueck.some((z) => z.spalte === spalte && z.zeile === zeile),
            `${spalte},${zeile} ↔ ${n.spalte},${n.zeile}`,
          ).toBe(true);
        }
      }
    }
  });

  it('versetzt jede zweite Zeile', () => {
    expect(istVersetzt(0)).toBe(false);
    expect(istVersetzt(1)).toBe(true);
    expect(istVersetzt(2)).toBe(false);
  });

  it('greift bei versetzten Zeilen nach rechts, bei geraden nach links', () => {
    const gerade = nachbarn({ spalte: 3, zeile: 4 }).filter((p) => p.zeile === 3);
    expect(gerade.map((p) => p.spalte).sort()).toEqual([2, 3]);

    const versetzt = nachbarn({ spalte: 3, zeile: 5 }).filter((p) => p.zeile === 4);
    expect(versetzt.map((p) => p.spalte).sort()).toEqual([3, 4]);
  });
});

describe('gruppeAb', () => {
  it('findet eine einzelne Kugel als Gruppe der Größe 1', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    expect(gruppeAb(wabe, { spalte: 0, zeile: 0 })).toHaveLength(1);
  });

  it('findet zusammenhängende gleiche Farben', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    wabe[0]![1] = 1;
    wabe[0]![2] = 1;
    expect(gruppeAb(wabe, { spalte: 1, zeile: 0 })).toHaveLength(3);
  });

  it('läuft nicht über eine andere Farbe hinweg', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    wabe[0]![1] = 2;
    wabe[0]![2] = 1;
    expect(gruppeAb(wabe, { spalte: 0, zeile: 0 })).toHaveLength(1);
  });

  it('gibt bei einem leeren Feld nichts zurück', () => {
    expect(gruppeAb(leereWabe(), { spalte: 0, zeile: 0 })).toEqual([]);
  });

  it('findet auch über Zeilen hinweg zusammenhängende Kugeln', () => {
    const wabe = leereWabe();
    wabe[0]![2] = 3;
    // Nachbar unterhalb von (2,0): bei gerader Zeile sind das (1,1) und (2,1).
    wabe[1]![2] = 3;
    expect(gruppeAb(wabe, { spalte: 2, zeile: 0 })).toHaveLength(2);
  });
});

describe('haengendeKugeln', () => {
  it('meldet nichts, wenn alles an der obersten Zeile hängt', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    wabe[1]![0] = 1;
    expect(haengendeKugeln(wabe)).toEqual([]);
  });

  it('erkennt eine freischwebende Kugel', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1; // hängt oben
    wabe[5]![4] = 2; // schwebt
    expect(haengendeKugeln(wabe)).toEqual([{ spalte: 4, zeile: 5 }]);
  });

  it('erkennt eine ganze freischwebende Traube', () => {
    const wabe = leereWabe();
    wabe[4]![2] = 1;
    wabe[4]![3] = 1;
    wabe[5]![3] = 1;
    expect(haengendeKugeln(wabe)).toHaveLength(3);
  });

  it('zählt Farbe nicht mit — nur der Zusammenhang zählt', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    wabe[1]![0] = 4; // andere Farbe, hängt aber dran
    expect(haengendeKugeln(wabe)).toEqual([]);
  });
});

describe('Hilfsfunktionen', () => {
  it('wabeLeer erkennt das leere Feld', () => {
    expect(wabeLeer(leereWabe())).toBe(true);
    const eine = leereWabe();
    eine[3]![3] = 0;
    expect(wabeLeer(eine)).toBe(false);
  });

  it('tiefsteZeile findet die unterste belegte Zeile', () => {
    expect(tiefsteZeile(leereWabe())).toBe(-1);
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    wabe[6]![2] = 1;
    expect(tiefsteZeile(wabe)).toBe(6);
  });

  it('vorhandeneFarben listet jede Farbe genau einmal', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 3;
    wabe[0]![1] = 1;
    wabe[1]![0] = 3;
    expect(vorhandeneFarben(wabe)).toEqual([1, 3]);
  });
});

describe('neuesSpiel', () => {
  it('füllt genau die Startzeilen', () => {
    const z = neuesSpiel(7);
    expect(tiefsteZeile(z.wabe)).toBe(START_ZEILEN - 1);
    expect(z.wabe.slice(0, START_ZEILEN).flat().every((f) => f !== null)).toBe(true);
  });

  it('legt zwei Kugeln ins Rohr und startet bei 0 Punkten', () => {
    const z = neuesSpiel(7);
    expect(z.punkte).toBe(0);
    expect(z.vorbei).toBe(false);
    expect(Number.isInteger(z.aktuell)).toBe(true);
    expect(Number.isInteger(z.naechste)).toBe(true);
  });

  it('gleiche Saat ergibt dasselbe Spiel', () => {
    expect(neuesSpiel(31)).toEqual(neuesSpiel(31));
  });
});

describe('nachschubZeile', () => {
  it('schiebt alles eine Zeile tiefer und füllt oben auf', () => {
    const wabe = leereWabe();
    wabe[0]![2] = 4;
    const nach = nachschubZeile(wabe, 3);
    expect(nach.wabe[1]![2]).toBe(4);
    expect(nach.wabe[0]!.every((f) => f !== null)).toBe(true);
  });

  it('nimmt nur Farben, die es noch gibt', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    const nach = nachschubZeile(wabe, 5);
    expect(nach.wabe[0]!.every((f) => f === 2)).toBe(true);
  });
});

describe('andocken', () => {
  it('legt die Kugel ins Zielfeld, wenn keine Gruppe entsteht', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    const e = andocken(stand(wabe, { aktuell: 3, naechste: 4 }), { spalte: 5, zeile: 0 });
    expect(e.zustand.wabe[0]![5]).toBe(3);
    expect(e.geplatzt).toEqual([]);
    expect(e.zustand.punkte).toBe(0);
  });

  it('rückt die Kugeln im Rohr nach', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    const e = andocken(stand(wabe, { aktuell: 3, naechste: 4 }), { spalte: 5, zeile: 0 });
    expect(e.zustand.aktuell).toBe(4);
  });

  it('lässt eine Gruppe ab drei gleichen platzen und gibt Punkte', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    const e = andocken(stand(wabe, { aktuell: 2 }), { spalte: 2, zeile: 0 });
    expect(e.geplatzt).toHaveLength(MIN_GRUPPE);
    expect(e.zustand.wabe[0]!.slice(0, 3).every((f) => f === null)).toBe(true);
    expect(e.zustand.punkte).toBe(MIN_GRUPPE * PUNKTE_JE_KUGEL);
  });

  it('lässt eine Gruppe von zwei stehen', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    const e = andocken(stand(wabe, { aktuell: 2 }), { spalte: 1, zeile: 0 });
    expect(e.geplatzt).toEqual([]);
    expect(e.zustand.wabe[0]![1]).toBe(2);
  });

  it('lässt danach freischwebende Kugeln fallen und zählt sie extra', () => {
    const wabe = leereWabe();
    // Drei gleiche in der obersten Zeile, daran hängt eine andersfarbige.
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[1]![0] = 5; // hängt unter der Gruppe
    const e = andocken(stand(wabe, { aktuell: 2 }), { spalte: 2, zeile: 0 });
    expect(e.geplatzt).toHaveLength(3);
    expect(e.gefallen).toEqual([{ spalte: 0, zeile: 1 }]);
    expect(e.zustand.punkte).toBe(3 * PUNKTE_JE_KUGEL + PUNKTE_JE_GEFALLEN);
    expect(e.zustand.wabe[1]![0]).toBeNull();
  });

  it('tut nichts, wenn das Zielfeld belegt ist', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    const z = stand(wabe);
    expect(andocken(z, { spalte: 0, zeile: 0 }).zustand).toBe(z);
  });

  it('tut nichts, wenn die Runde vorbei ist', () => {
    const z = stand(leereWabe(), { vorbei: true });
    expect(andocken(z, { spalte: 0, zeile: 0 }).zustand).toBe(z);
  });

  it('ist gewonnen, wenn die letzte Kugel geplatzt ist', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    const e = andocken(stand(wabe, { aktuell: 2 }), { spalte: 2, zeile: 0 });
    expect(e.zustand.gewonnen).toBe(true);
    expect(e.zustand.vorbei).toBe(true);
  });

  it('ist verloren, wenn die Wabe die Verlustzeile erreicht', () => {
    const wabe = leereWabe();
    wabe[VERLUST_ZEILE]![0] = 1;
    const e = andocken(stand(wabe, { aktuell: 3 }), { spalte: 4, zeile: 0 });
    expect(e.zustand.vorbei).toBe(true);
    expect(e.zustand.gewonnen).toBe(false);
  });
});

describe('Nachschub', () => {
  it('kommt nach genügend Fehlschüssen und schiebt die Wabe tiefer', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 1;
    let z = stand(wabe, { seitNachschub: NACHSCHUB_NACH_SCHUESSEN - 1, aktuell: 4, naechste: 4 });
    // Ein Schuss, der keine Gruppe bildet.
    const e = andocken(z, { spalte: 6, zeile: 3 });
    expect(e.zustand.seitNachschub).toBe(0);
    expect(e.zustand.wabe[0]!.every((f) => f !== null)).toBe(true);
    expect(tiefsteZeile(e.zustand.wabe)).toBeGreaterThan(tiefsteZeile(z.wabe));
  });

  it('zählt nicht hoch, wenn etwas geplatzt ist', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    const e = andocken(stand(wabe, { aktuell: 2, seitNachschub: 3 }), { spalte: 2, zeile: 0 });
    expect(e.zustand.seitNachschub).toBe(3);
  });
});
