/**
 * Snake Rush — reine Spiellogik, ohne Anzeige und ohne Uhr.
 *
 * Die Schlange bewegt sich kachelweise über ein Raster. Jeder Apfel verlängert sie und beschleunigt
 * sie; berührt sie sich selbst, einen Felsen oder (in Mauer-Etappen) den Rand, ist die Runde vorbei.
 *
 * **Etappen.** Vorher war das Spiel ein einziger, immer gleicher Platz: fressen, wachsen, schneller
 * werden, bis man sich selbst im Weg steht. Die ersten zwanzig Sekunden sahen aus wie die letzten.
 * Jetzt besteht eine Runde aus **Etappen** zu je sieben Äpfeln, jede mit eigener Arena: Felsen, und
 * in jeder zweiten ein Rand, der **tödlich** ist statt durchlässig. Nach einer Etappe wirft die
 * Schlange einen Teil ihres Schwanzes ab und startet frisch in der Mitte — der Platz wird also
 * nie zum Gedränge, und die Schwierigkeit kommt aus der Arena und dem Tempo, nicht aus der Länge.
 *
 * **Jede Arena ist bewiesen befahrbar** (`arenaGueltig`): Alle freien Felder hängen zusammen, und
 * kein freies Feld hat weniger als zwei freie Nachbarn. Das zweite ist der eigentliche Punkt: Eine
 * Sackgasse ist für eine Schlange der Tod, weil sie nicht umdrehen kann — und ein Apfel darin wäre
 * eine Falle, keine Aufgabe.
 */

import { rng, schritt } from '../../core/rng';

export const BREITE = 17;
export const HOEHE = 17;

/** Startlänge der Schlange, inklusive Kopf. */
export const START_LAENGE = 3;
/**
 * So lang darf die Schlange am Anfang einer Etappe höchstens sein. Sie wird in der mittleren Reihe
 * ausgelegt (Kopf in der Mitte, Schwanz nach links), und dort passen genau neun Glieder hin.
 */
export const MAX_START_LAENGE = 9;

/** Äpfel je Etappe. Weniger fühlt sich nach Hüpfen an, mehr nach Warten. */
export const FUTTER_JE_ETAPPE = 7;

export const PUNKTE_JE_FUTTER = 10;
export const PUNKTE_GOLD = 50;
/** Kleine Belohnung für Zeitlupe und Schere — sie sollen sich lohnen, aber kein Ziel für sich sein. */
export const PUNKTE_HILFE = 20;
/** Etappenprämie: Grundbetrag plus `ETAPPEN_PUNKTE_JE_STUFE` je Etappe. */
export const ETAPPEN_PUNKTE = 100;
export const ETAPPEN_PUNKTE_JE_STUFE = 25;

/** Sekunden je Feld am Anfang — je kleiner, desto schneller. */
export const TAKT_START_S = 0.22;
/** Schnellster Takt, den das Spiel je erreicht. */
export const TAKT_MIN_S = 0.08;
/** Um so viel wird pro Apfel beschleunigt. */
export const TAKT_STUFE_S = 0.006;
/** Um so viel beginnt jede weitere Etappe schneller. */
export const TAKT_ETAPPE_S = 0.01;

/** In der Zeitlupe dauert jedes Feld so viel länger. */
export const ZEITLUPE_FAKTOR = 1.7;
export const ZEITLUPE_SCHRITTE = 16;

/** Glieder, die die Schere abschneidet. */
export const SCHERE_GLIEDER = 4;

/** Wie viele Schritte ein Extra liegen bleibt, bevor es verschwindet. */
export const EXTRA_DAUER_SCHRITTE = 45;
/** Nach so vielen Äpfeln erscheint ein Extra. */
export const EXTRA_JE_FUTTER = 3;

/** Die Serie zählt bis hier. Darüber würde ein einzelner Apfel mehr bringen als ein Goldstern. */
export const KOMBO_MAX = 5;
/** So viele Schritte über dem kürzesten Weg darf ein Apfel dauern und zählt noch für die Serie. */
export const KOMBO_PUFFER = 6;

/** Wie viele Richtungswechsel die Schlange vormerkt. */
export const MAX_PUFFER = 2;

