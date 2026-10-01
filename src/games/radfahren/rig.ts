import { bodenHoehe, bodenSteigung, lueckeEnde } from './logik';
import type { Landung, Lauf } from './logik';
import type { FahrerPose } from './fahrer';

/**
 * Der Darstellungszustand von Rad und Fahrer — rein, ohne three.js und ohne Canvas.
 *
 * Die Logik (`takt`) kennt nur einen Punkt, einen Winkel und ein paar Zähler. Alles,
 * was man **sieht** und was über Bild und Bild hinweg gedämpft werden muss — das
 * Einfedern, das weiche Umschalten zwischen Sitzen und Stehen, die Kamera, der
 * Sturzfahrer, die Funken beim Einsammeln — steht hier. Es steckte vorher in der
 * 2-D-Zeichnung (`zeichnen.ts`) und war dadurch an Canvas gebunden; die 3-D-Szene
 * braucht dieselbe Rechnung und bekommt sie von hier. Beide Darstellungen zeigen
 * dasselbe Verhalten, weil es **eine** Rechnung ist.
 *
 * Nichts davon beeinflusst eine Spielregel. Der Sturzfahrer etwa fliegt nur als
 * Bild — die Logik hat den Lauf längst beendet.
 */

/** Wie viel größer Rad und Fahrer gezeichnet werden als ihre Maße. Siehe `zeichnen.ts`. */
export const MODELL_GROESSE = 1.55;
/** Radradius in Metern (Zeichnung, nicht Physik). */
export const RAD_RADIUS = 0.42;

export type Sturzfahrer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drehung: number;
  drehTempo: number;
  /** 0 = fliegt, 1 = liegt. */
  schlaff: number;
  aufgeschlagen: boolean;
  zeit: number;
};

/**
 * Was die Darstellung aus einem Bild an Effekten ableitet. Die Szene macht daraus
 * Teilchen; die Farben sind hier nur Namen, damit dieser Baustein keine Palette kennt.
 */
export type Effekt =
  | { art: 'erde'; x: number; y: number; zahl: number; tempo: number; staerke: number; farbe: 'boden' | 'saum' }
  | { art: 'staub'; x: number; y: number; zahl: number }
  | { art: 'funken'; x: number; y: number; zahl: number; farbe: string; staerke: number }
  | { art: 'ring'; x: number; y: number; farbe: string };

export type RigZustand = {
  uhr: number;
  kameraX: number;
  kameraY: number;
  kameraGesetzt: boolean;
  federVorn: number;
  federHinten: number;
  schuettel: number;
  blitz: number;
  radDrehung: number;
  vyVorher: number;
  landungVorher: Landung | null;
  stehen: number;
  gewicht: number;
  boost: number;
  erdUhr: number;
  bekanntMuenzen: Set<number>;
  bekanntPads: Set<number>;
  bekanntPops: number;
  bekanntLuecken: number;
  sturz: Sturzfahrer | null;
  letztesVx: number;
};

export function neuerRig(): RigZustand {
  return {
    uhr: 0,
    kameraX: 0,
    kameraY: 0,
    kameraGesetzt: false,
    federVorn: 0,
    federHinten: 0,
    schuettel: 0,
    blitz: 0,
    radDrehung: 0,
    vyVorher: 0,
    landungVorher: null,
    stehen: 0,
    gewicht: 0,
    boost: 0,
    erdUhr: 0,
    bekanntMuenzen: new Set(),
    bekanntPads: new Set(),
    bekanntPops: 0,
    bekanntLuecken: 0,
    sturz: null,
    letztesVx: 0,
  };
}

/** Das Ergebnis eines Schritts: die Haltung für die Zeichnung und die Effekte dieses Bildes. */
export type RigAusgabe = {
  pose: FahrerPose;
  effekte: Effekt[];
  /** Wie viele Meter quer ins Bild passen — bei Tempo mehr. */
  sicht: number;
};

/** Wie viele Meter quer ins Bild passen — bei Tempo etwas mehr, siehe `zeichnen.ts`. */
export const SICHT_RUHIG = 11.5;
export const SICHT_SCHNELL = 17.5;

