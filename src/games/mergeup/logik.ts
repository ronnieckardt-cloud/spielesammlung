/**
 * Merge Up — reine Spiellogik, ohne Anzeige.
 *
 * Auf einem 4×4-Raster werden alle Kacheln in eine Richtung geschoben.
 * Treffen zwei gleiche aufeinander, verschmelzen sie zur nächsthöheren.
 * Nach jedem Zug, der etwas bewegt hat, kommt eine neue Kachel dazu.
 *
 * Die Kacheln tragen eine Stufe (1, 2, 3, …), nicht den angezeigten Wert —
 * angezeigt wird 2^Stufe. Das macht das Verschmelzen zu einem simplen
 * `stufe + 1` und die Farbzuordnung zu einem Griff in eine Liste.
 */

import { schritt } from '../../core/rng';

export const GROESSE = 4;

/** Ab dieser Stufe (2^11 = 2048) gilt die Runde als gewonnen. */
export const ZIEL_STUFE = 11;

/** Wahrscheinlichkeit, dass eine neue Kachel Stufe 2 (also 4) statt 1 (also 2) ist. */
export const CHANCE_VIER = 0.1;

/** null = leeres Feld, sonst die Stufe (angezeigter Wert ist 2^Stufe). */
export type Feld = number | null;
export type Raster = readonly (readonly Feld[])[];

export type Richtung = 'hoch' | 'runter' | 'links' | 'rechts';

/**
 * Was der letzte Zug mit **einer** Kachel gemacht hat.
 *
 * Ohne diese Angabe kann die Anzeige die drei Ereignisse nicht auseinander
 * halten: Nachrücken, Verschmelzen und eine frisch dazugelegte Kachel sahen
 * alle gleich aus, nämlich als kurzer Puls an Ort und Stelle. Dieselbe
 * Überlegung wie bei `geloescht` in Reihenfall — die Logik weiß, was passiert
 * ist, also gibt sie es weiter, statt dass die Anzeige es erraten muss.
 */
export type Kachelbild = {
  /** Spalte, aus der die Kachel gekommen ist (bei einem Paar die hintere). */
  vonX: number;
  /** Zeile, aus der die Kachel gekommen ist. */
  vonY: number;
  /** Hier sind zwei Kacheln eine geworden. */
  verschmolzen: boolean;
  /** Die nach dem Zug dazugelegte Kachel — sie kommt von nirgendwo her. */
  neu: boolean;
};

/** Für jedes Feld des Rasters ein `Kachelbild`, oder null für „leer". */
export type Zugbild = readonly (readonly (Kachelbild | null)[])[];

export type Zustand = {
  raster: Raster;
  punkte: number;
  /** Höchste bisher erreichte Stufe — für die Anzeige „Beste Kachel". */
  hoechsteStufe: number;
  /** True, sobald ZIEL_STUFE erreicht wurde. Weiterspielen bleibt erlaubt. */
  gewonnen: boolean;
  vorbei: boolean;
  saat: number;
  /**
   * Laufende Nummer des Zuges. Die Anzeige hängt ihre Animationen daran:
   * Zwei gleiche Züge hintereinander wären sonst nicht zu unterscheiden und
   * das Verschmelzen liefe kein zweites Mal an (siehe `tick` in Reihenfall).
   */
  zug: number;
  /** Herkunft jeder Kachel aus dem letzten Zug. Null vor dem ersten Zug. */
  bild: Zugbild | null;
};

export function leeresRaster(): Feld[][] {
  return Array.from({ length: GROESSE }, () => Array.from({ length: GROESSE }, () => null));
}

/** Der angezeigte Wert einer Stufe: Stufe 1 → 2, Stufe 2 → 4, Stufe 3 → 8 … */
export function wertVonStufe(stufe: number): number {
  return 2 ** stufe;
}

/**
 * Eine Reihe nach links zusammenschieben. Rückgabe ist die neue Reihe plus
 * die dabei erzielten Punkte.
 *
 * Alle vier Richtungen laufen über diese eine Funktion — die Anzeige dreht
 * das Raster vorher passend, siehe `schieben`. Das spart drei fast gleiche
 * Fassungen, in denen sich leicht ein Fehler versteckt.
 *
 * `herkunft` sagt für jedes Ergebnisfeld, aus welchem Feld der **Eingabe**
 * reihe die Kachel dort stammt (-1 für leer). Beim Verschmelzen ist das die
 * **hintere** der beiden — die legt den weiteren Weg zurück, und genau die
 * sichtbare Reise auf die Partnerkachel zu macht das Verschmelzen lesbar.
 */
