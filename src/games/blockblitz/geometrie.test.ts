import { describe, it, expect } from 'vitest';
import { ankerAufBrett, ankerFuerZelle, ankerZentriertAuf, formGroesse } from './geometrie';
import { BREITE, HOEHE, passtAn, leeresRaster } from './logik';
import type { TeilForm } from './logik';

const EINZEL: TeilForm = [{ dx: 0, dy: 0 }];
const ZWEI_WAAGERECHT: TeilForm = [
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
];
const ECKE: TeilForm = [
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
];
/** Das größte Teil im Spiel — an ihm fällt der Randfehler am stärksten auf. */
const GROSSES_QUADRAT: TeilForm = [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => ({ dx, dy })));

describe('formGroesse', () => {
  it('ist 1x1 für ein einzelnes Feld', () => {
    expect(formGroesse(EINZEL)).toEqual({ breite: 1, hoehe: 1 });
  });

  it('misst die Bounding-Box, nicht die Zellenzahl', () => {
    expect(formGroesse(ZWEI_WAAGERECHT)).toEqual({ breite: 2, hoehe: 1 });
    expect(formGroesse(ECKE)).toEqual({ breite: 2, hoehe: 2 });
  });
});

describe('ankerZentriertAuf', () => {
  it('ein 1x1-Teil landet genau auf der Zielzelle', () => {
    expect(ankerZentriertAuf(EINZEL, 5, 5)).toEqual({ ankerX: 5, ankerY: 5 });
  });

  it('zentriert ein breiteres Teil um die Zielposition', () => {
    // 2 breit -> die Mitte liegt einen halben Schritt daneben, wird gerundet.
    const { ankerX } = ankerZentriertAuf(ZWEI_WAAGERECHT, 5, 5);
    expect(ankerX).toBeGreaterThanOrEqual(4);
    expect(ankerX).toBeLessThanOrEqual(5);
  });

  it('rundet kommagenaue Rasterpositionen sinnvoll', () => {
    // Bei einem 1x1-Teil wird die halbe Zelle (0.5) abgezogen und dann gerundet.
    expect(ankerZentriertAuf(EINZEL, 3.4, 3.6)).toEqual({ ankerX: 3, ankerY: 3 });
    expect(ankerZentriertAuf(EINZEL, 3.6, 4.1)).toEqual({ ankerX: 3, ankerY: 4 });
  });

  it('schiebt größere Teile am Rand aus dem Brett heraus — genau das klemmt ankerAufBrett', () => {
    expect(ankerZentriertAuf(GROSSES_QUADRAT, 0.5, 0.5)).toEqual({ ankerX: -1, ankerY: -1 });
  });
});

describe('ankerAufBrett', () => {
  it('lässt eine Position in der Brettmitte unverändert', () => {
    expect(ankerAufBrett(EINZEL, 4.5, 4.5, BREITE, HOEHE)).toEqual({ ankerX: 4, ankerY: 4 });
  });

  it('klemmt den Anker so, dass die ganze Form im Brett liegt', () => {
    expect(ankerAufBrett(GROSSES_QUADRAT, 0.5, 0.5, BREITE, HOEHE)).toEqual({ ankerX: 0, ankerY: 0 });
    expect(ankerAufBrett(GROSSES_QUADRAT, 7.5, 7.5, BREITE, HOEHE)).toEqual({
      ankerX: BREITE - 3,
      ankerY: HOEHE - 3,
    });
  });

  it('gibt null, wenn die Position weiter als die Toleranz daneben liegt', () => {
    expect(ankerAufBrett(EINZEL, -1, 4, BREITE, HOEHE)).toBeNull();
    expect(ankerAufBrett(EINZEL, 4, HOEHE + 1, BREITE, HOEHE)).toBeNull();
    // Innerhalb der Toleranz zählt es noch als gemeint und wird geklemmt.
    expect(ankerAufBrett(EINZEL, -0.4, 4.5, BREITE, HOEHE, 0.5)).toEqual({ ankerX: 0, ankerY: 4 });
  });
});

describe('ankerFuerZelle', () => {
  it('legt ein 1x1-Teil genau auf die angetippte Zelle', () => {
    for (const [x, y] of [
      [0, 0],
      [3, 5],
      [BREITE - 1, HOEHE - 1],
    ] as const) {
      expect(ankerFuerZelle(EINZEL, x, y, BREITE, HOEHE)).toEqual({ ankerX: x, ankerY: y });
    }
  });

  it('macht jede Zelle des Bretts für jedes Teil zu einem gültigen Ziel', () => {
    // Der eigentliche Befund: Auf dem leeren Brett muss sich jedes Teil von
    // jeder angetippten Zelle aus legen lassen — vorher scheiterte der
    // komplette Außenrand, weil der zentrierte Anker daneben lag.
    const raster = leeresRaster();
    for (const form of [EINZEL, ZWEI_WAAGERECHT, ECKE, GROSSES_QUADRAT]) {
      for (let y = 0; y < HOEHE; y++) {
        for (let x = 0; x < BREITE; x++) {
          const anker = ankerFuerZelle(form, x, y, BREITE, HOEHE);
          expect(anker).not.toBeNull();
          expect(passtAn(raster, form, anker!.ankerX, anker!.ankerY)).toBe(true);
        }
      }
    }
  });
});
