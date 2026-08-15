import {
  FIGUR_RADIUS,
  bodenhoehe,
  hindernisse,
  type Kasten,
  type Zone,
} from './welt';

/**
 * Bewegung, Schwerkraft und Kollision — **ohne three.js, ohne React, ohne
 * Uhr.** Alles hier ist eine Funktion von Zustand und Zeitschritt auf einen
 * neuen Zustand.
 *
 * Der Grund ist derselbe wie überall im Projekt: „Kann die Figur durch die
 * Hauswand?" ist eine Frage, die ein Test beantworten soll und nicht ein
 * Mensch, der zwanzig Minuten gegen Wände läuft. In einem Spiel, in dem man
 * ständig gegen Dinge stößt, ist die Kollision der Kern — nicht die Optik.
 */

/** Wie schnell die Figur geht und rennt (Meter je Sekunde). */
export const GEH_TEMPO = 4.2;
export const RENN_TEMPO = 7.4;
/** Wie schnell sie auf das Zieltempo kommt bzw. abbremst. */
export const BESCHLEUNIGUNG = 34;
export const BREMSE = 26;
/** Wie schnell sich die Figur in die Laufrichtung dreht (Bogenmaß je Sekunde). */
export const DREH_TEMPO = 12;
export const SCHWERKRAFT = 22;
export const SPRUNG_KRAFT = 7.9;
/** Wie nah man an einem Sammelstück sein muss. */
export const AUFSAMMEL_ABSTAND = 1.15;
/** Wie nah an einem NPC, damit man ihn ansprechen kann. */
export const ANSPRECH_ABSTAND = 2.6;

export type Eingabe = {
  /** Laufrichtung in Weltkoordinaten, Länge 0 bis 1. */
  x: number;
  z: number;
  springen: boolean;
  rennen: boolean;
};

export const KEINE_EINGABE: Eingabe = { x: 0, z: 0, springen: false, rennen: false };

export type Spieler = {
  x: number;
  /** Fußhöhe über dem Boden der Welt. */
  y: number;
  z: number;
  /** Steiggeschwindigkeit. Negativ = fallend. */
  steigen: number;
  /** Blickrichtung im Bogenmaß, 0 = nach Osten (+x). */
  blick: number;
  /** Waagerechtes Tempo — für die Laufanimation und den Übergang Gehen/Rennen. */
  tempo: number;
  amBoden: boolean;
};

export function spielerAmStart(zone: Zone): Spieler {
  return {
    x: zone.spawn.x,
    y: 0,
    z: zone.spawn.z,
    steigen: 0,
    blick: zone.spawn.blick,
    tempo: 0,
    amBoden: true,
  };
}

// ---------------------------------------------------------------------
// Kollision
// ---------------------------------------------------------------------

/**
 * Schiebt einen Kreis aus einem Quader heraus — über die **kürzeste** Achse.
 *
 * Das ist der Kern des ganzen Bewegungsgefühls. Würde man beide Achsen
 * gleichzeitig korrigieren, bliebe die Figur an jeder Wand kleben; über die
 * kürzere Achse herauszuschieben lässt sie stattdessen **entlanggleiten**.
 * Genau das erwartet jeder, der schon einmal in einem Spiel schräg gegen
 * eine Wand gelaufen ist.
 *
 * Gibt die neue Position zurück, oder `null`, wenn gar keine Überschneidung
 * vorlag.
 */
