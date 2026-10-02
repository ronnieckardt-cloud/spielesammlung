import { rng, saatAus } from './rng';

/**
 * Die Gewinnleiter — der gemeinsame Kern für Frage-Spiele mit Stufen, Jokern und Sicherheitsstufen.
 *
 * Quiz Time und Word Play benutzen ihn; ein späteres Sprachen-Spiel (Vokabeln) braucht nur eine
 * eigene Fragendatei und einen dünnen Umschlag. Dieser Teil ist reine Logik ohne React und ohne
 * Uhr, damit sich jeder Ablauf ohne Browser prüfen lässt.
 */

/** Eine Frage der Leiter. Spiele liefern ihre Fragen in genau dieser Form. */
export type LeiterFrage = {
  /** Wird über der Frage angezeigt, z. B. „Tiere" oder „Redewendung". */
  kategorie: string;
  frage: string;
  /** Vier Antworten. Keine davon darf auf die Stellung verweisen („alle", „keine davon"): Die Reihenfolge wird je Runde gemischt. */
  antworten: readonly [string, string, string, string];
  /** Index der richtigen Antwort **in `antworten`**. */
  richtig: 0 | 1 | 2 | 3;
  /** Ein bis zwei Sätze, die nach der Antwort erscheinen — richtig oder falsch geklickt. */
  erklaerung: string;
  /**
   * Wie schwer die Frage ist, 1 bis 5. Die fünf Stufen entsprechen den fünf Abschnitten der Leiter:
   * 1 = jedes Grundschulkind, 2 = Klasse 5/6, 3 = Klasse 7 bis 9, 4 = Allgemeinbildung eines
   * Erwachsenen, 5 = knifflig (eindeutig, aber nur wenige wissen es).
   */
  schwere: 1 | 2 | 3 | 4 | 5;
};

export const SCHWEREN = [1, 2, 3, 4, 5] as const;

/**
 * Prüft eine Frage auf Formfehler und gibt die gefundenen Probleme als Sätze zurück (leer = in Ordnung).
 *
 * Faktentreue kann das nicht prüfen — dafür gibt es die Gegenprobe, bei der jemand die Frage ohne
 * Lösung beantwortet. Aber alles, was ein Test prüfen kann, soll er prüfen: Eine Frage, die in der
 * Anzeige abgeschnitten wird oder zwei richtige Antworten hat, fällt sonst erst im Spiel auf.
 */
export function pruefeFrage(f: LeiterFrage): string[] {
  const probleme: string[] = [];
  const text = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

  if (!text(f.kategorie)) probleme.push('Kategorie fehlt');
  if (!text(f.frage)) probleme.push('Fragetext fehlt');
  else if (text(f.frage).length > 150) probleme.push(`Frage zu lang (${text(f.frage).length} Zeichen, höchstens 150)`);

  if (!Array.isArray(f.antworten) || f.antworten.length !== 4) {
    probleme.push('Es müssen genau vier Antworten sein');
  } else {
    const normal = f.antworten.map((a) => text(a).toLowerCase());
    if (normal.some((a) => !a)) probleme.push('Eine Antwort ist leer');
    if (new Set(normal).size !== 4) probleme.push('Zwei Antworten sind gleich');
    for (const a of f.antworten) {
      // Auf dem Handy stehen die Antworten zu zweit nebeneinander, etwa 150 Pixel breit.
      if (text(a).length > 40) probleme.push(`Antwort zu lang: „${text(a)}" (${text(a).length} Zeichen, höchstens 40)`);
      // Die Reihenfolge wird gemischt — „alle drei" oder „keine davon" würde dadurch sinnlos.
      if (/\b(alle|keine|beide|siehe)\b.*\b(antwort|davon|oben|genannt)/i.test(text(a)) || /^(alle|keine|beide)\b/i.test(text(a))) {
        probleme.push(`Antwort verweist auf andere Antworten: „${text(a)}"`);
      }
    }
    if (![0, 1, 2, 3].includes(f.richtig)) probleme.push('Index der richtigen Antwort ungültig');
    else {
      // Verrät die Frage ihre Antwort? Nur bei längeren Antworten prüfen, kurze Zahlen stecken oft zufällig im Text.
      const richtig = text(f.antworten[f.richtig]).toLowerCase();
      if (richtig.length >= 5 && text(f.frage).toLowerCase().includes(richtig)) {
        probleme.push(`Die Frage enthält ihre eigene Antwort: „${richtig}"`);
      }
    }
  }

  const erklaerung = text(f.erklaerung);
  if (erklaerung.length < 15) probleme.push('Erklärung fehlt oder ist zu kurz');
  else if (erklaerung.length > 260) probleme.push(`Erklärung zu lang (${erklaerung.length} Zeichen, höchstens 260)`);

  if (![1, 2, 3, 4, 5].includes(f.schwere)) probleme.push('Schwere muss 1 bis 5 sein');
  return probleme;
}

