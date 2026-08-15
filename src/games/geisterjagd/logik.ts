import { schritt } from '../../core/rng';
import { LABYRINTH, istWand, schluessel } from './labyrinth';
import type { Labyrinth, Position } from './labyrinth';

/**
 * Geisterjagd: Punkte fressen, vier Geister mit eigener Taktik ausweichen.
 * Reine Logik, kein React — testbar ohne Klick. Bewegung ist kachelweise,
 * nicht in Pixeln — jede Position ist immer eine ganze Rasterzelle.
 */

export type Richtung = 'up' | 'down' | 'left' | 'right';

const VERSATZ: Record<Richtung, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const GEGENRICHTUNG: Record<Richtung, Richtung> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const ALLE_RICHTUNGEN: readonly Richtung[] = ['up', 'down', 'left', 'right'];

export type GeistModus = 'streuen' | 'jagen' | 'angst' | 'augen';

export type Geist = {
  id: 0 | 1 | 2 | 3;
  position: Position;
  richtung: Richtung;
  modus: GeistModus;
  angstZeitRest: number;
  bewegungRest: number;
};

export type Spieler = {
  position: Position;
  richtung: Richtung;
  gepuffert: Richtung | null;
  bewegungRest: number;
};

export type Zustand = {
  labyrinth: Labyrinth;
  spieler: Spieler;
  geister: readonly Geist[];
  punkte: ReadonlySet<string>;
  kraftpillen: ReadonlySet<string>;
  score: number;
  leben: number;
  level: number;
  modusPhase: number;
  modusZeitRest: number;
  vorbei: boolean;
  saat: number;
};

export const STARTLEBEN = 3;
export const ANGST_DAUER = 8;
const PUNKTE_PRO_PUNKT = 10;
const PUNKTE_PRO_KRAFTPILLE = 50;
const PUNKTE_PRO_GEIST = 200;

/**
 * Streuen/Jagen nach fester, eigener Zeittabelle (nicht die Original-Werte).
 * Der letzte Eintrag dauert für immer — ab dann wird nur noch gejagt.
 */
const MODUS_ZEITTABELLE: readonly { modus: 'streuen' | 'jagen'; dauer: number }[] = [
  { modus: 'streuen', dauer: 7 },
  { modus: 'jagen', dauer: 20 },
  { modus: 'streuen', dauer: 7 },
  { modus: 'jagen', dauer: 20 },
  { modus: 'streuen', dauer: 5 },
  { modus: 'jagen', dauer: 20 },
  { modus: 'streuen', dauer: 5 },
  { modus: 'jagen', dauer: Infinity },
];

export function spielerIntervall(level: number): number {
  return Math.max(0.11, 0.16 - (level - 1) * 0.01);
}

function geistBasisIntervall(level: number): number {
  return Math.max(0.13, 0.18 - (level - 1) * 0.01);
}

function istTunnelfeld(labyrinth: Labyrinth, position: Position): boolean {
  return !labyrinth.waende.has(schluessel(0, position.y)) && (position.x <= 2 || position.x >= labyrinth.breite - 3);
}

function geistIntervall(geist: Geist, labyrinth: Labyrinth, level: number): number {
  const basis = geistBasisIntervall(level);
  if (geist.modus === 'augen') return basis * 0.5;
  if (geist.modus === 'angst') return basis * 1.6;
  if (istTunnelfeld(labyrinth, geist.position)) return basis * 1.8;
  return basis;
}

function nachbarPosition(labyrinth: Labyrinth, position: Position, richtung: Richtung): Position {
  const v = VERSATZ[richtung];
  const x = (((position.x + v.x) % labyrinth.breite) + labyrinth.breite) % labyrinth.breite;
  return { x, y: position.y + v.y };
}

/** Alle begehbaren Richtungen von einer Position aus, optional eine ausgeschlossen. */
export function gueltigeRichtungen(
  labyrinth: Labyrinth,
  position: Position,
  ausschluss: Richtung | null,
): Richtung[] {
  return ALLE_RICHTUNGEN.filter((r) => {
    if (r === ausschluss) return false;
    const n = nachbarPosition(labyrinth, position, r);
    return !istWand(labyrinth, n.x, n.y);
  });
}

function kaefigZentrum(labyrinth: Labyrinth): Position {
  const xs = labyrinth.geisterStarts.map((g) => g.x);
  const ys = labyrinth.geisterStarts.map((g) => g.y);
  return {
    x: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
    y: Math.round(ys.reduce((a, b) => a + b, 0) / ys.length),
  };
}

