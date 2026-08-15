import * as THREE from 'three';
import { FIGUR_HOEHE, type Zone } from './welt';
import type { Spieler } from './logik';

/**
 * Florianville — die Darstellung.
 *
 * **Der einzige Ort in diesem Ordner, der three.js kennt.** Wird von
 * `AbenteuerSeite.tsx` nachgeladen und landet dadurch im selben `three`-
 * Brocken wie Dash City; wer nur Snake Rush spielt, lädt weiterhin nichts
 * davon. Enthält **keine** Spielregeln — sie bekommt einen `Spieler` und
 * eine `Zone` gereicht und stellt sie dar.
 *
 * ## Der Cartoon-Stil
 *
 * Drei Griffe machen den Unterschied zwischen „3-D-Szene" und „Cartoon":
 *
 * 1. **`MeshToonMaterial` statt Phong.** Es schattiert in Stufen statt
 *    stufenlos — genau das, was eine gezeichnete Figur von einer gerenderten
 *    unterscheidet. Kostet nichts extra.
 * 2. **Konturlinien über die umgestülpte Hülle.** Jede Figur bekommt eine
 *    zweite, minimal größere Kopie mit `side: BackSide` in Dunkel. Von außen
 *    sieht man davon nur den Rand — eine echte Zeichenkontur, ohne einen
 *    zweiten Renderdurchgang. Nur an Figuren, nicht an Häusern: An zwanzig
 *    Gebäuden wäre es doppelte Zeichenlast für eine Wirkung, die dort niemand
 *    vermisst.
 * 3. **Kräftige Farben und viel Grundhelligkeit.** Cartoons haben keine
 *    tiefen Schatten; ein dunkles Bild sieht nach Realismus aus, auch wenn
 *    die Formen rund sind.
 */

const HIMMEL_OBEN = 0x2f8fe0;
const HIMMEL_UNTEN = 0xbfe9ff;
const GRAS = 0x6fb84a;
const ASPHALT = 0x6b6f77;
const GEHWEG = 0xc9c6bd;

export type Szene = {
  zeichnen: (spieler: Spieler, dt: number, eingesammelt: ReadonlySet<string>) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
  aufraeumen: () => void;
};

/** Legt eine Kontur um ein Netz — die umgestülpte, leicht größere Hülle. */
function kontur(netz: THREE.Mesh, staerke = 1.06): THREE.Mesh {
  const rand = new THREE.Mesh(
    netz.geometry,
    new THREE.MeshBasicMaterial({ color: 0x1a1430, side: THREE.BackSide }),
  );
  rand.scale.setScalar(staerke);
  netz.add(rand);
  return rand;
}

/**
 * Eine Cartoon-Figur aus Grundkörpern.
 *
 * Bewusst **großer Kopf, kurze Beine** — die klassischen Cartoon-Proportionen.
 * Bei realistischen Proportionen wirkt eine Figur aus Kugeln und Zylindern
 * wie eine Schaufensterpuppe; mit einem Kopf auf einem Drittel der Körperhöhe
 * wirkt dieselbe Figur gezeichnet.
 */
