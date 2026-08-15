import { describe, it, expect } from 'vitest';
import { musterAufgabe } from './muster';

describe('musterAufgabe', () => {
  it('ist deterministisch: gleiche Saat und Level ergeben dieselbe Aufgabe', () => {
    const a = musterAufgabe(123, 30);
    const b = musterAufgabe(123, 30);
    expect(a).toEqual(b);
  });

  it('hat für viele Level und Saaten eine vierstellige Folge und vier eindeutige Antworten', () => {
    for (let level = 1; level <= 95; level += 3) {
      for (let saat = 0; saat < 5; saat++) {
        const a = musterAufgabe(saat * 1000 + level, level);
        expect(a.folge).toHaveLength(4);
        expect(new Set(a.antworten).size).toBe(4);
        expect(a.richtig).toBeGreaterThanOrEqual(0);
        expect(a.richtig).toBeLessThanOrEqual(3);
        for (const wert of a.folge) {
          expect(wert).toBeGreaterThan(0);
          expect(Number.isInteger(wert)).toBe(true);
        }
      }
    }
  });

  it('ist auf Stufe 0 (Level 1-15) immer eine echte arithmetische Folge mit konstanter Differenz', () => {
    for (let saat = 0; saat < 20; saat++) {
      const a = musterAufgabe(saat, 5);
      const diff = a.folge[1]! - a.folge[0]!;
      for (let i = 1; i < a.folge.length; i++) {
        expect(a.folge[i]! - a.folge[i - 1]!).toBe(diff);
      }
      // Die richtige Antwort setzt dieselbe Differenz fort.
      const naechster = a.folge[a.folge.length - 1]! + diff;
      expect(a.antworten[a.richtig]).toBe(naechster);
    }
  });
});