export type Richtung = 'hoch' | 'runter' | 'links' | 'rechts';
export type Punkt = { x: number; y: number };
/** `offen`: am Rand geht es auf der anderen Seite weiter. `mauer`: der Rand ist tödlich. */
export type Rand = 'offen' | 'mauer';
export type ExtraArt = 'gold' | 'zeitlupe' | 'schere';
export type Extra = Punkt & { art: ExtraArt };
export type Ende = 'selbst' | 'fels' | 'mauer';

export const MITTE_X = Math.floor(BREITE / 2);
export const MITTE_Y = Math.floor(HOEHE / 2);

export type Zustand = {
  /** Kopf zuerst, Schwanz zuletzt. */
  schlange: readonly Punkt[];
  richtung: Richtung;
  /** Als Nächstes gewünschte Richtungen — jede gilt erst bei einem eigenen Feldwechsel. */
  gepuffert: readonly Richtung[];
  /** Der Apfel; `null` zwischen dem letzten Apfel einer Etappe und der nächsten Arena. */
  futter: Punkt | null;
  extra: Extra | null;
  /** Restliche Schritte, die das Extra noch liegen bleibt. */
  extraRest: number;
  /** Wie viele Äpfel seit dem letzten Extra gegessen wurden. */
  seitExtra: number;
  felsen: readonly Punkt[];
  rand: Rand;
  etappe: number;
  futterInEtappe: number;
  /** Äpfel in Folge, die rechtzeitig gegessen wurden. 0 = noch keiner in dieser Etappe. */
  serie: number;
  /** Schritte, die der Apfel noch Zeit hat, um die Serie fortzusetzen. */
  komboRest: number;
  zeitlupeRest: number;
  punkte: number;
  /** Sekunden je Feld, sinkt mit jedem Apfel. */
  taktS: number;
  /** Aufgelaufene Zeit seit dem letzten Feldwechsel. */
  angesammelt: number;
  /** Alle Äpfel der Etappe sind gegessen; die nächste Arena wartet auf `naechsteEtappe`. */
  etappeGeschafft: boolean;
  vorbei: boolean;
  ende: Ende | null;
  saat: number;
};

const GEGENRICHTUNG: Record<Richtung, Richtung> = {
  hoch: 'runter',
  runter: 'hoch',
  links: 'rechts',
  rechts: 'links',
};

const VERSATZ: Record<Richtung, Punkt> = {
  hoch: { x: 0, y: -1 },
  runter: { x: 0, y: 1 },
  links: { x: -1, y: 0 },
  rechts: { x: 1, y: 0 },
};

const RICHTUNGEN: readonly Richtung[] = ['hoch', 'runter', 'links', 'rechts'];

const schluessel = (p: Punkt) => `${p.x},${p.y}`;
const gleich = (a: Punkt, b: Punkt) => a.x === b.x && a.y === b.y;

/** Wickelt eine Koordinate am Rand auf die andere Seite. */
function umschlagen(wert: number, grenze: number): number {
  return ((wert % grenze) + grenze) % grenze;
}

/** Das Feld, auf das man von `p` in `richtung` kommt — oder `null`, wenn dort eine Mauer steht. */
export function schrittZiel(p: Punkt, richtung: Richtung, rand: Rand): Punkt | null {
  const v = VERSATZ[richtung];
  const x = p.x + v.x;
  const y = p.y + v.y;
  if (rand === 'mauer') {
    return x < 0 || x >= BREITE || y < 0 || y >= HOEHE ? null : { x, y };
  }
  return { x: umschlagen(x, BREITE), y: umschlagen(y, HOEHE) };
}

// ---------------------------------------------------------------------
// Arenen
// ---------------------------------------------------------------------

/**
 * Was eine Etappe enthält. Gerade Etappen und die erste haben einen durchlässigen Rand, ungerade ab
 * der dritten einen tödlichen — das wechselt, damit man sich nicht an eine Art gewöhnt. Mauer-Etappen
 * bekommen weniger Felsen: Der Rand ist dort schon Hindernis genug.
 */
