import { describe, it, expect } from 'vitest';
import { FARBEN_ANZAHL, laengeFuerLevel, merkfolgenAufgabe, merkfolgeTippen } from './merkfolgen';

describe('laengeFuerLevel', () => {
  it('wächst alle 10 Level um eins und deckelt bei 9', () => {
    expect(laengeFuerLevel(1)).toBe(3);
    expect(laengeFuerLevel(10)).toBe(3);
    expect(laengeFuerLevel(11)).toBe(4);
    expect(laengeFuerLevel(61)).toBe(9);
    expect(laengeFuerLevel(9000)).toBe(9);
  });
});

describe('merkfolgenAufgabe', () => {
  it('ist deterministisch: gleiche Saat und Level ergeben dieselbe Folge', () => {
    const a = merkfolgenAufgabe(77, 40);
    const b = merkfolgenAufgabe(77, 40);
    expect(a).toEqual(b);
  });

  it('hat für viele Level und Saaten die richtige Länge und nur gültige Kachel-Indizes', () => {
    for (let level = 1; level <= 95; level += 4) {
      for (let saat = 0; saat < 8; saat++) {
        const a = merkfolgenAufgabe(saat * 1000 + level, level);
        expect(a.folge).toHaveLength(laengeFuerLevel(level));
        for (const wert of a.folge) {
          expect(wert).toBeGreaterThanOrEqual(0);
          expect(wert).toBeLessThan(FARBEN_ANZAHL);
        }
      }
    }
  });

  it('lässt nie mehr als zwei gleiche Farben direkt hintereinander zu', () => {
    for (let level = 1; level <= 95; level += 4) {
      for (let saat = 0; saat < 8; saat++) {
        const a = merkfolgenAufgabe(saat * 1000 + level, level);
        for (let i = 2; i < a.folge.length; i++) {
          const dreiGleich = a.folge[i] === a.folge[i - 1] && a.folge[i - 1] === a.folge[i - 2];
          expect(dreiGleich).toBe(false);
        }
      }
    }
  });
});

describe('merkfolgeTippen', () => {
  const aufgabe = { folge: [2, 0, 4] };

  it('meldet "lauft", solange richtig getippt wird und die Folge noch nicht zu Ende ist', () => {
    const erster = merkfolgeTippen(aufgabe, [], 2);
    expect(erster.ergebnis).toBe('lauft');
    expect(erster.eingabe).toEqual([2]);

    const zweiter = merkfolgeTippen(aufgabe, erster.eingabe, 0);
    expect(zweiter.ergebnis).toBe('lauft');
    expect(zweiter.eingabe).toEqual([2, 0]);
  });

  it('meldet "richtig", sobald der letzte Schritt stimmt', () => {
    const ergebnis = merkfolgeTippen(aufgabe, [2, 0], 4);
    expect(ergebnis.ergebnis).toBe('richtig');
    expect(ergebnis.eingabe).toEqual([2, 0, 4]);
  });

  it('meldet "falsch", sobald ein Schritt nicht stimmt, egal an welcher Stelle', () => {
    const beimStart = merkfolgeTippen(aufgabe, [], 5);
    expect(beimStart.ergebnis).toBe('falsch');

    const mittendrin = merkfolgeTippen(aufgabe, [2], 1);
    expect(mittendrin.ergebnis).toBe('falsch');
    expect(mittendrin.eingabe).toEqual([2, 1]);
  });
});
