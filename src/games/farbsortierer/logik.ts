import { saatAus, schritt } from '../../core/rng';

/**
 * Farbsortierer: Farbschichten in Röhrchen sortieren.
 *
 * Ein Röhrchen ist ein Stapel von Farben, Index 0 unten, letzter Eintrag
 * oben — dort wird gegossen. Reine Logik, kein React, testbar ohne Klick.
 * Die Anzeige (Farbtöne, Pixel, Animation) weiß hier nichts von; sie
 * bekommt nur Zahlen und Zustände zurück.
 */

export type Farbe = number; // Index in eine Farbpalette — die legt erst die Anzeige fest
export type Roehrchen = readonly Farbe[];
export type Brett = readonly Roehrchen[];

export const KAPAZITAET = 4;
export const LEERE_ROEHRCHEN_START = 2;
export const MIN_FARBEN = 3;
// Bei 6 Farben brauchte der Suchlauf in Tests bis zu 10 Versuche à mehrere
// Sekunden, bevor ein lösbares Brett gefunden war — auf dem Handy spürbar
// hängend. Bei 5 Farben bleibt jeder Versuch durchweg unter 150ms (an vielen
// Levelnummern gemessen), deshalb der Deckel hier.
export const MAX_FARBEN = 5;

type Verlaufseintrag = {
  roehrchen: Brett;
  zuege: number;
  extraRoehrchenUebrig: number;
};

export type Zustand = {
  roehrchen: Brett;
  ausgewaehlt: number | null;
  verlauf: readonly Verlaufseintrag[];
  level: number;
  farbenAnzahl: number;
  zuege: number;
  extraRoehrchenUebrig: number;
  geloest: boolean;
};

/** Wie viele Farben ein Level hat — alle zwei Level eine mehr, gedeckelt. */
export function farbenFuerLevel(level: number): number {
  const stufe = MIN_FARBEN + Math.floor((Math.max(1, level) - 1) / 2);
  return Math.min(stufe, MAX_FARBEN);
}

/**
 * Wie viele leere Röhrchen zum Sortieren bereitstehen.
 *
 * Das ist die eigentliche Schwierigkeits-Stellschraube jenseits von Level 5:
 * Die Farbzahl ist bei 5 gedeckelt (der Lösbarkeits-Suchlauf wird darüber
 * auf dem Handy spürbar langsam, siehe MAX_FARBEN), und dadurch änderte sich
 * ab Level 5 gar nichts mehr — Rückmeldung: „ab Level sechs, sieben wird's
 * nicht mehr richtig schwerer".
 *
 * Ein leeres Röhrchen weniger ist ein großer Sprung: Mit nur einem
 * Zwischenlager muss man viel weiter vorausdenken.
 */
export function leereRoehrchenFuerLevel(level: number): number {
  return Math.max(1, level) >= 8 ? 1 : LEERE_ROEHRCHEN_START;
}

/**
 * Wie viele Extra-Röhrchen man sich im Level dazuholen darf — die
 * Notbremse, wenn man sich festgefahren hat. Ab Level 15 gibt es sie nicht
 * mehr, dann muss der Zug von Anfang an sitzen.
 */
export function extraRoehrchenFuerLevel(level: number): number {
  return Math.max(1, level) >= 15 ? 0 : 1;
}

export function kannGiessen(von: Roehrchen, nach: Roehrchen, kapazitaet = KAPAZITAET): boolean {
  if (von.length === 0) return false;
  if (nach.length >= kapazitaet) return false;
  if (nach.length === 0) return true;
  return von[von.length - 1] === nach[nach.length - 1];
}

/** Wie viele Schichten fließen würden: die oberste Farbe in Serie, begrenzt durch Platz im Ziel. */
export function anzahlUebertragbar(
  von: Roehrchen,
  nach: Roehrchen,
  kapazitaet = KAPAZITAET,
): number {
  if (!kannGiessen(von, nach, kapazitaet)) return 0;
  const farbe = von[von.length - 1];
  let anzahl = 0;
  for (let i = von.length - 1; i >= 0 && von[i] === farbe; i--) anzahl++;
  return Math.min(anzahl, kapazitaet - nach.length);
}

