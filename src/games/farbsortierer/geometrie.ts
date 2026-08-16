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

function breiteFuerSpalten(spalten: number): number {
  return spalten * ROEHRCHEN_BREITE + (spalten - 1) * ROEHRCHEN_ABSTAND;
}

function hoeheFuerZeilen(zeilen: number): number {
  return zeilen * ROEHRCHEN_HOEHE + (zeilen - 1) * ROEHRCHEN_ABSTAND;
}

/** Die alte, feste Regel: bis MAX_SPALTEN eine Reihe, sonst zwei gleich lange. */
function festeSpalten(anzahlRoehrchen: number): number {
  if (anzahlRoehrchen <= MAX_SPALTEN) return anzahlRoehrchen;
  return Math.ceil(anzahlRoehrchen / 2);
}

/**
 * Wie groß ein Röhrchen wird, wenn die Bühne auf die Höhe 1 normiert ist
 * (ihre Breite ist dann genau das Verhältnis). Dieselbe Rechnung wie
 * `min(100cqw, 100cqh * --vz)` im CSS, nur ohne Browser.
 */
function massstab(breite: number, hoehe: number, buehnenVerhaeltnis: number): number {
  return Math.min(buehnenVerhaeltnis / breite, 1 / hoehe);
}

/**
 * Die Aufteilung des Bretts: Spaltenzahl und die oben freigehaltene Luft
 * für den Flug.
 *
 * Ohne `buehnenVerhaeltnis` (Breite geteilt durch Höhe des verfügbaren
 * Platzes) bleibt es bei der festen Regel und ohne Luft — so sah es bisher
 * überall aus.
 *
 * Mit dem Verhältnis gewinnt die Aufteilung, bei der die Röhrchen am
 * größten werden. Das ist kein Schönheitsgriff: Ein Röhrchen ist gut
 * dreimal so hoch wie breit. Fünf davon nebeneinander ergeben ein sehr
 * breites, flaches Raster (408 zu 200) — im Hochformat eines Handys passt
 * das nur in die Breite, zwei Drittel der Bühne bleiben leerer Hintergrund
 * und die Röhrchen bleiben klein. Zwei kurze Reihen füllen denselben Platz
 * mit deutlich größeren Röhrchen.
 *
 * **Die bisherige Aufteilung ist dabei die Messlatte, nicht bloß ein
 * Kandidat:** Gewechselt wird nur, wenn die Röhrchen dadurch wirklich
 * größer werden. Sonst bliebe im Querformat, wo eine Reihe schon die volle
 * Höhe braucht, nur der Nachteil der reservierten Luft übrig.
 */
function aufteilung(
  anzahlRoehrchen: number,
  buehnenVerhaeltnis?: number,
): { spalten: number; luft: number } {
  const fest = festeSpalten(anzahlRoehrchen);
  if (buehnenVerhaeltnis === undefined || !(buehnenVerhaeltnis > 0)) {
    return { spalten: fest, luft: 0 };
  }

  // So groß wurden die Röhrchen bisher — ohne reservierte Luft, der Flug
  // ragte dafür oben aus dem Brett heraus.
  let beste = { spalten: fest, luft: 0 };
  let besterMassstab = massstab(
    breiteFuerSpalten(fest),
    hoeheFuerZeilen(Math.ceil(anzahlRoehrchen / fest)),
    buehnenVerhaeltnis,
  );

  const hoechstens = Math.min(Math.max(1, anzahlRoehrchen), MAX_SPALTEN);
  for (let spalten = 1; spalten <= hoechstens; spalten++) {
    const breite = breiteFuerSpalten(spalten);
    const hoeheOhneLuft = hoeheFuerZeilen(Math.ceil(anzahlRoehrchen / spalten));
    const luft = luftFuerFlug(breite, hoeheOhneLuft, buehnenVerhaeltnis);
    const wert = massstab(breite, hoeheOhneLuft + luft, buehnenVerhaeltnis);
    // Streng größer, aufsteigend durchgezählt: Bei gleichem Maßstab gewinnt
    // die Aufteilung mit weniger Spalten, also die gleichmäßigere — fünf
    // Röhrchen werden dann 3 + 2 und nicht 4 + 1.
    if (wert > besterMassstab) {
      besterMassstab = wert;
      beste = { spalten, luft };
    }
  }
  return beste;
}

export function spaltenFuerAnzahl(anzahlRoehrchen: number, buehnenVerhaeltnis?: number): number {
  return aufteilung(anzahlRoehrchen, buehnenVerhaeltnis).spalten;
}

export function zeilenFuerAnzahl(anzahlRoehrchen: number, buehnenVerhaeltnis?: number): number {
  return Math.ceil(anzahlRoehrchen / spaltenFuerAnzahl(anzahlRoehrchen, buehnenVerhaeltnis));
}

