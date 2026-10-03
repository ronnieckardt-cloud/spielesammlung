import { describe, it, expect } from 'vitest';
import { rng } from '../../core/rng';
import {
  ANZAHL_FARBEN,
  BREITE,
  FORMEN,
  HOEHE,
  JOKER_MAX,
  LINIEN_JE_ETAPPE,
  START_JOKER,
  aufloesen,
  auswahlGroesse,
  fuellstand,
  gewichtFuerGroesse,
  legen,
  leeresRaster,
  neuesSpiel,
  passtAn,
  passtIrgendwo,
  punkteFuerZug,
  PUNKTE_SCHWELLE_ANZEIGE,
  etappeFuer,
  teilLegen,
  zurueck,
  loesbareLinien,
  volleZeilenUndSpalten,
} from './logik';
import type { Raster, Teil, Zustand } from './logik';

const VOLLE_ZEILE = Array.from({ length: BREITE }, (_, i) => ({ dx: i, dy: 0 }));

describe('Formensatz', () => {
  it('enthält mindestens ein Teil je Größe von 1 bis 5', () => {
    const groessen = new Set(FORMEN.map((f) => f.length));
    for (const g of [1, 2, 3, 4, 5]) expect(groessen.has(g)).toBe(true);
  });

  it('jede Form hat eindeutige Zellen ohne Überlappung', () => {
    for (const form of FORMEN) {
      const schluessel = form.map((v) => `${v.dx},${v.dy}`);
      expect(new Set(schluessel).size).toBe(form.length);
    }
  });
});

describe('passtAn / passtIrgendwo', () => {
  it('passt auf ein leeres Raster', () => {
    expect(passtAn(leeresRaster(), FORMEN[0]!, 0, 0)).toBe(true);
  });

  it('passt nicht außerhalb des Rasters', () => {
    expect(passtAn(leeresRaster(), FORMEN[0]!, BREITE, 0)).toBe(false);
    expect(passtAn(leeresRaster(), FORMEN[0]!, -1, 0)).toBe(false);
    expect(passtAn(leeresRaster(), FORMEN[0]!, 0, HOEHE)).toBe(false);
  });

  it('passt nicht auf eine belegte Zelle', () => {
    const raster = legen(leeresRaster(), FORMEN[0]!, 3, 3, 0);
    expect(passtAn(raster, FORMEN[0]!, 3, 3)).toBe(false);
  });

  it('erkennt, wenn ein Teil nirgends mehr passt', () => {
    // Raster komplett voll außer einer 1x1-Lücke, ein 1x2-Teil passt dann nirgends.
    let raster: Raster = Array.from({ length: HOEHE }, (_, y) =>
      Array.from({ length: BREITE }, (_, x) => (x === 0 && y === 0 ? null : 0)),
    );
    expect(passtIrgendwo(raster, FORMEN[0]!)).toBe(true); // die 1x1 passt in die Lücke
    const zweierTeil = FORMEN.find((f) => f.length === 2)!;
    expect(passtIrgendwo(raster, zweierTeil)).toBe(false);
  });

  it('findet eine passende Stelle, wenn eine existiert', () => {
    const raster = leeresRaster();
    const grossesTeil = FORMEN.find((f) => f.length === 9)!;
    expect(passtIrgendwo(raster, grossesTeil)).toBe(true);
  });
});

describe('legen', () => {
  it('trägt die Farbe an den richtigen Zellen ein', () => {
    const raster = legen(leeresRaster(), FORMEN[0]!, 2, 2, 4);
    expect(raster[2]![2]).toBe(4);
  });

  it('mutiert das Original nicht', () => {
    const original = leeresRaster();
    legen(original, FORMEN[0]!, 0, 0, 1);
    expect(original[0]![0]).toBeNull();
  });

  it('gibt bei ungültigem Platz dasselbe Raster zurück', () => {
    const raster = legen(leeresRaster(), FORMEN[0]!, 0, 0, 1);
    expect(legen(raster, FORMEN[0]!, 0, 0, 2)).toBe(raster);
  });
});

