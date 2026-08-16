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

/**
 * Wie lange der Aufprall dauert, in Sekunden.
 *
 * `DashCity.tsx` holt sich den Wert von hier und wartet genau so lange, bevor
 * es `onGameOver` meldet — **eine** Zahl für Bild und Ablauf. Zwei getrennte
 * Zahlen wären die Sorte Fehler, die niemand bemerkt: Der Sturz liefe noch,
 * während der Rundenende-Bildschirm schon darüberliegt.
 *
 * Vorher wurde die Zeit gar nicht genutzt: Es gab einen Ton, danach stand
 * 700 ms lang ein Standbild, in dem die Figur mitten im Laufschritt im
 * Hindernis steckte. Ein Zusammenstoß ohne Bild liest sich wie ein Fehler des
 * Spiels, nicht wie ein eigener.
 */
export const AUFPRALL_DAUER = 0.7;

/**
 * So viele Hindernisse hält der Vorrat bereit — und **achtzehn reichen
 * beweisbar.**
 *
 * Gezeichnet wird alles zwischen `dz = −4` und der Sichtweite (110 m), das
 * ist ein Fenster von 114 m. Hindernisse stehen nur an Abschnittsgrenzen,
 * also alle 14 m — in 114 m liegen davon höchstens neun. Und je Abschnitt
 * gibt es höchstens zwei (`abschnittErzeugen` belegt eine oder zwei Spuren,
 * nie drei). Neun mal zwei sind achtzehn.
 *
 * Vorher standen hier 26. Jeder Vorratsplatz hält alle drei Bauarten
 * gleichzeitig bereit (Hürde, Balken, Mauer à fünf Körper) — acht Plätze zu
 * viel waren also 120 Netze, die in jedem Bild durch die Matrixrechnung
 * liefen und nie zu sehen waren.
 */
const VORRAT_HINDERNISSE = 18;
const VORRAT_MUENZEN = 48;
/**
 * Höchstens ein Schub je Abschnitt (siehe `SCHUB_CHANCE` in `logik.ts`),
 * im selben 114-m-Fenster wie die Hindernisse also höchstens neun
 * gleichzeitig sichtbare — zehn mit etwas Luft an der Fenstergrenze.
 */
const VORRAT_SCHUEBE = 10;
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
} as const;

export type Szene = {
  /** Einmal je Bild aufrufen. */
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
  aufraeumen: () => void;
};

type Figur = {
  gruppe: THREE.Group;
  /** Rumpf, Kopf und Arme — dreht sich beim Laufen gegen die Hüfte. */
  oberkoerper: THREE.Object3D;
  /** Drehpunkte an Schulter und Hüfte — schwingen den ganzen Arm/das Bein. */
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  beinL: THREE.Object3D;
  beinR: THREE.Object3D;
  /** Drehpunkte an Ellbogen und Knie — beugen nur den Unterarm/-schenkel. */
  ellbogenL: THREE.Object3D;
  ellbogenR: THREE.Object3D;
  knieL: THREE.Object3D;
  knieR: THREE.Object3D;
};

/**
 * Baut die Läuferfigur aus Grundkörpern.
 *
 * Bewusst keine geladene Figurdatei: Die App muss offline laufen und ohne
 * fremde Dateien auskommen.
 *
 * **Warum die Figur Ellbogen und Knie hat.** Rückmeldung: „Mach das
 * Männchen realistischer, das soll aussehen wie bei Subway Surfers." Der
 * Unterschied zwischen deren Läufern und einer Steckfigur liegt kaum in der
 * Detailmenge, sondern darin, dass die Gliedmaßen **Gelenke** haben: Ein
 * Läufer mit durchgestreckten Armen und Beinen liest sich als Marionette,
 * egal wie fein die Einzelkörper sind. Arme und Beine sind deshalb
 * zweiteilig — ein Drehpunkt an Schulter/Hüfte wie bisher, ein zweiter an
 * Ellbogen/Knie. Die Ellbogen bleiben beim Laufen dauerhaft angewinkelt
 * (das tut jeder echte Läufer), die Knie beugen sich im Schritttakt: Die
 * Ferse schlägt nach dem Abstoß hinten aus. Dazu lange Hosenbeine bis zum
 * Schuh, klobigere Turnschuhe mit runder Kappe, ein leicht vergrößerter
 * Kopf und ein Rumpf, der oben breiter ist als unten — die Proportionen
 * der Vorlage, ohne deren Figuren zu kopieren.
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
 *
 * **Der Oberkörper ist eine eigene Gruppe, gegen die Hüfte verdrehbar.**
 * Rückmeldung: „das Laufen noch realistischer machen." Bis hierhin liefen
 * nur die Gliedmaßen — Rumpf und Kopf standen kerzengerade fest, während
 * Arme und Beine pendelten. Genau das fehlende Stück macht einen echten
 * Laufstil aus: Schultern und Becken verdrehen sich gegenläufig
 * zueinander (Rumpfrotation), und der Körper lehnt sich leicht in die
 * Laufrichtung. Rumpf, Kopf, Rucksack und beide Arme hängen deshalb an
 * `oberkoerper`, einer eigenen Gruppe **innerhalb** von `gruppe` — nur die
 * Hüfte (der schmale Ring, an dem die Beine sitzen) bleibt außerhalb, sie
 * ist der ruhende Bezugspunkt, gegen den der Oberkörper sich dreht.
 */
