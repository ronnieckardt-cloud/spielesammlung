/**
 * Bubble Pop — reine Spiellogik, ohne Anzeige.
 *
 * Das Feld ist ein Wabenraster: jede zweite Zeile ist um eine halbe Kugel
 * nach rechts versetzt. Eine geschossene Kugel dockt an der Wabe an; treffen
 * dabei drei oder mehr gleiche Farben zusammen, platzen sie. Kugeln, die
 * dadurch den Halt zur obersten Zeile verlieren, fallen hinterher.
 *
 * Darüber liegen die Entscheidungen, die aus einem Zielspiel ein Spiel machen:
 * **Tauschen** (Kugel im Rohr gegen die nächste), eine **Serie** mit
 * wachsendem Faktor, zwei verdiente **Spezialkugeln** (Bombe, Regenbogen),
 * **Felsen**, die sich nicht nach Farbe auflösen lassen, und **Etappen** —
 * ein leeres Feld beendet die Runde nicht mehr, sondern bringt das nächste,
 * härtere.
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

/**
 * Der Wert eines Felsens im Feld. Die Farben sind 0 bis `ANZAHL_FARBEN - 1`;
 * der Fels liegt bewusst weit darüber, damit er nie mit einem Farbindex
 * verwechselt wird (die Anzeige rechnet Farben mit `% 5`).
 */
export const STEIN = 9;

/** null = leeres Feld, sonst der Farbindex — oder `STEIN`. */
export type Feld = number | null;
export type Wabe = readonly (readonly Feld[])[];

export type Punkt = { spalte: number; zeile: number };

/** Die zwei Spezialkugeln. Man verdient sie, hebt sie auf und legt sie selbst ins Rohr. */
export type Spezial = 'bombe' | 'regenbogen';

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
  /**
   * `true`, sobald **irgendwann** ein Feld leergeräumt wurde. Die Runde endet damit nicht — es ist das
   * Sieg-Merkmal für die Hülle („Gewonnen!" statt „Vorbei"), wie bei 2048 in Merge Up.
   */
  gewonnen: boolean;
  saat: number;
  /** Welches Feld gerade gespielt wird, ab 1. */
  etappe: number;
  /** Wie viele Schüsse hintereinander etwas platzen ließen. Ein Fehlschuss setzt sie auf 0. */
  serie: number;
  /** Die aufgehobene Spezialkugel, höchstens eine. */
  spezial: Spezial | null;
  /** `true`, wenn die Spezialkugel schon im Rohr liegt (der nächste Schuss ist dann sie). */
  bereit: boolean;
};

/** Nach so vielen Schüssen ohne Treffer rückt in der ersten Etappe von oben eine neue Zeile nach. */
export const NACHSCHUB_NACH_SCHUESSEN = 8;

/**
 * Wie oft in einer Etappe Nachschub kommt: 8, 7, 6, danach bei 5 gedeckelt. Der Nachschub ist
 * die einzige Bedrohung im Spiel — jede Etappe lässt weniger Fehlschüsse zu.
 */
export function nachschubIntervall(etappe: number): number {
  return Math.max(4, NACHSCHUB_NACH_SCHUESSEN + 2 - 2 * Math.max(1, Math.floor(etappe)));
}

/** Wie viele Zeilen eine Etappe gefüllt beginnt: fünf, ab der zweiten sechs (mehr lässt keinen Anflug übrig). */
export function startZeilenFuer(etappe: number): number {
  return Math.min(7, START_ZEILEN + Math.max(0, Math.floor(etappe) - 1));
}

/** Felsen zu Beginn einer Etappe: keine in der ersten, dann 3, 5, 7 und höchstens 8. */
export function felsenFuer(etappe: number): number {
  return etappe <= 1 ? 0 : Math.min(12, 2 * Math.floor(etappe));
}

/** Der höchste Faktor, den eine Serie bringt. */
export const FAKTOR_MAX = 4;

/** Was ein Schuss zählt, wenn er der `serie`-te in Folge war, der etwas platzen ließ. */
export function serieFaktor(serie: number): number {
  return Math.max(1, Math.min(FAKTOR_MAX, Math.floor(serie)));
}

/** Prämie für ein leergeräumtes Feld, mal der Nummer der Etappe. */
export const ETAPPEN_BONUS = 500;

/** Wie viele Kugeln ein Schuss herunterholen muss, damit es eine Bombe gibt. */
export const BOMBE_AB_GEFALLEN = 4;