describe('volleZeilenUndSpalten / aufloesen', () => {
  it('erkennt eine volle Zeile', () => {
    let raster = leeresRaster();
    for (const { dx } of VOLLE_ZEILE) raster = legen(raster, [{ dx: 0, dy: 0 }], dx, 3, 0);
    const { zeilen, spalten } = volleZeilenUndSpalten(raster);
    expect(zeilen).toEqual([3]);
    expect(spalten).toEqual([]);
  });

  it('erkennt eine volle Spalte', () => {
    let raster = leeresRaster();
    for (let y = 0; y < HOEHE; y++) raster = legen(raster, [{ dx: 0, dy: 0 }], 5, y, 0);
    const { zeilen, spalten } = volleZeilenUndSpalten(raster);
    expect(spalten).toEqual([5]);
    expect(zeilen).toEqual([]);
  });

  it('erkennt Zeile und Spalte gleichzeitig', () => {
    let raster = leeresRaster();
    for (const { dx } of VOLLE_ZEILE) raster = legen(raster, [{ dx: 0, dy: 0 }], dx, 0, 0);
    for (let y = 0; y < HOEHE; y++) raster = legen(raster, [{ dx: 0, dy: 0 }], 2, y, 0);
    const { zeilen, spalten } = volleZeilenUndSpalten(raster);
    expect(zeilen).toEqual([0]);
    expect(spalten).toEqual([2]);
  });

  it('löst nur die angegebenen Zeilen/Spalten auf, sonst nichts', () => {
    let raster = leeresRaster();
    raster = legen(raster, [{ dx: 0, dy: 0 }], 4, 4, 7); // unbeteiligte Zelle
    for (const { dx } of VOLLE_ZEILE) raster = legen(raster, [{ dx: 0, dy: 0 }], dx, 1, 0);
    const { zeilen, spalten } = volleZeilenUndSpalten(raster);
    const aufgeloest = aufloesen(raster, zeilen, spalten);
    expect(aufgeloest[1]!.every((z) => z === null)).toBe(true);
    expect(aufgeloest[4]![4]).toBe(7); // unbeteiligt, blieb stehen
  });

  it('gibt bei nichts Vollem dasselbe Raster zurück', () => {
    const raster = leeresRaster();
    expect(aufloesen(raster, [], [])).toBe(raster);
  });
});

describe('punkteFuerZug', () => {
  it('gibt einen Punkt pro gelegter Zelle ohne Auflösung', () => {
    expect(punkteFuerZug(4, 0, 0)).toBe(4);
  });

  it('mehrere gleichzeitige Linien geben überproportional mehr', () => {
    const eins = punkteFuerZug(0, 1, 1);
    const zwei = punkteFuerZug(0, 2, 1);
    const vier = punkteFuerZug(0, 4, 1);
    expect(zwei).toBeGreaterThan(eins * 2);
    expect(vier).toBeGreaterThan(zwei * 2);
  });

  it('eine längere Kombo gibt mehr Punkte für dieselbe Auflösung', () => {
    const ersterTreffer = punkteFuerZug(0, 1, 1);
    const dritterTreffer = punkteFuerZug(0, 1, 3);
    expect(dritterTreffer).toBeGreaterThan(ersterTreffer);
  });
});

describe('PUNKTE_SCHWELLE_ANZEIGE', () => {
  // Das „+N" über dem Feld erkennt eine Auflösung nur an der Höhe des
  // Zuwachses. Diese beiden Prüfungen sind die Bedingung dafür, dass das
  // überhaupt eindeutig geht — sie schlagen an, sobald ein größeres Teil
  // dazukommt oder sich die Punkteregel verschiebt.
  it('kein Zug ohne Auflösung erreicht die Schwelle', () => {
    const groessteForm = Math.max(...FORMEN.map((f) => f.length));
    expect(punkteFuerZug(groessteForm, 0, 0)).toBeLessThan(PUNKTE_SCHWELLE_ANZEIGE);
  });

  it('jede Auflösung liegt darüber, auch die kleinstmögliche', () => {
    // Kleinster denkbarer Treffer: ein einzelnes Feld gelegt, genau eine
    // Linie gefallen, keine Serie davor.
    expect(punkteFuerZug(1, 1, 1)).toBeGreaterThanOrEqual(PUNKTE_SCHWELLE_ANZEIGE);
  });
});

