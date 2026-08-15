import * as THREE from 'three';
import { ABSCHNITT_LAENGE, HOEHE_STEHEND, SPUR_BREITE, spurX } from './logik';
import type { Lauf } from './logik';
import {
  asphaltTextur,
  containerTextur,
  gehwegTextur,
  hauswandTextur,
  himmelTextur,
  markierungTextur,
  muenzTextur,
  randschattenTextur,
  schattenTextur,
  sockelTextur,
  warnTextur,
  wolkeTextur,
} from './texturen';

/**
 * Dash City — die 3-D-Darstellung.
 *
 * **Diese Datei ist der einzige Ort im ganzen Projekt, der three.js kennt.**
 * Sie wird von `DashCity.tsx` per `await import(...)` nachgeladen, landet
 * dadurch in einem eigenen Brocken und belastet die anderen Spiele nicht.
 *
 * Sie enthält **keine Spielregeln**. Sie bekommt einen `Lauf` gereicht und
 * stellt ihn dar — mehr nicht. Alles Rechnende steht in `logik.ts` und ist
 * ohne Browser geprüft. Genau diese Trennung war die Bedingung dafür, dass
 * 3-D die Projektregeln nicht bricht.
 *
 * Zielgerät bleibt ein altes iPad: geteilte Geometrien und Werkstoffe, ein
 * fester Vorrat wiederverwendeter Körper statt ständigem Neuanlegen, keine
 * echten Schattenwürfe, `devicePixelRatio` gedeckelt. Die Texturen sind im
 * Code gezeichnet (siehe `texturen.ts`) — sie kosten fast nichts und heben
 * die Bildqualität mehr als alles andere.
 */

/**
 * **Die Kamera blickt in +z — dadurch liegt Welt-Rechts auf dem Bildschirm
 * links.** Ohne diese Spiegelung ist die gesamte Steuerung seitenverkehrt:
 * Wischen nach links schickt die Figur nach rechts. Genau das war der Fall,
 * und es machte das Spiel unspielbar.
 *
 * Gespiegelt wird **nur beim Zeichnen**, an dieser einen Stelle. Die Logik
 * behält ihr Koordinatensystem (x nach rechts) — dort ist es richtig, und
 * die Tests hängen daran.
 */
const bildX = (x: number) => -x;

/** Wie weit man nach vorn sieht. Dahinter macht der Dunst zu. */
const SICHTWEITE = 110;

/**
 * Kameraführung — **die wichtigste Einzelentscheidung im ganzen Bild.**
 *
 * Die erste Fassung stand auf 3,9 Höhe und blickte auf 1,2 herunter. Das ist
 * ein Blickwinkel von fast zwanzig Grad nach unten, und der ist für einen
 * Läufer falsch: Man sah der Figur auf den **Scheitel**, die Straße lag als
 * riesige graue Fläche im Bild, und die Häuser standen weit weg am Rand.
 * Eine Aufsicht flacht jede Perspektive ab — Ronnis Urteil „dreidimensional
 * sieht es noch nicht richtig aus" beschrieb genau das.
 *
 * Jetzt steht die Kamera **tief und dicht** und blickt beinahe waagerecht.
 * Dadurch türmen sich die Häuser links und rechts auf, die Fluchtlinien
 * werden steil, und man sieht der Figur auf den Rücken statt auf den Kopf.
 * Derselbe Griff, den jeder Endlosläufer benutzt.
 */
const KAMERA_Y = 2.5;
const KAMERA_Z = -6.2;
const KAMERA_ZIEL_Y = 1.75;
const SICHTFELD = 58;

/** So viele Hindernisse, Münzen und Häuser hält der Vorrat bereit. */
const VORRAT_HINDERNISSE = 26;
const VORRAT_MUENZEN = 48;
const VORRAT_HAEUSER = 24;
const VORRAT_LATERNEN = 12;
const VORRAT_BAEUME = 12;
const VORRAT_WOLKEN = 5;

const FARBEN = {
  dunst: 0xbcdff2,
  /** Violett — es ist die Akzentfarbe des Spiels und kommt sonst nirgends
   *  im Bild vor. Gegen grauen Beton, blauen Himmel und graue Fahrbahn hebt
   *  es sich ab, ohne mit Orange/Rot (Hindernisse) oder Gelb (Münzen)
   *  verwechselt zu werden. Das frühere Cyan ging im Himmel unter. */
  shirt: 0x7c5cf5,
  shirtDunkel: 0x5b3fd6,
  haut: 0xf3c49b,
  /** Bewusst hell: Ein sehr dunkles Braun liest sich am Hinterkopf nicht als
   *  Haar, sondern als Loch. */
  haar: 0x6b5136,
  hose: 0x27303f,
  /** Korpus des Rucksacks — dunkel, damit sich Gurt und Schnalle **hell**
   *  davon abheben und nicht umgekehrt. */
  tasche: 0x2f3b52,
  rucksack: 0xeef2f7,
  huerde: '#f97316',
  balken: 0xdc2626,
  mauer: '#d2492a',
  muenze: 0xfacc15,
} as const;

export type Szene = {
  /** Einmal je Bild aufrufen. */
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
  aufraeumen: () => void;
};

type Figur = {
  gruppe: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  beinL: THREE.Object3D;
  beinR: THREE.Object3D;
};

