import { describe, it, expect } from 'vitest';
import { kopfrechnenAufgabe, stufeFuerLevel } from './kopfrechnen';

describe('stufeFuerLevel', () => {
  it('steigt alle 15 Level um eins und deckelt bei 5', () => {
    expect(stufeFuerLevel(1)).toBe(0);
    expect(stufeFuerLevel(15)).toBe(0);
    expect(stufeFuerLevel(16)).toBe(1);
    expect(stufeFuerLevel(90)).toBe(5);
    expect(stufeFuerLevel(9000)).toBe(5);
  });
});

describe('kopfrechnenAufgabe', () => {
  it('ist deterministisch: gleiche Saat und Level ergeben dieselbe Aufgabe', () => {
    const a = kopfrechnenAufgabe(4711, 20);
    const b = kopfrechnenAufgabe(4711, 20);
    expect(a).toEqual(b);
  });

  it('hat für viele Level und Saaten immer vier eindeutige Antworten und einen gültigen Index', () => {
    for (let level = 1; level <= 95; level += 3) {
      for (let saat = 0; saat < 5; saat++) {
        const a = kopfrechnenAufgabe(saat * 1000 + level, level);
        expect(new Set(a.antworten).size).toBe(4);
        expect(a.richtig).toBeGreaterThanOrEqual(0);
        expect(a.richtig).toBeLessThanOrEqual(3);
        expect(a.text.trim().length).toBeGreaterThan(0);
        // Kindgerecht: das richtige Ergebnis wird nie negativ.
        expect(a.antworten[a.richtig]).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(a.antworten[a.richtig])).toBe(true);
      }
    }
  });

  it('benutzt auf Stufe 0 (Level 1-15) nur Plus und Minus', () => {
    for (let saat = 0; saat < 20; saat++) {
      const a = kopfrechnenAufgabe(saat, 5);
      expect(a.text).not.toMatch(/[×÷]/);
    }
  });

  it('benutzt ab Stufe 5 (Level 76+) zweischrittige Aufgaben mit Punkt-vor-Strich', () => {
    let hatMalMultiplikation = false;
    for (let saat = 0; saat < 20; saat++) {
      const a = kopfrechnenAufgabe(saat, 80);
      if (a.text.includes('×')) hatMalMultiplikation = true;
    }
    expect(hatMalMultiplikation).toBe(true);
  });
});