export function etappenPlan(nummer: number): { rand: Rand; felsen: number } {
  const mauer = nummer >= 3 && nummer % 2 === 1;
  if (nummer === 1) return { rand: 'offen', felsen: 0 };
  return mauer
    ? { rand: 'mauer', felsen: Math.min(nummer + 1, 12) }
    : { rand: 'offen', felsen: Math.min(2 + 2 * nummer, 16) };
}

/** Die Reihe, in der jede Etappe startet — hier liegen nie Felsen. */
export function startKorridor(): Punkt[] {
  const feld: Punkt[] = [];
  for (let x = 0; x <= MITTE_X + 5; x++) feld.push({ x, y: MITTE_Y });
  return feld;
}

/**
 * Ist die Arena befahrbar? Alle freien Felder hängen zusammen (vom Start aus), und **jedes** freie
 * Feld hat mindestens zwei freie Nachbarn. Das zweite schließt Sackgassen aus: Die Schlange kann
 * nicht umdrehen, ein Feld mit nur einem Ausgang ist für sie also eine Falle.
 */
export function arenaGueltig(felsen: readonly Punkt[], rand: Rand): boolean {
  const gesperrt = new Set(felsen.map(schluessel));
  if (gesperrt.has(schluessel({ x: MITTE_X, y: MITTE_Y }))) return false;

  let frei = 0;
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      if (gesperrt.has(schluessel({ x, y }))) continue;
      frei++;
      let nachbarn = 0;
      for (const r of RICHTUNGEN) {
        const z = schrittZiel({ x, y }, r, rand);
        if (z && !gesperrt.has(schluessel(z))) nachbarn++;
      }
      if (nachbarn < 2) return false;
    }
  }

  const besucht = new Set<string>([schluessel({ x: MITTE_X, y: MITTE_Y })]);
  const warteschlange: Punkt[] = [{ x: MITTE_X, y: MITTE_Y }];
  while (warteschlange.length > 0) {
    const p = warteschlange.pop()!;
    for (const r of RICHTUNGEN) {
      const z = schrittZiel(p, r, rand);
      if (!z) continue;
      const k = schluessel(z);
      if (gesperrt.has(k) || besucht.has(k)) continue;
      besucht.add(k);
      warteschlange.push(z);
    }
  }
  return besucht.size === frei;
}

/** Bausteine für die Felsen: einzeln, Paare, Balken und ein Winkel. Aus Einzelfelsen allein wird es Streusel. */
const FORMEN: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]],
];

/**
 * Felsen für eine Etappe würfeln. Jede Form wird nur gesetzt, wenn die Arena danach noch
 * `arenaGueltig` ist — ein Fehlversuch kostet einen Wurf, mehr nicht. Bleibt nach den Versuchen
 * etwas übrig, hat die Arena eben ein paar Felsen weniger; befahrbar ist sie in jedem Fall.
 */
export function felsenErzeugen(
  nummer: number,
  saat: number,
): { felsen: Punkt[]; rand: Rand; saat: number } {
  const plan = etappenPlan(nummer);
  const zufall = rng(saat);
  const reserviert = new Set(startKorridor().map(schluessel));
  const felsen: Punkt[] = [];
  const belegt = new Set<string>();

  for (let versuch = 0; felsen.length < plan.felsen && versuch < 400; versuch++) {
    const form = zufall.waehlen(FORMEN);
    const ox = zufall.ganzzahl(BREITE);
    const oy = zufall.ganzzahl(HOEHE);
    const zellen = form.map(([dx, dy]) => ({ x: ox + dx, y: oy + dy }));
    if (felsen.length + zellen.length > plan.felsen) continue;
    if (
      zellen.some(
        (p) =>
          p.x >= BREITE ||
          p.y >= HOEHE ||
          reserviert.has(schluessel(p)) ||
          belegt.has(schluessel(p)),
      )
    ) {
      continue;
    }
    if (!arenaGueltig([...felsen, ...zellen], plan.rand)) continue;
    for (const p of zellen) {
      felsen.push(p);
      belegt.add(schluessel(p));
    }
  }
  return { felsen, rand: plan.rand, saat: zufall.saat() };
}

// ---------------------------------------------------------------------
// Wege und freie Felder
// ---------------------------------------------------------------------