function figurBauen(farben: {
  haut: number;
  oben: number;
  unten: number;
  haar: number;
}): {
  gruppe: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  beinL: THREE.Object3D;
  beinR: THREE.Object3D;
  kopf: THREE.Object3D;
} {
  const gruppe = new THREE.Group();
  const stoff = (farbe: number) => new THREE.MeshToonMaterial({ color: farbe });

  const mHaut = stoff(farben.haut);
  const mOben = stoff(farben.oben);
  const mUnten = stoff(farben.unten);
  const mHaar = stoff(farben.haar);
  const mSchuh = stoff(0x2b3145);
  const mAuge = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mPupille = new THREE.MeshBasicMaterial({ color: 0x1a1430 });

  // Rumpf: Zylinder mit gerader Unterkante — keine Wulst an der Hüfte.
  const rumpf = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.5, 16), mOben);
  rumpf.position.y = 0.86;
  gruppe.add(rumpf);
  kontur(rumpf, 1.08);

  const huefte = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.2, 14), mUnten);
  huefte.position.y = 0.6;
  gruppe.add(huefte);

  // Kopf: groß, das ist der ganze Cartoon-Trick.
  const kopf = new THREE.Group();
  kopf.position.y = 1.34;
  gruppe.add(kopf);

  const schaedel = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), mHaut);
  kopf.add(schaedel);
  kontur(schaedel, 1.07);

  const haar = new THREE.Mesh(
    new THREE.SphereGeometry(0.312, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1),
    mHaar,
  );
  haar.position.y = 0.02;
  kopf.add(haar);

  // Augen: große weiße Kugeln mit Pupille — das Gesicht macht die Figur.
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), mAuge);
    auge.position.set(seite * 0.115, 0.03, 0.245);
    auge.scale.set(1, 1.15, 0.6);
    kopf.add(auge);
    const pupille = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), mPupille);
    pupille.position.set(seite * 0.12, 0.02, 0.295);
    pupille.scale.set(1, 1.1, 0.5);
    kopf.add(pupille);
  }

  const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.1, 10), mHaut);
  hals.position.y = 1.13;
  gruppe.add(hals);

  const schulter = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.24, 4, 12), mOben);
  schulter.rotation.z = Math.PI / 2;
  schulter.position.y = 1.06;
  gruppe.add(schulter);

  const armGeo = new THREE.CapsuleGeometry(0.078, 0.26, 4, 10);
  const beinGeo = new THREE.CapsuleGeometry(0.095, 0.22, 4, 10);
  const handGeo = new THREE.SphereGeometry(0.085, 10, 8);
  const schuhGeo = new THREE.BoxGeometry(0.19, 0.1, 0.28);

  const glied = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    laenge: number,
  ) => {
    const dreh = new THREE.Object3D();
    dreh.position.set(x, y, 0);
    const teil = new THREE.Mesh(geo, mat);
    teil.position.y = -laenge / 2;
    dreh.add(teil);
    kontur(teil, 1.1);
    gruppe.add(dreh);
    return dreh;
  };

  const armL = glied(armGeo, mHaut, -0.27, 1.06, 0.42);
  const armR = glied(armGeo, mHaut, 0.27, 1.06, 0.42);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(handGeo, mHaut);
    hand.position.y = -0.4;
    arm.add(hand);
  }

  const beinL = glied(beinGeo, mUnten, -0.12, 0.55, 0.4);
  const beinR = glied(beinGeo, mUnten, 0.12, 0.55, 0.4);
  for (const bein of [beinL, beinR]) {
    const schuh = new THREE.Mesh(schuhGeo, mSchuh);
    schuh.position.set(0, -0.5, 0.04);
    bein.add(schuh);
  }

  return { gruppe, armL, armR, beinL, beinR, kopf };
}

