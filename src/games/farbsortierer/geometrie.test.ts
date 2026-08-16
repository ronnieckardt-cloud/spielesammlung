import { describe, it, expect } from 'vitest';
import {
  ANHEBEN_BIS,
  AUFRICHTEN_BIS,
  FLUG_UEBERSTAND,
  GIESSEN_BIS,
  HINFLIEGEN_BIS,
  KIPPEN_BIS,
  ROEHRCHEN_ABSTAND,
  ROEHRCHEN_BREITE,
  ROEHRCHEN_HOEHE,
  ausgusskante,
  drehpunkt,
  fliegendePosition,
  flugLuft,
  giessFortschritt,
  rasterBreite,
  rasterHoehe,
  roehrchenPosition,
  schwebePosition,
  spaltenFuerAnzahl,
  zeilenFuerAnzahl,
} from './geometrie';

describe('spaltenFuerAnzahl / zeilenFuerAnzahl', () => {
  it('passt bis sechs Röhrchen in eine Reihe', () => {
    expect(spaltenFuerAnzahl(3)).toBe(3);
    expect(spaltenFuerAnzahl(6)).toBe(6);
    expect(zeilenFuerAnzahl(6)).toBe(1);
  });

  it('bricht danach in zwei gleich lange Reihen um', () => {
    expect(spaltenFuerAnzahl(7)).toBe(4);
    expect(zeilenFuerAnzahl(7)).toBe(2);
    expect(spaltenFuerAnzahl(8)).toBe(4);
    expect(zeilenFuerAnzahl(8)).toBe(2);
  });
});

describe('spaltenFuerAnzahl mit Bühnen-Seitenverhältnis', () => {
  const VERHAELTNISSE = [0.4, 0.55, 0.6, 0.8, 1, 1.4, 2, 3];

  /** Größe eines Röhrchens, wenn die Bühne auf die Höhe 1 normiert ist. */
  const massstab = (breite: number, hoehe: number, verhaeltnis: number) =>
    Math.min(verhaeltnis / breite, 1 / hoehe);

  /** Maße, die die Anzeige aus der Aufteilung wirklich zieht. */
  const brett = (anzahl: number, verhaeltnis?: number) => {
    const breite = rasterBreite(anzahl, verhaeltnis);
    const luft = flugLuft(anzahl, verhaeltnis);
    return { breite, hoehe: rasterHoehe(anzahl, verhaeltnis) + luft, luft };
  };

  it('bricht im Hochformat schon bei fünf Röhrchen um', () => {
    // Gemessene Bühne auf einem 393 × 852 großen iPhone: rund 369 zu 600.
    const hochformat = 369 / 600;
    expect(spaltenFuerAnzahl(5, hochformat)).toBe(3);
    expect(zeilenFuerAnzahl(5, hochformat)).toBe(2);

    // Und die Röhrchen werden dadurch wirklich größer, nicht nur anders
    // angeordnet — inklusive der Luft, die der Umbruch oben kostet.
    const neu = brett(5, hochformat);
    const alt = { breite: rasterBreite(5), hoehe: rasterHoehe(5) };
    expect(massstab(neu.breite, neu.hoehe, hochformat)).toBeGreaterThan(
      massstab(alt.breite, alt.hoehe, hochformat),
    );
  });

  it('lässt im Querformat alles in einer Reihe stehen', () => {
    expect(spaltenFuerAnzahl(5, 2)).toBe(5);
    expect(zeilenFuerAnzahl(5, 2)).toBe(1);
  });

  it('macht die Röhrchen nie kleiner als die feste Regel', () => {
    for (const verhaeltnis of VERHAELTNISSE) {
      for (let anzahl = 3; anzahl <= 8; anzahl++) {
        const gewaehlt = spaltenFuerAnzahl(anzahl, verhaeltnis);
        expect(gewaehlt).toBeGreaterThanOrEqual(1);
        expect(gewaehlt).toBeLessThanOrEqual(Math.min(anzahl, 6));

        const neu = brett(anzahl, verhaeltnis);
        const alt = { breite: rasterBreite(anzahl), hoehe: rasterHoehe(anzahl) };
        expect(massstab(neu.breite, neu.hoehe, verhaeltnis)).toBeGreaterThanOrEqual(
          massstab(alt.breite, alt.hoehe, verhaeltnis) - 1e-9,
        );
      }
    }
  });

  it('hält den Flug im Bild, wo umgebrochen wird', () => {
    for (const verhaeltnis of VERHAELTNISSE) {
      for (let anzahl = 3; anzahl <= 8; anzahl++) {
        // Wo die feste Regel bleibt, bleibt auch ihr Verhalten — der Flug
        // ragt dort wie bisher über das Brett hinaus.
        if (spaltenFuerAnzahl(anzahl, verhaeltnis) === spaltenFuerAnzahl(anzahl)) continue;

        const { breite, hoehe, luft } = brett(anzahl, verhaeltnis);
        const m = massstab(breite, hoehe, verhaeltnis);
        // Die Bühne stellt das Brett mittig: über dem Brett bleibt die halbe
        // Differenz zur Bühnenhöhe frei, umgerechnet in Rastereinheiten.
        const ueberDemBrett = (1 - hoehe * m) / (2 * m);
        expect(luft + ueberDemBrett).toBeGreaterThanOrEqual(FLUG_UEBERSTAND - 1e-6);
      }
    }
  });

  it('bleibt ohne Verhältnis bei der alten Regel', () => {
    expect(spaltenFuerAnzahl(5, undefined)).toBe(5);
    expect(spaltenFuerAnzahl(5, 0)).toBe(5);
    expect(flugLuft(5, undefined)).toBe(0);
  });
});

