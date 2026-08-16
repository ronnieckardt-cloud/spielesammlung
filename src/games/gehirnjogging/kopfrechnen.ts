import { rng } from '../../core/rng';
import type { Zufall } from '../../core/rng';

/**
 * Kopfrechnen: eine Rechenaufgabe als Text, vier Zahlen-Antworten zur Wahl.
 * Reine Funktion — gleiche Saat ergibt immer dieselbe Aufgabe.
 */

export type KopfrechnenAufgabe = {
  text: string;
  antworten: readonly [number, number, number, number];
  richtig: 0 | 1 | 2 | 3;
};

/** Sechs Schwierigkeitsstufen, alle 15 Level eine Stufe höher, gedeckelt bei 5. */
export function stufeFuerLevel(level: number): number {
  // Nach unten geklemmt, gleiche Begründung wie in `muster.ts`:
  // Im Duell kommt die Levelnummer vom Server.
  return Math.max(0, Math.min(5, Math.floor((level - 1) / 15)));
}

function plusMinus(a: number, b: number, minus: boolean): { text: string; wert: number } {
  if (!minus) return { text: `${a} + ${b}`, wert: a + b };
  const [gross, klein] = a >= b ? [a, b] : [b, a];
  return { text: `${gross} - ${klein}`, wert: gross - klein };
}

function aufgabeText(z: Zufall, stufe: number): { text: string; richtig: number } {
  if (stufe === 0) {
    const e = plusMinus(z.bereich(1, 20), z.bereich(1, 20), z.waehlen([true, false]));
    return { text: e.text, richtig: e.wert };
  }
  if (stufe === 1) {
    const e = plusMinus(z.bereich(10, 50), z.bereich(10, 50), z.waehlen([true, false]));
    return { text: e.text, richtig: e.wert };
  }
  if (stufe === 2) {
    const op = z.waehlen(['+', '-', '×'] as const);
    if (op === '×') {
      const a = z.bereich(2, 10);
      const b = z.bereich(2, 10);
      return { text: `${a} × ${b}`, richtig: a * b };
    }
    const e = plusMinus(z.bereich(10, 100), z.bereich(10, 100), op === '-');
    return { text: e.text, richtig: e.wert };
  }
  if (stufe === 3) {
    if (z.waehlen(['×', '÷'] as const) === '×') {
      const a = z.bereich(2, 12);
      const b = z.bereich(2, 12);
      return { text: `${a} × ${b}`, richtig: a * b };
    }
    const teiler = z.bereich(2, 12);
    const ergebnis = z.bereich(2, 12);
    return { text: `${teiler * ergebnis} ÷ ${teiler}`, richtig: ergebnis };
  }
  if (stufe === 4) {
    const op = z.waehlen(['+', '-', '×', '÷'] as const);
    if (op === '×') {
      const a = z.bereich(2, 15);
      const b = z.bereich(2, 15);
      return { text: `${a} × ${b}`, richtig: a * b };
    }
    if (op === '÷') {
      const teiler = z.bereich(2, 15);
      const ergebnis = z.bereich(2, 15);
      return { text: `${teiler * ergebnis} ÷ ${teiler}`, richtig: ergebnis };
    }
    const e = plusMinus(z.bereich(50, 200), z.bereich(50, 200), op === '-');
    return { text: e.text, richtig: e.wert };
  }
  // Stufe 5: zweischrittig, Punkt-vor-Strich, immer nicht-negativ.
  const a = z.bereich(2, 20);
  const b = z.bereich(2, 12);
  const c = z.bereich(2, 12);
  const produkt = b * c;
  if (z.waehlen(['add-mul', 'mul-sub'] as const) === 'add-mul') {
    return { text: `${a} + ${b} × ${c}`, richtig: a + produkt };
  }
  const d = produkt + a;
  return { text: `${d} - ${b} × ${c}`, richtig: a };
}

/** Drei eindeutige, plausible Falschantworten rund um den richtigen Wert. */
function distraktorenErzeugen(z: Zufall, richtig: number): number[] {
  const skalierung = Math.max(2, Math.round(Math.abs(richtig) * 0.15));
  const werte = new Set<number>([richtig]);
  const kandidaten: number[] = [];
  let versuche = 0;
  while (kandidaten.length < 3 && versuche < 100) {
    versuche++;
    const versatz = z.bereich(1, skalierung) * z.waehlen([1, -1] as const);
    const kandidat = richtig + versatz;
    if (!werte.has(kandidat)) {
      werte.add(kandidat);
      kandidaten.push(kandidat);
    }
  }
  // Notfall (extrem unwahrscheinlich): mit größerem Sprung auffüllen.
  let sprung = skalierung + 1;
  while (kandidaten.length < 3) {
    const kandidat = richtig + sprung;
    if (!werte.has(kandidat)) {
      werte.add(kandidat);
      kandidaten.push(kandidat);
    }
    sprung++;
  }
  return kandidaten;
}

export function kopfrechnenAufgabe(saat: number, level: number): KopfrechnenAufgabe {
  const z = rng(saat);
  const stufe = stufeFuerLevel(level);
  const { text, richtig } = aufgabeText(z, stufe);
  const distraktoren = distraktorenErzeugen(z, richtig);
  const alle = z.mischen([richtig, ...distraktoren]);
  const richtigIndex = alle.indexOf(richtig) as 0 | 1 | 2 | 3;

  return {
    text,
    antworten: alle as [number, number, number, number],
    richtig: richtigIndex,
  };
}
