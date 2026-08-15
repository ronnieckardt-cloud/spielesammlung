import { schritt } from '../../core/rng';

/**
 * Ring Rise — reine Spiellogik, ohne React und ohne Browser.
 *
 * Die Kugel steigt durch drehende Ringe. Jeder Ring besteht aus vier
 * Farbbögen; durchkommen darf die Kugel nur dort, wo die Farbe zu ihr
 * passt. Zwischen den Ringen liegen Wechsler, die ihre Farbe tauschen.
 *
 * **Die Welt wächst nach oben.** `y` ist eine Welt-Koordinate, größer heißt
 * höher. Die Anzeige dreht das erst ganz am Schluss um. Das spart in der
 * ganzen Logik die Vorzeichenfehler, die sonst zwischen „fällt" und
 * „steigt" entstehen.
 */

export const FARB_ANZAHL = 4;

/** Halbmesser der Kugel. */
export const KUGEL_R = 5;

/** Wie stark es die Kugel nach unten zieht (Welteinheiten je Sekunde²). */
export const SCHWERKRAFT = 260;

/** Was ein Antippen an Aufwärtsschwung gibt. */
export const SPRUNG = 105;

/**
 * Abstand zwischen zwei Ringmittelpunkten.
 *
 * Muss deutlich größer sein als ein Ringdurchmesser (2 × 27 = 54), sonst
 * hängen die Ringe wie eine Kette ineinander und der Farbwechsler liegt
 * praktisch schon im nächsten Ring — man sieht die neue Farbe dann erst,
 * wenn man längst drin ist. Genau so war die erste Fassung mit 58.
 *
 * Bei 88 bleiben rund 30 Einheiten freie Luft zwischen zwei Ringen. Ein
 * Sprung trägt `SPRUNG² / (2 · SCHWERKRAFT)` ≈ 21 Einheiten, man braucht
 * also vier bis fünf Sprünge von Ring zu Ring — Zeit genug, die neue Farbe
 * zu erkennen und die Drehung abzupassen.
 */
export const RING_ABSTAND = 88;

/** Wo der erste Ring hängt — knapp im Bild, damit man ihn gleich sieht. */
export const ERSTER_RING = 95;

/** Wie weit die Kugel unter die Bildkante fallen darf, bevor Schluss ist. */
export const FALL_GRENZE = 120;

/** Strichstärke eines Rings — geht in die Trefferprüfung ein. */
export const RING_STRICH = 6;

export type Ring = {
  /** Mittelpunkt in Welt-Koordinaten. */
  y: number;
  halbmesser: number;
  /** Aktuelle Drehung im Bogenmaß. */
  winkel: number;
  /** Drehgeschwindigkeit im Bogenmaß je Sekunde; Vorzeichen = Richtung. */
  tempo: number;
  /**
   * Schon durchquert? Geprüft wird **einmal**, am unteren Rand.
   *
   * Die erste Fassung prüfte unten *und* oben — und das war unspielbar:
   * Unten und oben liegen einander gegenüber, das sind bei vier Bögen immer
   * zwei **verschiedene** Farben. Beide zu treffen ginge nur, wenn sich der
   * Ring während der Durchquerung um exakt eine halbe Umdrehung dreht. Das
   * ist kein Können mehr, das ist Zufall.
   *
   * Jetzt ist der Ring ein Tor: unten muss die Farbe passen, dann ist man
   * durch. Genau das kann man üben — warten, bis die eigene Farbe unten
   * steht, und dann hoch.
   */
  durch: boolean;
};

/** Ein Farbwechsler zwischen zwei Ringen. */
export type Wechsler = {
  y: number;
  /** Auf welche Farbe er wechselt. */
  farbe: number;
  genommen: boolean;
};

export type Zustand = {
  kugelY: number;
  kugelTempo: number;
  farbe: number;
  ringe: readonly Ring[];
  wechsler: readonly Wechsler[];
  punkte: number;
  /** Höchster je erreichter Stand — die Kamera folgt nur nach oben. */
  hoehe: number;
  vorbei: boolean;
  /** Wie viele Ringe insgesamt schon erzeugt wurden (bestimmt die Härte). */
  erzeugt: number;
  saat: number;
};