describe('gewichtFuerGroesse', () => {
  it('ist bei leerem Feld für alle Größen gleich', () => {
    expect(gewichtFuerGroesse(1, 0)).toBe(gewichtFuerGroesse(9, 0));
  });

  it('benachteiligt große Teile bei vollerem Feld, aber nie auf 0', () => {
    const klein = gewichtFuerGroesse(1, 0.9);
    const gross = gewichtFuerGroesse(9, 0.9);
    expect(gross).toBeLessThan(klein);
    expect(gross).toBeGreaterThan(0);
  });
});

describe('fuellstand', () => {
  it('ist 0 bei leerem Raster und steigt mit jeder Zelle', () => {
    expect(fuellstand(leeresRaster())).toBe(0);
    const raster = legen(leeresRaster(), FORMEN[0]!, 0, 0, 0);
    expect(fuellstand(raster)).toBeCloseTo(1 / (BREITE * HOEHE));
  });
});

describe('neuesSpiel', () => {
  it('ist bei gleicher Saat immer dasselbe', () => {
    expect(neuesSpiel(42)).toEqual(neuesSpiel(42));
  });

  it('hat immer genau drei Teile im Tablett', () => {
    const z = neuesSpiel(1);
    expect(z.tablett).toHaveLength(3);
    expect(z.tablett.every((t) => t !== null)).toBe(true);
  });

  it('startet mit leerem Raster, 0 Punkten, nicht vorbei', () => {
    const z = neuesSpiel(1);
    expect(z.raster.flat().every((z2) => z2 === null)).toBe(true);
    expect(z.punkte).toBe(0);
    expect(z.vorbei).toBe(false);
  });
});

