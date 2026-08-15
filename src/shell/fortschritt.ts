import { sterne, type Sternzahl } from './sterne';
import { LEERER_TAG, tagesstandBereinigen, type Tagesstand } from './herausforderungen';

/**
 * Fortschritt: Erfahrung, Stufe, Statistik, Serien, Erfolge.
 *
 * ## Warum das hier liegt und nicht in den Spielen
 *
 * An `GameApi`/`GameProps` hängen zwanzig fertige, geprüfte Spiele. Die
 * Schnittstelle ist in der ganzen Projektgeschichte **zweimal** erweitert
 * worden, und beide Male war es unvermeidbar. Für Erfahrungspunkte ist es
 * das nicht: Die Hülle weiß ohnehin, wann eine Runde endet, wie viele Punkte
 * es gab und ob gewonnen wurde. Daraus lässt sich alles hier ableiten —
 * **ohne ein einziges Spiel anzufassen.**
 *
 * ## Warum Erfahrung nicht aus Punkten kommt
 *
 * Dieselbe Falle wie bei den Sternen: Die Punkteskalen sind unvergleichbar.
 * Quiz Time geht von 0 bis 10, Block Burst in die Tausende. Gäbe es
 * Erfahrung je Punkt, wäre Block Burst hundertmal so viel wert wie Quiz
 * Time, und die Stufe sagte nur noch aus, *welches* Spiel jemand spielt.
 *
 * Erfahrung kommt deshalb aus Dingen, die in jedem Spiel dasselbe bedeuten:
 * eine Runde gespielt, wie gut sie im Vergleich zur **eigenen** Bestleistung
 * war (das rechnen die Sterne schon aus), ein echter Sieg, eine neue
 * Bestleistung, ein zum ersten Mal ausprobiertes Spiel.
 *
 * ## Keine Uhr in diesem Modul
 *
 * Jede Funktion bekommt den Tag als Zeichenkette gereicht. Ein `new Date()`
 * mittendrin wäre nicht prüfbar — und ausgerechnet die Serienzählung („fünf
 * Tage hintereinander") lässt sich sonst überhaupt nicht testen, ohne die
 * Systemuhr zu verstellen.
 */

// ---------------------------------------------------------------------
// Erfahrung und Stufen
// ---------------------------------------------------------------------

/** Grundbetrag fürs Mitspielen — jede beendete Runde ist etwas wert. */
const XP_RUNDE = 10;
/** Je Stern zusätzlich. Ein Stern ist bereits an der eigenen Bestleistung gemessen. */
const XP_JE_STERN = 10;
/** Für einen echten Sieg (gelöstes Rätsel, gewonnene Partie). */
const XP_SIEG = 15;
/** Für eine neue persönliche Bestleistung. */
const XP_BESTLEISTUNG = 25;
/** Für ein Spiel, das zum ersten Mal gespielt wird. */
const XP_NEUES_SPIEL = 50;

/**
 * Wie viel Erfahrung der Sprung **von** dieser Stufe zur nächsten kostet.
 *
 * Bewusst linear steigend statt exponentiell: Die ersten Stufen kommen
 * schnell (Stufe 2 nach zwei bis drei Runden), danach wird der Abstand
 * gleichmäßig größer. Eine Verdopplung je Stufe sähe nach kurzer Zeit so
 * aus, als ginge gar nichts mehr — bei einem Kind ist das der Moment, in
 * dem der Balken aufhört, etwas zu bedeuten.
 */
export function xpFuerStufe(stufe: number): number {
  return 100 + Math.max(0, stufe - 1) * 50;
}

export type Stufenstand = {
  stufe: number;
  /** Erfahrung innerhalb der laufenden Stufe. */
  imLevel: number;
  /** Erfahrung, die diese Stufe insgesamt braucht. */
  fuerLevel: number;
  /** 0 bis 1 — für den Balken. */
  anteil: number;
};

/** Rechnet gesammelte Erfahrung in Stufe und Balkenstand um. */
export function stufeAus(xp: number): Stufenstand {
  let stufe = 1;
  let rest = Math.max(0, Math.floor(xp));
  // Deckel gegen Endlosschleifen bei absurden Werten; Stufe 200 erreicht
  // niemand, aber eine kaputte gespeicherte Zahl darf die App nicht aufhängen.
  while (stufe < 200 && rest >= xpFuerStufe(stufe)) {
    rest -= xpFuerStufe(stufe);
    stufe += 1;
  }
  const fuerLevel = xpFuerStufe(stufe);
  return { stufe, imLevel: rest, fuerLevel, anteil: Math.min(1, rest / fuerLevel) };
}