/* ------------------------------------------------------------------------------------------------
 * Die Leiter selbst
 * ---------------------------------------------------------------------------------------------- */

export const STUFEN = 15;

/**
 * Was die Stufen wert sind, in Punkten.
 *
 * **Wachstum bewusst nur ungefähr verdoppelnd, Obergrenze 100.000 — keine Million.** Der Server
 * markiert ein Ergebnis als verdächtig, sobald es mehr als das Dreifache der bisherigen
 * Spielbestleistung beträgt (`spiel_ergebnis_melden`); ein Verdoppeln je Stufe bis zur Million hätte
 * jede zweite Bestleistung aus der Rangliste fallen lassen. Mit Faktor 1,3 bis 2 je Stufe braucht es
 * schon einen Sprung über drei Stufen, damit das passiert. Die Obergrenze steht außerdem in
 * `spiel_katalog.max_punkte` und im Duell (`p_punkte > 1000000` wird abgelehnt).
 */
export const PREISE: readonly number[] = [
  100, 200, 300, 500, 1_000, 1_500, 2_000, 3_000, 5_000, 7_500, 10_000, 15_000, 25_000, 50_000, 100_000,
];

/** Nach diesen Stufen (1 = erste Frage) ist der Gewinn sicher: Eine falsche Antwort wirft nur bis hierher zurück. */
export const SICHERE_STUFEN: readonly number[] = [5, 10];

/** Die Schwere der Frage an einer Stufe (0 = erste Frage): je drei Fragen eine Schwere. */
export function schwereAnStufe(stufe: number): 1 | 2 | 3 | 4 | 5 {
  return (Math.min(4, Math.max(0, Math.floor(stufe / 3))) + 1) as 1 | 2 | 3 | 4 | 5;
}

/** Der Gewinn, wenn man `erreicht` Fragen richtig beantwortet hat. */
export function gewinnNach(erreicht: number): number {
  if (erreicht <= 0) return 0;
  return PREISE[Math.min(erreicht, STUFEN) - 1]!;
}

/** Was von diesem Gewinn bei einer falschen Antwort bleibt: der der höchsten Sicherheitsstufe, die man erreicht hat. */
export function sichererGewinn(erreicht: number): number {
  let sicher = 0;
  for (const s of SICHERE_STUFEN) if (erreicht >= s) sicher = s;
  return gewinnNach(sicher);
}

/* --- Fragenauswahl ---------------------------------------------------------------------------- */

/**
 * Woran eine Frage als „dieselbe" erkannt wird: Fragetext **und** Antworten.
 *
 * Der Text allein genügt nicht — in Word Play lautet bei neunzig Rechtschreib-Wörtern die Frage immer
 * „Welches Wort ist richtig geschrieben?". Ein Ausschluss über den Text hätte nach dem ersten Wort alle
 * weiteren ausgesperrt, und die Sortierung hinge bei gleichem Text von der Dateireihenfolge ab.
 */
export function fragenSchluessel(f: LeiterFrage): string {
  return `${f.frage}|${[...f.antworten].sort().join('|')}`;
}

/**
 * `anzahl` Fragen einer Schwere für ein Level.
 *
 * Gleiche Levelnummer ergibt überall dieselben Fragen — sonst wäre das Duell wertlos. Der Pool wird
 * **einmal je Durchgang** gemischt und in Abschnitte geteilt (wie schon beim alten Quiz): Die Level
 * eines Durchgangs überschneiden sich garantiert nicht, erst danach fängt eine neue Mischung an.
 * Mehr Fragen im Pool verlängern den Durchgang von selbst.
 *
 * `ausgenommen` enthält `fragenSchluessel`-Werte bereits gestellter Fragen.
 */
