/**
 * Florianville — die Weltdaten.
 *
 * **Reine Daten und reine Funktionen, kein three.js.** Dieselbe Trennung wie
 * bei Dash City, und aus demselben Grund: Was hier steht, lässt sich ohne
 * Browser prüfen. Ob eine Figur durch eine Hauswand laufen kann, ist eine
 * Frage der Geometrie, nicht der Darstellung — und sie muss beantwortet
 * sein, bevor irgendjemand ein Haus zeichnet.
 *
 * ## Koordinaten
 *
 * `x` nach Osten, `z` nach Süden, `y` nach oben. Alles in Metern. Die Figur
 * ist etwa 1,7 hoch — dieselbe Größe wie in Dash City, damit sich beide
 * Spiele gleich anfühlen und Sprunghöhen vergleichbar bleiben.
 *
 * ## Warum die Stadt aus Kästen besteht
 *
 * Jedes Hindernis ist ein achsenparalleler Quader. Das ist keine
 * Bequemlichkeit, sondern die Bedingung dafür, dass die Kollision billig
 * *und* verlässlich ist: Kreis gegen Quader ist eine Handvoll Vergleiche,
 * läuft auf einem alten iPad tausendfach je Bild und hat keine Sonderfälle,
 * in denen die Figur steckenbleibt. Schräge Wände sähen zwar hübscher aus,
 * kosten aber genau die Verlässlichkeit, die ein Spiel braucht, in dem man
 * ständig gegen Dinge läuft.
 */

export type Kasten = {
  /** Mittelpunkt. */
  x: number;
  z: number;
  breite: number;
  tiefe: number;
  hoehe: number;
};

export type Haus = Kasten & {
  farbe: string;
  dachfarbe: string;
  /** Stockwerke — bestimmt die Fensterreihen. */
  geschosse: number;
};

export type Baum = { x: number; z: number; groesse: number };
export type Laterne = { x: number; z: number };

export type Sammelstueck = { id: string; x: number; y: number; z: number };

export type NpcPlatz = {
  id: string;
  x: number;
  z: number;
  /** Blickrichtung im Bogenmaß, 0 = nach Osten. */
  blick: number;
};

export type Zone = {
  id: string;
  name: string;
  /** Halbe Kantenlänge des begehbaren Bereichs. */
  grenze: number;
  spawn: { x: number; z: number; blick: number };
  haeuser: readonly Haus[];
  /** Zäune, Mauern, Hecken — alles, was blockiert, aber kein Haus ist. */
  sperren: readonly Kasten[];
  baeume: readonly Baum[];
  laternen: readonly Laterne[];
  sammelstuecke: readonly Sammelstueck[];
  npcs: readonly NpcPlatz[];
  /** Straßen als Rechtecke — nur zum Zeichnen, sie blockieren nichts. */
  strassen: readonly Kasten[];
};

/** Wie hoch die Figur ist. Gleich wie in Dash City, damit sich beides gleich anfühlt. */
export const FIGUR_HOEHE = 1.7;
/** Wie dick die Figur ist — der Radius für die Kollision. */
export const FIGUR_RADIUS = 0.42;

/*
 * Das Wohnviertel: eine Kreuzung, vier Blöcke, acht Häuser mit Vorgärten.
 *
 * Bewusst **klein und dicht** statt groß und leer. Eine weite Fläche mit
 * wenigen Gebäuden fühlt sich nach Testumgebung an; ein enges Viertel mit
 * Ecken, Hinterhöfen und Sichtblockaden fühlt sich nach Ort an. Man soll um
 * eine Ecke gehen und nicht wissen, was dahinter liegt — das ist der ganze
 * Unterschied zwischen „Spielfeld" und „Stadtviertel".
 */
/*
 * Wand- und Dachfarbe je Haus.
 *
 * Kräftig und **warm gemischt mit kalt**: Eine Reihe aus lauter warmen
 * Tönen sieht nach Postkarte aus, eine aus lauter kalten nach Vorstadt bei
 * Regen. Im Wechsel liest sich eine Straße als gewachsen. Jedes Dach ist
 * deutlich dunkler als seine Wand — das ist die einfachste Art, einem
 * Cartoon-Haus Gewicht zu geben.
 */
const HAUSFARBEN: readonly (readonly [string, string])[] = [
  ['#f2c14e', '#b4453f'], // Sonnengelb mit Ziegeldach
  ['#7fc7a4', '#3f6f88'], // Mint mit Schieferdach
  ['#e58b6f', '#8a5a2b'], // Terrakotta
  ['#9fb8dd', '#3d5a8a'], // Taubenblau
  ['#e7a3c0', '#8c4667'], // Altrosa
  ['#bcd47f', '#5a7d3a'], // Lindgrün
];

