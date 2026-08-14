import { schritt } from '../../core/rng';

/**
 * Spiellogik als reine Funktionen — kein React, kein Zufall von außen.
 * Genau so soll die Logik jedes Spiels aussehen: Zustand rein, neuer Zustand
 * raus. Dadurch lässt sich alles testen, ohne etwas anzuklicken.
 */

export type Richtung = 'up' | 'down' | 'left' | 'right';
export type Punkt = { x: number; y: number };

export type Zustand = {
  breite: number;
  hoehe: number;
  spieler: Punkt;
  ziel: Punkt;
  punkte: number;
  /** Verbleibende Sekunden. */
  restZeit: number;
  vorbei: boolean;
  /** Wandert bei jedem neuen Ziel weiter — gleiche Startsaat, gleicher Ablauf. */
  saat: number;
};

export const BREITE = 5;
export const HOEHE = 5;
export const START_ZEIT = 15;
export const ZEIT_BONUS = 1.5;

/** Setzt das Ziel auf ein zufälliges Feld, aber nie auf das des Spielers. */
function zielSetzen(
  saat: number,
  breite: number,
  hoehe: number,
  ausser: Punkt,
): { ziel: Punkt; saat: number } {
  const felder = breite * hoehe;
  const verboten = ausser.y * breite + ausser.x;

  // Aus den Feldern ohne das verbotene eins auswählen — so kann keine
  // Endlosschleife entstehen, wenn der Zufall mehrfach danebenliegt.
  const e = schritt(saat);
  let index = Math.floor(e.wert * (felder - 1));
  if (index >= verboten) index += 1;

  return { ziel: { x: index % breite, y: Math.floor(index / breite) }, saat: e.saat };
}

export function neuesSpiel(saat: number, breite = BREITE, hoehe = HOEHE): Zustand {
  const spieler = { x: Math.floor(breite / 2), y: Math.floor(hoehe / 2) };
  const gesetzt = zielSetzen(saat, breite, hoehe, spieler);
  return {
    breite,
    hoehe,
    spieler,
    ziel: gesetzt.ziel,
    punkte: 0,
    restZeit: START_ZEIT,
    vorbei: false,
    saat: gesetzt.saat,
  };
}

const versatz: Record<Richtung, Punkt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function bewegen(z: Zustand, richtung: Richtung): Zustand {
  if (z.vorbei) return z;

  const d = versatz[richtung];
  const neu = {
    x: Math.min(z.breite - 1, Math.max(0, z.spieler.x + d.x)),
    y: Math.min(z.hoehe - 1, Math.max(0, z.spieler.y + d.y)),
  };

  // Gegen die Wand gelaufen: nichts ändert sich.
  if (neu.x === z.spieler.x && neu.y === z.spieler.y) return z;

  if (neu.x !== z.ziel.x || neu.y !== z.ziel.y) {
    return { ...z, spieler: neu };
  }

  const gesetzt = zielSetzen(z.saat, z.breite, z.hoehe, neu);
  return {
    ...z,
    spieler: neu,
    ziel: gesetzt.ziel,
    saat: gesetzt.saat,
    punkte: z.punkte + 1,
    // Zeit gutschreiben, aber nie über den Startwert hinaus.
    restZeit: Math.min(START_ZEIT, z.restZeit + ZEIT_BONUS),
  };
}

export function zeitLaufen(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;
  const rest = z.restZeit - dt;
  if (rest <= 0) return { ...z, restZeit: 0, vorbei: true };
  return { ...z, restZeit: rest };
}

/** Hat der Spieler das Ziel gerade erwischt? Nur für Anzeige und Ton. */
export function gefangen(vorher: Zustand, nachher: Zustand): boolean {
  return nachher.punkte > vorher.punkte;
}
