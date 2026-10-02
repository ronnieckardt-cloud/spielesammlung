import { describe, it, expect } from 'vitest';
import {
  ANZAHL_FARBEN,
  BOMBE_AB_GEFALLEN,
  ETAPPEN_BONUS,
  FAKTOR_MAX,
  MIN_GRUPPE,
  NACHSCHUB_NACH_SCHUESSEN,
  PUNKTE_JE_GEFALLEN,
  PUNKTE_JE_KUGEL,
  REGENBOGEN_ALLE,
  SPALTEN,
  START_ZEILEN,
  STEIN,
  VERLUST_ZEILE,
  ZEILEN,
  andocken,
  etappenWabe,
  felsenFuer,
  gruppeAb,
  haengendeKugeln,
  istVersetzt,
  leereWabe,
  nachbarn,
  nachschubIntervall,
  nachschubZeile,
  neuesSpiel,
  regenbogenFarbe,
  serieFaktor,
  spezialUmschalten,
  startZeilenFuer,
  tauschen,
  tiefsteZeile,
  vorhandeneFarben,
  wabeLeer,
} from './logik';
import type { Feld, Punkt, Zustand } from './logik';
import { MAX_ABWEICHUNG, SENKRECHT, flugbahn } from './geometrie';
import { schritt } from '../../core/rng';

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
    etappe: 1,
    serie: 0,
    spezial: null,
    bereit: false,
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
    wabe[0]![7] = 4; // Farbe 4 liegt im Feld, darf also ins Rohr nachrücken.
    const e = andocken(stand(wabe, { aktuell: 3, naechste: 4 }), { spalte: 5, zeile: 0 });
    expect(e.zustand.aktuell).toBe(4);
  });

  it('tauscht die Kugel im Rohr, wenn ihre Farbe nicht mehr im Feld liegt', () => {
    // Die drei Zweier platzen mit diesem Schuss weg — danach gibt es im Feld
    // nur noch Farbe 1. Die Vorschaukugel (Farbe 2) wäre unbrauchbar.
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[0]![7] = 1;
    const e = andocken(stand(wabe, { aktuell: 2, naechste: 2 }), { spalte: 2, zeile: 0 });
    expect(vorhandeneFarben(e.zustand.wabe)).toEqual([1]);
    expect(e.zustand.aktuell).toBe(1);
  });

  it('lässt die Kugel im Rohr in Ruhe, solange es ihre Farbe noch gibt', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[0]![7] = 3;
    wabe[1]![7] = 1;
    const e = andocken(stand(wabe, { aktuell: 2, naechste: 3 }), { spalte: 2, zeile: 0 });
    expect(e.zustand.aktuell).toBe(3);
  });

  it('lässt eine Gruppe ab drei gleichen platzen und gibt Punkte', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[0]![7] = 3; // Ballast: Ohne ihn wäre das Feld danach leer, und es begänne eine neue Etappe.
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
    wabe[0]![7] = 3; // Ballast, damit das Feld nicht leer wird
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

  it('beginnt eine neue Etappe, wenn die letzte Kugel geplatzt ist — die Runde endet nicht', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    const e = andocken(stand(wabe, { aktuell: 2 }), { spalte: 2, zeile: 0 });
    expect(e.etappeGeschafft).toBe(true);
    expect(e.zustand.gewonnen).toBe(true);
    expect(e.zustand.vorbei).toBe(false);
    expect(e.zustand.etappe).toBe(2);
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
    wabe[0]![7] = 3; // Ballast, damit das Feld nicht leer wird
    const e = andocken(stand(wabe, { aktuell: 2, seitNachschub: 3 }), { spalte: 2, zeile: 0 });
    expect(e.zustand.seitNachschub).toBe(3);
  });
});

/* ====== Entscheidungen: Tauschen, Serie, Spezialkugeln, Felsen, Etappen ====================== */

/** Eine Wabe mit allen fünf Farben in der obersten Zeile — als Ballast, damit sie nie leer wird. */
function volleDecke(): Feld[][] {
  const wabe = leereWabe();
  for (let s = 0; s < SPALTEN; s++) wabe[0]![s] = s % ANZAHL_FARBEN;
  return wabe;
}