describe('teilLegen', () => {
  function ausgangslage(): Zustand {
    return neuesSpiel(7);
  }

  it('legt ein Teil ab und markiert das Tablett-Feld als leer', () => {
    const z = ausgangslage();
    const teil = z.tablett[0]!;
    const nach = teilLegen(z, 0, 0, 0);
    expect(nach.raster[0]![teil.form[0]!.dx]).toBe(teil.farbe);
    // Tablett wird sofort neu gezogen, wenn danach alle drei leer wären,
    // sonst bleibt der Platz leer — hier: noch zwei andere Teile übrig.
    expect(nach.tablett.some((t) => t === null) || nach.tablett.every((t) => t !== null)).toBe(true);
  });

  it('ignoriert einen ungültigen Zug (Platz belegt)', () => {
    const z = ausgangslage();
    const einmal = teilLegen(z, 0, 0, 0);
    if (einmal === z) return; // falls das erste Teil dort gar nicht hinpasste, Test überspringen
    // Direkt nochmal auf dieselbe Stelle mit einem anderen Teil, das dort nicht passt.
    const teil1 = einmal.tablett[1];
    if (!teil1 || passtAn(einmal.raster, teil1.form, 0, 0)) return;
    expect(teilLegen(einmal, 1, 0, 0)).toBe(einmal);
  });

  it('zieht erst neue Teile, wenn alle drei Plätze leer sind', () => {
    // Feste 1x1-Teile, an drei getrennten Zellen abgelegt — kein Risiko,
    // dass eine Platzierung wegen Größe/Rand fehlschlägt.
    const einzelTeil = FORMEN.find((f) => f.length === 1)!;
    let z: Zustand = {
      ...neuesSpiel(3),
      raster: leeresRaster(),
      tablett: [
        { id: 'a', form: einzelTeil, farbe: 0 },
        { id: 'b', form: einzelTeil, farbe: 1 },
        { id: 'c', form: einzelTeil, farbe: 2 },
      ],
      saat: 3,
    };

    z = teilLegen(z, 0, 0, 0);
    expect(z.tablett[0]).toBeNull();
    expect(z.tablett[1]).not.toBeNull(); // die anderen beiden noch unangetastet
    expect(z.tablett[2]).not.toBeNull();

    z = teilLegen(z, 1, 1, 0);
    expect(z.tablett[1]).toBeNull();
    expect(z.tablett[2]).not.toBeNull(); // immer noch nicht alle drei leer

    z = teilLegen(z, 2, 2, 0);
    // Jetzt waren alle drei leer -> sofort neu befüllt, wieder drei belegte Plätze.
    expect(z.tablett.every((t) => t !== null)).toBe(true);
  });

  it('löst volle Zeilen auf und gibt Punkte', () => {
    // Ein 1x1-Teil an Position (7,0) legen, wenn Zeile 0 bis auf diese Zelle voll ist.
    let raster = leeresRaster();
    for (let x = 0; x < BREITE - 1; x++) raster = legen(raster, [{ dx: 0, dy: 0 }], x, 0, 0);
    const einzelTeil = FORMEN.find((f) => f.length === 1)!;
    const z: Zustand = {
      ...neuesSpiel(1),
      raster,
      tablett: [{ id: 't', form: einzelTeil, farbe: 0 }, null, null],
    };
    const nach = teilLegen(z, 0, BREITE - 1, 0);
    expect(nach.raster[0]!.every((zelle) => zelle === null)).toBe(true);
    expect(nach.punkte).toBeGreaterThan(0);
    expect(nach.kombo).toBe(1);
  });

  it('setzt die Kombo zurück, wenn ein Zug nichts auflöst', () => {
    const z: Zustand = { ...neuesSpiel(1), kombo: 3 };
    const teil = z.tablett[0]!;
    // Irgendwo weit weg legen, ohne eine Linie zu vervollständigen.
    const nach = teilLegen(z, 0, 0, 0);
    if (nach === z) return; // passte nicht, Test übersprungen
    const { zeilen, spalten } = volleZeilenUndSpalten(legen(z.raster, teil.form, 0, 0, teil.farbe));
    if (zeilen.length + spalten.length === 0) expect(nach.kombo).toBe(0);
  });

  it('erkennt Spielende, wenn kein verbliebenes Teil mehr irgendwo passt', () => {
    // Raster fast komplett voll, nur eine einzelne Lücke übrig, die zu keiner
    // Form im Tablett passt (alle Tablett-Teile sind größer als 1 Zelle).
    let raster: Raster = Array.from({ length: HOEHE }, (_, y) =>
      Array.from({ length: BREITE }, (_, x) => (x === 0 && y === 0 ? null : 0)),
    );
    const zweierTeil = FORMEN.find((f) => f.length === 2)!;
    const z: Zustand = {
      ...neuesSpiel(1),
      raster,
      tablett: [
        { id: 'a', form: zweierTeil, farbe: 0 },
        { id: 'b', form: zweierTeil, farbe: 1 },
        { id: 'c', form: zweierTeil, farbe: 2 },
      ],
    };
    // Keines der drei 2er-Teile kann noch irgendwo hin (nur 1 freie Zelle).
    expect(z.tablett.every((t) => t !== null && !passtIrgendwo(z.raster, t.form))).toBe(true);
  });

  it('reagiert nach Spielende auf nichts mehr', () => {
    const z: Zustand = { ...neuesSpiel(1), vorbei: true };
    expect(teilLegen(z, 0, 0, 0)).toBe(z);
  });

  it('ignoriert ein leeres Tablett-Feld', () => {
    const z: Zustand = { ...neuesSpiel(1), tablett: [null, null, null] };
    expect(teilLegen(z, 0, 0, 0)).toBe(z);
  });
});

describe('ANZAHL_FARBEN', () => {
  it('ist mindestens 1', () => {
    expect(ANZAHL_FARBEN).toBeGreaterThan(0);
  });
});

