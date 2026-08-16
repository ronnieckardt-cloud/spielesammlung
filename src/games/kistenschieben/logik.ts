import { LEVEL } from './level';

/**
 * Box Push — die Regeln.
 *
 * Man **schiebt** Kisten, man zieht sie nie. Das ist die ganze Härte des
 * Spiels: Eine Kiste in einer Ecke bleibt für immer dort. Deshalb gehört
 * ein **Zurück-Knopf** zwingend dazu — ohne ihn müsste ein Kind bei jedem
 * Fehler von vorn anfangen, und Fehler sind hier der Normalfall.
 *
 * Reine Funktionen ohne React. Der Zustand ist absichtlich flach und
 * kopierbar, damit die Zug-Geschichte einfach eine Liste alter Zustände
 * sein kann.
 */

export type Punkt = { x: number; y: number };
export type Richtung = 'oben' | 'unten' | 'links' | 'rechts';

export const VERSATZ: Record<Richtung, Punkt> = {
  oben: { x: 0, y: -1 },
  unten: { x: 0, y: 1 },
  links: { x: -1, y: 0 },
  rechts: { x: 1, y: 0 },
};

export type Brett = {
  breite: number;
  hoehe: number;
  /** Feste Wände. Ändern sich nie. */
  wand: readonly boolean[];
  /** Zielfelder. Ändern sich nie. */
  ziel: readonly boolean[];
};

export type Zustand = {
  level: number;
  brett: Brett;
  spieler: Punkt;
  /**
   * Die Kisten. Zu Beginn aufsteigend nach Feldnummer, danach bleibt **jede
   * Kiste auf ihrem Platz in der Liste** — ein Schub tauscht nur die Zahl an
   * dieser einen Stelle aus.
   *
   * Das ist keine Kosmetik: Nur so hat eine Kiste über die Züge hinweg eine
   * feste Nummer, und nur dann kann die Anzeige sie von A nach B **fahren**
   * lassen. Wurde die Liste nach jedem Schub neu sortiert, war die
   * geschobene Kiste für React ein anderes Element — sie sprang.
   */
  kisten: readonly number[];
  zuege: number;
  /** Frühere Stände für den Zurück-Knopf. */
  verlauf: readonly { spieler: Punkt; kisten: readonly number[] }[];
  geloest: boolean;
};

export const alsFeld = (p: Punkt, breite: number) => p.y * breite + p.x;
export const alsPunkt = (feld: number, breite: number): Punkt => ({
  x: feld % breite,
  y: Math.floor(feld / breite),
});

/** Wandelt ein Textraster in ein Brett samt Startaufstellung. */
export function levelLesen(zeilen: readonly string[]): {
  brett: Brett;
  spieler: Punkt;
  kisten: number[];
} {
  const hoehe = zeilen.length;
  const breite = Math.max(...zeilen.map((z) => z.length));
  const wand: boolean[] = [];
  const ziel: boolean[] = [];
  const kisten: number[] = [];
  let spieler: Punkt = { x: 0, y: 0 };

  for (let y = 0; y < hoehe; y++) {
    // Kürzere Zeilen mit Boden auffüllen — sonst müsste jede Zeile in der
    // Leveldatei auf das Zeichen genau stimmen.
    const zeile = (zeilen[y] ?? '').padEnd(breite, ' ');
    for (let x = 0; x < breite; x++) {
      const zeichen = zeile[x]!;
      const feld = y * breite + x;
      wand.push(zeichen === '#');
      ziel.push(zeichen === '.' || zeichen === '*' || zeichen === '+');
      if (zeichen === '$' || zeichen === '*') kisten.push(feld);
      if (zeichen === '@' || zeichen === '+') spieler = { x, y };
    }
  }

  return { brett: { breite, hoehe, wand, ziel }, spieler, kisten: kisten.sort((a, b) => a - b) };
}

/** Wie viele Level gibt es? Danach fängt es von vorn an. */
export const LEVEL_ANZAHL = LEVEL.length;

/**
 * Welches der zwölf Rätsel eine Levelnummer meint.
 *
 * Über die letzte Nummer hinaus geht es von vorn los — besser, als vor einer
 * Sackgasse zu stehen. **Alle drei Stellen müssen dieselbe Zahl benutzen:**
 * das Brett, die Anzeige und die Punkte. Vorher rechneten die Punkte mit der
 * rohen Nummer weiter, während das Brett längst wieder bei eins war — Level
 * 13 war also das Ein-Schub-Rätsel aus Level 1 und brachte trotzdem mehr
 * Punkte als das schwerste. In der Bestenliste stand damit, wer am längsten
 * am Stück gesessen hat, nicht wer sparsam gespielt hat.
 */
export function stufe(level: number): number {
  return ((Math.max(1, level) - 1) % LEVEL_ANZAHL) + 1;
}

