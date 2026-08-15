/**
 * Reine Geometrie fürs Gießen: wo steht ein Röhrchen im Raster, und wo
 * landet die Ausgusskante, wenn es gekippt wird?
 *
 * Alles hier arbeitet in einem festen, logischen Koordinatensystem (nicht
 * in Bildschirm-Pixeln) — die Anzeige skaliert das später einheitlich auf
 * die verfügbare Breite. So bleibt die Berechnung testbar ohne Browser.
 */

export const ROEHRCHEN_BREITE = 64;
export const ROEHRCHEN_HOEHE = 200;
export const ROEHRCHEN_ABSTAND = 22;
export const MAX_SPALTEN = 6;

/**
 * Wie viel oben im Glas frei bleibt, auch wenn es voll ist.
 *
 * Ein bis an den Rand gefülltes Glas sieht nicht nach Flüssigkeit aus,
 * sondern nach einem farbigen Balken — dieselbe Beobachtung, die jeder
 * Getränkehersteller macht. Mit einem Fingerbreit Luft liest es sich sofort
 * als „gefülltes Gefäß".
 */
export const LUFTRAUM_OBEN = 18;

/**
 * Die Höhe **einer** Farbschicht. Muss überall dieselbe sein: Die Anzeige
 * rechnet Schichten in Höhen um, die Gieß-Animation rechnet Höhen zurück in
 * Schichten. Zwei getrennte Formeln driften irgendwann auseinander.
 */
export function schichthoehe(kapazitaet: number): number {
  return (ROEHRCHEN_HOEHE - LUFTRAUM_OBEN) / kapazitaet;
}

export type Punkt = { x: number; y: number };

/** Ab wann wird umgebrochen — bis MAX_SPALTEN eine Reihe, sonst zwei gleich lange. */
export function spaltenFuerAnzahl(anzahlRoehrchen: number): number {
  if (anzahlRoehrchen <= MAX_SPALTEN) return anzahlRoehrchen;
  return Math.ceil(anzahlRoehrchen / 2);
}

export function zeilenFuerAnzahl(anzahlRoehrchen: number): number {
  return Math.ceil(anzahlRoehrchen / spaltenFuerAnzahl(anzahlRoehrchen));
}

/** Obere linke Ecke der Standposition eines Röhrchens im Raster. */
export function roehrchenPosition(index: number, anzahlRoehrchen: number): Punkt {
  const spalten = spaltenFuerAnzahl(anzahlRoehrchen);
  const spalte = index % spalten;
  const zeile = Math.floor(index / spalten);
  return {
    x: spalte * (ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND),
    y: zeile * (ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND),
  };
}

export function rasterBreite(anzahlRoehrchen: number): number {
  const spalten = spaltenFuerAnzahl(anzahlRoehrchen);
  return spalten * ROEHRCHEN_BREITE + (spalten - 1) * ROEHRCHEN_ABSTAND;
}

export function rasterHoehe(anzahlRoehrchen: number): number {
  const zeilen = zeilenFuerAnzahl(anzahlRoehrchen);
  return zeilen * ROEHRCHEN_HOEHE + (zeilen - 1) * ROEHRCHEN_ABSTAND;
}

function drehen(punkt: Punkt, drehpunkt: Punkt, winkelGrad: number): Punkt {
  const winkel = (winkelGrad * Math.PI) / 180;
  const cos = Math.cos(winkel);
  const sin = Math.sin(winkel);
  const dx = punkt.x - drehpunkt.x;
  const dy = punkt.y - drehpunkt.y;
  return {
    x: drehpunkt.x + dx * cos - dy * sin,
    y: drehpunkt.y + dx * sin + dy * cos,
  };
}

/** Wo ein gekipptes Röhrchen um seinen Drehpunkt gedreht ist — für Anzeige und Ausgusskante gleichermaßen. */
export function drehpunkt(position: Punkt): Punkt {
  // Etwas oberhalb der Mitte — wie eine Hand, die das Röhrchen im oberen
  // Drittel hält und kippt, nicht am Boden dreht.
  return { x: position.x + ROEHRCHEN_BREITE / 2, y: position.y + ROEHRCHEN_HOEHE * 0.32 };
}

const RAND_RADIUS = 9; // oben, angedeutete Öffnung
const BODEN_RADIUS = ROEHRCHEN_BREITE / 2; // unten, voll gerundet wie ein Reagenzglas

/** SVG-Pfad des Röhrchen-Umrisses — einmal berechnet, von Glaskörper und Ausschnitt gleichermaßen benutzt. */
export const ROEHRCHEN_UMRISS = [
  `M ${RAND_RADIUS},0`,
  `L ${ROEHRCHEN_BREITE - RAND_RADIUS},0`,
  `A ${RAND_RADIUS},${RAND_RADIUS} 0 0 1 ${ROEHRCHEN_BREITE},${RAND_RADIUS}`,
  `L ${ROEHRCHEN_BREITE},${ROEHRCHEN_HOEHE - BODEN_RADIUS}`,
  `A ${BODEN_RADIUS},${BODEN_RADIUS} 0 0 1 0,${ROEHRCHEN_HOEHE - BODEN_RADIUS}`,
  `L 0,${RAND_RADIUS}`,
  `A ${RAND_RADIUS},${RAND_RADIUS} 0 0 1 ${RAND_RADIUS},0`,
  'Z',
].join(' ');