export function ausKastenSchieben(
  x: number,
  z: number,
  radius: number,
  k: Kasten,
): { x: number; z: number } | null {
  const halbB = k.breite / 2;
  const halbT = k.tiefe / 2;

  // Der nächste Punkt auf dem Quader zum Kreismittelpunkt.
  const nahX = Math.max(k.x - halbB, Math.min(x, k.x + halbB));
  const nahZ = Math.max(k.z - halbT, Math.min(z, k.z + halbT));
  const dx = x - nahX;
  const dz = z - nahZ;
  const abstandQuadrat = dx * dx + dz * dz;

  if (abstandQuadrat > radius * radius) return null;

  /*
   * Ein Hauch Luft beim Herausschieben.
   *
   * Ohne ihn landet die Figur **exakt** auf dem Radius — und exakt auf dem
   * Radius zählt als Berührung, also wird im nächsten Durchgang wieder
   * geschoben (um null). Die Auflösungsschleife käme dadurch nie zur Ruhe
   * und meldete dauerhaft „steckt fest", obwohl die Position längst stimmt.
   * Ein Zehntelmillimeter Abstand beendet das sauber.
   */
  const luft = radius + 1e-4;

  if (abstandQuadrat > 1e-9) {
    // Mittelpunkt liegt **außerhalb** des Quaders: entlang der Verbindung
    // herausschieben. Das trifft auch die Ecken richtig — dort schiebt es
    // diagonal, und die Figur rutscht um die Kante statt daran zu haken.
    const abstand = Math.sqrt(abstandQuadrat);
    const anteil = (luft - abstand) / abstand;
    return { x: x + dx * anteil, z: z + dz * anteil };
  }

  /*
   * Mittelpunkt liegt **im** Quader. Das passiert bei sehr großen
   * Zeitschritten oder wenn etwas die Figur hineinsetzt. Dann über die
   * Seite herausschieben, die am nächsten ist — sonst schießt die Figur
   * quer durch das Gebäude auf die andere Seite.
   */
  const rausLinks = x - (k.x - halbB) + luft;
  const rausRechts = k.x + halbB - x + luft;
  const rausOben = z - (k.z - halbT) + luft;
  const rausUnten = k.z + halbT - z + luft;
  const kleinste = Math.min(rausLinks, rausRechts, rausOben, rausUnten);

  if (kleinste === rausLinks) return { x: k.x - halbB - luft, z };
  if (kleinste === rausRechts) return { x: k.x + halbB + luft, z };
  if (kleinste === rausOben) return { x, z: k.z - halbT - luft };
  return { x, z: k.z + halbT + luft };
}

/**
 * Löst alle Überschneidungen auf.
 *
 * Mehrere Durchgänge, weil das Herausschieben aus einem Kasten in den
 * nächsten führen kann — typisch in einer Innenecke aus zwei Zäunen. Drei
 * Durchgänge reichen für jede Ecke aus zwei bis drei Kästen; danach wird
 * abgebrochen, damit ein unmöglicher Fall nicht die Bildrate frisst.
 */
export function kollisionLoesen(
  x: number,
  z: number,
  radius: number,
  kaesten: readonly Kasten[],
  /** Fußhöhe der Figur — was tiefer liegt als sie, blockiert nicht. */
  fussHoehe = 0,
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let runde = 0; runde < 3; runde++) {
    let etwasGeschoben = false;
    for (const k of kaesten) {
      // Worauf man draufsteht, blockiert nicht mehr. Ohne diese Zeile
      // könnte man nie auf eine Mülltonne springen — man würde beim
      // Landen seitlich weggeschoben.
      if (k.hoehe <= fussHoehe + 0.05) continue;
      const neu = ausKastenSchieben(px, pz, radius, k);
      if (neu) {
        px = neu.x;
        pz = neu.z;
        etwasGeschoben = true;
      }
    }
    if (!etwasGeschoben) break;
  }
  return { x: px, z: pz };
}

// ---------------------------------------------------------------------
// Der Takt
// ---------------------------------------------------------------------

/**
 * Ein Zeitschritt.
 *
 * `dt` wird vom Aufrufer gedeckelt (siehe `AbenteuerSeite`), hier aber noch
 * einmal begrenzt: Nach einem App-Wechsel wäre er sonst mehrere Sekunden
 * groß, und die Figur führe in einem einzigen Schritt quer durch die halbe
 * Stadt — mitten durch jede Wand, weil die Kollision nur den Endpunkt
 * prüft.
 */
