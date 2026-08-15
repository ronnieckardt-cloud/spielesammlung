import { rng, saatAus } from '../../core/rng';
import type { Zufall } from '../../core/rng';

/**
 * Blade Toss: Ein Holzstamm dreht sich, man sieht ihn von vorn — also die
 * runde Schnittfläche. Von unten wirft man Messer hinein. Trifft ein Messer
 * ein schon steckendes, ist die Runde vorbei.
 *
 * Der Name ist bewusst nicht der des bekannten Vorbilds; hier gilt dieselbe
 * Regel wie bei Pair Up — das Prinzip ist frei, der Name nicht.
 *
 * Alles rein und ohne React. Winkel durchgehend im Bogenmaß.
 *
 * **Koordinaten.** Winkel 0 zeigt nach rechts und wächst im Uhrzeigersinn,
 * weil y auf dem Bildschirm nach unten wächst. Das Messer kommt immer von
 * unten, trifft den Stamm also bei `ANKUNFT` (nach unten zeigend).
 *
 * **Steckwinkel.** Ein steckendes Messer wird nicht in Bildschirm-, sondern
 * in Stammkoordinaten gespeichert: `steck = ANKUNFT − stammwinkel`. Dadurch
 * dreht es sich von allein mit, und die Kollisionsprüfung ist ein simpler
 * Winkelvergleich — unabhängig davon, wie oft sich der Stamm schon gedreht
 * hat.
 */

const ZWEI_PI = Math.PI * 2;

/** Wo das Messer den Stamm trifft: unten, also nach unten zeigend. */
export const ANKUNFT = Math.PI / 2;

/** Wie lange ein geworfenes Messer unterwegs ist, in Sekunden. */
export const FLUG_S = 0.12;

/** Pause nach einem geschafften Level, bevor der neue Stamm kommt. */
export const PAUSE_S = 0.7;

/**
 * Mindestabstand zweier Messer, damit sie sich nicht berühren. Entspricht
 * ungefähr der Klingenbreite auf dem Stammrand. Bei acht Messern sind
 * dadurch rund 180 Grad des Umfangs belegt — eng, aber machbar.
 */
export const MIN_ABSTAND = 0.2;

/** So nah muss ein Wurf an einem Apfel liegen, um ihn zu treffen. */
const APFEL_TREFFER = 0.26;

export const MESSER_PUNKTE = 10;
export const APFEL_PUNKTE = 25;
const LEVEL_BONUS = 20;

/** Ein Abschnitt der Drehung: so lange mit diesem Tempo, dann der nächste. */
export type Phase = { dauer: number; tempo: number };

export type Zustand = {
  level: number;
  /** Aktueller Drehwinkel des Stamms. */
  winkel: number;
  muster: readonly Phase[];
  phaseIndex: number;
  phaseRest: number;
  /** Steckwinkel der Messer im Stamm, siehe Kopfkommentar. */
  messer: readonly number[];
  /** Steckwinkel der noch vorhandenen Äpfel. */
  aepfel: readonly number[];
  /** Wie viele Messer in diesem Level noch geworfen werden müssen. */
  uebrig: number;
  /** Restflugzeit des unterwegs befindlichen Messers, sonst null. */
  fliegend: number | null;
  /** Restzeit der Pause zwischen zwei Leveln, sonst 0. */
  pauseRest: number;
  punkte: number;
  vorbei: boolean;
  /** Warum die Runde vorbei ist — nur für die Anzeige. */
  getroffen: boolean;
  saat: number;
};

/** Winkel auf 0 bis unter 2π bringen. */
export function normalisieren(winkel: number): number {
  const rest = winkel % ZWEI_PI;
  return rest < 0 ? rest + ZWEI_PI : rest;
}

/** Kürzester Abstand zweier Winkel, immer 0 bis π. */
export function winkelAbstand(a: number, b: number): number {
  const roh = Math.abs(normalisieren(a) - normalisieren(b));
  return Math.min(roh, ZWEI_PI - roh);
}

