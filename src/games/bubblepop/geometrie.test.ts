import { describe, it, expect } from 'vitest';
import {
  FELD_BREITE,
  KANONE,
  MAX_ABWEICHUNG,
  RADIUS,
  flugbahn,
  mittelpunkt,
  naechstesFeld,
  winkelZu,
} from './geometrie';
import { SPALTEN, ZEILEN, leereWabe } from './logik';

describe('mittelpunkt / naechstesFeld', () => {
  it('finden sich gegenseitig für jedes Feld wieder', () => {
    for (let zeile = 0; zeile < ZEILEN; zeile++) {
      for (let spalte = 0; spalte < SPALTEN; spalte++) {
        const zurueck = naechstesFeld(mittelpunkt({ spalte, zeile }));
        expect(zurueck, `${spalte},${zeile}`).toEqual({ spalte, zeile });
      }
    }
  });

  it('versetzt ungerade Zeilen um einen halben Kugeldurchmesser nach rechts', () => {
    const gerade = mittelpunkt({ spalte: 2, zeile: 0 });
    const ungerade = mittelpunkt({ spalte: 2, zeile: 1 });
    expect(ungerade.x - gerade.x).toBeCloseTo(RADIUS);
  });

  it('liefert für Stellen außerhalb ein Feld am Rand statt undefined', () => {
    expect(naechstesFeld({ x: -50, y: -50 })).toEqual({ spalte: 0, zeile: 0 });
  });
});

describe('winkelZu', () => {
  it('zielt bei einem Tipp direkt darüber senkrecht nach oben', () => {
    expect(winkelZu({ x: KANONE.x, y: 0 })).toBeCloseTo(-Math.PI / 2);
  });

  it('schießt auch bei einem Tipp unterhalb nach oben', () => {
    expect(winkelZu({ x: KANONE.x, y: KANONE.y + 30 })).toBeLessThan(0);
  });

  it('begrenzt sehr flache Winkel', () => {
    const weitLinks = winkelZu({ x: -500, y: KANONE.y - 1 });
    const abweichung = Math.abs(weitLinks - -Math.PI / 2);
    expect(abweichung).toBeLessThanOrEqual(MAX_ABWEICHUNG + 1e-9);
  });
});

describe('flugbahn', () => {
  it('erreicht auf leerem Feld die oberste Zeile', () => {
    const bahn = flugbahn(leereWabe(), -Math.PI / 2);
    expect(bahn.ziel).not.toBeNull();
    expect(bahn.ziel!.zeile).toBe(0);
  });

  it('landet bei senkrechtem Schuss in der Mitte', () => {
    const bahn = flugbahn(leereWabe(), -Math.PI / 2);
    const mitte = mittelpunkt(bahn.ziel!);
    expect(Math.abs(mitte.x - KANONE.x)).toBeLessThanOrEqual(RADIUS + 0.01);
  });

  it('prallt an der Seitenwand ab, statt das Feld zu verlassen', () => {
    // Schräg nach links oben — die Bahn muss innerhalb des Felds bleiben.
    const bahn = flugbahn(leereWabe(), -Math.PI / 2 - MAX_ABWEICHUNG);
    for (const p of bahn.punkte) {
      expect(p.x).toBeGreaterThanOrEqual(RADIUS - 0.01);
      expect(p.x).toBeLessThanOrEqual(FELD_BREITE - RADIUS + 0.01);
    }
    expect(bahn.ziel).not.toBeNull();
  });

  it('dockt unterhalb einer belegten Kugel an, nicht in ihr', () => {
    const wabe = leereWabe();
    // Ganze oberste Zeile voll — der senkrechte Schuss muss darunter halten.
    for (let spalte = 0; spalte < SPALTEN; spalte++) wabe[0]![spalte] = 1;
    const bahn = flugbahn(wabe, -Math.PI / 2);
    expect(bahn.ziel).not.toBeNull();
    expect(bahn.ziel!.zeile).toBeGreaterThanOrEqual(1);
    expect(wabe[bahn.ziel!.zeile]![bahn.ziel!.spalte]).toBeNull();
  });

  it('trifft nie ein schon belegtes Feld', () => {
    const wabe = leereWabe();
    for (let zeile = 0; zeile < 4; zeile++) {
      for (let spalte = 0; spalte < SPALTEN; spalte++) wabe[zeile]![spalte] = 2;
    }
    // Viele Winkel durchprobieren — keiner darf in einer belegten Zelle landen.
    for (let i = -20; i <= 20; i++) {
      const winkel = -Math.PI / 2 + (MAX_ABWEICHUNG * i) / 20;
      const bahn = flugbahn(wabe, winkel);
      if (bahn.ziel) {
        expect(wabe[bahn.ziel.zeile]![bahn.ziel.spalte], `Winkel ${winkel}`).toBeNull();
      }
    }
  });

  it('gibt immer mindestens den Startpunkt zurück', () => {
    expect(flugbahn(leereWabe(), -Math.PI / 2).punkte.length).toBeGreaterThan(0);
  });
});
