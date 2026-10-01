import * as THREE from 'three';
import {
  leuchtTextur,
  plakatTextur,
  skylineTexturen,
  zebraTextur,
} from './texturen';

/**
 * Die Kulisse — alles, was die Straße zu einem Ort macht, aber keine
 * Spielregel kennt: ferne Skyline, Sonne und Mond, Zebrastreifen, Dinge am
 * Straßenrand, Lichtpfützen und Lampenschein.
 *
 * Eine leere Straße zwischen zwei Häuserzeilen sieht nach Testlevel aus. Was
 * sie zur Stadt macht, sind Dinge, die nichts mit dem Spiel zu tun haben und
 * trotzdem **vorbeiziehen**: Das Auge liest daran Tempo ab, und das Gehirn
 * liest daran „hier ist jemand zu Hause".
 *
 * Alle Dinge am Straßenrand sind **instanziert** (ein Zeichenaufruf je Teil
 * für alle Exemplare zusammen) und wandern wie die Laternen auf einem Ring:
 * Was hinten herausläuft, kommt vorn wieder herein.
 */

/** Ringförmig weiterrücken: was hinten rausläuft, kommt vorn wieder rein. */
export function ringZ(reihe: number, abstand: number, anzahl: number, s: number, schub: number) {
  const runde = anzahl * abstand;
  return (((reihe * abstand + schub - s) % runde) + runde) % runde;
}

export type KulisseKontext = {
  szene: THREE.Scene;
  kamera: THREE.Camera;
  strassenBreite: number;
  gehwegBreite: number;
  gehwegHoehe: number;
};

export type Atmosphaere = {
  /** 0 = heller Tag, 1 = tiefe Nacht — steuert alles, was leuchtet. */
  nacht: number;
  /** Farbe des Dunstes am Horizont. */
  dunst: THREE.Color;
};

export type Kulisse = {
  /**
   * Einmal je Bild. `koepfe` sind die Weltpositionen der Laternenköpfe;
   * `s` die zurückgelegte Strecke.
   */
  aktualisieren: (
    s: number,
    dt: number,
    zone: number,
    atmo: Atmosphaere,
    koepfe: readonly THREE.Vector3[],
  ) => void;
  /** Dinge am Straßenrand an- oder abschalten (niedrige Qualitätsstufen). */
  detail: (an: boolean) => void;
};

// ---------------------------------------------------------------------
// Instanzen: viele Exemplare eines Dings in wenigen Zeichenaufrufen
// ---------------------------------------------------------------------
type Teil = {
  geo: THREE.BufferGeometry;
  stoff: THREE.Material;
  matrix: THREE.Matrix4;
  schatten?: boolean;
};

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _achse = new THREE.Vector3(0, 1, 0);

/** Ein Teil an einer Stelle des Dings — Drehungen in Bogenmaß um x, y, z. */
function teil(
  geo: THREE.BufferGeometry,
  stoff: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  schatten = false,
): Teil {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );
  return { geo, stoff, matrix: m, schatten };
}

function instanziert(szene: THREE.Scene, teile: readonly Teil[], anzahl: number) {
  const netze = teile.map((t) => {
    const n = new THREE.InstancedMesh(t.geo, t.stoff, anzahl);
    // Die Instanzen wandern jedes Bild; die Hüllkugel, die beim ersten
    // Zeichnen berechnet würde, wäre sofort veraltet.
    n.frustumCulled = false;
    n.castShadow = !!t.schatten;
    szene.add(n);
    return n;
  });
  return {
    netze,
    setzen(i: number, x: number, y: number, z: number, drehY = 0) {
      _p.set(x, y, z);
      _q.setFromAxisAngle(_achse, drehY);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      teile.forEach((tt, k) => {
        _t.multiplyMatrices(_m, tt.matrix);
        netze[k]!.setMatrixAt(i, _t);
      });
    },
    fertig() {
      for (const n of netze) n.instanceMatrix.needsUpdate = true;
    },
    sichtbar(an: boolean) {
      for (const n of netze) n.visible = an;
    },
  };
}

