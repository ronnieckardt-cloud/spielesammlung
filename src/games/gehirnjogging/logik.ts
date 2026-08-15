import { saatAus } from '../../core/rng';
import { kopfrechnenAufgabe } from './kopfrechnen';
import type { KopfrechnenAufgabe } from './kopfrechnen';
import { merkfolgenAufgabe } from './merkfolgen';
import type { MerkfolgenAufgabe } from './merkfolgen';
import { musterAufgabe } from './muster';
import type { MusterAufgabe } from './muster';

/**
 * Gehirnjogging: Level = Runde, wie beim Farbsortierer und beim Wissensquiz.
 * Welche der drei Varianten ein Level bekommt, ergibt sich reihum aus der
 * Levelnummer. Jede Runde besteht aus mehreren Aufgaben derselben Variante,
 * Schwierigkeit steigt mit dem Level (siehe die einzelnen Varianten-Module).
 */

export type Variante = 'kopfrechnen' | 'merkfolgen' | 'muster';

const VARIANTEN_REIHENFOLGE: readonly Variante[] = ['kopfrechnen', 'merkfolgen', 'muster'];

export function varianteFuerLevel(level: number): Variante {
  const i = ((level - 1) % VARIANTEN_REIHENFOLGE.length) + VARIANTEN_REIHENFOLGE.length;
  return VARIANTEN_REIHENFOLGE[i % VARIANTEN_REIHENFOLGE.length]!;
}

export type Aufgabe =
  | { art: 'kopfrechnen'; daten: KopfrechnenAufgabe }
  | { art: 'merkfolgen'; daten: MerkfolgenAufgabe }
  | { art: 'muster'; daten: MusterAufgabe };

export const AUFGABEN_PRO_LEVEL = 5;

export type Zustand = {
  level: number;
  variante: Variante;
  aufgaben: readonly Aufgabe[];
  index: number;
  /** null = aktuelle Aufgabe noch offen; sonst das Ergebnis der Aufgabe. */
  ergebnis: boolean | null;
  richtigeAnzahl: number;
  serie: number;
  punkte: number;
  vorbei: boolean;
};

function aufgabeErzeugen(variante: Variante, saat: number, level: number): Aufgabe {
  if (variante === 'kopfrechnen') return { art: 'kopfrechnen', daten: kopfrechnenAufgabe(saat, level) };
  if (variante === 'merkfolgen') return { art: 'merkfolgen', daten: merkfolgenAufgabe(saat, level) };
  return { art: 'muster', daten: musterAufgabe(saat, level) };
}

export function neuesLevel(level: number): Zustand {
  const variante = varianteFuerLevel(level);
  const aufgaben: Aufgabe[] = [];
  for (let i = 0; i < AUFGABEN_PRO_LEVEL; i++) {
    aufgaben.push(aufgabeErzeugen(variante, saatAus('gehirnjogging', level, i), level));
  }
  return {
    level,
    variante,
    aufgaben,
    index: 0,
    ergebnis: null,
    richtigeAnzahl: 0,
    serie: 0,
    punkte: 0,
    vorbei: false,
  };
}

const PUNKTE_BASIS = 10;
const PUNKTE_SERIE_MAX_BONUS = 20;
const PUNKTE_SERIE_SCHRITT = 2;

/** Richtige Aufgaben geben mehr, je länger die Serie am Stück läuft — bis zu einem Deckel. */
export function punkteFuerAntwort(richtig: boolean, serieNachAntwort: number): number {
  if (!richtig) return 0;
  return PUNKTE_BASIS + Math.min(PUNKTE_SERIE_MAX_BONUS, (serieNachAntwort - 1) * PUNKTE_SERIE_SCHRITT);
}

/** Aktuelle Aufgabe abschließen — geht nur einmal, bis naechsteAufgabe weiterschaltet. */
export function aufgabeAbschliessen(z: Zustand, richtig: boolean): Zustand {
  if (z.vorbei || z.ergebnis !== null) return z;
  const serie = richtig ? z.serie + 1 : 0;
  const punkte = z.punkte + punkteFuerAntwort(richtig, serie);
  return {
    ...z,
    ergebnis: richtig,
    richtigeAnzahl: z.richtigeAnzahl + (richtig ? 1 : 0),
    serie,
    punkte,
  };
}

/** Zur nächsten Aufgabe — erst möglich, nachdem die aktuelle abgeschlossen wurde. */
export function naechsteAufgabe(z: Zustand): Zustand {
  if (z.vorbei || z.ergebnis === null) return z;
  const naechsterIndex = z.index + 1;
  if (naechsterIndex >= z.aufgaben.length) return { ...z, vorbei: true };
  return { ...z, index: naechsterIndex, ergebnis: null };
}