function figurBauen(): Figur {
  const gruppe = new THREE.Group();
  const oberkoerper = new THREE.Group();
  gruppe.add(oberkoerper);

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
  /*
   * Der Armansatz wanderte zweimal: Beim breiten Rumpf standen die Arme
   * bei 0,285 als Stummel ab, also enger auf 0,25. Nach dem Verschlanken
   * des Rumpfes steckten sie bei 0,25 dann **im** Körper — Rückmeldung:
   * „Die Arme sind ja sozusagen im Körper." Der richtige Wert hängt an
   * der Rumpfbreite, nicht an sich: Schulterkugel (r 0,125) plus
   * Brustradius (0,235) minus gewollte Überlappung ergibt 0,29.
   */
  const SCHULTER_X = 0.29;
  const HUEFT_Y = 0.7;

  /*
   * --- Rumpf, Hüfte, Schultern ---
   *
   * **Schmal in der Taille, breit an den Schultern.** Die Fassung davor
   * hatte einen Rumpf von 0,54 m Durchmesser bei 1,9 m Körpergröße —
   * Rückmeldung: „Der Oberkörper sieht aus wie ein Bierfass." Die Breite
   * gehört in die Schultern (die Armansätze außen bei ±0,375), nicht in
   * den Bauch; erst dieses Verhältnis liest sich als sportliche Figur.
   */
  const rumpf = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.2, 0.52, 20), mShirt);
  rumpf.position.y = 1.0;
  oberkoerper.add(rumpf);

  const brust = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 12), mShirt);
  brust.position.y = 1.26;
  brust.scale.y = 0.75;
  oberkoerper.add(brust);

  // Die Hüfte bleibt **außerhalb** von `oberkoerper` — sie ist der ruhende
  // Bezugspunkt, an dem die Beine hängen. Würde sie mitdrehen, entstünde
  // beim Rumpf-Twist ein sichtbarer Spalt zur Hose der Beine, die selbst
  // nicht mitdrehen.
  const huefte = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.24, 18), mHose);
  huefte.position.y = 0.73;
  gruppe.add(huefte);

  // Lang genug, um bis in die Schulterkugeln hineinzureichen (halbe
  // Spannweite 0,29 = Armansatz), aber **dünn** — er deutet die Schulter-
  // linie nur an. Ein dicker Balken machte die Schultern wulstig:
  // Rückmeldung „viel zu dick".
  const schulterbalken = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.35, 5, 14), mShirt);
  schulterbalken.rotation.z = Math.PI / 2;
  schulterbalken.position.y = SCHULTER_Y;
  oberkoerper.add(schulterbalken);

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
  // Schmaler als der alte (0,3 statt 0,34) — auf dem verschlankten Rumpf
  // stünde der breite Kasten seitlich über und machte die Silhouette
  // wieder zum Fass, das gerade abgeschafft wurde.
  const rucksack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.18), mTasche);
  rucksack.position.set(0, 0.99, -0.27);
  oberkoerper.add(rucksack);
  // Gewölbter Deckel — die eine Rundung, die den Kasten zum Rucksack macht.
  const deckel = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mTasche);
  deckel.position.set(0, 1.16, -0.27);
  deckel.scale.set(0.92, 0.62, 0.56);
  oberkoerper.add(deckel);
  const spanner = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.055, 0.195), mRucksack);
  spanner.position.set(0, 1.03, -0.27);
  oberkoerper.add(spanner);
  const schnalle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.03), mRucksack);
  schnalle.position.set(0, 0.89, -0.37);
  oberkoerper.add(schnalle);
  for (const seite of [-1, 1]) {
    const gurt = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.05), mTasche);
    gurt.position.set(seite * 0.11, 1.06, -0.22);
    oberkoerper.add(gurt);
  }

  // --- Hals und Kopf ---
  const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.14, 14), mHaut);
  hals.position.y = 1.3;
  oberkoerper.add(hals);

  // Etwas größer als anatomisch richtig (0,26 statt 0,24) — der leicht
  // vergrößerte Kopf ist der halbe Comic-Eindruck der Vorlage.
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), mHaut);
  kopf.position.y = 1.5;
  oberkoerper.add(kopf);

  /*
   * Das Haar am Hinterkopf — von hinten sieht man sonst nur eine nackte
   * Kugel.
   *
   * **Als Schale auf dem Kopf, nicht als Ballen darin.** Der erste Versuch
   * war ein plattgedrücktes Ei knapp unter der Kopfoberfläche. Rechnerisch
   * lag es innen — aber nur zwei Millimeter, und eine Kugel aus zwanzig
   * Segmenten liegt an ihrer breitesten Stelle rund drei Millimeter *innen*
   * vor der echten Kugelfläche. Also stieß das Haar an zwei Stellen durch
   * den Kopf und sah aus wie aufgemalte Augenbrauen.
   *
   * **Die Schale ist groß und beginnt direkt unterm Mützenrand.** Die
   * Fassung davor war ein kleiner Fleck tief im Nacken — Rückmeldung: „Die
   * Haare fangen erst ganz unten an, das sieht nicht realistisch aus."
   * Zwischen Mütze und Haaransatz blitzte ein breiter Streifen nackter
   * Kopf hervor. Jetzt deckt die Kappe (Öffnungswinkel 1,05 statt 0,62)
   * den ganzen Hinterkopf von der Mützenkante bis zum Nacken ab; wo sie
   * unter die Mütze reicht, verschwindet sie einfach darunter.
   */
  const haar = new THREE.Mesh(
    new THREE.SphereGeometry(0.266, 18, 12, 0, Math.PI * 2, 0, 1.05),
    mHaar,
  );
  haar.position.y = 1.5;
  haar.rotation.x = -1.85;
  oberkoerper.add(haar);

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
    new THREE.SphereGeometry(0.272, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.85),
    new THREE.MeshPhongMaterial({
      color: FARBEN.shirtDunkel,
      shininess: 22,
      specular: 0x2a2a2a,
      side: THREE.DoubleSide,
    }),
  );
  muetze.position.y = 1.5;
  oberkoerper.add(muetze);
  // Der Schirm zeigt nach **vorn** (+z). Vorher stand er auf −z, also im
  // Nacken — eine Mütze verkehrt herum.
  const schirm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.18), mShirtDunkel);
  schirm.position.set(0, 1.483, 0.215);
  oberkoerper.add(schirm);

  /*
   * --- Gliedmaßen, zweiteilig ---
   *
   * Jeder Arm: Schulter-Drehpunkt → Ärmel + Oberarm → Ellbogen-Drehpunkt →
   * Unterarm + Hand. Jedes Bein: Hüft-Drehpunkt → Oberschenkel → Knie-
   * Drehpunkt → Unterschenkel + Schuh. Die Gelenkkugeln füllen die Lücke,
   * die beim Beugen zwischen den beiden Segmenten aufginge — dieselbe
   * Überlappungsregel wie überall an dieser Figur.
   *
   * Die Hose reicht bis zum Schuh (vorher endete sie am Knie und darunter
   * kam Haut): lange Hosen und klobige weiße Turnschuhe sind die
   * Silhouette der Vorlage.
   */
  /*
   * **Keine Stockarme.** Rückmeldung auf die erste Gelenk-Fassung: „keine
   * Stockarme, perfekte Grafik." Die Segmente sind deshalb bewusst dicker
   * als anatomisch richtig — Oberarm fast so dick wie der Ärmel, Hände und
   * Schuhe eine Nummer zu groß. Genau diese Übertreibung ist es, die die
   * Vorlage „gut gezeichnet" aussehen lässt; maßstabsgetreue dünne Arme
   * lesen sich aus zwei Metern Kameraabstand als Striche.
   */
  // Getrennte Gelenkgrößen: Die Schulterkugel war mit 0,125 zu wuchtig
  // („Schultern viel zu dick") — 0,105 reicht, um die Lücke zum Ärmel zu
  // schließen, ohne selbst als Wulst aufzufallen.
  const schulterKugelGeo = new THREE.SphereGeometry(0.105, 12, 10);
  const hueftKugelGeo = new THREE.SphereGeometry(0.105, 12, 10);
  const aermelGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.18, 14);
  const oberarmGeo = new THREE.CapsuleGeometry(0.078, 0.1, 4, 12);
  const ellbogenGeo = new THREE.SphereGeometry(0.08, 10, 8);
  const unterarmGeo = new THREE.CapsuleGeometry(0.072, 0.12, 4, 12);
  /*
   * **Eine ordentliche Hand statt einer Kugel am Handgelenk.** Rückmeldung:
   * „kannst Du auch ordentliche Hände dranmachen?" Eine reine Kugel liest
   * sich als Murmel, an der der Arm zufällig endet — keine echten Finger
   * (zu viele Dreiecke für eine Figur aus Grundkörpern), aber eine leicht
   * gestauchte Faustform plus ein kleiner Daumen brechen die Kugel-
   * Silhouette und machen daraus erkennbar eine Hand, kein Anhängsel.
   */
  const handGeo = new THREE.SphereGeometry(0.095, 12, 10);
  const daumenGeo = new THREE.SphereGeometry(0.034, 8, 6);
  const oberschenkelGeo = new THREE.CylinderGeometry(0.118, 0.1, 0.28, 14);
  const knieGeo = new THREE.SphereGeometry(0.1, 12, 10);
  const unterschenkelGeo = new THREE.CylinderGeometry(0.098, 0.082, 0.16, 14);
  /*
   * **Der Schuh ist eine gestauchte Kugel, kein Kasten.** Zwei Anläufe
   * davor: erst ein schmaler Kasten (verschwand hinterm Hosenbein, man sah
   * nur Sohlen), dann ein breiter Kasten — Rückmeldung: „Die Schuhe sind
   * viel zu breit, und das sind nur Platten. Es sollen Schuhe sein."
   * Kästen lesen sich immer als Platten, egal in welcher Breite. Ein
   * Ellipsoid hat die runde Kappe und den gewölbten Spann von selbst, und
   * die Sohle bleibt **schmaler** als der Schuhkörper, damit sie unter ihm
   * verschwindet, statt als Brett darunter hervorzustehen.
   */
  const schuhGeo = new THREE.SphereGeometry(0.11, 16, 12);
  const sohleGeo = new THREE.BoxGeometry(0.16, 0.045, 0.3);

  const arm = (seite: number) => {
    const schulter = new THREE.Object3D();
    schulter.position.set(seite * SCHULTER_X, SCHULTER_Y, 0);
    // Nur noch leicht zum Körper geneigt — beim schlanken Rumpf sitzt der
    // Ansatz schon dicht genug, mehr Neigung drückte die Hand in die Hüfte.
    schulter.rotation.z = -seite * 0.07;
    schulter.add(new THREE.Mesh(schulterKugelGeo, mShirt));
    const aermel = new THREE.Mesh(aermelGeo, mShirt);
    aermel.position.y = -0.09;
    schulter.add(aermel);
    const oberarm = new THREE.Mesh(oberarmGeo, mHaut);
    oberarm.position.y = -0.2;
    schulter.add(oberarm);
    const ellbogen = new THREE.Object3D();
    ellbogen.position.y = -0.27;
    schulter.add(ellbogen);
    ellbogen.add(new THREE.Mesh(ellbogenGeo, mHaut));
    const unterarm = new THREE.Mesh(unterarmGeo, mHaut);
    unterarm.position.y = -0.1;
    ellbogen.add(unterarm);
    // Leicht gestaucht wie eine lockere Faust, nicht rund wie ein Ball.
    const hand = new THREE.Mesh(handGeo, mHaut);
    hand.scale.set(0.88, 0.8, 1.05);
    hand.position.y = -0.22;
    ellbogen.add(hand);
    // Der Daumen sitzt seitlich **auf der Dreh-Achse** des Ellbogens (x),
    // nicht in Lauf- oder Höhenrichtung — nur so bleibt er an derselben
    // Stelle der Hand sichtbar, ganz gleich, wie weit der Arm gerade
    // ein- oder ausschwingt. `-seite`, weil der Daumen nach innen zeigt,
    // zum Körper hin, wie bei einer echten hängenden Hand.
    const daumen = new THREE.Mesh(daumenGeo, mHaut);
    daumen.position.set(-seite * 0.075, -0.185, 0.025);
    ellbogen.add(daumen);
    oberkoerper.add(schulter);
    return { schulter, ellbogen };
  };

  const bein = (seite: number) => {
    const hueftpunkt = new THREE.Object3D();
    // ±0,105 statt ±0,125: Bei den alten Werten sprangen die Hosenbeine
    // seitlich über die Hüfte hinaus — „da ist ein richtiger Absatz,
    // wenn's zu den Beinen geht". Ansatz plus Schenkelradius (0,105 +
    // 0,118) liegt jetzt bündig an der Hüftbreite (0,2).
    hueftpunkt.position.set(seite * 0.105, HUEFT_Y, 0);
    hueftpunkt.add(new THREE.Mesh(hueftKugelGeo, mHose));
    const oberschenkel = new THREE.Mesh(oberschenkelGeo, mHose);
    oberschenkel.position.y = -0.16;
    hueftpunkt.add(oberschenkel);
    const knie = new THREE.Object3D();
    knie.position.y = -0.33;
    hueftpunkt.add(knie);
    knie.add(new THREE.Mesh(knieGeo, mHose));
    const unterschenkel = new THREE.Mesh(unterschenkelGeo, mHose);
    unterschenkel.position.y = -0.09;
    knie.add(unterschenkel);
    // Der Schuhkörper: nach vorn gestreckt, leicht plattgedrückt — die
    // Rundung von Kappe und Spann kommt aus der Kugelform selbst.
    const schuh = new THREE.Mesh(schuhGeo, mSchuh);
    schuh.scale.set(0.82, 0.62, 1.5);
    schuh.position.set(0, -0.26, 0.05);
    knie.add(schuh);
    const sohle = new THREE.Mesh(sohleGeo, mSohle);
    sohle.position.set(0, -0.325, 0.05);
    knie.add(sohle);
    gruppe.add(hueftpunkt);
    return { hueftpunkt, knie };
  };

  const armLinks = arm(-1);
  const armRechts = arm(1);
  const beinLinks = bein(-1);
  const beinRechts = bein(1);

  return {
    gruppe,
    oberkoerper,
    armL: armLinks.schulter,
    armR: armRechts.schulter,
    ellbogenL: armLinks.ellbogen,
    ellbogenR: armRechts.ellbogen,
    beinL: beinLinks.hueftpunkt,
    beinR: beinRechts.hueftpunkt,
    knieL: beinLinks.knie,
    knieR: beinRechts.knie,
  };
}

