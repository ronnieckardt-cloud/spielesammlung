import * as THREE from 'three';
import { empfaengtSchatten, schattenEinrichten, umgebungBauen, wirftSchatten } from '../laufen/licht';
import { nachbearbeitungBauen } from '../laufen/effekte';
import type { Nachbearbeitung, Stufe } from '../laufen/effekte';
import { skelettBerechnen, sturzSkelett } from './fahrer';
import type { FahrerPose, Skelett } from './fahrer';
import { fahrerBauen } from './fahrer3d';
import { gelaendeBauen3d } from './gelaende3d';
import type { Gelaende3D } from './gelaende3d';
import { TEMPO_MAX, bodenHoehe } from './logik';
import type { Lauf } from './logik';
import { PALETTEN, himmelZeichnen } from './umgebung';
import type { Palette } from './umgebung';
import { radBauen } from './rad3d';
import { radGeometrie } from './radgeo';
import { MODELL_GROESSE, neuerRig, rigSchritt } from './rig';
import { stoffeBauen } from './stoffe';
import { sammler } from './bauteile';
import { teilchenBauen } from './teilchen3d';
import { weltBauen } from './welt3d';
import type { Welt3D } from './welt3d';

/**
 * Flow MTB in echtem 3-D.
 *
 * **Die Physik bleibt zweidimensional.** `logik.ts` rechnet mit einem Punkt, einem Winkel
 * und einem Höhenprofil; nichts davon wird hier angefasst. Die Szene ist nur eine neue
 * Darstellung desselben Laufs — wie schon die 2-D-Zeichnung in `zeichnen.ts`. Das ist die
 * Bedingung, unter der ein 3-D-Umbau überhaupt vertretbar ist: Alle Fairness-Prüfungen
 * (Lücken, Pop, Bildratenunabhängigkeit) gelten unverändert weiter, weil die Rechnung
 * unverändert ist.
 *
 * Was man **sieht** und über Bilder hinweg dämpfen muss — Federung, Kamera, Haltung des Fahrers,
 * der Sturz — rechnet `rig.ts`, rein und getestet; dieselbe Rechnung wie in der 2-D-Fassung.
 * Hier steht nur noch das Zusammenstecken: Modell setzen, Kamera führen, Licht, Nachbearbeitung.
 *
 * Wie bei Dash City ist dies **der einzige Ort im Projekt, der three.js für Flow MTB kennt**.
 * Die Datei wird per `import()` nachgeladen; wer ein anderes Spiel spielt, lädt nichts davon.
 * Schlägt der Start fehl (kein WebGL), fällt `FlowMtb.tsx` auf die 2-D-Zeichnung zurück.
 */

export type Szene3D = {
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
  aufraeumen: () => void;
};

/** Werte für die Nahaufnahme am Rechner (`globalThis.__mtbPrueftand`). */
export type Pruefstand = Partial<FahrerPose> & {
  /** Wie viele Meter quer ins Bild passen. */
  sicht?: number;
  winkel?: number;
  federVorn?: number;
  federHinten?: number;
  biom?: number;
  /** Blickrichtung in Grad: 0 = von der Seite, positiv = von vorn, negativ = von hinten. */
  gier?: number;
  /** Blickwinkel von oben in Grad. */
  nick?: number;
  radDrehung?: number;
  /** Höhe des Blickpunkts in Metern. */
  mitte?: number;
  /** Zeigt statt des Fahrers auf dem Rad den gestürzten Fahrer (Zeit, Schlaffheit 0–1, Drehung in Radiant). */
  sturz?: { zeit: number; schlaff: number; drehung: number };
};

/** Licht und Farbton je Umgebung — dieselben vier wie in `PALETTEN`. */
type Stimmung = {
  sonne: number;
  sonneStaerke: number;
  sonnenLage: [number, number, number];
  hemiStaerke: number;
  hemiHimmel: string;
  hemiBoden: string;
  gegenFarbe: number;
  gegenStaerke: number;
  belichtung: number;
  spiegelung: number;
  scheinwerfer: boolean;
};

