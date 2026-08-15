import * as THREE from 'three';
import { ABSCHNITT_LAENGE, HOEHE_STEHEND, SPUR_BREITE, spurX } from './logik';
import type { Lauf } from './logik';

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
 * Sparsamkeit ist hier kein Selbstzweck: Zielgerät ist ein altes iPad.
 * Deshalb durchgehend geteilte Geometrien und Werkstoffe, ein Vorrat an
 * wiederverwendeten Körpern statt ständigem Neuanlegen, `MeshLambertMaterial`
 * statt physikalischer Werkstoffe und **keine** echten Schatten.
 */

/** Wie weit man nach vorn sieht. Dahinter macht der Nebel zu. */
const SICHTWEITE = 95;

/** So viele Hindernisse und Münzen hält der Vorrat bereit. */
const VORRAT_HINDERNISSE = 26;
const VORRAT_MUENZEN = 60;
const VORRAT_HAEUSER = 28;

const FARBEN = {
  himmel: 0x1a1a3e,
  nebel: 0x2a2a5a,
  strasse: 0x2f3542,
  streifen: 0xf7d774,
  figur: 0x38bdf8,
  haut: 0xfcd5b0,
  huerde: 0xf97316,
  balken: 0xef4444,
  mauer: 0x94a3b8,
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
 * fremde Dateien auskommen. Aus Kugeln, Kapseln und Kästen lässt sich eine
 * Figur bauen, die auf Handygröße rund und freundlich wirkt — und sie
 * kostet ein paar hundert Dreiecke statt zehntausender.
 */
function figurBauen(): { gruppe: THREE.Group; armL: THREE.Object3D; armR: THREE.Object3D; beinL: THREE.Object3D; beinR: THREE.Object3D } {
  const gruppe = new THREE.Group();

  const stoffKoerper = new THREE.MeshLambertMaterial({ color: FARBEN.figur });
  const stoffHaut = new THREE.MeshLambertMaterial({ color: FARBEN.haut });
  const stoffHose = new THREE.MeshLambertMaterial({ color: 0x1e40af });
  const stoffSchuh = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

  // Rumpf — eine Kapsel wirkt weicher als ein Kasten.
  const rumpf = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 4, 10), stoffKoerper);
  rumpf.position.y = 1.05;
  gruppe.add(rumpf);

  // Kopf mit Mütze — die Mütze gibt der Silhouette von hinten eine Kante,
  // sonst ist der Kopf nur ein Ball.
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), stoffHaut);
  kopf.position.y = 1.62;
  gruppe.add(kopf);

  const muetze = new THREE.Mesh(
    new THREE.SphereGeometry(0.275, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xf43f5e }),
  );
  muetze.position.y = 1.64;
  gruppe.add(muetze);
  const schirm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.22), muetze.material);
  schirm.position.set(0, 1.62, -0.24);
  gruppe.add(schirm);

  // Arme und Beine hängen an eigenen Drehpunkten, damit sich das Pendeln
  // über eine einzige Drehung je Glied machen lässt.
  const armGeo = new THREE.CapsuleGeometry(0.085, 0.34, 3, 8);
  const beinGeo = new THREE.CapsuleGeometry(0.105, 0.4, 3, 8);
  const schuhGeo = new THREE.BoxGeometry(0.2, 0.11, 0.3);

  const glied = (geo: THREE.BufferGeometry, stoff: THREE.Material, x: number, y: number, laenge: number) => {
    const drehpunkt = new THREE.Object3D();
    drehpunkt.position.set(x, y, 0);
    const teil = new THREE.Mesh(geo, stoff);
    teil.position.y = -laenge / 2;
    drehpunkt.add(teil);
    gruppe.add(drehpunkt);
    return { drehpunkt, teil };
  };

  const armL = glied(armGeo, stoffHaut, -0.36, 1.28, 0.5).drehpunkt;
  const armR = glied(armGeo, stoffHaut, 0.36, 1.28, 0.5).drehpunkt;

  const linkesBein = glied(beinGeo, stoffHose, -0.16, 0.72, 0.6);
  const rechtesBein = glied(beinGeo, stoffHose, 0.16, 0.72, 0.6);
  for (const bein of [linkesBein, rechtesBein]) {
    const schuh = new THREE.Mesh(schuhGeo, stoffSchuh);
    schuh.position.set(0, -0.62, -0.04);
    bein.drehpunkt.add(schuh);
  }

  return { gruppe, armL, armR, beinL: linkesBein.drehpunkt, beinR: rechtesBein.drehpunkt };
}