/** Jeder wievielte Schuss in einer Serie einen Regenbogen bringt. */
export const REGENBOGEN_ALLE = 4;

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
  // Felsen lösen sich nicht nach Farbe auf: Auch drei nebeneinander sind keine Gruppe.
  if (farbe === STEIN) return [];

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
    // Ein Fels ist keine Farbe: Käme er ins Rohr, wäre der Schuss verloren.
    for (const f of zeile) if (f !== null && f !== STEIN) farben.add(f);
  }
  return [...farben].sort((a, b) => a - b);
}

function farbeZiehen(wabe: Wabe, saat: number): { farbe: number; saat: number } {
  const moeglich = vorhandeneFarben(wabe);
  const liste = moeglich.length > 0 ? moeglich : Array.from({ length: ANZAHL_FARBEN }, (_, i) => i);
  const e = schritt(saat);
  return { farbe: liste[Math.floor(e.wert * liste.length)]!, saat: e.saat };
}

/**
 * Das Feld, mit dem eine Etappe beginnt, und die Saat danach.
 *
 * Felsen liegen nur in den Zeilen 1 bis 3, **nie in Zeile 0**: Dort würden sie ewig hängen bleiben, denn
 * ein Fels fällt nur, wenn alles verschwindet, was ihn hält — und ein Feld mit einem Fels in der obersten
 * Zeile ließe sich nie leerräumen. Der Nachschub schiebt sie später tiefer, aber auch dort bleibt über
 * ihnen immer etwas Farbiges, das sich auflösen lässt.
 */
export function etappenWabe(etappe: number, saat: number): { wabe: Feld[][]; saat: number } {
  const wabe = leereWabe();
  let s = saat;
  const zeilen = startZeilenFuer(etappe);
  for (let zeile = 0; zeile < zeilen; zeile++) {
    for (let spalte = 0; spalte < SPALTEN; spalte++) {
      const e = schritt(s);
      s = e.saat;
      wabe[zeile]![spalte] = Math.floor(e.wert * ANZAHL_FARBEN);
    }
  }

  let offen = felsenFuer(etappe);
  for (let versuch = 0; offen > 0 && versuch < 200; versuch++) {
    const ez = schritt(s);
    const es = schritt(ez.saat);
    s = es.saat;
    const zeile = 1 + Math.floor(ez.wert * Math.min(4, zeilen - 1));
    const spalte = Math.floor(es.wert * SPALTEN);
    if (wabe[zeile]![spalte] === STEIN) continue;
    wabe[zeile]![spalte] = STEIN;
    offen--;
  }
  return { wabe, saat: s };
}

/**
 * Ein neues Spiel. `etappe` ist nur zum Ausprobieren gedacht (Tests, Bildschirmfotos): Wer direkt in einer
 * späteren Etappe beginnt, gilt als „gewonnen", als hätte er die früheren geräumt.
 */
