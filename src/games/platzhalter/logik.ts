import { rng } from '../../core/rng';

/**
 * Star Dash — Spiellogik als reine Funktionen, ohne React und ohne Uhr.
 *
 * **Die Regel in einem Satz:** Ein Wisch schickt den Sternenschlucker in eine Richtung, und er
 * **gleitet, bis etwas im Weg ist** — alle Sterne auf dem Weg schluckt er mit. Man steuert also
 * nicht Schritt für Schritt, sondern wählt Anlauf und Bremse: Ein Fels ist ein Prellbock, den man
 * zum Anhalten braucht, ein Loch oder ein Komet kostet Zeit.
 *
 * Vorher war das Spiel ein Feld von fünf mal fünf, auf dem ein einziger Stern an einem Zufallsort
 * auftauchte und man ihn Schritt für Schritt ablief, bis fünfzehn Sekunden um waren. Es war der
 * Platzhalter aus dem ersten Bauabschnitt — und er war nie mehr als das: Der vierzigste Stern war
 * so leicht wie der erste, und es gab nichts zu planen. Jetzt gibt es **Wellen**: Eine Welle ist
 * ein kleines Rätsel (Felsen, Sterne, später Löcher und Kometen), das man in möglichst wenigen
 * Gleitzügen löst, bevor die Zeit abläuft.
 *
 * Alles hier ist rundenbasiert: Zeit vergeht nur in `zeitLaufen`, alles andere geschieht, wenn
 * jemand wischt. Dadurch ist jede Welle ohne Browser prüfbar — auch, dass sie **lösbar** ist.
 */

export type Richtung = 'up' | 'down' | 'left' | 'right';
export type Punkt = { x: number; y: number };
export type Stern = Punkt & { gold: boolean };
/** Ein Komet fliegt in `(dx, dy)` und kehrt an jedem Hindernis um. Er bewegt sich einmal je Gleitzug. */
export type Komet = Punkt & { dx: number; dy: number };

export const BREITE = 6;
export const HOEHE = 7;
export const START_ZEIT = 40;
/** Was ein Loch, ein Komet oder ein Treffer kostet, in Sekunden. */
export const STRAFE_S = 3;
export const STERN_PUNKTE = 10;
export const GOLD_PUNKTE = 30;
export const WELLEN_PUNKTE = 50;
/** Je Zug unter „Bestmarke + Spielraum" gibt es diese Punkte zusätzlich. */
export const EFFIZIENZ_PUNKTE = 25;
export const EFFIZIENZ_SPIELRAUM = 2;

const RICHTUNG: Record<Richtung, Punkt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const ALLE: readonly Richtung[] = ['up', 'down', 'left', 'right'];

export type Zustand = {
  breite: number;
  hoehe: number;
  spieler: Punkt;
  felsen: readonly Punkt[];
  loecher: readonly Punkt[];
  sterne: readonly Stern[];
  kometen: readonly Komet[];
  welle: number;
  /** Anzahl Gleitzüge der besten Lösung dieser Welle — die „Bestmarke". */
  par: number;
  /** Gleitzüge, die in dieser Welle schon gemacht wurden. */
  zuege: number;
  punkte: number;
  restZeit: number;
  /** Alle Sterne sind geschluckt; die nächste Welle wartet auf `naechsteWelle`. */
  welleGeschafft: boolean;
  vorbei: boolean;
  /** Wandert bei jeder neuen Welle weiter — gleiche Startsaat, gleicher Ablauf. */
  saat: number;
};

export type Welle = {
  felsen: Punkt[];
  loecher: Punkt[];
  sterne: Stern[];
  kometen: Komet[];
  par: number;
};

/** Was eine Welle enthält. Steigt langsam, mit Decken: Ein Feld von 42 Kacheln verträgt nur so viel. */
export function wellenPlan(nummer: number) {
  return {
    felsen: Math.min(4 + Math.floor(nummer * 0.7), 11),
    loecher: nummer >= 3 ? Math.min(1 + Math.floor((nummer - 3) / 3), 3) : 0,
    kometen: nummer >= 5 ? Math.min(1 + Math.floor((nummer - 5) / 4), 2) : 0,
    sterne: Math.min(3 + Math.floor((nummer - 1) / 2), 7),
    gold: nummer >= 3 ? 1 : 0,
  };
}

