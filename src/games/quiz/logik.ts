import { rng, saatAus } from '../../core/rng';
import { FRAGEN } from './fragen';
import type { Frage } from './fragen';

/**
 * Wissensquiz: Level = Runde, wie beim Farbsortierer. Aus der Levelnummer
 * wird eine feste, reproduzierbare Auswahl an Fragen gezogen — gleiche
 * Levelnummer, gleiche Fragen, für alle vergleichbar. Reine Logik, kein
 * React, testbar ohne Klick.
 */

export const FRAGEN_PRO_LEVEL = 10;

export type Zustand = {
  level: number;
  fragen: readonly Frage[];
  index: number;
  ausgewaehlt: number | null;
  richtigeAnzahl: number;
  serie: number;
  punkte: number;
  vorbei: boolean;
};

const PUNKTE_BASIS = 10;
const PUNKTE_SERIE_MAX_BONUS = 20;
const PUNKTE_SERIE_SCHRITT = 2;

/** Richtige Antworten geben mehr, je länger die Serie am Stück läuft — bis zu einem Deckel. */
export function punkteFuerAntwort(richtig: boolean, serieNachAntwort: number): number {
  if (!richtig) return 0;
  return PUNKTE_BASIS + Math.min(PUNKTE_SERIE_MAX_BONUS, (serieNachAntwort - 1) * PUNKTE_SERIE_SCHRITT);
}

export function neuesLevel(level: number): Zustand {
  const gemischt = rng(saatAus('quiz', level)).mischen(FRAGEN);
  const fragen = gemischt.slice(0, Math.min(FRAGEN_PRO_LEVEL, gemischt.length));
  return {
    level,
    fragen,
    index: 0,
    ausgewaehlt: null,
    richtigeAnzahl: 0,
    serie: 0,
    punkte: 0,
    vorbei: false,
  };
}

/** Eine Antwort auf die aktuelle Frage wählen — geht nur einmal pro Frage. */
export function antwortWaehlen(z: Zustand, antwortIndex: 0 | 1 | 2 | 3): Zustand {
  if (z.vorbei || z.ausgewaehlt !== null) return z;
  const frage = z.fragen[z.index];
  if (!frage) return z;

  const richtig = antwortIndex === frage.richtig;
  const serie = richtig ? z.serie + 1 : 0;
  const punkte = z.punkte + punkteFuerAntwort(richtig, serie);

  return {
    ...z,
    ausgewaehlt: antwortIndex,
    richtigeAnzahl: z.richtigeAnzahl + (richtig ? 1 : 0),
    serie,
    punkte,
  };
}

/** Zur nächsten Frage — erst möglich, nachdem die aktuelle beantwortet wurde. */
export function naechsteFrage(z: Zustand): Zustand {
  if (z.vorbei || z.ausgewaehlt === null) return z;
  const naechsterIndex = z.index + 1;
  if (naechsterIndex >= z.fragen.length) return { ...z, vorbei: true };
  return { ...z, index: naechsterIndex, ausgewaehlt: null };
}