/** Kürzeste Schrittzahl von `von` nach `nach`, nur über Felder ohne Felsen. `null`, wenn es keinen Weg gibt. */
export function wegLaenge(
  felsen: readonly Punkt[],
  rand: Rand,
  von: Punkt,
  nach: Punkt,
): number | null {
  const gesperrt = new Set(felsen.map(schluessel));
  const ziel = schluessel(nach);
  const abstand = new Map<string, number>([[schluessel(von), 0]]);
  let aktuell: Punkt[] = [von];
  while (aktuell.length > 0) {
    const naechste: Punkt[] = [];
    for (const p of aktuell) {
      const d = abstand.get(schluessel(p))!;
      if (schluessel(p) === ziel) return d;
      for (const r of RICHTUNGEN) {
        const z = schrittZiel(p, r, rand);
        if (!z) continue;
        const k = schluessel(z);
        if (gesperrt.has(k) || abstand.has(k)) continue;
        abstand.set(k, d + 1);
        naechste.push(z);
      }
    }
    aktuell = naechste;
  }
  return null;
}

/**
 * Ein freies Feld suchen — also eines, auf dem nichts von `belegt` liegt. Zählt erst alle freien
 * Felder und wählt dann eines davon, statt blind zu würfeln und bei Treffern zu wiederholen: Der
 * Aufwand ist so auch bei fast vollem Feld begrenzt, und für eine Saat kommt immer dasselbe heraus.
 */
export function freiesFeld(
  belegt: readonly Punkt[],
  saat: number,
): { feld: Punkt | null; saat: number } {
  const gesperrt = new Set(belegt.map(schluessel));
  const frei: Punkt[] = [];
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      if (!gesperrt.has(schluessel({ x, y }))) frei.push({ x, y });
    }
  }
  if (frei.length === 0) return { feld: null, saat };

  const e = schritt(saat);
  return { feld: frei[Math.floor(e.wert * frei.length)]!, saat: e.saat };
}

/** Die Felder in Reichweite von zwei Schritten um den Kopf — dort soll kein neuer Apfel erscheinen. */
function naeheKopf(kopf: Punkt, rand: Rand): Punkt[] {
  const feld: Punkt[] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      const x = kopf.x + dx;
      const y = kopf.y + dy;
      if (rand === 'mauer') {
        if (x >= 0 && x < BREITE && y >= 0 && y < HOEHE) feld.push({ x, y });
      } else {
        feld.push({ x: umschlagen(x, BREITE), y: umschlagen(y, HOEHE) });
      }
    }
  }
  return feld;
}

/**
 * Einen neuen Apfel hinlegen und sagen, wie lange er für die Serie zählt. Das Zeitfenster richtet
 * sich nach dem **echten** Weg (um Felsen herum, über den Rand, wenn er offen ist), nicht nach der
 * Luftlinie: Ein Apfel hinter einer Felswand würde sonst jede Serie zerreißen, ohne dass man etwas
 * falsch gemacht hätte.
 */
function apfelLegen(
  z: Pick<Zustand, 'schlange' | 'felsen' | 'rand' | 'extra'>,
  schlange: readonly Punkt[],
  saat: number,
): { feld: Punkt | null; saat: number; komboRest: number } {
  const kopf = schlange[0]!;
  const basis = [...schlange, ...z.felsen, ...(z.extra ? [z.extra] : [])];
  // Erst mit Abstand zum Kopf; ist dort alles voll, dann notfalls auch direkt davor.
  let e = freiesFeld([...basis, ...naeheKopf(kopf, z.rand)], saat);
  if (!e.feld) e = freiesFeld(basis, saat);
  if (!e.feld) return { feld: null, saat: e.saat, komboRest: 0 };
  const weg = wegLaenge(z.felsen, z.rand, kopf, e.feld) ?? 2 * (BREITE + HOEHE);
  return { feld: e.feld, saat: e.saat, komboRest: weg + KOMBO_PUFFER };
}

// ---------------------------------------------------------------------
// Anfang und Etappenwechsel
// ---------------------------------------------------------------------