/**
 * Zeit, die eine geschaffte Welle zurückgibt.
 *
 * An der Bestmarke gemessen: Wer für einen Gleitzug rund eine Sekunde braucht, kommt mit dem
 * Bonus knapp hin — wer länger grübelt, verliert Zeit, wer schnell ist, gewinnt welche. Ein fester
 * Betrag würde kleine Wellen verschenken und große bestrafen.
 *
 * **Der Bonus schrumpft mit der Welle** (zwei Prozent je Welle, bis auf die Hälfte). Ab Welle 15 ist
 * das Brett nicht mehr schwerer — es gibt keine weiteren Felsen, Sterne oder Kometen —, und ohne
 * diese Schraube könnte ein sicherer Spieler endlos weiterspielen. So bleibt am Ende nur noch das
 * Tempo, und die Bestenliste misst, wie lange man mithalten kann.
 */
export function wellenZeit(par: number, welle = 1): number {
  const faktor = Math.max(0.5, 1 - (welle - 1) * 0.02);
  return (4 + 1.5 * par) * faktor;
}

// ---------------------------------------------------------------------
// Gleiten
// ---------------------------------------------------------------------

const schluessel = (breite: number, p: Punkt) => p.y * breite + p.x;

/**
 * Die Felder, über die man von `von` aus in `richtung` gleitet — ohne das Startfeld, bis kurz vor
 * das erste gesperrte Feld oder den Rand. **Die Grundlage von allem:** Das Spiel gleitet mit dieser
 * Funktion, und der Lösungsbeweis geht mit derselben Funktion durch das Brett.
 */
export function gleitWeg(
  breite: number,
  hoehe: number,
  gesperrt: ReadonlySet<number>,
  von: Punkt,
  richtung: Richtung,
): Punkt[] {
  const d = RICHTUNG[richtung];
  const weg: Punkt[] = [];
  let x = von.x + d.x;
  let y = von.y + d.y;
  while (x >= 0 && x < breite && y >= 0 && y < hoehe && !gesperrt.has(y * breite + x)) {
    weg.push({ x, y });
    x += d.x;
    y += d.y;
  }
  return weg;
}

const gleich = (a: Punkt, b: Punkt) => a.x === b.x && a.y === b.y;
const enthaelt = (liste: readonly Punkt[], p: Punkt) => liste.some((q) => gleich(q, p));

/** Alle Felder, an denen man nach beliebig vielen Zügen zum Stehen kommt, und alle, über die man dabei gleitet. */
function erreichbar(
  breite: number,
  hoehe: number,
  gesperrt: ReadonlySet<number>,
  start: Punkt,
): { halte: Set<number>; ueberflogen: Set<number> } {
  const halte = new Set<number>([schluessel(breite, start)]);
  const ueberflogen = new Set<number>();
  const schlange: Punkt[] = [start];
  for (let i = 0; i < schlange.length; i++) {
    const p = schlange[i]!;
    for (const r of ALLE) {
      const weg = gleitWeg(breite, hoehe, gesperrt, p, r);
      if (weg.length === 0) continue;
      for (const f of weg) ueberflogen.add(schluessel(breite, f));
      const ziel = weg[weg.length - 1]!;
      const k = schluessel(breite, ziel);
      if (!halte.has(k)) {
        halte.add(k);
        schlange.push(ziel);
      }
    }
  }
  return { halte, ueberflogen };
}

/**
 * Die kürzeste Folge von Gleitzügen, die alle Sterne einsammelt — oder `null`, wenn es keine gibt.
 *
 * Breitensuche über (Standort, Menge der schon geschluckten Sterne). Bei höchstens sieben Sternen
 * und 42 Feldern sind das gut 5000 Zustände — in Millisekunden gerechnet, auch auf einem alten iPad.
 * Sterne sperren den Weg nicht, deshalb genügt die Menge als Gedächtnis.
 *
 * Das ist **doppelt nützlich**: Es beweist, dass eine erzeugte Welle lösbar ist (ein ausgedachtes
 * Rätsel kann es nicht sein), und es liefert die Bestmarke, an der sich der Spieler messen lässt.
 */