/** Ein Haus an einer festen Stelle. */
function haus(
  x: number,
  z: number,
  breite: number,
  tiefe: number,
  geschosse: number,
  farbnummer: number,
): Haus {
  const [farbe, dachfarbe] = HAUSFARBEN[farbnummer % HAUSFARBEN.length]!;
  return { x, z, breite, tiefe, hoehe: 3.2 * geschosse, geschosse, farbe, dachfarbe };
}

const HAEUSER: readonly Haus[] = [
  /*
   * **Ein Haus je Quadrant, dicht an der Straße.**
   *
   * Der erste Entwurf stellte acht Häuser auf x = ±18. Am Rechner sah das
   * nach Viertel aus — auf dem iPhone war **kein einziges Haus im Bild**.
   * Der Grund ist das Hochformat: Bei 58° senkrechtem Sichtfeld und einem
   * Seitenverhältnis von 0,68 bleiben waagerecht rund 20° übrig. Ein Haus
   * 18 Meter neben einer Figur, die 13 Meter voraus schaut, liegt 54° zur
   * Seite — dreimal so weit draußen wie die Bildkante.
   *
   * Für ein Handy muss eine Stadt **eng** gebaut sein. Das ist keine
   * Einschränkung, sondern passt sogar besser: Ein Cartoon-Viertel lebt
   * von Enge, nicht von Vorortabständen.
   */
  haus(-11.5, -12.5, 9, 8, 2, 0),
  haus(11.5, -12.5, 9, 8, 2, 2),
  haus(-11.5, 12.5, 9, 8, 1, 4),
  haus(11.5, 12.5, 9, 8, 2, 1),
];

/*
 * Zäune. Sie stehen **vor** den Häusern zur Straße hin und lassen jeweils
 * eine Lücke als Gartentor. Genau diese Lücken machen aus einer Reihe von
 * Klötzen ein Viertel: Man muss den Weg suchen, statt überall langzulaufen.
 */
function zaun(x: number, z: number, breite: number, tiefe: number): Kasten {
  return { x, z, breite, tiefe, hoehe: 1.1 };
}

const SPERREN: readonly Kasten[] = [
  /*
   * Vorgartenzäune zwischen Gehweg und Haus, jeweils mit **einer Lücke als
   * Gartentor**. Genau diese Lücken machen aus vier Klötzen ein Viertel:
   * Man muss den Weg suchen, statt überall langzulaufen.
   *
   * Sie liegen auf |z| = 6,6 bzw. |x| = 6,6 — zwischen Gehwegkante (5,7)
   * und Hauswand (8,5). Der Streifen dazwischen ist knapp zwei Meter breit,
   * die Figur ist 0,84 dick: eng genug, dass es nach Gasse aussieht, weit
   * genug, dass niemand hängen bleibt.
   */
  zaun(-15.5, -6.6, 4, 0.4),
  zaun(-9, -6.6, 3, 0.4),
  zaun(15.5, -6.6, 4, 0.4),
  zaun(9, -6.6, 3, 0.4),
  zaun(-15.5, 6.6, 4, 0.4),
  zaun(-9, 6.6, 3, 0.4),
  zaun(15.5, 6.6, 4, 0.4),
  zaun(9, 6.6, 3, 0.4),

  // Hecken hinter den Häusern — dahinter liegen Sammelstücke, die man von
  // der Straße aus nicht sieht.
  zaun(-19, -19, 0.6, 7),
  zaun(19, 19, 0.6, 7),

  // Mülltonnen an der Straßenecke. Die einzigen Dinge, auf die man springen
  // kann — und genau darauf liegen zwei Sammelstücke.
  { x: 6.6, z: -7.2, breite: 2.2, tiefe: 1.2, hoehe: 1.3 },
  { x: -6.6, z: 7.2, breite: 2.2, tiefe: 1.2, hoehe: 1.3 },
];

const BAEUME: readonly Baum[] = [
  { x: -6.6, z: -10, groesse: 1.05 },
  { x: 6.6, z: -16, groesse: 0.95 },
  { x: -6.6, z: 16, groesse: 1.0 },
  { x: 6.6, z: 10, groesse: 1.15 },
  { x: -17, z: -3, groesse: 1.2 },
  { x: 17, z: 3, groesse: 1.05 },
  { x: -3, z: -18, groesse: 0.9 },
  { x: 3, z: 18, groesse: 1.1 },
];

const LATERNEN: readonly Laterne[] = [
  { x: -5.9, z: -5.9 },
  { x: 5.9, z: -5.9 },
  { x: -5.9, z: 5.9 },
  { x: 5.9, z: 5.9 },
  { x: -5.9, z: -17 },
  { x: 5.9, z: 17 },
];

/*
 * Sammelstücke. **Nicht alle auf Augenhöhe an der Straße.** Drei liegen
 * hinter Hecken, zwei auf Vordächern (nur per Sprung von der Mülltonne aus
 * erreichbar), der Rest verteilt. Ein Sammelstück, das man im Vorbeigehen
 * mitnimmt, ist kein Fund — es ist Dekoration mit Zähler.
 */