/** Wie viele Messer ein Level verlangt. Steigt, dann gedeckelt. */
export function messerFuerLevel(level: number): number {
  return Math.min(9, 2 + Math.max(1, level));
}

/**
 * Wie viele Messer schon im Stamm stecken, bevor es losgeht. Ab Level 3,
 * langsam steigend — das ist neben dem Tempo die zweite Stellschraube und
 * verkleinert den freien Platz von Anfang an.
 */
export function vorgestecktFuerLevel(level: number): number {
  if (level < 3) return 0;
  return Math.min(4, Math.floor((level - 1) / 2));
}

/** Grundtempo der Drehung in Bogenmaß je Sekunde. */
function tempoFuerLevel(level: number): number {
  return Math.min(4.4, 1.6 + (level - 1) * 0.14);
}

/**
 * Das Drehmuster eines Levels.
 *
 * Bis Level 4 dreht der Stamm gleichmäßig in eine Richtung. Ab Level 5
 * wechselt er die Richtung in unregelmäßigen Abständen — genau das macht
 * das Vorhalten schwer, weil man sich nicht mehr auf einen Rhythmus
 * verlassen kann. Die Abschnitte werden zyklisch wiederholt.
 */
export function musterFuerLevel(level: number, zufall: Zufall): readonly Phase[] {
  const tempo = tempoFuerLevel(level);
  const richtung = zufall.zahl() < 0.5 ? -1 : 1;

  if (level < 5) return [{ dauer: Number.POSITIVE_INFINITY, tempo: tempo * richtung }];

  // Vier Abschnitte reichen: Sie wiederholen sich, wirken durch die
  // ungleichen Längen aber nicht wie ein kurzer Takt.
  const phasen: Phase[] = [];
  for (let i = 0; i < 4; i++) {
    phasen.push({
      dauer: 0.8 + zufall.zahl() * 1.4,
      // Nach jedem Wechsel etwas anderes Tempo, sonst fühlt es sich trotz
      // Richtungswechsel gleichförmig an.
      tempo: tempo * (0.85 + zufall.zahl() * 0.3) * (i % 2 === 0 ? richtung : -richtung),
    });
  }
  return phasen;
}

/**
 * Steckwinkel für die schon vorhandenen Messer und die Äpfel.
 *
 * Wichtig ist der Mindestabstand: Lägen zwei vorgesteckte Messer zu dicht
 * beieinander, sähe das aus wie ein Fehler — und ein Apfel direkt unter
 * einem Messer wäre nie erreichbar.
 */
function belegungVerteilen(anzahl: number, schonBelegt: readonly number[], zufall: Zufall, abstand: number): number[] {
  const ergebnis: number[] = [];
  const alle = () => [...schonBelegt, ...ergebnis];
  // Begrenzter Aufwand: Nach genug Fehlversuchen wird der Platz eng, dann
  // lieber weniger setzen als eine Endlosschleife riskieren.
  for (let i = 0; i < anzahl; i++) {
    for (let versuch = 0; versuch < 60; versuch++) {
      const kandidat = zufall.zahl() * ZWEI_PI;
      if (alle().every((w) => winkelAbstand(w, kandidat) >= abstand)) {
        ergebnis.push(kandidat);
        break;
      }
    }
  }
  return ergebnis;
}

/** Ein frisches Level aufbauen — bei gleicher Levelnummer immer dasselbe. */
export function levelAufbauen(level: number, punkte: number, saat: number): Zustand {
  const zufall = rng(saatAus('messerwurf', level, saat));
  const muster = musterFuerLevel(level, zufall);
  const messer = belegungVerteilen(vorgestecktFuerLevel(level), [], zufall, MIN_ABSTAND * 2);
  // Ein Apfel ab Level 2, ein zweiter ab Level 6.
  const apfelZahl = level >= 6 ? 2 : level >= 2 ? 1 : 0;
  const aepfel = belegungVerteilen(apfelZahl, messer, zufall, MIN_ABSTAND * 2.2);

  return {
    level,
    winkel: 0,
    muster,
    phaseIndex: 0,
    phaseRest: muster[0]!.dauer,
    messer,
    aepfel,
    uebrig: messerFuerLevel(level),
    fliegend: null,
    pauseRest: 0,
    punkte,
    vorbei: false,
    getroffen: false,
    saat,
  };
}

