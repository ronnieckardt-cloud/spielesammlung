import { describe, it, expect } from 'vitest';
import { ankerZentriertAuf, formGroesse } from './geometrie';
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
});
