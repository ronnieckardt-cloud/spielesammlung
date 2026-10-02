import { describe, expect, it } from 'vitest';
import {
  BREITE,
  EFFIZIENZ_PUNKTE,
  EFFIZIENZ_SPIELRAUM,
  GOLD_PUNKTE,
  HOEHE,
  START_ZEIT,
  STERN_PUNKTE,
  STRAFE_S,
  WELLEN_PUNKTE,
  besterZug,
  gesperrteFelder,
  gleitWeg,
  gleiten,
  kometenZiehen,
  loesung,
  naechsteWelle,
  neuesSpiel,
  welleErzeugen,
  wellenPlan,
  wellenZeit,
  zeitLaufen,
} from './logik';
import type { Komet, Punkt, Richtung, Stern, Zustand } from './logik';

/** Ein leeres Brett mit genau den Dingen, die ein Test braucht. */
function brett(teile: {
  spieler?: Punkt;
  felsen?: Punkt[];
  loecher?: Punkt[];
  sterne?: Stern[];
  kometen?: Komet[];
  par?: number;
  restZeit?: number;
  breite?: number;
  hoehe?: number;
}): Zustand {
  return {
    breite: teile.breite ?? 6,
    hoehe: teile.hoehe ?? 7,
    spieler: teile.spieler ?? { x: 0, y: 0 },
    felsen: teile.felsen ?? [],
    loecher: teile.loecher ?? [],
    sterne: teile.sterne ?? [],
    kometen: teile.kometen ?? [],
    welle: 1,
    par: teile.par ?? 1,
    zuege: 0,
    punkte: 0,
    restZeit: teile.restZeit ?? 30,
    welleGeschafft: false,
    vorbei: false,
    saat: 1,
  };
}
const stern = (x: number, y: number, gold = false): Stern => ({ x, y, gold });