const SAMMELSTUECKE: readonly Sammelstueck[] = [
  // Auf der Straße — die ersten, die man sieht.
  { id: 'st-1', x: 0, y: 1.1, z: -10 },
  { id: 'st-2', x: -10, y: 1.1, z: 0 },
  { id: 'st-3', x: 10, y: 1.1, z: 0 },
  { id: 'st-4', x: 0, y: 1.1, z: 12 },
  // Hinter den Hecken
  { id: 'st-5', x: -19, y: 1.1, z: -15 },
  { id: 'st-6', x: 19, y: 1.1, z: 15 },
  // Auf den Mülltonnen — nur im Sprung erreichbar
  { id: 'st-7', x: 6.6, y: 2.1, z: -7.2 },
  { id: 'st-8', x: -6.6, y: 2.1, z: 7.2 },
  // In den Ecken des Viertels
  { id: 'st-9', x: -19.5, y: 1.1, z: -19.5 },
  { id: 'st-10', x: 19.5, y: 1.1, z: -19.5 },
  { id: 'st-11', x: -19.5, y: 1.1, z: 19.5 },
  { id: 'st-12', x: 19.5, y: 1.1, z: 19.5 },
];

const NPCS: readonly NpcPlatz[] = [
  // Am Gartentor gegenüber vom Spawn — der Erste, den man trifft.
  { id: 'nachbarin', x: -9, z: -5.0, blick: 0 },
  // An der Kreuzung
  { id: 'mechaniker', x: 6.8, z: -2.0, blick: Math.PI },
  // Vor dem Haus im Südosten, diesseits des Zauns.
  { id: 'leo', x: 9.5, z: 5.0, blick: -Math.PI / 2 },
];

/** Straßenflächen — nur Optik, sie halten niemanden auf. */
const STRASSEN: readonly Kasten[] = [
  // Nord-Süd-Achse
  { x: 0, z: 0, breite: 9, tiefe: 46, hoehe: 0 },
  // Ost-West-Achse
  { x: 0, z: 0, breite: 46, tiefe: 9, hoehe: 0 },
];

export const WOHNVIERTEL: Zone = {
  id: 'wohnviertel',
  name: 'Ahornweg',
  grenze: 22,
  // Startpunkt an der Kreuzung, Blick nach Norden — von dort sieht man in
  // beide Straßen und auf das erste Haus. Ein Startpunkt mit Aussicht ist
  // der billigste Weg, eine Welt größer wirken zu lassen, als sie ist.
  spawn: { x: 0, z: 4, blick: -Math.PI / 2 },
  haeuser: HAEUSER,
  sperren: SPERREN,
  baeume: BAEUME,
  laternen: LATERNEN,
  sammelstuecke: SAMMELSTUECKE,
  npcs: NPCS,
  strassen: STRASSEN,
};

// ---------------------------------------------------------------------
// Abgeleitetes
// ---------------------------------------------------------------------

/**
 * Alle Kästen, gegen die die Figur stößt.
 *
 * Bäume kommen als schmale Kästen dazu: Ein Baum, durch den man
 * hindurchläuft, zerstört die Glaubwürdigkeit einer Welt schneller als eine
 * fehlende Textur. Laternen dagegen **nicht** — an einem Pfosten hängen zu
 * bleiben ist reiner Ärger ohne jeden Gewinn.
 */
export function hindernisse(zone: Zone): Kasten[] {
  return [
    ...zone.haeuser,
    ...zone.sperren,
    ...zone.baeume.map((b) => ({
      x: b.x,
      z: b.z,
      breite: 0.55 * b.groesse,
      tiefe: 0.55 * b.groesse,
      hoehe: 4 * b.groesse,
    })),
  ];
}

/**
 * Wie hoch der Boden an einer Stelle ist.
 *
 * Flach, außer auf den Mülltonnen und flachen Vordächern — die sind die
 * einzigen Stellen, auf die man springen kann, und genau dort liegen die
 * schwer erreichbaren Sammelstücke. Mehr Höhenunterschied braucht ein
 * Wohnviertel nicht; die Berge kommen später in einer eigenen Zone.
 */
export function bodenhoehe(zone: Zone, x: number, z: number): number {
  let hoehe = 0;
  for (const k of zone.sperren) {
    // Nur niedrige Dinge sind begehbar. Auf ein Haus kommt man nicht.
    if (k.hoehe > 1.6) continue;
    if (
      Math.abs(x - k.x) <= k.breite / 2 &&
      Math.abs(z - k.z) <= k.tiefe / 2 &&
      k.hoehe > hoehe
    ) {
      hoehe = k.hoehe;
    }
  }
  return hoehe;
}