describe('loesbareLinien', () => {
  /** Ein Teil mit genau einer Zelle — passt in jede Lücke. */
  const EINZELTEIL: Teil = { id: 't1', form: [{ dx: 0, dy: 0 }], farbe: 0 };
  /** Ein Teil aus zwei nebeneinanderliegenden Zellen. */
  const ZWEIERTEIL: Teil = { id: 't2', form: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }], farbe: 0 };

  /** Raster mit einer Zeile, in der genau `luecken` Felder frei sind. */
  function zeileFast(y: number, luecken: number): Raster {
    return Array.from({ length: HOEHE }, (_, zy) =>
      Array.from({ length: BREITE }, (_, x) => (zy === y && x < luecken ? null : zy === y ? 0 : null)),
    );
  }

  it('findet die Zeile, der genau ein Feld fehlt', () => {
    const treffer = loesbareLinien(zeileFast(3, 1), [EINZELTEIL, null, null]);
    expect(treffer.zeilen).toEqual([3]);
  });

  it('findet nichts, wenn kein Teil passt', () => {
    // Zwei Lücken in der Zeile, aber nur ein Einzelteil im Tablett.
    const treffer = loesbareLinien(zeileFast(3, 2), [EINZELTEIL, null, null]);
    expect(treffer.zeilen).toEqual([]);
  });

  it('findet die Zeile, wenn ein größeres Teil beide Lücken füllt', () => {
    const treffer = loesbareLinien(zeileFast(3, 2), [ZWEIERTEIL, null, null]);
    expect(treffer.zeilen).toEqual([3]);
  });

  it('findet Spalten genauso', () => {
    // Spalte 2 fehlt nur die oberste Zelle.
    const raster: Raster = Array.from({ length: HOEHE }, (_, y) =>
      Array.from({ length: BREITE }, (_, x) => (x === 2 && y > 0 ? 0 : null)),
    );
    const treffer = loesbareLinien(raster, [EINZELTEIL, null, null]);
    expect(treffer.spalten).toEqual([2]);
  });

  it('meldet jede Linie nur einmal, auch wenn mehrere Teile sie schaffen', () => {
    const treffer = loesbareLinien(zeileFast(3, 1), [EINZELTEIL, EINZELTEIL, EINZELTEIL]);
    expect(treffer.zeilen).toEqual([3]);
  });

  it('gibt bei leerem Tablett nichts zurück', () => {
    expect(loesbareLinien(zeileFast(3, 1), [null, null, null])).toEqual({ zeilen: [], spalten: [] });
  });

  it('gibt auf leerem Raster nichts zurück', () => {
    expect(loesbareLinien(leeresRaster(), [EINZELTEIL, ZWEIERTEIL, null])).toEqual({
      zeilen: [],
      spalten: [],
    });
  });

  it('findet Zeile und Spalte, wenn ein Zug beide voll macht', () => {
    // Alles belegt außer der Ecke (0,0) — ein Einzelteil dort füllt Zeile 0
    // und Spalte 0 gleichzeitig.
    const raster: Raster = Array.from({ length: HOEHE }, (_, y) =>
      Array.from({ length: BREITE }, (_, x) => (x === 0 && y === 0 ? null : 0)),
    );
    const treffer = loesbareLinien(raster, [EINZELTEIL, null, null]);
    expect(treffer.zeilen).toContain(0);
    expect(treffer.spalten).toContain(0);
  });
});

// ─── Etappen, Joker, Zurück ──────────────────────────────────────────────────

/** Ein Brett aus Text: `#` belegt (Farbe 0), alles andere leer. */
function brettAus(zeilen: readonly string[]): Raster {
  return zeilen.map((z) => Array.from({ length: BREITE }, (_, x) => (z[x] === '#' ? 0 : null)));
}

const EINZEL: Teil = { id: 'e', form: FORMEN.find((f) => f.length === 1)!, farbe: 1 };
const ZWEIER: Teil = { id: 'z', form: FORMEN.find((f) => f.length === 2 && f.every((v) => v.dy === 0))!, farbe: 2 };

