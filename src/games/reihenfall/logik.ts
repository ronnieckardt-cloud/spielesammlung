import { schritt } from '../../core/rng';

/**
 * Reihenfall: fallende Vierlinge, wie das Original — aber mit eigenem Namen
 * und eigenen Farben. Reine Logik, kein React, testbar ohne Klick.
 */

export const BREITE = 10;
export const HOEHE = 20;
export const SPERR_VERZOEGERUNG = 0.5; // Sekunden Zeit zum Verschieben/Drehen nach dem Aufsetzen
export const MAX_SPERR_VERLAENGERUNGEN = 15; // Deckel, damit man nicht endlos schweben kann
export const VORSCHAU_ANZAHL = 3;

export type Zelle = number | null; // null = leer, sonst Farbindex (0..6, ein Teiltyp je Farbe)
export type Feld = readonly (readonly Zelle[])[]; // feld[y][x], y=0 oben

export type TeilTyp = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Drehlage = 0 | 1 | 2 | 3; // 0=Start, 1=im Uhrzeigersinn, 2=180°, 3=gegen den Uhrzeigersinn

export type Versatz = { dx: number; dy: number };
export type Punkt = { x: number; y: number };

export type Stein = {
  typ: TeilTyp;
  lage: Drehlage;
  x: number; // Position der Bounding-Box im Feld
  y: number;
};

export type Aktion =
  | 'links'
  | 'rechts'
  | 'drehenUhr'
  | 'drehenGegenUhr'
  | 'weichFallen'
  | 'hartFallen'
  | 'halten';

export type Zustand = {
  feld: Feld;
  aktuell: Stein | null;
  haltePosition: TeilTyp | null;
  halteBenutzt: boolean;
  /** Immer mindestens VORSCHAU_ANZAHL Einträge — die nächsten Teile, in Zugreihenfolge. */
  warteschlange: readonly TeilTyp[];
  /** Rest des aktuellen 7er-Beutels, noch nicht in die Warteschlange gezogen. */
  beutel: readonly TeilTyp[];
  punkte: number;
  zeilenGesamt: number;
  level: number;
  sperrZeitRest: number;
  sperrVerlaengerungenUebrig: number;
  fallzeitRest: number;
  vorbei: boolean;
  saat: number;
  /** Aufeinanderfolgende Vierfach-Löschungen, für den Bonus. */
  vierfachStreak: number;
  /**
   * Die zuletzt gelöschten Zeilen — nur zum Anzeigen, die Logik liest das
   * nie zurück. Der Inhalt wird **vor** dem Entfernen gesichert, sonst
   * wüsste die Anzeige nicht mehr, welche Farben da eben noch lagen.
   *
   * `tick` zählt bei jeder Löschung hoch. Ohne ihn wäre eine zweite
   * Löschung derselben Zeile mit denselben Farben von der ersten nicht zu
   * unterscheiden, und die Animation liefe kein zweites Mal an.
   */
  geloescht: Geloescht;
};

/** Siehe `Zustand.geloescht`. */
export type Geloescht = {
  tick: number;
  zeilen: readonly { y: number; farben: readonly Zelle[] }[];
};

export const FARB_INDEX: Record<TeilTyp, number> = { I: 0, O: 1, T: 2, S: 3, Z: 4, J: 5, L: 6 };
const ALLE_TEILE: readonly TeilTyp[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/**
 * Formen im SRS-Stil (Standard-Drehsystem): pro Teil vier Lagen, jede als
 * vier Versatz-Zellen in einer festen Bounding-Box. y wächst nach unten.
 */
export const FORMEN: Record<TeilTyp, Record<Drehlage, readonly Versatz[]>> = {
  I: {
    0: [{ dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 3, dy: 1 }],
    1: [{ dx: 2, dy: 0 }, { dx: 2, dy: 1 }, { dx: 2, dy: 2 }, { dx: 2, dy: 3 }],
    2: [{ dx: 0, dy: 2 }, { dx: 1, dy: 2 }, { dx: 2, dy: 2 }, { dx: 3, dy: 2 }],
    3: [{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }, { dx: 1, dy: 3 }],
  },
  O: {
    0: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
    1: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
    2: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
    3: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
  },
  T: {
    0: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }],
    1: [{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 1, dy: 2 }],
    2: [{ dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 1, dy: 2 }],
    3: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }],
  },
  S: {
    0: [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
    1: [{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 2, dy: 2 }],
    2: [{ dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }],
    3: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }],
  },
  Z: {
    0: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }],
    1: [{ dx: 2, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 1, dy: 2 }],
    2: [{ dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }, { dx: 2, dy: 2 }],
    3: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }],
  },
  J: {
    0: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }],
    1: [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }],
    2: [{ dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 2, dy: 2 }],
    3: [{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }],
  },
  L: {
    0: [{ dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }],
    1: [{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }, { dx: 2, dy: 2 }],
    2: [{ dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 0, dy: 2 }],
    3: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }],
  },
};

