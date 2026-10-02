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
 *
 * Darüber liegen drei Entscheidungen, die aus einer Gedächtnisprobe ein Spiel
 * machen: die **Serie** (Paare ohne Fehlgriff dazwischen bringen Zuschlag),
 * der **Blick** (ein Joker: eine Zeile kurz aufdecken — kostet Punkte) und der
 * **Wirbel** (ab Level 9 mischt jeder n-te Fehlgriff die verdeckten Karten
 * neu — dann gilt das Gelernte nicht mehr).
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
  /** Paare in Folge ohne Fehlgriff dazwischen. */
  serie: number;
  /** Summe der Serien-Zuschläge — in `punkte` schon enthalten, hier getrennt für Tests und Anzeige. */
  bonus: number;
  /** Wie viele Blicke noch im Vorrat sind. */
  blick: number;
  /**
   * Welche Zeile gerade im Blick liegt (`null` = keiner). Die Anzeige deckt sie dann auf und ruft nach
   * ihrer Wartezeit `blickEnde`.
   */
  blickZeile: number | null;
  /** Wie viele Blicke in dieser Runde genommen wurden — jeder kostet `BLICK_KOSTEN` Punkte. */
  blicke: number;
  /** Fehlgriffe seit dem letzten Wirbel. */
  fehlerSeitWirbel: number;
  /** Der Fehlgriff, der gerade offen liegt, löst beim Zudecken einen Wirbel aus. */
  wirbelFaellig: boolean;
  /** Wie oft schon gewirbelt wurde — die Saat des nächsten Wirbels. */
  wirbel: number;
};

/** Ab diesem Level gibt es den Blick. Darunter (drei und vier Paare) gäbe es nichts zu merken. */
export const BLICK_AB_LEVEL = 3;
export const START_BLICK = 1;
/** Mehr als zwei auf Vorrat würden aus dem Blick ein Dauermittel machen. */
export const MAX_BLICK = 2;
/** Jedes dritte Paar in Folge bringt einen Blick. */
export const BLICK_ALLE_SERIE = 3;
/** Was ein Blick kostet: zwei Fehlgriffe. Eine Zahl, die man sich merken kann — und die ihn zu einer Wahl macht. */
export const BLICK_KOSTEN = 24;

/** Der Zuschlag für das `serie`-te Paar in Folge: 0, 15, 30, danach 45. */
export function serieBonus(serie: number): number {
  return Math.min(3, Math.max(0, Math.floor(serie) - 1)) * 15;
}

/** Ab diesem Level (5×4 Karten) wird gewirbelt. */
export const WIRBEL_AB_LEVEL = 9;

/**
 * Nach wie vielen Fehlgriffen gewirbelt wird, `null` = nie. Sechs, ab Level 13 fünf.
 *
 * **Gemessen, nicht geschätzt.** Mit „alle vier / alle drei" (die erste Fassung) kam ein Spieler, der
 * nichts vergisst außer durch den Wirbel, auf den großen Feldern nie ans Ziel: Jeder Wirbel löscht sein
 * Wissen, blindes Aufdecken führt fast immer zum nächsten Fehlgriff, und der nächste Wirbel folgt nach
 * drei Zügen — eine Spirale, aus der es keinen Ausweg gab (60 Züge Grenze, 97 gebraucht). Bei sechs und
 * fünf spürt der perfekte Spieler den Wirbel (auf 15 Paaren rund 2 bis 4 je Runde), kommt aber durch; wer
 * viele Fehlgriffe macht, wirbelt öfter — genau das ist die Strafe.
 */
export function wirbelAlle(level: number): number | null {
  if (level < WIRBEL_AB_LEVEL) return null;
  return level < 13 ? 6 : 5;
}

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
export function punkteFuerZuege(paare: number, zuege: number, blicke = 0): number {
  const hoechstwert = paare * 100;
  const sockel = paare * 20;
  const zuviel = Math.max(0, zuege - paare);
  return Math.max(sockel, hoechstwert - zuviel * 12 - blicke * BLICK_KOSTEN);
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
    serie: 0,
    bonus: 0,
    blick: stufe >= BLICK_AB_LEVEL ? START_BLICK : 0,
    blickZeile: null,
    blicke: 0,
    fehlerSeitWirbel: 0,
    wirbelFaellig: false,
    wirbel: 0,
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
  if (z.vorbei || z.blickZeile !== null || z.offen.length >= 2) return z;
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

  // Serie: Ein Treffer verlängert sie und bringt den Zuschlag, ein Fehlgriff reißt sie ab. Jede dritte
  // Folge schenkt einen Blick (nie über den Vorrat hinaus).
  const serie = treffer ? z.serie + 1 : 0;
  const bonus = z.bonus + (treffer ? serieBonus(serie) : 0);
  const blick =
    treffer && serie % BLICK_ALLE_SERIE === 0 && z.level >= BLICK_AB_LEVEL ? Math.min(MAX_BLICK, z.blick + 1) : z.blick;

  // Wirbel: Der n-te Fehlgriff seit dem letzten löst beim Zudecken einen aus.
  const alle = wirbelAlle(z.level);
  let fehlerSeitWirbel = z.fehlerSeitWirbel;
  let wirbelFaellig = false;
  if (!treffer && alle !== null) {
    fehlerSeitWirbel += 1;
    if (fehlerSeitWirbel >= alle) {
      wirbelFaellig = true;
      fehlerSeitWirbel = 0;
    }
  }

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
    serie,
    bonus,
    blick,
    fehlerSeitWirbel,
    wirbelFaellig,
    // Läuft mit, statt erst am Schluss zu springen — sonst stand die ganze
    // Runde über eine 0 in der Kopfzeile und es gab keinerlei Rückmeldung
    // darauf, ob ein Zug gut war. Ohne Serie und Blick ist der Endwert derselbe wie früher.
    punkte: punkteFuerZuege(gefunden, zuege, z.blicke) + bonus,
  };
}