export function giessen(brett: Brett, von: number, nach: number, kapazitaet = KAPAZITAET): Brett {
  const anzahl = anzahlUebertragbar(brett[von], brett[nach], kapazitaet);
  if (anzahl === 0) return brett;
  const farbe = brett[von][brett[von].length - 1];
  const neuesVon = brett[von].slice(0, brett[von].length - anzahl);
  const neuesNach = [...brett[nach], ...Array(anzahl).fill(farbe)];
  return brett.map((r, i) => (i === von ? neuesVon : i === nach ? neuesNach : r));
}

/**
 * Ein Röhrchen ist fertig, wenn es randvoll ist und nur eine Farbe enthält.
 * Nur für die Anzeige gedacht — sie setzt darauf den Deckel und lässt kurz
 * Konfetti fliegen, damit man den kleinen Sieg auch sieht.
 */
export function roehrchenFertig(inhalt: readonly number[], kapazitaet = KAPAZITAET): boolean {
  return inhalt.length === kapazitaet && inhalt.every((f) => f === inhalt[0]);
}

export function istGeloest(brett: Brett, kapazitaet = KAPAZITAET): boolean {
  return brett.every(
    (r) => r.length === 0 || (r.length === kapazitaet && r.every((f) => f === r[0])),
  );
}

function schluessel(brett: Brett): string {
  return brett.map((r) => r.join('.')).join('|');
}

const SUCHBUDGET = 120_000; // untersuchte Zustände, danach gilt der Versuch als nicht rechtzeitig entschieden

/**
 * Breitensuche über alle erreichbaren Bretter: existiert ein Weg zum
 * gelösten Zustand? Bricht nach SUCHBUDGET Zuständen ab (dann "nein" —
 * der Levelgenerator versucht in dem Fall einfach ein anderes Brett).
 */
export function loesbar(start: Brett, kapazitaet = KAPAZITAET, budget = SUCHBUDGET): boolean {
  if (istGeloest(start, kapazitaet)) return true;

  const gesehen = new Set([schluessel(start)]);
  let grenze: Brett[] = [start];
  let untersucht = 0;

  while (grenze.length > 0) {
    const naechsteGrenze: Brett[] = [];
    for (const brett of grenze) {
      for (let von = 0; von < brett.length; von++) {
        if (brett[von].length === 0) continue;
        for (let nach = 0; nach < brett.length; nach++) {
          if (von === nach || !kannGiessen(brett[von], brett[nach], kapazitaet)) continue;

          const neu = giessen(brett, von, nach, kapazitaet);
          if (istGeloest(neu, kapazitaet)) return true;

          const s = schluessel(neu);
          if (gesehen.has(s)) continue;
          gesehen.add(s);
          naechsteGrenze.push(neu);

          if (++untersucht > budget) return false;
        }
      }
    }
    grenze = naechsteGrenze;
  }
  return false;
}

/** Mischt kapazitaet Schichten pro Farbe per Fisher-Yates mit mitgeführter Saat. */
function gemischtesBrett(
  saat: number,
  farbenAnzahl: number,
  kapazitaet: number,
  leereRoehrchen: number,
): { brett: Brett; saat: number } {
  const schichten: Farbe[] = [];
  for (let f = 0; f < farbenAnzahl; f++) {
    for (let i = 0; i < kapazitaet; i++) schichten.push(f);
  }

  let s = saat;
  for (let i = schichten.length - 1; i > 0; i--) {
    const e = schritt(s);
    s = e.saat;
    const j = Math.floor(e.wert * (i + 1));
    [schichten[i], schichten[j]] = [schichten[j] as Farbe, schichten[i] as Farbe];
  }

  const brett: Roehrchen[] = [];
  for (let t = 0; t < farbenAnzahl; t++) {
    brett.push(schichten.slice(t * kapazitaet, (t + 1) * kapazitaet));
  }
  for (let i = 0; i < leereRoehrchen; i++) brett.push([]);

  return { brett, saat: s };
}

const MAX_MISCH_VERSUCHE = 60;

/**
 * Baut Level `level`: aus der Levelnummer reproduzierbar gemischt, jeder
 * Versuch wird per Suchlauf auf Lösbarkeit geprüft — nicht lösbare oder
 * nicht rechtzeitig entschiedene Bretter fliegen raus, der nächste Versuch
 * bekommt eine neue, aber weiterhin aus der Levelnummer abgeleitete Saat.
 */
