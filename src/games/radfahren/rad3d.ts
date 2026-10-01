import * as THREE from 'three';
import { nachWelt, segment, ellipsoid, quader, kugel } from './bauteile';
import type { Segment } from './bauteile';
import { RAD_R } from './radgeo';
import type { P, RadGeo } from './radgeo';
import type { Stoffe } from './stoffe';

/**
 * Das Mountainbike als Körper.
 *
 * Alle Maße kommen aus `radgeo.ts` (rein, getestet): Dieselben Zahlen, die in der
 * 2-D-Zeichnung ein Rad ergaben, ergeben hier eines mit Tiefe. Das Modell steht im
 * Bezugssystem des Rades — x nach vorn, y nach **oben** (die Zahlen aus `radgeo` zeigen
 * nach unten, `nachWelt` dreht sie um), z quer: **+z ist die rechte Seite des Fahrers**,
 * und die liegt der Kamera zu. Dort sitzen Antrieb, Kette und das nahe Bein.
 *
 * **Gebaut wird einmal, danach nur umgesetzt.** Jedes Rohr ist ein Zylinder, der zwischen
 * zwei Punkten gestreckt wird (`bauteile.ts`); pro Bild entstehen weder Geometrien noch
 * Materialien. Die Räder sind eigene Gruppen, die sich um ihre Achse drehen — das
 * Reifenprofil läuft mit, deshalb ist die Fahrt auch ohne Boden daneben zu sehen.
 *
 * Beim Einfedern bleiben die Räder auf dem Boden, der Rahmen sinkt (siehe `radgeo.ts`).
 * Der Dämpfer sitzt deshalb zwischen Rahmen und Sitzstrebe und staucht von selbst.
 */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Setzt ein Rohr zwischen zwei Punkten des Rades, jeder mit eigenem z. */
function setze(s: Segment, pa: P, za: number, pb: P, zb: number, r: number): void {
  s.setzen(nachWelt(_a, pa, za), nachWelt(_b, pb, zb), r);
}

const plus = (p: P, dx: number, dy: number): P => ({ x: p.x + dx, y: p.y + dy });
const lern = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export type RadEingabe = {
  geo: RadGeo;
  pedalNah: P;
  pedalFern: P;
  /** Gesamtdrehung der Laufräder in Radiant. */
  radDrehung: number;
};

export type Rad3D = {
  gruppe: THREE.Group;
  aktualisieren: (e: RadEingabe) => void;
};

/** Ein Laufrad: Reifen mit Profil, Felge, Speichen, Nabe. Dreht sich um seine z-Achse. */
function laufradBauen(stoffe: Stoffe, mitScheibe: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const gummi = stoffe.rad.gummi;
  const tube = 0.044;
  const major = RAD_R - tube;

  const reifen = new THREE.Mesh(new THREE.TorusGeometry(major, tube, 12, 48), gummi);
  g.add(reifen);

  // Stollen: eine Reihe in der Mitte, zwei an den Flanken, jede um eine halbe Teilung
  // versetzt — wie bei einem echten Geländereifen. Sie ragen nur einen Zentimeter heraus:
  // „zu grobstollig" war ein Kritikpunkt an der 2-D-Fassung.
  const teilung = 64;
  const stollen = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.016, 0.02), stoffe.rad.profil, teilung * 3);
  const o = new THREE.Object3D();
  const qz = new THREE.Quaternion();
  const qy = new THREE.Quaternion();
  const zAchse = new THREE.Vector3(0, 0, 1);
  const yAchse = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (const phi of [0, 1.05, -1.05]) {
    for (let i = 0; i < teilung; i++) {
      const w = ((i + (phi === 0 ? 0 : 0.5)) / teilung) * Math.PI * 2;
      const radial = major + tube * Math.cos(phi);
      o.position.set(Math.cos(w) * radial, Math.sin(w) * radial, tube * Math.sin(phi));
      qz.setFromAxisAngle(zAchse, w);
      qy.setFromAxisAngle(yAchse, -phi);
      o.quaternion.copy(qz).multiply(qy);
      o.updateMatrix();
      stollen.setMatrixAt(n++, o.matrix);
    }
  }
  g.add(stollen);

  const felge = new THREE.Mesh(new THREE.TorusGeometry(major - tube + 0.004, 0.012, 8, 48), stoffe.rad.felge);
  g.add(felge);

  // Speichen: 32 Linien in Kreuzung, abwechselnd zur linken und rechten Nabenflansch.
  const pos: number[] = [];
  const innen = 0.032;
  const aussen = major - tube;
  for (let i = 0; i < 32; i++) {
    const w = (i / 32) * Math.PI * 2;
    const seite = i % 2 === 0 ? 1 : -1;
    const wn = w + (i % 4 < 2 ? 0.2 : -0.2);
    pos.push(Math.cos(wn) * innen, Math.sin(wn) * innen, seite * 0.026, Math.cos(w) * aussen, Math.sin(w) * aussen, 0);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.LineSegments(sg, stoffe.rad.speichen));

  const nabe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 14).rotateX(Math.PI / 2), stoffe.rad.nabe);
  g.add(nabe);
  const achse = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.19, 8).rotateX(Math.PI / 2), stoffe.rad.schwarzMetall);
  g.add(achse);

  // Bremsscheibe auf der gewählten Seite.
  const scheibe = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.1, 28), stoffe.rad.scheibe);
  scheibe.position.z = 0.046 * mitScheibe;
  g.add(scheibe);
  return g;
}

