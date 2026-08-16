/**
 * Bubble Pop — reine Spiellogik, ohne Anzeige.
 *
 * Das Feld ist ein Wabenraster: jede zweite Zeile ist um eine halbe Kugel
 * nach rechts versetzt. Eine geschossene Kugel dockt an der Wabe an; treffen
 * dabei drei oder mehr gleiche Farben zusammen, platzen sie. Kugeln, die
 * dadurch den Halt zur obersten Zeile verlieren, fallen hinterher.
 *
 * Die Flugbahn selbst rechnet die Anzeige (`geometrie.ts`) — hier steht nur,
 * was passiert, wenn eine Kugel an einem bestimmten Feld ankommt.
 */

import { schritt } from '../../core/rng';

export const SPALTEN = 8;
/* Zehn statt zwölf Zeilen: Bei zwölf war das Feld so hoch, dass es auf dem
   Handy nur noch schmal in die Bildmitte passte, mit viel totem Rand links
   und rechts. Unter den fünf Startzeilen bleiben immer noch fünf Zeilen
   Anflug — genug zum Zielen. */
export const ZEILEN = 10;
/** So viele Zeilen sind zu Beginn gefüllt. */
export const START_ZEILEN = 5;
/** Ab dieser Gruppengröße platzt eine Gruppe. */
export const MIN_GRUPPE = 3;

export const PUNKTE_JE_KUGEL = 10;
/** Zusatzpunkte je Kugel, die durch Herunterfallen verloren geht. */
export const PUNKTE_JE_GEFALLEN = 20;

/** Erreicht die Wabe diese Zeile, ist die Runde verloren. */
export const VERLUST_ZEILE = ZEILEN - 1;

/** Anzahl verschiedener Kugelfarben. */
export const ANZAHL_FARBEN = 5;

/** null = leeres Feld, sonst der Farbindex. */
export type Feld = number | null;
export type Wabe = readonly (readonly Feld[])[];

export type Punkt = { spalte: number; zeile: number };

export type Zustand = {
  wabe: Wabe;
  /** Kugel im Rohr, wird als Nächstes geschossen. */
  aktuell: number;
  /** Kugel danach — wird angezeigt, damit man planen kann. */
  naechste: number;
  punkte: number;
  /** Schüsse seit der letzten neuen Zeile von oben. */
  seitNachschub: number;
  vorbei: boolean;
  gewonnen: boolean;
  saat: number;
};

/** Nach so vielen Schüssen rückt von oben eine neue Zeile nach. */
export const NACHSCHUB_NACH_SCHUESSEN = 8;

/** Ob eine Zeile nach rechts versetzt ist (jede ungerade Zeile). */
export function istVersetzt(zeile: number): boolean {
  return zeile % 2 === 1;
}

/**
 * Die sechs Nachbarfelder einer Wabenzelle. Links und rechts sind immer
 * gleich; oben und unten hängen davon ab, ob die Zeile versetzt ist —
 * das ist der einzige knifflige Teil am Wabenraster, deshalb an genau
 * einer Stelle und mit Tests.
 */
export function nachbarn(p: Punkt): Punkt[] {
  const versetzt = istVersetzt(p.zeile);
  const dx = versetzt ? 0 : -1;
  const kandidaten: Punkt[] = [
    { spalte: p.spalte - 1, zeile: p.zeile },
    { spalte: p.spalte + 1, zeile: p.zeile },
    { spalte: p.spalte + dx, zeile: p.zeile - 1 },
    { spalte: p.spalte + dx + 1, zeile: p.zeile - 1 },
    { spalte: p.spalte + dx, zeile: p.zeile + 1 },
    { spalte: p.spalte + dx + 1, zeile: p.zeile + 1 },
  ];
  return kandidaten.filter(
    (k) => k.spalte >= 0 && k.spalte < SPALTEN && k.zeile >= 0 && k.zeile < ZEILEN,
  );
}

export function leereWabe(): Feld[][] {
  return Array.from({ length: ZEILEN }, () => Array.from({ length: SPALTEN }, () => null));
}

/**
 * Alle zusammenhängenden Felder gleicher Farbe ab einem Startpunkt
 * (Flutfüllung über die Wabennachbarn).
 */
