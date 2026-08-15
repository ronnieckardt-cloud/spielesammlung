import { describe, it, expect } from 'vitest';
import { BREITE, HOEHE } from './logik';
import type { Punkt } from './logik';
import {
  direktBenachbart,
  gliedArt,
  kachelMitte,
  laeufe,
  laeuftSenkrecht,
  pfadDurch,
  versatz,
} from './geometrie';

describe('kachelMitte', () => {
  it('liegt in der Mitte der Kachel', () => {
    expect(kachelMitte({ x: 0, y: 0 })).toEqual({ x: 0.5, y: 0.5 });
    expect(kachelMitte({ x: 3, y: 7 })).toEqual({ x: 3.5, y: 7.5 });
  });
});

describe('versatz', () => {
  it('meldet den einfachen Schritt', () => {
    expect(versatz({ x: 3, y: 3 }, { x: 4, y: 3 })).toEqual({ dx: 1, dy: 0 });
    expect(versatz({ x: 3, y: 3 }, { x: 3, y: 2 })).toEqual({ dx: 0, dy: -1 });
  });

  it('zählt den Rand-Umschlag als einen Schritt, nicht als Sprung', () => {
    // Von ganz rechts nach ganz links ist ein Schritt nach rechts.
    expect(versatz({ x: BREITE - 1, y: 5 }, { x: 0, y: 5 })).toEqual({ dx: 1, dy: 0 });
    // Und umgekehrt.
    expect(versatz({ x: 0, y: 5 }, { x: BREITE - 1, y: 5 })).toEqual({ dx: -1, dy: 0 });
    expect(versatz({ x: 5, y: HOEHE - 1 }, { x: 5, y: 0 })).toEqual({ dx: 0, dy: 1 });
    expect(versatz({ x: 5, y: 0 }, { x: 5, y: HOEHE - 1 })).toEqual({ dx: 0, dy: -1 });
  });
});

describe('direktBenachbart', () => {
  it('ist wahr für Nachbarn', () => {
    expect(direktBenachbart({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe(true);
    expect(direktBenachbart({ x: 2, y: 2 }, { x: 2, y: 1 })).toBe(true);
  });

  it('ist falsch über den Rand hinweg — dort springt die Schlange', () => {
    expect(direktBenachbart({ x: BREITE - 1, y: 5 }, { x: 0, y: 5 })).toBe(false);
  });

  it('ist falsch für diagonale oder entfernte Felder', () => {
    expect(direktBenachbart({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false);
    expect(direktBenachbart({ x: 2, y: 2 }, { x: 5, y: 2 })).toBe(false);
  });
});

describe('laeufe', () => {
  it('gibt bei einer zusammenhängenden Kette genau einen Lauf', () => {
    const s: Punkt[] = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const teile = laeufe(s);
    expect(teile).toHaveLength(1);
    expect(teile[0]).toHaveLength(3);
  });

  it('trennt am Rand-Umschlag', () => {
    // Kopf gerade durch den Rand getreten: 0 ← 16 ← 15
    const s: Punkt[] = [
      { x: 0, y: 5 },
      { x: BREITE - 1, y: 5 },
      { x: BREITE - 2, y: 5 },
    ];
    const teile = laeufe(s);
    expect(teile).toHaveLength(2);
    expect(teile[0]).toEqual([{ x: 0, y: 5 }]);
    expect(teile[1]).toHaveLength(2);
  });

  it('behält alle Glieder, egal wie oft getrennt wird', () => {
    const s: Punkt[] = [
      { x: 0, y: 0 },
      { x: BREITE - 1, y: 0 },
      { x: BREITE - 1, y: HOEHE - 1 },
      { x: BREITE - 2, y: HOEHE - 1 },
    ];
    const teile = laeufe(s);
    expect(teile.flat()).toHaveLength(s.length);
    expect(teile).toHaveLength(3);
  });

  it('kommt mit einer leeren Kette klar', () => {
    expect(laeufe([])).toEqual([]);
  });
});

describe('gliedArt', () => {
  const gerade: Punkt[] = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
    { x: 2, y: 5 },
  ];

  it('erkennt Kopf und Schwanz', () => {
    expect(gliedArt(gerade, 0)).toBe('kopf');
    expect(gliedArt(gerade, gerade.length - 1)).toBe('schwanz');
  });

  it('erkennt ein gerades Glied', () => {
    expect(gliedArt(gerade, 1)).toBe('gerade');
    expect(gliedArt(gerade, 2)).toBe('gerade');
  });

  it('erkennt eine Kurve', () => {
    const mitKurve: Punkt[] = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 4, y: 7 },
    ];
    expect(gliedArt(mitKurve, 1)).toBe('kurve');
    expect(gliedArt(mitKurve, 2)).toBe('gerade');
  });

  it('erkennt ein gerades Glied auch über den Rand hinweg', () => {
    // Waagerecht durch den Tunnel: 0 ← 16 ← 15 — das mittlere Glied ist gerade.
    const durchDenRand: Punkt[] = [
      { x: 0, y: 5 },
      { x: BREITE - 1, y: 5 },
      { x: BREITE - 2, y: 5 },
      { x: BREITE - 3, y: 5 },
    ];
    expect(gliedArt(durchDenRand, 1)).toBe('gerade');
  });
});

describe('laeuftSenkrecht', () => {
  it('meldet waagerechte und senkrechte Glieder richtig', () => {
    const waagerecht: Punkt[] = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    expect(laeuftSenkrecht(waagerecht, 1)).toBe(false);

    const senkrecht: Punkt[] = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ];
    expect(laeuftSenkrecht(senkrecht, 1)).toBe(true);
  });
});

describe('pfadDurch', () => {
  it('führt durch die Kachelmittelpunkte', () => {
    expect(
      pfadDurch([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe('M0.5 0.5 L1.5 0.5');
  });

  it('gibt bei leerer Liste einen leeren Pfad', () => {
    expect(pfadDurch([])).toBe('');
  });
});
