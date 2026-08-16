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
  /** Höchstzahl erlaubter Züge, `null` = ohne Grenze. Siehe `zugGrenzeFuerLevel`. */
  zugGrenze: number | null;
  level: number;
  punkte: number;
  vorbei: boolean;
  /** Alle Paare gefunden. `vorbei` ohne `gewonnen` heißt: Züge aufgebraucht. */
  gewonnen: boolean;
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
 * Das erste Level auf der letzten Stufe — aus `STUFEN` abgeleitet, damit die
 * Zahl mitwandert, wenn dort eine Stufe dazukommt oder wegfällt.
 */
export const DECKEL_LEVEL = STUFEN.length * 2 - 1;

/**
 * Zugobergrenze; `null` heißt „ohne Grenze".
 *
 * Warum es sie gibt: Ab der Deckelstufe waren Feldgröße, Motivzahl und
 * erreichbare Punktzahl für jedes weitere Level gleich — nur die Verteilung
 * der Karten wechselte. Das Spiel wurde also nicht mehr schwerer, egal wie
 * weit man kam. Größer darf das Feld aber nicht werden (6×5 ist die Grenze,
 * die auf ein schmales Handy passt), und weniger Motive gäbe es nur um den
 * Preis, Paare farblich ununterscheidbar zu machen. Bleibt die Zugzahl: Sie
 * lässt das Feld unangetastet und kann beliebig weiter steigen.
 *
 * Bis zur Deckelstufe gibt es bewusst keine Grenze — dort ist das wachsende
 * Feld die Schwierigkeit, und ein Kind soll die ersten Level in Ruhe
 * ausprobieren dürfen.
 *
 * Der Einstieg ist großzügig (vier Züge je Paar) und sinkt um zwei Züge je
 * Level bis auf zwei Züge je Paar. Tiefer wäre unfair: Selbst mit
 * lückenlosem Gedächtnis braucht man im Schnitt rund 1,6 Züge je Paar, weil
 * die erste Karte jedes noch unbekannten Motivs blind gezogen wird.
 */
export function zugGrenzeFuerLevel(level: number): number | null {
  const stufe = Math.max(1, level);
  if (stufe < DECKEL_LEVEL) return null;
  const { spalten, zeilen } = stufeFuerLevel(stufe);
  const paare = (spalten * zeilen) / 2;
  return Math.max(paare * 2, paare * 4 - (stufe - DECKEL_LEVEL) * 2);
}

/**
 * Punkte: Wer weniger Züge braucht, bekommt mehr. Ein Zug ist ein Paar
 * aufgedeckter Karten.
 *
 * Bestmöglich sind genau `paare` Züge (jedes Paar auf Anhieb). Jeder Zug
 * darüber kostet, aber nie unter einen Sockel — sonst wäre eine mühsam
 * zu Ende gespielte große Runde weniger wert als eine glatte kleine.
 *
 * Dieselbe Rechnung läuft auch **während** der Runde, dann mit den bisher
 * gefundenen Paaren statt allen. Dadurch steigt der Stand bei jedem Treffer
 * um glatte 100 (der Abzug bleibt gleich, weil Zug und Paar zusammen
 * dazukommen) und sinkt bei jedem Fehlgriff um 12. Am Ende, wenn alle Paare
 * liegen, kommt genau derselbe Wert heraus wie vorher auch.
 */
export function punkteFuerZuege(paare: number, zuege: number): number {
  const hoechstwert = paare * 100;
  const sockel = paare * 20;
  const zuviel = Math.max(0, zuege - paare);
  return Math.max(sockel, hoechstwert - zuviel * 12);
}

export function neuesSpiel(level: number): Zustand {
  const stufe = Math.max(1, level);
  const { spalten, zeilen } = stufeFuerLevel(stufe);
  const paare = (spalten * zeilen) / 2;
  const zufall = rng(saatAus('paare', stufe));

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
    zugGrenze: zugGrenzeFuerLevel(stufe),
    level: stufe,
    punkte: 0,
    vorbei: false,
    gewonnen: false,
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

  const karten = treffer
    ? z.karten.map((k, i) => (i === a || i === b ? { ...k, gefunden: true } : k))
    : z.karten;
  const gefunden = karten.filter((k) => k.gefunden).length / 2;
  const gewonnen = gefunden === karten.length / 2;
  // Die Grenze greift erst, wenn das letzte Paar nicht mehr gefallen ist:
  // Ein Sieg mit dem allerletzten erlaubten Zug bleibt ein Sieg.
  const aufgebraucht = !gewonnen && z.zugGrenze !== null && zuege >= z.zugGrenze;

  return {
    ...z,
    karten,
    // Bei einem Treffer bleiben die Karten offen liegen, weil sie ab jetzt
    // als „gefunden" gezeichnet werden — `offen` wird also geleert.
    offen: treffer ? [] : offen,
    fehlgriff: !treffer,
    zuege,
    vorbei: gewonnen || aufgebraucht,
    gewonnen,
    // Läuft mit, statt erst am Schluss zu springen — sonst stand die ganze
    // Runde über eine 0 in der Kopfzeile und es gab keinerlei Rückmeldung
    // darauf, ob ein Zug gut war. Der Endwert bleibt derselbe wie vorher.
    punkte: punkteFuerZuege(gefunden, zuege),
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
