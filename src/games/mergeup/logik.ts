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

export type Zustand = {
  raster: Raster;
  punkte: number;
  /** Höchste bisher erreichte Stufe — für die Anzeige „Beste Kachel". */
  hoechsteStufe: number;
  /** True, sobald ZIEL_STUFE erreicht wurde. Weiterspielen bleibt erlaubt. */
  gewonnen: boolean;
  vorbei: boolean;
  saat: number;
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
 */
export function reiheSchieben(reihe: readonly Feld[]): { reihe: Feld[]; punkte: number } {
  const voll = reihe.filter((f): f is number => f !== null);
  const ergebnis: Feld[] = [];
  let punkte = 0;

  for (let i = 0; i < voll.length; i++) {
    // Zwei gleiche verschmelzen — aber jede Kachel nur einmal pro Zug,
    // deshalb rückt i danach um zwei weiter.
    if (i + 1 < voll.length && voll[i] === voll[i + 1]) {
      const neueStufe = voll[i]! + 1;
      ergebnis.push(neueStufe);
      punkte += wertVonStufe(neueStufe);
      i++;
    } else {
      ergebnis.push(voll[i]!);
    }
  }

  while (ergebnis.length < reihe.length) ergebnis.push(null);
  return { reihe: ergebnis, punkte };
}

/** Raster um 90° gegen den Uhrzeigersinn drehen. */
function drehen(raster: Raster): Feld[][] {
  const neu = leeresRaster();
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
 * neue Raster, die Punkte und zurück, ob sich überhaupt etwas bewegt hat.
 */
export function schieben(
  raster: Raster,
  richtung: Richtung,
): { raster: Feld[][]; punkte: number; bewegt: boolean } {
  const drehungen = DREHUNGEN[richtung];

  let arbeit: Feld[][] = raster.map((r) => [...r]);
  for (let i = 0; i < drehungen; i++) arbeit = drehen(arbeit);

  let punkte = 0;
  arbeit = arbeit.map((reihe) => {
    const e = reiheSchieben(reihe);
    punkte += e.punkte;
    return e.reihe;
  });

  // Zurückdrehen: vier Drehungen sind eine volle Umdrehung.
  for (let i = 0; i < (4 - drehungen) % 4; i++) arbeit = drehen(arbeit);

  const bewegt = arbeit.some((reihe, y) => reihe.some((f, x) => f !== raster[y]![x]));
  return { raster: arbeit, punkte, bewegt };
}

/**
 * Eine neue Kachel auf ein zufälliges freies Feld legen. Zählt erst die
 * freien Felder und wählt dann eines — siehe `freiesFeld` bei Snake Rush,
 * gleicher Gedanke: begrenzter Aufwand, reproduzierbares Ergebnis.
 */
export function kachelSetzen(raster: Raster, saat: number): { raster: Feld[][]; saat: number } {
  const frei: { x: number; y: number }[] = [];
  for (let y = 0; y < GROESSE; y++) {
    for (let x = 0; x < GROESSE; x++) {
      if (raster[y]![x] === null) frei.push({ x, y });
    }
  }
  const neu = raster.map((r) => [...r]);
  if (frei.length === 0) return { raster: neu, saat };

  const wahl = schritt(saat);
  const feld = frei[Math.floor(wahl.wert * frei.length)]!;
  const stufeZug = schritt(wahl.saat);
  neu[feld.y]![feld.x] = stufeZug.wert < CHANCE_VIER ? 2 : 1;
  return { raster: neu, saat: stufeZug.saat };
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

  return {
    raster: mitNeuer.raster,
    punkte: z.punkte + e.punkte,
    hoechsteStufe: hoechste,
    gewonnen: z.gewonnen || hoechste >= ZIEL_STUFE,
    vorbei: !zugMoeglich(mitNeuer.raster),
    saat: mitNeuer.saat,
  };
}