export function neuesSpiel(saat: number): Zustand {
  return levelAufbauen(1, 0, saat);
}

/** Ein Messer werfen. Wirkungslos, solange schon eines unterwegs ist. */
export function werfen(z: Zustand): Zustand {
  if (z.vorbei || z.fliegend !== null || z.pauseRest > 0 || z.uebrig <= 0) return z;
  return { ...z, fliegend: FLUG_S };
}

/**
 * Der Einschlag: Wo steckt das Messer, und was ist dort schon?
 *
 * Reihenfolge zählt. Zuerst der Apfel: Ein Treffer zerteilt ihn, das Messer
 * fliegt weiter und steckt trotzdem. Erst danach die Messerprüfung, denn
 * ein Apfel schützt nicht vor einem dahinterliegenden Messer.
 */
function einschlag(z: Zustand): Zustand {
  const steck = normalisieren(ANKUNFT - z.winkel);

  const getroffenerApfel = z.aepfel.findIndex((w) => winkelAbstand(w, steck) < APFEL_TREFFER);
  const aepfel = getroffenerApfel >= 0 ? z.aepfel.filter((_, i) => i !== getroffenerApfel) : z.aepfel;
  const apfelPunkte = getroffenerApfel >= 0 ? APFEL_PUNKTE : 0;

  if (z.messer.some((w) => winkelAbstand(w, steck) < MIN_ABSTAND)) {
    return {
      ...z,
      aepfel,
      punkte: z.punkte + apfelPunkte,
      fliegend: null,
      vorbei: true,
      getroffen: true,
    };
  }

  const uebrig = z.uebrig - 1;
  const punkte = z.punkte + apfelPunkte + MESSER_PUNKTE;

  return {
    ...z,
    messer: [...z.messer, steck],
    aepfel,
    uebrig,
    punkte,
    fliegend: null,
    // Level geschafft: kurze Pause, dann baut `zeitFortschritt` das nächste.
    pauseRest: uebrig <= 0 ? PAUSE_S : 0,
  };
}

/** Zeit vergehen lassen: Drehung, Flug, Pause, Levelwechsel. */
export function zeitFortschritt(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;

  if (z.pauseRest > 0) {
    const pauseRest = z.pauseRest - dt;
    if (pauseRest > 0) return { ...z, pauseRest };
    // Punkte und Saat wandern mit ins nächste Level, der Rest ist neu.
    return levelAufbauen(z.level + 1, z.punkte + LEVEL_BONUS * z.level, z.saat);
  }

  // Drehung. Die Schleife holt mehrere fällige Phasenwechsel nach, falls es
  // einmal geruckelt hat — sonst verschöbe sich das Muster dauerhaft.
  let winkel = z.winkel;
  let phaseIndex = z.phaseIndex;
  let phaseRest = z.phaseRest;
  let rest = dt;
  while (rest > 0) {
    const phase = z.muster[phaseIndex]!;
    const schritt = Math.min(rest, phaseRest);
    winkel += phase.tempo * schritt;
    rest -= schritt;
    phaseRest -= schritt;
    if (phaseRest <= 0) {
      phaseIndex = (phaseIndex + 1) % z.muster.length;
      phaseRest = z.muster[phaseIndex]!.dauer;
    }
  }

  const gedreht = { ...z, winkel: normalisieren(winkel), phaseIndex, phaseRest };

  if (gedreht.fliegend === null) return gedreht;
  const fliegend = gedreht.fliegend - dt;
  if (fliegend > 0) return { ...gedreht, fliegend };
  return einschlag(gedreht);
}

/** Anteil des Flugs, 0 = gerade geworfen, 1 = am Stamm. Nur zum Anzeigen. */
export function flugFortschritt(z: Zustand): number {
  if (z.fliegend === null) return 0;
  return Math.max(0, Math.min(1, 1 - z.fliegend / FLUG_S));
}
