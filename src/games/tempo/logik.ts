/**
 * Tap Rush — so oft wie möglich tippen.
 *
 * Reine Logik: keine Uhr, kein React. Die Zeit kommt von außen herein
 * (`takt(z, dt)`), damit sich der ganze Ablauf ohne Browser durchspielen
 * lässt — sonst wäre ausgerechnet ein Spiel, bei dem es nur um Zeit geht,
 * das einzige ungetestete.
 */

/** Die wählbaren Runden. Kurz zum Ausrasten, lang zum Durchhalten. */
export const DAUERN: readonly number[] = [5, 10, 20, 60];

/**
 * Über welchen Zeitraum das Tempo gemessen wird.
 *
 * Zu kurz, und die Farbe zappelt bei jedem einzelnen Tipp; zu lang, und sie
 * hinkt hinterher, sodass man den Zusammenhang zwischen Tippen und Farbe
 * gar nicht mehr merkt. Etwas über eine Sekunde trifft beides.
 */
export const TEMPO_FENSTER = 1.2;

export type Stufe = 'rot' | 'gruen' | 'blau' | 'regenbogen';

export type Zustand = {
  /** Gewählte Rundenlänge in Sekunden. */
  dauer: number;
  /** Seit dem ersten Tipp vergangene Sekunden. */
  zeit: number;
  tipps: number;
  /**
   * Zeitpunkte der letzten Tipps, für die Tempomessung. Alles außerhalb des
   * Fensters wird laufend weggeworfen — die Liste bleibt also kurz, egal wie
   * lange die Runde dauert.
   */
  letzte: readonly number[];
  /** Läuft die Uhr schon? Sie startet erst mit dem ersten Tipp. */
  laeuft: boolean;
  vorbei: boolean;
};

export function neuesSpiel(dauer: number): Zustand {
  return { dauer, zeit: 0, tipps: 0, letzte: [], laeuft: false, vorbei: false };
}

/**
 * Ein Tipp.
 *
 * **Der erste Tipp startet die Uhr**, nicht das Öffnen des Spiels. Sonst
 * verliert man Zeit, während man sich noch zurechtsetzt — und bei fünf
 * Sekunden wäre das die halbe Runde.
 */
export function tippen(z: Zustand): Zustand {
  if (z.vorbei) return z;
  return {
    ...z,
    laeuft: true,
    tipps: z.tipps + 1,
    letzte: [...z.letzte, z.zeit],
  };
}

/** Ein Zeitschritt in Sekunden. Vor dem ersten Tipp steht die Zeit still. */
export function takt(z: Zustand, dt: number): Zustand {
  if (!z.laeuft || z.vorbei) return z;

  const zeit = z.zeit + dt;
  const vorbei = zeit >= z.dauer;
  return {
    ...z,
    // Nie über die Rundenlänge hinaus — sonst zeigt die Restanzeige am Ende
    // eine negative Zahl.
    zeit: Math.min(zeit, z.dauer),
    letzte: z.letzte.filter((t) => t > zeit - TEMPO_FENSTER),
    vorbei,
  };
}

/** Verbleibende Sekunden. */
export function rest(z: Zustand): number {
  return Math.max(0, z.dauer - z.zeit);
}

/**
 * Das aktuelle Tempo in Tipps je Sekunde.
 *
 * Am Anfang ist das Fenster noch nicht voll — dann wird durch die bisher
 * vergangene Zeit geteilt, sonst sähe der Start künstlich langsam aus.
 * Unter einer Zehntelsekunde wird gar nicht gerechnet: Ein einzelner Tipp
 * ergäbe sonst ein Tempo von hundert.
 */
export function tempo(z: Zustand): number {
  if (!z.laeuft) return 0;
  const fenster = Math.min(TEMPO_FENSTER, z.zeit);
  if (fenster < 0.1) return 0;
  return z.letzte.length / fenster;
}

/**
 * Welche Farbstufe gehört zu diesem Tempo?
 *
 * Die Grenzen sind an einem Kind ausgerichtet, nicht an einem Rekordhalter:
 * Rund fünf Tipps je Sekunde sind mit einem Finger schon flott, sieben sind
 * richtig schnell. Wären die Grenzen höher, bliebe das Feld die ganze Runde
 * rot — und die Farbe wäre keine Rückmeldung mehr, sondern nur Deko.
 */
export function stufeFuerTempo(tippsProSekunde: number): Stufe {
  if (tippsProSekunde < 2.5) return 'rot';
  if (tippsProSekunde < 4.5) return 'gruen';
  if (tippsProSekunde < 6.5) return 'blau';
  return 'regenbogen';
}

/**
 * Die Punktzahl.
 *
 * **Tipps je zehn Sekunden**, nicht die reine Anzahl. Sonst gewönne die
 * Bestenliste immer, wer die Minute gewählt hat — eine Fünf-Sekunden-Runde
 * hätte gar keine Chance, und die Liste sagte nur noch aus, wer am längsten
 * gespielt hat. So sind alle vier Längen miteinander vergleichbar.
 */
export function punkte(tipps: number, dauer: number): number {
  return Math.round((tipps * 10) / dauer);
}

/** Kurzer Kommentar zum Ergebnis. */
export function bewertung(stufe: Stufe): string {
  switch (stufe) {
    case 'regenbogen':
      return 'Wahnsinn! Regenbogen-Tempo!';
    case 'blau':
      return 'Richtig schnell!';
    case 'gruen':
      return 'Gut getippt.';
    default:
      return 'Da geht noch mehr.';
  }
}