describe('FLUG_UEBERSTAND', () => {
  it('deckt den höchsten Punkt des fliegenden Röhrchens ab', () => {
    // Unabhängig nachgerechnet: alle vier Ecken über den ganzen Flug selbst
    // drehen und schauen, wie weit sie über die Reihe hinausragen.
    const reihe = { x: 0, y: 0 };
    let hoechster = 0;
    for (let i = 0; i <= 200; i++) {
      const { position, winkelGrad } = fliegendePosition(i / 200, reihe, reihe);
      const dp = drehpunkt(position);
      const w = (winkelGrad * Math.PI) / 180;
      for (const ecke of [
        { x: position.x, y: position.y },
        { x: position.x + ROEHRCHEN_BREITE, y: position.y },
        { x: position.x, y: position.y + ROEHRCHEN_HOEHE },
        { x: position.x + ROEHRCHEN_BREITE, y: position.y + ROEHRCHEN_HOEHE },
      ]) {
        const dx = ecke.x - dp.x;
        const dy = ecke.y - dp.y;
        hoechster = Math.min(hoechster, dp.y + dx * Math.sin(w) + dy * Math.cos(w));
      }
    }
    expect(FLUG_UEBERSTAND).toBeGreaterThanOrEqual(-hoechster);
    // Und nicht großzügig danebengegriffen — höchstens ein paar Einheiten mehr.
    expect(FLUG_UEBERSTAND).toBeLessThanOrEqual(-hoechster + 5);
  });
});

describe('roehrchenPosition', () => {
  it('reiht in einer einzigen Zeile nebeneinander, wenn alles hineinpasst', () => {
    expect(roehrchenPosition(0, 5)).toEqual({ x: 0, y: 0 });
    expect(roehrchenPosition(1, 5)).toEqual({ x: ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND, y: 0 });
    expect(roehrchenPosition(4, 5)).toEqual({ x: 4 * (ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND), y: 0 });
  });

  it('springt in die zweite Zeile, sobald umgebrochen wird', () => {
    // 8 Röhrchen -> 4 Spalten, 2 Zeilen.
    expect(roehrchenPosition(3, 8)).toEqual({ x: 3 * (ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND), y: 0 });
    expect(roehrchenPosition(4, 8)).toEqual({ x: 0, y: ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND });
    expect(roehrchenPosition(7, 8)).toEqual({
      x: 3 * (ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND),
      y: ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND,
    });
  });

  it('rückt eine nicht volle letzte Reihe mittig ein', () => {
    // 5 Röhrchen im Hochformat -> 3 Spalten, zweite Reihe hat nur zwei:
    // sie steht um einen halben Platz eingerückt statt links bündig.
    const hochformat = 369 / 600;
    const platz = ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND;
    expect(roehrchenPosition(0, 5, hochformat)).toEqual({ x: 0, y: 0 });
    expect(roehrchenPosition(3, 5, hochformat)).toEqual({
      x: platz / 2,
      y: ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND,
    });
    expect(roehrchenPosition(4, 5, hochformat)).toEqual({
      x: platz / 2 + platz,
      y: ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND,
    });
  });
});