/** Wandtritte im SRS-Stil, y nach unten (das Feld-Koordinatensystem). */
const KICKS_JLSTZ: Record<string, readonly Versatz[]> = {
  '0-1': [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: 2 }, { dx: -1, dy: 2 }],
  '1-0': [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: -2 }, { dx: 1, dy: -2 }],
  '1-2': [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: -2 }, { dx: 1, dy: -2 }],
  '2-1': [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: 2 }, { dx: -1, dy: 2 }],
  '2-3': [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: -1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }],
  '3-2': [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: -2 }, { dx: -1, dy: -2 }],
  '3-0': [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: -2 }, { dx: -1, dy: -2 }],
  '0-3': [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: -1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }],
};

const KICKS_I: Record<string, readonly Versatz[]> = {
  '0-1': [{ dx: 0, dy: 0 }, { dx: -2, dy: 0 }, { dx: 1, dy: 0 }, { dx: -2, dy: 1 }, { dx: 1, dy: -2 }],
  '1-0': [{ dx: 0, dy: 0 }, { dx: 2, dy: 0 }, { dx: -1, dy: 0 }, { dx: 2, dy: -1 }, { dx: -1, dy: 2 }],
  '1-2': [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 2, dy: 0 }, { dx: -1, dy: -2 }, { dx: 2, dy: 1 }],
  '2-1': [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: -2, dy: 0 }, { dx: 1, dy: 2 }, { dx: -2, dy: -1 }],
  '2-3': [{ dx: 0, dy: 0 }, { dx: 2, dy: 0 }, { dx: -1, dy: 0 }, { dx: 2, dy: -1 }, { dx: -1, dy: 2 }],
  '3-2': [{ dx: 0, dy: 0 }, { dx: -2, dy: 0 }, { dx: 1, dy: 0 }, { dx: -2, dy: 1 }, { dx: 1, dy: -2 }],
  '3-0': [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: -2, dy: 0 }, { dx: 1, dy: 2 }, { dx: -2, dy: -1 }],
  '0-3': [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 2, dy: 0 }, { dx: -1, dy: -2 }, { dx: 2, dy: 1 }],
};

function kickTabelle(typ: TeilTyp, von: Drehlage, nach: Drehlage): readonly Versatz[] {
  if (typ === 'O') return [{ dx: 0, dy: 0 }];
  const schluessel = `${von}-${nach}`;
  const tabelle = typ === 'I' ? KICKS_I : KICKS_JLSTZ;
  return tabelle[schluessel] ?? [{ dx: 0, dy: 0 }];
}

export function leeresFeld(): Feld {
  return Array.from({ length: HOEHE }, () => Array.from({ length: BREITE }, () => null));
}

export function zellenVonStein(stein: Stein): readonly Punkt[] {
  return FORMEN[stein.typ][stein.lage].map((v) => ({ x: stein.x + v.dx, y: stein.y + v.dy }));
}

export function kollidiert(feld: Feld, stein: Stein): boolean {
  return zellenVonStein(stein).some(({ x, y }) => {
    if (x < 0 || x >= BREITE || y >= HOEHE) return true;
    if (y < 0) return false; // oberhalb des sichtbaren Felds ist immer frei
    return feld[y]![x] !== null;
  });
}