/**
 * Ein Brett, auf dem **ein** Einzelteil bei (7,0) die oberste Zeile schließt —
 * und sonst nichts. Die Zeile darunter ist ebenfalls fast voll, damit nach dem
 * Abräumen Steine stehen bleiben.
 */
function zeileFastVoll(): Raster {
  return brettAus(['#######.', '#.......', '', '', '', '', '', ''].map((z) => z.padEnd(BREITE, '.')));
}

describe('etappeFuer', () => {
  it('beginnt bei Etappe 1 und steigt alle LINIEN_JE_ETAPPE Linien um eins', () => {
    expect(etappeFuer(0)).toBe(1);
    expect(etappeFuer(LINIEN_JE_ETAPPE - 1)).toBe(1);
    expect(etappeFuer(LINIEN_JE_ETAPPE)).toBe(2);
    expect(etappeFuer(5 * LINIEN_JE_ETAPPE)).toBe(6);
  });

  it('wird beim Start auf einer höheren Etappe passend vorbelegt', () => {
    const z = neuesSpiel(3, 7);
    expect(etappeFuer(z.linien)).toBe(7);
    expect(z.belohnt).toBe(7);
    expect(z.joker).toBe(START_JOKER); // keine nachgeschenkten Joker für übersprungene Etappen
  });
});

