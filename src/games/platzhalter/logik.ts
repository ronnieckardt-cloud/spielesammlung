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

/**
 * Mindestabstand (Manhattan) zwischen Figur und neuem Stern.
 *
 * Vorher war nur das Feld der Figur ausgeschlossen — der Stern durfte also
 * direkt nebenan erscheinen. Damit hing die Punktzahl stark am Zufall: mal
 * ein Zug für einen Punkt samt Zeitgutschrift, mal acht. Zwei Felder sind
 * das kleinste Maß, das „ein Schritt und fertig" ausschließt, ohne dass die
 * Nachbarschaft der Figur gleich ganz leer bleibt.
 */
export const MIN_ABSTAND = 2;

/**
 * Wie viel Zeit ein eingesammelter Stern gutschreibt.
 *
 * Vorher war das eine Konstante (1,5 s) und die Schwierigkeit stieg nie:
 * Feldgröße, Startzeit und Bonus hingen an keiner Stelle vom Punktestand ab,
 * der vierzigste Stern war exakt so leicht wie der erste.
 *
 * Der Bonus ist die Stellschraube mit dem besten Verhältnis: Er braucht
 * keinen zusätzlichen Zustand. Ein wachsendes Feld schiede aus (auf dem
 * Handy würden die Kacheln nur kleiner), ein beweglicher Gegenspieler wäre
 * eigener Zustand und eine eigene Testreihe.
 *
 * `abPunkten` muss aufsteigend stehen — `stufeFuer` läuft die Liste von vorn
 * durch und merkt sich die letzte erreichte Stufe.
 */
const ZEIT_STUFEN = [
  { abPunkten: 0, bonus: 1.5 },
  { abPunkten: 10, bonus: 1.2 },
  { abPunkten: 15, bonus: 1.0 },
  { abPunkten: 25, bonus: 0.85 },
] as const;

/** Die erreichte Stufe, beginnend bei 1 — für die Anzeige über dem Feld. */
export function stufeFuer(punkte: number): number {
  let stufe = 1;
  for (let i = 0; i < ZEIT_STUFEN.length; i++) {
    if (punkte >= ZEIT_STUFEN[i].abPunkten) stufe = i + 1;
  }
  return stufe;
}

/** Zeitgutschrift für den Stern, mit dem man auf `punkte` kommt. */
export function zeitBonusFuer(punkte: number): number {
  return ZEIT_STUFEN[stufeFuer(punkte) - 1].bonus;
}

/**
 * Setzt das Ziel auf ein zufälliges Feld — nie auf das des Spielers und
 * möglichst mindestens {@link MIN_ABSTAND} Felder entfernt.
 */
function zielSetzen(
  saat: number,
  breite: number,
  hoehe: number,
  ausser: Punkt,
): { ziel: Punkt; saat: number } {
  const felder = breite * hoehe;

  // Erst die erlaubten Felder sammeln, dann genau einmal daraus ziehen.
  // Die Liste ist endlich und wird einmal durchlaufen — anders als „neu
  // würfeln, bis es passt" kann hier keine Endlosschleife entstehen.
  const weit: number[] = [];
  const nah: number[] = [];
  for (let i = 0; i < felder; i++) {
    const abstand = Math.abs((i % breite) - ausser.x) + Math.abs(Math.floor(i / breite) - ausser.y);
    if (abstand >= MIN_ABSTAND) weit.push(i);
    else if (abstand > 0) nah.push(i);
  }

  // Auf einem sehr kleinen Feld (2×1 etwa) gibt es womöglich kein einziges
  // weit genug entferntes Feld. Dann gilt nur noch „nicht auf der Figur" —
  // die Regel, die vorher als einzige galt.
  const auswahl = weit.length > 0 ? weit : nah;
  const e = schritt(saat);
  const index = auswahl.length > 0 ? auswahl[Math.floor(e.wert * auswahl.length)] : 0;

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
  const punkte = z.punkte + 1;
  return {
    ...z,
    spieler: neu,
    ziel: gesetzt.ziel,
    saat: gesetzt.saat,
    punkte,
    // Zeit gutschreiben, aber nie über den Startwert hinaus. Der Bonus hängt
    // am neuen Punktestand, nicht am alten: Was man gerade erreicht hat,
    // bestimmt die Stufe — sonst zöge die Anzeige der Wirkung hinterher.
    restZeit: Math.min(START_ZEIT, z.restZeit + zeitBonusFuer(punkte)),
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