describe('Tauschen', () => {
  it('vertauscht die Kugel im Rohr mit der nächsten', () => {
    const z = stand(volleDecke(), { aktuell: 1, naechste: 2 });
    const t = tauschen(z);
    expect(t.aktuell).toBe(2);
    expect(t.naechste).toBe(1);
  });

  it('tut nichts bei gleichen Kugeln, nach dem Ende oder solange die Spezialkugel im Rohr liegt', () => {
    const gleich = stand(volleDecke(), { aktuell: 3, naechste: 3 });
    expect(tauschen(gleich)).toBe(gleich);
    const vorbei = stand(volleDecke(), { aktuell: 1, naechste: 2, vorbei: true });
    expect(tauschen(vorbei)).toBe(vorbei);
    const bereit = stand(volleDecke(), { aktuell: 1, naechste: 2, spezial: 'bombe', bereit: true });
    expect(tauschen(bereit)).toBe(bereit);
  });

  it('ändert nicht, was danach kommt: Die getauschte Kugel kommt als Nächste dran', () => {
    const z = stand(volleDecke(), { aktuell: 1, naechste: 2 });
    const e = andocken(tauschen(z), { spalte: 3, zeile: 3 });
    expect(e.zustand.wabe[3]![3]).toBe(2); // die getauschte Kugel wurde geschossen
    expect(e.zustand.aktuell).toBe(1); // die alte Kugel im Rohr rückt nach
  });
});

describe('Serie', () => {
  it('serieFaktor wächst mit der Serie und bleibt bei FAKTOR_MAX stehen', () => {
    expect([0, 1, 2, 3, 4].map(serieFaktor)).toEqual([1, 1, 2, 3, 4]);
    expect(serieFaktor(50)).toBe(FAKTOR_MAX);
    expect(serieFaktor(-3)).toBe(1);
  });

  it('der zweite Treffer in Folge zählt doppelt, ein Fehlschuss setzt die Serie zurück', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[0]![5] = 3;
    wabe[0]![6] = 3;
    wabe[0]![7] = 1; // Ballast
    // Erster Schuss: Farbe 2 an (2,0) → Gruppe aus drei, Serie 1, Faktor 1.
    const erster = andocken(stand(wabe, { aktuell: 2, naechste: 3 }), { spalte: 2, zeile: 0 });
    expect(erster.faktor).toBe(1);
    expect(erster.zustand.serie).toBe(1);
    expect(erster.gewinn).toBe(3 * PUNKTE_JE_KUGEL);
    // Zweiter Schuss: Farbe 3 an (4,0) → wieder drei, Serie 2, Faktor 2.
    const zweiter = andocken(erster.zustand, { spalte: 4, zeile: 0 });
    expect(zweiter.faktor).toBe(2);
    expect(zweiter.zustand.serie).toBe(2);
    expect(zweiter.gewinn).toBe(3 * PUNKTE_JE_KUGEL * 2);
    expect(zweiter.zustand.punkte).toBe(3 * PUNKTE_JE_KUGEL + 3 * PUNKTE_JE_KUGEL * 2);
    // Ein Schuss, der nichts bildet: Serie weg.
    const fehl = andocken({ ...zweiter.zustand, aktuell: 4 }, { spalte: 3, zeile: 4 });
    expect(fehl.zustand.serie).toBe(0);
    expect(fehl.faktor).toBe(1);
  });
});