/**
 * Baut die Szene auf einer Leinwand auf.
 *
 * `ruhig` ist `settings.reducedMotion` aus der Hülle. Es betrifft **nur den
 * Aufprall**: Kein Rütteln der Kamera, kein roter Blitz über dem Bild. Das
 * Kippen der Figur bleibt auch dann — es ist keine Verzierung, sondern die
 * Auskunft darüber, was gerade passiert ist. Der Lauf selbst wird nicht
 * beruhigt: Ein Endlosläufer ohne Bewegung wäre kein Spiel mehr.
 */
export function szeneBauen(leinwand: HTMLCanvasElement, ruhig = false): Szene {
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
  /*
   * **Je Farbpaar wird genau ein Bild gezeichnet, die Dichtestufen sind
   * Klone davon.** Vorher entstanden achtzehn Texturen — drei je Farbpaar,
   * und die drei waren bildgleich: `hauswandTextur` hängt nur von den beiden
   * Farben ab, die Körnung kommt aus einer festen Saat. Unterschiedlich ist
   * allein `repeat`, und genau das ist die eine Eigenschaft, die ein Klon
   * für sich hat — Bild und Grafikspeicher teilt er sich mit dem Original.
   * Gespart sind damit zwölf Mal 4200 Körnungsrechtecke auf 256×256 beim
   * Aufbau und zwölf Texturen im Grafikspeicher.
   */
  const hausBilder = hausFarben.map(([grund, fenster]) => hauswandTextur(grund, fenster));
  const hausStoffe = hausBilder.flatMap((bild) =>
    [2, 3, 5].map((dichte, i) => {
      const eigenes = i === 0 ? bild : bild.clone();
      eigenes.repeat.set(1, dichte);
      return new THREE.MeshPhongMaterial({ map: eigenes, shininess: 14, specular: 0x1c1c1c });
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
  /*
   * **Ein Werkstoff, nicht drei.** Vorher bekam jede Münze ein Feld aus drei
   * Materialien (Rand, Deckel, Boden). Ein Zylinder hat genau diese drei
   * Materialgruppen, und three.js setzt daraus je Netz **drei** getrennte
   * Zeichenaufrufe ab — bei 48 gleichzeitig sichtbaren Münzen also 144 statt
   * 48, mehr als für Häuser, Bäume und Laternen zusammen. Mit einem einzigen
   * Werkstoff wird das Netz als **ein** Eintrag in die Zeichenliste gestellt,
   * ganz gleich wie viele Gruppen die Geometrie mitbringt.
   *
   * Optisch kostet das nichts: Der Mantel ist sieben Millimeter breit und
   * greift den dunklen Außenrand derselben Prägung ab — im Bild ein bis zwei
   * Bildpunkte, und die in genau dem Goldton, den er vorher als eigene Farbe
   * hatte.
   */
  const muenzStoff = new THREE.MeshPhongMaterial({
    map: muenzBild,
    emissive: 0x4a3800,
    shininess: 90,
    specular: 0xfff3c4,
  });
  const muenzen = Array.from({ length: VORRAT_MUENZEN }, () => {
    const m = new THREE.Mesh(muenzGeo, muenzStoff);
    m.visible = false;
    szene.add(m);
    return m;
  });

  // ---------------------------------------------------------------
  // Schübe — Turbo und Sprungschub
  // ---------------------------------------------------------------
  /*
   * Zwei eigene Formen statt zweier Farben derselben Form: Bei Tempo 20
   * bleibt keine Zeit, eine Beschriftung zu lesen — die Silhouette muss
   * allein sagen, was man da einsammelt. Turbo ist ein Pfeil (spitz, nach
   * vorn gerichtet — „schneller"), Sprungschub ein Diamant (nach oben
   * gestreckt — „höher"). Jeder Vorratsplatz trägt beide Formen und
   * zeigt per Sichtbarkeit nur die passende, genau wie bei den
   * Hindernissen mit ihren drei Bauarten.
   */
  const schubTurboGeo = new THREE.ConeGeometry(0.22, 0.5, 5);
  const schubSprungGeo = new THREE.OctahedronGeometry(0.28);
  const schubTurboStoff = new THREE.MeshPhongMaterial({
    color: 0xfbbf24,
    emissive: 0x7c4a03,
    shininess: 70,
    specular: 0xfff3c4,
  });
  const schubSprungStoff = new THREE.MeshPhongMaterial({
    color: 0x2dd4bf,
    emissive: 0x0a4f47,
    shininess: 70,
    specular: 0xd1fef7,
  });
  const schuebe = Array.from({ length: VORRAT_SCHUEBE }, () => {
    const gruppe = new THREE.Group();
    const turbo = new THREE.Mesh(schubTurboGeo, schubTurboStoff);
    turbo.rotation.x = Math.PI / 2; // Spitze zeigt nach vorn (+z), nicht nach oben.
    gruppe.add(turbo);
    const sprung = new THREE.Mesh(schubSprungGeo, schubSprungStoff);
    gruppe.add(sprung);
    gruppe.visible = false;
    szene.add(gruppe);
    return { gruppe, turbo, sprung };
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

  /*
   * Ein Ring am Boden je Wirkung — dieselbe Farbe wie das eingesammelte
   * Extra, damit die Verbindung „das habe ich eingesammelt, das wirkt
   * gerade" ohne Text ankommt. Beide gleichzeitig sichtbar, wenn beide
   * Wirkungen gleichzeitig laufen; der Sprungring ist größer, damit sie
   * ineinander verschachtelt stehen statt sich zu überdecken.
   */
  const wirkungsRingGeo = new THREE.TorusGeometry(0.55, 0.045, 8, 24);
  const turboRing = new THREE.Mesh(
    wirkungsRingGeo,
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 }),
  );
  turboRing.rotation.x = -Math.PI / 2;
  turboRing.visible = false;
  szene.add(turboRing);
  const sprungRing = new THREE.Mesh(
    wirkungsRingGeo,
    new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.85 }),
  );
  sprungRing.rotation.x = -Math.PI / 2;
  sprungRing.visible = false;
  szene.add(sprungRing);

  let laufzeit = 0;
  /**
   * Wie `laufzeit`, treibt aber nur den Laufschritt (Hüpfer, Bein- und
   * Armtakt) — mit Turbo läuft sie schneller als die Uhr, damit die Beine
   * sichtbar schneller pumpen. Eine eigene Uhr statt `laufzeit * Faktor`
   * an der Verwendungsstelle: Ein Sprung im *Faktor* risse den Schritt
   * mitten in der Bewegung um, ein Sprung in der *Geschwindigkeit* nicht —
   * die Phase läuft weiter, sie beschleunigt nur.
   */
  let schrittZeit = 0;
  /** Sekunden seit dem Zusammenstoß. Läuft erst, wenn `lauf.vorbei` gilt. */
  let aufprall = 0;
  /**
   * Die zuletzt gezeichnete Laufhaltung.
   *
   * Der Sturz mischt von hier aus in die Sturzhaltung. Ohne diesen Merker
   * begänne er bei null, und die Figur stünde ein Bild lang stramm, bevor
   * sie kippt — am deutlichsten beim Rutschen, wo sie von −1,15 auf 0
   * hochschnellte und erst dann fiel.
   */
  const letzte = {
    drehX: 0,
    drehZ: 0,
    groesse: 1,
    armL: 0,
    armR: 0,
    ellbogenL: -1.2,
    ellbogenR: -1.2,
    beinL: 0,
    beinR: 0,
    knieL: 0.12,
    knieR: 0.12,
  };
  /**
   * Die seitliche Kameraposition **ohne** den Aufprallstoß.
   *
   * Der Stoß darf nicht in `kamera.position.x` hineingerechnet werden: Dort
   * steht ein gedämpfter Nachlauf, der seinen eigenen letzten Wert
   * weiterverwendet — der Ruckler bliebe darin hängen und zöge sich zäh
   * wieder heraus, statt kurz und hart zu sein.
   */
  let kameraX = 0;

  /** Ringförmig weiterrücken: was hinten rausläuft, kommt vorn wieder rein. */
  const ringZ = (reihe: number, abstand: number, anzahl: number, s: number, schub: number) => {
    const runde = anzahl * abstand;
    return (((reihe * abstand + schub - s) % runde) + runde) % runde;
  };

  const zeichnen = (lauf: Lauf, dt: number) => {
    /*
     * Zwei getrennte Uhren, und das ist der Kern des Aufpralls: `laufzeit`
     * treibt Laufschritt, Münzdrehung und Hüpfer — nach dem Zusammenstoß
     * muss sie **stehen**, sonst zappelt die Figur im Hindernis weiter, als
     * wäre nichts gewesen. `aufprall` läuft erst danach los und treibt
     * ausschließlich den Sturz.
     */
    if (lauf.vorbei) aufprall = Math.min(AUFPRALL_DAUER, aufprall + dt);
    else {
      laufzeit += dt;
      // Mit Turbo pumpen die Beine sichtbar schneller — nicht so schnell
      // wie das Tempo selbst wächst (`TURBO_FAKTOR`), das sähe wie
      // Zeitraffer statt wie Anstrengung aus.
      schrittZeit += dt * (lauf.turboRest > 0 ? 1.35 : 1);
    }
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

    let schubNummer = 0;
    for (const sch of lauf.schuebe) {
      const dz = sch.z - s;
      if (dz < -2 || dz > SICHTWEITE * 0.6) continue;
      const koerper = schuebe[schubNummer];
      if (!koerper) break;
      schubNummer += 1;
      koerper.gruppe.visible = true;
      // Deutlicheres Schweben als bei Münzen (0,16 statt 0,09 m Amplitude)
      // — ein Schub ist die Ausnahme auf der Strecke und darf auffallen.
      koerper.gruppe.position.set(
        bildX(spurX(sch.spur)),
        1.05 + Math.sin(laufzeit * 2.6 + sch.z) * 0.16,
        dz,
      );
      koerper.gruppe.rotation.y = laufzeit * 2.4;
      koerper.turbo.visible = sch.art === 'turbo';
      koerper.sprung.visible = sch.art === 'sprung';
    }
    for (let i = schubNummer; i < schuebe.length; i++) schuebe[i]!.gruppe.visible = false;

    // --- Die Figur ---
    const rutscht = lauf.rutschRest > 0;
    const inDerLuft = lauf.y > 0.05;
    const fx = bildX(lauf.x);

    // Ein leichtes Auf und Ab beim Laufen. Ohne das gleitet die Figur, statt
    // zu rennen — der Boden zieht zwar vorbei, aber der Körper bleibt starr.
    const huepfer = inDerLuft || rutscht ? 0 : Math.abs(Math.sin(schrittZeit * 13)) * 0.06;
    /** Tiefe der Figur — beim Sturz rutscht sie zur Kamera hin. */
    let figurZ = 0;
    /** Höhe der Figur. Beim Sturz sinkt sie auf den Boden, siehe unten. */
    let figurY = lauf.y;

    if (lauf.vorbei) {
      /*
       * **Der Sturz.** Vorher passierte hier gar nichts: Es gab einen Ton,
       * danach stand 700 ms lang ein Standbild, in dem die Figur mitten im
       * Laufschritt im Hindernis steckte. Ein Zusammenstoß ohne Bild liest
       * sich wie ein Fehler des Spiels — man sieht nicht, dass man
       * angestoßen ist, sondern nur, dass es plötzlich aufhört.
       *
       * Die Figur wird nach hinten geworfen, also zur Kamera hin: Sie läuft
       * in +z, dort steht das Hindernis, und eine **negative** Drehung um x
       * kippt den Kopf nach −z. Dazu ein kurzer Aufwärtsschlenker (die
       * Sinuskurve), der oben umkehrt — sonst sackt sie einfach in sich
       * zusammen, statt wegzuprallen.
       */
      const p = aufprall / AUFPRALL_DAUER;
      // Schnell losstoßen, weich auslaufen. Ein linearer Sturz sieht aus wie
      // eine Tür, die zufällt.
      const weich = 1 - (1 - p) * (1 - p);
      figurZ = -0.65 * weich;

      /**
       * Mischt vom **letzten Laufbild** zum Sturzbild.
       *
       * Ohne das sprang die Figur im ersten Bild des Aufpralls in die
       * Neutralhaltung: Dort ist `weich` noch 0, und alles wurde mit 0
       * multipliziert. Wer im Laufschritt starb, dessen Beine schnellten
       * von ±0,95 auf 0; wer im Rutschen in eine Hürde fiel, dessen Figur
       * schnellte von −1,15 auf 0 und von Maßstab 0,92 auf 1 — und **dann**
       * erst begann der Sturz. Ein Bild lang stand die Figur stramm.
       */
      const von = (anfang: number, ziel: number) => anfang + (ziel - anfang) * weich;
      /*
       * Der Aufsatz von 0,22 m ist kein Geschmack: Gedreht wird um die Füße,
       * und wenn die Figur waagerecht liegt, liegt damit ihre **Achse** auf
       * der Fahrbahn — der halbe Rumpf steckte im Asphalt. Angehoben liegt
       * sie auf der Straße statt darin.
       */
      /*
       * **Die Figur kommt herunter.** `takt` friert bei `vorbei` den ganzen
       * Lauf ein, also auch `lauf.y`. Wer im Sprung erwischt wurde — eine
       * Mauer trifft immer, ein Balken, solange der Kopf über 1,1 m ist —,
       * kippte deshalb **in der Luft** nach hinten und schwebte dort die
       * vollen 700 ms, während der Bodenschatten klein und blass darunter
       * stehen blieb. Genau das Bild, gegen das der Sturz angetreten ist,
       * nur eine Etage höher. Über `weich` sinkt sie jetzt auf den Boden.
       */
      figurY = von(lauf.y, 0) + Math.sin(Math.PI * p) * 0.3 + 0.22 * weich;
      figur.gruppe.position.set(fx, figurY, figurZ);
      figur.gruppe.rotation.x = von(letzte.drehX, -1.5);
      figur.gruppe.rotation.z = von(letzte.drehZ, 0.55);
      figur.gruppe.scale.setScalar(von(letzte.groesse, 1));
      // Arme und Beine fahren aus dem Laufschritt in eine Sturzhaltung —
      // stehen bleiben mitten im Schritt sähe nach eingefrorenem Bild aus.
      // Ellbogen strecken sich dabei fast (ausgeschlagene Arme), die Knie
      // bleiben ungleich gebeugt — symmetrisch hingefallen sieht gestellt aus.
      figur.armL.rotation.x = von(letzte.armL, -2.4);
      figur.armR.rotation.x = von(letzte.armR, -1.9);
      figur.ellbogenL.rotation.x = von(letzte.ellbogenL, -0.3);
      figur.ellbogenR.rotation.x = von(letzte.ellbogenR, -0.5);
      figur.beinL.rotation.x = von(letzte.beinL, 0.95);
      figur.beinR.rotation.x = von(letzte.beinR, 0.4);
      figur.knieL.rotation.x = von(letzte.knieL, 1.1);
      figur.knieR.rotation.x = von(letzte.knieR, 0.5);
    } else {
      figurY = lauf.y + huepfer;
      figur.gruppe.position.set(fx, figurY, figurZ);
      // Leichte Vorlehnung beim Laufen und Springen — kein Läufer steht
      // beim Rennen kerzengerade. Positive Drehung um x kippt den Kopf
      // nach **+z**, also in die Laufrichtung (siehe Sturz weiter oben,
      // wo die entgegengesetzte, negative Drehung genau umgekehrt wirkt).
      figur.gruppe.rotation.x = rutscht ? -1.15 : 0.07;
      // Leichte Neigung in die Bewegungsrichtung beim Spurwechsel.
      figur.gruppe.rotation.z = rutscht ? 0 : (bildX(spurX(lauf.zielSpur)) - fx) * 0.18;
      figur.gruppe.scale.setScalar(rutscht ? 0.92 : 1);

      const takt = schrittZeit * 13;
      const schwung = inDerLuft || rutscht ? 0 : Math.sin(takt) * 0.95;
      /*
       * Die Kniebeugung im Lauftakt. `takt − 0,55` legt die stärkste
       * Beugung kurz **hinter** den hintersten Punkt des Beinschwungs —
       * die Ferse schlägt nach dem Abstoß hinten aus, wie bei einem
       * echten Läufer. `max(0, …)`, weil ein Knie nur in eine Richtung
       * beugt; die Grundbeugung von 0,12 hält es auch in der Gegenphase
       * minimal gebeugt, ganz durchgestreckt sähe es überstreckt aus.
       */
      const knieTakt = (versatz: number) => 0.12 + Math.max(0, Math.sin(takt + versatz)) * 1.3;
      if (rutscht) {
        // Rutschhaltung: Beine voraus, Arme nach hinten abgestützt.
        // Vorher ruderten die Gliedmaßen im Lauftakt weiter, während der
        // Körper längst lag.
        figur.beinL.rotation.x = -0.6;
        figur.beinR.rotation.x = -0.45;
        figur.knieL.rotation.x = 0.5;
        figur.knieR.rotation.x = 0.7;
        figur.armL.rotation.x = -1.5;
        figur.armR.rotation.x = -1.2;
        figur.ellbogenL.rotation.x = -0.35;
        figur.ellbogenR.rotation.x = -0.5;
        figur.oberkoerper.rotation.y = 0;
      } else if (inDerLuft) {
        // Sprung: das vordere Bein angezogen, das hintere fast gestreckt,
        // Arme hoch — die Silhouette eines Hürdenläufers.
        figur.beinL.rotation.x = -0.55;
        figur.beinR.rotation.x = 0.35;
        figur.knieL.rotation.x = 1.7;
        figur.knieR.rotation.x = 0.5;
        figur.armL.rotation.x = -2.2;
        figur.armR.rotation.x = -2.2;
        figur.ellbogenL.rotation.x = -0.3;
        figur.ellbogenR.rotation.x = -0.3;
        figur.oberkoerper.rotation.y = 0;
      } else {
        figur.beinL.rotation.x = schwung;
        figur.beinR.rotation.x = -schwung;
        figur.knieL.rotation.x = knieTakt(-0.55);
        figur.knieR.rotation.x = knieTakt(Math.PI - 0.55);
        figur.armL.rotation.x = -schwung * 0.85;
        figur.armR.rotation.x = schwung * 0.85;
        /*
         * Der Ellbogen schwingt spürbar mit, statt fast starr zu bleiben.
         * Rückmeldung: „nicht die ganze Zeit mit eingewinkelten [Armen] —
         * ein bisschen realistischer." Vorher war der Ausschlag nur 0,18
         * (rund 10°) um eine feste Grundbeugung — bei jeder Bildrate praktisch
         * ein eingefrorener Winkel, keine Bewegung, die man sieht. Jetzt
         * öffnet sich der Arm im Rückschwung sichtbar und schließt sich
         * wieder, wenn die Hand nach vorn kommt — derselbe Rhythmus wie das
         * Bein auf derselben Seite, nur am Ellbogen statt am Knie.
         */
        figur.ellbogenL.rotation.x = -1.15 + schwung * 0.6;
        figur.ellbogenR.rotation.x = -1.15 - schwung * 0.6;
        /*
         * **Der Rumpf verdreht sich gegen die Hüfte.** Rückmeldung: „das
         * Laufen noch realistischer machen." Bis hierhin liefen nur die
         * Gliedmaßen — Rumpf und Kopf standen fest, obwohl sich Arme und
         * Beine drehten. Ein echter Läufer dreht Schultern und Becken
         * gegenläufig zueinander (Rumpfrotation); die Hüfte selbst bleibt
         * in dieser Figur unbewegt (siehe `figurBauen`), also dreht sich
         * der Oberkörper im selben Takt wie der Armschwung — bewusst
         * knapp bemessen (0,1 rad ≈ 6°), eine übertriebene Drehung sähe
         * nach Tanzschritt aus, nicht nach Laufen.
         */
        figur.oberkoerper.rotation.y = schwung * 0.1;
      }

      // Das zuletzt gezeichnete Laufbild merken — der Sturz oben mischt von
      // hier aus los, statt aus dem Nichts.
      letzte.drehX = figur.gruppe.rotation.x;
      letzte.drehZ = figur.gruppe.rotation.z;
      letzte.groesse = figur.gruppe.scale.x;
      letzte.armL = figur.armL.rotation.x;
      letzte.armR = figur.armR.rotation.x;
      letzte.ellbogenL = figur.ellbogenL.rotation.x;
      letzte.ellbogenR = figur.ellbogenR.rotation.x;
      letzte.beinL = figur.beinL.rotation.x;
      letzte.beinR = figur.beinR.rotation.x;
      letzte.knieL = figur.knieL.rotation.x;
      letzte.knieR = figur.knieR.rotation.x;
    }

    // Der Fleck bleibt unter der Figur, auch wenn sie beim Sturz nach hinten
    // rutscht — ein Schatten, der stehen bleibt, verrät sich sofort.
    schatten.position.set(fx, 0.03, figurZ);
    // `figurY` statt `lauf.y`: Beim Sturz sinkt die Figur, und der Schatten
    // muss mitwachsen. An der eingefrorenen Sprunghöhe wäre er klein und
    // blass geblieben, während die Figur längst am Boden liegt.
    const hoch = Math.min(1, figurY / 2.2);
    const sk = 1 - hoch * 0.5;
    schatten.scale.set(sk, sk * 1.3, 1);
    schattenStoff.opacity = 1 - hoch * 0.65;

    // Die Wirkungsringe — leichtes Pulsieren statt starrer Größe, sonst
    // wirken sie wie aufgemalt statt wie eine aktive Kraft.
    turboRing.visible = lauf.turboRest > 0 && !lauf.vorbei;
    if (turboRing.visible) {
      const puls = 1 + Math.sin(laufzeit * 11) * 0.08;
      turboRing.position.set(fx, 0.05, figurZ);
      turboRing.scale.set(puls, puls, 1);
    }
    sprungRing.visible = lauf.sprungRest > 0 && !lauf.vorbei;
    if (sprungRing.visible) {
      const puls = 1.35 + Math.sin(laufzeit * 8 + 1) * 0.08;
      sprungRing.position.set(fx, 0.05, figurZ);
      sprungRing.scale.set(puls, puls, 1);
    }

    // --- Kamera ---
    // Folgt gedämpft zur Seite; hart mitzuziehen wirkt hektisch, gar nicht
    // mitzuziehen unbeteiligt.
    kameraX += (fx * 0.5 - kameraX) * Math.min(1, dt * 6);
    let kx = kameraX;
    let ky = KAMERA_Y + lauf.y * 0.22;
    if (lauf.vorbei && !ruhig) {
      /*
       * Der Kamerastoß. Er klingt in der ersten Hälfte des Aufpralls ab, ist
       * also vorbei, bevor der Rundenende-Bildschirm kommt — ein Wackeln,
       * das noch läuft, während man schon lesen soll, ist nur ärgerlich.
       *
       * Bei „weniger Bewegung" bleibt die Kamera ruhig; das Kippen der Figur
       * sagt auch ohne sie, was passiert ist. Deshalb ist der Stoß hier
       * abschaltbar und der Sturz nicht.
       */
      const staerke = 0.2 * Math.max(0, 1 - aufprall / (AUFPRALL_DAUER * 0.5));
      kx += Math.sin(aufprall * 74) * staerke;
      ky += Math.cos(aufprall * 63) * staerke * 0.7;
    }
    kamera.position.set(kx, ky, KAMERA_Z);
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