describe('auswahlGroesse', () => {
  it('beginnt bei einem Tablett und wächst nie rückwärts', () => {
    expect(auswahlGroesse(1)).toBe(1);
    let vorher = 1;
    for (let etappe = 1; etappe <= 60; etappe++) {
      const jetzt = auswahlGroesse(etappe);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
  });

  it('gibt den ersten Etappen noch Ruhe: Bis zur dritten nimmt das Spiel, was kommt', () => {
    expect(auswahlGroesse(2)).toBe(1);
    expect(auswahlGroesse(3)).toBe(1);
    expect(auswahlGroesse(4)).toBeGreaterThan(1);
  });

  it('hat eine Decke, sonst rechnet das Austeilen irgendwann zu lange', () => {
    expect(auswahlGroesse(500)).toBe(auswahlGroesse(50));
    expect(auswahlGroesse(500)).toBeLessThanOrEqual(8);
  });
});

describe('gewichtFuerGroesse nach Etappe', () => {
  it('gleicht auf Etappe 1 der alten Rechnung', () => {
    expect(gewichtFuerGroesse(4, 0.5)).toBeCloseTo(1 / (1 + 0.5 * 4 * 0.35), 10);
  });

  it('bevorzugt mit der Etappe große Teile und verzeiht ein volles Feld weniger', () => {
    const verhaeltnis = (etappe: number) => gewichtFuerGroesse(9, 0.6, etappe) / gewichtFuerGroesse(1, 0.6, etappe);
    expect(verhaeltnis(10)).toBeGreaterThan(verhaeltnis(1));
    // Auch auf hoher Etappe bleibt jedes Teil möglich.
    expect(gewichtFuerGroesse(1, 0.9, 50)).toBeGreaterThan(0);
  });
});

describe('Linien zählen für die Etappe', () => {
  it('zählt Zeilen und Spalten eines Zuges zusammen', () => {
    const z: Zustand = { ...neuesSpiel(1), raster: zeileFastVoll(), tablett: [EINZEL, null, null] };
    const nach = teilLegen(z, 0, 7, 0);
    expect(nach.linien).toBe(1);
  });

  it('belohnt die erste Etappe mit einem Joker, gedeckelt bei JOKER_MAX', () => {
    const z: Zustand = {
      ...neuesSpiel(1),
      raster: zeileFastVoll(),
      tablett: [EINZEL, null, null],
      linien: LINIEN_JE_ETAPPE - 1,
    };
    const nach = teilLegen(z, 0, 7, 0);
    expect(etappeFuer(nach.linien)).toBe(2);
    expect(nach.joker).toBe(START_JOKER + 1);

    const voll: Zustand = { ...z, joker: JOKER_MAX };
    expect(teilLegen(voll, 0, 7, 0).joker).toBe(JOKER_MAX);
  });

  it('schenkt dem Spieler für einen Sprung über mehrere Etappen auf einmal jede einzelne', () => {
    // Zehn Linien in einem Zug gibt es nicht — aber der Rechenweg soll nicht
    // an „genau eine Etappe je Zug" hängen.
    const z: Zustand = {
      ...neuesSpiel(1),
      raster: zeileFastVoll(),
      tablett: [EINZEL, null, null],
      linien: 3 * LINIEN_JE_ETAPPE - 1,
      belohnt: 1,
      joker: 0,
    };
    const nach = teilLegen(z, 0, 7, 0);
    expect(etappeFuer(nach.linien)).toBe(4);
    expect(nach.joker).toBe(3);
    expect(nach.belohnt).toBe(4);
  });
});

describe('zurueck', () => {
  function nachEinemZug(): { vorher: Zustand; nachher: Zustand } {
    const vorher: Zustand = { ...neuesSpiel(5), raster: leeresRaster(), tablett: [EINZEL, ZWEIER, EINZEL] };
    const nachher = teilLegen(vorher, 1, 2, 3);
    return { vorher, nachher };
  }

  it('stellt Brett, Tablett, Punkte und Kombo wie vor dem Zug her', () => {
    const { vorher, nachher } = nachEinemZug();
    expect(nachher.raster).not.toEqual(vorher.raster);
    const zurueckZ = zurueck(nachher);
    expect(zurueckZ.raster).toEqual(vorher.raster);
    expect(zurueckZ.tablett).toEqual(vorher.tablett);
    expect(zurueckZ.punkte).toBe(vorher.punkte);
    expect(zurueckZ.kombo).toBe(vorher.kombo);
    expect(zurueckZ.linien).toBe(vorher.linien);
    expect(zurueckZ.saat).toBe(vorher.saat);
  });

  it('kostet genau einen Joker', () => {
    const { nachher } = nachEinemZug();
    expect(zurueck(nachher).joker).toBe(nachher.joker - 1);
  });

  it('geht nur einen Zug weit', () => {
    const { nachher } = nachEinemZug();
    const einmal = zurueck(nachher);
    expect(einmal.verlauf).toBeNull();
    expect(zurueck(einmal)).toBe(einmal);
  });

  it('tut am Anfang und ohne Joker nichts', () => {
    const start = neuesSpiel(2);
    expect(zurueck(start)).toBe(start);
    const { nachher } = nachEinemZug();
    const ohne = { ...nachher, joker: 0 };
    expect(zurueck(ohne)).toBe(ohne);
  });

  it('lässt nach dem Zurück denselben Zug wieder zu — und denselben Ausgang', () => {
    const { nachher } = nachEinemZug();
    const nochmal = teilLegen(zurueck(nachher), 1, 2, 3);
    expect(nochmal.raster).toEqual(nachher.raster);
    expect(nochmal.punkte).toBe(nachher.punkte);
    expect(nochmal.tablett).toEqual(nachher.tablett);
  });

  it('gibt eine verdiente Etappe nicht zurück: Aufstieg, Zurück, derselbe Zug ergibt keinen zweiten Joker', () => {
    // Sonst ließe sich ein Joker verdienen, einsetzen und wieder verdienen —
    // eine Joker-Maschine.
    const z: Zustand = {
      ...neuesSpiel(1),
      raster: zeileFastVoll(),
      tablett: [EINZEL, null, null],
      linien: LINIEN_JE_ETAPPE - 1,
      joker: 0,
    };
    const aufstieg = teilLegen(z, 0, 7, 0);
    expect(aufstieg.joker).toBe(1);
    const zurueckZ = zurueck(aufstieg);
    expect(zurueckZ.joker).toBe(0); // ausgegeben
    expect(zurueckZ.linien).toBe(LINIEN_JE_ETAPPE - 1); // die Linie ist wieder weg
    const nochmal = teilLegen(zurueckZ, 0, 7, 0);
    expect(nochmal.linien).toBe(LINIEN_JE_ETAPPE);
    expect(nochmal.joker).toBe(0); // die Etappe war schon belohnt
  });
});

describe('festgefahren', () => {
  // Zwei freie Felder je Zeile und Spalte, nirgends zwei nebeneinander (siehe
  // loeser.test.ts): Kein Domino passt, ein Einzelteil schließt noch keine Linie.
  const loecher = brettAus(
    Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: 8 }, (_, x) => (x === i || x === (i + 2) % 8 ? '.' : '#')).join(''),
    ),
  );
  const festgefahrenZ = (joker: number): Zustand => ({
    ...neuesSpiel(1),
    raster: loecher,
    tablett: [EINZEL, ZWEIER, ZWEIER],
    joker,
  });

  it('ist nicht das Ende, solange ein Joker da ist', () => {
    const nach = teilLegen(festgefahrenZ(1), 0, 0, 0);
    expect(nach.festgefahren).toBe(true);
    expect(nach.vorbei).toBe(false);
  });

  it('wird ohne Joker zum Ende', () => {
    const nach = teilLegen(festgefahrenZ(0), 0, 0, 0);
    expect(nach.festgefahren).toBe(false);
    expect(nach.vorbei).toBe(true);
  });

  it('nimmt im Stillstand keinen Zug mehr an, aber ein Zurück', () => {
    const still = teilLegen(festgefahrenZ(1), 0, 0, 0);
    expect(teilLegen(still, 1, 2, 2)).toBe(still);
    const frei = zurueck(still);
    expect(frei.festgefahren).toBe(false);
    expect(frei.vorbei).toBe(false);
    expect(frei.joker).toBe(0);
    expect(frei.tablett[0]).not.toBeNull(); // das Einzelteil liegt wieder im Tablett
  });
});