/**
 * Baut die Läuferfigur aus Grundkörpern.
 *
 * Bewusst keine geladene Figurdatei: Die App muss offline laufen und ohne
 * fremde Dateien auskommen.
 *
 * **Warum die Figur aussah, als trüge sie eine Windel.** Die alte Fassung
 * hatte an der Hüfte eine *quergelegte Kapsel* in Hosenfarbe — also einen
 * Körper, der an genau dieser Stelle **breiter** war als der Rumpf und nach
 * beiden Seiten ausbeulte. Dazu endete der Rumpf selbst in einer Halbkugel.
 * Zwei Wölbungen übereinander an der Hüfte ergeben unweigerlich dieses Bild.
 *
 * Drei Griffe beheben es:
 *
 * 1. **Der Rumpf ist ein Zylinder**, kein Kapselkörper — er hat unten einen
 *    sauberen, waagerechten Saum wie ein Pullover.
 * 2. **Die Hüfte ist schmaler als der Rumpf** und verjüngt sich nach unten.
 *    Die Silhouette läuft dadurch gerade weiter, statt auszubeulen.
 * 3. **Jedes Bein hat sein eigenes Hosenbein**, das mitschwingt. Dadurch
 *    sieht man den Spalt zwischen den Beinen — und ein Spalt ist das genaue
 *    Gegenteil einer Windel.
 *
 * Alle Teile **überlappen** sich weiterhin. Das ist bei Grundkörpern ohne
 * Skelett das einzige Mittel gegen den Eindruck „zusammengesteckt".
 *
 * Dazu ein **Rucksack**: Man sieht die Figur den ganzen Lauf über von
 * hinten, und ein Rücken ohne alles ist die langweiligste Ansicht, die es
 * gibt. Der Rucksack ist das, was die Silhouette überhaupt erst lesbar
 * macht.
 */
function figurBauen(): Figur {
  const gruppe = new THREE.Group();

  // Phong statt Lambert: Ein leichter Glanz macht aus einer flachen Fläche
  // eine gewölbte. Bei einer Figur aus lauter Grundkörpern ist das der
  // Unterschied zwischen „Spielfigur aus Kunststoff" und „Pappe".
  const stoff = (farbe: number, glanz = 18) =>
    new THREE.MeshPhongMaterial({ color: farbe, shininess: glanz, specular: 0x2a2a2a });

  const mShirt = stoff(FARBEN.shirt, 26);
  const mShirtDunkel = stoff(FARBEN.shirtDunkel, 22);
  const mHaut = stoff(FARBEN.haut, 7);
  const mHaar = stoff(FARBEN.haar, 16);
  const mHose = stoff(FARBEN.hose, 12);
  const mRucksack = stoff(FARBEN.rucksack, 28);
  const mTasche = stoff(FARBEN.tasche, 20);
  const mSchuh = stoff(0xf8fafc, 44);
  const mSohle = stoff(0x2b3442, 26);

  const SCHULTER_Y = 1.16;
  // Enger als beim ersten Versuch (0,285). Dort ragten die Arme fast elf
  // Zentimeter über den Rumpf hinaus und lasen sich als abstehende Stummel.
  const SCHULTER_X = 0.25;
  const HUEFT_Y = 0.68;

  // --- Rumpf, Hüfte, Schultern ---
  const rumpf = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.275, 0.5, 20), mShirt);
  rumpf.position.y = 1.0;
  gruppe.add(rumpf);

  const brust = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), mShirt);
  brust.position.y = 1.25;
  brust.scale.y = 0.72;
  gruppe.add(brust);

  const huefte = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.232, 0.24, 18), mHose);
  huefte.position.y = 0.74;
  gruppe.add(huefte);

  const schulterbalken = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.24, 5, 14), mShirt);
  schulterbalken.rotation.z = Math.PI / 2;
  schulterbalken.position.y = SCHULTER_Y;
  gruppe.add(schulterbalken);

  /*
   * --- Rucksack ---
   *
   * Erster Versuch: heller Kasten mit dunklem Quadrat in der Mitte. Das las
   * sich als **Haushaltsgerät**, nicht als Rucksack — ein rechteckiger
   * weißer Block mit einer dunklen Klappe ist nun mal eine Waschmaschine.
   * Was einen Rucksack ausmacht, ist die gewölbte Oberseite, ein
   * durchlaufender Gurt und ein *dunkler* Korpus, von dem sich die hellen
   * Teile absetzen — nicht umgekehrt.
   */
  const rucksack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.2), mTasche);
  rucksack.position.set(0, 0.99, -0.3);
  gruppe.add(rucksack);
  // Gewölbter Deckel — die eine Rundung, die den Kasten zum Rucksack macht.
  const deckel = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), mTasche);
  deckel.position.set(0, 1.16, -0.3);
  deckel.scale.set(0.92, 0.62, 0.56);
  gruppe.add(deckel);
  const spanner = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.055, 0.215), mRucksack);
  spanner.position.set(0, 1.03, -0.3);
  gruppe.add(spanner);
  const schnalle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.03), mRucksack);
  schnalle.position.set(0, 0.89, -0.41);
  gruppe.add(schnalle);
  for (const seite of [-1, 1]) {
    const gurt = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.05), mTasche);
    gurt.position.set(seite * 0.125, 1.06, -0.25);
    gruppe.add(gurt);
  }

  // --- Hals und Kopf ---
  const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.14, 14), mHaut);
  hals.position.y = 1.3;
  gruppe.add(hals);

  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), mHaut);
  kopf.position.y = 1.5;
  gruppe.add(kopf);

  /*
   * Haar im Nacken — von hinten sieht man sonst nur eine nackte Kugel.
   *
   * **Als Schale auf dem Kopf, nicht als Ballen darin.** Der erste Versuch
   * war ein plattgedrücktes Ei knapp unter der Kopfoberfläche. Rechnerisch
   * lag es innen — aber nur zwei Millimeter, und eine Kugel aus zwanzig
   * Segmenten liegt an ihrer breitesten Stelle rund drei Millimeter *innen*
   * vor der echten Kugelfläche. Also stieß das Haar an zwei Stellen durch
   * den Kopf und sah aus wie aufgemalte Augenbrauen.
   *
   * Eine Kugelkappe mit sechs Millimetern Abstand kann das nicht passieren:
   * Sie liegt überall gleich weit außen. Gedreht sitzt sie im Nacken, genau
   * unter dem Mützenrand.
   */
  const haar = new THREE.Mesh(
    new THREE.SphereGeometry(0.246, 18, 12, 0, Math.PI * 2, 0, 0.62),
    mHaar,
  );
  haar.position.y = 1.5;
  haar.rotation.x = -2.4;
  gruppe.add(haar);

  /*
   * Die Mütze reicht **unter** den größten Kopfumfang (Winkel über 90°) und
   * wird beidseitig gezeichnet.
   *
   * Vorher endete sie bei knapp 84° — also oberhalb der breitesten Stelle
   * des Kopfes. Dort stand ihr Rand einen Zentimeter frei ab, und weil eine
   * Fläche standardmäßig nur von außen gezeichnet wird, blickte man am
   * Silhouettenrand durch die Mütze hindurch in den Kopf. Ergebnis waren
   * zwei dunkle Striche links und rechts, die aussahen wie aufgemalte
   * Augenbrauen.
   */
  const muetze = new THREE.Mesh(
    new THREE.SphereGeometry(0.252, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.85),
    new THREE.MeshPhongMaterial({
      color: FARBEN.shirtDunkel,
      shininess: 22,
      specular: 0x2a2a2a,
      side: THREE.DoubleSide,
    }),
  );
  muetze.position.y = 1.5;
  gruppe.add(muetze);
  // Der Schirm zeigt nach **vorn** (+z). Vorher stand er auf −z, also im
  // Nacken — eine Mütze verkehrt herum.
  const schirm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.17), mShirtDunkel);
  schirm.position.set(0, 1.487, 0.2);
  gruppe.add(schirm);

  // --- Gliedmaßen ---
  const armGeo = new THREE.CapsuleGeometry(0.066, 0.27, 4, 12);
  const aermelGeo = new THREE.CylinderGeometry(0.095, 0.088, 0.2, 14);
  const handGeo = new THREE.SphereGeometry(0.075, 12, 10);
  const beinGeo = new THREE.CapsuleGeometry(0.098, 0.28, 4, 12);
  const hosenbeinGeo = new THREE.CylinderGeometry(0.135, 0.15, 0.24, 14);
  const schuhGeo = new THREE.BoxGeometry(0.19, 0.115, 0.3);
  const sohleGeo = new THREE.BoxGeometry(0.2, 0.045, 0.31);
  const gelenkGeo = new THREE.SphereGeometry(0.125, 12, 10);

  const arm = (seite: number) => {
    const drehpunkt = new THREE.Object3D();
    drehpunkt.position.set(seite * SCHULTER_X, SCHULTER_Y, 0);
    // Leicht zum Körper geneigt. Senkrecht herabhängende Arme stehen bei
    // einem so breiten Rumpf sichtbar ab; ein Läufer hält sie eng.
    drehpunkt.rotation.z = -seite * 0.13;
    drehpunkt.add(new THREE.Mesh(gelenkGeo, mShirt));
    const aermel = new THREE.Mesh(aermelGeo, mShirt);
    aermel.position.y = -0.08;
    drehpunkt.add(aermel);
    const glied = new THREE.Mesh(armGeo, mHaut);
    glied.position.y = -0.31;
    drehpunkt.add(glied);
    const hand = new THREE.Mesh(handGeo, mHaut);
    hand.position.y = -0.53;
    drehpunkt.add(hand);
    gruppe.add(drehpunkt);
    return drehpunkt;
  };

  const bein = (seite: number) => {
    const drehpunkt = new THREE.Object3D();
    drehpunkt.position.set(seite * 0.125, HUEFT_Y, 0);
    drehpunkt.add(new THREE.Mesh(gelenkGeo, mHose));
    const hosenbein = new THREE.Mesh(hosenbeinGeo, mHose);
    hosenbein.position.y = -0.08;
    drehpunkt.add(hosenbein);
    const glied = new THREE.Mesh(beinGeo, mHaut);
    glied.position.y = -0.32;
    drehpunkt.add(glied);
    const schuh = new THREE.Mesh(schuhGeo, mSchuh);
    schuh.position.set(0, -0.6, 0.02);
    drehpunkt.add(schuh);
    const sohle = new THREE.Mesh(sohleGeo, mSohle);
    sohle.position.set(0, -0.655, 0.02);
    drehpunkt.add(sohle);
    gruppe.add(drehpunkt);
    return drehpunkt;
  };

  return {
    gruppe,
    armL: arm(-1),
    armR: arm(1),
    beinL: bein(-1),
    beinR: bein(1),
  };
}

