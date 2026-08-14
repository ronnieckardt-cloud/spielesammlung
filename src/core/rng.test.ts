import { describe, it, expect } from 'vitest';
import { rng, saatAus, schritt } from './rng';

describe('rng', () => {
  it('liefert bei gleicher Saat dieselbe Folge', () => {
    const a = rng(12345);
    const b = rng(12345);
    const folgeA = Array.from({ length: 20 }, () => a.zahl());
    const folgeB = Array.from({ length: 20 }, () => b.zahl());
    expect(folgeA).toEqual(folgeB);
  });

  it('liefert bei anderer Saat eine andere Folge', () => {
    const a = Array.from({ length: 20 }, rng(1).zahl);
    const b = Array.from({ length: 20 }, rng(2).zahl);
    expect(a).not.toEqual(b);
  });

  it('Text als Saat funktioniert genauso', () => {
    const a = Array.from({ length: 10 }, rng('level-7').zahl);
    const b = Array.from({ length: 10 }, rng('level-7').zahl);
    expect(a).toEqual(b);
    expect(a).not.toEqual(Array.from({ length: 10 }, rng('level-8').zahl));
  });

  it('bleibt zwischen 0 und 1', () => {
    const z = rng(99);
    for (let i = 0; i < 500; i++) {
      const wert = z.zahl();
      expect(wert).toBeGreaterThanOrEqual(0);
      expect(wert).toBeLessThan(1);
    }
  });

  it('ganzzahl bleibt im erlaubten Bereich', () => {
    const z = rng(7);
    for (let i = 0; i < 500; i++) {
      const wert = z.ganzzahl(6);
      expect(wert).toBeGreaterThanOrEqual(0);
      expect(wert).toBeLessThan(6);
      expect(Number.isInteger(wert)).toBe(true);
    }
  });

  it('bereich schließt beide Enden ein', () => {
    const z = rng(3);
    const gesehen = new Set<number>();
    for (let i = 0; i < 500; i++) gesehen.add(z.bereich(1, 4));
    expect([...gesehen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('mischen behält alle Elemente und ändert das Original nicht', () => {
    const original = [1, 2, 3, 4, 5, 6, 7];
    const gemischt = rng(42).mischen(original);
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...gemischt].sort((a, b) => a - b)).toEqual(original);
    expect(rng(42).mischen(original)).toEqual(gemischt);
  });

  it('schritt ist rein — gleiche Saat, gleiches Ergebnis', () => {
    expect(schritt(500)).toEqual(schritt(500));
    expect(schritt(500).saat).not.toBe(500);
  });

  it('saatAus ist stabil und unterscheidet die Reihenfolge', () => {
    expect(saatAus('spiel', 1)).toBe(saatAus('spiel', 1));
    expect(saatAus('spiel', 1)).not.toBe(saatAus('spiel', 2));
    expect(saatAus('a', 'b')).not.toBe(saatAus('b', 'a'));
  });
});