export function gruppeAb(wabe: Wabe, start: Punkt): Punkt[] {
  const farbe = wabe[start.zeile]?.[start.spalte];
  if (farbe === null || farbe === undefined) return [];

  const gesehen = new Set<string>([`${start.spalte},${start.zeile}`]);
  const gruppe: Punkt[] = [start];
  const offen: Punkt[] = [start];

  while (offen.length > 0) {
    const jetzt = offen.pop()!;
    for (const n of nachbarn(jetzt)) {
      const schluessel = `${n.spalte},${n.zeile}`;
      if (gesehen.has(schluessel)) continue;
      if (wabe[n.zeile]![n.spalte] !== farbe) continue;
      gesehen.add(schluessel);
      gruppe.push(n);
      offen.push(n);
    }
  }
  return gruppe;
}

/**
 * Alle Kugeln, die (über Nachbarn) noch mit der obersten Zeile verbunden
 * sind. Alles andere hängt in der Luft und fällt.
 */
export function haengendeKugeln(wabe: Wabe): Punkt[] {
  const verbunden = new Set<string>();
  const offen: Punkt[] = [];

  for (let spalte = 0; spalte < SPALTEN; spalte++) {
    if (wabe[0]![spalte] !== null) {
      verbunden.add(`${spalte},0`);
      offen.push({ spalte, zeile: 0 });
    }
  }

  while (offen.length > 0) {
    const jetzt = offen.pop()!;
    for (const n of nachbarn(jetzt)) {
      const schluessel = `${n.spalte},${n.zeile}`;
      if (verbunden.has(schluessel)) continue;
      if (wabe[n.zeile]![n.spalte] === null) continue;
      verbunden.add(schluessel);
      offen.push(n);
    }
  }

  const haengend: Punkt[] = [];
  for (let zeile = 0; zeile < ZEILEN; zeile++) {
    for (let spalte = 0; spalte < SPALTEN; spalte++) {
      if (wabe[zeile]![spalte] !== null && !verbunden.has(`${spalte},${zeile}`)) {
        haengend.push({ spalte, zeile });
      }
    }
  }
  return haengend;
}

/** Ob überhaupt noch eine Kugel im Feld liegt. */
export function wabeLeer(wabe: Wabe): boolean {
  return wabe.every((zeile) => zeile.every((f) => f === null));
}

/** Die tiefste Zeile, in der noch eine Kugel liegt. -1 bei leerem Feld. */
export function tiefsteZeile(wabe: Wabe): number {
  for (let zeile = ZEILEN - 1; zeile >= 0; zeile--) {
    if (wabe[zeile]!.some((f) => f !== null)) return zeile;
  }
  return -1;
}

/**
 * Welche Farben im Feld noch vorkommen. Die Nachschub-Kugeln werden daraus
 * gezogen — sonst bekommt man irgendwann eine Farbe ins Rohr, die es gar
 * nicht mehr gibt, und der Schuss ist zwangsläufig verschenkt.
 */
export function vorhandeneFarben(wabe: Wabe): number[] {
  const farben = new Set<number>();
  for (const zeile of wabe) {
    for (const f of zeile) if (f !== null) farben.add(f);
  }
  return [...farben].sort((a, b) => a - b);
}

function farbeZiehen(wabe: Wabe, saat: number): { farbe: number; saat: number } {
  const moeglich = vorhandeneFarben(wabe);
  const liste = moeglich.length > 0 ? moeglich : Array.from({ length: ANZAHL_FARBEN }, (_, i) => i);
  const e = schritt(saat);
  return { farbe: liste[Math.floor(e.wert * liste.length)]!, saat: e.saat };
}

export function neuesSpiel(saat: number): Zustand {
  const wabe = leereWabe();
  let s = saat;
  for (let zeile = 0; zeile < START_ZEILEN; zeile++) {
    for (let spalte = 0; spalte < SPALTEN; spalte++) {
      const e = schritt(s);
      s = e.saat;
      wabe[zeile]![spalte] = Math.floor(e.wert * ANZAHL_FARBEN);
    }
  }

  const erste = farbeZiehen(wabe, s);
  const zweite = farbeZiehen(wabe, erste.saat);

  return {
    wabe,
    aktuell: erste.farbe,
    naechste: zweite.farbe,
    punkte: 0,
    seitNachschub: 0,
    vorbei: false,
    gewonnen: false,
    saat: zweite.saat,
  };
}

/**
 * Eine neue Zeile von oben nachschieben: alles rutscht eine Zeile tiefer,
 * oben kommt eine volle Zeile dazu. Erreicht dabei etwas die Verlustzeile,
 * meldet das der Aufrufer über `tiefsteZeile`.
 */
