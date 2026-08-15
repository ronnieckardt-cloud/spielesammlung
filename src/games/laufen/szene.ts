import * as THREE from 'three';
import { ABSCHNITT_LAENGE, HOEHE_STEHEND, SPUR_BREITE, spurX } from './logik';
import type { Lauf } from './logik';
import {
  gehwegTextur,
  hauswandTextur,
  himmelTextur,
  schattenTextur,
  strassenTextur,
  warnTextur,
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
const SICHTWEITE = 100;

/** So viele Hindernisse, Münzen und Häuser hält der Vorrat bereit. */
const VORRAT_HINDERNISSE = 26;
const VORRAT_MUENZEN = 60;
const VORRAT_HAEUSER = 30;

const FARBEN = {
  dunst: 0xbfe3f4,
  figur: 0x22d3ee,
  haut: 0xf6c9a0,
  hose: 0x1d4ed8,
  huerde: '#f97316',
  balken: 0xdc2626,
  mauer: 0xe4572e,
  muenze: 0xfacc15,
} as const;

export type Szene = {
  /** Einmal je Bild aufrufen. */
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
  aufraeumen: () => void;
};

/**
 * Baut die Läuferfigur aus Grundkörpern.
 *
 * Bewusst keine geladene Figurdatei: Die App muss offline laufen und ohne
 * fremde Dateien auskommen.
 *
 * Alle Teile **überlappen** sich. Das ist bei Grundkörpern ohne Skelett das
 * einzige Mittel gegen den Eindruck „zusammengesteckt": Wo zwei Kugeln sich
 * schneiden, sieht das Auge eine durchgehende Form. Schultern, Schulter-
 * balken, Hals, Becken, Gelenkkugeln und Hände sind genau deshalb da.
 */
function figurBauen(): {
  gruppe: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  beinL: THREE.Object3D;
  beinR: THREE.Object3D;
} {
  const gruppe = new THREE.Group();

  // Phong statt Lambert: Ein leichter Glanz macht aus einer flachen Fläche
  // eine gewölbte. Bei einer Figur aus lauter Kugeln ist das der ganze
  // Unterschied zwischen „Spielfigur aus Kunststoff" und „Pappe".
  const stoff = (farbe: number, glanz = 18) =>
    new THREE.MeshPhongMaterial({ color: farbe, shininess: glanz, specular: 0x222222 });

  const stoffKoerper = stoff(FARBEN.figur, 26);
  const stoffHaut = stoff(FARBEN.haut, 8);
  const stoffHose = stoff(FARBEN.hose, 14);
  const stoffSchuh = stoff(0xf8fafc, 40);
  const stoffMuetze = stoff(0xf43f5e, 22);

  const SCHULTER_Y = 1.3;
  const SCHULTER_X = 0.27;
  const HUEFT_Y = 0.82;

  const becken = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.14, 4, 12), stoffHose);
  becken.rotation.z = Math.PI / 2;
  becken.position.y = HUEFT_Y;
  gruppe.add(becken);

  const rumpf = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.4, 6, 14), stoffKoerper);
  rumpf.position.y = 1.06;
  gruppe.add(rumpf);

  const schulterbalken = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 5, 12), stoffKoerper);
  schulterbalken.rotation.z = Math.PI / 2;
  schulterbalken.position.y = SCHULTER_Y;
  gruppe.add(schulterbalken);

  const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 12), stoffHaut);
  hals.position.y = 1.44;
  gruppe.add(hals);

  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 16), stoffHaut);
  kopf.position.y = 1.64;
  gruppe.add(kopf);

  const muetze = new THREE.Mesh(
    new THREE.SphereGeometry(0.262, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1),
    stoffMuetze,
  );
  muetze.position.y = 1.645;
  gruppe.add(muetze);
  const schirm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.2), stoffMuetze);
  schirm.position.set(0, 1.63, -0.22);
  gruppe.add(schirm);

  const armGeo = new THREE.CapsuleGeometry(0.095, 0.32, 4, 12);
  const beinGeo = new THREE.CapsuleGeometry(0.115, 0.38, 4, 12);
  const handGeo = new THREE.SphereGeometry(0.1, 12, 10);
  const schuhGeo = new THREE.BoxGeometry(0.21, 0.12, 0.32);
  const gelenkGeo = new THREE.SphereGeometry(0.145, 12, 10);

  const glied = (
    geometrie: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    laenge: number,
    gelenkStoff: THREE.Material,
  ) => {
    const drehpunkt = new THREE.Object3D();
    drehpunkt.position.set(x, y, 0);
    drehpunkt.add(new THREE.Mesh(gelenkGeo, gelenkStoff));
    const teil = new THREE.Mesh(geometrie, material);
    teil.position.y = -laenge / 2 + 0.04;
    drehpunkt.add(teil);
    gruppe.add(drehpunkt);
    return drehpunkt;
  };

  const armL = glied(armGeo, stoffHaut, -SCHULTER_X, SCHULTER_Y, 0.5, stoffKoerper);
  const armR = glied(armGeo, stoffHaut, SCHULTER_X, SCHULTER_Y, 0.5, stoffKoerper);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(handGeo, stoffHaut);
    hand.position.y = -0.46;
    arm.add(hand);
  }

  const beinL = glied(beinGeo, stoffHose, -0.15, HUEFT_Y, 0.6, stoffHose);
  const beinR = glied(beinGeo, stoffHose, 0.15, HUEFT_Y, 0.6, stoffHose);
  for (const bein of [beinL, beinR]) {
    const schuh = new THREE.Mesh(schuhGeo, stoffSchuh);
    schuh.position.set(0, -0.66, -0.03);
    bein.add(schuh);
  }

  return { gruppe, armL, armR, beinL, beinR };
}