describe('Spezialkugeln verdienen', () => {
  /** Ein Dreier an der Decke, an dem unten `anzahl` Kugeln nur hängen. */
  function absturz(anzahl: number): Feld[][] {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[0]![7] = 1; // Ballast
    const haengend: Punkt[] = [
      { spalte: 0, zeile: 1 },
      { spalte: 1, zeile: 1 },
      { spalte: 2, zeile: 1 },
      { spalte: 0, zeile: 2 },
      { spalte: 1, zeile: 2 },
    ];
    haengend.slice(0, anzahl).forEach((p, i) => (wabe[p.zeile]![p.spalte] = 3 + (i % 2)));
    return wabe;
  }

  it(`ein Schuss, der ${BOMBE_AB_GEFALLEN} oder mehr Kugeln herunterholt, bringt eine Bombe`, () => {
    const e = andocken(stand(absturz(BOMBE_AB_GEFALLEN), { aktuell: 2, naechste: 1 }), { spalte: 2, zeile: 0 });
    expect(e.gefallen).toHaveLength(BOMBE_AB_GEFALLEN);
    expect(e.verdient).toBe('bombe');
    expect(e.zustand.spezial).toBe('bombe');
    expect(e.gewinn).toBe(3 * PUNKTE_JE_KUGEL + BOMBE_AB_GEFALLEN * PUNKTE_JE_GEFALLEN);
  });

  it('weniger als das bringt keine Bombe', () => {
    const e = andocken(stand(absturz(BOMBE_AB_GEFALLEN - 1), { aktuell: 2, naechste: 1 }), { spalte: 2, zeile: 0 });
    expect(e.verdient).toBeNull();
    expect(e.zustand.spezial).toBeNull();
  });

  it(`jeder ${REGENBOGEN_ALLE}. Treffer in Folge bringt einen Regenbogen`, () => {
    const wabe = absturz(0);
    const e = andocken(stand(wabe, { aktuell: 2, naechste: 1, serie: REGENBOGEN_ALLE - 1 }), { spalte: 2, zeile: 0 });
    expect(e.zustand.serie).toBe(REGENBOGEN_ALLE);
    expect(e.verdient).toBe('regenbogen');
    expect(e.zustand.spezial).toBe('regenbogen');
    // Der Treffer davor war keiner.
    const davor = andocken(stand(absturz(0), { aktuell: 2, naechste: 1, serie: REGENBOGEN_ALLE - 2 }), { spalte: 2, zeile: 0 });
    expect(davor.verdient).toBeNull();
  });

  it('solange man eine Spezialkugel hat, kommt keine zweite dazu', () => {
    const e = andocken(
      stand(absturz(BOMBE_AB_GEFALLEN), { aktuell: 2, naechste: 1, spezial: 'regenbogen' }),
      { spalte: 2, zeile: 0 },
    );
    expect(e.verdient).toBeNull();
    expect(e.zustand.spezial).toBe('regenbogen');
  });
});