describe('Gleiten', () => {
  it('gleitet bis zur Wand', () => {
    const g = gleiten(brett({ sterne: [stern(5, 5)] }), 'right');
    expect(g.zustand.spieler).toEqual({ x: 5, y: 0 });
    expect(g.weg).toHaveLength(5);
    expect(g.anprall).toBe('wand');
    expect(g.bewegt).toBe(true);
  });

  it('hält vor einem Felsen', () => {
    const g = gleiten(brett({ felsen: [{ x: 3, y: 0 }], sterne: [stern(5, 5)] }), 'right');
    expect(g.zustand.spieler).toEqual({ x: 2, y: 0 });
    expect(g.anprall).toBe('fels');
    expect(g.strafe).toBe(false);
  });

  it('schluckt alle Sterne auf dem Weg, auch den, auf dem es hält', () => {
    const z = brett({ sterne: [stern(2, 0), stern(4, 0), stern(5, 0), stern(0, 6)] });
    const g = gleiten(z, 'right');
    expect(g.gesammelt.map((s) => s.stern.x)).toEqual([2, 4, 5]);
    expect(g.gesammelt.map((s) => s.schritt)).toEqual([2, 4, 5]);
    expect(g.zustand.sterne).toEqual([stern(0, 6)]);
  });

  it('zählt mehrere Sterne in einem Zug mehr als einzelne: Wert mal Anzahl', () => {
    const drei = gleiten(brett({ sterne: [stern(1, 0), stern(2, 0), stern(3, 0), stern(0, 5)] }), 'right');
    expect(drei.kombo).toBe(3);
    expect(drei.sternPunkte).toBe(STERN_PUNKTE * 3 * 3);
    const einzeln = gleiten(brett({ sterne: [stern(1, 0), stern(0, 5)] }), 'right');
    expect(einzeln.sternPunkte).toBe(STERN_PUNKTE);
  });

  it('wertet einen Goldstern dreifach und zählt ihn doch nur einmal zur Kombo', () => {
    const g = gleiten(brett({ sterne: [stern(1, 0, true), stern(2, 0), stern(0, 5)] }), 'right');
    expect(g.kombo).toBe(2);
    expect(g.sternPunkte).toBe((GOLD_PUNKTE + STERN_PUNKTE) * 2);
  });

  it('ist ohne Bewegung kein Zug und kostet nichts', () => {
    const z = brett({ spieler: { x: 0, y: 0 }, sterne: [stern(3, 3)], kometen: [{ x: 3, y: 6, dx: 0, dy: -1 }] });
    const g = gleiten(z, 'left');
    expect(g.bewegt).toBe(false);
    expect(g.strafe).toBe(false);
    expect(g.zustand).toEqual(z);
  });

  it('lässt die Kometen warten, wenn man nur gegen eine Wand gewischt hat', () => {
    const z = brett({ sterne: [stern(3, 3)], kometen: [{ x: 3, y: 6, dx: 0, dy: -1 }] });
    expect(gleiten(z, 'up').zustand.kometen).toEqual(z.kometen);
  });

  it('lässt die Kometen ziehen, wenn man gegen einen Kometen oder ein Loch wischt — sonst gäbe es eine Sackgasse', () => {
    // Der Komet steht im Gang direkt vor dem Spieler, alle anderen Richtungen sind Wand oder Fels.
    const z = brett({
      spieler: { x: 0, y: 0 },
      felsen: [{ x: 0, y: 1 }],
      kometen: [{ x: 1, y: 0, dx: 1, dy: 0 }],
      sterne: [stern(5, 5)],
    });
    const g = gleiten(z, 'right');
    expect(g.bewegt).toBe(false);
    expect(g.strafe).toBe(true);
    // Der Komet ist einen Schritt weitergeflogen.
    expect(g.zustand.kometen[0]).toEqual({ x: 2, y: 0, dx: 1, dy: 0 });
  });

  it('bleibt vor einem Loch stehen und kostet Zeit', () => {
    const g = gleiten(brett({ loecher: [{ x: 3, y: 0 }], sterne: [stern(5, 5)] }), 'right');
    expect(g.zustand.spieler).toEqual({ x: 2, y: 0 });
    expect(g.anprall).toBe('loch');
    expect(g.strafe).toBe(true);
    expect(g.zustand.restZeit).toBe(30 - STRAFE_S);
  });

  it('kostet auch dann Zeit, wenn das Loch direkt vor einem liegt', () => {
    const g = gleiten(brett({ loecher: [{ x: 1, y: 0 }], sterne: [stern(5, 5)] }), 'right');
    expect(g.bewegt).toBe(false);
    expect(g.strafe).toBe(true);
    expect(g.zustand.restZeit).toBe(30 - STRAFE_S);
  });

  it('wird von einem Kometen im Weg gestoppt und bestraft', () => {
    const g = gleiten(brett({ kometen: [{ x: 4, y: 0, dx: 0, dy: 1 }], sterne: [stern(5, 5)] }), 'right');
    expect(g.zustand.spieler).toEqual({ x: 3, y: 0 });
    expect(g.anprall).toBe('komet');
    expect(g.strafe).toBe(true);
  });

  it('beendet die Runde, wenn eine Strafe die Zeit aufbraucht', () => {
    const g = gleiten(brett({ restZeit: 2, loecher: [{ x: 1, y: 0 }], sterne: [stern(5, 5)] }), 'right');
    expect(g.zustand.vorbei).toBe(true);
    expect(g.zustand.restZeit).toBe(0);
  });

  it('macht nach Ende der Runde nichts mehr', () => {
    const z = { ...brett({ sterne: [stern(5, 5)] }), vorbei: true };
    expect(gleiten(z, 'right').bewegt).toBe(false);
  });

  it('zählt Züge nur, wenn sich etwas bewegt', () => {
    const z = brett({ sterne: [stern(5, 5)] });
    expect(gleiten(z, 'up').zustand.zuege).toBe(0);
    expect(gleiten(z, 'right').zustand.zuege).toBe(1);
  });
});