export function reiheSchieben(reihe: readonly Feld[]): {
  reihe: Feld[];
  punkte: number;
  herkunft: number[];
  verschmolzen: boolean[];
} {
  const voll: number[] = [];
  const vonFeld: number[] = [];
  reihe.forEach((f, i) => {
    if (f !== null) {
      voll.push(f);
      vonFeld.push(i);
    }
  });

  const ergebnis: Feld[] = [];
  const herkunft: number[] = [];
  const verschmolzen: boolean[] = [];
  let punkte = 0;

  for (let i = 0; i < voll.length; i++) {
    // Zwei gleiche verschmelzen — aber jede Kachel nur einmal pro Zug,
    // deshalb rückt i danach um zwei weiter.
    if (i + 1 < voll.length && voll[i] === voll[i + 1]) {
      const neueStufe = voll[i]! + 1;
      ergebnis.push(neueStufe);
      herkunft.push(vonFeld[i + 1]!);
      verschmolzen.push(true);
      punkte += wertVonStufe(neueStufe);
      i++;
    } else {
      ergebnis.push(voll[i]!);
      herkunft.push(vonFeld[i]!);
      verschmolzen.push(false);
    }
  }

  while (ergebnis.length < reihe.length) {
    ergebnis.push(null);
    herkunft.push(-1);
    verschmolzen.push(false);
  }
  return { reihe: ergebnis, punkte, herkunft, verschmolzen };
}

/**
 * Ein quadratisches Raster um 90° gegen den Uhrzeigersinn drehen.
 *
 * Bewusst über einen beliebigen Inhaltstyp: Neben den Kacheln wird ein
 * zweites Raster mit denselben Drehungen mitgeführt, in dem jedes Feld seine
 * **ursprüngliche** Position trägt. Weil dort Koordinaten als Inhalt stehen
 * und nicht als Ort, kommt am Ende von selbst die richtige Herkunft heraus —
 * ohne für jede der vier Richtungen eine eigene Umrechnung.
 */
function drehen<T>(raster: readonly (readonly T[])[]): T[][] {
  const neu: T[][] = Array.from({ length: GROESSE }, () => new Array<T>(GROESSE));
  for (let y = 0; y < GROESSE; y++) {
    for (let x = 0; x < GROESSE; x++) {
      neu[GROESSE - 1 - x]![y] = raster[y]![x]!;
    }
  }
  return neu;
}

/**
 * Wie oft gegen den Uhrzeigersinn gedreht werden muss, damit die jeweilige
 * Richtung zu „links" wird. Beim Drehen gegen den Uhrzeigersinn wandert die
 * obere Kante nach links, die untere nach rechts — „hoch" braucht also eine
 * Drehung, „runter" drei.
 */
const DREHUNGEN: Record<Richtung, number> = {
  links: 0,
  hoch: 1,
  rechts: 2,
  runter: 3,
};

/**
 * Das ganze Raster in eine Richtung schieben. Ohne Nebenwirkung: gibt das
 * neue Raster, die Punkte, ob sich überhaupt etwas bewegt hat — und für jede
 * Kachel, woher sie kommt (`bild`, für die Bewegung in der Anzeige).
 */
export function schieben(
  raster: Raster,
  richtung: Richtung,
): { raster: Feld[][]; punkte: number; bewegt: boolean; bild: (Kachelbild | null)[][] } {
  const drehungen = DREHUNGEN[richtung];

  let arbeit: Feld[][] = raster.map((r) => [...r]);
  // Zweites Raster, das jedes Feld seine Ausgangsposition mittragen lässt.
  let herkunft: { x: number; y: number }[][] = Array.from({ length: GROESSE }, (_, y) =>
    Array.from({ length: GROESSE }, (_, x) => ({ x, y })),
  );
  for (let i = 0; i < drehungen; i++) {
    arbeit = drehen(arbeit);
    herkunft = drehen(herkunft);
  }

  let punkte = 0;
  let bild: (Kachelbild | null)[][] = [];
  const geschoben: Feld[][] = [];
  arbeit.forEach((reihe, y) => {
    const e = reiheSchieben(reihe);
    punkte += e.punkte;
    geschoben.push(e.reihe);
    bild.push(
      e.reihe.map((f, x) => {
        if (f === null) return null;
        const von = herkunft[y]![e.herkunft[x]!]!;
        return { vonX: von.x, vonY: von.y, verschmolzen: e.verschmolzen[x]!, neu: false };
      }),
    );
  });
  arbeit = geschoben;

  // Zurückdrehen: vier Drehungen sind eine volle Umdrehung.
  for (let i = 0; i < (4 - drehungen) % 4; i++) {
    arbeit = drehen(arbeit);
    bild = drehen(bild);
  }

  const bewegt = arbeit.some((reihe, y) => reihe.some((f, x) => f !== raster[y]![x]));
  return { raster: arbeit, punkte, bewegt, bild };
}