describe('Spezialkugeln einsetzen', () => {
  it('spezialUmschalten legt sie ins Rohr und wieder heraus — ohne Spezialkugel passiert nichts', () => {
    const ohne = stand(volleDecke());
    expect(spezialUmschalten(ohne)).toBe(ohne);
    const mit = stand(volleDecke(), { spezial: 'bombe' });
    expect(spezialUmschalten(mit).bereit).toBe(true);
    expect(spezialUmschalten(spezialUmschalten(mit)).bereit).toBe(false);
  });

  it('die Bombe sprengt ihr Feld und alle Nachbarn — auch Felsen — und lässt das Rohr unberührt', () => {
    const wabe = volleDecke();
    const ziel: Punkt = { spalte: 3, zeile: 2 };
    wabe[1]![3] = 3;
    wabe[2]![2] = STEIN;
    wabe[2]![4] = 1;
    wabe[3]![2] = 4;
    // Etwas weiter weg, das stehenbleiben muss.
    wabe[1]![6] = 2;
    wabe[2]![6] = 0;
    const z = stand(wabe, { aktuell: 1, naechste: 2, spezial: 'bombe', bereit: true });
    const e = andocken(z, ziel);

    expect(e.art).toBe('bombe');
    for (const n of [ziel, ...nachbarn(ziel)]) expect(e.zustand.wabe[n.zeile]![n.spalte], `${n.spalte},${n.zeile}`).toBeNull();
    expect(e.zustand.wabe[1]![6]).toBe(2);
    expect(e.zustand.wabe[2]![6]).toBe(0);
    // Ziel plus vier Treffer im Nahbereich: (3,1), (2,2), (4,2), (2,3) — Zeile 1 ist versetzt, die Nachbarn oben sind (2,1) und (3,1).
    expect(e.geplatzt).toHaveLength(5);
    expect(e.zustand.punkte).toBe((4 * PUNKTE_JE_KUGEL + e.gefallen.length * PUNKTE_JE_GEFALLEN) * 1);
    // Verbraucht, und das Rohr ist unverändert.
    expect(e.zustand.spezial).toBeNull();
    expect(e.zustand.bereit).toBe(false);
    expect(e.zustand.aktuell).toBe(1);
    expect(e.zustand.naechste).toBe(2);
    expect(e.zustand.serie).toBe(1);
  });

  it('eine Bombe ohne Nachbarn ist vertan: keine Punkte, keine Serie, und es zählt als Fehlschuss', () => {
    const wabe = volleDecke();
    const z = stand(wabe, { aktuell: 1, naechste: 2, spezial: 'bombe', bereit: true, serie: 3, seitNachschub: 2 });
    const e = andocken(z, { spalte: 3, zeile: 6 });
    expect(e.geplatzt).toEqual([]);
    expect(e.zustand.wabe).toEqual(wabe);
    expect(e.zustand.punkte).toBe(0);
    expect(e.zustand.serie).toBe(0);
    expect(e.zustand.spezial).toBeNull();
    expect(e.zustand.seitNachschub).toBe(3);
  });

  it('der Regenbogen nimmt die Farbe, mit der die größte Gruppe entsteht, und bringt sie zum Platzen', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 3;
    wabe[0]![1] = 3;
    wabe[0]![3] = 4;
    wabe[0]![6] = 1; // die Farben im Rohr müssen es danach noch geben
    wabe[0]![7] = 2;
    const z = stand(wabe, { aktuell: 1, naechste: 2, spezial: 'regenbogen', bereit: true });
    const e = andocken(z, { spalte: 2, zeile: 0 });
    expect(e.art).toBe('regenbogen');
    expect(e.regenbogenFarbe).toBe(3);
    expect(e.geplatzt).toHaveLength(3);
    expect(e.zustand.punkte).toBe(3 * PUNKTE_JE_KUGEL);
    expect(e.zustand.spezial).toBeNull();
    expect(e.zustand.aktuell).toBe(1);
    expect(e.zustand.naechste).toBe(2);
  });

  it('regenbogenFarbe: größte Gruppe gewinnt, bei Gleichstand der kleinere Index, Felsen zählen nicht', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 3;
    wabe[0]![1] = 3;
    wabe[0]![3] = 4;
    expect(regenbogenFarbe(wabe, { spalte: 2, zeile: 0 }, 0)).toBe(3);

    const gleich = leereWabe();
    gleich[0]![1] = 2;
    gleich[0]![3] = 1;
    expect(regenbogenFarbe(gleich, { spalte: 2, zeile: 0 }, 4)).toBe(1);

    const nurFels = leereWabe();
    nurFels[0]![1] = STEIN;
    expect(regenbogenFarbe(nurFels, { spalte: 2, zeile: 0 }, 4)).toBe(4);
    expect(regenbogenFarbe(leereWabe(), { spalte: 2, zeile: 0 }, 2)).toBe(2);
  });
});