const lern = (a: number, b: number, f: number) => a + (b - a) * f;

export function kulisseBauen(k: KulisseKontext): Kulisse {
  const { szene, strassenBreite, gehwegBreite, gehwegHoehe } = k;
  const rand = strassenBreite / 2;

  // ===================================================================
  // Skyline, Sonne, Mond
  // ===================================================================
  const leucht = leuchtTextur();

  const skylineEbenen = [
    { saat: 0x51a, z: 168, breite: 300, hoehe: 74, dunkel: 0.1, x: 18 },
    { saat: 0xb77, z: 138, breite: 230, hoehe: 56, dunkel: 0.3, x: -14 },
  ].map((e) => {
    const bilder = skylineTexturen(e.saat);
    const umriss = new THREE.Mesh(
      new THREE.PlaneGeometry(e.breite, e.hoehe),
      new THREE.MeshBasicMaterial({
        map: bilder.umriss,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    umriss.position.set(e.x, e.hoehe / 2 - 3, e.z);
    umriss.rotation.y = Math.PI;
    umriss.renderOrder = -2;
    szene.add(umriss);
    const fenster = new THREE.Mesh(
      new THREE.PlaneGeometry(e.breite, e.hoehe),
      new THREE.MeshBasicMaterial({
        map: bilder.fenster,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    fenster.position.set(e.x, e.hoehe / 2 - 3, e.z - 0.5);
    fenster.rotation.y = Math.PI;
    fenster.renderOrder = -1;
    szene.add(fenster);
    return { umriss, fenster, dunkel: e.dunkel };
  });

  // Die Sonne: eine Scheibe mit weichem Hof. Ihr Hof ist **die** Stelle, an
  // der der Leuchtfilter am Tag etwas zu tun bekommt.
  const sonnenHof = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: leucht,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  sonnenHof.renderOrder = -3;
  szene.add(sonnenHof);
  const sonnenScheibe = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, transparent: true }),
  );
  sonnenScheibe.rotation.y = Math.PI;
  sonnenScheibe.renderOrder = -3;
  szene.add(sonnenScheibe);

  /*
   * Je Zone: wo steht das Gestirn, wie groß, welche Farbe (über 1 = leuchtet im
   * Bloom), wie stark der Hof. Szene-x ist gespiegelt (siehe `bildX` in
   * `szene.ts`): kleines x steht rechts im Bild.
   */
  type Gestirn = {
    x: number;
    y: number;
    r: number;
    farbe: [number, number, number];
    hof: [number, number, number];
    hofGroesse: number;
  };
  const GESTIRN: readonly Gestirn[] = [
    { x: -9, y: 36, r: 6, farbe: [4.6, 4.1, 3.1], hof: [1.2, 1.0, 0.7], hofGroesse: 70 },
    { x: -6, y: 11, r: 9, farbe: [5.0, 2.4, 0.9], hof: [2.2, 1.0, 0.4], hofGroesse: 110 },
    { x: 8, y: 38, r: 4.2, farbe: [1.8, 2.0, 2.5], hof: [0.35, 0.45, 0.7], hofGroesse: 46 },
    { x: -1, y: 20, r: 14, farbe: [2.4, 1.2, 2.2], hof: [1.5, 0.35, 1.4], hofGroesse: 130 },
  ];
  const g: Gestirn = {
    ...GESTIRN[0]!,
    farbe: [...GESTIRN[0]!.farbe],
    hof: [...GESTIRN[0]!.hof],
  };

  // ===================================================================
  // Zebrastreifen — quer über die Straße
  // ===================================================================
  const ZEBRA_ABSTAND = 88;
  const ZEBRA_ANZAHL = 2;
  const zebraBild = zebraTextur();
  const zebraStoff = new THREE.MeshLambertMaterial({
    map: zebraBild,
    transparent: true,
    depthWrite: false,
  });
  const zebraGeo = new THREE.PlaneGeometry(strassenBreite, 3.4);
  const zebras = Array.from({ length: ZEBRA_ANZAHL }, () => {
    const m = new THREE.Mesh(zebraGeo, zebraStoff);
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    szene.add(m);
    return m;
  });
  // Mittelpunkt auf 8,25 mod 11 — genau zwischen zwei Laternen-/Baumreihen
  // und den Dingen am Rand (siehe unten), die auf dem 11-Meter-Raster sitzen.
  const ZEBRA_VERSATZ = 8.25;

  // ===================================================================
  // Dinge am Straßenrand
  // ===================================================================
  /*
   * Alles sitzt auf einem 11-Meter-Raster, das mit den Bäumen und Laternen
   * (die auf Vielfachen von 11 stehen) abgestimmt ist: Die Dinge hier stehen
   * auf ungeraden Halbschritten (5,5 + 11·n), nie auf Baum oder Laterne.
   */
  const stahl = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.45, metalness: 0.6 });
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.6, metalness: 0.3 });
  const gruen = new THREE.MeshStandardMaterial({ color: 0x2f5a46, roughness: 0.6, metalness: 0.2 });
  const holz = new THREE.MeshStandardMaterial({ color: 0xa5703c, roughness: 0.7 });
  const rot = new THREE.MeshStandardMaterial({ color: 0xd13a2f, roughness: 0.4, metalness: 0.2 });
  const blau = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
  const weiss = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
  const glas = new THREE.MeshStandardMaterial({
    color: 0x9cc8e8,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const lampeRot = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.25, 0.2) });
  const lampeGruen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 3.0, 0.8) });
  const lampeAus = new THREE.MeshBasicMaterial({ color: 0x242a33 });

  const zylinder = (ro: number, ru: number, h: number, seg = 12) =>
    new THREE.CylinderGeometry(ro, ru, h, seg);
  const kasten = (b: number, h: number, t: number) => new THREE.BoxGeometry(b, h, t);

  // Mülleimer
  const muell = instanziert(
    szene,
    [
      teil(zylinder(0.21, 0.17, 0.64), gruen, 0, 0.32, 0, 0, 0, 0, true),
      teil(zylinder(0.235, 0.235, 0.07), dunkel, 0, 0.67, 0),
    ],
    12,
  );
  // Hydrant
  const hydrant = instanziert(
    szene,
    [
      teil(zylinder(0.13, 0.15, 0.52, 10), rot, 0, 0.26, 0, 0, 0, 0, true),
      teil(new THREE.SphereGeometry(0.14, 10, 8), rot, 0, 0.54, 0),
      teil(zylinder(0.05, 0.05, 0.38, 8), rot, 0, 0.36, 0, 0, 0, Math.PI / 2),
    ],
    4,
  );
  // Bank — Blickrichtung +z, Lehne bei −z
  const bankTeile = [
    teil(kasten(1.5, 0.06, 0.42), holz, 0, 0.46, 0, 0, 0, 0, true),
    teil(kasten(1.5, 0.3, 0.05), holz, 0, 0.7, -0.2, -0.2, 0, 0, true),
    teil(kasten(0.06, 0.46, 0.4), stahl, -0.6, 0.23, 0, 0, 0, 0, true),
    teil(kasten(0.06, 0.46, 0.4), stahl, 0.6, 0.23, 0, 0, 0, 0, true),
  ];
  const baenke = instanziert(szene, bankTeile, 4);
  // Verkehrsschild: blaue Tafel mit weißem P, Tafel zeigt zur Kamera (−z)
  const schilder = instanziert(
    szene,
    [
      teil(zylinder(0.035, 0.04, 2.5, 8), stahl, 0, 1.25, 0, 0, 0, 0, true),
      teil(kasten(0.58, 0.58, 0.03), weiss, 0, 2.5, 0),
      teil(kasten(0.5, 0.5, 0.035), blau, 0, 2.5, -0.006),
      teil(kasten(0.07, 0.34, 0.01), weiss, -0.09, 2.5, -0.024),
      teil(kasten(0.2, 0.07, 0.01), weiss, 0.03, 2.62, -0.024),
      teil(kasten(0.2, 0.07, 0.01), weiss, 0.03, 2.43, -0.024),
      teil(kasten(0.07, 0.19, 0.01), weiss, 0.125, 2.525, -0.024),
    ],
    6,
  );
  // Ampel: Mast, Gehäuse, drei Linsen. Zwei Ausführungen (Rot/Grün), damit
  // nicht an jeder Kreuzung dasselbe leuchtet.
  const ampelTeile = (oben: THREE.Material, unten: THREE.Material) => [
    teil(zylinder(0.05, 0.06, 3.4, 8), stahl, 0, 1.7, 0, 0, 0, 0, true),
    teil(kasten(0.3, 0.92, 0.26), dunkel, 0, 3.55, 0, 0, 0, 0, true),
    teil(zylinder(0.095, 0.095, 0.04, 14), oben, 0, 3.83, -0.135, Math.PI / 2),
    teil(zylinder(0.095, 0.095, 0.04, 14), lampeAus, 0, 3.55, -0.135, Math.PI / 2),
    teil(zylinder(0.095, 0.095, 0.04, 14), unten, 0, 3.27, -0.135, Math.PI / 2),
  ];
  const ampelRot = instanziert(szene, ampelTeile(lampeRot, lampeAus), 2);
  const ampelGruen = instanziert(szene, ampelTeile(lampeAus, lampeGruen), 2);

  // Haltestelle: Dach, Pfosten, Glasrückwand und ein beleuchtetes Plakat an
  // der Stirnseite. Das Plakat ist der Teil, den man **sieht** — es zeigt zur
  // Kamera (−z) und leuchtet nachts.
  const plakate = [plakatTextur('#ff5fa2', '#ffb347'), plakatTextur('#2dd4bf', '#3b82f6')];
  const plakatStoffe = plakate.map(
    (t) => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.9, 0.9, 0.9) }),
  );
  const haltTeile = (plakat: THREE.Material, seite: number) => [
    teil(kasten(2.7, 0.08, 1.2), dunkel, 0, 2.5, 0, 0, 0, 0, true),
    teil(kasten(0.07, 2.5, 0.07), stahl, -1.28, 1.25, 0.5),
    teil(kasten(0.07, 2.5, 0.07), stahl, 1.28, 1.25, 0.5),
    teil(kasten(0.07, 2.5, 0.07), stahl, -1.28, 1.25, -0.5),
    teil(kasten(0.07, 2.5, 0.07), stahl, 1.28, 1.25, -0.5),
    teil(kasten(2.5, 1.7, 0.04), glas, 0, 1.2, -0.52),
    teil(kasten(1.8, 0.06, 0.4), holz, 0, 0.46, -0.3),
    // Stirnseite mit dem Plakat. `seite` wählt die Stirnseite, die nach der
    // Drehung der Haltestelle **zur Kamera** zeigt: links +x, rechts −x.
    teil(kasten(0.05, 1.5, 0.9), dunkel, seite * 1.34, 1.2, 0),
    teil(kasten(0.02, 1.38, 0.78), plakat, seite * 1.37, 1.2, 0),
  ];
  const haltL = instanziert(szene, haltTeile(plakatStoffe[0]!, 1), 1);
  const haltR = instanziert(szene, haltTeile(plakatStoffe[1]!, -1), 1);

  // ===================================================================
  // Lichtpfützen und Lampenschein
  // ===================================================================
  const POOLS = 12;
  const pfuetzen = Array.from({ length: POOLS }, () => {
    const stoff = new THREE.MeshBasicMaterial({
      map: leucht,
      color: new THREE.Color(1.5, 1.15, 0.65),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), stoff);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    m.visible = false;
    szene.add(m);
    return { m, stoff };
  });
  const halos = Array.from({ length: POOLS }, () => {
    const stoff = new THREE.SpriteMaterial({
      map: leucht,
      color: new THREE.Color(2.6, 1.9, 1.0),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const sp = new THREE.Sprite(stoff);
    sp.scale.set(3.4, 3.4, 1);
    sp.visible = false;
    szene.add(sp);
    return { sp, stoff };
  });

  let detailAn = true;
  const detail = (an: boolean) => {
    detailAn = an;
    for (const i of [muell, hydrant, baenke, schilder, ampelRot, ampelGruen, haltL, haltR]) i.sichtbar(an);
    for (const z of zebras) z.visible = an;
  };

  const farbe = new THREE.Color();

  const aktualisieren: Kulisse['aktualisieren'] = (s, dt, zone, atmo, koepfe) => {
    const nacht = atmo.nacht;

    // --- Sonne / Mond: gleitet zur Stellung der Zone -------------------
    const ziel = GESTIRN[zone % GESTIRN.length]!;
    const f = Math.min(1, dt * 1.6);
    g.x = lern(g.x, ziel.x, f);
    g.y = lern(g.y, ziel.y, f);
    g.r = lern(g.r, ziel.r, f);
    g.hofGroesse = lern(g.hofGroesse, ziel.hofGroesse, f);
    for (let i = 0; i < 3; i++) {
      g.farbe[i] = lern(g.farbe[i]!, ziel.farbe[i]!, f);
      g.hof[i] = lern(g.hof[i]!, ziel.hof[i]!, f);
    }
    sonnenScheibe.position.set(g.x, g.y, 170);
    sonnenScheibe.scale.setScalar(g.r);
    (sonnenScheibe.material as THREE.MeshBasicMaterial).color.setRGB(g.farbe[0]!, g.farbe[1]!, g.farbe[2]!);
    sonnenHof.position.set(g.x, g.y, 169);
    sonnenHof.scale.set(g.hofGroesse, g.hofGroesse, 1);
    (sonnenHof.material as THREE.SpriteMaterial).color.setRGB(g.hof[0]!, g.hof[1]!, g.hof[2]!);

    // --- Skyline: Farbe aus dem Dunst, Fenster nachts an ----------------
    for (const e of skylineEbenen) {
      farbe.copy(atmo.dunst).multiplyScalar(1 - e.dunkel);
      (e.umriss.material as THREE.MeshBasicMaterial).color.copy(farbe);
      const fm = e.fenster.material as THREE.MeshBasicMaterial;
      fm.color.setRGB(1.2, 1.0, 0.8);
      fm.opacity = Math.max(0, (nacht - 0.15) / 0.85);
      e.fenster.visible = fm.opacity > 0.01;
    }

    if (!detailAn) {
      for (const p of pfuetzen) p.m.visible = false;
      for (const h of halos) h.sp.visible = false;
      return;
    }

    // --- Zebrastreifen ---------------------------------------------------
    zebras.forEach((z, i) => {
      z.position.set(0, 0.018, ringZ(i, ZEBRA_ABSTAND, ZEBRA_ANZAHL, s, ZEBRA_VERSATZ));
    });

    // --- Dinge am Rand -----------------------------------------------------
    const xAbstand = (a: number) => rand + a;
    // Seiten: −1 links (Szene-x negativ), +1 rechts. Blickrichtung zur Straße:
    // links nach +x (Drehung +90°), rechts nach −x (−90°).
    const zumRand = (seite: number) => (seite < 0 ? Math.PI / 2 : -Math.PI / 2);

    // Mülleimer: 6 je Seite, Abstand 22, links bei 5,5, rechts bei 16,5
    for (let i = 0; i < 12; i++) {
      const seite = i % 2 === 0 ? -1 : 1;
      const reihe = Math.floor(i / 2);
      const z = ringZ(reihe, 22, 6, s, seite < 0 ? 5.5 : 16.5);
      muell.setzen(i, seite * xAbstand(1.25), gehwegHoehe, z);
    }
    muell.fertig();
    // Hydranten: 2 je Seite, Abstand 66
    for (let i = 0; i < 4; i++) {
      const seite = i % 2 === 0 ? -1 : 1;
      const reihe = Math.floor(i / 2);
      hydrant.setzen(i, seite * xAbstand(0.55), gehwegHoehe, ringZ(reihe, 66, 2, s, seite < 0 ? 38.5 : 27.5));
    }
    hydrant.fertig();
    // Bänke: 2 je Seite, Abstand 66, an der Hauswand mit Blick zur Straße
    for (let i = 0; i < 4; i++) {
      const seite = i % 2 === 0 ? -1 : 1;
      const reihe = Math.floor(i / 2);
      baenke.setzen(
        i,
        seite * xAbstand(gehwegBreite - 0.55),
        gehwegHoehe,
        ringZ(reihe, 66, 2, s, seite < 0 ? 16.5 : 5.5),
        zumRand(seite),
      );
    }
    baenke.fertig();
    // Schilder: 3 je Seite, Abstand 66 → Ring 198 deckt das Sichtfenster ab
    for (let i = 0; i < 6; i++) {
      const seite = i % 2 === 0 ? -1 : 1;
      const reihe = Math.floor(i / 2);
      schilder.setzen(i, seite * xAbstand(0.42), gehwegHoehe, ringZ(reihe, 66, 3, s, seite < 0 ? 60.5 : 49.5));
    }
    schilder.fertig();
    // Ampeln am Zebrastreifen: links Rot, rechts Grün — am Streifen davor
    for (let i = 0; i < 2; i++) {
      const z = ringZ(i, ZEBRA_ABSTAND, ZEBRA_ANZAHL, s, ZEBRA_VERSATZ - 2.1);
      ampelRot.setzen(i, -xAbstand(0.5), gehwegHoehe, z);
      ampelGruen.setzen(i, xAbstand(0.5), gehwegHoehe, z);
    }
    ampelRot.fertig();
    ampelGruen.fertig();
    // Haltestellen: eine je Seite, Ring 132, Dach zeigt zur Straße
    haltL.setzen(0, -xAbstand(gehwegBreite - 0.8), gehwegHoehe, ringZ(0, 132, 1, s, 82.5), Math.PI / 2);
    haltL.fertig();
    haltR.setzen(0, xAbstand(gehwegBreite - 0.8), gehwegHoehe, ringZ(0, 132, 1, s, 38.5 + 33), -Math.PI / 2);
    haltR.fertig();

    // --- Lichtpfützen und Halos an den Laternen ---------------------------
    const an = Math.max(0, (nacht - 0.12) / 0.88);
    for (let i = 0; i < POOLS; i++) {
      const kopf = koepfe[i];
      const p = pfuetzen[i]!;
      const h = halos[i]!;
      if (!kopf || an <= 0.01) {
        p.m.visible = false;
        h.sp.visible = false;
        continue;
      }
      const dz = kopf.z;
      // Mit der Entfernung ausblenden: Die Ferne gehört dem Dunst.
      const fern = Math.max(0, Math.min(1, 1 - (dz - 20) / 90));
      p.m.visible = true;
      p.m.position.set(kopf.x, 0.03, kopf.z);
      p.stoff.opacity = an * 0.6 * fern;
      h.sp.visible = true;
      h.sp.position.copy(kopf);
      h.stoff.opacity = (0.25 + an * 0.45) * fern;
    }
  };

  return { aktualisieren, detail };
}