/** Rest, der nie negativ wird — `%` allein liefert bei negativen Zahlen Minus. */
function modulo(wert: number, teiler: number): number {
  return ((wert % teiler) + teiler) % teiler;
}

/**
 * Welche Farbe liegt an dieser Stelle des Rings?
 *
 * `richtung` ist der Winkel vom Ringmittelpunkt zur Kugel: 0 zeigt nach
 * rechts, π/2 nach oben. Die vier Bögen liegen fest hintereinander, gedreht
 * wird der ganze Ring.
 */
export function farbeAnStelle(ring: Ring, richtung: number): number {
  const bogen = (2 * Math.PI) / FARB_ANZAHL;
  return Math.floor(modulo(richtung - ring.winkel, 2 * Math.PI) / bogen);
}

/**
 * Wie schnell dreht sich der n-te Ring?
 *
 * Steigt langsam an und ist gedeckelt — ohne Deckel wird es irgendwann
 * unabhängig vom Können unschaffbar, und das fühlt sich nicht nach „schwer"
 * an, sondern nach kaputt.
 */
export function tempoFuerRing(nummer: number): number {
  return Math.min(3.4, 1.5 + nummer * 0.07);
}

/** Der Ring wird nach oben hin enger — weniger Platz zum Durchschlüpfen. */
export function halbmesserFuerRing(nummer: number): number {
  return Math.max(18, 27 - nummer * 0.25);
}

/**
 * Erzeugt den nächsten Ring samt Wechsler darüber.
 *
 * Die Drehrichtung kommt aus der Saat, damit dieselbe Saat immer denselben
 * Aufstieg ergibt — kein `Math.random`.
 */
function ringBauen(nummer: number, y: number, saat: number): { ring: Ring; saat: number } {
  const a = schritt(saat);
  const b = schritt(a.saat);
  return {
    ring: {
      y,
      halbmesser: halbmesserFuerRing(nummer),
      // Zufällige Startdrehung, sonst stehen alle Ringe gleich.
      winkel: a.wert * 2 * Math.PI,
      tempo: tempoFuerRing(nummer) * (b.wert < 0.5 ? -1 : 1),
      durch: false,
    },
    saat: b.saat,
  };
}

function wechslerBauen(y: number, saat: number, ausser: number): { wechsler: Wechsler; saat: number } {
  const a = schritt(saat);
  // Nie auf dieselbe Farbe wechseln — ein Wechsler, der nichts ändert,
  // wirkt wie ein Fehler.
  const versatz = 1 + Math.floor(a.wert * (FARB_ANZAHL - 1));
  return {
    wechsler: { y, farbe: modulo(ausser + versatz, FARB_ANZAHL), genommen: false },
    saat: a.saat,
  };
}

/** Wie viele Ringe immer im Voraus bereitstehen. */
const VORRAT = 4;

export function neuesSpiel(saat: number): Zustand {
  let z: Zustand = {
    kugelY: 0,
    kugelTempo: 0,
    farbe: 0,
    ringe: [],
    wechsler: [],
    punkte: 0,
    hoehe: 0,
    vorbei: false,
    erzeugt: 0,
    saat,
  };
  for (let i = 0; i < VORRAT; i++) z = nachschieben(z);
  return z;
}