export function fragenAusPool(
  pool: readonly LeiterFrage[],
  spiel: string,
  level: number,
  schwere: 1 | 2 | 3 | 4 | 5,
  anzahl: number,
  ausgenommen: ReadonlySet<string> = new Set(),
): LeiterFrage[] {
  // Nach Schlüssel sortiert, damit die Reihenfolge in den Dateien keine Rolle spielt.
  const passend = pool
    .filter((f) => f.schwere === schwere && !ausgenommen.has(fragenSchluessel(f)))
    .sort((a, b) => {
      const ka = fragenSchluessel(a);
      const kb = fragenSchluessel(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  if (passend.length === 0) return [];

  const abschnitte = Math.max(1, Math.floor(passend.length / anzahl));
  const nummer = Math.max(1, Math.floor(level)) - 1;
  const durchgang = Math.floor(nummer / abschnitte);
  const abschnitt = nummer % abschnitte;
  const gemischt = rng(saatAus(spiel, 'schwere', schwere, 'durchgang', durchgang)).mischen(passend);
  const ergebnis: LeiterFrage[] = [];
  // Zu kleiner Pool: von vorn auffüllen, statt abzustürzen. Die Tests verlangen einen ausreichenden Pool.
  for (let i = 0; i < anzahl; i++) ergebnis.push(gemischt[(abschnitt * anzahl + i) % gemischt.length]!);
  return ergebnis;
}

/**
 * Mischt die Antworten jeder Frage — je Level, aber für alle gleich.
 *
 * Die Fragen von Hand zu schreiben heißt, dass die richtige Antwort bei jedem Autor irgendwo
 * bevorzugt steht. Gemischt wird deterministisch aus der Saat, nicht mit `Math.random`: Beim Duell
 * müssen beide Spieler dieselbe Anordnung sehen.
 */
export function antwortenMischen(fragen: readonly LeiterFrage[], saat: number): LeiterFrage[] {
  return fragen.map((f, i) => {
    const reihenfolge = rng(saatAus(saat, 'antworten', i)).mischen([0, 1, 2, 3] as const);
    const antworten = reihenfolge.map((j) => f.antworten[j]!) as unknown as LeiterFrage['antworten'];
    return { ...f, antworten, richtig: reihenfolge.indexOf(f.richtig) as 0 | 1 | 2 | 3 };
  });
}

/* --- Joker ------------------------------------------------------------------------------------ */

export type JokerArt = 'halb' | 'publikum' | 'anruf';
export const JOKER_ARTEN: readonly JokerArt[] = ['halb', 'publikum', 'anruf'];

/**
 * Wie oft Publikum und Freund richtig liegen, je Schwere.
 *
 * Ein Joker, der immer stimmt, ist kein Joker, sondern eine Abkürzung — und einer, der nie stimmt,
 * wird nie benutzt. Bei leichten Fragen ist die Hilfe fast sicher, bei den schwersten ein Hinweis
 * mit echtem Risiko. Das Wahrscheinliche, nicht das Sichere.
 */
export const PUBLIKUM_TREFFER: readonly number[] = [0.97, 0.9, 0.78, 0.62, 0.45];
export const ANRUF_TREFFER: readonly number[] = [0.97, 0.88, 0.72, 0.55, 0.4];

/** Mit nur noch zwei Antworten liegt jede Hilfe öfter richtig. */
function mitHalb(treffer: number, nurNochZwei: boolean): number {
  return nurNochZwei ? Math.min(0.97, treffer + (1 - treffer) * 0.55) : treffer;
}

/** Wie groß der Spitzenwert im Publikum ist, je Schwere (von, bis in Prozent). */
const SPITZE: readonly (readonly [number, number])[] = [
  [70, 90],
  [55, 80],
  [45, 70],
  [38, 60],
  [32, 50],
];

/** Die beiden falschen Antworten, die 50:50 wegnimmt. Es bleiben die richtige und eine zufällig gewählte falsche. */
export function halbWeg(frage: LeiterFrage, saat: number): number[] {
  const falsche = [0, 1, 2, 3].filter((i) => i !== frage.richtig);
  const bleibt = rng(saat).waehlen(falsche);
  return falsche.filter((i) => i !== bleibt);
}

/**
 * Die Stimmen des Publikums in Prozent je Antwort. Ausgeblendete Antworten bekommen 0, der Rest
 * ergibt zusammen genau 100. Mal liegt die Mehrheit richtig, mal nicht (siehe `PUBLIKUM_TREFFER`).
 */
export function publikumsUrteil(frage: LeiterFrage, schwere: 1 | 2 | 3 | 4 | 5, weg: readonly number[], saat: number): number[] {
  const z = rng(saat);
  const frei = [0, 1, 2, 3].filter((i) => !weg.includes(i));
  const trifft = z.zahl() < mitHalb(PUBLIKUM_TREFFER[schwere - 1]!, frei.length <= 2);
  const spitzeIndex = trifft ? frage.richtig : z.waehlen(frei.filter((i) => i !== frage.richtig));
  const [von, bis] = SPITZE[schwere - 1]!;
  const spitze = frei.length <= 2 ? Math.max(von, 55) + z.ganzzahl(Math.max(1, bis + 10 - Math.max(von, 55))) : z.bereich(von, bis);

  const ergebnis = [0, 0, 0, 0];
  ergebnis[spitzeIndex] = spitze;
  const uebrige = frei.filter((i) => i !== spitzeIndex);
  let rest = 100 - spitze;
  // Zufällige Gewichte; keine andere Antwort darf die Spitze erreichen, sonst gäbe es keine Mehrheit.
  const gewichte = uebrige.map(() => 0.5 + z.zahl());
  const summe = gewichte.reduce((a, b) => a + b, 0);
  uebrige.forEach((i, k) => {
    ergebnis[i] = Math.floor((rest * gewichte[k]!) / summe);
  });
  rest -= uebrige.reduce((a, i) => a + ergebnis[i]!, 0);
  // Rundungsrest verteilen, ohne die Spitze zu überholen.
  for (let k = 0; rest > 0; k = (k + 1) % uebrige.length) {
    const i = uebrige[k]!;
    if (ergebnis[i]! < spitze - 1) {
      ergebnis[i]!++;
      rest--;
    } else if (uebrige.every((j) => ergebnis[j]! >= spitze - 1)) {
      ergebnis[spitzeIndex]! += rest;
      rest = 0;
    }
  }
  // Wer zu hoch kam (kleine Spitze, großes Gewicht), gibt an die anderen ab.
  for (let runde = 0; runde < 200; runde++) {
    const zuHoch = uebrige.find((i) => ergebnis[i]! >= ergebnis[spitzeIndex]!);
    if (zuHoch === undefined) break;
    ergebnis[zuHoch]!--;
    ergebnis[spitzeIndex]!++;
  }
  return ergebnis;
}

export type Sicherheit = 'sehr' | 'eher' | 'kaum';

/** Der Tipp des Freundes und wie sicher er klingt. Die Sicherheit sagt **nicht**, ob er recht hat. */
export type AnrufUrteil = { tipp: number; sicher: Sicherheit };

export function anrufUrteil(frage: LeiterFrage, schwere: 1 | 2 | 3 | 4 | 5, weg: readonly number[], saat: number): AnrufUrteil {
  const z = rng(saat);
  const frei = [0, 1, 2, 3].filter((i) => !weg.includes(i));
  const trifft = z.zahl() < mitHalb(ANRUF_TREFFER[schwere - 1]!, frei.length <= 2);
  const tipp = trifft ? frage.richtig : z.waehlen(frei.filter((i) => i !== frage.richtig));
  // Leichte Fragen klingen sicher, schwere eher zögerlich — aber nicht deterministisch: Ein Freund,
  // der sich bei einer schweren Frage trotzdem „sehr sicher" ist, ist genau die gefährliche Stelle.
  const wurf = z.zahl() + (schwere - 3) * 0.12;
  const sicher: Sicherheit = wurf < 0.45 ? 'sehr' : wurf < 0.8 ? 'eher' : 'kaum';
  return { tipp, sicher };
}

/* --- Ablauf einer Runde ----------------------------------------------------------------------- */

export type Ausgang = 'richtig' | 'falsch' | 'aufgehoert';

export type Zustand = {
  level: number;
  /** Die fünfzehn Fragen, Antworten schon gemischt. */
  fragen: readonly LeiterFrage[];
  saat: number;
  /** Aktuelle Frage, 0-basiert. */
  stufe: number;
  /** Wie viele Fragen richtig beantwortet wurden. */
  erreicht: number;
  /** Angetippte, noch nicht endgültige Antwort. */
  markiert: number | null;
  /** Die Antwort ist endgültig gegeben, die Auflösung steht noch aus. */
  eingeloggt: boolean;
  /** Das Ergebnis der Frage ist sichtbar. */
  aufgeloest: boolean;
  ausgang: Ausgang | null;
  /** Welche Joker noch zu haben sind. */
  joker: Readonly<Record<JokerArt, boolean>>;
  /** Von 50:50 ausgeblendete Antworten der aktuellen Frage. */
  weg: readonly number[];
  publikum: readonly number[] | null;
  anruf: AnrufUrteil | null;
  vorbei: boolean;
  gewonnen: boolean;
};

export function neueRunde(level: number, spiel: string, fragen: readonly LeiterFrage[]): Zustand {
  const saat = saatAus(spiel, 'runde', level);
  return {
    level,
    fragen: antwortenMischen(fragen, saat),
    saat,
    stufe: 0,
    erreicht: 0,
    markiert: null,
    eingeloggt: false,
    aufgeloest: false,
    ausgang: null,
    joker: { halb: true, publikum: true, anruf: true },
    weg: [],
    publikum: null,
    anruf: null,
    vorbei: false,
    gewonnen: false,
  };
}

/** Der Gewinn, der gerade auf dem Tisch liegt — und am Ende die Punktzahl der Runde. */
export function punkte(z: Zustand): number {
  // Eine falsche Antwort wirft auf die Sicherheitsstufe zurück; vorher zählt, was man schon hat.
  if (z.ausgang === 'falsch') return sichererGewinn(z.erreicht);
  return gewinnNach(z.erreicht);
}

/** Was eine falsche Antwort jetzt kosten würde: der Gewinn, der bliebe. */
export function sicherJetzt(z: Zustand): number {
  return sichererGewinn(z.erreicht);
}

const offen = (z: Zustand) => !z.vorbei && !z.eingeloggt && !z.aufgeloest;

export function markieren(z: Zustand, index: number): Zustand {
  if (!offen(z) || ![0, 1, 2, 3].includes(index) || z.weg.includes(index)) return z;
  if (z.markiert === index) return z;
  return { ...z, markiert: index };
}

export function einloggen(z: Zustand): Zustand {
  if (!offen(z) || z.markiert === null) return z;
  return { ...z, eingeloggt: true };
}

export function aufloesen(z: Zustand): Zustand {
  if (z.vorbei || !z.eingeloggt || z.aufgeloest || z.markiert === null) return z;
  const frage = z.fragen[z.stufe]!;
  const richtig = z.markiert === frage.richtig;
  return {
    ...z,
    aufgeloest: true,
    ausgang: richtig ? 'richtig' : 'falsch',
    erreicht: z.erreicht + (richtig ? 1 : 0),
    gewonnen: richtig && z.stufe === STUFEN - 1,
  };
}

/** Man darf erst aufhören, wenn schon etwas zu behalten ist — bei null wäre es nur ein versehentliches Ende. */
export function darfAufhoeren(z: Zustand): boolean {
  return offen(z) && z.erreicht > 0;
}

export function aufhoeren(z: Zustand): Zustand {
  if (!darfAufhoeren(z)) return z;
  return { ...z, aufgeloest: true, ausgang: 'aufgehoert' };
}

export function weiter(z: Zustand): Zustand {
  if (z.vorbei || !z.aufgeloest) return z;
  if (z.ausgang !== 'richtig' || z.stufe >= STUFEN - 1) return { ...z, vorbei: true };
  return {
    ...z,
    stufe: z.stufe + 1,
    markiert: null,
    eingeloggt: false,
    aufgeloest: false,
    ausgang: null,
    weg: [],
    publikum: null,
    anruf: null,
  };
}

export function jokerFrei(z: Zustand, art: JokerArt): boolean {
  return offen(z) && z.joker[art];
}

export function jokerNutzen(z: Zustand, art: JokerArt): Zustand {
  if (!jokerFrei(z, art)) return z;
  const frage = z.fragen[z.stufe]!;
  const schwere = schwereAnStufe(z.stufe);
  const saat = saatAus(z.saat, 'joker', art, z.stufe);
  const verbraucht = { ...z.joker, [art]: false };
  if (art === 'halb') {
    const weg = halbWeg(frage, saat);
    return { ...z, joker: verbraucht, weg, markiert: z.markiert !== null && weg.includes(z.markiert) ? null : z.markiert };
  }
  if (art === 'publikum') return { ...z, joker: verbraucht, publikum: publikumsUrteil(frage, schwere, z.weg, saat) };
  return { ...z, joker: verbraucht, anruf: anrufUrteil(frage, schwere, z.weg, saat) };
}