const STIMMUNGEN: readonly Stimmung[] = [
  // Wiese
  { sonne: 0xfff2d8, sonneStaerke: 2.2, sonnenLage: [-6, 11, 9], hemiStaerke: 0.95, hemiHimmel: '#dff0ff', hemiBoden: '#8a6a45', gegenFarbe: 0xbfe3f4, gegenStaerke: 0.45, belichtung: 1.0, spiegelung: 1, scheinwerfer: false },
  // Abendrot
  { sonne: 0xffa56a, sonneStaerke: 2.1, sonnenLage: [9, 5, 9], hemiStaerke: 0.85, hemiHimmel: '#f2b08a', hemiBoden: '#6a3c2c', gegenFarbe: 0xffc9a0, gegenStaerke: 0.4, belichtung: 1.0, spiegelung: 0.8, scheinwerfer: false },
  // Nacht
  { sonne: 0x9db8ff, sonneStaerke: 1.7, sonnenLage: [-6, 10, 9], hemiStaerke: 1.05, hemiHimmel: '#5a74b8', hemiBoden: '#2a3354', gegenFarbe: 0x7f98e0, gegenStaerke: 0.6, belichtung: 1.15, spiegelung: 0.45, scheinwerfer: true },
  // Herbst
  { sonne: 0xffe0ad, sonneStaerke: 2.1, sonnenLage: [-8, 8, 9], hemiStaerke: 0.9, hemiHimmel: '#f0e2c0', hemiBoden: '#94603a', gegenFarbe: 0xffe9c8, gegenStaerke: 0.4, belichtung: 1.0, spiegelung: 0.9, scheinwerfer: false },
];

const stimmungVon = (biom: number): Stimmung => STIMMUNGEN[((biom % STIMMUNGEN.length) + STIMMUNGEN.length) % STIMMUNGEN.length]!;