export function radBauen(stoffe: Stoffe): Rad3D {
  const wurzel = new THREE.Group();
  const R = stoffe.rad;

  const hinten = laufradBauen(stoffe, -1);
  const vorn = laufradBauen(stoffe, 1);
  wurzel.add(hinten, vorn);

  // --- Rahmen -------------------------------------------------------
  const rohr = (stoff: THREE.Material, radial = 10, extra: { verjuengung?: number; kappen?: boolean; breite?: number } = {}) => {
    const s = segment(stoff, { radial, ...extra });
    wurzel.add(s.mesh);
    return s;
  };
  const unterrohr = rohr(R.rahmen, 12, { verjuengung: 0.92 });
  const oberrohr = rohr(R.rahmen, 12, { verjuengung: 1.08 });
  const sitzrohr = rohr(R.rahmen, 10);
  const steuerrohr = rohr(R.rahmenDunkel, 14, { kappen: true });
  const kettenstrebe = [rohr(R.rahmenDunkel, 8), rohr(R.rahmenDunkel, 8)];
  const sitzstrebe = [rohr(R.rahmenDunkel, 8), rohr(R.rahmenDunkel, 8)];
  const akzentStreifen = rohr(R.akzent, 8, { kappen: false });

  // Sattelstütze, Klemme, Sattel.
  const stuetze = rohr(R.chrom, 10);
  const klemmring = rohr(R.schwarzMetall, 10, { kappen: true });
  const sattelHinten = ellipsoid(R.sattel, 1, 1, 1, 14);
  const sattelNase = ellipsoid(R.sattel, 1, 1, 1, 12);
  const sattelGestell = [rohr(R.schwarzMetall, 6), rohr(R.schwarzMetall, 6)];
  wurzel.add(sattelHinten, sattelNase);

  // Gabel: zwei Brücken, zwei Standrohre, zwei Tauchrohre, Achse.
  const kroneUnten = rohr(R.eloxal, 10, { kappen: true });
  const kroneOben = rohr(R.eloxal, 10, { kappen: true });
  const standrohr = [rohr(R.chrom, 10), rohr(R.chrom, 10)];
  const tauchrohr = [rohr(R.eloxal, 12, { verjuengung: 0.9, kappen: true }), rohr(R.eloxal, 12, { verjuengung: 0.9, kappen: true })];
  const bogen = rohr(R.eloxal, 10, { kappen: true });
  const bremssattel = quader(R.schwarzMetall, 0.05, 0.065, 0.03);
  wurzel.add(bremssattel);

  // Lenker: Mittelteil, zwei Aufbiegungen, zwei Enden mit Griff, Vorbau, zwei Hebel.
  const vorbau = rohr(R.schwarzMetall, 10, { kappen: true });
  const lenkerMitte = rohr(R.schwarzMetall, 10, { kappen: true });
  const lenkerAuf = [rohr(R.schwarzMetall, 10), rohr(R.schwarzMetall, 10)];
  const lenkerEnde = [rohr(R.schwarzMetall, 10), rohr(R.schwarzMetall, 10)];
  const griff = [rohr(R.griff, 10, { kappen: true }), rohr(R.griff, 10, { kappen: true })];
  const hebel = [rohr(R.schwarzMetall, 6), rohr(R.schwarzMetall, 6)];

  // Dämpfer: Körper, Kolben, Federwindungen.
  const daempferKoerper = rohr(R.schwarzMetall, 10, { kappen: true });
  const daempferKolben = rohr(R.chrom, 8);
  const WINDUNGEN = 9;
  const windungsGeo = new THREE.TorusGeometry(0.03, 0.0065, 6, 14);
  const windungen: THREE.Mesh[] = [];
  for (let i = 0; i < WINDUNGEN; i++) {
    const w = new THREE.Mesh(windungsGeo, R.feder);
    windungen.push(w);
    wurzel.add(w);
  }

  // --- Antrieb ------------------------------------------------------
  const kurbelNah = rohr(R.schwarzMetall, 8, { breite: 1.8 });
  const kurbelFern = rohr(R.schwarzMetall, 8, { breite: 1.8 });
  const pedalNahM = quader(R.schwarzMetall, 0.115, 0.022, 0.1);
  const pedalFernM = quader(R.schwarzMetall, 0.115, 0.022, 0.1);
  wurzel.add(pedalNahM, pedalFernM);
  const kettenblatt = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.012, 28).rotateX(Math.PI / 2), R.schwarzMetall);
  const kettenblattKante = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.007, 6, 28), R.kette);
  const kettenblattInnen = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 18).rotateX(Math.PI / 2), R.akzent);
  const tretlagerKappe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.17, 12).rotateX(Math.PI / 2), R.schwarzMetall);
  wurzel.add(kettenblatt, kettenblattKante, kettenblattInnen, tretlagerKappe);

  const ritzel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.062, 0.042, 18).rotateX(Math.PI / 2), R.kette);
  wurzel.add(ritzel);
  const schaltwerk = rohr(R.schwarzMetall, 8, { breite: 1.6 });
  const schaltkoerper = ellipsoid(R.schwarzMetall, 0.03, 0.04, 0.026, 10);
  const leitrolle = [kugel(R.akzent, 0.026, 12), kugel(R.akzent, 0.022, 12)];
  leitrolle.forEach((l) => {
    l.scale.z = 0.35;
    wurzel.add(l);
  });
  wurzel.add(schaltkoerper);
  const kette = [
    rohr(R.kette, 6, { breite: 2.6 }), // oben
    rohr(R.kette, 6, { breite: 2.6 }), // unten: Kettenblatt → untere Leitrolle
    rohr(R.kette, 6, { breite: 2.6 }), // zwischen den Leitrollen
    rohr(R.kette, 6, { breite: 2.6 }), // obere Leitrolle → Ritzel
  ];

  // Der Rahmen soll in Lackfarbe glänzen; die Akzentfarbe zieht sich als Streifen übers Unterrohr.

  const aktualisieren = (e: RadEingabe) => {
    const { geo, pedalNah, pedalFern, radDrehung } = e;

    // Räder: in die Nabe setzen und drehen. Die Drehung läuft **im Uhrzeigersinn** (von rechts
    // betrachtet nach vorn rollend), im y-nach-oben-System ist das eine negative Drehung um z.
    nachWelt(hinten.position, geo.nabeHinten);
    nachWelt(vorn.position, geo.nabeVorn);
    hinten.rotation.z = -radDrehung;
    vorn.rotation.z = -radDrehung;

    // Rahmen.
    setze(unterrohr, geo.unterEnde, 0, geo.tretlager, 0, 0.042);
    setze(oberrohr, geo.oberEnde, 0, geo.sattel, 0, 0.036);
    setze(sitzrohr, geo.tretlager, 0, plus(geo.sattel, geo.sattelRichtung.x * 0.03, geo.sattelRichtung.y * 0.03), 0, 0.032);
    setze(steuerrohr, plus(geo.gabelOben, -geo.gabelAchse.x * 0.01, -geo.gabelAchse.y * 0.01), 0, geo.steuerkopf, 0, 0.038);
    // Hinterbau: zwei Streben je Seite, vom Tretlager bzw. vom Sitzrohr zur Hinterradnabe.
    for (const s of [1, -1] as const) {
      const i = s === 1 ? 0 : 1;
      setze(kettenstrebe[i]!, geo.tretlager, s * 0.032, geo.nabeHinten, s * 0.062, 0.019);
      setze(sitzstrebe[i]!, geo.sitzstrebeOben, s * 0.026, geo.nabeHinten, s * 0.062, 0.015);
    }
    // Ein Streifen in der Akzentfarbe auf dem Unterrohr.
    setze(akzentStreifen, lern(geo.unterEnde, geo.tretlager, 0.18), 0.0, lern(geo.unterEnde, geo.tretlager, 0.7), 0.0, 0.0435);

    // Sattel.
    const sm = geo.sattelMitte;
    setze(stuetze, geo.stuetzeUnten, 0, plus(geo.stuetzeOben, geo.sattelRichtung.x * 0.03, geo.sattelRichtung.y * 0.03), 0, 0.0145);
    setze(klemmring, plus(geo.stuetzeUnten, geo.sattelRichtung.x * 0.04, geo.sattelRichtung.y * 0.04), 0, plus(geo.stuetzeUnten, geo.sattelRichtung.x * 0.075, geo.sattelRichtung.y * 0.075), 0, 0.019);
    nachWelt(sattelHinten.position, plus(sm, -0.055, -0.012));
    sattelHinten.scale.set(0.09, 0.033, 0.064);
    sattelHinten.rotation.z = 0.04;
    nachWelt(sattelNase.position, plus(sm, 0.075, -0.004));
    sattelNase.scale.set(0.095, 0.026, 0.033);
    sattelNase.rotation.z = -0.02;
    for (const s of [1, -1] as const) {
      const i = s === 1 ? 0 : 1;
      setze(sattelGestell[i]!, plus(sm, -0.07, 0.014), s * 0.028, plus(sm, 0.08, 0.012), s * 0.014, 0.0055);
    }

    // Gabel. Die Tauchrohre sitzen an der Nabe und reichen eine feste Länge nach oben auf die
    // Krone zu; die Standrohre kommen von der oberen Brücke herunter und tauchen ein.
    const naheKrone = geo.gabelOben;
    const dx = naheKrone.x - geo.nabeVorn.x;
    const dy = naheKrone.y - geo.nabeVorn.y;
    const dl = Math.hypot(dx, dy) || 1;
    const richtung = { x: dx / dl, y: dy / dl };
    const tauchLaenge = 0.27;
    const tauchOben = plus(geo.nabeVorn, richtung.x * tauchLaenge, richtung.y * tauchLaenge);
    for (const s of [1, -1] as const) {
      const i = s === 1 ? 0 : 1;
      setze(standrohr[i]!, tauchOben, s * 0.088, geo.standOben, s * 0.088, 0.0175);
      setze(tauchrohr[i]!, plus(geo.nabeVorn, 0, 0), s * 0.088, tauchOben, s * 0.088, 0.027);
    }
    setze(kroneUnten, geo.gabelOben, -0.1, geo.gabelOben, 0.1, 0.03);
    setze(kroneOben, geo.standOben, -0.1, geo.standOben, 0.1, 0.026);
    // Der Bogen über dem Vorderrad verbindet die Tauchrohre knapp über dem Reifen.
    const bogenP = plus(geo.nabeVorn, richtung.x * 0.2, richtung.y * 0.2);
    setze(bogen, bogenP, -0.088, bogenP, 0.088, 0.017);
    nachWelt(bremssattel.position, plus(geo.nabeVorn, richtung.x * 0.1 + 0.035, richtung.y * 0.1 + 0.02), 0.075);

    // Lenker.
    const lenkerHoehe = geo.klemme;
    setze(vorbau, geo.standOben, 0, lenkerHoehe, 0, 0.026);
    setze(lenkerMitte, lenkerHoehe, -0.14, lenkerHoehe, 0.14, 0.0145);
    for (const s of [1, -1] as const) {
      const i = s === 1 ? 0 : 1;
      // Aufbiegung vom Mittelteil zum Griffpunkt (`geo.lenker` ist die Mitte der Griffe).
      setze(lenkerAuf[i]!, lenkerHoehe, s * 0.14, geo.lenker, s * 0.23, 0.0145);
      setze(lenkerEnde[i]!, geo.lenker, s * 0.23, geo.lenker, s * 0.37, 0.0145);
      setze(griff[i]!, geo.lenker, s * 0.27, geo.lenker, s * 0.375, 0.0215);
      setze(hebel[i]!, plus(geo.lenker, 0.008, 0.008), s * 0.265, plus(geo.lenker, 0.085, 0.025), s * 0.265, 0.0055);
    }

    // Dämpfer: oben am Rahmen vor dem Sattelrohr, unten an der Sitzstrebe. Weil die Nabe am
    // Boden bleibt und der Rahmen einsinkt, wird der Abstand beim Einfedern von selbst kürzer.
    const dOben = plus(geo.sattel, 0.115, 0.055);
    const dUnten = lern(geo.sitzstrebeOben, geo.nabeHinten, 0.5);
    setze(daempferKoerper, dOben, 0, lern(dOben, dUnten, 0.38), 0, 0.024);
    setze(daempferKolben, lern(dOben, dUnten, 0.36), 0, dUnten, 0, 0.011);
    for (let i = 0; i < WINDUNGEN; i++) {
      const t = 0.1 + (0.8 * i) / (WINDUNGEN - 1);
      const p = lern(dOben, dUnten, t);
      const w = windungen[i]!;
      nachWelt(w.position, p);
      // Die Windungen stehen quer zur Achse des Dämpfers.
      const winkel = Math.atan2(-(dUnten.y - dOben.y), dUnten.x - dOben.x);
      w.rotation.set(0, Math.PI / 2, 0);
      w.rotation.order = 'ZYX';
      w.rotation.z = winkel;
    }

    // Antrieb. Die nahe Seite (+z) trägt Kettenblatt, Kette, Ritzel und Schaltwerk.
    const tl = geo.tretlager;
    setze(kurbelNah, tl, 0.088, pedalNah, 0.1, 0.014);
    setze(kurbelFern, tl, -0.088, pedalFern, -0.1, 0.014);
    nachWelt(pedalNahM.position, pedalNah, 0.122);
    nachWelt(pedalFernM.position, pedalFern, -0.122);
    nachWelt(kettenblatt.position, tl, 0.07);
    nachWelt(kettenblattKante.position, tl, 0.07);
    nachWelt(kettenblattInnen.position, tl, 0.078);
    nachWelt(tretlagerKappe.position, tl, 0);
    nachWelt(ritzel.position, geo.nabeHinten, 0.058);

    const nb = geo.nabeHinten;
    const schaltOben = plus(nb, -0.01, 0.06);
    const rolle1 = plus(nb, -0.012, 0.115);
    const rolle2 = plus(nb, -0.06, 0.17);
    nachWelt(schaltkoerper.position, schaltOben, 0.062);
    setze(schaltwerk, schaltOben, 0.062, rolle2, 0.062, 0.012);
    nachWelt(leitrolle[0]!.position, rolle1, 0.062);
    nachWelt(leitrolle[1]!.position, rolle2, 0.062);
    // Die Kette: oben von Kettenblatt zum Ritzel, unten über die beiden Leitrollen zurück.
    const blattOben = plus(tl, 0.012, -0.078);
    const ritzelOben = plus(nb, 0, -0.058);
    const blattUnten = plus(tl, -0.012, 0.078);
    setze(kette[0]!, blattOben, 0.07, ritzelOben, 0.058, 0.007);
    setze(kette[1]!, blattUnten, 0.07, plus(rolle2, 0.02, 0.026), 0.062, 0.007);
    setze(kette[2]!, plus(rolle2, -0.008, 0.026), 0.062, plus(rolle1, -0.026, -0.005), 0.062, 0.007);
    setze(kette[3]!, plus(rolle1, 0.026, -0.018), 0.062, plus(nb, 0, 0.056), 0.058, 0.007);
  };

  return { gruppe: wurzel, aktualisieren };
}
