import { describe, it, expect } from 'vitest';
import {
  ANHEBEN_BIS,
  AUFRICHTEN_BIS,
  GIESSEN_BIS,
  HINFLIEGEN_BIS,
  KIPPEN_BIS,
  ROEHRCHEN_ABSTAND,
  ROEHRCHEN_BREITE,
  ROEHRCHEN_HOEHE,
  ausgusskante,
  drehpunkt,
  fliegendePosition,
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
