import { saatAus } from '../../core/rng';
import { raetselErzeugen, sindNachbarn } from './erzeuger';
import type { Raetsel, Zelle } from './erzeuger';

/**
 * Flow Link — die Spielregeln.
 *
 * Man zieht von einem farbigen Punkt zum anderen. Wege dürfen sich nicht
 * kreuzen, und am Ende muss **jedes** Feld belegt sein — sonst wäre die
 * Aufgabe fast immer mit ein paar geraden Strichen erledigt.
 *
 * Reine Funktionen ohne React: Ein Zustand geht rein, ein neuer kommt
 * heraus. Das Erzeugen der Rätsel steht in `erzeuger.ts`.
 */

export type Zustand = {
  level: number;
  raetsel: Raetsel;
  /** Der gezogene Weg je Farbe; leer, solange nichts gezogen wurde. */
  wege: readonly (readonly Zelle[])[];
  /** Welche Farbe der Finger gerade zieht, oder null. */
  zieht: number | null;
  /** Wie oft angesetzt wurde — Grundlage der Punkte. */
  zuege: number;
  geloest: boolean;
};

export function neuesLevel(level: number): Zustand {
  const raetsel = raetselErzeugen(saatAus('verbinden', level), level);
  return {
    level,
    raetsel,
    wege: raetsel.paare.map(() => []),
    zieht: null,
    zuege: 0,
    geloest: false,
  };
}

/** Welche Farbe hat ihren Punkt auf diesem Feld? `null`, wenn keine. */
export function punktFarbe(z: Zustand, zelle: Zelle): number | null {
  const paar = z.raetsel.paare.find((p) => p.a === zelle || p.b === zelle);
  return paar ? paar.farbe : null;
}

/** Welcher Weg läuft über dieses Feld? `null`, wenn keiner. */
export function wegFarbe(z: Zustand, zelle: Zelle): number | null {
  for (let f = 0; f < z.wege.length; f++) {
    if (z.wege[f]!.includes(zelle)) return f;
  }
  return null;
}

/** Ist der Weg dieser Farbe fertig — also von Punkt zu Punkt durchgezogen? */
export function fertig(z: Zustand, farbe: number): boolean {
  const weg = z.wege[farbe];
  const paar = z.raetsel.paare[farbe];
  if (!weg || !paar || weg.length < 2) return false;
  const erst = weg[0]!;
  const letzt = weg[weg.length - 1]!;
  return (erst === paar.a && letzt === paar.b) || (erst === paar.b && letzt === paar.a);
}

/**
 * Gelöst ist erst, wenn **alle** Wege fertig sind **und** kein Feld frei
 * bleibt.
 *
 * Die zweite Bedingung ist die eigentliche Rätselaufgabe. Ohne sie wäre
 * fast jedes Brett mit ein paar geraden Strichen erledigt, und die schönen
 * Umwege — der ganze Reiz — wären überflüssig.
 */
export function istGeloest(z: Zustand): boolean {
  if (!z.raetsel.paare.every((_, f) => fertig(z, f))) return false;
  const belegt = new Set(z.wege.flat());
  return belegt.size === z.raetsel.breite * z.raetsel.hoehe;
}

/**
 * Setzt an einem Punkt an.
 *
 * Nur an den beiden farbigen Punkten, nicht mitten im Weg: Für ein Kind ist
 * „ich fasse den Punkt an und ziehe" die eine Regel, die man nicht erklären
 * muss. Ein bestehender Weg dieser Farbe wird dabei verworfen — das ist
 * gleichzeitig das Radiergummi.
 */
export function ziehenStarten(z: Zustand, zelle: Zelle): Zustand {
  if (z.geloest) return z;
  const farbe = punktFarbe(z, zelle);
  if (farbe === null) return z;

  const wege = z.wege.map((weg, f) => (f === farbe ? [zelle] : weg));
  return { ...z, wege, zieht: farbe, zuege: z.zuege + 1 };
}

/**
 * Zieht auf ein Nachbarfeld weiter.
 *
 * Vier Fälle, und alle vier sind nötig:
 * 1. **Zurück auf das vorletzte Feld** — der Weg wird wieder kürzer. Ohne
 *    das müsste man bei jedem Verzieher ganz von vorn anfangen.
 * 2. **Auf ein Feld des eigenen Weges** — dann wird bis dorthin gekürzt,
 *    also die Schleife abgeschnitten.
 * 3. **Auf einen fremden Weg** — der fremde Weg wird ab dort gekappt. Genau
 *    so kennt man es aus diesen Spielen; alles andere („verboten") fühlt
 *    sich an, als klemme das Spiel.
 * 4. **Auf einen fremden Punkt** — das geht nicht, der gehört jemandem.
 */
export function ziehenNach(z: Zustand, zelle: Zelle): Zustand {
  if (z.zieht === null || z.geloest) return z;
  const farbe = z.zieht;
  const eigener = z.wege[farbe]!;
  const letzt = eigener[eigener.length - 1]!;

  if (zelle === letzt) return z;
  if (!sindNachbarn(letzt, zelle, z.raetsel.breite, z.raetsel.hoehe)) return z;

  // Fall 4: fremder Punkt — nicht begehbar.
  const punkt = punktFarbe(z, zelle);
  if (punkt !== null && punkt !== farbe) return z;

  // Fall 1 und 2: das Feld liegt schon im eigenen Weg.
  const eigenerIndex = eigener.indexOf(zelle);
  if (eigenerIndex >= 0) {
    const wege = z.wege.map((weg, f) => (f === farbe ? eigener.slice(0, eigenerIndex + 1) : weg));
    return { ...z, wege };
  }

  // Fall 3: fremder Weg wird ab dieser Stelle gekappt.
  const wege = z.wege.map((weg, f) => {
    if (f === farbe) return [...eigener, zelle];
    const treffer = weg.indexOf(zelle);
    return treffer >= 0 ? weg.slice(0, treffer) : weg;
  });

  const neu: Zustand = { ...z, wege };
  return { ...neu, geloest: istGeloest(neu) };
}

/** Finger hoch. Der Weg bleibt so stehen, wie er gezogen wurde. */
export function ziehenBeenden(z: Zustand): Zustand {
  if (z.zieht === null) return z;
  return { ...z, zieht: null, geloest: istGeloest(z) };
}

/**
 * Punkte für ein gelöstes Rätsel.
 *
 * Grundwert nach Feldgröße und Farbzahl, Abzug für jedes Mal, das über die
 * nötige Zahl hinaus angesetzt wurde. Wer alles auf Anhieb zieht, bekommt
 * das Doppelte von jemandem, der lange herumprobiert — aber unter den
 * Mindestwert fällt niemand, sonst lohnt sich Weiterspielen nicht mehr.
 */
export function punkteFuerZuege(level: number, farben: number, zuege: number): number {
  const grund = 200 + level * 40;
  const zuviel = Math.max(0, zuege - farben);
  return Math.max(50, grund - zuviel * 20);
}
