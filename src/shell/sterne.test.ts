import { describe, expect, it } from 'vitest';
import { sterne, sternText } from './sterne';

describe('sterne', () => {
  it('gibt für einen Sieg immer drei Sterne', () => {
    // Bei Box Push oder Flow Link ist das Lösen die Leistung. Wer mehr Züge
    // gebraucht hat als beim letzten Mal, hat die Aufgabe trotzdem gelöst.
    expect(sterne(10, 1000, true)).toBe(3);
    expect(sterne(0, 1000, true)).toBe(3);
  });

  it('gibt für null Punkte nur einen Stern, auch beim allerersten Mal', () => {
    expect(sterne(0, 0)).toBe(1);
    expect(sterne(0, 500)).toBe(1);
  });

  it('gibt für die erste Runde mit Punkten drei Sterne', () => {
    // Es gibt noch nichts, wogegen man messen könnte.
    expect(sterne(1, 0)).toBe(3);
    expect(sterne(4200, 0)).toBe(3);
  });

  it('misst gegen die eigene Bestleistung', () => {
    expect(sterne(90, 100)).toBe(3);
    expect(sterne(100, 100)).toBe(3);
    expect(sterne(140, 100)).toBe(3);
    expect(sterne(50, 100)).toBe(2);
    expect(sterne(89, 100)).toBe(2);
    expect(sterne(49, 100)).toBe(1);
    expect(sterne(1, 100)).toBe(1);
  });

  it('wertet auf jeder Punkteskala gleich', () => {
    // Das ist der eigentliche Sinn: Quiz Time geht 0 bis 10, Block Burst in
    // die Tausende. Dieselbe *relative* Leistung muss dieselbe Sternzahl
    // ergeben, sonst wäre die Wertung zwischen den Spielen willkürlich.
    expect(sterne(7, 10)).toBe(sterne(7000, 10000));
    expect(sterne(3, 10)).toBe(sterne(3000, 10000));
    expect(sterne(10, 10)).toBe(sterne(10000, 10000));
  });

  it('ist nie kleiner, wenn man mehr Punkte macht', () => {
    // Monotonie — ohne die wäre die Wertung für ein Kind nicht durchschaubar.
    for (let beste = 1; beste <= 60; beste += 7) {
      let vorher = 0;
      for (let p = 0; p <= 120; p++) {
        const jetzt = sterne(p, beste);
        expect(jetzt).toBeGreaterThanOrEqual(vorher);
        vorher = jetzt;
      }
    }
  });

  it('hat für jede Sternzahl einen eigenen Satz', () => {
    // Farbe und Form sind nie das einzige Merkmal.
    const texte = [sternText(1), sternText(2), sternText(3)];
    expect(new Set(texte).size).toBe(3);
    for (const t of texte) expect(t.length).toBeGreaterThan(0);
  });
});