describe('Welle geschafft', () => {
  it('zahlt Bonus samt Effizienz, gibt Zeit zurück und hält die Uhr an', () => {
    const z = brett({ sterne: [stern(5, 0)], par: 1, restZeit: 10 });
    const g = gleiten(z, 'right');
    expect(g.welleGeschafft).toBe(true);
    expect(g.welleBonus).toBe(WELLEN_PUNKTE + EFFIZIENZ_PUNKTE * EFFIZIENZ_SPIELRAUM);
    expect(g.zustand.restZeit).toBeCloseTo(10 + wellenZeit(1, 1), 9);
    expect(g.zustand.punkte).toBe(STERN_PUNKTE + g.welleBonus);
    expect(zeitLaufen(g.zustand, 5).restZeit).toBe(g.zustand.restZeit);
  });

  it('gibt weniger Effizienzpunkte für jeden Zug über der Bestmarke', () => {
    // Bestmarke 1, aber zwei Züge gebraucht: ein Zug Spielraum weniger.
    let z = brett({ sterne: [stern(5, 3)], par: 1 });
    z = gleiten(z, 'down').zustand; // (0,6) — kein Stern
    z = gleiten(z, 'right').zustand; // (5,6)
    const g = gleiten(z, 'up'); // bis (5,0) — schluckt (5,3)
    expect(g.welleGeschafft).toBe(true);
    expect(g.welleBonus).toBe(WELLEN_PUNKTE + EFFIZIENZ_PUNKTE * Math.max(0, 1 + EFFIZIENZ_SPIELRAUM - 3));
  });

  it('lässt nach dem letzten Stern die Kometen stehen und gibt keinen Treffer', () => {
    const z = brett({ sterne: [stern(5, 0)], kometen: [{ x: 5, y: 1, dx: 0, dy: -1 }] });
    const g = gleiten(z, 'right');
    expect(g.kometGetroffen).toBe(false);
    expect(g.zustand.kometen).toEqual(z.kometen);
  });

  it('sperrt weitere Züge, bis die nächste Welle da ist', () => {
    const g = gleiten(brett({ sterne: [stern(5, 0)] }), 'right').zustand;
    expect(gleiten(g, 'down').bewegt).toBe(false);
  });

  it('beginnt die nächste Welle dort, wo der Sternenschlucker steht', () => {
    const fertig = gleiten(brett({ sterne: [stern(5, 0)] }), 'right').zustand;
    const neu = naechsteWelle(fertig);
    expect(neu.welle).toBe(2);
    expect(neu.zuege).toBe(0);
    expect(neu.welleGeschafft).toBe(false);
    expect(neu.spieler).toEqual({ x: 5, y: 0 });
    expect(neu.sterne.length).toBeGreaterThan(0);
    expect(neu.punkte).toBe(fertig.punkte);
    expect(neu.restZeit).toBe(fertig.restZeit);
  });

  it('tut nichts, wenn die Welle noch läuft', () => {
    const z = neuesSpiel(5);
    expect(naechsteWelle(z)).toBe(z);
  });
});

describe('Zeit', () => {
  it('läuft ab und beendet die Runde bei null', () => {
    let z = neuesSpiel(3);
    expect(z.restZeit).toBe(START_ZEIT);
    z = zeitLaufen(z, 10);
    expect(z.restZeit).toBe(START_ZEIT - 10);
    z = zeitLaufen(z, 100);
    expect(z.restZeit).toBe(0);
    expect(z.vorbei).toBe(true);
  });

  it('läuft nach dem Ende nicht weiter', () => {
    const z = zeitLaufen(neuesSpiel(3), 100);
    expect(zeitLaufen(z, 5)).toBe(z);
  });
});