export function szeneBauen(leinwand: HTMLCanvasElement): Szene {
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand,
    // Kantenglättung kostet auf alter Hardware spürbar; die Formen sind
    // groß und farbig, das verzeiht sie.
    antialias: false,
    powerPreference: 'low-power',
  });
  // Auf 1,5 gedeckelt: Ein iPad meldet 2, und die vierfache Bildpunktzahl
  // ist genau die Stelle, an der solche Spiele auf alter Hardware einbrechen.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const szene = new THREE.Scene();
  szene.background = new THREE.Color(FARBEN.himmel);
  // Der Nebel versteckt die Stelle, an der die Welt aufhört — ohne ihn
  // sieht man Häuser aus dem Nichts auftauchen.
  szene.fog = new THREE.Fog(FARBEN.nebel, 24, SICHTWEITE);

  const kamera = new THREE.PerspectiveCamera(62, 1, 0.1, SICHTWEITE + 20);
  // Etwas weiter zurück und höher als der erste Versuch: Der klebte der
  // Figur im Nacken, sie nahm das untere Drittel ein und man sah kaum
  // Straße voraus. Bei einem Läufer ist die Sichtweite nach vorn aber
  // gleichbedeutend mit Reaktionszeit — das ist kein Geschmack, sondern
  // Spielbarkeit.
  kamera.position.set(0, 3.9, -7.6);
  kamera.lookAt(0, 1.2, 8);

  // Licht: ein weiches Grundlicht plus eine Sonne von schräg vorn. Keine
  // Schattenwürfe — die kosten auf altem Gerät am meisten und bringen bei
  // dieser Kameraführung am wenigsten.
  szene.add(new THREE.HemisphereLight(0xbcd4ff, 0x30304a, 1.5));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
  sonne.position.set(-4, 10, -6);
  szene.add(sonne);

  // ---------------------------------------------------------------
  // Straße
  // ---------------------------------------------------------------
  const strassenBreite = SPUR_BREITE * 3 + 1.2;
  const strasse = new THREE.Mesh(
    new THREE.PlaneGeometry(strassenBreite, SICHTWEITE * 2),
    new THREE.MeshLambertMaterial({ color: FARBEN.strasse }),
  );
  strasse.rotation.x = -Math.PI / 2;
  strasse.position.z = SICHTWEITE / 2;
  szene.add(strasse);

  // Zwei Spurtrennlinien, gestrichelt über wandernde Einzelstriche.
  const striche: THREE.Mesh[] = [];
  const strichGeo = new THREE.PlaneGeometry(0.12, 1.8);
  const strichStoff = new THREE.MeshBasicMaterial({ color: FARBEN.streifen });
  for (let seite = -1; seite <= 1; seite += 2) {
    for (let i = 0; i < 26; i++) {
      const strich = new THREE.Mesh(strichGeo, strichStoff);
      strich.rotation.x = -Math.PI / 2;
      strich.position.set((seite * SPUR_BREITE) / 2, 0.011, i * 3.6);
      szene.add(strich);
      striche.push(strich);
    }
  }

  // Bordsteine links und rechts — sie geben der Straße eine Kante und damit
  // dem Auge einen Anhaltspunkt fürs Tempo.
  for (const seite of [-1, 1]) {
    const bord = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.34, SICHTWEITE * 2),
      new THREE.MeshLambertMaterial({ color: 0x475569 }),
    );
    bord.position.set((seite * (strassenBreite + 0.6)) / 2, 0.17, SICHTWEITE / 2);
    szene.add(bord);
  }

  // ---------------------------------------------------------------
  // Häuser — die Stadt drumherum
  // ---------------------------------------------------------------
  const hausGeo = new THREE.BoxGeometry(1, 1, 1);
  const hausStoffe = [0x334155, 0x3f3f5f, 0x2c3a52, 0x453a5a].map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const haeuser: THREE.Mesh[] = [];
  for (let i = 0; i < VORRAT_HAEUSER; i++) {
    const haus = new THREE.Mesh(hausGeo, hausStoffe[i % hausStoffe.length]!);
    szene.add(haus);
    haeuser.push(haus);
  }
  /** Setzt ein Haus an seinen Platz — Höhe und Tiefe aus dem Index, nicht zufällig. */
  const hausSetzen = (haus: THREE.Mesh, index: number, versatz: number) => {
    const seite = index % 2 === 0 ? -1 : 1;
    const reihe = Math.floor(index / 2);
    const hoehe = 6 + ((reihe * 37) % 17);
    const tiefe = 5 + ((reihe * 23) % 6);
    haus.scale.set(4.5, hoehe, tiefe);
    haus.position.set(seite * (strassenBreite / 2 + 3.6), hoehe / 2, versatz);
  };

  // ---------------------------------------------------------------
  // Hindernisse und Münzen — fester Vorrat, wird umgesetzt statt neu gebaut
  // ---------------------------------------------------------------
  const huerdeGeo = new THREE.BoxGeometry(SPUR_BREITE * 0.8, 0.5, 0.5);
  const balkenGeo = new THREE.BoxGeometry(SPUR_BREITE * 0.85, 0.5, 0.5);
  const mauerGeo = new THREE.BoxGeometry(SPUR_BREITE * 0.85, 2.4, 0.5);
  const stoffe = {
    huerde: new THREE.MeshLambertMaterial({ color: FARBEN.huerde }),
    balken: new THREE.MeshLambertMaterial({ color: FARBEN.balken }),
    mauer: new THREE.MeshLambertMaterial({ color: FARBEN.mauer }),
  };

  const hindernisse = Array.from({ length: VORRAT_HINDERNISSE }, () => {
    const gruppe = new THREE.Group();
    const huerde = new THREE.Mesh(huerdeGeo, stoffe.huerde);
    huerde.position.y = 0.25;
    const balken = new THREE.Mesh(balkenGeo, stoffe.balken);
    balken.position.y = 1.35;
    const mauer = new THREE.Mesh(mauerGeo, stoffe.mauer);
    mauer.position.y = 1.2;
    gruppe.add(huerde, balken, mauer);
    gruppe.visible = false;
    szene.add(gruppe);
    return { gruppe, huerde, balken, mauer };
  });

  const muenzGeo = new THREE.TorusGeometry(0.28, 0.09, 8, 14);
  const muenzStoff = new THREE.MeshLambertMaterial({ color: FARBEN.muenze, emissive: 0x5a4a00 });
  const muenzen = Array.from({ length: VORRAT_MUENZEN }, () => {
    const m = new THREE.Mesh(muenzGeo, muenzStoff);
    m.visible = false;
    szene.add(m);
    return m;
  });

  // ---------------------------------------------------------------
  // Die Figur
  // ---------------------------------------------------------------
  const figur = figurBauen();
  szene.add(figur.gruppe);

  // Ein dunkler Fleck unter der Figur ersetzt den echten Schatten. Er
  // schrumpft beim Springen — daran sieht man die Höhe, was aus dieser
  // Kameraperspektive sonst schwer zu schätzen ist.
  const schatten = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
  );
  schatten.rotation.x = -Math.PI / 2;
  schatten.position.y = 0.02;
  szene.add(schatten);

  let laufzeit = 0;

  const zeichnen = (lauf: Lauf, dt: number) => {
    laufzeit += dt;

    // Die Welt bewegt sich, die Figur bleibt vorn — so muss nichts
    // umgerechnet werden, wenn die Strecke ins Endlose wächst.
    const s = lauf.strecke;

    // Straßenstriche laufen mit und werden vorn wieder angehängt.
    const strichAbstand = 3.6;
    striche.forEach((strich, i) => {
      const reihe = Math.floor(i / 2);
      const z = ((reihe * strichAbstand - s) % (13 * strichAbstand) + 13 * strichAbstand) %
        (13 * strichAbstand);
      strich.position.z = z;
    });

    haeuser.forEach((haus, i) => {
      const reihe = Math.floor(i / 2);
      const abstand = 11;
      const z = ((reihe * abstand - s) % (14 * abstand) + 14 * abstand) % (14 * abstand);
      hausSetzen(haus, i, z);
    });

    // Sichtbare Hindernisse auf den Vorrat verteilen.
    let nummer = 0;
    for (const h of lauf.hindernisse) {
      const dz = h.z - s;
      if (dz < -4 || dz > SICHTWEITE) continue;
      const koerper = hindernisse[nummer];
      if (!koerper) break;
      nummer += 1;
      koerper.gruppe.visible = true;
      koerper.gruppe.position.set(spurX(h.spur), 0, dz);
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
      koerper.position.set(spurX(m.spur), m.y, dz);
      koerper.rotation.y = laufzeit * 3;
    }
    for (let i = muenzNummer; i < muenzen.length; i++) muenzen[i]!.visible = false;

    // Die Figur.
    const rutscht = lauf.rutschRest > 0;
    figur.gruppe.position.set(lauf.x, lauf.y, 0);
    // Beim Rutschen legt sie sich flach und wird kleiner — die Kopfhöhe aus
    // der Logik wird hier sichtbar gemacht, nicht neu erfunden.
    figur.gruppe.rotation.x = rutscht ? -1.15 : 0;
    figur.gruppe.scale.setScalar(rutscht ? 0.92 : 1);

    // Laufbewegung: Arme und Beine pendeln gegenläufig. In der Luft
    // ausgestreckt statt weiterlaufen — sonst strampelt die Figur im Sprung.
    const inDerLuft = lauf.y > 0.05;
    const takt = laufzeit * 13;
    const schwung = inDerLuft ? 0 : Math.sin(takt) * 0.9;
    figur.beinL.rotation.x = inDerLuft ? -0.5 : schwung;
    figur.beinR.rotation.x = inDerLuft ? 0.3 : -schwung;
    figur.armL.rotation.x = inDerLuft ? -2.2 : -schwung * 0.8;
    figur.armR.rotation.x = inDerLuft ? -2.2 : schwung * 0.8;

    schatten.position.set(lauf.x, 0.02, 0);
    const hoch = Math.min(1, lauf.y / 2.2);
    schatten.scale.setScalar(1 - hoch * 0.55);
    (schatten.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - hoch * 0.6);

    // Die Kamera folgt der Figur seitlich, aber gedämpft — hart mitzuziehen
    // wirkt hektisch, gar nicht mitzuziehen unbeteiligt.
    kamera.position.x += (lauf.x * 0.55 - kamera.position.x) * Math.min(1, dt * 6);
    kamera.position.y = 3.9 + lauf.y * 0.25;
    kamera.lookAt(lauf.x * 0.35, 1.2 + lauf.y * 0.3, 8);

    renderer.render(szene, kamera);
  };

  const groesseAendern = (breite: number, hoehe: number) => {
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
    renderer.setSize(breite, hoehe, false);
  };

  const aufraeumen = () => {
    // Alles freigeben. Ohne das bleibt bei jedem „Nochmal" ein kompletter
    // Satz Geometrien im Grafikspeicher liegen — auf einem iPad ist das
    // nach ein paar Runden das Ende.
    szene.traverse((teil) => {
      const netz = teil as THREE.Mesh;
      if (netz.geometry) netz.geometry.dispose();
      const stoff = netz.material;
      if (Array.isArray(stoff)) stoff.forEach((m) => m.dispose());
      else if (stoff) (stoff as THREE.Material).dispose();
    });
    renderer.dispose();
  };

  return { zeichnen, groesseAendern, aufraeumen };
}

/** Nur fürs Vorschaubild im Startbildschirm gebraucht. */
export const SICHTWEITE_METER = SICHTWEITE;
export const FIGUR_HOEHE = HOEHE_STEHEND;
export const ABSCHNITT = ABSCHNITT_LAENGE;