/**
 * Die Ausgusskante beim Kippen: die untere Ecke der Öffnung, nachdem das
 * Röhrchen um `winkelGrad` gedreht wurde. Wird berechnet, nicht geschätzt —
 * beide obere Ecken werden durch dieselbe Drehmatrix gedreht, die nach der
 * Drehung tiefer liegende gewinnt (aus der fließt es tatsächlich).
 */
export function ausgusskante(position: Punkt, winkelGrad: number): Punkt {
  const dp = drehpunkt(position);
  const linkeEcke = drehen({ x: position.x, y: position.y }, dp, winkelGrad);
  const rechteEcke = drehen({ x: position.x + ROEHRCHEN_BREITE, y: position.y }, dp, winkelGrad);
  return linkeEcke.y > rechteEcke.y ? linkeEcke : rechteEcke;
}

/**
 * Der Bewegungsablauf beim Gießen, in sechs Abschnitten (Anteile von t,
 * 0 bis 1): anheben, hinfliegen, kippen, gießen, aufrichten, zurückstellen.
 * Reine Zeit→Zustand-Funktionen, ohne jede Kenntnis von React oder DOM —
 * dieselbe Berechnung, die die Anzeige benutzt, lässt sich hier durchtesten.
 */
/*
 * Das Gießen selbst ist der längste Abschnitt, und das ist Absicht: Vorher
 * lag es zwischen 0,52 und 0,78 — bei knapp einer Sekunde Gesamtdauer also
 * rund eine Viertelsekunde, in der das Röhrchen außerdem fast auf dem Kopf
 * stand. Der sinkende Füllstand war da schlicht nicht zu sehen, und es
 * wirkte, als sei die Quelle erst am Ende schlagartig leer. Jetzt bleibt
 * über ein Drittel der Zeit fürs eigentliche Gießen.
 */
export const ANHEBEN_BIS = 0.09;
export const HINFLIEGEN_BIS = 0.34;
export const KIPPEN_BIS = 0.44;
export const GIESSEN_BIS = 0.8;
export const AUFRICHTEN_BIS = 0.9;

const KIPP_WINKEL = -128; // Grad — genug, dass die Öffnung klar nach unten zeigt
const SCHWEBE_ABSTAND = 74; // wie weit über der höchsten beteiligten Position geschwebt wird

function glaetten(p: number): number {
  const x = Math.min(1, Math.max(0, p));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function zwischen(a: Punkt, b: Punkt, p: number): Punkt {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

/** Wo das Röhrchen schwebt, während es über dem Ziel gekippt wird. */
export function schwebePosition(quelle: Punkt, ziel: Punkt): Punkt {
  return { x: ziel.x, y: Math.min(quelle.y, ziel.y) - SCHWEBE_ABSTAND };
}

/** Position und Kippwinkel des fliegenden Röhrchens zum Zeitpunkt t (0..1). */
export function fliegendePosition(
  t: number,
  quelle: Punkt,
  ziel: Punkt,
): { position: Punkt; winkelGrad: number } {
  const schwebe = schwebePosition(quelle, ziel);
  const zwischenstopp = zwischen(quelle, schwebe, 0.35);

  if (t <= ANHEBEN_BIS) {
    return { position: zwischen(quelle, zwischenstopp, glaetten(t / ANHEBEN_BIS)), winkelGrad: 0 };
  }
  if (t <= HINFLIEGEN_BIS) {
    const p = glaetten((t - ANHEBEN_BIS) / (HINFLIEGEN_BIS - ANHEBEN_BIS));
    return { position: zwischen(zwischenstopp, schwebe, p), winkelGrad: 0 };
  }
  if (t <= KIPPEN_BIS) {
    const p = glaetten((t - HINFLIEGEN_BIS) / (KIPPEN_BIS - HINFLIEGEN_BIS));
    return { position: schwebe, winkelGrad: KIPP_WINKEL * p };
  }
  if (t <= GIESSEN_BIS) {
    return { position: schwebe, winkelGrad: KIPP_WINKEL };
  }
  if (t <= AUFRICHTEN_BIS) {
    const p = glaetten((t - GIESSEN_BIS) / (AUFRICHTEN_BIS - GIESSEN_BIS));
    return { position: schwebe, winkelGrad: KIPP_WINKEL * (1 - p) };
  }
  const p = glaetten((t - AUFRICHTEN_BIS) / (1 - AUFRICHTEN_BIS));
  return { position: zwischen(schwebe, quelle, p), winkelGrad: 0 };
}

/** Fortschritt des Gießens selbst (0..1) — steigt nur während der Kipp-Phase, sonst 0 oder 1. */
export function giessFortschritt(t: number): number {
  if (t <= KIPPEN_BIS) return 0;
  if (t >= GIESSEN_BIS) return 1;
  return (t - KIPPEN_BIS) / (GIESSEN_BIS - KIPPEN_BIS);
}