describe('rasterBreite / rasterHoehe', () => {
  it('passt zur Spalten-/Zeilenzahl', () => {
    expect(rasterBreite(5)).toBe(5 * ROEHRCHEN_BREITE + 4 * ROEHRCHEN_ABSTAND);
    expect(rasterHoehe(5)).toBe(ROEHRCHEN_HOEHE);

    expect(rasterBreite(8)).toBe(4 * ROEHRCHEN_BREITE + 3 * ROEHRCHEN_ABSTAND);
    expect(rasterHoehe(8)).toBe(2 * ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND);
  });
});

describe('drehpunkt', () => {
  it('liegt im oberen Drittel des Röhrchens, mittig', () => {
    expect(drehpunkt({ x: 0, y: 0 })).toEqual({
      x: ROEHRCHEN_BREITE / 2,
      y: ROEHRCHEN_HOEHE * 0.32,
    });
    // Verschiebt sich mit der Position mit.
    expect(drehpunkt({ x: 100, y: 50 })).toEqual({
      x: 100 + ROEHRCHEN_BREITE / 2,
      y: 50 + ROEHRCHEN_HOEHE * 0.32,
    });
  });
});

describe('ausgusskante — echte Drehmatrix, von Hand nachgerechnet', () => {
  const position = { x: 0, y: 0 };
  const dp = drehpunkt(position);

  it('liegt bei 0° an der rechten oberen Ecke (Tie-Break bei gleicher Höhe)', () => {
    expect(ausgusskante(position, 0)).toEqual({ x: ROEHRCHEN_BREITE, y: 0 });
  });

  it('berechnet die um 90° gedrehte Ecke exakt nach Drehmatrix', () => {
    // Handrechnung: rechte Ecke (64,0) um den Drehpunkt (32, 64) um 90°
    // gedreht landet bei (96, 96); die linke Ecke (0,0) landet bei (96, 32)
    // und liegt damit höher (kleineres y) — die rechte Ecke gewinnt.
    const kante = ausgusskante(position, 90);
    expect(kante.x).toBeCloseTo(dp.x + ROEHRCHEN_HOEHE * 0.32, 5);
    expect(kante.y).toBeCloseTo(dp.y + ROEHRCHEN_BREITE / 2, 5);
  });

  it('ist bei 180° wieder symmetrisch, aber unten', () => {
    const kante = ausgusskante(position, 180);
    expect(kante.y).toBeGreaterThan(dp.y);
  });

  it('folgt der Röhrchen-Position, wenn die verschoben wird', () => {
    const verschoben = { x: 50, y: 30 };
    const a = ausgusskante(position, 45);
    const b = ausgusskante(verschoben, 45);
    expect(b.x).toBeCloseTo(a.x + 50, 5);
    expect(b.y).toBeCloseTo(a.y + 30, 5);
  });

  it('wählt immer die nach der Drehung tiefer liegende Ecke', () => {
    // Unabhängig von ausgusskante() nachgerechnet: beide Ecken selbst drehen
    // und prüfen, dass die Funktion wirklich die tiefere zurückgibt.
    const eckeDrehen = (lokalX: number, winkelGrad: number) => {
      const w = (winkelGrad * Math.PI) / 180;
      const dx = position.x + lokalX - dp.x;
      const dy = position.y - dp.y;
      return dp.y + dx * Math.sin(w) + dy * Math.cos(w);
    };

    for (const winkel of [10, 45, 80, 100, 135, 170, 190, 260, 300]) {
      const linkesY = eckeDrehen(0, winkel);
      const rechtesY = eckeDrehen(ROEHRCHEN_BREITE, winkel);
      const kante = ausgusskante(position, winkel);
      expect(kante.y).toBeCloseTo(Math.max(linkesY, rechtesY), 5);
    }
  });
});