/**
 * Rückt den Darstellungszustand um `dt` Sekunden weiter.
 *
 * Die Reihenfolge ist dieselbe wie in der 2-D-Zeichnung: erst Kamera, dann Stoß und
 * Federung, dann Ereignisse, dann Ausklingen, zuletzt Haltung und Sturz.
 */
export function rigSchritt(z: RigZustand, lauf: Lauf, dt: number): RigAusgabe {
  const g = lauf.gelaende;
  const effekte: Effekt[] = [];
  z.uhr += dt;

  // --- Kamera ---------------------------------------------------
  const tempoAnteil = Math.min(1, Math.max(0, lauf.vx / 16));
  const sicht = SICHT_RUHIG + (SICHT_SCHNELL - SICHT_RUHIG) * tempoAnteil;
  const zielX = (z.sturz ? Math.max(lauf.x, z.sturz.x) : lauf.x) + sicht * 0.16;
  const zielY = (z.sturz ? Math.max(lauf.y, z.sturz.y - 1.2) : lauf.y) + 1.1;
  if (!z.kameraGesetzt) {
    z.kameraX = zielX;
    z.kameraY = zielY;
    z.kameraGesetzt = true;
    // Was beim Start schon eingesammelt ist, soll keine Funken auslösen.
    z.bekanntMuenzen = new Set(lauf.geholt);
    z.bekanntPads = new Set(lauf.padsGenommen);
    z.bekanntPops = lauf.popZahl;
    z.bekanntLuecken = lauf.lueckenZahl;
  } else {
    const folgen = Math.min(1, dt * 5.5);
    z.kameraX += (zielX - z.kameraX) * folgen;
    z.kameraY += (zielY - z.kameraY) * folgen;
  }

  // --- Stoß: Federung und Wackeln ---------------------------------
  const hintenX = lauf.x - 0.95 * Math.cos(lauf.winkel);
  const vornX = lauf.x + 0.75 * Math.cos(lauf.winkel);
  /*
   * Der Stoß ist die Geschwindigkeit, die im Moment des Aufsetzens verloren geht.
   * Es gibt zwei Fälle: Wer **fällt** (`vyVorher` negativ), landet mit genau dieser
   * Fallgeschwindigkeit — die Logik setzt `vy` beim Aufsetzen auf null, die Differenz
   * zum Bild davor ist also `−vyVorher`. Wer noch **steigt** (`vyVorher` positiv) und
   * auf den Boden zurückgedrückt wird, verliert `vyVorher − vy`. Die 2-D-Zeichnung
   * kannte nur den zweiten Fall: Dort rechnete `vyVorher − vy` bei jeder Landung aus
   * einem Sprung eine negative Zahl und federte deshalb nie ein.
   */
  const stoss = Math.max(0, -z.vyVorher, z.vyVorher - lauf.vy);
  z.vyVorher = lauf.vy;
  if (lauf.amBoden && stoss > 1) {
    const kraft = Math.min(1, stoss / 14);
    z.federVorn = Math.min(1, z.federVorn + kraft);
    z.federHinten = Math.min(1, z.federHinten + kraft * 1.15);
    effekte.push({ art: 'erde', x: hintenX, y: bodenHoehe(g, hintenX), zahl: 2 + Math.round(kraft * 6), tempo: lauf.vx, staerke: 0.8 + kraft * 0.5, farbe: 'boden' });
    effekte.push({ art: 'erde', x: vornX, y: bodenHoehe(g, vornX), zahl: 2 + Math.round(kraft * 5), tempo: lauf.vx, staerke: 0.8 + kraft * 0.5, farbe: 'boden' });
    if (kraft > 0.35) {
      z.schuettel = Math.min(1, z.schuettel + kraft);
      effekte.push({ art: 'staub', x: lauf.x, y: bodenHoehe(g, lauf.x), zahl: 3 });
    }
  }
  if (lauf.letzteLandung === 'perfekt' && z.landungVorher !== 'perfekt') {
    z.blitz = 1;
    effekte.push({ art: 'funken', x: lauf.x, y: bodenHoehe(g, lauf.x) + 0.2, zahl: 7, farbe: '#ffe9a3', staerke: 0.8 });
  }
  z.landungVorher = lauf.letzteLandung;

  // --- Ereignisse, die Funken auslösen ------------------------------
  if (lauf.geholt.size < z.bekanntMuenzen.size) z.bekanntMuenzen = new Set();
  if (lauf.geholt.size > z.bekanntMuenzen.size) {
    for (const i of lauf.geholt) {
      if (z.bekanntMuenzen.has(i)) continue;
      z.bekanntMuenzen.add(i);
      const c = g.muenzen[i];
      if (c) effekte.push({ art: 'funken', x: c.x, y: c.y, zahl: 8, farbe: '#ffd75a', staerke: 1 });
    }
  }
  if (lauf.padsGenommen.size < z.bekanntPads.size) z.bekanntPads = new Set();
  if (lauf.padsGenommen.size > z.bekanntPads.size) {
    for (const i of lauf.padsGenommen) {
      if (z.bekanntPads.has(i)) continue;
      z.bekanntPads.add(i);
      effekte.push({ art: 'funken', x: lauf.x + 0.4, y: lauf.y + 0.3, zahl: 12, farbe: '#7cf1ff', staerke: 1.3 });
    }
  }
  if (lauf.popZahl > z.bekanntPops) {
    effekte.push({ art: 'ring', x: lauf.popX, y: bodenHoehe(g, lauf.popX), farbe: '#ffc233' });
    effekte.push({ art: 'funken', x: lauf.popX, y: bodenHoehe(g, lauf.popX) + 0.1, zahl: 9, farbe: '#ffd36b', staerke: 1 });
  }
  z.bekanntPops = lauf.popZahl;
  if (lauf.lueckenZahl > z.bekanntLuecken) {
    const luecke = g.luecken.find((l) => lueckeEnde(l) <= lauf.x + 1.5 && lueckeEnde(l) > lauf.x - 4);
    const fx = luecke ? lueckeEnde(luecke) + 0.5 : lauf.x;
    effekte.push({ art: 'funken', x: fx, y: lauf.y + 0.4, zahl: 14, farbe: '#ffe08a', staerke: 1.2 });
    effekte.push({ art: 'ring', x: fx, y: bodenHoehe(g, fx + 0.5), farbe: '#ffe08a' });
  }
  z.bekanntLuecken = lauf.lueckenZahl;

  // --- Ausklingen ---------------------------------------------------
  z.federVorn = Math.max(0, z.federVorn - dt * 3.4);
  z.federHinten = Math.max(0, z.federHinten - dt * 3.1);
  z.schuettel = Math.max(0, z.schuettel - dt * 5);
  z.blitz = Math.max(0, z.blitz - dt * 6.5);
  const boostZiel = lauf.boost > 0 ? 1 : 0;
  z.boost += (boostZiel - z.boost) * Math.min(1, dt * (boostZiel > z.boost ? 14 : 3.5));

  // Erdkrümel hinterm Hinterrad bei zügigem Tempo am Boden.
  z.erdUhr += dt;
  if (lauf.amBoden && lauf.vx > 7 && z.erdUhr > 0.06) {
    z.erdUhr = 0;
    effekte.push({ art: 'erde', x: hintenX, y: bodenHoehe(g, hintenX), zahl: lauf.boost > 0 ? 2 : 1, tempo: lauf.vx, staerke: 0.65, farbe: 'boden' });
  }

  sturzSchritt(z, lauf, dt, effekte);

  // --- Räder und Haltung ---------------------------------------------
  z.radDrehung += (lauf.vx / RAD_RADIUS) * dt;
  const stehZiel = !lauf.amBoden ? 1 : lauf.vx > 9 ? 1 : lauf.vx > 5 ? (lauf.vx - 5) / 4 : 0;
  z.stehen += (stehZiel - z.stehen) * Math.min(1, dt * 5);
  const gewichtZiel = lauf.amBoden
    ? Math.max(-1, Math.min(1, bodenSteigung(g, lauf.x) * 2.2))
    : Math.max(-1, Math.min(1, -lauf.drehen / 5));
  z.gewicht += (gewichtZiel - z.gewicht) * Math.min(1, dt * (lauf.amBoden ? 5 : 9));

  const pose: FahrerPose = {
    stehen: z.stehen,
    hocke: Math.min(1, (z.federVorn + z.federHinten) * 0.5 + (lauf.amBoden ? 0 : 0.4)),
    gewicht: z.gewicht,
    streck: Math.pow(Math.max(0, lauf.popRest) / 0.8, 1.4),
    kurbel: z.radDrehung * 0.22,
    wind: Math.max(0, Math.min(1, (lauf.vx - 5) / 13)),
    zeit: z.uhr,
  };
  return { pose, effekte, sicht };
}