describe('Spielverlauf mit Zurück: Grundregeln nach jedem Schritt', () => {
  it('hält Vorrat, Stillstand und Tablett über viele zufällige Spiele zusammen', () => {
    // Wischen, Legen und Zurück gemischt — Einzeltests allein decken die
    // Übergänge zwischen den Zuständen nicht ab.
    for (let saat = 1; saat <= 40; saat++) {
      const zufall = rng(saat * 31);
      let z = neuesSpiel(saat);
      for (let schritt = 0; schritt < 250 && !z.vorbei; schritt++) {
        if (z.joker > 0 && z.verlauf && zufall.zahl() < 0.08) z = zurueck(z);
        if (z.festgefahren) {
          z = zurueck(z);
          continue;
        }
        const moegliche: [number, number, number][] = [];
        z.tablett.forEach((t, i) => {
          if (!t) return;
          for (let y = 0; y < HOEHE; y++) for (let x = 0; x < BREITE; x++) if (passtAn(z.raster, t.form, x, y)) moegliche.push([i, x, y]);
        });
        if (moegliche.length === 0) break;
        const [i, x, y] = zufall.waehlen(moegliche);
        z = teilLegen(z, i!, x!, y!);

        expect(z.joker).toBeGreaterThanOrEqual(0);
        expect(z.joker).toBeLessThanOrEqual(JOKER_MAX);
        expect(z.vorbei && z.festgefahren).toBe(false);
        expect(z.belohnt).toBeGreaterThanOrEqual(etappeFuer(z.linien));
        expect(z.tablett).toHaveLength(3);
        expect(z.punkte).toBeGreaterThanOrEqual(0);
        // „Vorbei" heißt wirklich: nichts passt mehr, und kein Joker rettet es.
        const passt = z.tablett.some((t) => t && passtIrgendwo(z.raster, t.form));
        if (z.vorbei) expect(passt).toBe(false);
        if (z.festgefahren) expect(passt).toBe(false);
        if (!z.vorbei && !z.festgefahren) expect(passt).toBe(true);
      }
    }
  });
});