export function neuesLevel(level: number, kapazitaet = KAPAZITAET): Zustand {
  const farbenAnzahl = farbenFuerLevel(level);
  const leere = leereRoehrchenFuerLevel(level);
  let saat = saatAus('farbsortierer', level);
  let brett: Brett = [];

  for (let versuch = 0; versuch < MAX_MISCH_VERSUCHE; versuch++) {
    const gemischt = gemischtesBrett(saat, farbenAnzahl, kapazitaet, leere);
    brett = gemischt.brett;
    saat = gemischt.saat + 1;
    if (loesbar(brett, kapazitaet)) break;
  }

  return {
    roehrchen: brett,
    ausgewaehlt: null,
    verlauf: [],
    level,
    farbenAnzahl,
    zuege: 0,
    extraRoehrchenUebrig: extraRoehrchenFuerLevel(level),
    geloest: false,
  };
}

function schnappschuss(z: Zustand): Verlaufseintrag {
  return { roehrchen: z.roehrchen, zuege: z.zuege, extraRoehrchenUebrig: z.extraRoehrchenUebrig };
}

/**
 * Verarbeitet einen Antipp auf Röhrchen `index`:
 * - nichts ausgewählt + Röhrchen nicht leer → auswählen
 * - dasselbe Röhrchen nochmal → abwählen
 * - anderes Röhrchen, Gießen erlaubt → gießen
 * - anderes Röhrchen, Gießen nicht erlaubt → stattdessen das neue auswählen
 *   (wenn es nicht leer ist), sonst abwählen
 */
export function roehrchenAntippen(z: Zustand, index: number): Zustand {
  if (z.geloest) return z;
  const brett = z.roehrchen;

  if (z.ausgewaehlt === null) {
    return brett[index]!.length > 0 ? { ...z, ausgewaehlt: index } : z;
  }

  if (z.ausgewaehlt === index) {
    return { ...z, ausgewaehlt: null };
  }

  if (kannGiessen(brett[z.ausgewaehlt]!, brett[index]!)) {
    const neuesBrett = giessen(brett, z.ausgewaehlt, index);
    return {
      ...z,
      roehrchen: neuesBrett,
      ausgewaehlt: null,
      verlauf: [...z.verlauf, schnappschuss(z)],
      zuege: z.zuege + 1,
      geloest: istGeloest(neuesBrett),
    };
  }

  return brett[index]!.length > 0 ? { ...z, ausgewaehlt: index } : { ...z, ausgewaehlt: null };
}

/** Ein Schritt im vollen Verlauf zurück — beliebig oft wiederholbar. */
export function zurueck(z: Zustand): Zustand {
  if (z.verlauf.length === 0) return z;
  const letzter = z.verlauf[z.verlauf.length - 1]!;
  return {
    ...z,
    roehrchen: letzter.roehrchen,
    zuege: letzter.zuege,
    extraRoehrchenUebrig: letzter.extraRoehrchenUebrig,
    ausgewaehlt: null,
    verlauf: z.verlauf.slice(0, -1),
    geloest: false,
  };
}

/** Ein zusätzliches leeres Röhrchen — einmal pro Level, hilft bei Sackgassen. */
export function extraRoehrchenHinzufuegen(z: Zustand): Zustand {
  if (z.extraRoehrchenUebrig <= 0 || z.geloest) return z;
  return {
    ...z,
    roehrchen: [...z.roehrchen, []],
    verlauf: [...z.verlauf, schnappschuss(z)],
    extraRoehrchenUebrig: z.extraRoehrchenUebrig - 1,
  };
}

const BASIS_PUNKTE = 1000;
const STRAFE_PRO_ZUG = 12;
const MINDEST_PUNKTE = 100;

/** Weniger Züge und mehr Farben geben mehr Punkte — vergleichbar bei gleicher Levelnummer. */
export function punkteFuerLoesung(zuege: number, farbenAnzahl: number): number {
  const schwierigkeitsBonus = (farbenAnzahl - MIN_FARBEN) * 80;
  return Math.max(MINDEST_PUNKTE, BASIS_PUNKTE + schwierigkeitsBonus - zuege * STRAFE_PRO_ZUG);
}
