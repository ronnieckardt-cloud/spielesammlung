import { rng, saatAus } from '../core/rng';
import type { Sternzahl } from './sterne';

/**
 * Tagesaufgaben — drei kleine Ziele, jeden Tag neue.
 *
 * ## Warum das die richtige Art von Spieltiefe ist
 *
 * Der naheliegende Griff wäre gewesen, jedem Spiel Schwierigkeitsstufen zu
 * verpassen. Nachgesehen: **Fast jedes Spiel hat längst eine.** Quiz Time,
 * Word Play, Brain Blitz, Color Pour, Pair Up, Blade Toss, Box Push, Even
 * Cut und Flow Link steigern sich über die Levelnummer; Snake Rush, Block
 * Burst, Line Fall, Ghost Chase, Ring Rise, Bubble Pop und Dash City werden
 * im Lauf einer Runde schwerer; Drop Four und Tap Rush lassen sogar direkt
 * wählen. Ein aufgesetzter Stufenschalter hätte in zwanzig Spielen die
 * Bestenlisten zerteilt (ein Ergebnis auf „leicht" ist mit einem auf
 * „schwer" nicht vergleichbar) und dafür kaum etwas hinzugefügt.
 *
 * Was wirklich fehlte, ist ein **Grund, heute zu spielen** — und zwar einer,
 * der über alle Spiele hinweg gilt. Genau das sind Tagesaufgaben.
 *
 * ## Kein Spiel weiß davon
 *
 * Alle sechs Aufgabenarten lassen sich aus dem ableiten, was die Hülle am
 * Rundenende ohnehin kennt: welches Spiel, wie viele Sterne, gewonnen oder
 * nicht, neue Bestleistung oder nicht. Damit bleibt die Schnittstelle
 * unangetastet — wie schon bei Erfahrung und Erfolgen.
 *
 * ## Gleiche Aufgaben für alle, ohne Server
 *
 * Die Auswahl kommt aus dem **Datum** als Saat. Dadurch hat jeder am selben
 * Tag dieselben drei Aufgaben, ohne dass irgendetwas abgestimmt werden
 * müsste — und morgen sind es andere. Ein Server wäre dafür nicht nur
 * unnötig, er würde das Offline-Versprechen brechen.
 */

export type AufgabenArt =
  | 'runden'
  | 'sterne'
  | 'verschiedene'
  | 'sieg'
  | 'bestleistung'
  | 'spiel';

export type Aufgabe = {
  /** Stabil je Tag — daran hängt, was schon erledigt ist. */
  id: string;
  art: AufgabenArt;
  text: string;
  symbol: string;
  ziel: number;
  xp: number;
  /** Nur bei `art: 'spiel'`. */
  spielId?: string;
};

/** Was heute schon zusammengekommen ist. */
export type Tagesstand = {
  /** `JJJJ-MM-TT`. Stimmt er nicht mit heute überein, fängt der Tag neu an. */
  tag: string;
  runden: number;
  sterne: number;
  siege: number;
  bestleistungen: number;
  /** Die heute gespielten Spiele, jedes einmal. */
  spieleHeute: string[];
  /** Aufgaben-ids, die schon belohnt wurden. */
  erledigt: string[];
};

export const LEERER_TAG: Tagesstand = {
  tag: '',
  runden: 0,
  sterne: 0,
  siege: 0,
  bestleistungen: 0,
  spieleHeute: [],
  erledigt: [],
};

export function tagesstandBereinigen(roh: unknown): Tagesstand {
  const q = (roh ?? {}) as Partial<Tagesstand>;
  const zahl = (w: unknown) =>
    typeof w === 'number' && Number.isFinite(w) && w >= 0 ? Math.floor(w) : 0;
  return {
    tag: typeof q.tag === 'string' ? q.tag : '',
    runden: zahl(q.runden),
    sterne: zahl(q.sterne),
    siege: zahl(q.siege),
    bestleistungen: zahl(q.bestleistungen),
    spieleHeute: Array.isArray(q.spieleHeute)
      ? [...new Set(q.spieleHeute.filter((s) => typeof s === 'string'))]
      : [],
    erledigt: Array.isArray(q.erledigt) ? q.erledigt.filter((s) => typeof s === 'string') : [],
  };
}