export function szeneBauen(leinwand: HTMLCanvasElement, zone: Zone): Szene {
  const renderer = new THREE.WebGLRenderer({ canvas: leinwand, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const szene = new THREE.Scene();

  // Himmel als Verlauf — dieselbe Machart wie in Dash City.
  const himmelLeinwand = document.createElement('canvas');
  himmelLeinwand.width = 4;
  himmelLeinwand.height = 256;
  const hs = himmelLeinwand.getContext('2d')!;
  const v = hs.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, `#${HIMMEL_OBEN.toString(16).padStart(6, '0')}`);
  v.addColorStop(1, `#${HIMMEL_UNTEN.toString(16).padStart(6, '0')}`);
  hs.fillStyle = v;
  hs.fillRect(0, 0, 4, 256);
  const himmel = new THREE.CanvasTexture(himmelLeinwand);
  himmel.colorSpace = THREE.SRGBColorSpace;
  szene.background = himmel;
  /*
   * Dunst schon ab 34 Metern, dicht bei 72. Das Viertel ist nur 44 Meter
   * groß — ein weiter Dunst hätte gar nichts zu tun, und man sähe statt
   * eines Horizonts die **Kante der Bodenfläche** als harten Strich. Genau
   * das war beim ersten Blick auf dem iPhone zu sehen.
   */
  szene.fog = new THREE.Fog(HIMMEL_UNTEN, 34, 72);

  /*
   * **66° statt 58 — nachgerechnet, nicht geschätzt.**
   *
   * Das senkrechte Sichtfeld ist bei einem Hochformat-Handy nicht das
   * Maß, auf das es ankommt. Bei Seitenverhältnis 0,68 bleiben von 58°
   * senkrecht nur 20,6° **waagerecht** übrig — und die nächste Hausecke
   * lag bei 23°. Zwei Grad zu weit, und die ganze Straße war leer.
   * 66° ergeben 24,6° waagerecht; damit stehen die Häuser im Bild.
   */
  const kamera = new THREE.PerspectiveCamera(66, 1, 0.1, 240);

  /*
   * Cartoon-Licht: viel Grundhelligkeit, eine klare Sonne, kaum Schatten.
   * Ein Zeichentrickbild hat keine tiefen Schatten — mit realistischer
   * Beleuchtung sähe dieselbe Szene sofort nach Rendering aus statt nach
   * Zeichnung.
   */
  szene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 2.2));
  const sonne = new THREE.DirectionalLight(0xfff6e0, 1.8);
  sonne.position.set(-20, 40, -14);
  szene.add(sonne);

  const toon = (farbe: number | string) => new THREE.MeshToonMaterial({ color: farbe });

  // --- Boden ---
  // Deutlich größer als die Zone: Die Kante muss weit hinter dem Dunst liegen.
  const wiese = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon(GRAS));
  wiese.rotation.x = -Math.PI / 2;
  szene.add(wiese);

  for (const s of zone.strassen) {
    const strasse = new THREE.Mesh(new THREE.PlaneGeometry(s.breite, s.tiefe), toon(ASPHALT));
    strasse.rotation.x = -Math.PI / 2;
    strasse.position.set(s.x, 0.02, s.z);
    szene.add(strasse);
    // Gehweg als heller Rand ringsum, minimal tiefer.
    const weg = new THREE.Mesh(
      new THREE.PlaneGeometry(s.breite + 2.4, s.tiefe + 2.4),
      toon(GEHWEG),
    );
    weg.rotation.x = -Math.PI / 2;
    weg.position.set(s.x, 0.01, s.z);
    szene.add(weg);
  }

  // --- Häuser ---
  for (const h of zone.haeuser) {
    const wand = new THREE.Mesh(new THREE.BoxGeometry(h.breite, h.hoehe, h.tiefe), toon(h.farbe));
    wand.position.set(h.x, h.hoehe / 2, h.z);
    szene.add(wand);

    // Satteldach als flache Pyramide. Vier Seiten, um 45° gedreht, damit
    // die Kanten auf den Hausecken sitzen.
    const dach = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(h.breite, h.tiefe) * 0.78, 2.2, 4),
      toon(h.dachfarbe),
    );
    dach.position.set(h.x, h.hoehe + 1.1, h.z);
    dach.rotation.y = Math.PI / 4;
    szene.add(dach);

    // Tür und Fenster zur Straßenseite (dorthin, wo die Kreuzung liegt).
    const zurMitte = h.z > 0 ? -1 : 1;
    const tuer = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.12), toon(0x7a4a2b));
    tuer.position.set(h.x, 1, h.z + (zurMitte * h.tiefe) / 2);
    szene.add(tuer);

    for (let g = 0; g < h.geschosse; g++) {
      for (const seite of [-1, 1]) {
        const fenster = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.1, 0.12),
          toon(g === 0 ? 0xffe9a8 : 0xbfe3f4),
        );
        fenster.position.set(
          h.x + seite * (h.breite * 0.28),
          1.4 + g * 2.6,
          h.z + (zurMitte * h.tiefe) / 2,
        );
        szene.add(fenster);
      }
    }
  }

  // --- Zäune, Hecken, Tonnen ---
  for (const s of zone.sperren) {
    const farbe = s.hoehe > 1.2 ? 0x3f7f3a : 0xe8e2d4;
    const kasten = new THREE.Mesh(
      new THREE.BoxGeometry(s.breite, s.hoehe, s.tiefe),
      toon(farbe),
    );
    kasten.position.set(s.x, s.hoehe / 2, s.z);
    szene.add(kasten);
  }

  // --- Bäume ---
  const stammGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.9, 8);
  const laubGeo = new THREE.IcosahedronGeometry(1, 0);
  for (const b of zone.baeume) {
    const stamm = new THREE.Mesh(stammGeo, toon(0x6b4b32));
    stamm.position.set(b.x, 0.95 * b.groesse, b.z);
    stamm.scale.setScalar(b.groesse);
    szene.add(stamm);
    for (const [dy, gr] of [
      [2.3, 1],
      [3.1, 0.7],
    ] as const) {
      const laub = new THREE.Mesh(laubGeo, toon(0x4f9e3f));
      laub.position.set(b.x, dy * b.groesse, b.z);
      laub.scale.setScalar(gr * b.groesse * 1.15);
      szene.add(laub);
    }
  }

  // --- Laternen ---
  const mastGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8);
  const lampeGeo = new THREE.SphereGeometry(0.28, 10, 8);
  for (const l of zone.laternen) {
    const mast = new THREE.Mesh(mastGeo, toon(0x46505c));
    mast.position.set(l.x, 2.3, l.z);
    szene.add(mast);
    const lampe = new THREE.Mesh(lampeGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    lampe.position.set(l.x, 4.7, l.z);
    szene.add(lampe);
  }

  // --- Sammelstücke ---
  const sternForm = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const w = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.34 : 0.15;
    const px = Math.cos(w) * r;
    const py = Math.sin(w) * r;
    if (i === 0) sternForm.moveTo(px, py);
    else sternForm.lineTo(px, py);
  }
  sternForm.closePath();
  const sternGeo = new THREE.ExtrudeGeometry(sternForm, {
    depth: 0.1,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 1,
  });
  const sternStoff = new THREE.MeshToonMaterial({ color: 0xffc93c, emissive: 0x6b4e00 });
  const sterne = new Map<string, THREE.Mesh>();
  for (const s of zone.sammelstuecke) {
    const stern = new THREE.Mesh(sternGeo, sternStoff);
    stern.position.set(s.x, s.y, s.z);
    kontur(stern, 1.12);
    szene.add(stern);
    sterne.set(s.id, stern);
  }

  // --- NPCs ---
  const NPC_FARBEN: Record<string, Parameters<typeof figurBauen>[0]> = {
    nachbarin: { haut: 0xf2c19b, oben: 0xe86a92, unten: 0x51406b, haar: 0xa8452c },
    mechaniker: { haut: 0xd8a171, oben: 0x4f6f9c, unten: 0x3a4257, haar: 0x2f2a26 },
    leo: { haut: 0xf6c9a0, oben: 0x3fbf7f, unten: 0xd9541e, haar: 0x4a2f1c },
  };
  const npcs = zone.npcs.map((n) => {
    const f = figurBauen(NPC_FARBEN[n.id] ?? NPC_FARBEN.leo!);
    f.gruppe.position.set(n.x, 0, n.z);
    f.gruppe.rotation.y = -n.blick + Math.PI / 2;
    szene.add(f.gruppe);
    return { platz: n, teile: f };
  });

  // --- Der Spieler ---
  const held = figurBauen({ haut: 0xf6c9a0, oben: 0x3aa0ff, unten: 0x2b3f7a, haar: 0x6b3f1e });
  szene.add(held.gruppe);

  // Bodenschatten — ein weicher Fleck, kein echter Schattenwurf.
  const schattenLeinwand = document.createElement('canvas');
  schattenLeinwand.width = 64;
  schattenLeinwand.height = 64;
  const ss = schattenLeinwand.getContext('2d')!;
  const sv = ss.createRadialGradient(32, 32, 0, 32, 32, 32);
  sv.addColorStop(0, 'rgba(0,0,0,0.5)');
  sv.addColorStop(1, 'rgba(0,0,0,0)');
  ss.fillStyle = sv;
  ss.fillRect(0, 0, 64, 64);
  const schattenBild = new THREE.CanvasTexture(schattenLeinwand);
  const schattenStoff = new THREE.MeshBasicMaterial({
    map: schattenBild,
    transparent: true,
    depthWrite: false,
  });
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), schattenStoff);
  schatten.rotation.x = -Math.PI / 2;
  szene.add(schatten);

  let laufzeit = 0;
  // Die Kamera folgt gedämpft — hart mitzuziehen wirkt hektisch.
  const kameraZiel = new THREE.Vector3(zone.spawn.x, 1.4, zone.spawn.z);

  const zeichnen = (spieler: Spieler, dt: number, eingesammelt: ReadonlySet<string>) => {
    laufzeit += dt;

    // --- Figur ---
    held.gruppe.position.set(spieler.x, spieler.y, spieler.z);
    // Weltwinkel in Modellwinkel: Das Modell schaut in +z, `blick` misst ab
    // +x gegen den Uhrzeigersinn.
    held.gruppe.rotation.y = -spieler.blick + Math.PI / 2;

    const laeuft = spieler.tempo > 0.2 && spieler.amBoden;
    const takt = laufzeit * (6 + spieler.tempo * 1.6);
    const schwung = laeuft ? Math.sin(takt) * Math.min(1, spieler.tempo / 5) : 0;
    held.beinL.rotation.x = spieler.amBoden ? schwung : -0.5;
    held.beinR.rotation.x = spieler.amBoden ? -schwung : 0.3;
    held.armL.rotation.x = spieler.amBoden ? -schwung * 0.8 : -2.1;
    held.armR.rotation.x = spieler.amBoden ? schwung * 0.8 : -2.1;
    // Ein leichtes Auf und Ab. Ohne das gleitet die Figur, statt zu laufen.
    held.gruppe.position.y = spieler.y + (laeuft ? Math.abs(Math.sin(takt)) * 0.05 : 0);

    schatten.position.set(spieler.x, 0.03, spieler.z);
    const hoch = Math.min(1, spieler.y / 2.5);
    schatten.scale.setScalar(1 - hoch * 0.45);
    schattenStoff.opacity = 1 - hoch * 0.6;

    // --- NPCs: leichtes Wippen, damit sie nicht wie Statuen wirken ---
    npcs.forEach((n, i) => {
      const w = Math.sin(laufzeit * 1.6 + i * 2.1) * 0.04;
      n.teile.gruppe.position.y = w;
      n.teile.kopf.rotation.y = Math.sin(laufzeit * 0.8 + i) * 0.25;
    });

    // --- Sammelstücke drehen sich und schweben ---
    for (const [id, netz] of sterne) {
      const weg = eingesammelt.has(id);
      netz.visible = !weg;
      if (weg) continue;
      netz.rotation.y = laufzeit * 1.8;
      const s = zone.sammelstuecke.find((q) => q.id === id)!;
      netz.position.y = s.y + Math.sin(laufzeit * 2 + s.x) * 0.12;
    }

    /*
     * --- Kamera ---
     *
     * **Feste Blickrichtung, sie dreht sich nicht mit der Figur.**
     *
     * Der erste Entwurf ließ sie hinter der Figur mitschwenken. Das ist bei
     * kamerabezogener Steuerung richtig — hier aber ist die Steuerung
     * **weltbezogen** (Stick nach oben heißt immer Norden), und die
     * Kombination ergibt eine Rückkopplung: Die Figur dreht sich zur
     * Laufrichtung, die Kamera dreht hinterher, dadurch verschiebt sich,
     * was „oben" bedeutet — und man könnte gar nicht mehr gezielt abbiegen.
     *
     * Feste Richtung plus weltbezogener Stick ist der Griff, den
     * Abenteuerspiele mit halbhoher Kamera seit jeher benutzen: Norden
     * bleibt Norden, und die Figur dreht sich frei darin.
     */
    const glaettung = Math.min(1, dt * 6);
    kamera.position.x += (spieler.x - kamera.position.x) * glaettung;
    kamera.position.z += (spieler.z + 6.2 - kamera.position.z) * glaettung;
    kamera.position.y += (spieler.y + 3.4 - kamera.position.y) * glaettung;

    kameraZiel.x += (spieler.x - kameraZiel.x) * glaettung;
    kameraZiel.y += (spieler.y + 1.55 - kameraZiel.y) * glaettung;
    kameraZiel.z += (spieler.z - kameraZiel.z) * glaettung;
    kamera.lookAt(kameraZiel);

    renderer.render(szene, kamera);
  };

  const groesseAendern = (breite: number, hoehe: number) => {
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
    renderer.setSize(breite, hoehe, false);
  };

  const aufraeumen = () => {
    szene.traverse((teil) => {
      const netz = teil as THREE.Mesh;
      netz.geometry?.dispose();
      const m = netz.material;
      const frei = (x: THREE.Material) => {
        (x as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
        x.dispose();
      };
      if (Array.isArray(m)) m.forEach(frei);
      else if (m) frei(m as THREE.Material);
    });
    himmel.dispose();
    /*
     * `dispose()` allein gibt den Zeichenkontext **nicht** frei — genau
     * daran ist Dash City schon einmal gestorben („Der 3-D-Teil lässt sich
     * hier nicht starten"). Browser erlauben nur acht bis sechzehn
     * gleichzeitig, und jeder Neustart legt einen neuen an.
     */
    renderer.forceContextLoss();
    renderer.dispose();
  };

  return { zeichnen, groesseAendern, aufraeumen };
}

export const HELD_HOEHE = FIGUR_HOEHE;