/** Der Himmel als Bild auf dem Hintergrund — **fest am Bildschirm**, siehe `umgebung.ts`. */
function himmelTextur(p: Palette, breite: number, hoehe: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  // Klein genug für ein altes iPad, groß genug für einen weichen Verlauf: Der Himmel hat keine
  // scharfen Kanten außer der Sonnenscheibe.
  const faktor = Math.min(1, 640 / Math.max(breite, hoehe));
  c.width = Math.max(64, Math.round(breite * faktor));
  c.height = Math.max(64, Math.round(hoehe * faktor));
  const ctx = c.getContext('2d')!;
  ctx.scale(faktor, faktor);
  himmelZeichnen({
    ctx,
    breite,
    hoehe,
    proMeter: 1,
    kameraX: 0,
    g: { wellen: [], kicker: [], laenge: 0, muenzen: [], pads: [], absprung: [], luecken: [] },
    p,
    uhr: 0.4,
    bx: (x) => x,
    by: (y) => y,
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** Entfernung der Kamera von der Bahnebene. Weit genug, dass die Seitenansicht lesbar bleibt, nah genug für Tiefe. */
const KAMERA_ABSTAND = 28;
/** Wie hoch über dem Blickpunkt die Kamera sitzt — sie schaut leicht von oben, damit man Boden und Tiefe sieht. */
const KAMERA_HOEHE = 6;

export function szene3dBauen(leinwand: HTMLCanvasElement, ruhig = false): Szene3D {
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand,
    antialias: true,
    powerPreference: 'high-performance',
  });
  /*
   * **Neutrale Tonwertkurve statt ACES.** Der Himmel ist ein gemaltes Bild, kein Licht: Er soll
   * genau so aussehen, wie er in der Palette steht. ACES zieht Farben im mittleren Bereich
   * auseinander und verfärbt dabei Hellblau; die neutrale Kurve (Khronos PBR Neutral) lässt alles,
   * was nicht überstrahlt, unverändert und drückt nur die Glanzlichter zusammen.
   */
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(40, 1, 1, 260);

  const frei = sammler();
  let umgebung = umgebungBauen(renderer);
  const stoffe = stoffeBauen(umgebung ? umgebung.texture : null);

  const hemi = new THREE.HemisphereLight(0xdaf0ff, 0x7a6a55, 0.95);
  szene.add(hemi);
  const sonne = new THREE.DirectionalLight(0xfff2d8, 2.2);
  szene.add(sonne, sonne.target);
  schattenEinrichten(sonne);
  sonne.shadow.camera.left = -11;
  sonne.shadow.camera.right = 11;
  sonne.shadow.camera.top = 11;
  sonne.shadow.camera.bottom = -11;
  sonne.shadow.camera.far = 60;
  sonne.shadow.mapSize.set(2048, 2048);
  // Ein schwaches Gegenlicht von vorn setzt die Silhouette vom Hintergrund ab.
  const gegenlicht = new THREE.DirectionalLight(0xbfe3f4, 0.45);
  gegenlicht.position.set(6, 3, 12);
  szene.add(gegenlicht);

  // --- Rad und Fahrer -------------------------------------------------
  const radHalter = new THREE.Group();
  const fahrerHalter = new THREE.Group();
  const rad = radBauen(stoffe);
  const fahrer = fahrerBauen(stoffe);
  radHalter.add(rad.gruppe);
  fahrerHalter.add(fahrer.gruppe);
  radHalter.scale.setScalar(MODELL_GROESSE);
  fahrerHalter.scale.setScalar(MODELL_GROESSE);
  szene.add(radHalter, fahrerHalter);
  wirftSchatten(radHalter);
  wirftSchatten(fahrerHalter);
  frei.merke(radHalter);
  frei.merke(fahrerHalter);

  // Ein weicher Schatten unter dem Rad. Er zeigt in der Luft, **wo man landet** — das war in der
  // 2-D-Fassung schon so und gilt auf jeder Qualitätsstufe, auch dort, wo es keine echten Schatten gibt.
  const weichCanvas = document.createElement('canvas');
  weichCanvas.width = weichCanvas.height = 128;
  {
    const x = weichCanvas.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  const weichTextur = new THREE.CanvasTexture(weichCanvas);
  const fleckStoff = new THREE.MeshBasicMaterial({
    map: weichTextur,
    color: 0x000000,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const fleck = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fleckStoff);
  szene.add(fleck);

  // Scheinwerfer für die Nachtstrecke: ein echter Lichtkegel und ein sichtbarer Strahl.
  const strahlLicht = new THREE.SpotLight(0xfff0c8, 0, 22, 0.55, 0.6, 1.2);
  const strahlZiel = new THREE.Object3D();
  radHalter.add(strahlLicht, strahlZiel);
  strahlZiel.position.set(7, 0.2, 0);
  strahlLicht.target = strahlZiel;
  // Der sichtbare Strahl: eine weiche Fläche, die vom Lenker nach vorn aufgeht. Ein Kegel hätte scharfe
  // Kanten — Licht hat keine. Das Bild wird einmal pixelweise gerechnet (Länge × Aufweitung).
  const strahlCanvas = document.createElement('canvas');
  strahlCanvas.width = 128;
  strahlCanvas.height = 64;
  {
    const x = strahlCanvas.getContext('2d')!;
    const bild = x.createImageData(128, 64);
    for (let py = 0; py < 64; py++) {
      for (let px = 0; px < 128; px++) {
        const u = px / 127;
        const v = (py / 63) * 2 - 1;
        const breite = 0.08 + 0.92 * u;
        const quer = Math.max(0, 1 - Math.abs(v) / breite);
        const a = Math.pow(1 - u, 1.4) * quer * quer * (0.35 + 0.65 * (1 - u));
        const i = (py * 128 + px) * 4;
        bild.data[i] = 255;
        bild.data[i + 1] = 240;
        bild.data[i + 2] = 190;
        bild.data[i + 3] = Math.round(255 * Math.min(1, a));
      }
    }
    x.putImageData(bild, 0, 0);
  }
  const strahlTextur = new THREE.CanvasTexture(strahlCanvas);
  strahlTextur.colorSpace = THREE.SRGBColorSpace;
  const kegelGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
  const kegelStoff = new THREE.MeshBasicMaterial({
    map: strahlTextur,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const kegel = new THREE.Mesh(kegelGeo, kegelStoff);
  kegel.scale.set(7.5, 3.4, 1);
  radHalter.add(kegel);

  const teilchen = teilchenBauen(ruhig);
  szene.add(teilchen.gruppe);

  const rig = neuerRig();

  let breite = 1;
  let hoehe = 1;
  let himmel: THREE.CanvasTexture | null = null;
  let himmelBiom = -1;
  let himmelB = 0;
  let himmelH = 0;

  let gelaende: Gelaende3D | null = null;
  let welt: Welt3D | null = null;
  let weltBiom = -1;
  let weltGelaende: unknown = null;

  let stufeJetzt: Stufe = 3;
  const stufeNeu = (s: Stufe) => {
    stufeJetzt = s;
    // Schatten gibt es nur auf der höchsten Stufe, siehe `effekte.ts` in Dash City.
    sonne.castShadow = s >= 3;
    renderer.shadowMap.enabled = s >= 3;
    szene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true;
    });
  };
  const nach: Nachbearbeitung = nachbearbeitungBauen(renderer, szene, kamera, stufeNeu, ruhig, '__mtbQualitaet');

  const palette = (biom: number): Palette => PALETTEN[((biom % PALETTEN.length) + PALETTEN.length) % PALETTEN.length]!;

  const himmelSetzen = (p: Palette, biom: number) => {
    if (himmel && himmelBiom === biom && himmelB === breite && himmelH === hoehe) return;
    himmel?.dispose();
    himmel = himmelTextur(p, breite, hoehe);
    szene.background = himmel;
    himmelBiom = biom;
    himmelB = breite;
    himmelH = hoehe;
  };

  const stimmungSetzen = (biom: number): Stimmung => {
    const s = stimmungVon(biom);
    sonne.color.set(s.sonne);
    sonne.intensity = s.sonneStaerke;
    hemi.color.set(s.hemiHimmel);
    hemi.groundColor.set(s.hemiBoden);
    hemi.intensity = s.hemiStaerke;
    gegenlicht.color.set(s.gegenFarbe);
    gegenlicht.intensity = s.gegenStaerke;
    stoffe.spiegelung(s.spiegelung);
    strahlLicht.intensity = s.scheinwerfer ? 90 : 0;
    kegel.visible = s.scheinwerfer;
    return s;
  };

  /** Baut Gelände und Aufbauten, sobald der erste Lauf da ist (oder die Umgebung wechselt). */
  const weltSetzen = (lauf: Lauf, biom: number, p: Palette) => {
    if (welt && weltBiom === biom && weltGelaende === lauf.gelaende) return;
    if (gelaende) {
      szene.remove(gelaende.gruppe);
      gelaende.freigeben();
    }
    if (welt) {
      szene.remove(welt.gruppe);
      welt.freigeben();
    }
    gelaende = gelaendeBauen3d(lauf.gelaende, p);
    welt = weltBauen(lauf.gelaende, p, umgebung ? umgebung.texture : null, ruhig);
    szene.add(gelaende.gruppe, welt.gruppe);
    empfaengtSchatten(gelaende.gruppe);
    weltBiom = biom;
    weltGelaende = lauf.gelaende;
  };

  const kameraSetzen = (
    zielX: number,
    zielY: number,
    sicht: number,
    zittern: { x: number; y: number },
    gier: number,
    nick: number,
    abstand: number,
    aspekt: number,
  ) => {
    kamera.fov = (2 * Math.atan(sicht / 2 / (aspekt * abstand)) * 180) / Math.PI;
    kamera.aspect = aspekt;
    kamera.updateProjectionMatrix();
    kamera.position.set(
      zielX + Math.sin(gier) * Math.cos(nick) * abstand + zittern.x,
      zielY + Math.sin(nick) * abstand + zittern.y,
      Math.cos(gier) * Math.cos(nick) * abstand,
    );
    kamera.lookAt(zielX + zittern.x * 0.5, zielY + zittern.y * 0.5, 0);
  };

  /** Setzt Rad und Fahrer nach Haltung und Gelenken. */
  const modellSetzen = (s: Skelett, geo: ReturnType<typeof radGeometrie>, radDrehung: number) => {
    rad.aktualisieren({ geo, pedalNah: s.pedalNah, pedalFern: s.pedalFern, radDrehung });
    fahrer.setzen(s);
    // Der Scheinwerfer sitzt am Lenker.
    strahlLicht.position.set(geo.lenker.x + 0.1, -geo.lenker.y + 0.02, 0);
    kegel.position.set(geo.lenker.x + 0.1, -geo.lenker.y - 0.15, 0.2);
    kegel.rotation.z = -0.12;
  };

  // --- Nahaufnahme am Rechner ---
  const pruefbodenStoff = new THREE.MeshStandardMaterial({ color: '#7a8f5e', roughness: 0.95 });
  const pruefboden = new THREE.Mesh(new THREE.PlaneGeometry(60, 30).rotateX(-Math.PI / 2), pruefbodenStoff);
  pruefboden.receiveShadow = true;

  const pruef = (w: Pruefstand) => {
    const biom = w.biom ?? 0;
    const p = palette(biom);
    himmelSetzen(p, biom);
    stimmungSetzen(biom);
    if (gelaende) gelaende.gruppe.visible = false;
    if (welt) welt.gruppe.visible = false;
    if (!pruefboden.parent) szene.add(pruefboden);
    pruefbodenStoff.color.set(p.gras[0]);

    const geo = radGeometrie(w.federVorn ?? 0, w.federHinten ?? 0);
    const pose: FahrerPose = {
      stehen: w.stehen ?? 1,
      hocke: w.hocke ?? 0,
      gewicht: w.gewicht ?? 0,
      streck: w.streck ?? 0,
      kurbel: w.kurbel ?? 0.6,
      wind: w.wind ?? 0.6,
      zeit: w.zeit ?? 0.3,
    };
    const s = skelettBerechnen({ m: 1, tretlager: geo.tretlager, sattel: geo.sitz, lenker: geo.lenker }, pose);
    modellSetzen(s, geo, w.radDrehung ?? 0.4);
    radHalter.position.set(0, 0, 0);
    radHalter.rotation.z = w.winkel ?? 0;
    fahrerHalter.position.copy(radHalter.position);
    fahrerHalter.rotation.z = radHalter.rotation.z;
    if (w.sturz) {
      fahrer.setzen(sturzSkelett(1, w.sturz.zeit, w.sturz.schlaff));
      fahrerHalter.position.set(0, 1.3, 0);
      fahrerHalter.rotation.z = -w.sturz.drehung;
      radHalter.position.set(-2.4, 0, 0);
    }
    fleck.visible = false;

    const lage = stimmungVon(biom).sonnenLage;
    sonne.position.set(lage[0], lage[1], lage[2]);
    sonne.target.position.set(0, 1, 0);
    kameraSetzen(0, w.mitte ?? 1.7, w.sicht ?? 3.4, { x: 0, y: 0 }, ((w.gier ?? 0) * Math.PI) / 180, ((w.nick ?? 6) * Math.PI) / 180, 18, breite / hoehe);
  };

  /*
   * **Der Zeichenkontext kann verloren gehen** — auf dem iPad beim App-Wechsel. three.js stellt
   * Puffer und Texturen von selbst wieder her, **nicht** aber die Spiegelungsvorlage: Sie ist ein
   * reines Grafikspeicher-Bild, das niemand mehr gezeichnet hat. Ohne Neuaufbau wären Rahmen,
   * Münzen und Helm danach stumpf schwarz.
   */
  let kontextNeu = false;
  const beiKontextNeu = () => {
    kontextNeu = true;
  };
  leinwand.addEventListener('webglcontextrestored', beiKontextNeu);
  const umgebungErneuern = () => {
    const alt = umgebung;
    const neu = umgebungBauen(renderer);
    szene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!m) return;
      for (const x of Array.isArray(m) ? m : [m]) {
        const st = x as THREE.MeshStandardMaterial;
        if (alt && st.envMap === alt.texture && neu) {
          st.envMap = neu.texture;
          st.needsUpdate = true;
        }
      }
    });
    alt?.dispose();
    umgebung = neu;
  };

  let zitterZustand = 0x1f123bb5;
  const zufall = () => {
    zitterZustand = (Math.imul(zitterZustand, 1664525) + 1013904223) >>> 0;
    return zitterZustand / 4294967296;
  };

  const zeichnen = (lauf: Lauf, dt: number) => {
    if (kontextNeu) {
      kontextNeu = false;
      umgebungErneuern();
    }
    const pw = (globalThis as { __mtbPrueftand?: Pruefstand }).__mtbPrueftand;
    if (pw) {
      pruef(pw);
      nach.rendern(dt, { tempo: 0, turbo: 0 });
      return;
    }
    if (pruefboden.parent) szene.remove(pruefboden);
    if (gelaende) gelaende.gruppe.visible = true;
    if (welt) welt.gruppe.visible = true;

    // `__mtbBiom` ist ein Hilfsmittel für Bildschirmfotos am Rechner.
    const biom = (globalThis as { __mtbBiom?: number }).__mtbBiom ?? lauf.biom;
    const p = palette(biom);
    const stimmung = stimmungSetzen(biom);
    himmelSetzen(p, biom);
    weltSetzen(lauf, biom, p);

    const g = lauf.gelaende;
    const { pose, effekte, sicht } = rigSchritt(rig, lauf, dt);

    // --- Rad und Fahrer ---
    const geo = radGeometrie(rig.federVorn, rig.federHinten);
    const gestuerzt = lauf.vorbei && !lauf.gewonnen;
    const sturzDreh = gestuerzt ? Math.min(5.6, lauf.sturzZeit * 5.1) : 0;
    radHalter.position.set(lauf.x, lauf.y, 0);
    radHalter.rotation.z = lauf.winkel - sturzDreh;

    if (rig.sturz) {
      // Der Fahrer löst sich vom Rad: eigene Lage, schlaffe Gelenke.
      const sk = sturzSkelett(1, rig.sturz.zeit, rig.sturz.schlaff);
      fahrer.setzen(sk);
      rad.aktualisieren({ geo, pedalNah: geo.tretlager, pedalFern: geo.tretlager, radDrehung: rig.radDrehung });
      fahrerHalter.position.set(rig.sturz.x, rig.sturz.y, 0);
      fahrerHalter.rotation.z = -rig.sturz.drehung;
    } else {
      const s = skelettBerechnen({ m: 1, tretlager: geo.tretlager, sattel: geo.sitz, lenker: geo.lenker }, pose);
      modellSetzen(s, geo, rig.radDrehung);
      fahrerHalter.position.copy(radHalter.position);
      fahrerHalter.rotation.z = radHalter.rotation.z;
    }

    // --- Schatten-Fleck unter dem Rad ---
    const boden = bodenHoehe(g, lauf.x);
    const ueber = Math.max(0, lauf.y - boden);
    const klein = 1 / (1 + ueber * 0.22);
    fleck.visible = ueber < 9;
    fleck.position.set(lauf.x + 0.35, boden + 0.04, 0);
    fleck.scale.set(3.4 * klein, 1, 1.5 * klein);
    fleckStoff.opacity = (stufeJetzt >= 3 ? 0.22 : 0.42) * klein;

    // --- Licht folgt dem Rad (der Schatten gilt nur für die Nähe) ---
    sonne.position.set(lauf.x + stimmung.sonnenLage[0], lauf.y + stimmung.sonnenLage[1] + 2, stimmung.sonnenLage[2]);
    sonne.target.position.set(lauf.x, lauf.y + 1, 0);

    // --- Kamera ---
    const aspekt = breite / hoehe;
    const zittern = ruhig || rig.schuettel <= 0 ? { x: 0, y: 0 } : { x: (zufall() - 0.5) * rig.schuettel * 0.5, y: (zufall() - 0.5) * rig.schuettel * 0.4 };
    // `kameraY` ist die Höhe, die bei 74 % der Bildhöhe liegt — der Blickpunkt liegt entsprechend darüber.
    const sichtHoehe = sicht / aspekt;
    kameraSetzen(rig.kameraX, rig.kameraY + 0.24 * sichtHoehe, sicht, zittern, 0, Math.atan(KAMERA_HOEHE / KAMERA_ABSTAND), KAMERA_ABSTAND, aspekt);

    // --- Teilchen ---
    if (!ruhig) for (const e of effekte) teilchen.erzeugen(e, p);
    teilchen.schritt(dt, (x) => bodenHoehe(g, x));
    teilchen.skala(hoehe / (2 * Math.tan((kamera.fov * Math.PI) / 360)));

    welt?.aktualisieren(lauf, rig.kameraX, rig.uhr);

    // Ein Lichtblitz bei einer perfekten Landung, ganz kurz: das Gegenstück zum Wackeln bei einer harten.
    renderer.toneMappingExposure = stimmung.belichtung * (1 + rig.blitz * 0.22);
    nach.rendern(dt, {
      tempo: Math.min(1, (lauf.vx / TEMPO_MAX) * 0.25 + rig.boost * 0.5),
      turbo: rig.boost * 0.6,
    });
  };

  const groesseAendern = (b: number, h: number) => {
    breite = Math.max(1, b);
    hoehe = Math.max(1, h);
    nach.groesse(breite, hoehe);
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
  };

  const aufraeumen = () => {
    leinwand.removeEventListener('webglcontextrestored', beiKontextNeu);
    nach.aufraeumen();
    himmel?.dispose();
    umgebung?.dispose();
    sonne.shadow.dispose();
    gelaende?.freigeben();
    welt?.freigeben();
    teilchen.freigeben();
    frei.freigeben();
    weichTextur.dispose();
    fleckStoff.dispose();
    fleck.geometry.dispose();
    kegelGeo.dispose();
    kegelStoff.dispose();
    strahlTextur.dispose();
    pruefboden.geometry.dispose();
    pruefbodenStoff.dispose();
    /*
     * `dispose()` allein gibt den WebGL-Kontext nicht frei — siehe Dash City. Jedes „Nochmal"
     * legt einen neuen an, und Browser erlauben nur acht bis sechzehn gleichzeitig.
     */
    renderer.forceContextLoss();
    renderer.dispose();
  };

  return { zeichnen, groesseAendern, aufraeumen };
}

