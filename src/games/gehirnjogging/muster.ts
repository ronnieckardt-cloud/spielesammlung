import { rng } from '../../core/rng';
import type { Zufall } from '../../core/rng';

/**
 * Muster erkennen: eine sichtbare Zahlenfolge, vier Zahlen zur Wahl für das
 * nächste Glied. Reine Funktion — gleiche Saat ergibt immer dieselbe Folge.
 */

export type MusterAufgabe = {
  folge: readonly number[];
  antworten: readonly [number, number, number, number];
  richtig: 0 | 1 | 2 | 3;
};

const SICHTBARE_LAENGE = 4;

type Regel = 'arithmetisch' | 'wechselnd' | 'geometrisch';

function stufeFuerLevel(level: number): number {
  return Math.min(5, Math.floor((level - 1) / 15));
}

function regelnFuerStufe(stufe: number): readonly Regel[] {
  if (stufe <= 1) return ['arithmetisch'];
  if (stufe <= 3) return ['arithmetisch', 'wechselnd'];
  return ['arithmetisch', 'wechselnd', 'geometrisch'];
}

function folgeArithmetisch(z: Zufall, stufe: number): { folge: number[]; naechster: number } {
  const schrittMax = stufe <= 1 ? 5 : stufe <= 3 ? 9 : 15;
  const richtung = stufe >= 2 && z.waehlen([true, false]) ? -1 : 1;
  const schrittGroesse = z.bereich(1, schrittMax);
  const schritt = schrittGroesse * richtung;
  const start =
    richtung > 0
      ? z.bereich(1, 20)
      : z.bereich(schrittGroesse * SICHTBARE_LAENGE + 5, schrittGroesse * SICHTBARE_LAENGE + 30);
  const folge = Array.from({ length: SICHTBARE_LAENGE }, (_, i) => start + schritt * i);
  return { folge, naechster: start + schritt * SICHTBARE_LAENGE };
}

function folgeWechselnd(z: Zufall, stufe: number): { folge: number[]; naechster: number } {
  const maxSchritt = stufe <= 3 ? 6 : 10;
  const a = z.bereich(1, maxSchritt);
  let b = z.bereich(1, maxSchritt);
  if (b === a) b = a + 1;
  const schritte = [a, b];
  const start = z.bereich(1, 15);
  const folge = [start];
  for (let i = 1; i < SICHTBARE_LAENGE; i++) {
    folge.push(folge[i - 1]! + schritte[(i - 1) % 2]!);
  }
  const naechster = folge[SICHTBARE_LAENGE - 1]! + schritte[(SICHTBARE_LAENGE - 1) % 2]!;
  return { folge, naechster };
}

function folgeGeometrisch(z: Zufall): { folge: number[]; naechster: number } {
  const faktor = z.waehlen([2, 3] as const);
  const start = z.bereich(1, 4);
  const folge = Array.from({ length: SICHTBARE_LAENGE }, (_, i) => start * faktor ** i);
  return { folge, naechster: start * faktor ** SICHTBARE_LAENGE };
}

function distraktorenErzeugen(z: Zufall, naechster: number, letzterSichtbarer: number): number[] {
  const basisAbstand = Math.max(1, Math.round(Math.abs(naechster - letzterSichtbarer)) || 3);
  const werte = new Set<number>([naechster]);
  let versuche = 0;
  while (werte.size < 4 && versuche < 100) {
    versuche++;
    const versatz = z.bereich(1, basisAbstand) * z.waehlen([1, -1] as const);
    werte.add(naechster + versatz);
  }
  let sprung = basisAbstand + 1;
  while (werte.size < 4) {
    werte.add(naechster + sprung);
    sprung++;
  }
  werte.delete(naechster);
  return Array.from(werte);
}

export function musterAufgabe(saat: number, level: number): MusterAufgabe {
  const z = rng(saat);
  const stufe = stufeFuerLevel(level);
  const regel = z.waehlen(regelnFuerStufe(stufe));

  const { folge, naechster } =
    regel === 'arithmetisch'
      ? folgeArithmetisch(z, stufe)
      : regel === 'wechselnd'
        ? folgeWechselnd(z, stufe)
        : folgeGeometrisch(z);

  const distraktoren = distraktorenErzeugen(z, naechster, folge[folge.length - 1] ?? 0);
  const alle = z.mischen([naechster, ...distraktoren]);
  const richtigIndex = alle.indexOf(naechster) as 0 | 1 | 2 | 3;

  return {
    folge,
    antworten: alle as [number, number, number, number],
    richtig: richtigIndex,
  };
}
