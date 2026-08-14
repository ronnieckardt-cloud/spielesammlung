import { schritt } from '../../core/rng';

/**
 * Blockblitz: Teile aufs 8×8-Raster legen, volle Reihen und Spalten lösen
 * sich auf. Reine Logik, kein React — testbar ohne Klick.
 */

export type Zelle = number | null; // null = leer, sonst Farbindex
export type Raster = readonly (readonly Zelle[])[]; // raster[zeile][spalte]

export const BREITE = 8;
export const HOEHE = 8;
export const ANZAHL_FARBEN = 6;

export type Versatz = { dx: number; dy: number };
export type TeilForm = readonly Versatz[];

export type Teil = {
  id: string;
  form: TeilForm;
  farbe: number;
};

/** Eine Form aus ASCII-Kunst lesen — '#' ist eine Zelle, alles andere ist leer. */
function ausMuster(zeilen: readonly string[]): TeilForm {
  const zellen: Versatz[] = [];
  zeilen.forEach((zeile, y) => {
    for (let x = 0; x < zeile.length; x++) {
      if (zeile[x] === '#') zellen.push({ dx: x, dy: y });
    }
  });
  return zellen;
}

/**
 * Der Teilesatz. Keine Drehung im Spiel — deshalb stehen L-, T- und
 * S/Z-Formen in allen vier bzw. zwei Lagen einzeln drin.
 */
export const FORMEN: readonly TeilForm[] = [
  // Größe 1
  ausMuster(['#']),
  // Größe 2
  ausMuster(['##']),
  ausMuster(['#', '#']),
  // Größe 3 — Linien
  ausMuster(['###']),
  ausMuster(['#', '#', '#']),
  // Größe 3 — Ecken, alle vier Lagen
  ausMuster(['#.', '##']),
  ausMuster(['.#', '##']),
  ausMuster(['##', '#.']),
  ausMuster(['##', '.#']),
  // Größe 4 — Linien
  ausMuster(['####']),
  ausMuster(['#', '#', '#', '#']),
  // Größe 4 — Quadrat
  ausMuster(['##', '##']),
  // Größe 4 — L/J, alle vier Lagen
  ausMuster(['#..', '###']),
  ausMuster(['..#', '###']),
  ausMuster(['###', '#..']),
  ausMuster(['###', '..#']),
  // Größe 4 — T, alle vier Lagen
  ausMuster(['###', '.#.']),
  ausMuster(['.#.', '###']),
  ausMuster(['#.', '##', '#.']),
  ausMuster(['.#', '##', '.#']),
  // Größe 4 — S/Z, beide Lagen
  ausMuster(['.##', '##.']),
  ausMuster(['##.', '.##']),
  // Größe 5 — Linien
  ausMuster(['#####']),
  ausMuster(['#', '#', '#', '#', '#']),
  // Größe 5 — Plus
  ausMuster(['.#.', '###', '.#.']),
  // Größe 6 — Rechteck
  ausMuster(['###', '###']),
  // Größe 9 — großes Quadrat, selten und hart
  ausMuster(['###', '###', '###']),
];

export type Zustand = {
  raster: Raster;
  /** Immer drei Plätze — ein gelegtes Teil wird zu null, bis alle drei leer sind. */
  tablett: readonly (Teil | null)[];
  punkte: number;
  /** Aufeinanderfolgende Züge mit Auflösung — für die steigenden Kombo-Punkte. */
  kombo: number;
  vorbei: boolean;
  saat: number;
};

export function leeresRaster(): Raster {
  return Array.from({ length: HOEHE }, () => Array.from({ length: BREITE }, () => null));
}

export function passtAn(raster: Raster, form: TeilForm, ankerX: number, ankerY: number): boolean {
  return form.every(({ dx, dy }) => {
    const x = ankerX + dx;
    const y = ankerY + dy;
    return x >= 0 && x < BREITE && y >= 0 && y < HOEHE && raster[y]![x] === null;
  });
}

/** Die ehrliche "passt noch was?"-Prüfung: alle Positionen, nicht nur ein paar. */
export function passtIrgendwo(raster: Raster, form: TeilForm): boolean {
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      if (passtAn(raster, form, x, y)) return true;
    }
  }
  return false;
}

export function legen(
  raster: Raster,
  form: TeilForm,
  ankerX: number,
  ankerY: number,
  farbe: number,
): Raster {
  if (!passtAn(raster, form, ankerX, ankerY)) return raster;
  const neu = raster.map((zeile) => [...zeile]);
  for (const { dx, dy } of form) {
    neu[ankerY + dy]![ankerX + dx] = farbe;
  }
  return neu;
}

export function volleZeilenUndSpalten(raster: Raster): { zeilen: number[]; spalten: number[] } {
  const zeilen: number[] = [];
  for (let y = 0; y < HOEHE; y++) {
    if (raster[y]!.every((z) => z !== null)) zeilen.push(y);
  }
  const spalten: number[] = [];
  for (let x = 0; x < BREITE; x++) {
    if (raster.every((zeile) => zeile[x] !== null)) spalten.push(x);
  }
  return { zeilen, spalten };
}

