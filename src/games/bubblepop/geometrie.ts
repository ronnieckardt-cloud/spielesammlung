/**
 * Bubble Pop — Umrechnung zwischen Wabenfeldern und Bildpunkten sowie die
 * Flugbahn der geschossenen Kugel.
 *
 * Alles hier sind reine Funktionen in einem festen Koordinatensystem (die
 * Anzeige skaliert per SVG-viewBox darauf). Dadurch lässt sich das
 * Abprallen an den Wänden testen, ohne den Browser zu bemühen — genau da
 * stecken die Vorzeichenfehler.
 */

import { SPALTEN, ZEILEN, istVersetzt, nachbarn } from './logik';
import type { Punkt, Wabe } from './logik';

/** Durchmesser einer Kugel im Rechenraum. */
export const KUGEL = 10;
export const RADIUS = KUGEL / 2;

/** Zeilenabstand: bei versetzten Waben etwas weniger als ein voller Durchmesser. */
export const ZEILEN_HOEHE = KUGEL * 0.866; // sin(60°)

/** Gesamtbreite: eine halbe Kugel extra für den Versatz der ungeraden Zeilen. */
export const FELD_BREITE = SPALTEN * KUGEL + RADIUS;
export const FELD_HOEHE = ZEILEN * ZEILEN_HOEHE + KUGEL;

/** Wo die Kanone steht — mittig unten. */
export const KANONE = { x: FELD_BREITE / 2, y: FELD_HOEHE - RADIUS };

export type Stelle = { x: number; y: number };

/** Mittelpunkt eines Wabenfelds. */
export function mittelpunkt(p: Punkt): Stelle {
  return {
    x: p.spalte * KUGEL + RADIUS + (istVersetzt(p.zeile) ? RADIUS : 0),
    y: p.zeile * ZEILEN_HOEHE + RADIUS,
  };
}

/** Das Wabenfeld, dessen Mittelpunkt einer Stelle am nächsten liegt. */
export function naechstesFeld(stelle: Stelle): Punkt {
  // Zeile aus der Höhe schätzen, dann die Nachbarzeilen mitprüfen — der
  // Versatz macht eine direkte Umrechnung unzuverlässig.
  const grobeZeile = Math.round((stelle.y - RADIUS) / ZEILEN_HOEHE);

  let beste: Punkt = { spalte: 0, zeile: 0 };
  let besteEntfernung = Infinity;

  for (let zeile = grobeZeile - 1; zeile <= grobeZeile + 1; zeile++) {
    if (zeile < 0 || zeile >= ZEILEN) continue;
    for (let spalte = 0; spalte < SPALTEN; spalte++) {
      const m = mittelpunkt({ spalte, zeile });
      const entfernung = (m.x - stelle.x) ** 2 + (m.y - stelle.y) ** 2;
      if (entfernung < besteEntfernung) {
        besteEntfernung = entfernung;
        beste = { spalte, zeile };
      }
    }
  }
  return beste;
}

/** Ob an dieser Stelle eine Kugel der Wabe im Weg liegt. */
function trifft(wabe: Wabe, stelle: Stelle): boolean {
  const feld = naechstesFeld(stelle);
  if (wabe[feld.zeile]?.[feld.spalte] == null) return false;
  const m = mittelpunkt(feld);
  return (m.x - stelle.x) ** 2 + (m.y - stelle.y) ** 2 < KUGEL ** 2 * 0.8;
}

/**
 * Ein freies Feld für die ankommende Kugel suchen: das nächstgelegene freie
 * Feld rund um die Trefferstelle. Ohne das kann eine Kugel in einem schon
 * belegten Feld landen und eine andere überschreiben.
 */
function freiesZielFeld(wabe: Wabe, stelle: Stelle): Punkt | null {
  const start = naechstesFeld(stelle);
  if (wabe[start.zeile]?.[start.spalte] === null) return start;

  let beste: Punkt | null = null;
  let besteEntfernung = Infinity;
  for (const n of nachbarn(start)) {
    if (wabe[n.zeile]![n.spalte] !== null) continue;
    const m = mittelpunkt(n);
    const entfernung = (m.x - stelle.x) ** 2 + (m.y - stelle.y) ** 2;
    if (entfernung < besteEntfernung) {
      besteEntfernung = entfernung;
      beste = n;
    }
  }
  return beste;
}

export type Flugbahn = {
  /** Stützpunkte des Flugs, inklusive Startpunkt — für die Anzeige der Linie. */
  punkte: Stelle[];
  /** Wo die Kugel andockt. null, wenn sie nirgends Halt findet. */
  ziel: Punkt | null;
};

const SCHRITT = 0.5; // Rechenschritt entlang der Bahn
const MAX_SCHRITTE = 4000;

/**
 * Die Flugbahn ab der Kanone in eine Richtung verfolgen, bis die Kugel
 * eine andere trifft oder oben ankommt. An den Seitenwänden prallt sie ab.
 *
 * `winkel` ist im Bogenmaß, 0 zeigt nach rechts, negative Werte nach oben —
 * die Anzeige rechnet die Fingerposition entsprechend um.
 */
export function flugbahn(wabe: Wabe, winkel: number): Flugbahn {
  let x = KANONE.x;
  let y = KANONE.y;
  let dx = Math.cos(winkel) * SCHRITT;
  let dy = Math.sin(winkel) * SCHRITT;

  const punkte: Stelle[] = [{ x, y }];

  for (let i = 0; i < MAX_SCHRITTE; i++) {
    x += dx;
    y += dy;

    // Seitenwände: Richtung spiegeln und die Kugel wieder ins Feld setzen.
    if (x < RADIUS) {
      x = RADIUS;
      dx = -dx;
      punkte.push({ x, y });
    } else if (x > FELD_BREITE - RADIUS) {
      x = FELD_BREITE - RADIUS;
      dx = -dx;
      punkte.push({ x, y });
    }

    // Decke erreicht: in der obersten Zeile andocken.
    if (y <= RADIUS) {
      punkte.push({ x, y: RADIUS });
      return { punkte, ziel: freiesZielFeld(wabe, { x, y: RADIUS }) };
    }

    if (trifft(wabe, { x, y })) {
      punkte.push({ x, y });
      return { punkte, ziel: freiesZielFeld(wabe, { x, y }) };
    }

    // Nach unten aus dem Feld heraus — sollte bei erlaubten Winkeln nicht
    // vorkommen, hier nur als Abbruch statt einer Endlosschleife.
    if (y > FELD_HOEHE) break;
  }

  punkte.push({ x, y });
  return { punkte, ziel: null };
}

/**
 * Den Zielwinkel aus einer angetippten Stelle berechnen und auf einen
 * sinnvollen Bereich begrenzen — fast waagerechte Schüsse sind nutzlos und
 * fühlen sich kaputt an.
 */
export const MAX_ABWEICHUNG = (Math.PI / 180) * 78; // vom Senkrechten aus

export function winkelZu(stelle: Stelle): number {
  const dx = stelle.x - KANONE.x;
  const dy = stelle.y - KANONE.y;
  // Immer nach oben schießen.
  const winkel = Math.atan2(Math.min(dy, -0.001), dx);

  const senkrecht = -Math.PI / 2;
  const abweichung = winkel - senkrecht;
  const begrenzt = Math.max(-MAX_ABWEICHUNG, Math.min(MAX_ABWEICHUNG, abweichung));
  return senkrecht + begrenzt;
}
