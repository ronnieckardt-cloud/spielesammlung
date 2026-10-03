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
 * Mindestabstand zweier Messer, damit sie sich nicht berühren: die halbe
 * Klingenbreite auf dem Stammrand, zweimal gerechnet. Die Klinge ist 4,4
 * breit (`figuren.tsx`), der Rand liegt bei Halbmesser 28 — das sind rund
 * 0,16 Bogenmaß je Seite. Jedes Messer sperrt damit gut 0,3 des Umfangs
 * (6,28), und genau diese Zahl bestimmt, wie viele Messer überhaupt in einen
 * Stamm passen, **ohne dass das Spiel zur Glückssache wird** (siehe
 * `bestesFenster`).
 *
 * Vorher stand hier 0,2 bei einer 6 breiten Klinge. Bei zwölf Messern im
 * Stamm (Level 8) waren damit 4,8 von 6,28 gesperrt, und selbst bei bestem
 * Spiel blieb für den letzten Wurf ein Zeitfenster von unter 100 Millisekunden
 * — kürzer als jeder Mensch zuverlässig trifft.
 */
export const MIN_ABSTAND = 0.155;

/** So nah muss ein Wurf an einem Apfel liegen, um ihn zu treffen. */
const APFEL_TREFFER = 0.26;

/**
 * Wie lange die beiden Hälften eines zerteilten Apfels auseinanderfliegen.
 *
 * Warum das in der Logik steht und nicht als CSS-Animation in der Anzeige:
 * Der Apfel ist im selben Augenblick aus `aepfel` verschwunden, in dem er
 * getroffen wird — die Anzeige hat danach nichts mehr, woran sie eine
 * Animation aufhängen könnte. Der Zustand muss sich also merken, dass eben
 * einer zerteilt wurde. Und wenn er das ohnehin tut, kann er die Zeit auch
 * gleich selbst mitzählen; dann ist der Ablauf getestet statt geraten.
 */
export const ZERTEILT_S = 0.45;

export const MESSER_PUNKTE = 10;
export const APFEL_PUNKTE = 25;
/** Der goldene Apfel des Boss-Stamms: das Vierfache eines gewöhnlichen. */
export const GOLD_PUNKTE = 100;
const LEVEL_BONUS = 20;

/** Jeder wievielte Level ein Boss-Stamm ist. */
export const BOSS_ALLE = 5;

/** Bonus für einen besiegten Boss, mal der Nummer des Bosses (Level 5 = 1, Level 10 = 2 …). */
export const BOSS_BONUS = 100;

/** Höchster Faktor der Apfelkette. */
export const KETTE_MAX = 4;

/** Mindestabstand eines Apfels zum nächsten Messer. Größer als `MIN_ABSTAND`, sonst läge er unter der Klinge. */
export const APFEL_ABSTAND = 0.34;

/**
 * Mindestabstand zweier Äpfel. Ein Apfel ist 9,2 breit (der goldene 11,2), der Ring, auf dem
 * sie sitzen, hat Halbmesser 24 — das sind 0,38 beziehungsweise 0,47 Bogenmaß. Bei weniger
 * Abstand liegen sie sichtbar übereinander (so war es, als die Zahl für Messer und Äpfel
 * noch gemeinsam bei 0,34 stand).
 */
export const APFEL_UNTEREINANDER = 0.55;

/** Ein Abschnitt der Drehung: so lange mit diesem Tempo, dann der nächste. */
export type Phase = { dauer: number; tempo: number };

/** Ein Apfel im Stamm. Der goldene kommt nur im Boss-Stamm vor. */
export type Apfel = { steck: number; gold: boolean };

/** Ein eben zerteilter Apfel: wo er saß und wie lange er noch zu sehen ist. */
export type Zerteilt = { steck: number; gold: boolean; rest: number };