// ---------------------------------------------------------------------
// Die Aufgaben eines Tages
// ---------------------------------------------------------------------

type Vorlage = {
  art: AufgabenArt;
  symbol: string;
  /** Mögliche Ziele. Eines davon wird aus der Tagessaat gewählt. */
  ziele: readonly number[];
  /** Erfahrung je Ziel, gleiche Reihenfolge wie `ziele`. */
  xp: readonly number[];
  text: (ziel: number) => string;
};

/*
 * Die erste Vorlage ist **immer** dabei (siehe unten). Sie ist die einzige,
 * die sich durch bloßes Spielen erledigt — ohne sie könnte ein Tag drei
 * Aufgaben bringen, von denen keine sicher zu schaffen ist, und dann ist
 * das Ganze eher Frust als Anreiz.
 */
const IMMER: Vorlage = {
  art: 'runden',
  symbol: '🎮',
  ziele: [3, 4, 5],
  xp: [30, 40, 50],
  text: (z) => `Spiele ${z} Runden`,
};

const AUSWAHL: readonly Vorlage[] = [
  {
    art: 'sterne',
    symbol: '⭐',
    ziele: [4, 6, 8],
    xp: [40, 55, 70],
    text: (z) => `Sammle ${z} Sterne`,
  },
  {
    art: 'verschiedene',
    symbol: '🎲',
    ziele: [2, 3, 4],
    xp: [35, 50, 65],
    text: (z) => `Spiele ${z} verschiedene Spiele`,
  },
  {
    art: 'sieg',
    symbol: '🏆',
    ziele: [1, 2],
    xp: [45, 70],
    text: (z) => (z === 1 ? 'Gewinne eine Runde' : `Gewinne ${z} Runden`),
  },
  {
    art: 'bestleistung',
    symbol: '📈',
    ziele: [1, 2],
    xp: [50, 80],
    text: (z) =>
      z === 1 ? 'Stell eine neue Bestleistung auf' : `Stell ${z} neue Bestleistungen auf`,
  },
];

export type SpielAngabe = { id: string; title: string };

/**
 * Die drei Aufgaben für einen Tag.
 *
 * Deterministisch aus dem Datum: gleicher Tag → gleiche Aufgaben, überall.
 * Ein Test prüft genau das, denn ohne diese Eigenschaft wäre der Fortschritt
 * am nächsten Laden plötzlich einer anderen Aufgabe zugeordnet.
 */
export function tagesaufgaben(tag: string, spiele: readonly SpielAngabe[]): Aufgabe[] {
  const zufall = rng(saatAus('tagesaufgabe', tag));

  const bauen = (v: Vorlage, nummer: number): Aufgabe => {
    const i = zufall.ganzzahl(v.ziele.length);
    const ziel = v.ziele[i]!;
    return {
      id: `${tag}:${v.art}:${nummer}`,
      art: v.art,
      symbol: v.symbol,
      ziel,
      xp: v.xp[i]!,
      text: v.text(ziel),
    };
  };

  const aufgaben: Aufgabe[] = [bauen(IMMER, 0)];

  // Zwei weitere, ohne Wiederholung.
  const rest = [...AUSWAHL];
  for (let n = 1; n <= 2 && rest.length > 0; n++) {
    const [vorlage] = rest.splice(zufall.ganzzahl(rest.length), 1);
    aufgaben.push(bauen(vorlage!, n));
  }

  /*
   * Eine der beiden wird zu „spiele ein bestimmtes Spiel", wenn der Würfel
   * es so will. Das ist die einzige Aufgabe, die auf ein Spiel zeigt — sie
   * schickt einen in Ecken der Sammlung, in die man von allein nie geht,
   * und genau darum geht es bei zwanzig Spielen.
   */
  if (spiele.length > 0 && zufall.zahl() < 0.5) {
    const spiel = zufall.waehlen(spiele);
    aufgaben[2] = {
      id: `${tag}:spiel:2`,
      art: 'spiel',
      symbol: '🎯',
      ziel: 1,
      xp: 45,
      text: `Spiele eine Runde ${spiel.title}`,
      spielId: spiel.id,
    };
  }

  return aufgaben;
}