export function nachschubZeile(wabe: Wabe, saat: number): { wabe: Feld[][]; saat: number } {
  const neu = leereWabe();
  let s = saat;

  const farben = vorhandeneFarben(wabe);
  const liste = farben.length > 0 ? farben : Array.from({ length: ANZAHL_FARBEN }, (_, i) => i);
  for (let spalte = 0; spalte < SPALTEN; spalte++) {
    const e = schritt(s);
    s = e.saat;
    neu[0]![spalte] = liste[Math.floor(e.wert * liste.length)]!;
  }

  // Alte Zeilen eine tiefer. Was unten herausfällt, ist ohnehin verloren —
  // in dem Fall ist die Runde über `tiefsteZeile` längst vorbei.
  for (let zeile = 0; zeile < ZEILEN - 1; zeile++) {
    for (let spalte = 0; spalte < SPALTEN; spalte++) {
      neu[zeile + 1]![spalte] = wabe[zeile]![spalte]!;
    }
  }

  return { wabe: neu, saat: s };
}

export type SchussErgebnis = {
  zustand: Zustand;
  /** Felder, die durch die Gruppe geplatzt sind — für die Anzeige. */
  geplatzt: Punkt[];
  /** Felder, die danach heruntergefallen sind — für die Anzeige. */
  gefallen: Punkt[];
};

/**
 * Die geschossene Kugel dockt am angegebenen Feld an. Das Feld muss frei
 * sein; welches es ist, hat die Anzeige über die Flugbahn ermittelt.
 */
export function andocken(z: Zustand, ziel: Punkt): SchussErgebnis {
  if (z.vorbei || z.wabe[ziel.zeile]?.[ziel.spalte] !== null) {
    return { zustand: z, geplatzt: [], gefallen: [] };
  }

  const wabe = z.wabe.map((zeile) => [...zeile]);
  wabe[ziel.zeile]![ziel.spalte] = z.aktuell;

  const gruppe = gruppeAb(wabe, ziel);
  let geplatzt: Punkt[] = [];
  let gefallen: Punkt[] = [];
  let punkte = z.punkte;

  if (gruppe.length >= MIN_GRUPPE) {
    geplatzt = gruppe;
    for (const p of gruppe) wabe[p.zeile]![p.spalte] = null;
    punkte += gruppe.length * PUNKTE_JE_KUGEL;

    gefallen = haengendeKugeln(wabe);
    for (const p of gefallen) wabe[p.zeile]![p.spalte] = null;
    punkte += gefallen.length * PUNKTE_JE_GEFALLEN;
  }

  // Nachschub erst zählen, wenn nichts geplatzt ist — ein Treffer soll
  // belohnt werden, nicht auch noch die Wabe herunterdrücken.
  const seitNachschub = geplatzt.length > 0 ? z.seitNachschub : z.seitNachschub + 1;
  let stand: Feld[][] = wabe;
  let saat = z.saat;
  let zaehler = seitNachschub;

  if (seitNachschub >= NACHSCHUB_NACH_SCHUESSEN) {
    const nach = nachschubZeile(stand, saat);
    stand = nach.wabe;
    saat = nach.saat;
    zaehler = 0;
  }

  const gewonnen = wabeLeer(stand);
  const vorbei = gewonnen || tiefsteZeile(stand) >= VERLUST_ZEILE;

  // Die Vorschaukugel wurde einen Schuss früher gezogen, als das Feld noch
  // anders aussah. Platzt mit diesem Schuss die letzte Kugel ihrer Farbe,
  // läge genau eine Farbe im Rohr, die es gar nicht mehr gibt — dieser eine
  // Schuss könnte dann unmöglich eine Dreiergruppe bilden und wäre
  // zwangsläufig verschenkt. Also dieselbe Prüfung wie in `farbeZiehen`,
  // nur eben auch für die schon gezogene Kugel.
  const uebrig = vorhandeneFarben(stand);
  let imRohr = z.naechste;
  let s = saat;
  if (uebrig.length > 0 && !uebrig.includes(imRohr)) {
    const ersatz = farbeZiehen(stand, s);
    imRohr = ersatz.farbe;
    s = ersatz.saat;
  }

  const gezogen = farbeZiehen(stand, s);

  return {
    zustand: {
      wabe: stand,
      aktuell: imRohr,
      naechste: gezogen.farbe,
      punkte,
      seitNachschub: zaehler,
      vorbei,
      gewonnen,
      saat: gezogen.saat,
    },
    geplatzt,
    gefallen,
  };
}