// ---------------------------------------------------------------------
// Der gespeicherte Stand
// ---------------------------------------------------------------------

export type SpielStatistik = {
  partien: number;
  siege: number;
  bestwert: number;
  /** Die beste je erreichte Sternzahl in diesem Spiel. */
  besteSterne: number;
};

export type Fortschritt = {
  xp: number;
  partien: number;
  siege: number;
  /** Tage hintereinander gespielt. */
  serie: number;
  laengsteSerie: number;
  /** Der letzte Tag mit einer Runde, als `JJJJ-MM-TT`. */
  letzterTag: string;
  jeSpiel: Record<string, SpielStatistik>;
  /** Die ids der bereits freigeschalteten Erfolge. */
  erfolge: string[];
  /**
   * Der Stand der heutigen Tagesaufgaben.
   *
   * Liegt bewusst **im** Fortschritt und nicht in einem eigenen Schlüssel:
   * Beides wird zusammen gespeichert, zusammen bereinigt und von
   * „alle Punktestände löschen" zusammen weggeräumt. Zwei Schlüssel, die
   * immer gemeinsam angefasst werden, sind eine Fehlerquelle ohne Gewinn.
   */
  tages: Tagesstand;
};

export const LEERER_FORTSCHRITT: Fortschritt = {
  xp: 0,
  partien: 0,
  siege: 0,
  serie: 0,
  laengsteSerie: 0,
  letzterTag: '',
  jeSpiel: {},
  erfolge: [],
  tages: LEERER_TAG,
};

/**
 * Macht aus irgendetwas Gespeichertem einen gültigen Fortschritt.
 *
 * Der Speicher ist nicht vertrauenswürdig: Er kann aus einer älteren Fassung
 * stammen, von Hand verändert oder halb geschrieben worden sein. Ein
 * fehlendes Feld darf die Startseite nicht weiß werden lassen.
 */
export function fortschrittBereinigen(roh: unknown): Fortschritt {
  const q = (roh ?? {}) as Partial<Fortschritt>;
  const zahl = (wert: unknown) =>
    typeof wert === 'number' && Number.isFinite(wert) && wert >= 0 ? Math.floor(wert) : 0;

  const jeSpiel: Record<string, SpielStatistik> = {};
  const roheSpiele = (q.jeSpiel ?? {}) as Record<string, Partial<SpielStatistik>>;
  if (typeof roheSpiele === 'object' && roheSpiele !== null) {
    for (const [id, s] of Object.entries(roheSpiele)) {
      jeSpiel[id] = {
        partien: zahl(s?.partien),
        siege: zahl(s?.siege),
        bestwert: zahl(s?.bestwert),
        besteSterne: Math.min(3, zahl(s?.besteSterne)),
      };
    }
  }

  return {
    xp: zahl(q.xp),
    partien: zahl(q.partien),
    siege: zahl(q.siege),
    serie: zahl(q.serie),
    laengsteSerie: zahl(q.laengsteSerie),
    letzterTag: typeof q.letzterTag === 'string' ? q.letzterTag : '',
    jeSpiel,
    erfolge: Array.isArray(q.erfolge) ? q.erfolge.filter((e) => typeof e === 'string') : [],
    tages: tagesstandBereinigen(q.tages),
  };
}

// ---------------------------------------------------------------------
// Serien
// ---------------------------------------------------------------------

/** Der Tag vor `tag`, beide als `JJJJ-MM-TT`. */
function tagDavor(tag: string): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Die neue Seriennummer.
 *
 * Mittag als Uhrzeit ist Absicht: Mit `T00:00:00Z` kippt die Rechnung in
 * Zeitzonen westlich von Greenwich um einen Tag, und aus „gestern gespielt"
 * würde „vorgestern" — die Serie risse ohne Grund.
 */
export function serieFortschreiben(vorher: Fortschritt, tag: string): number {
  if (vorher.letzterTag === tag) return Math.max(1, vorher.serie);
  if (vorher.letzterTag === tagDavor(tag)) return vorher.serie + 1;
  return 1;
}

// ---------------------------------------------------------------------
// Erfolge
// ---------------------------------------------------------------------

export type Erfolg = {
  id: string;
  titel: string;
  beschreibung: string;
  symbol: string;
};

/**
 * Die Erfolge und ihre Bedingungen.
 *
 * Alle prüfen gegen Dinge, die in **jedem** Spiel dasselbe bedeuten —
 * Runden, Siege, Sterne, ausprobierte Spiele, Tage. Ein Erfolg wie
 * „10.000 Punkte" wäre in Block Burst eine Fingerübung und in Quiz Time
 * unerreichbar.
 */