export function szeneBauen(leinwand: HTMLCanvasElement): Szene {
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand,
    // Kantenglättung jetzt an: Die Szene besteht aus wenigen großen Flächen,
    // und gerade die langen schrägen Kanten von Straße und Häusern flimmern
    // ohne sie sichtbar. Der Preis ist bei so wenigen Dreiecken vertretbar,
    // zumal die Bildpunktzahl unten gedeckelt bleibt.
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  // Filmische Tonwertkurve: Ohne sie brennen die hellen Flächen (Himmel,
  // Gehweg) aus und die Farben wirken flach.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const szene = new THREE.Scene();
  const himmel = himmelTextur();
  szene.background = himmel;
  // Der Dunst versteckt die Stelle, an der die Welt aufhört, und ist auf den
  // hellen Horizont abgestimmt — sonst sieht man den Übergang.
  szene.fog = new THREE.Fog(FARBEN.dunst, 55, SICHTWEITE);

  const KAMERA_Y = 3.9;
  const KAMERA_Z = -7.6;
  const kamera = new THREE.PerspectiveCamera(62, 1, 0.1, SICHTWEITE + 30);
  kamera.position.set(0, KAMERA_Y, KAMERA_Z);
  kamera.lookAt(0, 1.2, 8);

  szene.add(new THREE.HemisphereLight(0xffffff, 0x8fa6b8, 2.0));
  const sonne = new THREE.DirectionalLight(0xfff3dd, 2.0);
  sonne.position.set(-6, 12, -4);
  szene.add(sonne);
  // Ein schwaches Gegenlicht von vorn setzt die Silhouette der Figur vom
  // Hintergrund ab — sie ist das Einzige, was man dauernd ansieht.
  const gegenlicht = new THREE.DirectionalLight(0xbfe3f4, 0.7);
  gegenlicht.position.set(3, 4, 14);
  szene.add(gegenlicht);

  // ---------------------------------------------------------------
  // Straße und Gehwege
  // ---------------------------------------------------------------
  const strassenBreite = SPUR_BREITE * 3 + 1.4;
  const STRASSE_LAENGE = SICHTWEITE * 2;
  /** Wie viele Meter eine Wiederholung der Straßentextur abdeckt. */
  const STRASSE_TAKT = STRASSE_LAENGE / 8;

  const spurAnteile = [
    0.5 - SPUR_BREITE / 2 / strassenBreite,
    0.5 + SPUR_BREITE / 2 / strassenBreite,
  ];
  const strassenBild = strassenTextur(spurAnteile);
  const strasse = new THREE.Mesh(
    new THREE.PlaneGeometry(strassenBreite, STRASSE_LAENGE),
    new THREE.MeshPhongMaterial({ map: strassenBild, shininess: 6, specular: 0x111111 }),
  );
  strasse.rotation.x = -Math.PI / 2;
  strasse.position.z = STRASSE_LAENGE / 2 - 12;
  szene.add(strasse);

  const gehwegBild = gehwegTextur();
  for (const seite of [-1, 1]) {
    const gehweg = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.34, STRASSE_LAENGE),
      new THREE.MeshPhongMaterial({ map: gehwegBild, shininess: 4 }),
    );
    gehweg.position.set(seite * (strassenBreite / 2 + 1.7), 0.17, STRASSE_LAENGE / 2 - 12);
    szene.add(gehweg);
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
   * sie an einem 28 Meter hohen Haus zu Streifen ziehen.
   */
  const hausFarben: readonly (readonly [string, string])[] = [
    ['#98a3ae', '#ffe9a8'],
    ['#7e8b98', '#cfeaff'],
    ['#b3b9c1', '#ffe9a8'],
    ['#6f7a86', '#bfe3f4'],
    ['#a9a196', '#ffe9a8'],
    ['#8695a2', '#cfeaff'],
  ];
  const hausStoffe = hausFarben.flatMap(([grund, fenster]) =>
    [2, 3, 5].map((dichte) => {
      const bild = hauswandTextur(grund, fenster);
      bild.repeat.set(1, dichte);
      return new THREE.MeshPhongMaterial({ map: bild, shininess: 12, specular: 0x1a1a1a });
    }),
  );

  const haeuser: THREE.Mesh[] = [];
  for (let i = 0; i < VORRAT_HAEUSER; i++) {
    const haus = new THREE.Mesh(hausGeo, hausStoffe[0]);
    szene.add(haus);
    haeuser.push(haus);
  }
  const hausSetzen = (haus: THREE.Mesh, index: number, versatz: number) => {
    const seite = index % 2 === 0 ? -1 : 1;
    const reihe = Math.floor(index / 2);
    const hoehe = 8 + ((reihe * 37) % 21);
    const tiefe = 6 + ((reihe * 23) % 7);
    const stufe = hoehe < 14 ? 0 : hoehe < 21 ? 1 : 2;
    haus.material = hausStoffe[((reihe * 5) % hausFarben.length) * 3 + stufe]!;
    haus.scale.set(5.2, hoehe, tiefe);
    haus.position.set(seite * (strassenBreite / 2 + 6.2), hoehe / 2, versatz);
  };

  // ---------------------------------------------------------------
  // Hindernisse
  // ---------------------------------------------------------------
  const warnBild = warnTextur(FARBEN.huerde);
  const stoffe = {
    huerde: new THREE.MeshPhongMaterial({ map: warnBild, shininess: 24 }),
    balken: new THREE.MeshPhongMaterial({ color: FARBEN.balken, shininess: 30 }),
    mauer: new THREE.MeshPhongMaterial({ color: FARBEN.mauer, shininess: 20 }),
    dunkel: new THREE.MeshPhongMaterial({ color: 0x3d4450, shininess: 40 }),
  };

  const breit = SPUR_BREITE * 0.86;
  const geo = {
    huerdeBrett: new THREE.BoxGeometry(breit, 0.3, 0.18),
    huerdeBein: new THREE.BoxGeometry(0.12, 0.44, 0.12),
    schild: new THREE.BoxGeometry(breit, 0.62, 0.18),
    pfosten: new THREE.BoxGeometry(0.13, 2.4, 0.13),
    querbalken: new THREE.BoxGeometry(breit + 0.4, 0.2, 0.2),
    container: new THREE.BoxGeometry(breit, 2.3, 0.8),
    band: new THREE.BoxGeometry(breit + 0.05, 0.14, 0.84),
    rippe: new THREE.BoxGeometry(0.1, 2.2, 0.86),
  };

  /*
   * Jedes Hindernis sagt über seine **Form**, was zu tun ist — nicht über
   * die Farbe. Wer die Bedeutung erst aus der Farbe erschließen muss,
   * erschließt sie bei Tempo 20 zu spät.
   */
  const hindernisse = Array.from({ length: VORRAT_HINDERNISSE }, () => {
    const gruppe = new THREE.Group();

    // Hürde: Absperrung mit Warnstreifen und Standbeinen — niedrig, drüber.
    const huerde = new THREE.Group();
    const brett = new THREE.Mesh(geo.huerdeBrett, stoffe.huerde);
    brett.position.y = 0.42;
    huerde.add(brett);
    for (const seite of [-1, 1]) {
      const bein = new THREE.Mesh(geo.huerdeBein, stoffe.dunkel);
      bein.position.set(seite * (breit / 2 - 0.08), 0.22, 0);
      huerde.add(bein);
    }
    gruppe.add(huerde);

    // Balken: Schild an zwei Pfosten, unten offen — drunter durch.
    const balken = new THREE.Group();
    const schild = new THREE.Mesh(geo.schild, stoffe.balken);
    schild.position.y = 1.62;
    balken.add(schild);
    const quer = new THREE.Mesh(geo.querbalken, stoffe.dunkel);
    quer.position.y = 2.02;
    balken.add(quer);
    for (const seite of [-1, 1]) {
      const pfosten = new THREE.Mesh(geo.pfosten, stoffe.dunkel);
      pfosten.position.set(seite * (breit / 2 + 0.14), 1.2, 0);
      balken.add(pfosten);
    }
    gruppe.add(balken);

    // Mauer: geschlossener Container mit Rippen — dicht, ausweichen.
    const mauer = new THREE.Group();
    const kasten = new THREE.Mesh(geo.container, stoffe.mauer);
    kasten.position.y = 1.15;
    mauer.add(kasten);
    for (const y of [0.28, 2.02]) {
      const band = new THREE.Mesh(geo.band, stoffe.dunkel);
      band.position.y = y;
      mauer.add(band);
    }
    for (const x of [-0.62, -0.21, 0.21, 0.62]) {
      const rippe = new THREE.Mesh(geo.rippe, stoffe.dunkel);
      rippe.position.set(x, 1.15, 0);
      mauer.add(rippe);
    }
    gruppe.add(mauer);

    gruppe.visible = false;
    szene.add(gruppe);
    return { gruppe, huerde, balken, mauer };
  });

  // ---------------------------------------------------------------
  // Münzen
  // ---------------------------------------------------------------
  const muenzGeo = new THREE.TorusGeometry(0.29, 0.1, 10, 18);
  const muenzStoff = new THREE.MeshPhongMaterial({
    color: FARBEN.muenze,
    // Etwas Eigenleuchten: Münzen sollen auch im Schatten der Häuser
    // auffallen — sie sind die einzige Belohnung im Bild.
    emissive: 0x6b5200,
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
  // Figur und Schatten
  // ---------------------------------------------------------------
  const figur = figurBauen();
  szene.add(figur.gruppe);

  const schattenStoff = new THREE.MeshBasicMaterial({
    map: schattenTextur(),
    transparent: true,
    depthWrite: false,
  });
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), schattenStoff);
  schatten.rotation.x = -Math.PI / 2;
  schatten.position.y = 0.02;
  szene.add(schatten);

  let laufzeit = 0;

  const zeichnen = (lauf: Lauf, dt: number) => {
    laufzeit += dt;
    const s = lauf.strecke;

    /*
     * Straße und Gehweg ziehen über die **Texturverschiebung** vorbei, nicht
     * über bewegte Körper. Vorher waren die Fahrbahnstreifen 52 einzelne
     * Meshes, die jedes Bild einzeln umgesetzt wurden — jetzt ist es eine
     * einzige Zahl. Minuszeichen, weil ein wachsender Versatz das Muster
     * sonst von uns weg schöbe statt auf uns zu.
     */
    strassenBild.offset.y = -s / STRASSE_TAKT;
    gehwegBild.offset.y = -s / 3.2;

    haeuser.forEach((haus, i) => {
      const reihe = Math.floor(i / 2);
      const abstand = 12;
      const runde = 15 * abstand;
      const z = (((reihe * abstand - s) % runde) + runde) % runde;
      hausSetzen(haus, i, z);
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

    schatten.position.set(fx, 0.02, 0);
    const hoch = Math.min(1, lauf.y / 2.2);
    schatten.scale.setScalar(1 - hoch * 0.5);
    schattenStoff.opacity = 1 - hoch * 0.65;

    // --- Kamera ---
    // Folgt gedämpft zur Seite; hart mitzuziehen wirkt hektisch, gar nicht
    // mitzuziehen unbeteiligt.
    kamera.position.x += (fx * 0.5 - kamera.position.x) * Math.min(1, dt * 6);
    kamera.position.y = KAMERA_Y + lauf.y * 0.25;
    kamera.lookAt(fx * 0.32, 1.25 + lauf.y * 0.3, 8);

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
    renderer.dispose();
  };

  return { zeichnen, groesseAendern, aufraeumen };
}

/** Nur fürs Vorschaubild im Startbildschirm gebraucht. */
export const SICHTWEITE_METER = SICHTWEITE;
export const FIGUR_HOEHE = HOEHE_STEHEND;
export const ABSCHNITT = ABSCHNITT_LAENGE;