/** Hängt einen weiteren Ring samt Wechsler oben an. */
function nachschieben(z: Zustand): Zustand {
  const nummer = z.erzeugt;
  const y = ERSTER_RING + RING_ABSTAND * nummer;
  const { ring, saat: s1 } = ringBauen(nummer, y, z.saat);
  const letzteFarbe = z.wechsler.at(-1)?.farbe ?? z.farbe;
  /*
   * Der Wechsler hängt **direkt über** seinem Ring, nicht in der Mitte
   * zwischen zwei Ringen.
   *
   * In der Mitte war er unspielbar: Man bekam die neue Farbe erst 17
   * Einheiten vor dem nächsten Tor — weniger als ein Sprung trägt. Man
   * konnte also gar nicht mehr abwarten, bis die neue Farbe unten am Ring
   * steht, sondern raste zwangsläufig hinein. Der Spieler-Test kam damit
   * über einen einzigen Ring nicht hinaus.
   *
   * So herum bekommt man die neue Farbe im Moment des Durchkommens und hat
   * danach den ganzen Abstand bis zum nächsten Tor, um sie abzupassen.
   */
  const { wechsler, saat: s2 } = wechslerBauen(y + ring.halbmesser + 12, s1, letzteFarbe);
  return {
    ...z,
    ringe: [...z.ringe, ring],
    wechsler: [...z.wechsler, wechsler],
    erzeugt: nummer + 1,
    saat: s2,
  };
}

/** Ein Antippen: Die Kugel bekommt neuen Schwung nach oben. */
export function springen(z: Zustand): Zustand {
  if (z.vorbei) return z;
  return { ...z, kugelTempo: SPRUNG };
}

/**
 * Prüft, ob die Kugel zwischen `vorher` und `jetzt` eine Ringkante gekreuzt
 * hat — und wenn ja, ob die Farbe gepasst hat.
 *
 * Geprüft wird an genau **zwei** Stellen je Ring: unten und oben. Die Kugel
 * läuft ja immer durch die Mitte, andere Stellen kann sie gar nicht treffen.
 * Das macht aus einer Kreis-Kollision einen simplen Zahlenvergleich —
 * dieselbe Vereinfachung wie der Steckwinkel bei Blade Toss.
 */
function kanteGekreuzt(vorher: number, jetzt: number, kante: number): boolean {
  return (vorher < kante && jetzt >= kante) || (vorher > kante && jetzt <= kante);
}

/**
 * Ein Zeitschritt. `dt` in Sekunden.
 *
 * Reine Funktion: gleicher Zustand und gleiches `dt` ergeben immer dasselbe
 * Ergebnis, ohne Uhr und ohne Zufall außerhalb der Saat.
 */
export function takt(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;

  const ringe = z.ringe.map((r) => ({ ...r, winkel: modulo(r.winkel + r.tempo * dt, 2 * Math.PI) }));

  const vorherY = z.kugelY;
  const kugelTempo = z.kugelTempo - SCHWERKRAFT * dt;
  const kugelY = z.kugelY + kugelTempo * dt;

  let farbe = z.farbe;
  let punkte = z.punkte;
  let vorbei = false;

  // Farbwechsler: gilt als genommen, sobald die Kugel seine Höhe berührt.
  const wechsler = z.wechsler.map((w) => {
    if (w.genommen || !kanteGekreuzt(vorherY, kugelY, w.y)) return w;
    farbe = w.farbe;
    return { ...w, genommen: true };
  });

  for (const ring of ringe) {
    // Das Tor ist der untere Rand. Nach unten zeigt −π/2.
    const tor = ring.y - ring.halbmesser;
    if (ring.durch || !kanteGekreuzt(vorherY, kugelY, tor)) continue;
    ring.durch = true;
    if (farbeAnStelle(ring, -Math.PI / 2) === farbe) punkte += 1;
    else vorbei = true;
  }

  const hoehe = Math.max(z.hoehe, kugelY);
  // Zu tief gefallen — die Kugel ist unten aus dem Bild.
  if (kugelY < hoehe - FALL_GRENZE) vorbei = true;

  let neu: Zustand = {
    ...z,
    kugelY,
    kugelTempo,
    farbe,
    ringe,
    wechsler,
    punkte,
    hoehe,
    vorbei,
  };

  // Immer genug Ringe über der Kugel bereithalten.
  while (neu.erzeugt < VORRAT + punkte) neu = nachschieben(neu);

  return neu;
}
