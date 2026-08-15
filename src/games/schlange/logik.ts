/**
 * Snake Rush — reine Spiellogik, ohne Anzeige.
 *
 * Die Schlange bewegt sich kachelweise über ein Raster. Jeder Bissen Futter
 * verlängert sie um ein Glied und beschleunigt sie ein wenig. Berührt sie
 * sich selbst, ist die Runde vorbei; an den Rändern läuft sie auf der
 * anderen Seite weiter (das ist gnädiger und macht mehr Spaß als ein
 * sofortiges Aus).
 */

import { schritt } from '../../core/rng';

export const BREITE = 17;
export const HOEHE = 17;

/** Startlänge der Schlange, inklusive Kopf. */
export const START_LAENGE = 3;

export const PUNKTE_JE_FUTTER = 10;
/** Zusatzpunkte für jedes Goldstück (seltener, verschwindet wieder). */
export const PUNKTE_GOLD = 50;

/** Sekunden je Feld am Anfang — je kleiner, desto schneller. */
export const TAKT_START_S = 0.22;
/** Schnellster Takt, den das Spiel je erreicht. */
export const TAKT_MIN_S = 0.08;
/** Um so viel wird pro Futter beschleunigt. */
export const TAKT_STUFE_S = 0.006;

/** Wie viele Schritte ein Goldstück liegen bleibt, bevor es verschwindet. */
export const GOLD_DAUER_SCHRITTE = 45;
/** Nach so vielen normalen Futtern erscheint ein Goldstück. */
export const GOLD_JE_FUTTER = 5;

export type Richtung = 'hoch' | 'runter' | 'links' | 'rechts';

export type Punkt = { x: number; y: number };

export type Zustand = {
  /** Kopf zuerst, Schwanz zuletzt. */
  schlange: readonly Punkt[];
  richtung: Richtung;
  /** Als Nächstes gewünschte Richtung — erst beim nächsten Schritt gültig. */
  gepuffert: Richtung | null;
  futter: Punkt;
  /** Goldstück, solange eines liegt. */
  gold: Punkt | null;
  /** Restliche Schritte, die das Goldstück noch liegen bleibt. */
  goldRest: number;
  /** Wie viele Futter seit dem letzten Goldstück gegessen wurden. */
  seitGold: number;
  punkte: number;
  /** Sekunden je Feld, sinkt mit jedem Futter. */
  taktS: number;
  /** Aufgelaufene Zeit seit dem letzten Feldwechsel. */
  angesammelt: number;
  vorbei: boolean;
  saat: number;
};

const GEGENRICHTUNG: Record<Richtung, Richtung> = {
  hoch: 'runter',
  runter: 'hoch',
  links: 'rechts',
  rechts: 'links',
};

const VERSATZ: Record<Richtung, Punkt> = {
  hoch: { x: 0, y: -1 },
  runter: { x: 0, y: 1 },
  links: { x: -1, y: 0 },
  rechts: { x: 1, y: 0 },
};

/** Wickelt eine Koordinate am Rand auf die andere Seite. */
function umschlagen(wert: number, grenze: number): number {
  return ((wert % grenze) + grenze) % grenze;
}

/**
 * Ein freies Feld suchen — also eines, auf dem weder Schlange noch das
 * jeweils andere Objekt liegt. Zählt erst alle freien Felder und wählt dann
 * eines davon, statt blind zu würfeln und bei Treffern zu wiederholen: so
 * ist der Aufwand auch bei fast vollem Feld begrenzt und das Ergebnis für
 * eine gegebene Saat immer dasselbe.
 */
export function freiesFeld(
  belegt: readonly Punkt[],
  saat: number,
): { feld: Punkt | null; saat: number } {
  const gesperrt = new Set(belegt.map((p) => `${p.x},${p.y}`));
  const frei: Punkt[] = [];
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      if (!gesperrt.has(`${x},${y}`)) frei.push({ x, y });
    }
  }
  if (frei.length === 0) return { feld: null, saat };

  const e = schritt(saat);
  return { feld: frei[Math.floor(e.wert * frei.length)]!, saat: e.saat };
}

export function neuesSpiel(saat: number): Zustand {
  const mitteY = Math.floor(HOEHE / 2);
  const startX = Math.floor(BREITE / 2);
  // Kopf zuerst, Schwanz nach links — die Schlange schaut nach rechts.
  const schlange: Punkt[] = [];
  for (let i = 0; i < START_LAENGE; i++) schlange.push({ x: startX - i, y: mitteY });

  const ersteFutter = freiesFeld(schlange, saat);

  return {
    schlange,
    richtung: 'rechts',
    gepuffert: null,
    futter: ersteFutter.feld ?? { x: 0, y: 0 },
    gold: null,
    goldRest: 0,
    seitGold: 0,
    punkte: 0,
    taktS: TAKT_START_S,
    angesammelt: 0,
    vorbei: false,
    saat: ersteFutter.saat,
  };
}