describe('schwebePosition', () => {
  it('schwebt über der x-Position des Ziels', () => {
    const quelle = { x: 0, y: 0 };
    const ziel = { x: 200, y: 0 };
    expect(schwebePosition(quelle, ziel).x).toBe(200);
  });

  it('schwebt über der höheren (kleineren y-) der beiden Positionen', () => {
    const tiefer = { x: 0, y: 300 };
    const hoeher = { x: 200, y: 0 };
    const schwebe = schwebePosition(tiefer, hoeher);
    expect(schwebe.y).toBeLessThan(hoeher.y);
    expect(schwebe.y).toBeLessThan(tiefer.y);
  });
});

describe('fliegendePosition — Phasenablauf', () => {
  const quelle = { x: 0, y: 0 };
  const ziel = { x: 300, y: 0 };

  it('startet unverdreht an der Quellposition', () => {
    const start = fliegendePosition(0, quelle, ziel);
    expect(start.position).toEqual(quelle);
    expect(start.winkelGrad).toBe(0);
  });

  it('ist am Ende wieder unverdreht an der Quellposition', () => {
    const ende = fliegendePosition(1, quelle, ziel);
    expect(ende.position.x).toBeCloseTo(quelle.x, 5);
    expect(ende.position.y).toBeCloseTo(quelle.y, 5);
    expect(ende.winkelGrad).toBeCloseTo(0, 5);
  });

  it('ist während der Gieß-Phase über dem Ziel und maximal gekippt', () => {
    const mitte = fliegendePosition((KIPPEN_BIS + GIESSEN_BIS) / 2, quelle, ziel);
    const schwebe = schwebePosition(quelle, ziel);
    expect(mitte.position).toEqual(schwebe);
    expect(mitte.winkelGrad).not.toBe(0);
    // Bei t am Ende der Kipp-Phase und am Anfang der Gieß-Phase ist der Winkel identisch —
    // während des Gießens bleibt er konstant.
    const anfang = fliegendePosition(KIPPEN_BIS, quelle, ziel);
    const ende = fliegendePosition(GIESSEN_BIS, quelle, ziel);
    expect(anfang.winkelGrad).toBeCloseTo(ende.winkelGrad, 5);
  });

  it('bewegt sich beim Aufrichten nicht mehr seitlich, nur der Winkel ändert sich', () => {
    const a = fliegendePosition(GIESSEN_BIS + 0.01, quelle, ziel);
    const b = fliegendePosition(AUFRICHTEN_BIS - 0.01, quelle, ziel);
    expect(a.position).toEqual(b.position);
    expect(Math.abs(a.winkelGrad)).toBeGreaterThan(Math.abs(b.winkelGrad));
  });

  it('ist stetig an den Phasengrenzen (kein Sprung)', () => {
    const grenzen = [ANHEBEN_BIS, HINFLIEGEN_BIS, KIPPEN_BIS, GIESSEN_BIS, AUFRICHTEN_BIS];
    for (const grenze of grenzen) {
      const kurzVorher = fliegendePosition(grenze - 0.001, quelle, ziel);
      const genau = fliegendePosition(grenze, quelle, ziel);
      expect(kurzVorher.position.x).toBeCloseTo(genau.position.x, 0);
      expect(kurzVorher.position.y).toBeCloseTo(genau.position.y, 0);
      expect(kurzVorher.winkelGrad).toBeCloseTo(genau.winkelGrad, 0);
    }
  });
});

describe('giessFortschritt', () => {
  it('ist 0 vor der Kipp-Phase und 1 nach der Gieß-Phase', () => {
    expect(giessFortschritt(0)).toBe(0);
    expect(giessFortschritt(KIPPEN_BIS)).toBe(0);
    expect(giessFortschritt(GIESSEN_BIS)).toBe(1);
    expect(giessFortschritt(1)).toBe(1);
  });

  it('steigt dazwischen linear', () => {
    const mitte = giessFortschritt((KIPPEN_BIS + GIESSEN_BIS) / 2);
    expect(mitte).toBeCloseTo(0.5, 5);
  });
});
