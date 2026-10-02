import { schritt } from '../../core/rng';

/**
 * Ring Rise — reine Spiellogik, ohne React und ohne Browser.
 *
 * Die Kugel steigt durch drehende Ringe. Jeder Ring besteht aus vier
 * Farbbögen; durchkommen darf die Kugel nur dort, wo die Farbe zu ihr
 * passt. Zwischen den Ringen liegen Wechsler, die ihre Farbe tauschen.
 *
 * Seit Version 2 kommen **drei Arten** von Hindernis vor (Ring, Laufband,
 * Pulsring), eingeführt in **Etappen**, und wer **mitten** durch die Farbe
 * kommt, baut eine **Serie** auf, die die Punkte vervielfacht. Alle drei
 * Arten haben genau **ein** Tor mit einer gleichmäßig durchlaufenden Farbfolge:
 * Jede Farbe kommt irgendwann dort an, jedes Hindernis ist also immer zu
 * schaffen — schwerer wird es über Tempo und Rhythmus, nie über Unlösbares.
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

/**
 * Das Sichtfenster in Welteinheiten: so weit sieht man über und unter der
 * Kugel.
 *
 * Steht bewusst hier und nicht in der Anzeige, obwohl es reine Optik ist:
 * `FALL_GRENZE` hängt daran, und die beiden dürfen nicht auseinanderlaufen.
 * Genau das war passiert (siehe unten). Nebeneinander in einer Datei fällt
 * so ein Auseinanderdriften auf, über zwei Dateien verteilt nicht.
 *
 * `SICHT_HOCH` ist knapp größer als `RING_ABSTAND` — man muss den nächsten
 * Ring ganz sehen, während man noch unter dem vorigen steht.
 */
export const SICHT_HOCH = 105;
export const SICHT_RUNTER = 60;

/**
 * Wie weit die Kugel unter ihren Höchststand fallen darf, bevor Schluss ist.
 *
 * Muss unter `SICHT_RUNTER` bleiben, sonst läuft die Runde weiter, während
 * die Kugel längst unten aus dem Bild verschwunden ist. Vorher stand hier
 * 120 bei 45 Einheiten Sicht: Die letzten 0,35 Sekunden jedes Absturzes
 * tippte man blind auf ein leeres Feld und wusste nicht, ob es noch etwas
 * zu retten gab. Jetzt bleibt die Kugel samt ihrem Musterring bis zum
 * letzten Moment sichtbar — man sieht selbst, wie knapp es steht, und dass
 * man sich mit ein paar schnellen Tippern noch fangen könnte.
 *
 * Der Abstand zu `SICHT_RUNTER` ist mit Absicht kein Haar breit: Ein
 * Zeitschritt bei 60 Bildern je Sekunde trägt die fallende Kugel hier noch
 * einmal knapp drei Einheiten weiter, die Grenze wird also immer ein wenig
 * überschritten. Ein Test rechnet den echten Ablauf nach.
 */
export const FALL_GRENZE = 48;

/** Strichstärke eines Rings — geht in die Trefferprüfung ein. */
export const RING_STRICH = 6;

/** Wie viele Hindernisse eine Etappe hat — danach kommt etwas Neues. */
export const ETAPPE_LAENGE = 8;

/** Höchster Serienfaktor. Das Herz in der Anzeige zeigt genau diese Zahl. */
export const FAKTOR_MAX = 5;

/** Bonus für eine geschaffte Etappe, mal Etappennummer. */
export const ETAPPEN_BONUS = 10;

/**
 * Breite eines vollen Farbdurchlaufs beim Band (vier Segmente). Das Bild ist
 * 100 breit, es zeigt also zwei Durchläufe — genug, um die Farbe am Tor
 * schon kommen zu sehen.
 */
export const BAND_PERIODE = 50;

/** Halbe Höhe des Bandes. Dünn: Es ist ein Tor, kein Hindernis zum Hineinfliegen. */
export const BAND_HALB = 5;

/**
 * Wie stark das Tempo des Pulsrings schwingt: 0,2- bis 1,8-faches des
 * Grundtempos. Der Mittelwert bleibt das Grundtempo, auf lange Sicht ist er
 * also nicht schneller als ein gewöhnlicher Ring.
 */
export const PULS_TIEFE = 0.8;

/** Eine Schwingung dauert so lange (Sekunden) — rund 0,6 Hz, ein Atemzug. */
export const PULS_PERIODE = 1.7;