export function loesung(
  breite: number,
  hoehe: number,
  gesperrt: ReadonlySet<number>,
  start: Punkt,
  sterne: readonly Punkt[],
): Richtung[] | null {
  const n = sterne.length;
  if (n === 0) return [];
  const voll = (1 << n) - 1;
  const sternBit = new Map<number, number>();
  sterne.forEach((s, i) => sternBit.set(schluessel(breite, s), 1 << i));

  type Knoten = { pos: Punkt; maske: number; vorher: number; zug: Richtung | null };
  const knoten: Knoten[] = [{ pos: start, maske: 0, vorher: -1, zug: null }];
  const gesehen = new Set<number>([schluessel(breite, start) * (voll + 1)]);
  for (let i = 0; i < knoten.length; i++) {
    const k = knoten[i]!;
    for (const r of ALLE) {
      const weg = gleitWeg(breite, hoehe, gesperrt, k.pos, r);
      if (weg.length === 0) continue;
      let maske = k.maske;
      for (const f of weg) maske |= sternBit.get(schluessel(breite, f)) ?? 0;
      const ziel = weg[weg.length - 1]!;
      const id = schluessel(breite, ziel) * (voll + 1) + maske;
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      knoten.push({ pos: ziel, maske, vorher: i, zug: r });
      if (maske === voll) {
        const zuege: Richtung[] = [];
        for (let j = knoten.length - 1; j > 0; j = knoten[j]!.vorher) zuege.unshift(knoten[j]!.zug!);
        return zuege;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Wellen erzeugen
// ---------------------------------------------------------------------

/** Mindestens so viele Felder muss man von der Startstelle aus ansteuern können, sonst ist das Brett eine Zelle. */
const MIN_HALTE = 8;
const VERSUCHE = 80;

/**
 * Baut eine Welle. **Erst würfeln, dann beweisen:** Felsen und Löcher werden gestreut, die Sterne
 * nur auf Felder gesetzt, über die man wirklich gleiten kann, und zuletzt sucht `loesung` die
 * beste Lösung. Gibt es keine, wird neu gewürfelt. Dadurch ist jede Welle lösbar, ohne dass beim
 * Spielen je ein Suchlauf nötig wäre.
 *
 * Kometen zählen für den Beweis nicht mit: Sie sind eine **Gefahr auf Zeit**, keine Mauer.
 */
export function welleErzeugen(
  saat: number,
  nummer: number,
  start: Punkt,
  breite = BREITE,
  hoehe = HOEHE,
): { welle: Welle; saat: number } {
  const zufall = rng(saat);
  const plan = wellenPlan(nummer);
  const alleFelder: Punkt[] = [];
  for (let y = 0; y < hoehe; y++) for (let x = 0; x < breite; x++) alleFelder.push({ x, y });
  const frei = alleFelder.filter((p) => !gleich(p, start));
  /*
   * Wie viele Züge über der Sternzahl die beste Lösung höchstens braucht. Gemessen: Auf einem Brett
   * mit vier Felsen braucht eine zufällige Welle mit drei Sternen im Mittel 4,7 Gleitzüge — für die
   * erste Welle viel zu viel, weil man auf Eis nicht dort anhalten kann, wo man möchte. Am Anfang
   * soll also fast jeder Zug einen Stern bringen, später darf man um die Ecke denken.
   */
  const spielraum = nummer <= 2 ? 0 : nummer <= 5 ? 1 : 2;
  const maxPar = plan.sterne + spielraum;

  for (let versuch = 0; versuch < VERSUCHE; versuch++) {
    const gemischt = zufall.mischen(frei);
    const felsen = gemischt.slice(0, plan.felsen);
    const loecher = gemischt.slice(plan.felsen, plan.felsen + plan.loecher);
    const gesperrt = new Set([...felsen, ...loecher].map((p) => schluessel(breite, p)));

    const { halte, ueberflogen } = erreichbar(breite, hoehe, gesperrt, start);
    if (halte.size < MIN_HALTE) continue;
    const kandidaten = zufall.mischen(
      alleFelder.filter((p) => {
        const k = schluessel(breite, p);
        return !gleich(p, start) && !gesperrt.has(k) && (halte.has(k) || ueberflogen.has(k));
      }),
    );
    if (kandidaten.length < plan.sterne) continue;

    const sterne: Stern[] = kandidaten.slice(0, plan.sterne).map((p, i) => ({ ...p, gold: i < plan.gold }));
    const weg = loesung(breite, hoehe, gesperrt, start, sterne);
    if (!weg) continue;
    // Zu leicht (alles auf einer Linie) oder zu mühsam wäre keine gute Welle.
    if (weg.length > maxPar) continue;
    if (plan.sterne >= 3 && weg.length < 2) continue;

    const kometen = kometenSetzen(zufall, plan.kometen, breite, hoehe, gesperrt, start, sterne);
    return { welle: { felsen, loecher, sterne, kometen, par: weg.length }, saat: zufall.saat() };
  }

  // Auffangnetz, das nicht erreicht werden sollte: ein leeres Brett mit drei Sternen.
  const sterne: Stern[] = frei
    .filter((p) => Math.abs(p.x - start.x) + Math.abs(p.y - start.y) >= 2)
    .slice(0, 3)
    .map((p) => ({ ...p, gold: false }));
  const weg = loesung(breite, hoehe, new Set(), start, sterne) ?? [];
  return { welle: { felsen: [], loecher: [], sterne, kometen: [], par: weg.length }, saat: zufall.saat() };
}

/** Kometen auf freie Strecken setzen: Sie brauchen mindestens drei freie Felder in einer Linie. */
function kometenSetzen(
  zufall: ReturnType<typeof rng>,
  anzahl: number,
  breite: number,
  hoehe: number,
  gesperrt: ReadonlySet<number>,
  start: Punkt,
  sterne: readonly Punkt[],
): Komet[] {
  if (anzahl === 0) return [];
  // Alle freien Strecken (waagerecht und senkrecht) mit mindestens drei Feldern.
  const strecken: { felder: Punkt[]; dx: number; dy: number }[] = [];
  const sammeln = (felder: Punkt[], dx: number, dy: number) => {
    let lauf: Punkt[] = [];
    const abschliessen = () => {
      if (lauf.length >= 3) strecken.push({ felder: lauf, dx, dy });
      lauf = [];
    };
    for (const p of felder) {
      if (gesperrt.has(schluessel(breite, p))) abschliessen();
      else lauf.push(p);
    }
    abschliessen();
  };
  for (let y = 0; y < hoehe; y++) sammeln(Array.from({ length: breite }, (_, x) => ({ x, y })), 1, 0);
  for (let x = 0; x < breite; x++) sammeln(Array.from({ length: hoehe }, (_, y) => ({ x, y })), 0, 1);

  const kometen: Komet[] = [];
  for (const s of zufall.mischen(strecken)) {
    if (kometen.length >= anzahl) break;
    // Nicht auf dem Start, einem Stern oder einem anderen Kometen beginnen.
    const moegliche = s.felder.filter(
      (p) => !gleich(p, start) && !enthaelt(sterne, p) && !enthaelt(kometen, p),
    );
    if (moegliche.length === 0) continue;
    const p = zufall.waehlen(moegliche);
    const vorzeichen = zufall.zahl() < 0.5 ? 1 : -1;
    kometen.push({ ...p, dx: s.dx * vorzeichen, dy: s.dy * vorzeichen });
  }
  return kometen;
}

export function neuesSpiel(saat: number, breite = BREITE, hoehe = HOEHE): Zustand {
  const spieler = { x: Math.floor(breite / 2) - 1, y: Math.floor(hoehe / 2) };
  const e = welleErzeugen(saat, 1, spieler, breite, hoehe);
  return {
    breite,
    hoehe,
    spieler,
    felsen: e.welle.felsen,
    loecher: e.welle.loecher,
    sterne: e.welle.sterne,
    kometen: e.welle.kometen,
    welle: 1,
    par: e.welle.par,
    zuege: 0,
    punkte: 0,
    restZeit: START_ZEIT,
    welleGeschafft: false,
    vorbei: false,
    saat: e.saat,
  };
}

/** Die nächste Welle: Der Sternenschlucker bleibt, wo er steht. */
export function naechsteWelle(z: Zustand): Zustand {
  if (!z.welleGeschafft || z.vorbei) return z;
  const e = welleErzeugen(z.saat, z.welle + 1, z.spieler, z.breite, z.hoehe);
  return {
    ...z,
    felsen: e.welle.felsen,
    loecher: e.welle.loecher,
    sterne: e.welle.sterne,
    kometen: e.welle.kometen,
    welle: z.welle + 1,
    par: e.welle.par,
    zuege: 0,
    welleGeschafft: false,
    saat: e.saat,
  };
}

// ---------------------------------------------------------------------
// Kometen
// ---------------------------------------------------------------------

/**
 * Jeder Komet macht einen Schritt. An Rand, Fels, Loch oder einem anderen Kometen kehrt er um und
 * bleibt dieses eine Mal stehen. Wäre der nächste Schritt das Feld des Spielers, ist das ein
 * **Treffer**: Der Komet kehrt um (er liegt nie auf dem Spieler), und es kostet Zeit.
 */
export function kometenZiehen(
  z: Pick<Zustand, 'breite' | 'hoehe' | 'felsen' | 'loecher'>,
  kometen: readonly Komet[],
  spieler: Punkt,
): { kometen: Komet[]; getroffen: boolean } {
  const neu: Komet[] = [];
  let getroffen = false;
  kometen.forEach((k, i) => {
    const n = { x: k.x + k.dx, y: k.y + k.dy };
    // `0 - x` statt `-x`: Sonst entsteht aus 0 ein negatives Null, das `toEqual` und manche Vergleiche unterscheiden.
    const umkehren = { ...k, dx: 0 - k.dx, dy: 0 - k.dy };
    if (gleich(n, spieler)) {
      getroffen = true;
      neu.push(umkehren);
      return;
    }
    const draussen = n.x < 0 || n.x >= z.breite || n.y < 0 || n.y >= z.hoehe;
    const andere = [...neu, ...kometen.slice(i + 1)];
    if (draussen || enthaelt(z.felsen, n) || enthaelt(z.loecher, n) || enthaelt(andere, n)) {
      neu.push(umkehren);
      return;
    }
    neu.push({ ...k, x: n.x, y: n.y });
  });
  return { kometen: neu, getroffen };
}

// ---------------------------------------------------------------------
// Ein Gleitzug
// ---------------------------------------------------------------------

/** `schritt`: Nichts war im Weg, die Figur ist nur nach dem einen erlaubten Feld stehen geblieben. */
export type Anprall = 'wand' | 'fels' | 'loch' | 'komet' | 'schritt';

export type Gleiten = {
  zustand: Zustand;
  /** Die Felder des Weges, ohne das Startfeld, in Reihenfolge. */
  weg: Punkt[];
  /** Geschluckte Sterne; `schritt` ist die Stelle in `weg` (ab 1), an der der Stern lag. */
  gesammelt: { stern: Stern; schritt: number }[];
  /** Was den Sternenschlucker gestoppt hat. */
  anprall: Anprall;
  /** Hat Zeit gekostet, weil ein Loch oder ein Komet im Weg war. */
  strafe: boolean;
  /** Hat ein Komet den Sternenschlucker nach dem Zug getroffen? */
  kometGetroffen: boolean;
  /** Hat sich der Sternenschlucker überhaupt bewegt? Ein Wisch gegen eine Wand ist kein Zug. */
  bewegt: boolean;
  /** Mehrere Sterne in einem Zug: je Stern zählt der Wert mal Anzahl. */
  kombo: number;
  /** Punkte nur für die Sterne dieses Zuges. */
  sternPunkte: number;
  /** Punkte für das Ende der Welle (0, wenn sie noch nicht geschafft ist). */
  welleBonus: number;
  welleGeschafft: boolean;
};

function leer(z: Zustand, anprall: Anprall = 'wand'): Gleiten {
  return {
    zustand: z,
    weg: [],
    gesammelt: [],
    anprall,
    strafe: false,
    kometGetroffen: false,
    bewegt: false,
    kombo: 0,
    sternPunkte: 0,
    welleBonus: 0,
    welleGeschafft: false,
  };
}

/** Setzt die Zeit und beendet die Runde, wenn sie aufgebraucht ist. */
function mitZeit(z: Zustand, restZeit: number): Zustand {
  return restZeit <= 0 ? { ...z, restZeit: 0, vorbei: true } : { ...z, restZeit };
}

/**
 * Ein Zug in eine Richtung. Ohne `hoechstens` gleitet die Figur, bis etwas im Weg ist; mit
 * `hoechstens = 1` macht sie genau **einen Schritt**.
 *
 * Der Einzelschritt war in der ersten Fassung gar nicht vorgesehen — das Spiel sollte ein
 * Gleit-Rätsel sein. Rückmeldung: „ich kann keine einzelnen Kästchen hüpfen." Er ist jetzt der
 * zweite Weg, und er ist **kein Schlupfloch**: Ein Schritt ist ein vollwertiger Zug. Er zählt für
 * die Bestmarke, lässt die Kometen ziehen und kostet beim Wählen Zeit — wer sich Feld für Feld
 * vorantastet, ist langsamer und bekommt weniger Wertung als jemand, der den Gleitzug sieht. Die
 * Bestmarke selbst bleibt die beste Folge von Gleitzügen (`loesung`).
 */
export function gleiten(z: Zustand, richtung: Richtung, hoechstens = Infinity): Gleiten {
  if (z.vorbei || z.welleGeschafft) return leer(z);

  const d = RICHTUNG[richtung];
  const weg: Punkt[] = [];
  const gesammelt: { stern: Stern; schritt: number }[] = [];
  const uebrig = [...z.sterne];
  let pos = z.spieler;
  let anprall: Anprall;
  for (;;) {
    if (weg.length >= hoechstens) {
      anprall = 'schritt';
      break;
    }
    const n = { x: pos.x + d.x, y: pos.y + d.y };
    if (n.x < 0 || n.x >= z.breite || n.y < 0 || n.y >= z.hoehe) {
      anprall = 'wand';
      break;
    }
    if (enthaelt(z.felsen, n)) {
      anprall = 'fels';
      break;
    }
    if (enthaelt(z.loecher, n)) {
      anprall = 'loch';
      break;
    }
    if (enthaelt(z.kometen, n)) {
      anprall = 'komet';
      break;
    }
    pos = n;
    weg.push(n);
    const i = uebrig.findIndex((s) => gleich(s, n));
    if (i >= 0) {
      gesammelt.push({ stern: uebrig[i]!, schritt: weg.length });
      uebrig.splice(i, 1);
    }
  }

  const strafe = anprall === 'loch' || anprall === 'komet';
  let zeit = z.restZeit - (strafe ? STRAFE_S : 0);

  /*
   * Direkt vor dem Hindernis: Es bewegt sich nichts, aber wer gegen ein Loch oder einen Kometen
   * wischt, hat einen Zug **gemacht** — die Kometen ziehen. Ohne das gäbe es eine Sackgasse ohne
   * Ausweg: Steht ein Komet in einem Gang und ist jede andere Richtung eine Wand, käme man nie
   * weiter, weil der Komet sich nur bewegt, wenn jemand zieht. Der Fund stammt aus der
   * Zeitwirtschafts-Probe im Test, nicht vom Spielen.
   */
  if (weg.length === 0) {
    if (!strafe) return leer(z, anprall);
    const komet = kometenZiehen(z, z.kometen, z.spieler);
    if (komet.getroffen) zeit -= STRAFE_S;
    return {
      ...leer(mitZeit({ ...z, kometen: komet.kometen }, zeit), anprall),
      strafe,
      kometGetroffen: komet.getroffen,
    };
  }

  const kombo = gesammelt.length;
  const sternPunkte =
    gesammelt.reduce((summe, g) => summe + (g.stern.gold ? GOLD_PUNKTE : STERN_PUNKTE), 0) * kombo;
  const zuege = z.zuege + 1;
  let punkte = z.punkte + sternPunkte;

  const basis = { weg, gesammelt, anprall, strafe, bewegt: true, kombo, sternPunkte };

  if (uebrig.length === 0) {
    // Letzter Stern: Die Welle ist geschafft, die Kometen bleiben stehen.
    const welleBonus =
      WELLEN_PUNKTE + EFFIZIENZ_PUNKTE * Math.max(0, z.par + EFFIZIENZ_SPIELRAUM - zuege);
    punkte += welleBonus;
    zeit += wellenZeit(z.par, z.welle);
    return {
      ...basis,
      kometGetroffen: false,
      welleBonus,
      welleGeschafft: true,
      zustand: mitZeit(
        { ...z, spieler: pos, sterne: [], punkte, zuege, welleGeschafft: true },
        zeit,
      ),
    };
  }

  const komet = kometenZiehen(z, z.kometen, pos);
  if (komet.getroffen) zeit -= STRAFE_S;
  return {
    ...basis,
    kometGetroffen: komet.getroffen,
    welleBonus: 0,
    welleGeschafft: false,
    zustand: mitZeit(
      { ...z, spieler: pos, sterne: uebrig, kometen: komet.kometen, punkte, zuege },
      zeit,
    ),
  };
}

/** Die Zeit läuft — nicht, solange eine Welle gefeiert wird. */
export function zeitLaufen(z: Zustand, dt: number): Zustand {
  if (z.vorbei || z.welleGeschafft) return z;
  return mitZeit(z, z.restZeit - dt);
}

/** Die Felder, die ein Gleitzug nicht überqueren kann (Felsen und Löcher), als Menge. */
export function gesperrteFelder(z: Pick<Zustand, 'breite' | 'felsen' | 'loecher'>): Set<number> {
  return new Set([...z.felsen, ...z.loecher].map((p) => schluessel(z.breite, p)));
}

/** Der beste nächste Zug laut Lösung — für Tests und einen späteren Tipp. */
export function besterZug(z: Zustand): Richtung | null {
  const weg = loesung(z.breite, z.hoehe, gesperrteFelder(z), z.spieler, z.sterne);
  return weg && weg.length > 0 ? weg[0]! : null;
}