function istAmKaefig(labyrinth: Labyrinth, position: Position): boolean {
  const xs = labyrinth.geisterStarts.map((g) => g.x);
  const ys = labyrinth.geisterStarts.map((g) => g.y);
  return (
    position.x >= Math.min(...xs) &&
    position.x <= Math.max(...xs) &&
    position.y >= Math.min(...ys) &&
    position.y <= Math.max(...ys)
  );
}

/** Wohin ein Geist im Streuen-Modus will — die eigene, feste Ecke. */
export function streuZiel(geist: Geist, labyrinth: Labyrinth): Position {
  const ecken: Record<0 | 1 | 2 | 3, Position> = {
    0: { x: labyrinth.breite - 2, y: 1 },
    1: { x: 1, y: 1 },
    2: { x: labyrinth.breite - 2, y: labyrinth.hoehe - 2 },
    3: { x: 1, y: labyrinth.hoehe - 2 },
  };
  return ecken[geist.id];
}

/**
 * Die vier unterschiedlichen Jagd-Taktiken:
 * 0 verfolgt direkt, 1 zielt vor den Spieler, 2 spiegelt Geist 0 durch einen
 * Punkt vor dem Spieler, 3 verfolgt nur aus der Nähe, sonst zieht er sich
 * in seine Ecke zurück.
 */
export function jagdZiel(
  geist: Geist,
  alle: readonly Geist[],
  spieler: Spieler,
  labyrinth: Labyrinth,
): Position {
  if (geist.id === 0) return spieler.position;

  if (geist.id === 1) {
    const v = VERSATZ[spieler.richtung];
    return { x: spieler.position.x + v.x * 4, y: spieler.position.y + v.y * 4 };
  }

  if (geist.id === 2) {
    const v = VERSATZ[spieler.richtung];
    const vorPunkt = { x: spieler.position.x + v.x * 2, y: spieler.position.y + v.y * 2 };
    const geist0 = alle[0]!;
    return { x: vorPunkt.x + (vorPunkt.x - geist0.position.x), y: vorPunkt.y + (vorPunkt.y - geist0.position.y) };
  }

  const distanzQuadrat = (spieler.position.x - geist.position.x) ** 2 + (spieler.position.y - geist.position.y) ** 2;
  return distanzQuadrat > 64 ? spieler.position : streuZiel(geist, labyrinth);
}

export function zielFuerGeist(
  geist: Geist,
  alle: readonly Geist[],
  spieler: Spieler,
  labyrinth: Labyrinth,
): Position {
  if (geist.modus === 'augen') return kaefigZentrum(labyrinth);
  if (geist.modus === 'streuen') return streuZiel(geist, labyrinth);
  if (geist.modus === 'jagen') return jagdZiel(geist, alle, spieler, labyrinth);
  return spieler.position; // angst — Ziel wird eh nicht greedy benutzt
}

/**
 * Welche Richtung ein Geist als Nächstes nimmt: nie umkehren (außer in der
 * Sackgasse), im Angst-Modus zufällig unter den gültigen Richtungen, sonst
 * die, deren Nachbarfeld dem Ziel am nächsten liegt.
 */
export function geistRichtungWaehlen(
  geist: Geist,
  labyrinth: Labyrinth,
  ziel: Position,
  saat: number,
): { richtung: Richtung; saat: number } {
  const rueckwaerts = GEGENRICHTUNG[geist.richtung];
  let optionen = gueltigeRichtungen(labyrinth, geist.position, rueckwaerts);
  if (optionen.length === 0) optionen = gueltigeRichtungen(labyrinth, geist.position, null);
  if (optionen.length === 0) return { richtung: geist.richtung, saat };

  if (geist.modus === 'angst') {
    const e = schritt(saat);
    const index = Math.min(optionen.length - 1, Math.floor(e.wert * optionen.length));
    return { richtung: optionen[index]!, saat: e.saat };
  }

  let beste = optionen[0]!;
  let besterAbstand = Infinity;
  for (const r of optionen) {
    const n = nachbarPosition(labyrinth, geist.position, r);
    const d = (n.x - ziel.x) ** 2 + (n.y - ziel.y) ** 2;
    if (d < besterAbstand) {
      besterAbstand = d;
      beste = r;
    }
  }
  return { richtung: beste, saat };
}