describe('Felsen', () => {
  it('bilden keine Gruppe, auch nicht zu dritt, und lassen Farbgruppen nicht durch sich hindurch', () => {
    const wabe = leereWabe();
    wabe[0]![0] = STEIN;
    wabe[0]![1] = STEIN;
    wabe[0]![2] = STEIN;
    expect(gruppeAb(wabe, { spalte: 1, zeile: 0 })).toEqual([]);
    wabe[0]![3] = 2;
    wabe[0]![4] = 2;
    expect(gruppeAb(wabe, { spalte: 3, zeile: 0 })).toHaveLength(2);
  });

  it('zählen nicht als Farbe — es kann nie ein Fels ins Rohr kommen', () => {
    const wabe = leereWabe();
    wabe[0]![0] = STEIN;
    wabe[0]![1] = 2;
    expect(vorhandeneFarben(wabe)).toEqual([2]);
    for (let saat = 1; saat <= 40; saat++) {
      const z = { ...neuesSpiel(saat), etappe: 5 };
      expect(z.aktuell).toBeLessThan(ANZAHL_FARBEN);
      expect(z.naechste).toBeLessThan(ANZAHL_FARBEN);
    }
  });

  it('fallen wie jede andere Kugel, wenn ihnen der Halt fehlt, und zählen dann als heruntergefallen', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    wabe[0]![7] = 3; // Ballast
    wabe[1]![1] = STEIN; // hängt nur an der Gruppe
    const e = andocken(stand(wabe, { aktuell: 2, naechste: 3 }), { spalte: 2, zeile: 0 });
    expect(e.gefallen).toEqual([{ spalte: 1, zeile: 1 }]);
    expect(e.zustand.punkte).toBe(3 * PUNKTE_JE_KUGEL + PUNKTE_JE_GEFALLEN);
  });

  it('etappenWabe: in der ersten Etappe keine, danach so viele wie angesagt — nie in Zeile 0, nie unter Zeile 4', () => {
    expect(etappenWabe(1, 5).wabe.flat().filter((f) => f === STEIN)).toHaveLength(0);
    for (let etappe = 2; etappe <= 12; etappe++) {
      for (let saat = 1; saat <= 15; saat++) {
        const { wabe } = etappenWabe(etappe, saat * 31);
        const felsen: Punkt[] = [];
        wabe.forEach((zeile, y) => zeile.forEach((f, x) => f === STEIN && felsen.push({ spalte: x, zeile: y })));
        expect(felsen, `Etappe ${etappe}, Saat ${saat}`).toHaveLength(felsenFuer(etappe));
        for (const p of felsen) {
          expect(p.zeile).toBeGreaterThanOrEqual(1);
          expect(p.zeile).toBeLessThanOrEqual(4);
        }
        // Gefüllt sind genau die Startzeilen, ganz.
        expect(wabe.slice(0, startZeilenFuer(etappe)).flat().every((f) => f !== null)).toBe(true);
        expect(wabe.slice(startZeilenFuer(etappe)).flat().every((f) => f === null)).toBe(true);
      }
    }
  });

  it('etappenWabe ist aus der Saat bestimmt', () => {
    expect(etappenWabe(4, 99)).toEqual(etappenWabe(4, 99));
    expect(etappenWabe(4, 99)).not.toEqual(etappenWabe(4, 100));
  });

  it('der Nachschub schiebt Felsen mit nach unten, ohne einen in die oberste Zeile zu setzen', () => {
    const wabe = volleDecke();
    wabe[1]![2] = STEIN;
    const nach = nachschubZeile(wabe, 11);
    expect(nach.wabe[2]![2]).toBe(STEIN);
    expect(nach.wabe[0]!.includes(STEIN)).toBe(false);
  });
});

describe('Etappen', () => {
  it('die Vorgaben werden mit jeder Etappe nie leichter', () => {
    const e = Array.from({ length: 15 }, (_, i) => i + 1);
    for (let i = 1; i < e.length; i++) {
      expect(nachschubIntervall(e[i]!)).toBeLessThanOrEqual(nachschubIntervall(e[i - 1]!));
      expect(startZeilenFuer(e[i]!)).toBeGreaterThanOrEqual(startZeilenFuer(e[i - 1]!));
      expect(felsenFuer(e[i]!)).toBeGreaterThanOrEqual(felsenFuer(e[i - 1]!));
    }
    expect(nachschubIntervall(1)).toBe(NACHSCHUB_NACH_SCHUESSEN);
    expect(startZeilenFuer(1)).toBe(START_ZEILEN);
    expect(felsenFuer(1)).toBe(0);
    // Gedeckelt: Es bleibt immer Anflug und Atem.
    expect(startZeilenFuer(99)).toBeLessThanOrEqual(7);
    expect(nachschubIntervall(99)).toBeGreaterThanOrEqual(4);
  });

  it('ein leeres Feld bringt die Prämie und die nächste Etappe, mit Felsen, und die Serie läuft weiter', () => {
    const wabe = leereWabe();
    wabe[0]![0] = 2;
    wabe[0]![1] = 2;
    const e = andocken(stand(wabe, { aktuell: 2, naechste: 3, seitNachschub: 5 }), { spalte: 2, zeile: 0 });
    expect(e.etappeGeschafft).toBe(true);
    expect(e.gewinn).toBe(3 * PUNKTE_JE_KUGEL + ETAPPEN_BONUS * 1);
    const z = e.zustand;
    expect(z.etappe).toBe(2);
    expect(z.punkte).toBe(e.gewinn);
    expect(z.seitNachschub).toBe(0);
    expect(z.serie).toBe(1);
    expect(tiefsteZeile(z.wabe)).toBe(startZeilenFuer(2) - 1);
    expect(z.wabe.flat().filter((f) => f === STEIN)).toHaveLength(felsenFuer(2));
    // Beide Kugeln im Rohr gibt es auch im neuen Feld.
    expect(vorhandeneFarben(z.wabe)).toContain(z.aktuell);
    expect(vorhandeneFarben(z.wabe)).toContain(z.naechste);
  });

  it('der Nachschub kommt in späteren Etappen früher', () => {
    const wabe = volleDecke();
    const z = stand(wabe, { etappe: 3, aktuell: 1, naechste: 1, seitNachschub: nachschubIntervall(3) - 1 });
    const e = andocken(z, { spalte: 3, zeile: 5 });
    expect(e.zustand.seitNachschub).toBe(0);
    expect(tiefsteZeile(e.zustand.wabe)).toBeGreaterThan(tiefsteZeile(z.wabe));
    // In der ersten Etappe wäre derselbe Zählerstand noch lange kein Nachschub.
    const früh = andocken({ ...z, etappe: 1 }, { spalte: 3, zeile: 5 });
    expect(früh.zustand.seitNachschub).toBe(nachschubIntervall(3));
  });

  it('wer einmal ein Feld geräumt hat, bleibt „gewonnen" — auch wenn danach Schluss ist', () => {
    const wabe = leereWabe();
    wabe[VERLUST_ZEILE]![0] = 1;
    const e = andocken(stand(wabe, { gewonnen: true, etappe: 3, aktuell: 3 }), { spalte: 4, zeile: 0 });
    expect(e.zustand.vorbei).toBe(true);
    expect(e.zustand.gewonnen).toBe(true);
  });
});