type ErfolgRegel = Erfolg & {
  erfuellt: (f: Fortschritt, spieleGesamt: number) => boolean;
};

const REGELN: readonly ErfolgRegel[] = [
  {
    id: 'erste-runde',
    titel: 'Losgelegt',
    beschreibung: 'Die erste Runde gespielt.',
    symbol: '🎮',
    erfuellt: (f) => f.partien >= 1,
  },
  {
    id: 'zehn-partien',
    titel: 'Warmgelaufen',
    beschreibung: '10 Runden gespielt.',
    symbol: '🔁',
    erfuellt: (f) => f.partien >= 10,
  },
  {
    id: 'fuenfzig-partien',
    titel: 'Stammspieler',
    beschreibung: '50 Runden gespielt.',
    symbol: '🕹️',
    erfuellt: (f) => f.partien >= 50,
  },
  {
    id: 'hundert-partien',
    titel: 'Dauergast',
    beschreibung: '100 Runden gespielt.',
    symbol: '🏅',
    erfuellt: (f) => f.partien >= 100,
  },
  {
    id: 'erster-sieg',
    titel: 'Erster Sieg',
    beschreibung: 'Zum ersten Mal gewonnen.',
    symbol: '🏆',
    erfuellt: (f) => f.siege >= 1,
  },
  {
    id: 'zehn-siege',
    titel: 'Seriensieger',
    beschreibung: '10-mal gewonnen.',
    symbol: '👑',
    erfuellt: (f) => f.siege >= 10,
  },
  {
    id: 'drei-sterne',
    titel: 'Volle Punktzahl',
    beschreibung: 'In einem Spiel drei Sterne geholt.',
    symbol: '⭐',
    erfuellt: (f) => Object.values(f.jeSpiel).some((s) => s.besteSterne >= 3),
  },
  {
    id: 'drei-sterne-fuenf',
    titel: 'Sternesammler',
    beschreibung: 'In fünf Spielen drei Sterne geholt.',
    symbol: '🌟',
    erfuellt: (f) => Object.values(f.jeSpiel).filter((s) => s.besteSterne >= 3).length >= 5,
  },
  {
    id: 'fuenf-spiele',
    titel: 'Neugierig',
    beschreibung: 'Fünf verschiedene Spiele ausprobiert.',
    symbol: '🔎',
    erfuellt: (f) => Object.keys(f.jeSpiel).length >= 5,
  },
  {
    id: 'alle-spiele',
    titel: 'Alles ausprobiert',
    beschreibung: 'Jedes Spiel einmal gespielt.',
    symbol: '🗺️',
    erfuellt: (f, gesamt) => gesamt > 0 && Object.keys(f.jeSpiel).length >= gesamt,
  },
  {
    id: 'serie-3',
    titel: 'Drei Tage am Stück',
    beschreibung: 'An drei Tagen hintereinander gespielt.',
    symbol: '🔥',
    erfuellt: (f) => f.laengsteSerie >= 3,
  },
  {
    id: 'serie-7',
    titel: 'Eine ganze Woche',
    beschreibung: 'An sieben Tagen hintereinander gespielt.',
    symbol: '☄️',
    erfuellt: (f) => f.laengsteSerie >= 7,
  },
  {
    id: 'stufe-5',
    titel: 'Stufe 5',
    beschreibung: 'Stufe 5 erreicht.',
    symbol: '🥉',
    erfuellt: (f) => stufeAus(f.xp).stufe >= 5,
  },
  {
    id: 'stufe-10',
    titel: 'Stufe 10',
    beschreibung: 'Stufe 10 erreicht.',
    symbol: '🥈',
    erfuellt: (f) => stufeAus(f.xp).stufe >= 10,
  },
  {
    id: 'stufe-20',
    titel: 'Stufe 20',
    beschreibung: 'Stufe 20 erreicht.',
    symbol: '🥇',
    erfuellt: (f) => stufeAus(f.xp).stufe >= 20,
  },
];

/** Alle Erfolge, in Anzeigereihenfolge — auch die noch verschlossenen. */
export const ALLE_ERFOLGE: readonly Erfolg[] = REGELN.map(
  ({ id, titel, beschreibung, symbol }) => ({ id, titel, beschreibung, symbol }),
);

export function erfolgFinden(id: string): Erfolg | undefined {
  return ALLE_ERFOLGE.find((e) => e.id === id);
}

// ---------------------------------------------------------------------
// Eine Runde verbuchen
// ---------------------------------------------------------------------