/** Takt, mit dem eine Etappe beginnt. */
export function taktStart(etappe: number): number {
  return Math.max(TAKT_MIN_S, TAKT_START_S - TAKT_ETAPPE_S * (etappe - 1));
}

export function etappenBonus(etappe: number): number {
  return ETAPPEN_PUNKTE + ETAPPEN_PUNKTE_JE_STUFE * etappe;
}

/** Wie lang die Schlange in der nächsten Etappe startet: die Hälfte des Zuwachses bleibt, gedeckelt. */
export function startLaengeNach(laenge: number): number {
  return Math.min(MAX_START_LAENGE, START_LAENGE + Math.floor((laenge - START_LAENGE) / 2));
}

/** Die Schlange in der mittleren Reihe: Kopf in der Mitte, der Schwanz nach links. */
function startSchlange(laenge: number): Punkt[] {
  const schlange: Punkt[] = [];
  for (let i = 0; i < laenge; i++) schlange.push({ x: MITTE_X - i, y: MITTE_Y });
  return schlange;
}

function etappeAufbauen(
  saat: number,
  punkte: number,
  etappe: number,
  laenge: number,
): Zustand {
  const arena = felsenErzeugen(etappe, saat);
  const schlange = startSchlange(laenge);
  const apfel = apfelLegen(
    { schlange, felsen: arena.felsen, rand: arena.rand, extra: null },
    schlange,
    arena.saat,
  );
  return {
    schlange,
    richtung: 'rechts',
    gepuffert: [],
    futter: apfel.feld,
    extra: null,
    extraRest: 0,
    seitExtra: 0,
    felsen: arena.felsen,
    rand: arena.rand,
    etappe,
    futterInEtappe: 0,
    serie: 0,
    komboRest: apfel.komboRest,
    zeitlupeRest: 0,
    punkte,
    taktS: taktStart(etappe),
    angesammelt: 0,
    etappeGeschafft: false,
    vorbei: false,
    ende: null,
    saat: apfel.saat,
  };
}

export function neuesSpiel(saat: number): Zustand {
  return etappeAufbauen(saat, 0, 1, START_LAENGE);
}

/** Die nächste Arena. Punkte und ein Teil der Länge bleiben, alles andere fängt neu an. */
export function naechsteEtappe(z: Zustand): Zustand {
  if (!z.etappeGeschafft || z.vorbei) return z;
  return etappeAufbauen(z.saat, z.punkte, z.etappe + 1, startLaengeNach(z.schlange.length));
}

// ---------------------------------------------------------------------
// Eingabe
// ---------------------------------------------------------------------

/**
 * Eine Richtung vormerken — bis zu zwei, in der Reihenfolge, in der sie kamen.
 *
 * Mit nur **einem** Platz ging jede schnelle Doppelkurve verloren („hoch, dann links" um eine Ecke
 * herum): Die zweite Eingabe überschrieb die erste, und die Schlange fuhr geradeaus weiter. Bei
 * zwölf Feldern in der Sekunde ist das der häufigste Grund, warum sich Snake auf dem Handy
 * „unpräzise" anfühlt.
 *
 * Geprüft wird gegen die **zuletzt vorgemerkte** Richtung, nicht gegen die aktuelle: Aus „rechts,
 * hoch" ist „links" erlaubt (erst hoch, dann links), aus „rechts" allein nicht — das wäre der
 * eigene Hals.
 */
export function richtungWaehlen(z: Zustand, richtung: Richtung): Zustand {
  if (z.vorbei || z.etappeGeschafft) return z;
  const letzte = z.gepuffert[z.gepuffert.length - 1] ?? z.richtung;
  if (richtung === letzte || richtung === GEGENRICHTUNG[letzte]) return z;
  if (z.gepuffert.length >= MAX_PUFFER) return z;
  return { ...z, gepuffert: [...z.gepuffert, richtung] };
}

// ---------------------------------------------------------------------
// Ein Schritt
// ---------------------------------------------------------------------