describe('gemischtes Spielen — die Grundregeln halten nach jedem Schuss', () => {
  it('über 40 Saaten mit Tauschen, Spezialkugeln und Etappenwechseln', () => {
    for (let saat = 1; saat <= 40; saat++) {
      let z = neuesSpiel(saat * 104729);
      let r = schritt(saat);
      let vorherPunkte = 0;
      for (let i = 0; i < 90 && !z.vorbei; i++) {
        const w = schritt(r.saat);
        const t = schritt(w.saat);
        const u = schritt(t.saat);
        r = u;
        if (t.wert < 0.3) z = tauschen(z);
        if (z.spezial !== null && u.wert < 0.4) z = spezialUmschalten(z);
        const winkel = SENKRECHT + (w.wert * 2 - 1) * MAX_ABWEICHUNG;
        const ziel = flugbahn(z.wabe, winkel).ziel;
        if (!ziel) continue;
        const e = andocken(z, ziel);
        if (e.zustand === z) continue;
        z = e.zustand;

        const wo = `Saat ${saat}, Schuss ${i}`;
        expect(z.punkte, wo).toBeGreaterThanOrEqual(vorherPunkte);
        vorherPunkte = z.punkte;
        expect(z.wabe, wo).toHaveLength(ZEILEN);
        expect(z.wabe.every((zeile) => zeile.length === SPALTEN), wo).toBe(true);
        expect(z.wabe[0]!.includes(STEIN), `${wo}: Fels in der obersten Zeile`).toBe(false);
        // Im Rohr liegt immer eine Farbe, nie ein Fels.
        expect(z.aktuell, wo).toBeGreaterThanOrEqual(0);
        expect(z.aktuell, wo).toBeLessThan(ANZAHL_FARBEN);
        expect(z.naechste, wo).toBeLessThan(ANZAHL_FARBEN);
        // Und es gibt sie im Feld, solange überhaupt Farben darin liegen.
        const farben = vorhandeneFarben(z.wabe);
        if (farben.length > 0) {
          expect(farben, `${wo}: Rohr`).toContain(z.aktuell);
          expect(farben, `${wo}: Vorschau`).toContain(z.naechste);
        }
        // Ende heißt: die Verlustzeile ist erreicht — und nur dann.
        expect(z.vorbei, wo).toBe(tiefsteZeile(z.wabe) >= VERLUST_ZEILE);
        // Die Spezialkugel liegt nur im Rohr, wenn man sie hat.
        if (z.bereit) expect(z.spezial, wo).not.toBeNull();
        expect(z.serie, wo).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(z.etappe), wo).toBe(true);
        expect(z.gewonnen, wo).toBe(z.etappe > 1);
      }
    }
  });
});