/**
 * Eine Richtung vormerken. Die Gegenrichtung wird verworfen — sonst führe
 * ein versehentlicher Doppeltipp sofort in den eigenen Hals. Gemerkt wird
 * gegen die *aktuelle* Richtung, nicht gegen eine schon gepufferte, damit
 * zwei schnelle Eingaben hintereinander (rechts, dann hoch) nicht die
 * zweite verschlucken.
 */
export function richtungWaehlen(z: Zustand, richtung: Richtung): Zustand {
  if (z.vorbei) return z;
  if (richtung === GEGENRICHTUNG[z.richtung]) return z;
  if (richtung === z.richtung && z.gepuffert === null) return z;
  return { ...z, gepuffert: richtung };
}

/** Ein Feld weiterrücken. Kümmert sich um Fressen, Wachsen und Kollision. */
export function feldWechseln(z: Zustand): Zustand {
  if (z.vorbei) return z;

  const richtung = z.gepuffert ?? z.richtung;
  const versatz = VERSATZ[richtung];
  const alterKopf = z.schlange[0]!;
  const kopf: Punkt = {
    x: umschlagen(alterKopf.x + versatz.x, BREITE),
    y: umschlagen(alterKopf.y + versatz.y, HOEHE),
  };

  const friss = kopf.x === z.futter.x && kopf.y === z.futter.y;
  const frissGold = !!z.gold && kopf.x === z.gold.x && kopf.y === z.gold.y;

  // Ohne Futter rückt der Schwanz nach — das Feld, das er freigibt, darf der
  // Kopf im selben Schritt betreten. Deshalb erst kürzen, dann prüfen.
  const koerper = friss ? z.schlange : z.schlange.slice(0, -1);
  if (koerper.some((p) => p.x === kopf.x && p.y === kopf.y)) {
    return { ...z, richtung, gepuffert: null, vorbei: true };
  }

  const schlange = [kopf, ...koerper];
  let saat = z.saat;
  let futter = z.futter;
  let gold = z.gold;
  let goldRest = friss || !gold ? z.goldRest : z.goldRest - 1;
  let seitGold = z.seitGold;
  let punkte = z.punkte;
  let taktS = z.taktS;

  if (friss) {
    punkte += PUNKTE_JE_FUTTER;
    taktS = Math.max(TAKT_MIN_S, taktS - TAKT_STUFE_S);
    seitGold += 1;

    const neues = freiesFeld(gold ? [...schlange, gold] : schlange, saat);
    saat = neues.saat;
    futter = neues.feld ?? futter;

    // Alle paar Futter ein Goldstück dazulegen — aber nur, wenn gerade
    // keines liegt, sonst häufen sie sich bei schnellem Spiel.
    if (!gold && seitGold >= GOLD_JE_FUTTER) {
      const neuesGold = freiesFeld([...schlange, futter], saat);
      saat = neuesGold.saat;
      if (neuesGold.feld) {
        gold = neuesGold.feld;
        goldRest = GOLD_DAUER_SCHRITTE;
        seitGold = 0;
      }
    }
  }

  if (frissGold) {
    punkte += PUNKTE_GOLD;
    gold = null;
    goldRest = 0;
  } else if (gold && goldRest <= 0) {
    gold = null;
  }

  return {
    ...z,
    schlange,
    richtung,
    gepuffert: null,
    futter,
    gold,
    goldRest,
    seitGold,
    punkte,
    taktS,
    vorbei: false,
    saat,
  };
}

/**
 * Zeit vergehen lassen. Sammelt an, bis ein voller Takt zusammen ist, und
 * rückt dann ein Feld weiter — dadurch ist die Bewegung unabhängig von der
 * Bildrate des Geräts.
 */
export function zeitFortschritt(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;

  let stand: Zustand = { ...z, angesammelt: z.angesammelt + dt };
  // Schleife statt einmaligem Schritt: bei einem Ruckler können mehrere
  // Takte fällig sein. useGameLoop begrenzt das bereits nach oben.
  while (!stand.vorbei && stand.angesammelt >= stand.taktS) {
    const rest = stand.angesammelt - stand.taktS;
    stand = feldWechseln(stand);
    stand = { ...stand, angesammelt: rest };
  }
  return stand;
}
