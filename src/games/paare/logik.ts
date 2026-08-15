import { rng, saatAus } from '../../core/rng';

/**
 * Pair Up: Karten liegen verdeckt, immer zwei aufdecken, gleiche Motive
 * bleiben offen.
 *
 * Der Name ist bewusst **nicht** „Memory": Das ist in Deutschland ein
 * eingetragener Markenname für genau dieses Spiel. Das Prinzip ist frei,
 * der Name nicht — dieselbe Regel wie bei allen anderen Spielen hier.
 *
 * Level = Runde, wie beim Farbsortierer und beim Quiz: Aus der Levelnummer
 * entsteht immer dieselbe Verteilung, damit sich Ergebnisse vergleichen
 * lassen. „Nochmal" spielt deshalb dasselbe Level erneut.
 *
 * Reine Logik, kein React. Die einzige Stelle, an der Zeit vorkommt, ist
 * das Zurückdrehen nach einem Fehlgriff — und auch das ist hier nur ein
 * Zustandswechsel (`schliessen`), den die Anzeige nach ihrer Wartezeit
 * auslöst. Die Logik selbst kennt keine Uhr.
 */

/** So viele verschiedene Motive gibt es (siehe `motive.tsx`). */
export const MOTIV_ANZAHL = 15;

export type Karte = {
  /** 0 bis MOTIV_ANZAHL-1 — welches Bild auf der Karte ist. */
  motiv: number;
  gefunden: boolean;
};

export type Zustand = {
  karten: readonly Karte[];
  spalten: number;
  /** Die gerade aufgedeckten Karten: 0, 1 oder 2 Positionen. */
  offen: readonly number[];
  /** Zwei aufgedeckte Karten passen nicht — die Anzeige wartet kurz und
   *  ruft dann `schliessen`. Getrennt von `offen`, weil ein Treffer die
   *  Karten sofort als gefunden markiert und gar nicht erst wartet. */
  fehlgriff: boolean;
  zuege: number;
  level: number;
  punkte: number;
  vorbei: boolean;
};

/**
 * Feldgröße je Level. Wächst in festen Stufen und ist bei 6×5 gedeckelt —
 * darüber passt das Feld auf einem schmalen Handy nicht mehr ohne
 * Scrollen, und 15 Paare sind für ein Kind ohnehin schon viel.
 *
 * Jede Stufe hat eine gerade Kartenzahl, sonst bliebe eine Karte übrig.
 */
const STUFEN: readonly { spalten: number; zeilen: number }[] = [
  { spalten: 3, zeilen: 2 }, // 3 Paare
  { spalten: 4, zeilen: 2 }, // 4
  { spalten: 4, zeilen: 3 }, // 6
  { spalten: 4, zeilen: 4 }, // 8
  { spalten: 5, zeilen: 4 }, // 10
  { spalten: 6, zeilen: 4 }, // 12
  { spalten: 6, zeilen: 5 }, // 15
];

/** Alle zwei Level eine Stufe größer, dann gedeckelt. */
export function stufeFuerLevel(level: number): { spalten: number; zeilen: number } {
  const index = Math.min(STUFEN.length - 1, Math.floor((Math.max(1, level) - 1) / 2));
  return STUFEN[index]!;
}

/**
 * Punkte: Wer weniger Züge braucht, bekommt mehr. Ein Zug ist ein Paar
 * aufgedeckter Karten.
 *
 * Bestmöglich sind genau `paare` Züge (jedes Paar auf Anhieb). Jeder Zug
 * darüber kostet, aber nie unter einen Sockel — sonst wäre eine mühsam
 * zu Ende gespielte große Runde weniger wert als eine glatte kleine.
 */
export function punkteFuerZuege(paare: number, zuege: number): number {
  const hoechstwert = paare * 100;
  const sockel = paare * 20;
  const zuviel = Math.max(0, zuege - paare);
  return Math.max(sockel, hoechstwert - zuviel * 12);
}

export function neuesSpiel(level: number): Zustand {
  const { spalten, zeilen } = stufeFuerLevel(level);
  const paare = (spalten * zeilen) / 2;
  const zufall = rng(saatAus('paare', level));

  // Erst auswählen, welche Motive überhaupt vorkommen, dann jedes doppelt
  // ins Feld legen und alles mischen. Ohne die Vorauswahl kämen bei kleinen
  // Feldern immer dieselben ersten Motive dran.
  const ausgewaehlt = zufall
    .mischen(Array.from({ length: MOTIV_ANZAHL }, (_, i) => i))
    .slice(0, paare);
  const karten = zufall
    .mischen(ausgewaehlt.flatMap((motiv) => [motiv, motiv]))
    .map((motiv) => ({ motiv, gefunden: false }));

  return {
    karten,
    spalten,
    offen: [],
    fehlgriff: false,
    zuege: 0,
    level: Math.max(1, level),
    punkte: 0,
    vorbei: false,
  };
}

/**
 * Eine Karte antippen.
 *
 * Bleibt wirkungslos, solange zwei Karten offen liegen — erst muss die
 * Anzeige `schliessen` gerufen haben. Sonst könnte man sich durch schnelles
 * Tippen alle Karten der Reihe nach ansehen, ohne je einen Zug zu
 * verbrauchen.
 */
export function aufdecken(z: Zustand, position: number): Zustand {
  if (z.vorbei || z.offen.length >= 2) return z;
  const karte = z.karten[position];
  if (!karte || karte.gefunden || z.offen.includes(position)) return z;

  const offen = [...z.offen, position];
  if (offen.length < 2) return { ...z, offen };

  const zuege = z.zuege + 1;
  const [a, b] = offen as [number, number];
  const treffer = z.karten[a]!.motiv === z.karten[b]!.motiv;

  if (!treffer) return { ...z, offen, fehlgriff: true, zuege };

  const karten = z.karten.map((k, i) => (i === a || i === b ? { ...k, gefunden: true } : k));
  const fertig = karten.every((k) => k.gefunden);
  const paare = karten.length / 2;

  return {
    ...z,
    karten,
    // Bei einem Treffer bleiben die Karten offen liegen, weil sie ab jetzt
    // als „gefunden" gezeichnet werden — `offen` wird also geleert.
    offen: [],
    fehlgriff: false,
    zuege,
    vorbei: fertig,
    punkte: fertig ? punkteFuerZuege(paare, zuege) : z.punkte,
  };
}

/** Nach einem Fehlgriff wieder zudecken — von der Anzeige zeitverzögert gerufen. */
export function schliessen(z: Zustand): Zustand {
  if (z.offen.length === 0) return z;
  return { ...z, offen: [], fehlgriff: false };
}

/** Wie viele Paare schon liegen — nur für die Anzeige. */
export function gefundenePaare(z: Zustand): number {
  return z.karten.filter((k) => k.gefunden).length / 2;
}
