import { schritt } from '../../core/rng';
import { ersteZuege, formMasken, loesbar, maskenAus } from './loeser';

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
  /** Kein Teil passt mehr **und** kein Joker kann es retten: Die Runde ist aus. */
  vorbei: boolean;
  /**
   * Kein Teil passt mehr, aber ein Joker ist noch da. Die Runde ist **nicht**
   * zu Ende — man soll ihn einsetzen dürfen (siehe `zurueck`). Ohne diese
   * Zwischenstufe verfiele der Joker genau in dem Augenblick, in dem man ihn
   * am dringendsten braucht.
   */
  festgefahren: boolean;
  saat: number;
  /** Alle aufgelösten Reihen und Spalten der Runde — daraus folgt die Etappe. */
  linien: number;
  /** Vorrat an „Zurück"-Jokern. */
  joker: number;
  /**
   * Die höchste Etappe, für die schon ein Joker gutgeschrieben wurde. Sinkt nie,
   * auch nicht durch ein „Zurück": Sonst ließe sich eine Etappe einsetzen,
   * wieder erreichen und noch einmal kassieren — eine Joker-Maschine.
   */
  belohnt: number;
  /** Der Stand vor dem letzten Zug (ohne eigenen Verlauf), `null` am Anfang und nach einem „Zurück". */
  verlauf: Zustand | null;
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

/**
 * Welche Zeilen und Spalten sich mit einem der Teile im Tablett **jetzt**
 * auflösen ließen — der Hinweis „hier kannst du eine Reihe wegmachen".
 *
 * Probiert jedes Teil an jeder erlaubten Stelle durch. Das sind bei drei
 * Teilen und 64 Feldern höchstens knapp 200 Versuche, also billig genug,
 * um es bei jeder Änderung neu zu rechnen — die Anzeige merkt sich das
 * Ergebnis trotzdem, weil es bei jedem Bild sonst umsonst liefe.
 *
 * Bewusst getrennt von `volleZeilenUndSpalten` (das schaut auf ein
 * fertiges Raster) — hier geht es um die Möglichkeit, nicht um die
 * Tatsache.
 */