export function neuesSpiel(saat: number, etappe = 1): Zustand {
  const start = etappenWabe(etappe, saat);
  const erste = farbeZiehen(start.wabe, start.saat);
  const zweite = farbeZiehen(start.wabe, erste.saat);

  return {
    wabe: start.wabe,
    aktuell: erste.farbe,
    naechste: zweite.farbe,
    punkte: 0,
    seitNachschub: 0,
    vorbei: false,
    gewonnen: etappe > 1,
    saat: zweite.saat,
    etappe,
    serie: 0,
    spezial: null,
    bereit: false,
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

/** Welche Art Kugel geschossen wurde. */
export type SchussArt = 'normal' | Spezial;

export type SchussErgebnis = {
  zustand: Zustand;
  /** Felder, die durch die Gruppe (oder die Bombe) geplatzt sind — für die Anzeige. */
  geplatzt: Punkt[];
  /** Felder, die danach heruntergefallen sind — für die Anzeige. */
  gefallen: Punkt[];
  art: SchussArt;
  /** Mit welchem Faktor dieser Schuss gezählt hat (1, wenn nichts platzte). */
  faktor: number;
  /** Was dieser Schuss an Punkten gebracht hat, samt Faktor und Etappenprämie. */
  gewinn: number;
  /** In welcher Farbe der Regenbogen gelandet ist — nur bei einem Regenbogen-Schuss. */
  regenbogenFarbe: number | null;
  /** Eine Spezialkugel, die dieser Schuss eingebracht hat. */
  verdient: Spezial | null;
  /** Hat dieser Schuss das Feld leergeräumt? Dann ist `zustand` schon das neue Feld. */
  etappeGeschafft: boolean;
};

/**
 * Die Farbe, die ein Regenbogen an dieser Stelle annimmt: die, mit der die größte Gruppe entsteht.
 *
 * Es zählen nur die Farben, die tatsächlich daneben liegen — ein Regenbogen, der eine Farbe annimmt, die
 * dort niemand hat, wäre nie mehr als eine gewöhnliche Kugel. Bei Gleichstand gewinnt der kleinere Index,
 * damit die Wahl nie vom Zufall abhängt (die Anzeige zeigt sie schon vor dem Schuss).
 */
export function regenbogenFarbe(wabe: Wabe, ziel: Punkt, vorgabe: number): number {
  const kandidaten = new Set<number>();
  for (const n of nachbarn(ziel)) {
    const f = wabe[n.zeile]![n.spalte];
    if (f !== null && f !== undefined && f !== STEIN) kandidaten.add(f);
  }
  if (kandidaten.size === 0) return vorgabe;

  let beste = vorgabe;
  let groesse = -1;
  for (const farbe of [...kandidaten].sort((a, b) => a - b)) {
    const probe = wabe.map((zeile) => [...zeile]);
    probe[ziel.zeile]![ziel.spalte] = farbe;
    const n = gruppeAb(probe, ziel).length;
    if (n > groesse) {
      groesse = n;
      beste = farbe;
    }
  }
  return beste;
}

/** Die Kugel im Rohr gegen die nächste tauschen. Kostet nichts — aber nicht, solange die Spezialkugel im Rohr liegt. */
export function tauschen(z: Zustand): Zustand {
  if (z.vorbei || z.bereit || z.aktuell === z.naechste) return z;
  return { ...z, aktuell: z.naechste, naechste: z.aktuell };
}

/** Die Spezialkugel ins Rohr legen — oder wieder herausnehmen, falls man es sich anders überlegt. */
export function spezialUmschalten(z: Zustand): Zustand {
  if (z.vorbei || z.spezial === null) return z;
  return { ...z, bereit: !z.bereit };
}

/**
 * Die geschossene Kugel dockt am angegebenen Feld an. Das Feld muss frei
 * sein; welches es ist, hat die Anzeige über die Flugbahn ermittelt.
 *
 * Liegt die Spezialkugel im Rohr, ist **sie** der Schuss: Die gewöhnliche Kugel und die nächste bleiben
 * unangetastet.
 */
export function andocken(z: Zustand, ziel: Punkt): SchussErgebnis {
  const nichts: SchussErgebnis = {
    zustand: z,
    geplatzt: [],
    gefallen: [],
    art: 'normal',
    faktor: 1,
    gewinn: 0,
    regenbogenFarbe: null,
    verdient: null,
    etappeGeschafft: false,
  };
  if (z.vorbei || z.wabe[ziel.zeile]?.[ziel.spalte] !== null) return nichts;

  const art: SchussArt = z.bereit && z.spezial ? z.spezial : 'normal';
  const wabe = z.wabe.map((zeile) => [...zeile]);
  let geplatzt: Punkt[] = [];
  /** Wie viele echte Kugeln (und Felsen) dieser Schuss entfernt hat — nur die bringen Punkte. */
  let entfernt = 0;
  let farbeRegenbogen: number | null = null;

  if (art === 'bombe') {
    // Die Bombe sprengt ihr Feld und alle sechs Nachbarn, ganz gleich welche Farbe — auch Felsen.
    for (const n of nachbarn(ziel)) {
      if (wabe[n.zeile]![n.spalte] === null) continue;
      wabe[n.zeile]![n.spalte] = null;
      geplatzt.push(n);
      entfernt++;
    }
    if (entfernt > 0) geplatzt = [ziel, ...geplatzt];
  } else {
    let farbe = z.aktuell;
    if (art === 'regenbogen') {
      farbe = regenbogenFarbe(z.wabe, ziel, z.aktuell);
      farbeRegenbogen = farbe;
    }
    wabe[ziel.zeile]![ziel.spalte] = farbe;
    const gruppe = gruppeAb(wabe, ziel);
    if (gruppe.length >= MIN_GRUPPE) {
      geplatzt = gruppe;
      entfernt = gruppe.length;
      for (const p of gruppe) wabe[p.zeile]![p.spalte] = null;
    }
  }

  const getroffen = entfernt > 0;
  let gefallen: Punkt[] = [];
  if (getroffen) {
    gefallen = haengendeKugeln(wabe);
    for (const p of gefallen) wabe[p.zeile]![p.spalte] = null;
  }

  // Die Serie zählt Schüsse, die etwas bewirkt haben — und der Faktor gilt schon für den Schuss, der sie
  // verlängert: Der zweite Treffer in Folge ist der erste mit ×2.
  const serie = getroffen ? z.serie + 1 : 0;
  const faktor = getroffen ? serieFaktor(serie) : 1;
  let gewinn = (entfernt * PUNKTE_JE_KUGEL + gefallen.length * PUNKTE_JE_GEFALLEN) * faktor;

  // Spezialkugel: verbraucht, wenn sie geschossen wurde — und neu verdient, solange man keine hat.
  let spezial: Spezial | null = art === 'normal' ? z.spezial : null;
  let verdient: Spezial | null = null;
  if (spezial === null && getroffen) {
    if (gefallen.length >= BOMBE_AB_GEFALLEN) verdient = 'bombe';
    else if (serie > 0 && serie % REGENBOGEN_ALLE === 0) verdient = 'regenbogen';
    spezial = verdient;
  }

  // Nachschub erst zählen, wenn nichts geplatzt ist — ein Treffer soll
  // belohnt werden, nicht auch noch die Wabe herunterdrücken.
  const seitNachschub = getroffen ? z.seitNachschub : z.seitNachschub + 1;
  let stand: Feld[][] = wabe;
  let saat = z.saat;
  let zaehler = seitNachschub;

  if (seitNachschub >= nachschubIntervall(z.etappe)) {
    const nach = nachschubZeile(stand, saat);
    stand = nach.wabe;
    saat = nach.saat;
    zaehler = 0;
  }

  // Leergeräumt: Das nächste, härtere Feld beginnt — mit einer Prämie. Das Spiel endet nur durch die
  // Verlustzeile.
  const geschafft = wabeLeer(stand);
  let etappe = z.etappe;
  if (geschafft) {
    gewinn += ETAPPEN_BONUS * z.etappe;
    etappe = z.etappe + 1;
    const neu = etappenWabe(etappe, saat);
    stand = neu.wabe;
    saat = neu.saat;
    zaehler = 0;
  }

  const vorbei = !geschafft && tiefsteZeile(stand) >= VERLUST_ZEILE;

  // Die Vorschaukugel wurde einen Schuss früher gezogen, als das Feld noch
  // anders aussah. Platzt mit diesem Schuss die letzte Kugel ihrer Farbe,
  // läge genau eine Farbe im Rohr, die es gar nicht mehr gibt — dieser eine
  // Schuss könnte dann unmöglich eine Dreiergruppe bilden und wäre
  // zwangsläufig verschenkt. Also dieselbe Prüfung wie in `farbeZiehen`,
  // nur eben auch für die schon gezogene Kugel. Das gilt ebenso für die
  // Kugel im Rohr, wenn ein neues Feld begonnen hat.
  const uebrig = vorhandeneFarben(stand);
  let s = saat;
  let imRohr = z.naechste;
  let vorn = z.aktuell;
  if (uebrig.length > 0 && !uebrig.includes(imRohr)) {
    const ersatz = farbeZiehen(stand, s);
    imRohr = ersatz.farbe;
    s = ersatz.saat;
  }
  // Bei einem Spezialschuss bleibt die gewöhnliche Kugel im Rohr; sonst rückt die nächste nach.
  let naechste: number;
  if (art === 'normal') {
    vorn = imRohr;
    const gezogen = farbeZiehen(stand, s);
    naechste = gezogen.farbe;
    s = gezogen.saat;
  } else {
    if (uebrig.length > 0 && !uebrig.includes(vorn)) {
      const ersatz = farbeZiehen(stand, s);
      vorn = ersatz.farbe;
      s = ersatz.saat;
    }
    naechste = imRohr;
  }

  return {
    zustand: {
      wabe: stand,
      aktuell: vorn,
      naechste,
      punkte: z.punkte + gewinn,
      seitNachschub: zaehler,
      vorbei,
      gewonnen: z.gewonnen || geschafft,
      saat: s,
      etappe,
      serie,
      spezial,
      bereit: false,
    },
    geplatzt,
    gefallen,
    art,
    faktor,
    gewinn,
    regenbogenFarbe: farbeRegenbogen,
    verdient,
    etappeGeschafft: geschafft,
  };
}