export type Runde = {
  spielId: string;
  punkte: number;
  gewonnen: boolean;
  /** Die Bestleistung **vor** dieser Runde — daraus kommen die Sterne. */
  bestwertVorher: number;
  /** `JJJJ-MM-TT`. Wird gereicht, damit dieses Modul ohne Uhr auskommt. */
  tag: string;
};

export type Ausbeute = {
  nachher: Fortschritt;
  /** Wie viel Erfahrung diese eine Runde gebracht hat. */
  xpGewinn: number;
  sterne: Sternzahl;
  /** Gesetzt, wenn die Runde eine Stufe gehoben hat. */
  neueStufe?: number;
  /** Erfolge, die **durch diese Runde** dazugekommen sind. */
  neueErfolge: Erfolg[];
  /** Ob die Runde eine neue persönliche Bestleistung war. */
  bestleistung: boolean;
};

/**
 * Verbucht eine beendete Runde und sagt, was sie eingebracht hat.
 *
 * Rein: kein Speicher, keine Uhr, kein Zufall. Der Aufrufer speichert
 * `nachher` und feiert, was in `neueStufe` und `neueErfolge` steht.
 */
export function rundeVerbuchen(
  vorher: Fortschritt,
  runde: Runde,
  spieleGesamt: number,
): Ausbeute {
  const stufeVorher = stufeAus(vorher.xp).stufe;
  const alt = vorher.jeSpiel[runde.spielId];
  const erstesMal = !alt || alt.partien === 0;
  const punkte = Math.max(0, Math.floor(runde.punkte));

  const sternzahl = sterne(punkte, runde.bestwertVorher, runde.gewonnen);
  const bestleistung = punkte > runde.bestwertVorher && punkte > 0;

  const xpGewinn =
    XP_RUNDE +
    sternzahl * XP_JE_STERN +
    (runde.gewonnen ? XP_SIEG : 0) +
    (bestleistung ? XP_BESTLEISTUNG : 0) +
    (erstesMal ? XP_NEUES_SPIEL : 0);

  const serie = serieFortschreiben(vorher, runde.tag);

  const zwischen: Fortschritt = {
    xp: vorher.xp + xpGewinn,
    partien: vorher.partien + 1,
    siege: vorher.siege + (runde.gewonnen ? 1 : 0),
    serie,
    laengsteSerie: Math.max(vorher.laengsteSerie, serie),
    letzterTag: runde.tag,
    jeSpiel: {
      ...vorher.jeSpiel,
      [runde.spielId]: {
        partien: (alt?.partien ?? 0) + 1,
        siege: (alt?.siege ?? 0) + (runde.gewonnen ? 1 : 0),
        bestwert: Math.max(alt?.bestwert ?? 0, punkte),
        besteSterne: Math.max(alt?.besteSterne ?? 0, sternzahl),
      },
    },
    erfolge: vorher.erfolge,
    // Die Tagesaufgaben führt `herausforderungen.ts`. Hier wird der Stand
    // nur durchgereicht, damit dieses Modul nichts über sie wissen muss.
    tages: vorher.tages,
  };

  /*
   * Erfolge werden **nach** dem Verbuchen geprüft, gegen den neuen Stand.
   * Andersherum hinkte jeder Erfolg eine Runde hinterher: Die zehnte Partie
   * würde „Warmgelaufen" erst bei der elften auslösen.
   */
  const schonDa = new Set(vorher.erfolge);
  const neueErfolge = REGELN.filter(
    (r) => !schonDa.has(r.id) && r.erfuellt(zwischen, spieleGesamt),
  ).map(({ id, titel, beschreibung, symbol }) => ({ id, titel, beschreibung, symbol }));

  const nachher: Fortschritt = {
    ...zwischen,
    erfolge: [...vorher.erfolge, ...neueErfolge.map((e) => e.id)],
  };

  const stufeNachher = stufeAus(nachher.xp).stufe;

  return {
    nachher,
    xpGewinn,
    sterne: sternzahl,
    ...(stufeNachher > stufeVorher ? { neueStufe: stufeNachher } : {}),
    neueErfolge,
    bestleistung,
  };
}

/** Der heutige Tag als `JJJJ-MM-TT`. Die einzige Stelle mit Uhr. */
export function heute(jetzt: Date = new Date()): string {
  // Ortszeit, nicht UTC: Wer abends um 23 Uhr spielt, hat *heute* gespielt.
  const j = jetzt.getFullYear();
  const m = String(jetzt.getMonth() + 1).padStart(2, '0');
  const t = String(jetzt.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}