export function aufloesen(raster: Raster, zeilen: readonly number[], spalten: readonly number[]): Raster {
  if (zeilen.length === 0 && spalten.length === 0) return raster;
  const zeilenSet = new Set(zeilen);
  const spaltenSet = new Set(spalten);
  return raster.map((zeile, y) =>
    zeile.map((zelle, x) => (zeilenSet.has(y) || spaltenSet.has(x) ? null : zelle)),
  );
}

const PUNKTE_PRO_ZELLE_GELEGT = 1;
const PUNKTE_PRO_LINIE = 10;

/**
 * Punkte für einen Zug: Legen gibt eine Zelle einen Punkt. Mehrere Linien
 * auf einmal zählen überproportional (1→10, 2→40, 3→90, 4→160), und eine
 * Serie von Zügen mit Auflösung (Kombo) multipliziert zusätzlich.
 */
export function punkteFuerZug(zellenGelegt: number, anzahlLinien: number, komboNachZug: number): number {
  const legenPunkte = zellenGelegt * PUNKTE_PRO_ZELLE_GELEGT;
  if (anzahlLinien === 0) return legenPunkte;
  const linienBasis = anzahlLinien * anzahlLinien * PUNKTE_PRO_LINIE;
  const komboMultiplikator = 1 + (komboNachZug - 1) * 0.5;
  return legenPunkte + Math.round(linienBasis * komboMultiplikator);
}

/**
 * Wie stark größere Teile bei vollerem Feld benachteiligt werden — nie auf
 * 0, ein großes Teil bleibt immer möglich, nur seltener. Ohne das ist der
 * Tod reine Pechsache, sobald zufällig drei große Teile hintereinander
 * kommen und das Feld schon eng ist.
 */
export function gewichtFuerGroesse(groesse: number, fuellstand: number): number {
  return 1 / (1 + fuellstand * groesse * 0.35);
}

export function fuellstand(raster: Raster): number {
  let belegt = 0;
  for (const zeile of raster) for (const zelle of zeile) if (zelle !== null) belegt++;
  return belegt / (BREITE * HOEHE);
}

function neuesTeil(saat: number, fuellstandWert: number): { teil: Teil; saat: number } {
  const gewichte = FORMEN.map((f) => gewichtFuerGroesse(f.length, fuellstandWert));
  const gesamt = gewichte.reduce((a, b) => a + b, 0);

  const formSchritt = schritt(saat);
  let ziel = formSchritt.wert * gesamt;
  let index = 0;
  for (; index < gewichte.length - 1; index++) {
    ziel -= gewichte[index]!;
    if (ziel <= 0) break;
  }

  const farbSchritt = schritt(formSchritt.saat);
  const farbe = Math.min(ANZAHL_FARBEN - 1, Math.floor(farbSchritt.wert * ANZAHL_FARBEN));

  return {
    teil: { id: `${farbSchritt.saat}`, form: FORMEN[index]!, farbe },
    saat: farbSchritt.saat,
  };
}

function neuesTablett(saat: number, raster: Raster): { tablett: readonly Teil[]; saat: number } {
  const fuellstandWert = fuellstand(raster);
  let s = saat;
  const tablett: Teil[] = [];
  for (let i = 0; i < 3; i++) {
    const gezogen = neuesTeil(s, fuellstandWert);
    tablett.push(gezogen.teil);
    s = gezogen.saat;
  }
  return { tablett, saat: s };
}

export function neuesSpiel(saat: number): Zustand {
  const raster = leeresRaster();
  const { tablett, saat: neueSaat } = neuesTablett(saat, raster);
  return { raster, tablett, punkte: 0, kombo: 0, vorbei: false, saat: neueSaat };
}

/**
 * Legt Teil `tablettIndex` bei (ankerX, ankerY) ab: Raster aktualisieren,
 * volle Reihen/Spalten auflösen, Punkte gutschreiben, bei Bedarf drei neue
 * Teile ziehen, und ehrlich prüfen, ob überhaupt noch etwas passt.
 */
export function teilLegen(z: Zustand, tablettIndex: number, ankerX: number, ankerY: number): Zustand {
  if (z.vorbei) return z;
  const teil = z.tablett[tablettIndex];
  if (!teil) return z;
  if (!passtAn(z.raster, teil.form, ankerX, ankerY)) return z;

  const nachLegen = legen(z.raster, teil.form, ankerX, ankerY, teil.farbe);
  const { zeilen, spalten } = volleZeilenUndSpalten(nachLegen);
  const anzahlLinien = zeilen.length + spalten.length;
  const aufgeloest = aufloesen(nachLegen, zeilen, spalten);

  const neueKombo = anzahlLinien > 0 ? z.kombo + 1 : 0;
  const zugPunkte = punkteFuerZug(teil.form.length, anzahlLinien, neueKombo);

  let tablett: readonly (Teil | null)[] = z.tablett.map((t, i) => (i === tablettIndex ? null : t));
  let saat = z.saat;

  if (tablett.every((t) => t === null)) {
    const gezogen = neuesTablett(saat, aufgeloest);
    tablett = gezogen.tablett;
    saat = gezogen.saat;
  }

  const vorbei = tablett.every((t) => t === null || !passtIrgendwo(aufgeloest, t.form));

  return { raster: aufgeloest, tablett, punkte: z.punkte + zugPunkte, kombo: neueKombo, vorbei, saat };
}