// ---------------------------------------------------------------------
// Fortschritt
// ---------------------------------------------------------------------

/** Wie weit eine Aufgabe heute gediehen ist. */
export function standFuer(stand: Tagesstand, aufgabe: Aufgabe): number {
  switch (aufgabe.art) {
    case 'runden':
      return stand.runden;
    case 'sterne':
      return stand.sterne;
    case 'verschiedene':
      return stand.spieleHeute.length;
    case 'sieg':
      return stand.siege;
    case 'bestleistung':
      return stand.bestleistungen;
    case 'spiel':
      return aufgabe.spielId && stand.spieleHeute.includes(aufgabe.spielId) ? 1 : 0;
  }
}

export function istGeschafft(stand: Tagesstand, aufgabe: Aufgabe): boolean {
  return standFuer(stand, aufgabe) >= aufgabe.ziel;
}

export type Runde = {
  spielId: string;
  gewonnen: boolean;
  sterne: Sternzahl;
  bestleistung: boolean;
};

export type Tagesausbeute = {
  stand: Tagesstand;
  /** Aufgaben, die **durch diese Runde** fertig geworden sind. */
  fertig: Aufgabe[];
  /** Erfahrung aus diesen Aufgaben. */
  xp: number;
};

/**
 * Verbucht eine Runde für den heutigen Tag.
 *
 * Der Tageswechsel passiert **hier** und nicht beim Lesen: Sonst müsste
 * jede anzeigende Stelle daran denken, und eine, die es vergisst, zeigt
 * gestrige Zahlen unter heutigen Aufgaben.
 */
export function rundeVerbuchen(
  vorher: Tagesstand,
  aufgaben: readonly Aufgabe[],
  runde: Runde,
  tag: string,
): Tagesausbeute {
  // Neuer Tag: alles auf null. `erledigt` ausdrücklich mit — die Aufgaben
  // von heute haben andere ids, aber eine wachsende Liste über Monate
  // hinweg wäre schlicht Müll im Speicher.
  const basis = vorher.tag === tag ? vorher : { ...LEERER_TAG, tag };

  const stand: Tagesstand = {
    tag,
    runden: basis.runden + 1,
    sterne: basis.sterne + runde.sterne,
    siege: basis.siege + (runde.gewonnen ? 1 : 0),
    bestleistungen: basis.bestleistungen + (runde.bestleistung ? 1 : 0),
    spieleHeute: basis.spieleHeute.includes(runde.spielId)
      ? basis.spieleHeute
      : [...basis.spieleHeute, runde.spielId],
    erledigt: basis.erledigt,
  };

  const schonDa = new Set(basis.erledigt);
  const fertig = aufgaben.filter((a) => !schonDa.has(a.id) && istGeschafft(stand, a));

  return {
    stand: { ...stand, erledigt: [...basis.erledigt, ...fertig.map((a) => a.id)] },
    fertig,
    xp: fertig.reduce((s, a) => s + a.xp, 0),
  };
}

/**
 * Der Stand für die Anzeige, auf den heutigen Tag gebracht.
 *
 * Ohne das zeigte die Startseite morgens noch die Zähler von gestern unter
 * den Aufgaben von heute — jede Aufgabe sähe halb erledigt aus.
 */
export function standFuerHeute(gespeichert: Tagesstand, tag: string): Tagesstand {
  return gespeichert.tag === tag ? gespeichert : { ...LEERER_TAG, tag };
}