/**
 * Nach einem Fehlgriff wieder zudecken — von der Anzeige zeitverzögert gerufen.
 *
 * Hier, **nach** dem Zudecken, passiert auch der Wirbel: Alle verdeckten Karten tauschen ihre Motive
 * untereinander. Gefundene Paare bleiben, wo sie liegen. Die Saat kommt aus Level und Wirbelzahl —
 * dieselbe Runde, gespielt von zwei Personen mit denselben Fehlgriffen, wirbelt gleich (Duell).
 */
export function schliessen(z: Zustand): Zustand {
  if (z.offen.length === 0) return z;
  const zu: Zustand = { ...z, offen: [], fehlgriff: false };
  if (!z.wirbelFaellig) return zu;
  return { ...zu, karten: wirbeln(zu), wirbelFaellig: false, wirbel: z.wirbel + 1 };
}

/** Die verdeckten Karten neu verteilen. Bei höchstens zwei übrigen gibt es nichts zu mischen. */
function wirbeln(z: Zustand): readonly Karte[] {
  const plaetze = z.karten.flatMap((k, i) => (k.gefunden ? [] : [i]));
  if (plaetze.length <= 2) return z.karten;
  const motive = plaetze.map((i) => z.karten[i]!.motiv);
  let neu = rng(saatAus('paare', 'wirbel', z.level, z.wirbel)).mischen(motive);
  // Ein Wirbel, bei dem alles liegen bleibt, wäre keiner — dann eine Stelle weiterschieben.
  if (neu.every((m, i) => m === motive[i])) neu = [...motive.slice(1), motive[0]!];
  const karten = [...z.karten];
  plaetze.forEach((platz, k) => {
    karten[platz] = { ...karten[platz]!, motiv: neu[k]! };
  });
  return karten;
}

/** Wie viele Fehlgriffe noch bis zum nächsten Wirbel — `null`, wenn es auf diesem Level keinen gibt. */
export function fehlerBisWirbel(z: Zustand): number | null {
  const alle = wirbelAlle(z.level);
  return alle === null ? null : alle - z.fehlerSeitWirbel;
}

/** Kann man jetzt einen Blick nehmen? Nicht, solange Karten offen liegen, und nicht, wenn nichts mehr zu merken ist. */
export function blickMoeglich(z: Zustand): boolean {
  if (z.vorbei || z.blickZeile !== null || z.fehlgriff || z.offen.length > 0 || z.blick <= 0) return false;
  // Bei einem letzten Paar gäbe es nichts zu sehen, was man nicht ohnehin wüsste.
  return z.karten.length / 2 - gefundenePaare(z) >= 2;
}

/** Welche Karten eine Zeile enthält — die Positionen, nicht die Motive. */
export function karteInZeile(z: Zustand, zeile: number): number[] {
  const von = zeile * z.spalten;
  return z.karten.map((_, i) => i).filter((i) => i >= von && i < von + z.spalten);
}

/** Lohnt der Blick auf diese Zeile? Mindestens zwei noch verdeckte Karten müssen darin liegen. */
export function zeileBlickbar(z: Zustand, zeile: number): boolean {
  return karteInZeile(z, zeile).filter((i) => !z.karten[i]!.gefunden).length >= 2;
}

/**
 * Der Blick: Die Anzeige deckt **eine Zeile** kurz auf, die man selbst wählt. Er kostet einen Blick aus dem
 * Vorrat und `BLICK_KOSTEN` Punkte — und er unterbricht die Serie nicht.
 *
 * Eine Zeile, nicht das ganze Feld: Ein Blick auf alle Karten ließe jedes Level fehlerfrei durchspielen und
 * machte aus einem Gedächtnisspiel ein Abschreiben — gemessen mit einem Spieler, der nichts vergisst, kam er
 * auf jedem Level mit genau so vielen Zügen wie Paaren durch. Mit einer Zeile ist es eine Wahl: **wohin**
 * man schaut und **wann**.
 *
 * Solange er läuft, bleiben alle Berührungen wirkungslos (`aufdecken`), sonst ließe sich im Blick spielen.
 */
export function blickNutzen(z: Zustand, zeile: number): Zustand {
  if (!blickMoeglich(z) || !zeileBlickbar(z, zeile)) return z;
  const blicke = z.blicke + 1;
  return {
    ...z,
    blick: z.blick - 1,
    blicke,
    blickZeile: zeile,
    punkte: punkteFuerZuege(gefundenePaare(z), z.zuege, blicke) + z.bonus,
  };
}

/** Der Blick ist vorbei — von der Anzeige nach ihrer Wartezeit gerufen. */
export function blickEnde(z: Zustand): Zustand {
  return z.blickZeile !== null ? { ...z, blickZeile: null } : z;
}

/** Wie viele Paare schon liegen — nur für die Anzeige. */
export function gefundenePaare(z: Zustand): number {
  return z.karten.filter((k) => k.gefunden).length / 2;
}