/**
 * Der gestürzte Fahrer: Er löst sich vom Rad, fliegt im Bogen weiter, schlägt auf,
 * rutscht und bleibt liegen. Reine Optik.
 */
function sturzSchritt(z: RigZustand, lauf: Lauf, dt: number, effekte: Effekt[]) {
  const g = lauf.gelaende;
  const gestuerzt = lauf.vorbei && !lauf.gewonnen;
  if (!gestuerzt) {
    z.sturz = null;
    z.letztesVx = lauf.vx;
    return;
  }
  if (!z.sturz) {
    // Die Hüfte sitzt rund 1,4 m über dem Boden des Rades, mal Fahrzeuggröße.
    const hx = -0.05 * MODELL_GROESSE;
    const hy = 1.44 * MODELL_GROESSE;
    const c = Math.cos(lauf.winkel);
    const sn = Math.sin(lauf.winkel);
    const tempo = Math.min(14, Math.max(4, z.letztesVx));
    z.sturz = {
      x: lauf.x + hx * c - hy * sn,
      y: lauf.y + hx * sn + hy * c,
      vx: tempo * 0.8,
      vy: 2.2 + Math.max(0, lauf.vy),
      drehung: lauf.winkel,
      drehTempo: 4.6,
      schlaff: 0,
      aufgeschlagen: false,
      zeit: 0,
    };
    // Ein Sturz in der Luft (Wand oder Graben) wirft hier ein paar Brocken aus der Kante.
    if (!lauf.amBoden) {
      effekte.push({ art: 'erde', x: lauf.x, y: lauf.y, zahl: 7, tempo, staerke: 1.1, farbe: 'saum' });
      effekte.push({ art: 'staub', x: lauf.x, y: lauf.y, zahl: 3 });
      z.schuettel = Math.min(1, z.schuettel + 0.5);
    }
  }
  const f = z.sturz;
  f.zeit += dt;
  // Die Wand der Gegenseite hält auch den Fahrer auf: Er prallt davon ab, statt durch
  // sie hindurch auf die Oberkante zu rutschen.
  for (const l of g.luecken) {
    const ende = lueckeEnde(l);
    const oben = bodenHoehe(g, ende + 1e-6);
    if (f.x + f.vx * dt >= ende && f.x < ende && f.y < oben - 0.3) {
      f.x = ende - 0.25;
      f.vx = -Math.abs(f.vx) * 0.25;
      f.drehTempo *= 0.6;
    }
  }
  f.vy -= 22 * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.drehung += f.drehTempo * dt;
  // Der Körper liegt mit der Zeit flacher auf dem Boden.
  const abstand = 0.85 + (0.3 - 0.85) * f.schlaff;
  const boden = bodenHoehe(g, f.x) + abstand;
  if (f.y <= boden) {
    f.y = boden;
    if (!f.aufgeschlagen) {
      f.aufgeschlagen = true;
      effekte.push({ art: 'erde', x: f.x, y: boden - abstand, zahl: 9, tempo: f.vx, staerke: 1.1, farbe: 'boden' });
      effekte.push({ art: 'staub', x: f.x, y: boden - abstand, zahl: 3 });
      z.schuettel = Math.min(1, z.schuettel + 0.5);
    }
    f.vy = f.vy < -2 ? -f.vy * 0.28 : 0;
    f.vx *= Math.exp(-2.4 * dt);
    f.drehTempo *= Math.exp(-3.2 * dt);
    f.schlaff = Math.min(1, f.schlaff + dt * 1.8);
    // Zur Ruhe kommen: auf den nächsten liegenden Winkel (Kopf nach vorn).
    if (f.drehTempo < 1.2) {
      const ziel = Math.round((f.drehung - Math.PI / 2) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 2;
      f.drehung += (ziel - f.drehung) * Math.min(1, dt * 6);
    }
  }
}