/** Welches Extra als Nächstes kommt. Die Schere nur, wenn die Schlange lang genug ist, dass sie etwas bringt. */
function extraWaehlen(laenge: number, saat: number): { art: ExtraArt; saat: number } {
  const gewichte: { art: ExtraArt; gewicht: number }[] = [
    { art: 'gold', gewicht: 2 },
    { art: 'zeitlupe', gewicht: 1 },
  ];
  if (laenge >= START_LAENGE + SCHERE_GLIEDER) gewichte.push({ art: 'schere', gewicht: 1 });
  const summe = gewichte.reduce((s, g) => s + g.gewicht, 0);
  const e = schritt(saat);
  let rest = e.wert * summe;
  for (const g of gewichte) {
    if (rest < g.gewicht) return { art: g.art, saat: e.saat };
    rest -= g.gewicht;
  }
  return { art: 'gold', saat: e.saat };
}

/** Ein Feld weiterrücken. Kümmert sich um Fressen, Wachsen, Extras und Kollision. */
export function feldWechseln(z: Zustand): Zustand {
  if (z.vorbei || z.etappeGeschafft) return z;

  const richtung = z.gepuffert[0] ?? z.richtung;
  const gepuffert = z.gepuffert.slice(1);
  const alterKopf = z.schlange[0]!;
  const kopf = schrittZiel(alterKopf, richtung, z.rand);

  if (!kopf) return { ...z, richtung, gepuffert, vorbei: true, ende: 'mauer' };
  if (z.felsen.some((f) => gleich(f, kopf))) {
    return { ...z, richtung, gepuffert, vorbei: true, ende: 'fels' };
  }

  const friss = !!z.futter && gleich(kopf, z.futter);
  const holeExtra = !!z.extra && gleich(kopf, z.extra);

  // Ohne Apfel rückt der Schwanz nach — das Feld, das er freigibt, darf der Kopf im selben Schritt
  // betreten. Deshalb erst kürzen, dann prüfen.
  const koerper = friss ? z.schlange : z.schlange.slice(0, -1);
  if (koerper.some((p) => gleich(p, kopf))) {
    return { ...z, richtung, gepuffert, vorbei: true, ende: 'selbst' };
  }

  let schlange: readonly Punkt[] = [kopf, ...koerper];
  let saat = z.saat;
  let futter = z.futter;
  let extra = z.extra;
  let extraRest = extra ? z.extraRest - 1 : 0;
  let seitExtra = z.seitExtra;
  let punkte = z.punkte;
  let taktS = z.taktS;
  let serie = z.serie;
  let komboRest = z.komboRest - 1;
  let zeitlupeRest = Math.max(0, z.zeitlupeRest - 1);
  let futterInEtappe = z.futterInEtappe;
  let etappeGeschafft = false;

  if (holeExtra && extra) {
    if (extra.art === 'gold') {
      punkte += PUNKTE_GOLD;
    } else if (extra.art === 'zeitlupe') {
      punkte += PUNKTE_HILFE;
      zeitlupeRest = ZEITLUPE_SCHRITTE;
    } else {
      punkte += PUNKTE_HILFE;
      schlange = schlange.slice(0, Math.max(START_LAENGE, schlange.length - SCHERE_GLIEDER));
    }
    extra = null;
    extraRest = 0;
  }

  if (friss) {
    // Die erste Frucht einer Etappe eröffnet die Serie, jede weitere setzt sie nur fort, wenn sie
    // rechtzeitig kam. Wer zu spät ist, fängt bei eins wieder an — er bekommt den Apfel trotzdem.
    // Die Serie selbst hört beim Deckel auf zu zählen, nicht nur der Faktor: Das Herz in der
    // Anzeige zeigt diese Zahl, und „×7" neben einem Faktor von höchstens fünf wäre gelogen.
    serie = Math.min(KOMBO_MAX, serie === 0 ? 1 : komboRest >= 0 ? serie + 1 : 1);
    punkte += PUNKTE_JE_FUTTER * serie;
    taktS = Math.max(TAKT_MIN_S, taktS - TAKT_STUFE_S);
    futterInEtappe += 1;
    seitExtra += 1;

    if (futterInEtappe >= FUTTER_JE_ETAPPE) {
      etappeGeschafft = true;
      punkte += etappenBonus(z.etappe);
      futter = null;
      extra = null;
      extraRest = 0;
    } else {
      const apfel = apfelLegen({ schlange, felsen: z.felsen, rand: z.rand, extra }, schlange, saat);
      saat = apfel.saat;
      futter = apfel.feld;
      komboRest = apfel.komboRest;

      // Alle paar Äpfel ein Extra — aber nur, wenn gerade keines liegt, sonst häufen sie sich.
      if (!extra && seitExtra >= EXTRA_JE_FUTTER) {
        const wahl = extraWaehlen(schlange.length, saat);
        const platz = freiesFeld(
          [...schlange, ...z.felsen, ...(futter ? [futter] : [])],
          wahl.saat,
        );
        saat = platz.saat;
        if (platz.feld) {
          extra = { ...platz.feld, art: wahl.art };
          extraRest = EXTRA_DAUER_SCHRITTE;
          seitExtra = 0;
        }
      }
    }
  }

  if (extra && extraRest <= 0) {
    extra = null;
    extraRest = 0;
  }

  return {
    ...z,
    schlange,
    richtung,
    gepuffert,
    futter,
    extra,
    extraRest,
    seitExtra,
    punkte,
    taktS,
    serie,
    komboRest,
    zeitlupeRest,
    futterInEtappe,
    etappeGeschafft,
    vorbei: false,
    saat,
  };
}

