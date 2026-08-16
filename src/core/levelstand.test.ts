import { describe, expect, it } from 'vitest';
import { levelstand } from './levelstand';

describe('levelstand', () => {
  it('fängt ohne gespeicherten Stand bei 1 an', () => {
    const l = levelstand();
    expect(l.anfang(undefined)).toBe(1);
  });

  it('übernimmt den gespeicherten Stand beim ersten Betreten', () => {
    const l = levelstand();
    expect(l.anfang(7)).toBe(7);
  });

  it('übernimmt ihn genau einmal — sonst spielt „Nochmal" dasselbe Level', () => {
    /*
     * Das ist der Kern des Ganzen. Die Hülle liest `startLevel` einmal beim
     * Betreten; beim „Nochmal" mountet das Spiel neu und bekommt **denselben**
     * alten Wert wieder herein. Würde er dann erneut übernommen, käme man nie
     * über das gespeicherte Level hinaus — genau der gemeldete Fehler, nur
     * eine Ebene höher.
     */
    const l = levelstand();
    expect(l.anfang(7)).toBe(7);
    l.setzen(8);
    expect(l.anfang(7)).toBe(8);
    l.setzen(9);
    expect(l.anfang(7)).toBe(9);
  });

  it('lässt sich von unsinnigen Werten nicht aus der Bahn bringen', () => {
    for (const kaputt of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const l = levelstand();
      expect(l.anfang(kaputt)).toBeGreaterThanOrEqual(1);
    }
    const l = levelstand();
    l.anfang(undefined);
    l.setzen(0);
    expect(l.anfang(undefined)).toBe(1);
    l.setzen(Number.NaN);
    expect(l.anfang(undefined)).toBe(1);
  });

  it('rundet auf ganze Levelnummern ab', () => {
    const l = levelstand();
    expect(l.anfang(4.8)).toBe(4);
    l.setzen(6.9);
    expect(l.anfang(undefined)).toBe(6);
  });
});