export function loesbareLinien(
  raster: Raster,
  tablett: readonly (Teil | null)[],
): { zeilen: number[]; spalten: number[] } {
  const zeilen = new Set<number>();
  const spalten = new Set<number>();

  for (const teil of tablett) {
    if (!teil) continue;
    for (let y = 0; y < HOEHE; y++) {
      for (let x = 0; x < BREITE; x++) {
        if (!passtAn(raster, teil.form, x, y)) continue;
        const linien = volleZeilenUndSpalten(legen(raster, teil.form, x, y, teil.farbe));
        for (const z of linien.zeilen) zeilen.add(z);
        for (const s of linien.spalten) spalten.add(s);
      }
    }
  }

  return {
    zeilen: [...zeilen].sort((a, b) => a - b),
    spalten: [...spalten].sort((a, b) => a - b),
  };
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
 * Ab wie vielen Punkten auf einmal das „+N" über dem Feld erscheint.
 *
 * Die Anzeige liest nur noch den Zuwachs des Punktestands ab
 * (`usePunktegewinn`) und kann von sich aus nicht wissen, ob dabei eine
 * Linie gefallen ist. Sie muss es an der Höhe erkennen — und das geht,
 * weil beide Bereiche sich hier nicht überschneiden: Bloßes Ablegen bringt
 * höchstens so viele Punkte, wie das größte Teil Zellen hat (neun), jede
 * Auflösung mindestens `PUNKTE_PRO_LINIE`. Die Zahl steht deshalb in der
 * Logik und nicht in der Anzeige: Ein neues, größeres Teil oder eine
 * andere Punkteregel muss sie mitziehen, und der Test unten schlägt an,
 * wenn das vergessen wird.
 */
export const PUNKTE_SCHWELLE_ANZEIGE = PUNKTE_PRO_LINIE;

/** Wie viele aufgelöste Reihen und Spalten eine Etappe kostet. */
export const LINIEN_JE_ETAPPE = 8;
/** Mehr als so viele Joker liegen nie im Vorrat — ein Vorrat ohne Decke ist keine Entscheidung mehr. */
export const JOKER_MAX = 3;
/** Ein Joker zum Start, damit man den Knopf überhaupt einmal gesehen hat, bevor man ihn braucht. */
export const START_JOKER = 1;
export function etappeFuer(linien: number): number {
  return 1 + Math.floor(linien / LINIEN_JE_ETAPPE);
}

/**
 * Wie stark größere Teile bei vollerem Feld benachteiligt werden — nie auf
 * 0, ein großes Teil bleibt immer möglich, nur seltener. Ohne das ist der
 * Tod reine Pechsache, sobald zufällig drei große Teile hintereinander
 * kommen und das Feld schon eng ist.
 *
 * Mit der Etappe wird die Nachsicht kleiner und die Vorliebe für große Teile
 * größer: Wer weit kommt, bekommt auch bei vollerem Feld sperrige Teile.
 */
export function gewichtFuerGroesse(groesse: number, fuellstand: number, etappe = 1): number {
  const nachsicht = NACHSICHT_START * Math.pow(NACHSICHT_FAKTOR, etappe - 1);
  const sperrig = Math.pow(groesse, SPERRIG_EXPONENT * (etappe - 1));
  return sperrig / (1 + fuellstand * groesse * nachsicht);
}

const NACHSICHT_START = 0.35;
const NACHSICHT_FAKTOR = 0.92;
const SPERRIG_EXPONENT = 0.06;

export function fuellstand(raster: Raster): number {
  let belegt = 0;
  for (const zeile of raster) for (const zelle of zeile) if (zelle !== null) belegt++;
  return belegt / (BREITE * HOEHE);
}

/**
 * Aus wie vielen lösbaren Tabletts das Spiel das knappste aussucht.
 *
 * Etappe 1: aus einem — es nimmt, was kommt. Mit jeder Etappe mehr, bis zur
 * Decke. „Knapp" heißt hier: Von allen ersten Zügen lassen sich nur wenige
 * zu Ende führen (`ersteZuege`). Das ist ein **gestuftes** Stellrad. Die
 * erste Fassung nahm eine feste Schwelle („höchstens 92 Prozent verzeihende
 * Züge") und war schon auf Etappe 2 eine Wand: Auf einem halbleeren Brett ist
 * fast jedes Tablett nachsichtig, die Schwelle griff also nie, und es blieb
 * bei „immer das knappste von allen" — die Spielzeit eines gierigen Spielers
 * fiel von 83 auf 35 Züge, in einem einzigen Schritt.
 */
export function auswahlGroesse(etappe: number): number {
  return Math.min(AUSWAHL_MAX, 1 + Math.floor((etappe - 1) / ETAPPEN_JE_AUSWAHL));
}

const ETAPPEN_JE_AUSWAHL = 3;
const AUSWAHL_MAX = 6;
/** So viele Tabletts werden je Austeilen höchstens gezogen, bis genug lösbare beisammen sind. */
const VERSUCHE = 40;

function neuesTeil(saat: number, fuellstandWert: number, etappe: number): { teil: Teil; saat: number } {
  const gewichte = FORMEN.map((f) => gewichtFuerGroesse(f.length, fuellstandWert, etappe));
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

function einTablett(saat: number, raster: Raster, etappe: number): { tablett: readonly Teil[]; saat: number } {
  const fuellstandWert = fuellstand(raster);
  let s = saat;
  const tablett: Teil[] = [];
  for (let i = 0; i < 3; i++) {
    const gezogen = neuesTeil(s, fuellstandWert, etappe);
    tablett.push(gezogen.teil);
    s = gezogen.saat;
  }
  return { tablett, saat: s };
}

/**
 * Die kleinsten Teile, die noch alle drei unterkommen — die Rückfallebene,
 * wenn keiner der Kandidaten lösbar war. Gibt es auch dafür keine Lösung, ist
 * das Brett so voll, dass die Runde ehrlich zu Ende ist.
 */
function notTablett(raster: Raster, saat: number): readonly Teil[] | null {
  const brett = maskenAus(raster);
  const klein = FORMEN.filter((f) => f.length <= 3);
  for (const a of klein) {
    for (const b of klein) {
      for (const c of klein) {
        if (loesbar(brett, [formMasken(a), formMasken(b), formMasken(c)])) {
          return [a, b, c].map((form, i) => ({ id: `${saat}-not${i}`, form, farbe: i % ANZAHL_FARBEN }));
        }
      }
    }
  }
  return null;
}

/**
 * Teilt drei neue Teile aus — und zwar nie ein Tablett, das nicht zu schaffen
 * ist.
 *
 * Vorher entschied der Zufall über das Ende: Auch bei bestem Spiel kam in
 * einigen Prozent der Fälle ein Tablett, dessen drei Teile zusammen nirgends
 * mehr hinpassten. Wer dort starb, hatte nichts falsch gemacht, und ein Kind
 * schreibt so etwas sich selbst zu. Jetzt wird ausprobiert, bis eines geht
 * (`loesbar`), und **wer stirbt, hat sich verlegt**.
 *
 * Mit der Etappe wird zusätzlich gewählt, wie knapp es ist (`auswahlGroesse`):
 * Schwierigkeit entsteht nicht daraus, dass man unfair stirbt, sondern daraus,
 * dass immer weniger Züge richtig sind.
 */
function neuesTablett(saat: number, raster: Raster, etappe: number): { tablett: readonly Teil[]; saat: number } {
  const brett = maskenAus(raster);
  const gewuenscht = auswahlGroesse(etappe);
  let s = saat;
  let bester: { tablett: readonly Teil[]; verzeihen: number } | null = null;
  let gefunden = 0;

  for (let versuch = 0; versuch < VERSUCHE && gefunden < gewuenscht; versuch++) {
    const kandidat = einTablett(s, raster, etappe);
    s = kandidat.saat;
    const formen = kandidat.tablett.map((t) => formMasken(t.form));
    if (!loesbar(brett, formen)) continue;
    gefunden++;
    // Auf Etappe 1 gibt es nichts zu wählen — dann gleich nehmen und sich das
    // Durchzählen der ersten Züge sparen.
    if (gewuenscht === 1) return { tablett: kandidat.tablett, saat: s };
    const { zuege, gut } = ersteZuege(brett, formen);
    const verzeihen = zuege === 0 ? 0 : gut / zuege;
    if (!bester || verzeihen < bester.verzeihen) bester = { tablett: kandidat.tablett, verzeihen };
  }

  if (bester) return { tablett: bester.tablett, saat: s };
  const not = notTablett(raster, s);
  if (not) return { tablett: not, saat: s };
  // Nichts geht mehr: ein beliebiges Tablett, die Runde endet an ihm.
  return einTablett(s, raster, etappe);
}

export function neuesSpiel(saat: number, etappe = 1): Zustand {
  const raster = leeresRaster();
  const { tablett, saat: neueSaat } = neuesTablett(saat, raster, etappe);
  return {
    raster,
    tablett,
    punkte: 0,
    kombo: 0,
    vorbei: false,
    festgefahren: false,
    saat: neueSaat,
    linien: (etappe - 1) * LINIEN_JE_ETAPPE,
    joker: START_JOKER,
    belohnt: etappe,
    verlauf: null,
  };
}

/**
 * Legt Teil `tablettIndex` bei (ankerX, ankerY) ab: Raster aktualisieren,
 * volle Reihen/Spalten auflösen, Punkte gutschreiben, bei Bedarf drei neue
 * Teile ziehen, und ehrlich prüfen, ob überhaupt noch etwas passt.
 */
export function teilLegen(z: Zustand, tablettIndex: number, ankerX: number, ankerY: number): Zustand {
  if (z.vorbei || z.festgefahren) return z;
  const teil = z.tablett[tablettIndex];
  if (!teil) return z;
  if (!passtAn(z.raster, teil.form, ankerX, ankerY)) return z;

  const nachLegen = legen(z.raster, teil.form, ankerX, ankerY, teil.farbe);
  const { zeilen, spalten } = volleZeilenUndSpalten(nachLegen);
  const anzahlLinien = zeilen.length + spalten.length;
  const aufgeloest = aufloesen(nachLegen, zeilen, spalten);

  const neueKombo = anzahlLinien > 0 ? z.kombo + 1 : 0;
  const zugPunkte = punkteFuerZug(teil.form.length, anzahlLinien, neueKombo);

  const linien = z.linien + anzahlLinien;
  const etappe = etappeFuer(linien);
  // Für jede erstmals erreichte Etappe ein Joker — gedeckelt.
  const belohnt = Math.max(z.belohnt, etappe);
  const joker = Math.min(JOKER_MAX, z.joker + (belohnt - z.belohnt));

  let tablett: readonly (Teil | null)[] = z.tablett.map((t, i) => (i === tablettIndex ? null : t));
  let saat = z.saat;

  if (tablett.every((t) => t === null)) {
    const gezogen = neuesTablett(saat, aufgeloest, etappe);
    tablett = gezogen.tablett;
    saat = gezogen.saat;
  }

  const keinZug = tablett.every((t) => t === null || !passtIrgendwo(aufgeloest, t.form));

  return {
    raster: aufgeloest,
    tablett,
    punkte: z.punkte + zugPunkte,
    kombo: neueKombo,
    vorbei: keinZug && joker === 0,
    festgefahren: keinZug && joker > 0,
    saat,
    linien,
    joker,
    belohnt,
    verlauf: { ...z, verlauf: null },
  };
}

/**
 * Den letzten Zug zurücknehmen — kostet einen Joker.
 *
 * Geht nur **einen** Zug weit (`verlauf` hält genau einen Stand): Mehr würde
 * aus einer begrenzten Hilfe ein freies Ausprobieren machen, und die Punkte
 * wären nichts mehr wert. Der Vorrat und die schon belohnte Etappe bleiben, wie
 * sie jetzt sind — beides stammt nicht aus dem zurückgenommenen Stand.
 */
export function zurueck(z: Zustand): Zustand {
  if (z.vorbei || !z.verlauf || z.joker <= 0) return z;
  return { ...z.verlauf, joker: z.joker - 1, belohnt: z.belohnt, verlauf: null };
}