describe('Kometen', () => {
  const rahmen = { breite: 6, hoehe: 7, felsen: [], loecher: [] };

  it('machen einen Schritt in ihre Richtung', () => {
    const e = kometenZiehen(rahmen, [{ x: 2, y: 2, dx: 1, dy: 0 }], { x: 0, y: 6 });
    expect(e.kometen[0]).toEqual({ x: 3, y: 2, dx: 1, dy: 0 });
    expect(e.getroffen).toBe(false);
  });

  it('kehren am Rand um und bleiben dabei stehen', () => {
    const e = kometenZiehen(rahmen, [{ x: 5, y: 2, dx: 1, dy: 0 }], { x: 0, y: 6 });
    expect(e.kometen[0]).toEqual({ x: 5, y: 2, dx: -1, dy: 0 });
  });

  it('kehren an einem Felsen um', () => {
    const z = { ...rahmen, felsen: [{ x: 3, y: 2 }] };
    const e = kometenZiehen(z, [{ x: 2, y: 2, dx: 1, dy: 0 }], { x: 0, y: 6 });
    expect(e.kometen[0]).toEqual({ x: 2, y: 2, dx: -1, dy: 0 });
  });

  it('treffen den Spieler, ohne auf ihm zu landen, und kehren um', () => {
    const e = kometenZiehen(rahmen, [{ x: 2, y: 2, dx: 1, dy: 0 }], { x: 3, y: 2 });
    expect(e.getroffen).toBe(true);
    expect(e.kometen[0]).toEqual({ x: 2, y: 2, dx: -1, dy: 0 });
  });

  it('liegen nie aufeinander', () => {
    const e = kometenZiehen(
      rahmen,
      [
        { x: 1, y: 2, dx: 1, dy: 0 },
        { x: 2, y: 2, dx: -1, dy: 0 },
      ],
      { x: 0, y: 6 },
    );
    expect(e.kometen[0]).toEqual({ x: 1, y: 2, dx: -1, dy: 0 });
    expect(e.kometen[1]).toEqual({ x: 2, y: 2, dx: 1, dy: 0 });
  });

  it('bestraft einen Treffer nach dem Zug', () => {
    // Der Spieler gleitet nach (3,0); der Komet bei (3,1) fliegt nach oben und träfe das Feld.
    const z = brett({
      sterne: [stern(5, 5)],
      kometen: [{ x: 3, y: 1, dx: 0, dy: -1 }],
      spieler: { x: 0, y: 0 },
      felsen: [{ x: 4, y: 0 }],
    });
    const g = gleiten(z, 'right');
    expect(g.zustand.spieler).toEqual({ x: 3, y: 0 });
    expect(g.kometGetroffen).toBe(true);
    expect(g.zustand.restZeit).toBe(30 - STRAFE_S);
    expect(g.zustand.kometen[0]).toEqual({ x: 3, y: 1, dx: 0, dy: 1 });
  });
});

describe('Lösungssuche', () => {
  it('findet die kürzeste Folge', () => {
    // Zwei Sterne auf einer Linie: ein Zug.
    expect(loesung(6, 7, new Set(), { x: 0, y: 0 }, [{ x: 2, y: 0 }, { x: 4, y: 0 }])).toEqual(['right']);
  });

  it('meldet, wenn es keine Lösung gibt', () => {
    // Der Stern liegt hinter einem Fels in einer Ecke, die man nie ansteuern kann.
    const gesperrt = new Set([1, 6]); // (1,0) und (0,1) um (0,0)
    expect(loesung(6, 7, gesperrt, { x: 3, y: 3 }, [{ x: 0, y: 0 }])).toBeNull();
  });

  it('gleitet in der Suche genau wie im Spiel', () => {
    const z = neuesSpiel(11);
    const gesperrt = gesperrteFelder(z);
    for (const r of ['up', 'down', 'left', 'right'] as Richtung[]) {
      const weg = gleitWeg(z.breite, z.hoehe, gesperrt, z.spieler, r);
      const g = gleiten({ ...z, kometen: [], loecher: z.loecher }, r);
      // Mit Löchern als Sperre bewegt sich das Spiel genau um denselben Weg.
      expect(g.weg).toEqual(weg);
    }
  });
});

