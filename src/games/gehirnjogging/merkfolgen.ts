import { rng } from '../../core/rng';

/**
 * Merk-Folgen: eine Farbfolge wird vorgeführt, danach muss sie nachgetippt
 * werden. Reine Funktionen — keine Zeitsteuerung, das übernimmt die Anzeige.
 */

export const FARBEN_ANZAHL = 6;

export type MerkfolgenAufgabe = {
  /** Werte 0 bis FARBEN_ANZAHL - 1, welche Kachel an welcher Stelle. */
  folge: readonly number[];
};

/** Folgenlänge wächst alle 10 Level um eins, gedeckelt bei 9 (Gedächtnisspanne). */
export function laengeFuerLevel(level: number): number {
  return Math.min(9, 3 + Math.floor((level - 1) / 10));
}

export function merkfolgenAufgabe(saat: number, level: number): MerkfolgenAufgabe {
  const z = rng(saat);
  const laenge = laengeFuerLevel(level);
  const folge: number[] = [];
  for (let i = 0; i < laenge; i++) {
    let wert = z.ganzzahl(FARBEN_ANZAHL);
    // Nicht mehr als zwei gleiche Farben direkt hintereinander — sonst wirkt es wie ein Fehler in der Anzeige.
    if (folge.length >= 2 && folge[folge.length - 1] === wert && folge[folge.length - 2] === wert) {
      wert = (wert + 1) % FARBEN_ANZAHL;
    }
    folge.push(wert);
  }
  return { folge };
}

export type MerkfolgeSchrittErgebnis = 'lauft' | 'richtig' | 'falsch';

/**
 * Einen getippten Kachel-Index gegen die Folge prüfen. Rein, kennt nur die
 * Folge und was bislang getippt wurde — kein UI-Zustand, kein Timer.
 */
export function merkfolgeTippen(
  aufgabe: MerkfolgenAufgabe,
  bisher: readonly number[],
  getippt: number,
): { eingabe: readonly number[]; ergebnis: MerkfolgeSchrittErgebnis } {
  const erwartungsPosition = bisher.length;
  const eingabe = [...bisher, getippt];
  if (aufgabe.folge[erwartungsPosition] !== getippt) {
    return { eingabe, ergebnis: 'falsch' };
  }
  return { eingabe, ergebnis: eingabe.length === aufgabe.folge.length ? 'richtig' : 'lauft' };
}
