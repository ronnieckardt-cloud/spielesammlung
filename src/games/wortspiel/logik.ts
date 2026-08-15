import { rng, saatAus } from '../../core/rng';
import { WOERTER } from './woerter';
import type { Wort } from './woerter';

/**
 * Wortspiel: Level = Runde, wie beim Wissensquiz. Aus der Levelnummer wird
 * eine feste, reproduzierbare Auswahl an Wörtern gezogen — gleiche
 * Levelnummer, gleiche Wörter, für alle vergleichbar. Anders als beim Quiz
 * steigt die Schwierigkeit mit dem Level: höhere Level dürfen aus einem
 * größeren Teil des Pools ziehen (mehr schwierige Wörter dazu, die
 * leichten bleiben immer mit dabei). Reine Logik, kein React.
 */

export const WOERTER_PRO_LEVEL = 8;

export type Zustand = {
  level: number;
  woerter: readonly Wort[];
  index: number;
  ausgewaehlt: number | null;
  richtigeAnzahl: number;
  serie: number;
  punkte: number;
  vorbei: boolean;
};

/** Ab welcher Levelnummer welche Schwierigkeitsstufen dazukommen. */
export function maxStufeFuerLevel(level: number): 1 | 2 | 3 {
  if (level <= 20) return 1;
  if (level <= 50) return 2;
  return 3;
}

const PUNKTE_BASIS = 10;
const PUNKTE_SERIE_MAX_BONUS = 20;
const PUNKTE_SERIE_SCHRITT = 2;

/** Richtige Antworten geben mehr, je länger die Serie am Stück läuft — bis zu einem Deckel. */
export function punkteFuerAntwort(richtig: boolean, serieNachAntwort: number): number {
  if (!richtig) return 0;
  return PUNKTE_BASIS + Math.min(PUNKTE_SERIE_MAX_BONUS, (serieNachAntwort - 1) * PUNKTE_SERIE_SCHRITT);
}

export function neuesLevel(level: number): Zustand {
  const erlaubteStufe = maxStufeFuerLevel(level);
  const pool = WOERTER.filter((w) => w.stufe <= erlaubteStufe);
  const gemischt = rng(saatAus('wortspiel', level)).mischen(pool);
  const woerter = gemischt.slice(0, Math.min(WOERTER_PRO_LEVEL, gemischt.length));
  return {
    level,
    woerter,
    index: 0,
    ausgewaehlt: null,
    richtigeAnzahl: 0,
    serie: 0,
    punkte: 0,
    vorbei: false,
  };
}

/** Eine Schreibweise für das aktuelle Wort wählen — geht nur einmal pro Wort. */
export function antwortWaehlen(z: Zustand, antwortIndex: 0 | 1 | 2 | 3): Zustand {
  if (z.vorbei || z.ausgewaehlt !== null) return z;
  const wort = z.woerter[z.index];
  if (!wort) return z;

  const richtig = antwortIndex === wort.richtig;
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

/** Zum nächsten Wort — erst möglich, nachdem das aktuelle beantwortet wurde. */
export function naechstesWort(z: Zustand): Zustand {
  if (z.vorbei || z.ausgewaehlt === null) return z;
  const naechsterIndex = z.index + 1;
  if (naechsterIndex >= z.woerter.length) return { ...z, vorbei: true };
  return { ...z, index: naechsterIndex, ausgewaehlt: null };
}