export function bewegen(feld: Feld, stein: Stein, dx: number, dy: number): Stein | null {
  const neu = { ...stein, x: stein.x + dx, y: stein.y + dy };
  return kollidiert(feld, neu) ? null : neu;
}

export function rotieren(feld: Feld, stein: Stein, richtung: 1 | -1): Stein | null {
  const neueLage = (((stein.lage + richtung) % 4) + 4) % 4 as Drehlage;
  for (const versatz of kickTabelle(stein.typ, stein.lage, neueLage)) {
    const kandidat: Stein = { ...stein, lage: neueLage, x: stein.x + versatz.dx, y: stein.y + versatz.dy };
    if (!kollidiert(feld, kandidat)) return kandidat;
  }
  return null;
}

export function geisterStein(feld: Feld, stein: Stein): Stein {
  let aktuell = stein;
  for (;;) {
    const naechster = bewegen(feld, aktuell, 0, 1);
    if (!naechster) return aktuell;
    aktuell = naechster;
  }
}

export function steinEinbetten(feld: Feld, stein: Stein, farbe: number): Feld {
  const neu = feld.map((zeile) => [...zeile]);
  for (const { x, y } of zellenVonStein(stein)) {
    if (y >= 0 && y < HOEHE && x >= 0 && x < BREITE) neu[y]![x] = farbe;
  }
  return neu;
}

export function volleZeilen(feld: Feld): number[] {
  const ergebnis: number[] = [];
  for (let y = 0; y < HOEHE; y++) if (feld[y]!.every((z) => z !== null)) ergebnis.push(y);
  return ergebnis;
}

export function zeilenEntfernen(feld: Feld, zeilen: readonly number[]): Feld {
  if (zeilen.length === 0) return feld;
  const zeilenSet = new Set(zeilen);
  const rest = feld.filter((_, y) => !zeilenSet.has(y));
  const neueLeer: Zelle[][] = Array.from({ length: zeilen.length }, () => Array(BREITE).fill(null));
  return [...neueLeer, ...rest];
}

const PUNKTE_PRO_ZEILEN: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 };
const VIERFACH_BONUS_PRO_STUFE = 200;

/** 1/2/3/4 Zeilen ungleich gewichtet, plus Bonus für mehrere Vierfachlöschungen hintereinander. */
export function punkteFuerZeilen(anzahl: number, level: number, vierfachStreakNachher: number): number {
  if (anzahl === 0) return 0;
  let punkte = (PUNKTE_PRO_ZEILEN[anzahl] ?? 0) * level;
  if (anzahl === 4 && vierfachStreakNachher > 1) {
    punkte += VIERFACH_BONUS_PRO_STUFE * level * (vierfachStreakNachher - 1);
  }
  return punkte;
}

export function punkteFuerHartesFallen(zellen: number): number {
  return Math.max(0, zellen) * 2;
}

export function punkteFuerWeichesFallen(zellen: number): number {
  return Math.max(0, zellen) * 1;
}

export function levelFuerZeilen(zeilenGesamt: number): number {
  return Math.floor(zeilenGesamt / 10) + 1;
}

/** Sekunden pro Feld Fallzeit — wird mit dem Level kürzer, nie unter einen Sockel. */
export function fallintervallFuerLevel(level: number): number {
  return Math.max(0.1, 1 - (level - 1) * 0.08);
}

function steinErzeugen(typ: TeilTyp): Stein {
  const form = FORMEN[typ][0];
  const minDy = Math.min(...form.map((v) => v.dy));
  const breite = Math.max(...form.map((v) => v.dx)) + 1;
  return { typ, lage: 0, x: Math.floor((BREITE - breite) / 2), y: -minDy };
}

function beutelMischen(saat: number): { beutel: readonly TeilTyp[]; saat: number } {
  const gemischt = [...ALLE_TEILE];
  let s = saat;
  for (let i = gemischt.length - 1; i > 0; i--) {
    const e = schritt(s);
    s = e.saat;
    const j = Math.floor(e.wert * (i + 1));
    [gemischt[i], gemischt[j]] = [gemischt[j] as TeilTyp, gemischt[i] as TeilTyp];
  }
  return { beutel: gemischt, saat: s };
}