/** Was ein Hindernis wert ist, bevor der Serienfaktor draufkommt. */
export const ART_WERT: Record<Art, number> = { ring: 1, band: 1, puls: 2 };

/**
 * Die drei Hindernisarten. Alle haben **ein** Tor, an dem die Farbe der Kugel
 * passen muss — sie unterscheiden sich nur darin, wie die Farben dort
 * vorbeiziehen:
 *
 * - `ring`: gleichmäßig drehender Ring, das Grundhindernis.
 * - `band`: ein Band quer über das ganze Bild, dessen Farben seitlich laufen.
 *   Ein anderes Bild, ein anderer Rhythmus: Die Farbe am Tor wechselt hier
 *   gleichmäßig durch, ohne dass man eine Drehung sieht.
 * - `puls`: ein Ring, dessen Tempo schwingt (fast Stillstand, dann Schwung).
 *   Das Tor ist dadurch nicht mehr nach Gefühl abzupassen, man muss hinsehen.
 *   Er dreht trotzdem immer weiter in dieselbe Richtung — ein hin- und
 *   herschwingender Ring würde manche Farbe nie ans Tor bringen.
 */
export type Art = 'ring' | 'band' | 'puls';

export type Ring = {
  /** Eindeutig über die ganze Runde — Schlüssel der Anzeige. */
  id: number;
  /** Welches Hindernis in der Reihe das ist (0 = das erste). */
  nr: number;
  art: Art;
  /** Mittelpunkt in Welt-Koordinaten. */
  y: number;
  /** Beim Ring der Radius, beim Band die halbe Höhe. */
  halbmesser: number;
  /**
   * Aktuelle Drehung im Bogenmaß. Beim Band die Verschiebung der Farbfolge:
   * ein voller Umlauf (2π) ist eine Verschiebung um `BAND_PERIODE`.
   */
  winkel: number;
  /** Drehgeschwindigkeit im Bogenmaß je Sekunde; Vorzeichen = Richtung. */
  tempo: number;
  /** Schwingungsphase des Pulsrings (Bogenmaß); bei den anderen ungenutzt. */
  phase: number;
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
  /** Wie viele Hindernisse insgesamt schon erzeugt wurden (bestimmt die Härte). */
  erzeugt: number;
  /** Wie viele Hindernisse die Kugel schon geschafft hat. */
  geschafft: number;
  /**
   * Wie viele Hindernisse in Folge **mitten** durch die Farbe geschafft
   * wurden, 0 = keine Serie. Der Faktor dazu steht in `serieFaktor`.
   */
  serie: number;
  /** Gespielte Zeit in Sekunden — die Logik hat sonst keine Uhr. */
  zeit: number;
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
 * Welche Farbe steht gerade **am Tor** — an der Stelle, durch die die Kugel
 * kommt?
 *
 * Beim Ring (und Pulsring) ist das der Bogen ganz unten, beim Band das
 * Segment bei x = 0. Das Band ist so gebaut, dass beide Fälle dieselbe
 * Rechnung sind: Das Segment k liegt bei `winkel / bogen · Segmentbreite + k ·
 * Segmentbreite`, am Nullpunkt gilt also `k = ⌊−winkel / bogen⌋`.
 */
export function torFarbe(ring: Ring): number {
  if (ring.art === 'band') {
    const bogen = (2 * Math.PI) / FARB_ANZAHL;
    return Math.floor(modulo(-ring.winkel, 2 * Math.PI) / bogen);
  }
  return farbeAnStelle(ring, -Math.PI / 2);
}

/** Wo das Band die Farbe `k` zeigt: Anfang und Ende (in Welt-x) des Segments. */
export function bandSegmente(ring: Ring): readonly { x: number; breite: number; farbe: number }[] {
  const breite = BAND_PERIODE / FARB_ANZAHL;
  const versatz = (ring.winkel / (2 * Math.PI)) * BAND_PERIODE;
  const aus: { x: number; breite: number; farbe: number }[] = [];
  // Von weit links bis weit rechts, mit je einem Segment Überstand.
  for (let k = -Math.ceil(60 / breite) - 1; k <= Math.ceil(60 / breite) + 1; k++) {
    aus.push({ x: versatz + k * breite, breite, farbe: modulo(k, FARB_ANZAHL) });
  }
  return aus;
}

/** In welcher Etappe ist man, wenn `geschafft` Hindernisse hinter einem liegen? Die erste ist Etappe 1. */
export function etappeVon(geschafft: number): number {
  return Math.floor(geschafft / ETAPPE_LAENGE) + 1;
}

/**
 * Was in dieser Etappe zum ersten Mal vorkommt — oder `null`.
 *
 * Steht hier und nicht in der Anzeige, damit Text und Erzeugung nicht
 * auseinanderlaufen: Wer `artFuer` ändert, sieht diese Funktion gleich daneben.
 */
export function etappenNeuheit(etappe: number): { art: Art; text: string } | null {
  if (etappe === 2) return { art: 'band', text: 'Laufbänder' };
  if (etappe === 3) return { art: 'puls', text: 'Pulsringe' };
  if (etappe === 4) return { art: 'ring', text: 'Alles gemischt' };
  return null;
}

/**
 * Welche Art ist das Hindernis Nummer `nr`?
 *
 * Die Neuheit einer Etappe kommt **garantiert** und früh (an Stelle 2 und 4
 * der Etappe): Wer sie dem Zufall überließe, könnte eine ganze Etappe lang
 * nichts Neues sehen und die Meldung „Laufbänder!" wäre gelogen.
 * `wert` ist ein Zufallswert aus der Saat und gilt erst ab Etappe 4.
 */
export function artFuer(nr: number, wert: number): Art {
  const etappe = etappeVon(nr);
  const stelle = nr % ETAPPE_LAENGE;
  if (etappe === 1) return 'ring';
  if (etappe === 2) return stelle === 2 || stelle === 4 ? 'band' : 'ring';
  if (etappe === 3) return stelle === 2 || stelle === 4 ? 'puls' : 'ring';
  return wert < 1 / 3 ? 'ring' : wert < 2 / 3 ? 'band' : 'puls';
}

/** Fenster der Serie in Sekunden: am Anfang großzügig, dann Schritt für Schritt enger bis zum Mindestwert. */
export const SERIE_FENSTER_START = 3.2;
export const SERIE_FENSTER_MIN = 2;
export const SERIE_FENSTER_SCHRITT = 0.2;

/** Der Serienfaktor: 1 bei keiner Serie, wächst mit jedem Treffer in der Mitte bis `FAKTOR_MAX`. */
export function serieFaktor(serie: number): number {
  return Math.min(FAKTOR_MAX, Math.max(1, serie));
}

/**
 * Wie weit neben der Mitte des Farbbogens man noch „mittendrin" ist
 * (Bogenmaß, nach jeder Seite). Ein Bogen ist ±π/4 ≈ 0,785 breit.
 *
 * Das ist die **Serie**: Wer die Farbe trifft, kommt durch — wer sie in der
 * Mitte trifft, bekommt außerdem den Faktor. Ein Zeitfenster („schnell
 * hintereinander") hatte diese Stelle zuerst, und das war falsch: Wie lange
 * man warten muss, hängt allein davon ab, in welcher Stellung der Ring gerade
 * ankommt — bei einer Umdrehung in vier Sekunden im Mittel zwei. Eine Serie, die
 * am Zufall der Ringstellung hängt, misst kein Können.
 *
 * Mit den Etappen wird die Mitte **schmaler**. Ab Etappe 4 steigt das
 * Drehtempo nicht mehr (ohne Deckel wäre es irgendwann unschaffbar); ohne
 * ein weiteres Stellrad könnte ein sicherer Spieler endlos auf demselben
 * Niveau weiterspielen. Die Genauigkeit ist dieses Stellrad: Der Ring bleibt
 * gleich schnell, aber man muss immer präziser hindurch.
 */
export function mitteBreite(etappe: number): number {
  return Math.max(MITTE_MIN, MITTE_START - (etappe - 1) * MITTE_SCHRITT);
}

export const MITTE_START = 0.6;
export const MITTE_MIN = 0.3;
export const MITTE_SCHRITT = 0.05;

/**
 * Wie weit steht die Mitte des Farbbogens am Tor von der Kugel entfernt
 * (Bogenmaß, negativ = der Bogen ist noch nicht ganz angekommen)?
 * 0 heißt: genau in der Mitte.
 */
export function abstandZurMitte(ring: Ring): number {
  const bogen = (2 * Math.PI) / FARB_ANZAHL;
  const stelle = ring.art === 'band' ? -ring.winkel : -Math.PI / 2 - ring.winkel;
  return modulo(stelle, bogen) - bogen / 2;
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

/**
 * Das Band läuft in „Bogenmaß der Farbfolge" je Sekunde (siehe `Ring.winkel`).
 * Bei 4,0 geht eine Farbe in rund 0,39 s am Tor vorbei — knapp unter dem
 * schnellsten Ring (0,46 s), weil es keine Drehung gibt, an der man das
 * Kommende ablesen könnte.
 */
export function tempoFuerBand(nummer: number): number {
  return Math.min(3.8, 1.4 + nummer * 0.06);
}

/**
 * Der Pulsring bekommt ein etwas kleineres Grundtempo als ein gewöhnlicher
 * Ring: Sein schnellster Moment ist das 1,8-fache, und auch dort muss noch
 * Zeit zum Zielen bleiben (siehe Test).
 */
export function tempoFuerPuls(nummer: number): number {
  return 0.8 * tempoFuerRing(nummer);
}

/** Der Ring wird nach oben hin enger — weniger Platz zum Durchschlüpfen. */
export function halbmesserFuerRing(nummer: number): number {
  return Math.max(18, 27 - nummer * 0.25);
}

/**
 * Erzeugt das nächste Hindernis.
 *
 * Drehrichtung, Startdrehung und Art kommen aus der Saat, damit dieselbe
 * Saat immer denselben Aufstieg ergibt — kein `Math.random`.
 */
function ringBauen(nummer: number, y: number, saat: number): { ring: Ring; saat: number } {
  const a = schritt(saat);
  const b = schritt(a.saat);
  const c = schritt(b.saat);
  const art = artFuer(nummer, c.wert);
  const richtung = b.wert < 0.5 ? -1 : 1;
  const tempo = art === 'band' ? tempoFuerBand(nummer) : art === 'puls' ? tempoFuerPuls(nummer) : tempoFuerRing(nummer);
  return {
    ring: {
      id: nummer,
      nr: nummer,
      art,
      y,
      halbmesser: art === 'band' ? BAND_HALB : halbmesserFuerRing(nummer),
      // Zufällige Startdrehung, sonst stehen alle Hindernisse gleich.
      winkel: a.wert * 2 * Math.PI,
      tempo: tempo * richtung,
      // Der Pulsring beginnt an zufälliger Stelle seiner Schwingung.
      phase: art === 'puls' ? c.wert * 2 * Math.PI : 0,
      durch: false,
    },
    saat: c.saat,
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

/** Wie viele Hindernisse immer im Voraus bereitstehen. */
const VORRAT = 4;

/**
 * Wie weit unter dem Höchststand ein Hindernis liegen muss, bevor es
 * verschwindet. Weit außerhalb von `SICHT_RUNTER` + `FALL_GRENZE`: Die Kugel
 * fällt höchstens `FALL_GRENZE` zurück, dort darf nie etwas fehlen.
 */
const ABRAEUM_TIEFE = 250;

/**
 * `etappe` lässt die Runde mitten im Spiel beginnen — nur für Tests und
 * Bildschirmfotos (ein Spiel beginnt immer in Etappe 1). Es zählt dann so, als
 * lägen die Hindernisse davor hinter einem, mit der Kugel an ihrem Fuß.
 */
export function neuesSpiel(saat: number, etappe = 1): Zustand {
  return neuesSpielAb(saat, (etappe - 1) * ETAPPE_LAENGE);
}

/** Wie `neuesSpiel`, aber ab einem beliebigen Hindernis — für Bildschirmfotos kurz vor dem Etappenende. */
export function neuesSpielAb(saat: number, vorab: number): Zustand {
  const start = RING_ABSTAND * vorab;
  let z: Zustand = {
    kugelY: start,
    kugelTempo: 0,
    farbe: 0,
    ringe: [],
    wechsler: [],
    punkte: 0,
    hoehe: start,
    vorbei: false,
    erzeugt: vorab,
    geschafft: vorab,
    serie: 0,
    zeit: 0,
    saat,
  };
  for (let i = 0; i < VORRAT; i++) z = nachschieben(z);
  return z;
}

/** Hängt ein weiteres Hindernis samt Wechsler oben an. */
function nachschieben(z: Zustand): Zustand {
  const nummer = z.erzeugt;
  const y = ERSTER_RING + RING_ABSTAND * nummer;
  const { ring, saat: s1 } = ringBauen(nummer, y, z.saat);
  const letzteFarbe = z.wechsler.at(-1)?.farbe ?? z.farbe;
  /*
   * Der Wechsler hängt **direkt über** seinem Hindernis, nicht in der Mitte
   * zwischen zwei Hindernissen.
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
 * Prüft, ob die Kugel zwischen `vorher` und `jetzt` eine Kante gekreuzt hat —
 * und wenn ja, ob die Farbe gepasst hat.
 *
 * Geprüft wird an genau **einer** Stelle je Hindernis: dem Tor. Die Kugel
 * läuft ja immer durch die Mitte, andere Stellen kann sie gar nicht treffen.
 * Das macht aus einer Kreis-Kollision einen simplen Zahlenvergleich —
 * dieselbe Vereinfachung wie der Steckwinkel bei Blade Toss.
 */
function kanteGekreuzt(vorher: number, jetzt: number, kante: number): boolean {
  return (vorher < kante && jetzt >= kante) || (vorher > kante && jetzt <= kante);
}

/** Dreht ein Hindernis um einen Zeitschritt weiter. */
function weiterdrehen(r: Ring, dt: number): Ring {
  if (r.art === 'puls') {
    // Das Tempo schwingt um das Grundtempo. Die Phase läuft unabhängig vom
    // Winkel weiter; beides ist reine Zeitfunktion, also bildratenfest.
    const faktor = 1 + PULS_TIEFE * Math.sin(r.phase);
    return {
      ...r,
      winkel: modulo(r.winkel + r.tempo * faktor * dt, 2 * Math.PI),
      phase: modulo(r.phase + ((2 * Math.PI) / PULS_PERIODE) * dt, 2 * Math.PI),
    };
  }
  return { ...r, winkel: modulo(r.winkel + r.tempo * dt, 2 * Math.PI) };
}

/**
 * Ein Zeitschritt. `dt` in Sekunden.
 *
 * Reine Funktion: gleicher Zustand und gleiches `dt` ergeben immer dasselbe
 * Ergebnis, ohne Uhr und ohne Zufall außerhalb der Saat.
 */
export function takt(z: Zustand, dt: number): Zustand {
  if (z.vorbei) return z;

  const ringe = z.ringe.map((r) => weiterdrehen(r, dt));

  const vorherY = z.kugelY;
  const kugelTempo = z.kugelTempo - SCHWERKRAFT * dt;
  const kugelY = z.kugelY + kugelTempo * dt;

  let farbe = z.farbe;
  let punkte = z.punkte;
  let geschafft = z.geschafft;
  let serie = z.serie;
  let vorbei = false;

  // Farbwechsler: gilt als genommen, sobald die Kugel seine Höhe berührt.
  const wechsler = z.wechsler.map((w) => {
    if (w.genommen || !kanteGekreuzt(vorherY, kugelY, w.y)) return w;
    farbe = w.farbe;
    return { ...w, genommen: true };
  });

  for (const ring of ringe) {
    // Das Tor ist der untere Rand. Beim Ring liegt dort die Stelle −π/2,
    // beim Band ist es die Unterkante des Streifens.
    const tor = ring.y - ring.halbmesser;
    if (ring.durch || !kanteGekreuzt(vorherY, kugelY, tor)) continue;
    ring.durch = true;
    if (torFarbe(ring) !== farbe) {
      vorbei = true;
      continue;
    }
    // Mitten durch: Serie wächst. Am Rand des Bogens durch: gezählt, aber die Serie reißt.
    serie = Math.abs(abstandZurMitte(ring)) <= mitteBreite(etappeVon(ring.nr)) ? serie + 1 : 0;
    punkte += ART_WERT[ring.art] * serieFaktor(serie);
    geschafft += 1;
    // Die Etappe, die gerade vollendet wurde, ist die davor.
    if (geschafft % ETAPPE_LAENGE === 0) punkte += ETAPPEN_BONUS * etappeVon(geschafft - 1);
  }

  const hoehe = Math.max(z.hoehe, kugelY);
  // Zu tief gefallen — die Kugel steht unten an der Bildkante an.
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
    geschafft,
    serie,
    zeit: z.zeit + dt,
  };

  // Immer genug Hindernisse über der Kugel bereithalten.
  while (neu.erzeugt < VORRAT + geschafft) neu = nachschieben(neu);

  // Was weit unter dem Bild liegt, wird nie wieder gebraucht. Ohne das wüchse
  // die Liste mit jedem Hindernis, und ein langer Lauf drehte tausend Ringe
  // je Bild weiter, die niemand sieht.
  const grenze = hoehe - ABRAEUM_TIEFE;
  if (neu.ringe[0] && neu.ringe[0].y < grenze) {
    neu = {
      ...neu,
      ringe: neu.ringe.filter((r) => r.y >= grenze),
      wechsler: neu.wechsler.filter((w) => w.y >= grenze),
    };
  }

  return neu;
}