export function takt(
  spieler: Spieler,
  eingabe: Eingabe,
  zone: Zone,
  dtRoh: number,
  kaesten: readonly Kasten[] = hindernisse(zone),
): Spieler {
  const dt = Math.min(0.05, Math.max(0, dtRoh));

  const laenge = Math.hypot(eingabe.x, eingabe.z);
  const willLaufen = laenge > 0.05;
  const zielTempo = willLaufen
    ? (eingabe.rennen ? RENN_TEMPO : GEH_TEMPO) * Math.min(1, laenge)
    : 0;

  // Tempo angleichen — Beschleunigen dauert länger als Bremsen. Das ist
  // Absicht: Sofort auf Höchsttempo zu sein fühlt sich nach Schlitten an,
  // langsam abzubremsen nach Eis.
  const rate = zielTempo > spieler.tempo ? BESCHLEUNIGUNG : BREMSE;
  let tempo = spieler.tempo + Math.sign(zielTempo - spieler.tempo) * rate * dt;
  if ((zielTempo - spieler.tempo) * (zielTempo - tempo) < 0) tempo = zielTempo;

  // Blickrichtung dreht sich zur Laufrichtung, statt zu springen.
  let blick = spieler.blick;
  if (willLaufen) {
    const ziel = Math.atan2(eingabe.z, eingabe.x);
    let diff = ziel - blick;
    // Auf −π…π bringen, sonst dreht die Figur bei jedem Nulldurchgang
    // einmal ganz herum.
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const schritt = Math.min(Math.abs(diff), DREH_TEMPO * dt) * Math.sign(diff);
    blick += schritt;
  }

  // Waagerecht bewegen, dann Kollision auflösen.
  let x = spieler.x;
  let z = spieler.z;
  if (tempo > 0.01 && willLaufen) {
    const nx = eingabe.x / laenge;
    const nz = eingabe.z / laenge;
    x += nx * tempo * dt;
    z += nz * tempo * dt;
  }

  const fuss = spieler.y;
  const geloest = kollisionLoesen(x, z, FIGUR_RADIUS, kaesten, fuss);
  x = geloest.x;
  z = geloest.z;

  // Innerhalb der Zone bleiben.
  const g = zone.grenze - FIGUR_RADIUS;
  x = Math.max(-g, Math.min(g, x));
  z = Math.max(-g, Math.min(g, z));

  // Senkrecht: springen, fallen, landen.
  let y = spieler.y;
  let steigen = spieler.steigen;
  let amBoden = spieler.amBoden;

  if (eingabe.springen && amBoden) {
    steigen = SPRUNG_KRAFT;
    amBoden = false;
  }

  steigen -= SCHWERKRAFT * dt;
  y += steigen * dt;

  const boden = bodenhoehe(zone, x, z);
  if (y <= boden) {
    y = boden;
    steigen = 0;
    amBoden = true;
  } else {
    amBoden = false;
  }

  return { x, y, z, steigen, blick, tempo, amBoden };
}

// ---------------------------------------------------------------------
// Aufsammeln und Ansprechen
// ---------------------------------------------------------------------

/** Der Abstand in der Ebene — Höhe zählt beim Ansprechen nicht mit. */
export function abstandEben(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Welche Sammelstücke die Figur gerade einsammelt.
 *
 * Die Höhe zählt mit, aber großzügiger als die Ebene: Ein Stück auf der
 * Mülltonne soll man im Sprung mitnehmen, ohne es exakt zu treffen. Zu
 * streng gefasst wird aus „einsammeln" ein Geschicklichkeitsspiel, das
 * niemand wollte.
 */
export function eingesammelt(
  spieler: Spieler,
  stuecke: readonly { id: string; x: number; y: number; z: number }[],
  schon: ReadonlySet<string>,
): string[] {
  const treffer: string[] = [];
  for (const s of stuecke) {
    if (schon.has(s.id)) continue;
    if (abstandEben(spieler, s) > AUFSAMMEL_ABSTAND) continue;
    /*
     * Die Figur greift von etwas unter den Füßen bis knapp über den Kopf.
     * Die Obergrenze lag zuerst bei 2,2 — damit war ein Stück auf 2,1
     * Metern vom Boden aus erreichbar, obwohl es auf einer Mülltonne
     * liegen und einen Sprung kosten sollte. Die zwei schwer erreichbaren
     * Sammelstücke waren dadurch stillschweigend geschenkt.
     */
    if (s.y < spieler.y - 0.6 || s.y > spieler.y + 1.9) continue;
    treffer.push(s.id);
  }
  return treffer;
}

/** Der nächste ansprechbare NPC, oder `null`. */
export function naechsterNpc<T extends { id: string; x: number; z: number }>(
  spieler: Spieler,
  npcs: readonly T[],
): T | null {
  let bester: T | null = null;
  let besterAbstand = ANSPRECH_ABSTAND;
  for (const n of npcs) {
    const d = abstandEben(spieler, n);
    if (d < besterAbstand) {
      besterAbstand = d;
      bester = n;
    }
  }
  return bester;
}