/** Füllt die Warteschlange auf mindestens VORSCHAU_ANZAHL + 1 Einträge auf. */
function nachfuellen(
  beutel: readonly TeilTyp[],
  warteschlange: readonly TeilTyp[],
  saat: number,
): { beutel: readonly TeilTyp[]; warteschlange: readonly TeilTyp[]; saat: number } {
  let b = beutel;
  const w = [...warteschlange];
  let s = saat;
  while (w.length < VORSCHAU_ANZAHL + 1) {
    if (b.length === 0) {
      const neu = beutelMischen(s);
      b = neu.beutel;
      s = neu.saat;
    }
    w.push(b[0]!);
    b = b.slice(1);
  }
  return { beutel: b, warteschlange: w, saat: s };
}

function ausWarteschlangeZiehen(z: Pick<Zustand, 'beutel' | 'warteschlange' | 'saat'>): {
  typ: TeilTyp;
  beutel: readonly TeilTyp[];
  warteschlange: readonly TeilTyp[];
  saat: number;
} {
  const [typ, ...rest] = z.warteschlange;
  const aufgefuellt = nachfuellen(z.beutel, rest, z.saat);
  return { typ: typ!, ...aufgefuellt };
}

export function neuesSpiel(saat: number): Zustand {
  const start = nachfuellen([], [], saat);
  const gezogen = ausWarteschlangeZiehen(start);
  return {
    feld: leeresFeld(),
    aktuell: steinErzeugen(gezogen.typ),
    haltePosition: null,
    halteBenutzt: false,
    warteschlange: gezogen.warteschlange,
    beutel: gezogen.beutel,
    saat: gezogen.saat,
    punkte: 0,
    zeilenGesamt: 0,
    level: 1,
    sperrZeitRest: SPERR_VERZOEGERUNG,
    sperrVerlaengerungenUebrig: MAX_SPERR_VERLAENGERUNGEN,
    fallzeitRest: fallintervallFuerLevel(1),
    vorbei: false,
    vierfachStreak: 0,
    geloescht: { tick: 0, zeilen: [] },
  };
}

function einrasten(z: Zustand): Zustand {
  if (!z.aktuell) return z;
  const eingebettet = steinEinbetten(z.feld, z.aktuell, FARB_INDEX[z.aktuell.typ]);
  const zeilen = volleZeilen(eingebettet);
  const feld = zeilenEntfernen(eingebettet, zeilen);

  const zeilenGesamt = z.zeilenGesamt + zeilen.length;
  const level = levelFuerZeilen(zeilenGesamt);
  const vierfachStreak = zeilen.length === 4 ? z.vierfachStreak + 1 : 0;
  const punkte = z.punkte + punkteFuerZeilen(zeilen.length, z.level, vierfachStreak);

  const gezogen = ausWarteschlangeZiehen(z);
  const neuerStein = steinErzeugen(gezogen.typ);
  const vorbei = kollidiert(feld, neuerStein);

  return {
    ...z,
    feld,
    aktuell: vorbei ? null : neuerStein,
    haltePosition: z.haltePosition,
    halteBenutzt: false,
    warteschlange: gezogen.warteschlange,
    beutel: gezogen.beutel,
    saat: gezogen.saat,
    punkte,
    zeilenGesamt,
    level,
    sperrZeitRest: SPERR_VERZOEGERUNG,
    sperrVerlaengerungenUebrig: MAX_SPERR_VERLAENGERUNGEN,
    fallzeitRest: fallintervallFuerLevel(level),
    vorbei,
    vierfachStreak,
    // Nur bei einer echten Löschung neu setzen. Bei einem Zug ohne volle
    // Zeile bleibt der alte Eintrag stehen, sein `tick` ändert sich nicht —
    // die Anzeige lässt die Animation dann einfach auslaufen, statt sie bei
    // jedem einzelnen abgelegten Stein neu zu starten.
    geloescht:
      zeilen.length > 0
        ? {
            tick: z.geloescht.tick + 1,
            zeilen: zeilen.map((y) => ({ y, farben: eingebettet[y]! })),
          }
        : z.geloescht,
  };
}

