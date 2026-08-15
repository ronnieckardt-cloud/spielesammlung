/**
 * Drop Four: Steine in Spalten fallen lassen, vier in einer Reihe gewinnt.
 * Das erste Spiel der Sammlung, bei dem ein Gegner zurückspielt — die
 * Rechenkunst des Computers steht getrennt in `gegner.ts`.
 *
 * Der Name ist bewusst nicht „Vier gewinnt": Das ist in Deutschland ein
 * geschützter Handelsname für genau dieses Spiel. Dieselbe Überlegung wie
 * bei Pair Up.
 *
 * Reine Logik, kein React.
 */

export const SPALTEN = 7;
export const ZEILEN = 6;

/** 0 = Mensch, 1 = Computer, null = leer. */
export type Spieler = 0 | 1;
export type Zelle = Spieler | null;
/** `feld[y][x]`, y = 0 ist **oben**. */
export type Feld = readonly (readonly Zelle[])[];
export type Punkt = { x: number; y: number };

export type Stufe = 'leicht' | 'mittel' | 'schwer';

export type Zustand = {
  feld: Feld;
  amZug: Spieler;
  gewinner: Spieler | null;
  /** Die vier Steine, die den Sieg bringen — für die Hervorhebung. */
  gewinnlinie: readonly Punkt[] | null;
  unentschieden: boolean;
  /** Züge des Menschen, für die Punktewertung. */
  zuege: number;
  stufe: Stufe;
  vorbei: boolean;
  punkte: number;
  /** Zuletzt gelegter Stein — die Anzeige lässt ihn hineinfallen. */
  letzter: Punkt | null;
};

export function leeresFeld(): Feld {
  return Array.from({ length: ZEILEN }, () => Array<Zelle>(SPALTEN).fill(null));
}

export function neuesSpiel(stufe: Stufe): Zustand {
  return {
    feld: leeresFeld(),
    // Der Mensch fängt immer an. Das ist ein kleiner Vorteil, und genau den
    // soll ein Kind gegen einen rechnenden Gegner auch haben.
    amZug: 0,
    gewinner: null,
    gewinnlinie: null,
    unentschieden: false,
    zuege: 0,
    stufe,
    vorbei: false,
    punkte: 0,
    letzter: null,
  };
}

/** In welcher Zeile ein Stein in dieser Spalte landen würde, sonst null. */
export function einwurfZeile(feld: Feld, x: number): number | null {
  if (x < 0 || x >= SPALTEN) return null;
  for (let y = ZEILEN - 1; y >= 0; y--) {
    if (feld[y]![x] === null) return y;
  }
  return null;
}

/** Alle Spalten, in die noch ein Stein passt. */
export function moeglicheSpalten(feld: Feld): number[] {
  const spalten: number[] = [];
  for (let x = 0; x < SPALTEN; x++) if (einwurfZeile(feld, x) !== null) spalten.push(x);
  return spalten;
}

/** Die vier Richtungen, in denen eine Viererreihe liegen kann. */
const RICHTUNGEN: readonly Punkt[] = [
  { x: 1, y: 0 }, // waagerecht
  { x: 0, y: 1 }, // senkrecht
  { x: 1, y: 1 }, // diagonal ab
  { x: 1, y: -1 }, // diagonal auf
];

/**
 * Prüft nur von der zuletzt gelegten Stelle aus — eine Viererreihe kann
 * ohne den neuen Stein gar nicht entstanden sein. Das ganze Feld abzusuchen
 * wäre bei jedem Zug der Rechenkunst deutlich teurer.
 */
export function gewinnlinieAb(feld: Feld, x: number, y: number): Punkt[] | null {
  const wer = feld[y]?.[x];
  if (wer === null || wer === undefined) return null;

  for (const richtung of RICHTUNGEN) {
    const linie: Punkt[] = [{ x, y }];
    // In beide Richtungen weiterzählen, solange dieselbe Farbe liegt.
    for (const vorzeichen of [1, -1]) {
      let px = x + richtung.x * vorzeichen;
      let py = y + richtung.y * vorzeichen;
      while (feld[py]?.[px] === wer) {
        linie.push({ x: px, y: py });
        px += richtung.x * vorzeichen;
        py += richtung.y * vorzeichen;
      }
    }
    if (linie.length >= 4) {
      // Sortiert, damit die Anzeige die Linie sauber zeichnen kann.
      linie.sort((a, b) => a.x - b.x || a.y - b.y);
      return linie;
    }
  }
  return null;
}

export function feldVoll(feld: Feld): boolean {
  return feld[0]!.every((zelle) => zelle !== null);
}

/** Einen Stein setzen, ohne Regelprüfung — für die Rechenkunst in `gegner.ts`. */
export function feldMitStein(feld: Feld, x: number, y: number, wer: Spieler): Feld {
  return feld.map((zeile, zy) => (zy === y ? zeile.map((z, zx) => (zx === x ? wer : z)) : zeile));
}

const GRUNDPUNKTE: Record<Stufe, number> = { leicht: 150, mittel: 400, schwer: 900 };

/**
 * Punkte einer Partie. Ein Sieg auf der schweren Stufe muss deutlich mehr
 * wert sein als einer auf der leichten — sonst lohnt es sich, immer auf
 * „leicht" zu spielen, und die Bestenliste sagt nichts mehr aus.
 *
 * Ein schneller Sieg zählt zusätzlich: Mit vier Zügen geht es frühestens,
 * mit 21 ist das Feld voll.
 */
export function punkteFuer(stufe: Stufe, zuege: number, ergebnis: 'gewonnen' | 'verloren' | 'unentschieden'): number {
  if (ergebnis === 'verloren') return 0;
  const grund = GRUNDPUNKTE[stufe];
  if (ergebnis === 'unentschieden') return Math.round(grund / 3);
  const zuegeBonus = Math.max(0, 21 - zuege) * Math.round(grund / 40);
  return grund + zuegeBonus;
}

/**
 * Einen Stein einwerfen. Gibt den Zustand unverändert zurück, wenn der Zug
 * nicht erlaubt ist — die Anzeige muss also nichts selbst prüfen.
 */
export function einwerfen(z: Zustand, x: number): Zustand {
  if (z.vorbei) return z;
  const y = einwurfZeile(z.feld, x);
  if (y === null) return z;

  const wer = z.amZug;
  const feld = feldMitStein(z.feld, x, y, wer);
  const linie = gewinnlinieAb(feld, x, y);
  const zuege = wer === 0 ? z.zuege + 1 : z.zuege;
  const letzter = { x, y };

  if (linie) {
    return {
      ...z,
      feld,
      letzter,
      zuege,
      gewinner: wer,
      gewinnlinie: linie,
      vorbei: true,
      punkte: punkteFuer(z.stufe, zuege, wer === 0 ? 'gewonnen' : 'verloren'),
    };
  }

  if (feldVoll(feld)) {
    return {
      ...z,
      feld,
      letzter,
      zuege,
      unentschieden: true,
      vorbei: true,
      punkte: punkteFuer(z.stufe, zuege, 'unentschieden'),
    };
  }

  return { ...z, feld, letzter, zuege, amZug: wer === 0 ? 1 : 0 };
}