describe('Wellen', () => {
  const start = { x: 2, y: 3 };

  it('sind bei gleicher Saat gleich', () => {
    expect(welleErzeugen(42, 5, start)).toEqual(welleErzeugen(42, 5, start));
  });

  it('sind für jede Welle und viele Saaten lösbar, und die Bestmarke stimmt', () => {
    for (let nummer = 1; nummer <= 40; nummer++) {
      for (let saat = 1; saat <= 12; saat++) {
        const { welle } = welleErzeugen(saat * 7919 + nummer, nummer, start);
        const gesperrt = new Set([...welle.felsen, ...welle.loecher].map((p) => p.y * BREITE + p.x));
        const weg = loesung(BREITE, HOEHE, gesperrt, start, welle.sterne);
        expect(weg, `Welle ${nummer}, Saat ${saat}`).not.toBeNull();
        expect(weg!.length).toBe(welle.par);
      }
    }
  });

  it('halten die Bestmarke an der Sternzahl und sind nie auf einen Zug zu leicht', () => {
    for (let nummer = 1; nummer <= 40; nummer++) {
      for (let saat = 1; saat <= 12; saat++) {
        const { welle } = welleErzeugen(saat * 31 + nummer, nummer, start);
        expect(welle.par).toBeLessThanOrEqual(welle.sterne.length + (nummer <= 2 ? 0 : nummer <= 5 ? 1 : 2));
        if (welle.sterne.length >= 3) expect(welle.par).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('legen nichts übereinander und nichts auf den Spieler', () => {
    for (let nummer = 1; nummer <= 40; nummer++) {
      for (let saat = 1; saat <= 8; saat++) {
        const { welle } = welleErzeugen(saat * 977 + nummer, nummer, start);
        const felder = [...welle.felsen, ...welle.loecher, ...welle.sterne];
        const ids = felder.map((p) => p.y * BREITE + p.x);
        expect(new Set(ids).size, `Welle ${nummer}`).toBe(ids.length);
        expect(ids).not.toContain(start.y * BREITE + start.x);
        // Kometen starten auf freier Fläche, nicht auf Hindernissen, Sternen oder dem Spieler.
        for (const k of welle.kometen) {
          expect(ids).not.toContain(k.y * BREITE + k.x);
          expect(k.x === start.x && k.y === start.y).toBe(false);
        }
        for (const p of felder) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThan(BREITE);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThan(HOEHE);
        }
      }
    }
  });

  it('wachsen nach Plan', () => {
    expect(wellenPlan(1)).toEqual({ felsen: 4, loecher: 0, kometen: 0, sterne: 3, gold: 0 });
    expect(wellenPlan(3).loecher).toBe(1);
    expect(wellenPlan(3).gold).toBe(1);
    expect(wellenPlan(5).kometen).toBe(1);
    const spaet = wellenPlan(500);
    expect(spaet.felsen).toBeLessThanOrEqual(11);
    expect(spaet.loecher).toBeLessThanOrEqual(3);
    expect(spaet.kometen).toBeLessThanOrEqual(2);
    expect(spaet.sterne).toBeLessThanOrEqual(7);
  });

  it('enthalten, wo es der Plan sagt, Löcher, Kometen und genau einen Goldstern', () => {
    const { welle } = welleErzeugen(9, 8, start);
    const plan = wellenPlan(8);
    expect(welle.felsen).toHaveLength(plan.felsen);
    expect(welle.loecher).toHaveLength(plan.loecher);
    expect(welle.sterne).toHaveLength(plan.sterne);
    expect(welle.sterne.filter((s) => s.gold)).toHaveLength(plan.gold);
    expect(welle.kometen.length).toBeGreaterThan(0);
  });

  it('lassen sich mit der Lösung wirklich leerräumen, mit der Bestmarke als Zugzahl', () => {
    for (let nummer = 1; nummer <= 20; nummer++) {
      const start0 = neuesSpiel(nummer * 13);
      let z = naechsteWelleBis(start0, nummer);
      z = { ...z, kometen: [] };
      const zuege = loesung(z.breite, z.hoehe, gesperrteFelder(z), z.spieler, z.sterne)!;
      expect(zuege.length).toBe(z.par);
      let ende = z;
      for (const r of zuege) ende = gleiten(ende, r).zustand;
      expect(ende.welleGeschafft, `Welle ${nummer}`).toBe(true);
      expect(ende.zuege).toBe(z.par);
    }
  });
});

/** Spielt mit der besten Lösung, bis die gewünschte Welle erreicht ist. Kometen stören dabei nicht. */
function naechsteWelleBis(z: Zustand, ziel: number): Zustand {
  let aktuell = z;
  while (aktuell.welle < ziel) {
    aktuell = { ...aktuell, kometen: [], restZeit: 1000 };
    let r = besterZug(aktuell);
    while (r) {
      aktuell = gleiten(aktuell, r).zustand;
      if (aktuell.welleGeschafft) break;
      r = besterZug(aktuell);
    }
    aktuell = naechsteWelle(aktuell);
  }
  return aktuell;
}

describe('Zeitwirtschaft', () => {
  /**
   * Ein Spieler, der immer den besten Zug kennt und je Zug `denkzeit` Sekunden braucht.
   * Beweist, dass das Spiel in der richtigen Größenordnung bilanziert: Wer flott ist, kommt weit,
   * wer sehr lange grübelt, verliert Zeit und scheidet früh aus.
   */
  function spiele(denkzeit: number, maxZuege = 600): Zustand {
    let z = neuesSpiel(4);
    for (let i = 0; i < maxZuege && !z.vorbei; i++) {
      if (z.welleGeschafft) {
        z = naechsteWelle(z);
        continue;
      }
      z = zeitLaufen(z, denkzeit);
      if (z.vorbei) break;
      // Der Spieler plant mit den Kometen als Hindernissen und fällt sonst auf die reine Lösung zurück.
      const mitKometen = new Set([...gesperrteFelder(z), ...z.kometen.map((k) => k.y * z.breite + k.x)]);
      const weg = loesung(z.breite, z.hoehe, mitKometen, z.spieler, z.sterne) ?? loesung(z.breite, z.hoehe, gesperrteFelder(z), z.spieler, z.sterne);
      let r: Richtung = weg && weg.length > 0 ? weg[0]! : 'up';
      // Wer gegen etwas gewischt hat, ohne sich zu bewegen, versucht nicht dasselbe noch einmal.
      if (!gleiten(z, r).bewegt) {
        const anders = (['up', 'down', 'left', 'right'] as Richtung[]).find((d) => gleiten(z, d).bewegt);
        if (anders) r = anders;
      }
      z = gleiten(z, r).zustand;
    }
    return z;
  }

  it('lässt einen flotten Spieler weit kommen', () => {
    expect(spiele(1.0).welle).toBeGreaterThanOrEqual(10);
  });

  it('wird auf Dauer auch für einen schnellen Spieler knapp: Der Zeitbonus schrumpft', () => {
    expect(wellenZeit(6, 1)).toBeGreaterThan(wellenZeit(6, 20));
    expect(wellenZeit(6, 20)).toBeGreaterThan(wellenZeit(6, 100));
    // Nie unter der Hälfte, sonst wäre späte Spielzeit reiner Zufall.
    expect(wellenZeit(6, 1000)).toBeCloseTo(wellenZeit(6, 1) / 2, 9);
  });

  it('lässt einen sehr langsamen Spieler früh scheitern', () => {
    expect(spiele(5).welle).toBeLessThan(8);
  });

  it('belohnt Tempo: Je schneller, desto weiter', () => {
    expect(spiele(0.8).welle).toBeGreaterThanOrEqual(spiele(2.0).welle);
  });
});

describe('Zufälliges Spiel', () => {
  it('hält seine Regeln über viele Züge ein', () => {
    const richtungen: Richtung[] = ['up', 'down', 'left', 'right'];
    for (let saat = 1; saat <= 40; saat++) {
      let z = neuesSpiel(saat);
      z = { ...z, restZeit: 10000 };
      let w = saat * 2654435761;
      for (let i = 0; i < 150; i++) {
        w = (Math.imul(w, 1664525) + 1013904223) >>> 0;
        if (z.welleGeschafft) {
          z = naechsteWelle(z);
        } else {
          z = gleiten(z, richtungen[w % 4]!).zustand;
        }
        const gesperrt = new Set([...z.felsen, ...z.loecher].map((p) => p.y * z.breite + p.x));
        const spieler = z.spieler.y * z.breite + z.spieler.x;
        expect(gesperrt.has(spieler), `Saat ${saat}, Zug ${i}`).toBe(false);
        expect(z.spieler.x).toBeGreaterThanOrEqual(0);
        expect(z.spieler.x).toBeLessThan(z.breite);
        expect(z.spieler.y).toBeGreaterThanOrEqual(0);
        expect(z.spieler.y).toBeLessThan(z.hoehe);
        for (const k of z.kometen) {
          const id = k.y * z.breite + k.x;
          expect(gesperrt.has(id)).toBe(false);
          expect(id).not.toBe(spieler);
        }
        const kIds = z.kometen.map((k) => k.y * z.breite + k.x);
        expect(new Set(kIds).size).toBe(kIds.length);
        expect(Number.isFinite(z.punkte)).toBe(true);
      }
    }
  });
});