/**
 * Eine neue Kachel auf ein zufälliges freies Feld legen. Zählt erst die
 * freien Felder und wählt dann eines — siehe `freiesFeld` bei Snake Rush,
 * gleicher Gedanke: begrenzter Aufwand, reproduzierbares Ergebnis.
 */
export function kachelSetzen(
  raster: Raster,
  saat: number,
): { raster: Feld[][]; saat: number; feld: { x: number; y: number } | null } {
  const frei: { x: number; y: number }[] = [];
  for (let y = 0; y < GROESSE; y++) {
    for (let x = 0; x < GROESSE; x++) {
      if (raster[y]![x] === null) frei.push({ x, y });
    }
  }
  const neu = raster.map((r) => [...r]);
  if (frei.length === 0) return { raster: neu, saat, feld: null };

  const wahl = schritt(saat);
  const feld = frei[Math.floor(wahl.wert * frei.length)]!;
  const stufeZug = schritt(wahl.saat);
  neu[feld.y]![feld.x] = stufeZug.wert < CHANCE_VIER ? 2 : 1;
  // Die Anzeige muss wissen, **wo** die neue Kachel liegt — nur so kann sie
  // aufploppen statt genauso auszusehen wie eine nachgerückte.
  return { raster: neu, saat: stufeZug.saat, feld };
}

/** Ob überhaupt noch ein Zug möglich ist — freies Feld oder gleiche Nachbarn. */
export function zugMoeglich(raster: Raster): boolean {
  for (let y = 0; y < GROESSE; y++) {
    for (let x = 0; x < GROESSE; x++) {
      const f = raster[y]![x];
      if (f === null) return true;
      if (x + 1 < GROESSE && raster[y]![x + 1] === f) return true;
      if (y + 1 < GROESSE && raster[y + 1]![x] === f) return true;
    }
  }
  return false;
}

/** Höchste Stufe auf dem Raster, 0 bei leerem Raster. */
export function hoechsteStufe(raster: Raster): number {
  let hoechste = 0;
  for (const reihe of raster) {
    for (const f of reihe) {
      if (f !== null && f > hoechste) hoechste = f;
    }
  }
  return hoechste;
}

export function neuesSpiel(saat: number): Zustand {
  const erste = kachelSetzen(leeresRaster(), saat);
  const zweite = kachelSetzen(erste.raster, erste.saat);
  return {
    raster: zweite.raster,
    punkte: 0,
    hoechsteStufe: hoechsteStufe(zweite.raster),
    gewonnen: false,
    vorbei: false,
    saat: zweite.saat,
    zug: 0,
    bild: null,
  };
}

/**
 * Ein Zug: schieben, bei Bewegung eine neue Kachel dazulegen, danach
 * prüfen, ob noch etwas geht. Ein Zug ohne Bewegung ist kein Zug — dann
 * kommt auch keine neue Kachel dazu, sonst wäre wiederholtes Drücken gegen
 * eine Wand eine Strafe.
 */
export function ziehen(z: Zustand, richtung: Richtung): Zustand {
  if (z.vorbei) return z;

  const e = schieben(z.raster, richtung);
  if (!e.bewegt) return z;

  const mitNeuer = kachelSetzen(e.raster, z.saat);
  const hoechste = hoechsteStufe(mitNeuer.raster);

  const bild = e.bild.map((reihe) => [...reihe]);
  if (mitNeuer.feld) {
    const { x, y } = mitNeuer.feld;
    bild[y]![x] = { vonX: x, vonY: y, verschmolzen: false, neu: true };
  }

  return {
    raster: mitNeuer.raster,
    punkte: z.punkte + e.punkte,
    hoechsteStufe: hoechste,
    gewonnen: z.gewonnen || hoechste >= ZIEL_STUFE,
    vorbei: !zugMoeglich(mitNeuer.raster),
    saat: mitNeuer.saat,
    zug: z.zug + 1,
    bild,
  };
}
