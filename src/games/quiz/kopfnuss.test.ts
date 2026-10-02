import { describe, it, expect } from 'vitest';
import { pruefeFrage } from '../../core/leiter';
import { saatAus } from '../../core/rng';
import { formatiere, kopfnuss, rechenaufgabe } from './kopfnuss';

const SCHWEREN = [1, 2, 3, 4, 5] as const;

/** Rechnet einen Ausdruck **unabhängig** vom Erzeuger nach — der Test darf nicht dieselbe Rechnung benutzen wie der Code. */
function auswerten(ausdruck: string): number {
  return new Function(`return (${ausdruck});`)() as number;
}

const zuZahl = (antwort: string) => Number(antwort.replace(/\./g, ''));

describe('Kopfnuss', () => {
  it('der angegebene Wert stimmt mit der unabhängig nachgerechneten Aufgabe überein', () => {
    for (const schwere of SCHWEREN) {
      for (let i = 0; i < 1500; i++) {
        const a = rechenaufgabe(saatAus('t', schwere, i), schwere);
        expect(auswerten(a.ausdruck), `${a.frage} (${a.ausdruck})`).toBe(a.wert);
        expect(Number.isInteger(a.wert)).toBe(true);
      }
    }
  });

  it('die richtige Antwort steht an der angegebenen Stelle, im Text der Frage und in der Erklärung', () => {
    for (const schwere of SCHWEREN) {
      for (let i = 0; i < 500; i++) {
        const saat = saatAus('t', schwere, i);
        const f = kopfnuss(saat, schwere);
        const a = rechenaufgabe(saat, schwere);
        expect(zuZahl(f.antworten[f.richtig]), f.frage).toBe(a.wert);
        expect(f.erklaerung).toContain(formatiere(a.wert));
      }
    }
  });

  it('jede Frage besteht die Formprüfung: vier verschiedene Antworten, Längen, Schwere', () => {
    for (const schwere of SCHWEREN) {
      for (let i = 0; i < 1000; i++) {
        const f = kopfnuss(saatAus('t', schwere, i), schwere);
        expect(pruefeFrage(f), `${f.frage} → ${f.antworten}`).toEqual([]);
        expect(f.schwere).toBe(schwere);
        expect(f.kategorie).toBe('Kopfnuss');
      }
    }
  });

  it('alle falschen Antworten sind ganze, nicht negative Zahlen und ungleich dem Ergebnis', () => {
    for (const schwere of SCHWEREN) {
      for (let i = 0; i < 1000; i++) {
        const f = kopfnuss(saatAus('t', schwere, i), schwere);
        const richtig = zuZahl(f.antworten[f.richtig]);
        f.antworten.forEach((a, k) => {
          const n = zuZahl(a);
          expect(Number.isInteger(n), `${f.frage}: ${a}`).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          if (k !== f.richtig) expect(n).not.toBe(richtig);
        });
      }
    }
  });

  it('gleiche Saat ergibt dieselbe Frage — Voraussetzung für das Duell', () => {
    for (const schwere of SCHWEREN) {
      expect(kopfnuss(12345, schwere)).toEqual(kopfnuss(12345, schwere));
    }
  });

  it('liefert auf jeder Schwere viele verschiedene Aufgaben, nicht immer dieselben', () => {
    for (const schwere of SCHWEREN) {
      const gesehen = new Set<string>();
      for (let i = 0; i < 400; i++) gesehen.add(kopfnuss(saatAus('t', schwere, i), schwere).frage);
      expect(gesehen.size, `Schwere ${schwere}`).toBeGreaterThan(80);
    }
  });

  it('die richtige Antwort verteilt sich über alle vier Plätze', () => {
    const plaetze = [0, 0, 0, 0];
    for (let i = 0; i < 800; i++) plaetze[kopfnuss(saatAus('t', 3, i), 3).richtig]!++;
    for (const n of plaetze) expect(n).toBeGreaterThan(120);
  });

  it('die typischen Fehler stehen oft unter den falschen Antworten (Punkt vor Strich: von links nach rechts gerechnet)', () => {
    let mitFalle = 0;
    let gesamt = 0;
    for (let i = 0; i < 600; i++) {
      const saat = saatAus('t', 2, i);
      const a = rechenaufgabe(saat, 2);
      const m = a.frage.match(/Wie viel ist (\d+) \+ (\d+) × (\d+)\?/);
      if (!m) continue;
      gesamt++;
      const f = kopfnuss(saat, 2);
      const falle = (Number(m[1]) + Number(m[2])) * Number(m[3]);
      if (f.antworten.map(zuZahl).includes(falle)) mitFalle++;
    }
    expect(gesamt).toBeGreaterThan(50);
    expect(mitFalle / gesamt).toBeGreaterThan(0.5);
  });

  it('Rechenaufgaben der leichten Schwere liegen im Kopf-Bereich', () => {
    for (let i = 0; i < 500; i++) {
      const a = rechenaufgabe(saatAus('t', 1, i), 1);
      expect(a.wert).toBeLessThanOrEqual(100);
      expect(a.wert).toBeGreaterThan(0);
    }
  });
});