function anfangsGeister(labyrinth: Labyrinth, level: number, modus: 'streuen' | 'jagen'): Geist[] {
  return labyrinth.geisterStarts.map((pos, i) => ({
    id: i as 0 | 1 | 2 | 3,
    position: pos,
    richtung: 'up',
    modus,
    angstZeitRest: 0,
    bewegungRest: geistBasisIntervall(level),
  }));
}

export function neuesSpiel(saat: number): Zustand {
  const labyrinth = LABYRINTH;
  return {
    labyrinth,
    spieler: {
      position: labyrinth.spielerStart,
      richtung: 'left',
      gepuffert: null,
      bewegungRest: spielerIntervall(1),
    },
    geister: anfangsGeister(labyrinth, 1, 'streuen'),
    punkte: new Set(labyrinth.punkteStart),
    kraftpillen: new Set(labyrinth.kraftpillenStart),
    score: 0,
    leben: STARTLEBEN,
    level: 1,
    modusPhase: 0,
    modusZeitRest: MODUS_ZEITTABELLE[0]!.dauer,
    vorbei: false,
    saat,
  };
}

/** Nur die Bewegung des Spielers — Punkte/Kraftpillen fressen passiert danach separat. */
function spielerBewegenSchritt(z: Zustand): Zustand {
  const { spieler, labyrinth } = z;
  let richtung = spieler.richtung;

  if (spieler.gepuffert) {
    const n = nachbarPosition(labyrinth, spieler.position, spieler.gepuffert);
    if (!istWand(labyrinth, n.x, n.y)) richtung = spieler.gepuffert;
  }

  const gepuffert = richtung === spieler.gepuffert ? null : spieler.gepuffert;
  const ziel = nachbarPosition(labyrinth, spieler.position, richtung);
  const bewegungRest = spielerIntervall(z.level);

  if (istWand(labyrinth, ziel.x, ziel.y)) {
    return { ...z, spieler: { ...spieler, richtung, gepuffert, bewegungRest } };
  }
  return { ...z, spieler: { position: ziel, richtung, gepuffert, bewegungRest } };
}

function neuesSetOhne(menge: ReadonlySet<string>, schluessel: string): ReadonlySet<string> {
  const neu = new Set(menge);
  neu.delete(schluessel);
  return neu;
}

function startpositionenZuruecksetzen(z: Zustand): Zustand {
  return {
    ...z,
    spieler: {
      position: z.labyrinth.spielerStart,
      richtung: 'left',
      gepuffert: null,
      bewegungRest: spielerIntervall(z.level),
    },
    geister: anfangsGeister(z.labyrinth, z.level, MODUS_ZEITTABELLE[z.modusPhase]!.modus),
  };
}

function naechstesLevel(z: Zustand): Zustand {
  const level = z.level + 1;
  const zurueckgesetzt = startpositionenZuruecksetzen({ ...z, level, modusPhase: 0, modusZeitRest: MODUS_ZEITTABELLE[0]!.dauer });
  return {
    ...zurueckgesetzt,
    punkte: new Set(z.labyrinth.punkteStart),
    kraftpillen: new Set(z.labyrinth.kraftpillenStart),
  };
}

function spielerBewegenUndFressen(z: Zustand): Zustand {
  const bewegt = spielerBewegenSchritt(z);
  const schl = schluessel(bewegt.spieler.position.x, bewegt.spieler.position.y);

  let punkte = bewegt.punkte;
  let kraftpillen = bewegt.kraftpillen;
  let score = bewegt.score;
  let geister = bewegt.geister;

  if (punkte.has(schl)) {
    punkte = neuesSetOhne(punkte, schl);
    score += PUNKTE_PRO_PUNKT;
  } else if (kraftpillen.has(schl)) {
    kraftpillen = neuesSetOhne(kraftpillen, schl);
    score += PUNKTE_PRO_KRAFTPILLE;
    geister = geister.map((g) =>
      g.modus === 'augen'
        ? g
        : { ...g, modus: 'angst', angstZeitRest: ANGST_DAUER, richtung: GEGENRICHTUNG[g.richtung] },
    );
  }

  const zustand: Zustand = { ...bewegt, punkte, kraftpillen, score, geister };
  if (punkte.size === 0 && kraftpillen.size === 0) return naechstesLevel(zustand);
  return zustand;
}