function verlaengereWennAmBoden(z: Zustand): Zustand {
  if (!z.aktuell) return z;
  const amBoden = bewegen(z.feld, z.aktuell, 0, 1) === null;
  if (!amBoden) return z;
  if (z.sperrVerlaengerungenUebrig <= 0) return z; // Deckel erreicht — Zeit läuft ungebremst weiter
  return { ...z, sperrZeitRest: SPERR_VERZOEGERUNG, sperrVerlaengerungenUebrig: z.sperrVerlaengerungenUebrig - 1 };
}

function haltenAnwenden(z: Zustand): Zustand {
  if (!z.aktuell || z.halteBenutzt) return z;

  if (z.haltePosition === null) {
    const gezogen = ausWarteschlangeZiehen(z);
    return {
      ...z,
      aktuell: steinErzeugen(gezogen.typ),
      haltePosition: z.aktuell.typ,
      halteBenutzt: true,
      warteschlange: gezogen.warteschlange,
      beutel: gezogen.beutel,
      saat: gezogen.saat,
      sperrZeitRest: SPERR_VERZOEGERUNG,
      fallzeitRest: fallintervallFuerLevel(z.level),
    };
  }

  return {
    ...z,
    aktuell: steinErzeugen(z.haltePosition),
    haltePosition: z.aktuell.typ,
    halteBenutzt: true,
    sperrZeitRest: SPERR_VERZOEGERUNG,
    fallzeitRest: fallintervallFuerLevel(z.level),
  };
}

/** Eine einzelne Eingabe verarbeiten — Bewegen, Drehen, Fallen, Halten. */
export function aktionAnwenden(z: Zustand, aktion: Aktion): Zustand {
  if (z.vorbei || !z.aktuell) return z;

  if (aktion === 'halten') return haltenAnwenden(z);

  if (aktion === 'hartFallen') {
    const ziel = geisterStein(z.feld, z.aktuell);
    const zellen = ziel.y - z.aktuell.y;
    return einrasten({ ...z, aktuell: ziel, punkte: z.punkte + punkteFuerHartesFallen(zellen) });
  }

  if (aktion === 'weichFallen') {
    const runter = bewegen(z.feld, z.aktuell, 0, 1);
    if (!runter) return z;
    return verlaengereWennAmBoden({
      ...z,
      aktuell: runter,
      punkte: z.punkte + punkteFuerWeichesFallen(1),
      fallzeitRest: fallintervallFuerLevel(z.level),
    });
  }

  const neuerStein =
    aktion === 'links'
      ? bewegen(z.feld, z.aktuell, -1, 0)
      : aktion === 'rechts'
        ? bewegen(z.feld, z.aktuell, 1, 0)
        : aktion === 'drehenUhr'
          ? rotieren(z.feld, z.aktuell, 1)
          : rotieren(z.feld, z.aktuell, -1);

  if (!neuerStein) return z;
  return verlaengereWennAmBoden({ ...z, aktuell: neuerStein });
}

/**
 * Zeit vergehen lassen: Schwerkraft und Lock-Delay. Wird jeden Spieltakt
 * mit der vergangenen Zeit aufgerufen.
 */
export function zeitFortschritt(z: Zustand, dt: number): Zustand {
  if (z.vorbei || !z.aktuell) return z;

  const amBoden = bewegen(z.feld, z.aktuell, 0, 1) === null;

  if (!amBoden) {
    let stein = z.aktuell;
    let fallzeitRest = z.fallzeitRest - dt;
    while (fallzeitRest <= 0) {
      const naechster = bewegen(z.feld, stein, 0, 1);
      if (!naechster) {
        fallzeitRest = 0;
        break;
      }
      stein = naechster;
      fallzeitRest += fallintervallFuerLevel(z.level);
    }
    return { ...z, aktuell: stein, fallzeitRest, sperrZeitRest: SPERR_VERZOEGERUNG };
  }

  const sperrZeitRest = z.sperrZeitRest - dt;
  if (sperrZeitRest > 0) return { ...z, sperrZeitRest };
  return einrasten(z);
}