export function neuesLevel(nummer: number): Zustand {
  const index = stufe(nummer) - 1;
  const { brett, spieler, kisten } = levelLesen(LEVEL[index]!);
  return {
    level: Math.max(1, nummer),
    brett,
    spieler,
    kisten,
    zuege: 0,
    verlauf: [],
    geloest: kisten.every((k) => brett.ziel[k]),
  };
}

function frei(brett: Brett, feld: number): boolean {
  return !brett.wand[feld];
}

/**
 * Ein Schritt in eine Richtung.
 *
 * Drei Fälle: freies Feld (gehen), Kiste mit Platz dahinter (schieben),
 * alles andere (nichts passiert). Ein Zug, der nichts bewegt, zählt auch
 * nicht — sonst würde stures Gegen-die-Wand-Laufen die Punkte drücken.
 */
export function gehen(z: Zustand, richtung: Richtung): Zustand {
  if (z.geloest) return z;

  const { breite, hoehe } = z.brett;
  const d = VERSATZ[richtung];
  const ziel = { x: z.spieler.x + d.x, y: z.spieler.y + d.y };
  if (ziel.x < 0 || ziel.y < 0 || ziel.x >= breite || ziel.y >= hoehe) return z;

  const zielFeld = alsFeld(ziel, breite);
  if (!frei(z.brett, zielFeld)) return z;

  const vorher = { spieler: z.spieler, kisten: z.kisten };
  const kisteDa = z.kisten.includes(zielFeld);

  if (!kisteDa) {
    return {
      ...z,
      spieler: ziel,
      zuege: z.zuege + 1,
      verlauf: [...z.verlauf, vorher],
    };
  }

  // Schieben: Was liegt hinter der Kiste?
  const dahinter = { x: ziel.x + d.x, y: ziel.y + d.y };
  if (dahinter.x < 0 || dahinter.y < 0 || dahinter.x >= breite || dahinter.y >= hoehe) return z;
  const dahinterFeld = alsFeld(dahinter, breite);
  // Eine Kiste schiebt keine zweite mit — das ist die Regel, an der sich
  // die kniffligen Stellen aufhängen.
  if (!frei(z.brett, dahinterFeld) || z.kisten.includes(dahinterFeld)) return z;

  // Nur die eine Zahl austauschen, nicht neu sortieren: Die geschobene Kiste
  // behält damit ihren Platz in der Liste und die Anzeige kann sie fahren
  // lassen, statt sie springen zu lassen.
  const kisten = z.kisten.map((k) => (k === zielFeld ? dahinterFeld : k));

  return {
    ...z,
    spieler: ziel,
    kisten,
    zuege: z.zuege + 1,
    verlauf: [...z.verlauf, vorher],
    geloest: kisten.every((k) => z.brett.ziel[k]),
  };
}

/**
 * Einen Zug zurück.
 *
 * Zählt als **eigener** Zug, wird also nicht wieder abgezogen. Sonst könnte
 * man beliebig lange probieren und trotzdem die volle Punktzahl abräumen —
 * und Nachdenken wäre umsonst.
 */
export function zurueck(z: Zustand): Zustand {
  const letzter = z.verlauf[z.verlauf.length - 1];
  if (!letzter) return z;
  return {
    ...z,
    spieler: letzter.spieler,
    kisten: letzter.kisten,
    zuege: z.zuege + 1,
    verlauf: z.verlauf.slice(0, -1),
    geloest: false,
  };
}

/** Von vorn — der Zug-Zähler läuft weiter. */
export function neustart(z: Zustand): Zustand {
  const frisch = neuesLevel(z.level);
  return { ...frisch, zuege: z.zuege };
}

/**
 * Punkte für ein Level.
 *
 * Grundwert nach Levelnummer, Abzug je Zug. Der Abzug ist mild: Ein Kind
 * soll ausprobieren dürfen. Unter den Mindestwert fällt niemand.
 *
 * Gerechnet wird mit `stufe(level)`, also mit derselben gedeckelten Nummer
 * wie beim Brett — sonst brächte dasselbe Rätsel in der zweiten Runde mehr
 * Punkte als in der ersten.
 *
 * Der Wert gilt auch für ein **ungelöstes** Level: Er ist das, was gerade
 * noch zu holen ist, und schmilzt mit jedem Zug. Genau so steht er auch in
 * der Kopfzeile — eine Kopfzeile, die die ganze Runde „0" zeigt und im
 * Augenblick des Lösens auf den Endwert springt, erklärt niemandem, dass
 * jeder unnötige Zug etwas kostet.
 */
export function punkteFuerZuege(level: number, zuege: number): number {
  return Math.max(50, 300 + stufe(level) * 30 - zuege * 4);
}