function modusPhaseFortschritt(z: Zustand, dt: number): Zustand {
  const rest = z.modusZeitRest - dt;
  if (rest > 0) return { ...z, modusZeitRest: rest };

  const naechstePhase = Math.min(z.modusPhase + 1, MODUS_ZEITTABELLE.length - 1);
  const neuerModus = MODUS_ZEITTABELLE[naechstePhase]!.modus;
  return {
    ...z,
    modusPhase: naechstePhase,
    modusZeitRest: MODUS_ZEITTABELLE[naechstePhase]!.dauer,
    // Beim Wechsel kehren nicht-ängstliche, nicht-heimkehrende Geister sofort um.
    geister: z.geister.map((g) =>
      g.modus === 'angst' || g.modus === 'augen'
        ? g
        : { ...g, modus: neuerModus, richtung: GEGENRICHTUNG[g.richtung] },
    ),
  };
}

function angstTimerFortschritt(z: Zustand, dt: number): Zustand {
  return {
    ...z,
    geister: z.geister.map((g) => {
      if (g.modus !== 'angst') return g;
      const rest = g.angstZeitRest - dt;
      if (rest > 0) return { ...g, angstZeitRest: rest };
      return { ...g, modus: MODUS_ZEITTABELLE[z.modusPhase]!.modus, angstZeitRest: 0 };
    }),
  };
}

function geisterFortschritt(z: Zustand, dt: number): Zustand {
  let saat = z.saat;
  const geisterVorher = z.geister;

  const geister = geisterVorher.map((g) => {
    const bewegungRest = g.bewegungRest - dt;
    if (bewegungRest > 0) return { ...g, bewegungRest };

    const ziel = zielFuerGeist(g, geisterVorher, z.spieler, z.labyrinth);
    const gewaehlt = geistRichtungWaehlen(g, z.labyrinth, ziel, saat);
    saat = gewaehlt.saat;
    const neuePosition = nachbarPosition(z.labyrinth, g.position, gewaehlt.richtung);
    const intervall = geistIntervall(g, z.labyrinth, z.level);

    if (g.modus === 'augen' && istAmKaefig(z.labyrinth, neuePosition)) {
      return {
        ...g,
        position: neuePosition,
        richtung: gewaehlt.richtung,
        modus: MODUS_ZEITTABELLE[z.modusPhase]!.modus,
        angstZeitRest: 0,
        bewegungRest: intervall,
      };
    }
    return { ...g, position: neuePosition, richtung: gewaehlt.richtung, bewegungRest: intervall };
  });

  return { ...z, geister, saat };
}

function kollisionenPruefen(z: Zustand): Zustand {
  const treffer = z.geister.find(
    (g) => g.position.x === z.spieler.position.x && g.position.y === z.spieler.position.y,
  );
  if (!treffer) return z;

  if (treffer.modus === 'angst') {
    const geister = z.geister.map((g) =>
      g.id === treffer.id ? { ...g, modus: 'augen' as const, angstZeitRest: 0 } : g,
    );
    return { ...z, geister, score: z.score + PUNKTE_PRO_GEIST };
  }

  if (treffer.modus === 'augen') return z;

  const leben = z.leben - 1;
  if (leben <= 0) return { ...z, leben: 0, vorbei: true };
  return startpositionenZuruecksetzen({ ...z, leben });
}

/** Die vom Spieler gewünschte Richtung merken — angewendet, sobald es an der Reihe ist. */
export function richtungEingeben(z: Zustand, richtung: Richtung): Zustand {
  if (z.vorbei) return z;
  return { ...z, spieler: { ...z.spieler, gepuffert: richtung } };
}

/** Zeit vergehen lassen: Spieler- und Geisterbewegung, Modus-Zeittabelle, Kollisionen. */
export function zeitFortschritt(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;

  let zustand = modusPhaseFortschritt(z, dt);

  const spielerBewegungRest = zustand.spieler.bewegungRest - dt;
  zustand =
    spielerBewegungRest <= 0
      ? spielerBewegenUndFressen({ ...zustand, spieler: { ...zustand.spieler, bewegungRest: spielerBewegungRest } })
      : { ...zustand, spieler: { ...zustand.spieler, bewegungRest: spielerBewegungRest } };

  if (zustand.vorbei) return zustand;

  zustand = geisterFortschritt(zustand, dt);
  zustand = angstTimerFortschritt(zustand, dt);
  zustand = kollisionenPruefen(zustand);

  return zustand;
}
