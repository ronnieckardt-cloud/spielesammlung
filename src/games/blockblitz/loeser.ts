/**
 * Der Löser für Block Burst: Ist ein Tablett auf einem Brett überhaupt zu
 * schaffen — und wie knapp?
 *
 * Alles hier rechnet auf **Zeilenmasken** statt auf dem Raster aus Farbwerten:
 * Ein Brett sind acht Zahlen von 0 bis 255 (ein Bit je Feld). Das ist kein
 * Selbstzweck. Die Suche probiert beim Austeilen jedes Tablett-Kandidaten
 * Zehntausende Stellungen durch, und mit je einem kopierten 8×8-Feld wäre das
 * auf einem alten iPad spürbar. Mit Masken ist ein Zug ein paar `|` und `&`.
 *
 * Die Farben spielen für „passt das?" keine Rolle und stehen deshalb nicht
 * drin. Der Löser kennt weder Punkte noch Kombo — nur Platz.
 */

const BREITE = 8;
const HOEHE = 8;
const VOLL = (1 << BREITE) - 1; // 255: alle Felder einer Zeile belegt

export type Masken = readonly number[];
type Form = readonly { dx: number; dy: number }[];

export type FormMasken = {
  breite: number;
  hoehe: number;
  /** Je Formzeile die Bits, ganz links angelegt (x = 0). */
  zeilen: readonly number[];
};

const formCache = new WeakMap<Form, FormMasken>();

export function formMasken(form: Form): FormMasken {
  const bekannt = formCache.get(form);
  if (bekannt) return bekannt;
  let breite = 0;
  let hoehe = 0;
  for (const { dx, dy } of form) {
    breite = Math.max(breite, dx + 1);
    hoehe = Math.max(hoehe, dy + 1);
  }
  const zeilen = Array.from({ length: hoehe }, () => 0);
  for (const { dx, dy } of form) zeilen[dy]! |= 1 << dx;
  const ergebnis = { breite, hoehe, zeilen };
  formCache.set(form, ergebnis);
  return ergebnis;
}

/** Das Raster (Farbe oder `null` je Feld) als Zeilenmasken. */
export function maskenAus(raster: readonly (readonly (number | null)[])[]): Masken {
  return raster.map((zeile) => {
    let m = 0;
    for (let x = 0; x < BREITE; x++) if (zeile[x] !== null) m |= 1 << x;
    return m;
  });
}

/**
 * Das Brett nach dem Legen **samt Abräumen**, oder `null`, wenn die Form dort
 * nicht passt. Zeilen und Spalten werden aus dem Brett *vor* dem Abräumen
 * bestimmt und dann gemeinsam entfernt — genauso wie `aufloesen` im Spiel,
 * sonst stünde der Löser auf einem anderen Brett als die Spieler.
 */
export function legenMasken(brett: Masken, f: FormMasken, x: number, y: number): number[] | null {
  if (x < 0 || y < 0 || x + f.breite > BREITE || y + f.hoehe > HOEHE) return null;
  const neu = brett.slice();
  for (let i = 0; i < f.hoehe; i++) {
    const bits = f.zeilen[i]! << x;
    if ((neu[y + i]! & bits) !== 0) return null;
    neu[y + i]! |= bits;
  }
  let spalten = VOLL;
  for (let i = 0; i < HOEHE; i++) spalten &= neu[i]!;
  for (let i = 0; i < HOEHE; i++) {
    neu[i] = neu[i]! === VOLL ? 0 : neu[i]! & ~spalten;
  }
  return neu;
}

/**
 * Lassen sich **alle** Formen in irgendeiner Reihenfolge ablegen?
 *
 * Eine echte Tiefensuche, keine Schätzung. Gleiche Formen werden je Ebene nur
 * einmal probiert: Zwei identische Teile in der Hand sind dieselbe Frage, und
 * ohne diese Abkürzung verdoppelte sich die Arbeit bei jedem Doppelgänger.
 */
export function loesbar(brett: Masken, formen: readonly FormMasken[]): boolean {
  if (formen.length === 0) return true;
  const probiert = new Set<FormMasken>();
  for (let i = 0; i < formen.length; i++) {
    const f = formen[i]!;
    if (probiert.has(f)) continue;
    probiert.add(f);
    const rest = formen.filter((_, j) => j !== i);
    for (let y = 0; y + f.hoehe <= HOEHE; y++) {
      for (let x = 0; x + f.breite <= BREITE; x++) {
        const neu = legenMasken(brett, f, x, y);
        if (neu && loesbar(neu, rest)) return true;
      }
    }
  }
  return false;
}

/**
 * Wie knapp ist ein lösbares Tablett? Von allen ersten Zügen, die es gibt:
 * wie viele lassen sich noch zu Ende führen?
 *
 * Auf einem leeren Brett fast alle — ein Fehler kostet nichts. Auf einem
 * engen Brett vielleicht jeder zehnte: Wer dort „irgendwohin" legt, hat sich
 * verbaut. Das ist die Stellgröße der Schwierigkeit (siehe `sicherheit` in
 * `logik.ts`), nicht die Zahl der Teile oder ihre Größe allein.
 */
export function ersteZuege(brett: Masken, formen: readonly FormMasken[]): { zuege: number; gut: number } {
  let zuege = 0;
  let gut = 0;
  for (let i = 0; i < formen.length; i++) {
    const f = formen[i]!;
    const rest = formen.filter((_, j) => j !== i);
    for (let y = 0; y + f.hoehe <= HOEHE; y++) {
      for (let x = 0; x + f.breite <= BREITE; x++) {
        const neu = legenMasken(brett, f, x, y);
        if (!neu) continue;
        zuege++;
        if (loesbar(neu, rest)) gut++;
      }
    }
  }
  return { zuege, gut };
}