export function szeneBauen(leinwand: HTMLCanvasElement): Szene {
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand,
    // Kantenglättung an: Die Szene besteht aus wenigen großen Flächen, und
    // gerade die langen schrägen Kanten von Straße und Häusern flimmern ohne
    // sie sichtbar. Der Preis ist bei so wenigen Dreiecken vertretbar, zumal
    // die Bildpunktzahl unten gedeckelt bleibt.
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  // Filmische Tonwertkurve: Ohne sie brennen die hellen Flächen (Himmel,
  // Gehweg) aus und die Farben wirken flach.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const szene = new THREE.Scene();
  const himmel = himmelTextur();
  szene.background = himmel;
  // Der Dunst versteckt die Stelle, an der die Welt aufhört, und ist auf den
  // hellen Horizont abgestimmt — sonst sieht man den Übergang.
  szene.fog = new THREE.Fog(FARBEN.dunst, 48, SICHTWEITE);

  // `near` bewusst nicht 0,1: Näher als einen Meter kommt nichts an die
  // Kamera, und ein zu kleiner Nahwert frisst die Tiefengenauigkeit auf —
  // ausgerechnet dort, wo Fahrbahn, Markierung und Randschatten in zwei
  // Zentimeter Abstand übereinanderliegen.
  const kamera = new THREE.PerspectiveCamera(SICHTFELD, 1, 0.3, SICHTWEITE + 70);
  kamera.position.set(0, KAMERA_Y, KAMERA_Z);
  kamera.lookAt(0, KAMERA_ZIEL_Y, 18);

  /*
   * Beleuchtung mit **Richtung**. Vorher war das Umgebungslicht so stark,
   * dass alle Hausflächen gleich hell waren — und eine Fläche ohne
   * Helligkeitsunterschied zu ihrer Nachbarfläche liest sich nicht als
   * Körper, egal wie viel Textur darauf liegt. Jetzt liegt die eine
   * Straßenseite im Licht und die andere im Schatten.
   */
  szene.add(new THREE.HemisphereLight(0xdaf0ff, 0x6d7f90, 1.25));
  const sonne = new THREE.DirectionalLight(0xfff2d8, 2.5);
  sonne.position.set(-9, 13, 5);
  szene.add(sonne);
  // Ein schwaches Gegenlicht von vorn setzt die Silhouette der Figur vom
  // Hintergrund ab — sie ist das Einzige, was man dauernd ansieht.
  const gegenlicht = new THREE.DirectionalLight(0xbfe3f4, 0.55);
  gegenlicht.position.set(4, 5, 14);
  szene.add(gegenlicht);

  // ---------------------------------------------------------------
  // Straße, Markierung, Gehwege
  // ---------------------------------------------------------------
  const strassenBreite = SPUR_BREITE * 3 + 1.4;
  const STRASSE_LAENGE = 240;
  /** Wie viele Meter eine Kachel des jeweiligen Bildes abdeckt. */
  const ASPHALT_TAKT = 4;
  const MARKIERUNG_TAKT = 8;

  const asphaltBild = asphaltTextur();
  asphaltBild.repeat.set(2, STRASSE_LAENGE / ASPHALT_TAKT);
  const strasse = new THREE.Mesh(
    new THREE.PlaneGeometry(strassenBreite, STRASSE_LAENGE),
    new THREE.MeshPhongMaterial({ map: asphaltBild, shininess: 5, specular: 0x0e0e0e }),
  );
  strasse.rotation.x = -Math.PI / 2;
  strasse.position.z = STRASSE_LAENGE / 2 - 14;
  szene.add(strasse);

  /*
   * Die Fahrbahnmarkierung liegt als **eigene, durchsichtige Ebene** knapp
   * über dem Belag. Grund: Belag und Markierung brauchen völlig
   * unterschiedliche Wiederholraten — der Grus alle vier Meter, ein
   * Strich-Lücke-Takt alle acht. Vorher steckten beide in einem Bild, der
   * Takt der Striche gab die Kachelgröße vor, und die Körnung war dadurch
   * auf fünfundzwanzig Meter auseinandergezogen: aus Grus wurden Flecken.
   */
  const spurAnteile = [
    0.5 - SPUR_BREITE / 2 / strassenBreite,
    0.5 + SPUR_BREITE / 2 / strassenBreite,
  ];
  const markierungBild = markierungTextur(spurAnteile);
  markierungBild.repeat.set(1, STRASSE_LAENGE / MARKIERUNG_TAKT);
  const markierung = new THREE.Mesh(
    new THREE.PlaneGeometry(strassenBreite, STRASSE_LAENGE),
    new THREE.MeshBasicMaterial({
      map: markierungBild,
      transparent: true,
      depthWrite: false,
      fog: true,
    }),
  );
  markierung.rotation.x = -Math.PI / 2;
  markierung.position.set(0, 0.012, STRASSE_LAENGE / 2 - 14);
  szene.add(markierung);

  // Der Schlagschatten der Häuserzeile. Er erdet die Straße: Ohne ihn
  // schwebt sie zwischen den Gehwegen, weil nichts die Häuser mit dem Boden
  // verbindet, auf dem sie stehen.
  const randschattenBild = randschattenTextur();
  const randschatten = new THREE.Mesh(
    new THREE.PlaneGeometry(strassenBreite, STRASSE_LAENGE),
    new THREE.MeshBasicMaterial({
      map: randschattenBild,
      transparent: true,
      depthWrite: false,
    }),
  );
  randschatten.rotation.x = -Math.PI / 2;
  randschatten.position.set(0, 0.024, STRASSE_LAENGE / 2 - 14);
  szene.add(randschatten);

  const GEHWEG_BREITE = 3.4;
  const GEHWEG_HOEHE = 0.34;
  const gehwegBild = gehwegTextur();
  gehwegBild.repeat.set(2, STRASSE_LAENGE / 2.2);
  const bordsteinStoff = new THREE.MeshPhongMaterial({ color: 0xd8d4c8, shininess: 8 });
  for (const seite of [-1, 1]) {
    const gehweg = new THREE.Mesh(
      new THREE.BoxGeometry(GEHWEG_BREITE, GEHWEG_HOEHE, STRASSE_LAENGE),
      new THREE.MeshPhongMaterial({ map: gehwegBild, shininess: 4 }),
    );
    gehweg.position.set(
      seite * (strassenBreite / 2 + GEHWEG_BREITE / 2),
      GEHWEG_HOEHE / 2,
      STRASSE_LAENGE / 2 - 14,
    );
    szene.add(gehweg);

    // Der Bordstein ist eine eigene, hellere Kante. Er ist die einzige
    // waagerechte Linie, die den ganzen Weg bis zum Horizont durchläuft —
    // und damit die stärkste Fluchtlinie im Bild.
    const bordstein = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, GEHWEG_HOEHE + 0.05, STRASSE_LAENGE),
      bordsteinStoff,
    );
    bordstein.position.set(
      seite * (strassenBreite / 2 + 0.12),
      (GEHWEG_HOEHE + 0.05) / 2,
      STRASSE_LAENGE / 2 - 14,
    );
    szene.add(bordstein);
  }

  // ---------------------------------------------------------------
  // Häuser
  // ---------------------------------------------------------------
  const hausGeo = new THREE.BoxGeometry(1, 1, 1);
  /*
   * Beton- und Glastöne, **nicht bunt** — Hochhäuser sollen nach Hochhäusern
   * aussehen. Farbe gehört dorthin, wo sie etwas bedeutet: auf Hindernisse
   * und Münzen. Drei Fensterdichten, damit die Fenster bei hohen und
   * niedrigen Häusern ungefähr gleich groß bleiben; ein einziger Wert würde
   * sie an einem 30 Meter hohen Haus zu Streifen ziehen.
   */
  const hausFarben: readonly (readonly [string, string])[] = [
    ['#9aa5b0', '#ffe4a3'],
    ['#7c8794', '#cfeaff'],
    ['#b5bac1', '#ffe4a3'],
    ['#6d7883', '#bfe3f4'],
    ['#aaa295', '#ffe4a3'],
    ['#84939f', '#cfeaff'],
  ];
  const hausStoffe = hausFarben.flatMap(([grund, fenster]) =>
    [2, 3, 5].map((dichte) => {
      const bild = hauswandTextur(grund, fenster);
      bild.repeat.set(1, dichte);
      return new THREE.MeshPhongMaterial({ map: bild, shininess: 14, specular: 0x1c1c1c });
    }),
  );
  const sockelBild = sockelTextur();
  const sockelStoff = new THREE.MeshPhongMaterial({ map: sockelBild, shininess: 10 });
  const attikaStoff = new THREE.MeshPhongMaterial({ color: 0x535a63 });

  const haeuser = Array.from({ length: VORRAT_HAEUSER }, () => {
    const g = new THREE.Group();
    const koerper = new THREE.Mesh(hausGeo, hausStoffe[0]);
    const sockel = new THREE.Mesh(hausGeo, sockelStoff);
    const attika = new THREE.Mesh(hausGeo, attikaStoff);
    g.add(koerper, sockel, attika);
    szene.add(g);
    return { g, koerper, sockel, attika };
  });

  /** Höhe des Erdgeschosses. */
  const SOCKEL_H = 3.4;
  const hausSetzen = (h: (typeof haeuser)[number], index: number, versatz: number) => {
    const seite = index % 2 === 0 ? -1 : 1;
    const reihe = Math.floor(index / 2);
    const hoehe = 11 + ((reihe * 37) % 24);
    const dicke = 5 + ((reihe * 19) % 4) * 0.8;
    const laenge = 7 + ((reihe * 23) % 7);
    const stufe = hoehe < 17 ? 0 : hoehe < 25 ? 1 : 2;
    h.koerper.material = hausStoffe[((reihe * 5) % hausFarben.length) * 3 + stufe]!;
    h.koerper.scale.set(dicke, hoehe - SOCKEL_H, laenge);
    h.koerper.position.y = SOCKEL_H + (hoehe - SOCKEL_H) / 2;
    h.sockel.scale.set(dicke + 0.16, SOCKEL_H, laenge + 0.16);
    h.sockel.position.y = SOCKEL_H / 2;
    // Die Attika ist der kleine Aufsatz auf dem Dach. Ein Haus, das oben
    // einfach aufhört, sieht abgeschnitten aus.
    h.attika.scale.set(dicke + 0.34, 0.75, laenge + 0.34);
    h.attika.position.y = hoehe + 0.375;
    h.g.position.set(
      seite * (strassenBreite / 2 + GEHWEG_BREITE + dicke / 2),
      0,
      versatz,
    );
  };

  // ---------------------------------------------------------------
  // Laternen und Bäume — die Tiefenanzeiger
  // ---------------------------------------------------------------
  /*
   * **Das ist der zweitwichtigste Griff nach der Kamera.** Ein Endlosläufer
   * wirkt schnell und räumlich, wenn dicht an der Kamera etwas vorbeizieht.
   * Häuser sind dafür zu weit weg und Hindernisse zu selten. Laternen und
   * Bäume stehen am Bordstein, rauschen also direkt am Bildrand vorbei —
   * und sie stehen **neben** der Fahrbahn, können deshalb nie mit einem
   * Hindernis verwechselt werden.
   */
  const metallStoff = new THREE.MeshPhongMaterial({ color: 0x3b4450, shininess: 46 });
  const lampenStoff = new THREE.MeshPhongMaterial({
    color: 0xfff4d0,
    emissive: 0x8a7530,
    shininess: 70,
  });
  const mastGeo = new THREE.CylinderGeometry(0.075, 0.115, 7, 8);
  const auslegerGeo = new THREE.BoxGeometry(1.9, 0.1, 0.1);
  const lampenGeo = new THREE.BoxGeometry(0.72, 0.16, 0.32);

  const laternen = Array.from({ length: VORRAT_LATERNEN }, () => {
    const g = new THREE.Group();
    const mast = new THREE.Mesh(mastGeo, metallStoff);
    mast.position.y = 3.5;
    g.add(mast);
    // Der Ausleger zeigt zunächst nach +x; für die andere Straßenseite wird
    // die ganze Laterne einmal gedreht.
    const ausleger = new THREE.Mesh(auslegerGeo, metallStoff);
    ausleger.position.set(0.95, 6.94, 0);
    g.add(ausleger);
    const lampe = new THREE.Mesh(lampenGeo, lampenStoff);
    lampe.position.set(1.75, 6.82, 0);
    g.add(lampe);
    szene.add(g);
    return g;
  });

  const stammStoff = new THREE.MeshPhongMaterial({ color: 0x6b4a2f, shininess: 6 });
  const laubStoff = new THREE.MeshPhongMaterial({ color: 0x3f7a35, shininess: 10 });
  const laubHellStoff = new THREE.MeshPhongMaterial({ color: 0x599a41, shininess: 10 });
  const stammGeo = new THREE.CylinderGeometry(0.13, 0.2, 2.4, 8);
  const kroneGeo = new THREE.SphereGeometry(0.9, 12, 9);

  const baeume = Array.from({ length: VORRAT_BAEUME }, () => {
    const g = new THREE.Group();
    const stamm = new THREE.Mesh(stammGeo, stammStoff);
    stamm.position.y = 1.2 + GEHWEG_HOEHE;
    g.add(stamm);
    const unten = new THREE.Mesh(kroneGeo, laubStoff);
    unten.position.y = 2.85 + GEHWEG_HOEHE;
    unten.scale.set(1, 0.85, 1);
    g.add(unten);
    const oben = new THREE.Mesh(kroneGeo, laubHellStoff);
    oben.position.y = 3.55 + GEHWEG_HOEHE;
    oben.scale.setScalar(0.68);
    g.add(oben);
    szene.add(g);
    return g;
  });

  // ---------------------------------------------------------------
  // Wolken
  // ---------------------------------------------------------------
  const wolkenGeo = new THREE.PlaneGeometry(26, 13);
  const wolken = Array.from({ length: VORRAT_WOLKEN }, (_, i) => {
    const m = new THREE.Mesh(
      wolkenGeo,
      new THREE.MeshBasicMaterial({
        map: wolkeTextur(0x1234 + i * 7717),
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
        // Ohne das frisst der Dunst die Wolken auf, bevor man sie sieht —
        // sie liegen ja weit hinten. Sie gehören zum Himmel, nicht zur
        // Straße.
        fog: false,
      }),
    );
    szene.add(m);
    return m;
  });

  // ---------------------------------------------------------------
  // Hindernisse
  // ---------------------------------------------------------------
  const warnBild = warnTextur(FARBEN.huerde);
  const containerBild = containerTextur(FARBEN.mauer);
  containerBild.repeat.set(2, 1);
  const stoffe = {
    huerde: new THREE.MeshPhongMaterial({ map: warnBild, shininess: 26 }),
    balken: new THREE.MeshPhongMaterial({ color: FARBEN.balken, shininess: 32 }),
    mauer: new THREE.MeshPhongMaterial({ map: containerBild, shininess: 24 }),
    dunkel: new THREE.MeshPhongMaterial({ color: 0x333a45, shininess: 44 }),
    hell: new THREE.MeshPhongMaterial({ color: 0xf1f5f9, shininess: 30 }),
  };

  const breit = SPUR_BREITE * 0.86;
  const geo = {
    huerdeBrett: new THREE.BoxGeometry(breit, 0.34, 0.2),
    huerdeBein: new THREE.BoxGeometry(0.13, 0.44, 0.13),
    huerdeFuss: new THREE.BoxGeometry(0.34, 0.08, 0.5),
    schild: new THREE.BoxGeometry(breit, 0.62, 0.16),
    schildRand: new THREE.BoxGeometry(breit + 0.1, 0.72, 0.1),
    pfosten: new THREE.BoxGeometry(0.14, 2.4, 0.14),
    querbalken: new THREE.BoxGeometry(breit + 0.44, 0.2, 0.22),
    container: new THREE.BoxGeometry(breit, 2.3, 0.85),
    band: new THREE.BoxGeometry(breit + 0.06, 0.12, 0.89),
    tuerkante: new THREE.BoxGeometry(0.09, 2.1, 0.9),
  };

  /*
   * Jedes Hindernis sagt über seine **Form**, was zu tun ist — nicht über
   * die Farbe. Wer die Bedeutung erst aus der Farbe erschließen muss,
   * erschließt sie bei Tempo 20 zu spät.
   */
  const hindernisse = Array.from({ length: VORRAT_HINDERNISSE }, () => {
    const gruppe = new THREE.Group();

    // Hürde: Absperrung mit Warnstreifen und Standfüßen — niedrig, drüber.
    const huerde = new THREE.Group();
    const brett = new THREE.Mesh(geo.huerdeBrett, stoffe.huerde);
    brett.position.y = 0.44;
    huerde.add(brett);
    for (const seite of [-1, 1]) {
      const bein = new THREE.Mesh(geo.huerdeBein, stoffe.dunkel);
      bein.position.set(seite * (breit / 2 - 0.09), 0.22, 0);
      huerde.add(bein);
      const fuss = new THREE.Mesh(geo.huerdeFuss, stoffe.dunkel);
      fuss.position.set(seite * (breit / 2 - 0.09), 0.04, 0);
      huerde.add(fuss);
    }
    gruppe.add(huerde);

    // Balken: Schild an zwei Pfosten, unten offen — drunter durch.
    const balken = new THREE.Group();
    const rand = new THREE.Mesh(geo.schildRand, stoffe.hell);
    rand.position.y = 1.62;
    balken.add(rand);
    // **Das rote Schild muss zur Kamera zeigen, also nach −z.** Beim ersten
    // Versuch stand es auf +0.04 — damit lag es *hinter* dem weißen Rahmen,
    // und man sah von vorn nur eine weiße Platte. Das Hindernis, das über
    // seine Farbe am ehesten auffällt, war dadurch farblos.
    const schild = new THREE.Mesh(geo.schild, stoffe.balken);
    schild.position.set(0, 1.62, -0.05);
    balken.add(schild);
    const quer = new THREE.Mesh(geo.querbalken, stoffe.dunkel);
    quer.position.y = 2.04;
    balken.add(quer);
    for (const seite of [-1, 1]) {
      const pfosten = new THREE.Mesh(geo.pfosten, stoffe.dunkel);
      pfosten.position.set(seite * (breit / 2 + 0.16), 1.2, 0);
      balken.add(pfosten);
    }
    gruppe.add(balken);

    // Mauer: geschlossener Wellblech-Container — dicht, ausweichen.
    // Die Rippen stecken jetzt in der Textur statt in vier Extrakörpern:
    // gleiche Wirkung, ein Viertel der Zeichenlast, keine flimmernden Kanten.
    const mauer = new THREE.Group();
    const kasten = new THREE.Mesh(geo.container, stoffe.mauer);
    kasten.position.y = 1.15;
    mauer.add(kasten);
    for (const y of [0.16, 2.16]) {
      const band = new THREE.Mesh(geo.band, stoffe.dunkel);
      band.position.y = y;
      mauer.add(band);
    }
    for (const x of [-0.02, 0.02]) {
      const kante = new THREE.Mesh(geo.tuerkante, stoffe.dunkel);
      kante.position.set(x, 1.15, 0);
      mauer.add(kante);
    }
    gruppe.add(mauer);

    gruppe.visible = false;
    szene.add(gruppe);
    return { gruppe, huerde, balken, mauer };
  });

  // ---------------------------------------------------------------
  // Münzen
  // ---------------------------------------------------------------
  /*
   * Eine Münze ist eine **Scheibe mit Prägung**, kein Ring. Vorher war es
   * eine Torusgeometrie — und aus dieser Kameraperspektive sah eine Reihe
   * davon aus wie eine Kette Donuts. Die Geometrie wird einmal gedreht, so
   * dass die Flächen zur Seite zeigen; die Drehung um die Hochachse lässt
   * sie dann abwechselnd flach und hochkant erscheinen, genau wie eine
   * gedrehte Münze.
   */
  const muenzGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 22);
  muenzGeo.rotateZ(Math.PI / 2);
  const muenzBild = muenzTextur();
  const muenzRandStoff = new THREE.MeshPhongMaterial({
    color: FARBEN.muenze,
    emissive: 0x5a4400,
    shininess: 90,
    specular: 0xfff3c4,
  });
  const muenzFlaecheStoff = new THREE.MeshPhongMaterial({
    map: muenzBild,
    emissive: 0x4a3800,
    shininess: 90,
    specular: 0xfff3c4,
  });
  const muenzen = Array.from({ length: VORRAT_MUENZEN }, () => {
    const m = new THREE.Mesh(muenzGeo, [muenzRandStoff, muenzFlaecheStoff, muenzFlaecheStoff]);
    m.visible = false;
    szene.add(m);
    return m;
  });

  // ---------------------------------------------------------------
  // Figur und Schatten
  // ---------------------------------------------------------------
  const figur = figurBauen();
  szene.add(figur.gruppe);

  const schattenStoff = new THREE.MeshBasicMaterial({
    map: schattenTextur(),
    transparent: true,
    depthWrite: false,
  });
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), schattenStoff);
  schatten.rotation.x = -Math.PI / 2;
  schatten.position.y = 0.03;
  szene.add(schatten);

  let laufzeit = 0;

  /** Ringförmig weiterrücken: was hinten rausläuft, kommt vorn wieder rein. */
  const ringZ = (reihe: number, abstand: number, anzahl: number, s: number, schub: number) => {
    const runde = anzahl * abstand;
    return (((reihe * abstand + schub - s) % runde) + runde) % runde;
  };

  const zeichnen = (lauf: Lauf, dt: number) => {
    laufzeit += dt;
    const s = lauf.strecke;

    /*
     * Straße und Gehweg ziehen über die **Texturverschiebung** vorbei, nicht
     * über bewegte Körper. Vorher waren die Fahrbahnstreifen 52 einzelne
     * Meshes, die jedes Bild einzeln umgesetzt wurden — jetzt sind es drei
     * Zahlen. Minuszeichen, weil ein wachsender Versatz das Muster sonst von
     * uns weg schöbe statt auf uns zu.
     */
    asphaltBild.offset.y = -s / ASPHALT_TAKT;
    markierungBild.offset.y = -s / MARKIERUNG_TAKT;
    gehwegBild.offset.y = -s / 2.2;

    haeuser.forEach((haus, i) => {
      const seite = i % 2;
      const reihe = Math.floor(i / 2);
      hausSetzen(haus, i, ringZ(reihe, 13, VORRAT_HAEUSER / 2, s, seite * 6.5));
    });

    laternen.forEach((laterne, i) => {
      const seite = i % 2 === 0 ? -1 : 1;
      const reihe = Math.floor(i / 2);
      laterne.position.set(
        seite * (strassenBreite / 2 + 0.75),
        GEHWEG_HOEHE,
        ringZ(reihe, 22, VORRAT_LATERNEN / 2, s, i % 2 === 0 ? 0 : 11),
      );
      // Für die rechte Seite die ganze Laterne drehen, damit der Ausleger
      // wieder über die Fahrbahn zeigt.
      laterne.rotation.y = seite < 0 ? 0 : Math.PI;
    });

    baeume.forEach((baum, i) => {
      const seite = i % 2 === 0 ? -1 : 1;
      const reihe = Math.floor(i / 2);
      baum.position.set(
        seite * (strassenBreite / 2 + 2.5),
        0,
        ringZ(reihe, 22, VORRAT_BAEUME / 2, s, i % 2 === 0 ? 11 : 22),
      );
    });

    wolken.forEach((wolke, i) => {
      // Deutlich langsamer als alles andere: Diese zweite Bewegungsebene ist
      // der billigste Tiefeneindruck, den es gibt.
      const z = ringZ(i, 46, VORRAT_WOLKEN, s * 0.2, 0) + 34;
      wolke.position.set((i % 2 === 0 ? -1 : 1) * (7 + (i % 3) * 8), 25 + (i % 4) * 3.5, z);
      wolke.lookAt(kamera.position);
    });

    let nummer = 0;
    for (const h of lauf.hindernisse) {
      const dz = h.z - s;
      if (dz < -4 || dz > SICHTWEITE) continue;
      const koerper = hindernisse[nummer];
      if (!koerper) break;
      nummer += 1;
      koerper.gruppe.visible = true;
      koerper.gruppe.position.set(bildX(spurX(h.spur)), 0, dz);
      koerper.huerde.visible = h.art === 'huerde';
      koerper.balken.visible = h.art === 'balken';
      koerper.mauer.visible = h.art === 'mauer';
    }
    for (let i = nummer; i < hindernisse.length; i++) hindernisse[i]!.gruppe.visible = false;

    let muenzNummer = 0;
    for (const m of lauf.muenzen) {
      const dz = m.z - s;
      if (dz < -2 || dz > SICHTWEITE * 0.6) continue;
      const koerper = muenzen[muenzNummer];
      if (!koerper) break;
      muenzNummer += 1;
      koerper.visible = true;
      // Leichtes Auf und Ab — eine still stehende Münze wirkt wie Deko,
      // eine schwebende wie etwas, das man haben will.
      koerper.position.set(bildX(spurX(m.spur)), m.y + Math.sin(laufzeit * 3 + m.z) * 0.09, dz);
      koerper.rotation.y = laufzeit * 3.2;
    }
    for (let i = muenzNummer; i < muenzen.length; i++) muenzen[i]!.visible = false;

    // --- Die Figur ---
    const rutscht = lauf.rutschRest > 0;
    const inDerLuft = lauf.y > 0.05;
    const fx = bildX(lauf.x);

    // Ein leichtes Auf und Ab beim Laufen. Ohne das gleitet die Figur, statt
    // zu rennen — der Boden zieht zwar vorbei, aber der Körper bleibt starr.
    const huepfer = inDerLuft || rutscht ? 0 : Math.abs(Math.sin(laufzeit * 13)) * 0.06;
    figur.gruppe.position.set(fx, lauf.y + huepfer, 0);
    figur.gruppe.rotation.x = rutscht ? -1.15 : 0;
    // Leichte Neigung in die Bewegungsrichtung beim Spurwechsel.
    figur.gruppe.rotation.z = rutscht ? 0 : (bildX(spurX(lauf.zielSpur)) - fx) * 0.18;
    figur.gruppe.scale.setScalar(rutscht ? 0.92 : 1);

    const takt = laufzeit * 13;
    const schwung = inDerLuft ? 0 : Math.sin(takt) * 0.95;
    figur.beinL.rotation.x = inDerLuft ? -0.5 : schwung;
    figur.beinR.rotation.x = inDerLuft ? 0.3 : -schwung;
    figur.armL.rotation.x = inDerLuft ? -2.2 : -schwung * 0.85;
    figur.armR.rotation.x = inDerLuft ? -2.2 : schwung * 0.85;

    schatten.position.set(fx, 0.03, 0);
    const hoch = Math.min(1, lauf.y / 2.2);
    const sk = 1 - hoch * 0.5;
    schatten.scale.set(sk, sk * 1.3, 1);
    schattenStoff.opacity = 1 - hoch * 0.65;

    // --- Kamera ---
    // Folgt gedämpft zur Seite; hart mitzuziehen wirkt hektisch, gar nicht
    // mitzuziehen unbeteiligt.
    kamera.position.x += (fx * 0.5 - kamera.position.x) * Math.min(1, dt * 6);
    kamera.position.y = KAMERA_Y + lauf.y * 0.22;
    kamera.lookAt(fx * 0.32, KAMERA_ZIEL_Y + lauf.y * 0.28, 18);

    renderer.render(szene, kamera);
  };

  const groesseAendern = (breite: number, hoehe: number) => {
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
    renderer.setSize(breite, hoehe, false);
  };

  const aufraeumen = () => {
    // Alles freigeben. Ohne das bleibt bei jedem „Nochmal" ein kompletter
    // Satz Geometrien und Texturen im Grafikspeicher liegen — auf einem
    // iPad ist das nach ein paar Runden das Ende.
    szene.traverse((teil) => {
      const netz = teil as THREE.Mesh;
      if (netz.geometry) netz.geometry.dispose();
      const material = netz.material;
      const freigeben = (m: THREE.Material) => {
        const mitBild = m as THREE.Material & { map?: THREE.Texture | null };
        mitBild.map?.dispose();
        m.dispose();
      };
      if (Array.isArray(material)) material.forEach(freigeben);
      else if (material) freigeben(material as THREE.Material);
    });
    himmel.dispose();
    /*
     * **`dispose()` allein gibt den WebGL-Kontext nicht frei.** Es räumt nur
     * die Puffer der Bibliothek ab; der Zeichenkontext der Leinwand bleibt
     * am Leben, bis der Browser ihn irgendwann selbst einsammelt — und
     * Safari lässt sich damit sehr viel Zeit.
     *
     * Jedes „Nochmal" mountet das Spiel neu und legt einen neuen Kontext an.
     * Browser erlauben aber nur eine feste Zahl gleichzeitig (Safari und
     * Chrome je nach Fassung acht bis sechzehn). Ist sie erreicht, wirft
     * `new WebGLRenderer()` — und man landet in der Fehlermeldung „Der 3-D-
     * Teil lässt sich hier nicht starten", obwohl mit dem Gerät alles in
     * Ordnung ist. Genau das ist passiert: erst lief es, nach etlichen
     * Runden nicht mehr.
     *
     * `forceContextLoss()` gibt den Kontext **sofort** zurück.
     */
    renderer.forceContextLoss();
    renderer.dispose();
  };

  return { zeichnen, groesseAendern, aufraeumen };
}

/** Nur fürs Vorschaubild im Startbildschirm gebraucht. */
export const SICHTWEITE_METER = SICHTWEITE;
export const FIGUR_HOEHE = HOEHE_STEHEND;
export const ABSCHNITT = ABSCHNITT_LAENGE;