/** Obere linke Ecke der Standposition eines Röhrchens im Raster. */
export function roehrchenPosition(
  index: number,
  anzahlRoehrchen: number,
  buehnenVerhaeltnis?: number,
): Punkt {
  const spalten = spaltenFuerAnzahl(anzahlRoehrchen, buehnenVerhaeltnis);
  const spalte = index % spalten;
  const zeile = Math.floor(index / spalten);
  // Die letzte Reihe ist selten voll. Links ausgerichtet hinge sie sichtbar
  // schief unter der Reihe darüber, deshalb wird sie um die fehlenden
  // Plätze eingerückt.
  const inDieserZeile = Math.min(spalten, anzahlRoehrchen - zeile * spalten);
  const einrueckung = ((spalten - inDieserZeile) * (ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND)) / 2;
  return {
    x: einrueckung + spalte * (ROEHRCHEN_BREITE + ROEHRCHEN_ABSTAND),
    y: zeile * (ROEHRCHEN_HOEHE + ROEHRCHEN_ABSTAND),
  };
}

/**
 * Wie viel Luft über der obersten Reihe im Brett reserviert wird, damit das
 * fliegende Röhrchen nicht darüber hinausragt.
 *
 * Die Bühne stellt das Brett mittig, oberhalb bleibt also von selbst Platz,
 * solange das Brett nicht die volle Bühnenhöhe braucht. Reserviert wird nur
 * das, was dieser Platz nicht schon hergibt — sonst würde ein Brett, das
 * ohnehin Luft hat, ohne Not kleiner.
 *
 * Rechnung (Bühne auf die Höhe 1 normiert, Breite ist dann das Verhältnis):
 * Solange die Breite die Grenze ist, steht dem Brett in seinen eigenen
 * Einheiten die Höhe `breite / verhaeltnis` zur Verfügung. Was davon über
 * das Raster hinausgeht, ist `frei` — und weil mittig gestellt wird, liegt
 * die Hälfte davon oben.
 */
function luftFuerFlug(breite: number, hoehe: number, buehnenVerhaeltnis?: number): number {
  if (buehnenVerhaeltnis === undefined || !(buehnenVerhaeltnis > 0)) return 0;
  const frei = Math.max(0, breite / buehnenVerhaeltnis - hoehe);
  if (frei >= 2 * FLUG_UEBERSTAND) return 0;
  // Jede reservierte Einheit schiebt das Raster nur um eine halbe Einheit
  // nach unten, solange die Breite die Grenze ist — deshalb der Faktor 2.
  if (frei >= FLUG_UEBERSTAND) return 2 * FLUG_UEBERSTAND - frei;
  return FLUG_UEBERSTAND;
}

/**
 * Der Streifen, den das Brett über der obersten Reihe freihält — die
 * Anzeige zieht damit den oberen Rand ihrer viewBox nach oben.
 */
export function flugLuft(anzahlRoehrchen: number, buehnenVerhaeltnis?: number): number {
  return aufteilung(anzahlRoehrchen, buehnenVerhaeltnis).luft;
}

export function rasterBreite(anzahlRoehrchen: number, buehnenVerhaeltnis?: number): number {
  return breiteFuerSpalten(spaltenFuerAnzahl(anzahlRoehrchen, buehnenVerhaeltnis));
}

export function rasterHoehe(anzahlRoehrchen: number, buehnenVerhaeltnis?: number): number {
  return hoeheFuerZeilen(zeilenFuerAnzahl(anzahlRoehrchen, buehnenVerhaeltnis));
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

/**
 * Wie weit das fliegende Röhrchen über die Reihe hinausragt, aus der es
 * kommt — in Rastereinheiten.
 *
 * Ausgerechnet statt geschätzt, aus derselben Bewegung und derselben
 * Drehung, die die Anzeige zeichnet: Der Ausschlag kommt nicht vom Anheben
 * allein, sondern vom Kippen. Bei 128 Grad steht das Röhrchen fast auf dem
 * Kopf und sein Boden ragt weit über den Drehpunkt hinaus.
 *
 * Gebraucht wird der Wert, weil das Brett diesen Streifen oben freihalten
 * muss. Ohne ihn liegt der Flug außerhalb des Bretts und wird über Leiste
 * und Kopfzeile gezeichnet — was nicht auffiel, solange das Brett die Bühne
 * gar nicht ausfüllte.
 */
export const FLUG_UEBERSTAND = (() => {
  const reihe = { x: 0, y: 0 };
  let hoechster = 0; // kleinstes y, also der höchste Punkt
  for (let i = 0; i <= 100; i++) {
    const { position, winkelGrad } = fliegendePosition(i / 100, reihe, reihe);
    const dp = drehpunkt(position);
    for (const ecke of [
      { x: position.x, y: position.y },
      { x: position.x + ROEHRCHEN_BREITE, y: position.y },
      { x: position.x, y: position.y + ROEHRCHEN_HOEHE },
      { x: position.x + ROEHRCHEN_BREITE, y: position.y + ROEHRCHEN_HOEHE },
    ]) {
      hoechster = Math.min(hoechster, drehen(ecke, dp, winkelGrad).y);
    }
  }
  // Zwei Einheiten Zugabe für die Glaskante, die auf der Umrisslinie liegt.
  return Math.ceil(-hoechster) + 2;
})();