export type Zustand = {
  level: number;
  /** Aktueller Drehwinkel des Stamms. */
  winkel: number;
  muster: readonly Phase[];
  phaseIndex: number;
  phaseRest: number;
  /** Steckwinkel der Messer im Stamm, siehe Kopfkommentar. */
  messer: readonly number[];
  /** Die noch vorhandenen Äpfel. */
  aepfel: readonly Apfel[];
  /** Wie viele Messer dieses Level insgesamt zu werfen verlangt (die Vorratsanzeige zählt sie). */
  wuerfe: number;
  /** Wie viele Messer in diesem Level noch geworfen werden müssen. */
  uebrig: number;
  /** Restflugzeit des unterwegs befindlichen Messers, sonst null. */
  fliegend: number | null;
  /** Restzeit der Pause zwischen zwei Leveln, sonst 0. */
  pauseRest: number;
  /** Der zuletzt zerteilte Apfel, solange er noch auseinanderfliegt. */
  zerteilt: Zerteilt | null;
  punkte: number;
  /**
   * Apfelkette: wie viele Äpfel in Folge getroffen wurden, ohne dass in
   * einem Level einer übrig blieb. Der Faktor dazu steht in `ketteFaktor`.
   */
  kette: number;
  vorbei: boolean;
  /**
   * Steckwinkel des tödlichen Messers, sonst null.
   *
   * Nur für die Anzeige — aber eben nicht nur „es ist passiert", sondern
   * **wo**. Vorher stand hier ein bloßes `getroffen: boolean`, mit dem die
   * Anzeige nichts anfangen konnte: Das geworfene Messer verschwand, und
   * die Runde war ohne ein einziges Bild vorbei. Ein Kind soll sehen,
   * woran es lag.
   */
  stoss: number | null;
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

/** Jeder fünfte Level ist ein Boss-Stamm. */
export function istBoss(level: number): boolean {
  return level % BOSS_ALLE === 0;
}

/** Die Nummer des Bosses: Level 5 ist der erste, Level 10 der zweite. */
export function bossNummer(level: number): number {
  return Math.floor(level / BOSS_ALLE);
}

/** Der Lohn für einen besiegten Boss. */
export function bossBonus(level: number): number {
  return BOSS_BONUS * bossNummer(level);
}

/**
 * Wie viele Messer am Ende eines Levels **im Stamm stecken** — die schon
 * vorgesteckten und die geworfenen zusammen. Das ist die Zahl, an der die
 * Fairness hängt: Sie bestimmt, wie viel Umfang am Schluss noch frei ist.
 *
 * Sie wächst von drei bis zehn (Level 21) und bleibt dann stehen. Zehn ist die
 * Grenze, an der bei der höchsten Drehzahl für den besten Spieler gerade noch
 * ein Zeitfenster von rund 120 Millisekunden übrig bleibt (siehe
 * `bestesFenster`); mehr Messer machten das Spiel zur Glückssache, genau wie
 * die zwölf Messer des früheren Level 8. Der Boss-Stamm bekommt ein Messer
 * mehr — dafür dreht er langsamer.
 */
const GESAMT_GRUND = [3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10] as const;

export function gesamtFuerLevel(level: number): number {
  const grund = GESAMT_GRUND[Math.min(level, GESAMT_GRUND.length) - 1]!;
  return grund + (istBoss(level) ? 1 : 0);
}

/**
 * Wie viele Messer schon im Stamm stecken, bevor es losgeht. Ab Level 4,
 * langsam steigend bis drei: Sie liegen **ungleichmäßig** und sind damit die
 * eigentliche Aufgabe — wer alle Messer selbst setzt, kann die Lücken
 * gleichmäßig halten, die vorgesteckten bestimmen dagegen, wo es eng wird.
 */
export function vorgestecktFuerLevel(level: number): number {
  return Math.min(3, Math.floor((level - 1) / 3));
}

/** Wie viele Messer ein Level verlangt, also zu **werfen** sind. */
export function messerFuerLevel(level: number): number {
  return gesamtFuerLevel(level) - vorgestecktFuerLevel(level);
}

/** Wie viel langsamer der Boss-Stamm dreht. */
const BOSS_TEMPO_FAKTOR = 0.75;

/** Um wie viel die wechselnden Abschnitte höchstens vom Grundtempo abweichen (siehe `musterFuerLevel`). */
const SPITZEN_FAKTOR = 1.15;

/** Grundtempo der Drehung in Bogenmaß je Sekunde. */
export function tempoFuerLevel(level: number): number {
  const grund = Math.min(2.8, 1.6 + (level - 1) * 0.12);
  return grund * (istBoss(level) ? BOSS_TEMPO_FAKTOR : 1);
}

/** Ab diesem Level wechselt der Stamm die Richtung. Level 5 ist der erste Boss und dreht noch gleichmäßig. */
export const WECHSEL_AB_LEVEL = 6;

/** Das schnellste Tempo, das ein Level je erreicht — ab Level 6 mit den wechselnden Abschnitten. */
export function spitzentempoFuerLevel(level: number): number {
  return tempoFuerLevel(level) * (level >= WECHSEL_AB_LEVEL ? SPITZEN_FAKTOR : 1);
}

/**
 * Das Zeitfenster für den schwersten Wurf eines Levels bei **bestem Spiel**,
 * in Sekunden — **wenn die Messer gleichmäßig verteilt wären**.
 *
 * Beim letzten Wurf stecken `Anzahl − 1` Messer im Stamm; zwischen zwei von
 * ihnen bleibt `Umfang / (Anzahl − 1) − 2 · MIN_ABSTAND` frei, und so lange
 * braucht der Stamm bei Höchsttempo, um diese Lücke am Einschlagpunkt
 * vorbeizuziehen. Das ist die Zeit, in der man tippen darf — und genau das
 * ist, was ein Mensch trifft oder nicht. Mit Zufall hat es nichts zu tun:
 * Ein Spiel, dessen Fenster unter die Reaktionsgenauigkeit eines Menschen
 * fällt, ist ab da eine Lotterie.
 */
export function gleichmaessigesFenster(level: number): number {
  return (ZWEI_PI / (gesamtFuerLevel(level) - 1) - 2 * MIN_ABSTAND) / spitzentempoFuerLevel(level);
}

/**
 * Wie viel vom gleichmäßigen Fenster ein Level mindestens haben muss.
 *
 * Die vorgesteckten Messer liegen zufällig, die Lücken sind also nie ganz
 * gleich — ein Anteil von 70 Prozent lässt der Zufallsverteilung Spielraum,
 * verwirft aber die Verteilungen, in denen zwei Messer eine Lücke
 * so zudrücken, dass sie nicht mehr zu treffen ist.
 */
export const FENSTER_ANTEIL = 0.7;

/** Das Fenster, das ein Level bei bestem Spiel mindestens haben muss. */
export function fensterZiel(level: number): number {
  return FENSTER_ANTEIL * gleichmaessigesFenster(level);
}

/**
 * Wie lang ist das Zeitfenster für den schwersten Wurf bei **bestem Spiel**?
 *
 * Bestes Spiel heißt: Jedes Messer kommt in die Mitte der größten freien
 * Lücke. Für jeden dieser Würfe zählt die Länge des größten legalen
 * Bereichs (Lücke minus `MIN_ABSTAND` nach beiden Seiten) geteilt durch das
 * Höchsttempo — das ist die Zeit, in der der Wurf noch gültig ist. Der
 * kleinste dieser Werte ist der Engpass des Levels.
 *
 * Reine Funktion über Winkel, damit sie sowohl die Erzeugung (verwirft
 * Verteilungen, die zu eng sind) als auch die Tests benutzen: Ein Level, in
 * dem selbst der beste Spieler unter ein paar hundert Millisekunden fällt, ist
 * für niemanden mehr „schwer", nur noch Zufall.
 */
export function bestesFenster(messer: readonly number[], wuerfe: number, spitze: number): number {
  const w = messer.map(normalisieren).sort((a, b) => a - b);
  let kleinste = Number.POSITIVE_INFINITY;
  for (let i = 0; i < wuerfe; i++) {
    let groesste = w.length === 0 ? ZWEI_PI : -1;
    let mitte = 0;
    for (let k = 0; k < w.length; k++) {
      const von = w[k]!;
      const bis = k + 1 < w.length ? w[k + 1]! : w[0]! + ZWEI_PI;
      if (bis - von > groesste) {
        groesste = bis - von;
        mitte = von + groesste / 2;
      }
    }
    const legal = groesste - 2 * MIN_ABSTAND;
    if (legal <= 0) return 0;
    kleinste = Math.min(kleinste, legal / spitze);
    w.push(normalisieren(mitte));
    w.sort((a, b) => a - b);
  }
  return kleinste;
}

/** Wie viel langsamer der Stamm rückwärts dreht als vorwärts, in den wechselnden Mustern. */
const RUECK_FAKTOR = 0.7;

/**
 * Das Drehmuster eines Levels.
 *
 * Bis Level 5 dreht der Stamm gleichmäßig in eine Richtung. Ab Level 6
 * wechselt er die Richtung — genau das macht das Vorhalten schwer, weil man
 * sich nicht mehr auf einen Rhythmus verlassen kann. Die Abschnitte werden
 * zyklisch wiederholt. (Der Boss in Level 5 ist der erste Stamm, der dichter
 * bestückt ist; dass er außerdem noch die Richtung wechselt, wäre auf einmal zu viel.)
 *
 * **Vorwärts lange, rückwärts kurz.** Die erste Fassung wechselte zwischen
 * gleich langen Abschnitten in beide Richtungen, und deren Unterschied ist
 * Zufall: Dreht der Stamm in vier Abschnitten netto kaum weiter, pendelt er
 * nur hin und her — und eine Lücke außerhalb dieser Spanne kommt **nie** oder
 * erst nach Minuten am Einschlagpunkt vorbei. Gemessen: Der beste Spieler
 * wartete in Level 5 bis zu acht Sekunden auf eine Lücke, die gerade nicht
 * dran war. Jetzt dreht der Stamm in der Hauptrichtung deutlich länger als
 * zurück (1,8 bis 2,8 s vor, 0,3 bis 0,7 s mit 0,7-fachem Tempo zurück), kommt
 * also immer weiter: Einen ganzen Umfang schafft er in höchstens gut fünf
 * Sekunden (`umlaufZeit`, gemessen über Level 6 bis 40 und je 40 Saaten).
 */
export function musterFuerLevel(level: number, zufall: Zufall): readonly Phase[] {
  const tempo = tempoFuerLevel(level);
  const richtung = zufall.zahl() < 0.5 ? -1 : 1;

  if (level < WECHSEL_AB_LEVEL) return [{ dauer: Number.POSITIVE_INFINITY, tempo: tempo * richtung }];

  const phasen: Phase[] = [];
  for (let i = 0; i < 4; i++) {
    const vor = i % 2 === 0;
    phasen.push({
      dauer: vor ? 1.8 + zufall.zahl() * 1.0 : 0.3 + zufall.zahl() * 0.4,
      // Nach jedem Wechsel etwas anderes Tempo, sonst fühlt es sich trotz
      // Richtungswechsel gleichförmig an. Höchstens `SPITZEN_FAKTOR`.
      tempo: tempo * (0.85 + zufall.zahl() * 0.3) * (vor ? richtung : -richtung * RUECK_FAKTOR),
    });
  }
  return phasen;
}

/**
 * Wie lange es höchstens dauert, bis der Stamm einen **ganzen Umfang** am
 * Einschlagpunkt hat vorbeiziehen lassen — gerechnet ab dem Anfang jedes
 * Abschnitts, das Schlechteste davon. Das ist die längste Zeit, die man auf
 * eine bestimmte Lücke warten muss. `Infinity`, wenn der Stamm nie rundherum
 * kommt.
 */
export function umlaufZeit(muster: readonly Phase[]): number {
  const SCHRITT = 1 / 120;
  let schlimmste = 0;
  for (let start = 0; start < muster.length; start++) {
    let winkel = 0;
    let kleinster = 0;
    let groesster = 0;
    let zeit = 0;
    let index = start;
    let rest = muster[start]!.dauer;
    let fertig = false;
    while (zeit < 120) {
      const phase = muster[index]!;
      winkel += phase.tempo * SCHRITT;
      zeit += SCHRITT;
      kleinster = Math.min(kleinster, winkel);
      groesster = Math.max(groesster, winkel);
      if (groesster - kleinster >= ZWEI_PI) {
        fertig = true;
        break;
      }
      rest -= SCHRITT;
      if (rest <= 0) {
        index = (index + 1) % muster.length;
        rest = muster[index]!.dauer;
      }
    }
    schlimmste = Math.max(schlimmste, fertig ? zeit : Number.POSITIVE_INFINITY);
  }
  return schlimmste;
}

/**
 * Steckwinkel für die schon vorhandenen Messer und die Äpfel.
 *
 * Wichtig ist der Mindestabstand: Lägen zwei vorgesteckte Messer zu dicht
 * beieinander, sähe das aus wie ein Fehler — und ein Apfel direkt unter
 * einem Messer wäre nie erreichbar.
 */
function belegungVerteilen(
  anzahl: number,
  schonBelegt: readonly number[],
  zufall: Zufall,
  abstand: number,
  /** Abstand der neu gesetzten **untereinander**, wenn er größer sein muss als zu den schon vorhandenen. */
  untereinander = abstand,
): number[] {
  const ergebnis: number[] = [];
  // Begrenzter Aufwand: Nach genug Fehlversuchen wird der Platz eng, dann
  // lieber weniger setzen als eine Endlosschleife riskieren.
  for (let i = 0; i < anzahl; i++) {
    for (let versuch = 0; versuch < 60; versuch++) {
      const kandidat = zufall.zahl() * ZWEI_PI;
      if (
        schonBelegt.every((w) => winkelAbstand(w, kandidat) >= abstand) &&
        ergebnis.every((w) => winkelAbstand(w, kandidat) >= untereinander)
      ) {
        ergebnis.push(kandidat);
        break;
      }
    }
  }
  return ergebnis;
}

/** Der Faktor der Apfelkette: 1 ohne Kette, wächst mit jedem getroffenen Apfel bis `KETTE_MAX`. */
export function ketteFaktor(kette: number): number {
  return Math.min(KETTE_MAX, Math.max(1, kette));
}

/**
 * Ein frisches Level aufbauen — bei gleicher Levelnummer immer dasselbe.
 *
 * Die vorgesteckten Messer werden **verlangt gut genug** verteilt: Eine
 * Verteilung, bei der selbst der beste Spieler unter das Mindestfenster
 * (`fensterZiel`) fällt, wird verworfen und neu gewürfelt. Findet sich nach
 * 40 Versuchen keine, steckt ein Messer weniger vor (und eines mehr wird
 * geworfen) — das Messer steckt dann nicht zufällig, sondern wird von dem
 * gesetzt, der die Lücken gleichmäßig halten kann. Mit null vorgesteckten
 * Messern geht es immer.
 */
export function levelAufbauen(level: number, punkte: number, saat: number, kette = 0): Zustand {
  const zufall = rng(saatAus('messerwurf', level, saat));
  const muster = musterFuerLevel(level, zufall);
  const gesamt = gesamtFuerLevel(level);
  const spitze = spitzentempoFuerLevel(level);
  const ziel = fensterZiel(level);

  let messer: number[] = [];
  for (let vor = vorgestecktFuerLevel(level); vor >= 0; vor--) {
    let gefunden = false;
    for (let versuch = 0; versuch < 40; versuch++) {
      const kandidat = belegungVerteilen(vor, [], zufall, MIN_ABSTAND * 2);
      if (kandidat.length === vor && bestesFenster(kandidat, gesamt - vor, spitze) >= ziel) {
        messer = kandidat;
        gefunden = true;
        break;
      }
    }
    if (gefunden) break;
  }

  // Ein Apfel ab Level 2, ein zweiter ab Level 6. Im Boss-Stamm ist der erste
  // golden.
  const apfelZahl = level >= 6 ? 2 : level >= 2 ? 1 : 0;
  const aepfel: Apfel[] = belegungVerteilen(apfelZahl, messer, zufall, APFEL_ABSTAND, APFEL_UNTEREINANDER).map((steck, i) => ({
    steck,
    gold: istBoss(level) && i === 0,
  }));

  return {
    level,
    winkel: 0,
    muster,
    phaseIndex: 0,
    phaseRest: muster[0]!.dauer,
    messer,
    aepfel,
    wuerfe: gesamt - messer.length,
    uebrig: gesamt - messer.length,
    fliegend: null,
    pauseRest: 0,
    zerteilt: null,
    punkte,
    kette,
    vorbei: false,
    stoss: null,
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

  const treffer = z.aepfel.findIndex((a) => winkelAbstand(a.steck, steck) < APFEL_TREFFER);
  const getroffen = treffer >= 0 ? z.aepfel[treffer]! : null;
  const aepfel = getroffen ? z.aepfel.filter((_, i) => i !== treffer) : z.aepfel;
  const kette = getroffen ? z.kette + 1 : z.kette;
  const apfelPunkte = getroffen ? (getroffen.gold ? GOLD_PUNKTE : APFEL_PUNKTE) * ketteFaktor(kette) : 0;
  // Die Hälften fliegen dort auseinander, wo der Apfel saß — nicht am
  // Einschlagpunkt. Bei einem Streiftreffer sind das bis zu 0,26 Bogenmaß
  // Unterschied, und die Frucht soll da zerspringen, wo sie hing.
  const zerteilt: Zerteilt | null = getroffen
    ? { steck: getroffen.steck, gold: getroffen.gold, rest: ZERTEILT_S }
    : z.zerteilt;

  if (z.messer.some((w) => winkelAbstand(w, steck) < MIN_ABSTAND)) {
    return {
      ...z,
      aepfel,
      zerteilt,
      kette,
      punkte: z.punkte + apfelPunkte,
      fliegend: null,
      vorbei: true,
      stoss: steck,
    };
  }

  const uebrig = z.uebrig - 1;
  const fertig = uebrig <= 0;
  // Der Boss zahlt beim letzten Messer, nicht erst beim Levelwechsel: Das „+N" über dem
  // Brett soll im Moment des Siegs stehen.
  const bossPunkte = fertig && istBoss(z.level) ? bossBonus(z.level) : 0;
  const punkte = z.punkte + apfelPunkte + MESSER_PUNKTE + bossPunkte;

  return {
    ...z,
    messer: [...z.messer, steck],
    aepfel,
    zerteilt,
    // Bleibt am Ende des Levels ein Apfel stehen, ist die Kette gerissen: Man hat ihn
    // nicht getroffen — oder nicht gewollt.
    kette: fertig && aepfel.length > 0 ? 0 : kette,
    uebrig,
    punkte,
    fliegend: null,
    // Level geschafft: kurze Pause, dann baut `zeitFortschritt` das nächste.
    pauseRest: fertig ? PAUSE_S : 0,
  };
}

/**
 * In welches steckende Messer der tödliche Wurf gefahren ist — sonst −1.
 *
 * Steht hier und nicht in der Anzeige, weil dieselbe Regel wie im Einschlag
 * gilt (`MIN_ABSTAND`): Die Anzeige soll genau die Klinge rot färben, die
 * das Spiel auch gemeint hat.
 */
export function stossPartner(z: Zustand): number {
  const stoss = z.stoss;
  if (stoss === null) return -1;
  return z.messer.findIndex((w) => winkelAbstand(w, stoss) < MIN_ABSTAND);
}

/** Zeit vergehen lassen: Drehung, Flug, Pause, Levelwechsel. */
export function zeitFortschritt(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;

  // Der zerteilte Apfel hat eine eigene kleine Uhr, und die läuft in jeder
  // Lage weiter — auch während der Pause zwischen zwei Leveln. Sonst bliebe
  // ausgerechnet beim Apfeltreffer mit dem letzten Messer eine halb
  // auseinandergeflogene Frucht stehen.
  const zerteilt: Zerteilt | null =
    z.zerteilt === null || z.zerteilt.rest <= dt ? null : { ...z.zerteilt, rest: z.zerteilt.rest - dt };

  if (z.pauseRest > 0) {
    const pauseRest = z.pauseRest - dt;
    if (pauseRest > 0) return { ...z, zerteilt, pauseRest };
    // Punkte und Saat wandern mit ins nächste Level, der Rest ist neu.
    return levelAufbauen(z.level + 1, z.punkte + LEVEL_BONUS * z.level, z.saat, z.kette);
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

  const gedreht = { ...z, zerteilt, winkel: normalisieren(winkel), phaseIndex, phaseRest };

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

/** Anteil des Auseinanderfliegens, 0 = gerade zerteilt, 1 = verschwunden. */
export function zerteiltFortschritt(z: Zustand): number {
  if (z.zerteilt === null) return 0;
  return Math.max(0, Math.min(1, 1 - z.zerteilt.rest / ZERTEILT_S));
}