/**
 * Sieht das Brett nach diesem Zeitschritt anders aus als vorher?
 *
 * Die Uhr läuft mit 60 Bildern je Sekunde, die Schlange rückt aber nur 4,5- bis 12,5-mal je Sekunde
 * ein Feld weiter. Dazwischen wächst allein `angesammelt`, und daran hängt kein einziger Pixel. Die
 * Anzeige fragt hier nach, ob sich das Neuzeichnen überhaupt lohnt — sonst baut React rund achtzigmal
 * je Sekunde dasselbe Bild noch einmal auf.
 *
 * Verglichen wird über Objektgleichheit: `feldWechseln` legt bei jedem Schritt eine neue Kette an,
 * ohne Schritt bleiben es dieselben Objekte.
 */
export function bildGeaendert(vorher: Zustand, nachher: Zustand): boolean {
  return (
    vorher.schlange !== nachher.schlange ||
    vorher.futter !== nachher.futter ||
    vorher.extra !== nachher.extra ||
    vorher.punkte !== nachher.punkte ||
    // Beim Zusammenstoß bleibt die Kette stehen, nur diese beiden ändern sich.
    vorher.richtung !== nachher.richtung ||
    vorher.vorbei !== nachher.vorbei ||
    vorher.etappeGeschafft !== nachher.etappeGeschafft ||
    vorher.etappe !== nachher.etappe
  );
}

/** Der Takt, mit dem die Schlange gerade wirklich rückt: in der Zeitlupe langsamer. */
export function wirksamerTakt(z: Pick<Zustand, 'taktS' | 'zeitlupeRest'>): number {
  return z.zeitlupeRest > 0 ? z.taktS * ZEITLUPE_FAKTOR : z.taktS;
}

/**
 * Zeit vergehen lassen. Sammelt an, bis ein voller Takt zusammen ist, und rückt dann ein Feld
 * weiter — dadurch ist die Bewegung unabhängig von der Bildrate des Geräts. **Steht still, solange
 * eine Etappe gefeiert wird.**
 */
export function zeitFortschritt(z: Zustand, dt: number): Zustand {
  if (z.vorbei || z.etappeGeschafft) return z;

  let stand: Zustand = { ...z, angesammelt: z.angesammelt + dt };
  // Schleife statt einmaligem Schritt: bei einem Ruckler können mehrere Takte fällig sein.
  // `useGameLoop` begrenzt das bereits nach oben. Der Takt wird je Durchlauf neu gelesen — die
  // Zeitlupe kann mitten in dieser Schleife auslaufen.
  while (!stand.vorbei && !stand.etappeGeschafft && stand.angesammelt >= wirksamerTakt(stand)) {
    const rest = stand.angesammelt - wirksamerTakt(stand);
    stand = feldWechseln(stand);
    stand = { ...stand, angesammelt: rest };
  }
  return stand;
}