/**
 * Das Titelbild: Rad und Fahrer in Angriffshaltung, in drei Vierteln von vorn, auf durchsichtigem
 * Grund — dasselbe Modell wie im Spiel, einmal gezeichnet und danach als Standbild abgelegt.
 *
 * Gerendert wird auf einer **eigenen, kurzlebigen** Leinwand und dann in die Zielleinwand kopiert.
 * Der WebGL-Kontext wird sofort zurückgegeben (`forceContextLoss`): Der Startbildschirm soll dem
 * Spiel, das gleich danach seinen eigenen anlegt, keinen der acht bis sechzehn erlaubten
 * Kontexte wegnehmen. Gibt `false` zurück, wenn es nicht ging — dann bleibt das 2-D-Bild stehen.
 */
export function heldenbild3d(ziel: HTMLCanvasElement, breiteCss: number, hoeheCss: number): boolean {
  const dichte = Math.min(window.devicePixelRatio || 1, 3);
  const b = Math.round(breiteCss * dichte);
  const h = Math.round(hoeheCss * dichte);
  const ziel2d = ziel.getContext('2d');
  if (!ziel2d) return false;

  const roh = document.createElement('canvas');
  roh.width = b;
  roh.height = h;
  let renderer: THREE.WebGLRenderer | null = null;
  const frei = sammler();
  try {
    renderer = new THREE.WebGLRenderer({ canvas: roh, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(b, h, false);
    renderer.toneMapping = THREE.NeutralToneMapping;

    const szene = new THREE.Scene();
    const umgebung = umgebungBauen(renderer);
    const stoffe = stoffeBauen(umgebung ? umgebung.texture : null);
    szene.add(new THREE.HemisphereLight(0xdff0ff, 0x8a6a45, 1.0));
    const sonne = new THREE.DirectionalLight(0xfff2d8, 2.3);
    sonne.position.set(-5, 9, 8);
    szene.add(sonne);
    const gegen = new THREE.DirectionalLight(0xbfe3f4, 0.6);
    gegen.position.set(6, 3, 10);
    szene.add(gegen);

    const rad = radBauen(stoffe);
    const fahrer = fahrerBauen(stoffe);
    const modell = new THREE.Group();
    modell.add(rad.gruppe, fahrer.gruppe);
    modell.rotation.z = 0.1;
    szene.add(modell);
    frei.merke(modell);

    const geo = radGeometrie(0.15, 0.2);
    const pose: FahrerPose = { stehen: 1, hocke: 0.12, gewicht: 0.25, streck: 0, kurbel: 0.6, wind: 0.6, zeit: 0.3 };
    const sk = skelettBerechnen({ m: 1, tretlager: geo.tretlager, sattel: geo.sitz, lenker: geo.lenker }, pose);
    rad.aktualisieren({ geo, pedalNah: sk.pedalNah, pedalFern: sk.pedalFern, radDrehung: 0.4 });
    fahrer.setzen(sk);

    // Bodenschatten.
    const weich = document.createElement('canvas');
    weich.width = weich.height = 128;
    const wx = weich.getContext('2d')!;
    const wg = wx.createRadialGradient(64, 64, 0, 64, 64, 64);
    wg.addColorStop(0, 'rgba(255,255,255,1)');
    wg.addColorStop(1, 'rgba(255,255,255,0)');
    wx.fillStyle = wg;
    wx.fillRect(0, 0, 128, 128);
    const weichT = new THREE.CanvasTexture(weich);
    const fleckS = new THREE.MeshBasicMaterial({ map: weichT, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
    const fleckG = new THREE.PlaneGeometry(3.4, 1.5).rotateX(-Math.PI / 2);
    const fleck = new THREE.Mesh(fleckG, fleckS);
    fleck.position.set(0.1, 0.01, 0);
    szene.add(fleck);

    // Kamera: aus drei Vierteln von vorn, so weit weg, dass das Ganze (rund 3,4 m breit) ins Bild passt.
    const kamera = new THREE.PerspectiveCamera(26, b / h, 0.5, 80);
    const gier = 0.5;
    const abstand = 7.9;
    kamera.position.set(Math.sin(gier) * abstand, 2.3, Math.cos(gier) * abstand);
    kamera.lookAt(0.1, 1.5, 0);

    renderer.render(szene, kamera);
    ziel.width = b;
    ziel.height = h;
    ziel.style.width = `${breiteCss}px`;
    ziel.style.height = `${hoeheCss}px`;
    ziel2d.setTransform(1, 0, 0, 1, 0, 0);
    ziel2d.clearRect(0, 0, b, h);
    ziel2d.drawImage(roh, 0, 0);

    frei.freigeben();
    weichT.dispose();
    fleckS.dispose();
    fleckG.dispose();
    umgebung?.dispose();
    return true;
  } catch {
    return false;
  } finally {
    if (renderer) {
      renderer.forceContextLoss();
      renderer.dispose();
    }
  }
}
