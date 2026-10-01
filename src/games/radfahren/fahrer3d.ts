import * as THREE from 'three';
import { nachWelt, segment, ellipsoid, kugel } from './bauteile';
import type { Segment } from './bauteile';
import type { P, Skelett } from './fahrer';
import type { Stoffe } from './stoffe';

/**
 * Der Fahrer als Körper.
 *
 * Die **Gelenke** kommen fertig aus `skelettBerechnen` (bzw. `sturzSkelett`), beide rein und
 * getestet — hier wird nur Fleisch darum gelegt. Dadurch sind Reichweite von Arm und Bein,
 * die stabile Ellbogenseite und die Haltung dieselben wie in der 2-D-Fassung; nichts davon
 * ist hier noch einmal zu beweisen.
 *
 * **Dieselbe Regel wie bei der Figur von Dash City: Überlappung statt Berührung.** Wo zwei
 * Glieder zusammentreffen, sitzt eine Kugel (Schulter, Hüfte, Knie, Ellbogen) und schließt den
 * Spalt. Glieder verjüngen sich zum Ende hin, Schultern und Hüfte sind kräftiger als Handgelenk
 * und Knöchel — „Strichmännchen" entstand in der 2-D-Fassung genau dort, wo alles gleich dick war.
 *
 * Im Bezugssystem des Rades: x nach vorn, y nach oben, **+z ist die rechte Seite**. Die nahe
 * Seite (der Kamera zugewandt) ist also `+z`; die ferne wird mit den dunkleren Stoffen
 * gebaut, damit sie sich vom nahen Bein und Arm absetzt — das war in 2-D schon so.
 */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function setze(s: Segment, pa: P, za: number, pb: P, zb: number, r: number): void {
  s.setzen(nachWelt(_a, pa, za), nachWelt(_b, pb, zb), r);
}

const plus = (p: P, dx: number, dy: number): P => ({ x: p.x + dx, y: p.y + dy });
const minus = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const lern = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const laenge = (p: P) => Math.hypot(p.x, p.y);
const norm = (p: P): P => {
  const l = laenge(p) || 1;
  return { x: p.x / l, y: p.y / l };
};

/** Drehung eines Körpers in der Bildebene, wenn er in Richtung `richtung` (y nach unten) zeigen soll. */
function ausrichten(m: THREE.Object3D, richtung: P): void {
  // Winkel in der y-nach-oben-Welt: die Richtung (x, −y).
  m.rotation.z = Math.atan2(-richtung.y, richtung.x);
}

export type Fahrer3D = {
  gruppe: THREE.Group;
  /** Setzt alle Körper nach den Gelenken. */
  setzen: (s: Skelett) => void;
};

/** Seitenabstände (z) der Gelenke — hier steckt die „Breite" des Körpers, die man von der Seite nie sieht. */
const Z = {
  huefte: 0.1,
  knie: 0.112,
  fuss: 0.108,
  schulter: 0.19,
  ellbogen: 0.265,
  hand: 0.335,
};

export function fahrerBauen(stoffe: Stoffe): Fahrer3D {
  const wurzel = new THREE.Group();
  const F = stoffe.fahrer;

  const rohr = (stoff: THREE.Material, radial: number, verjuengung = 1, breite = 1) => {
    const s = segment(stoff, { radial, verjuengung, breite });
    wurzel.add(s.mesh);
    return s;
  };
  const koerper = <T extends THREE.Object3D>(o: T): T => {
    wurzel.add(o);
    return o;
  };

  // --- Rumpf ----------------------------------------------------------
  const rumpf = rohr(F.trikot, 20, 0.78, 1.5);
  const brust = koerper(ellipsoid(F.trikot, 1, 1, 1, 18));
  const becken = koerper(ellipsoid(F.hose, 1, 1, 1, 16));
  const saum = rohr(F.trikotDunkel, 20, 1, 1.45);
  const hals = rohr(F.haut, 10, 1.0);
  const kragen = koerper(ellipsoid(F.trikotDunkel, 1, 1, 1, 12));
  const rucksack = koerper(ellipsoid(F.rucksack, 1, 1, 1, 14));
  const rucksackTasche = koerper(ellipsoid(F.schoner, 1, 1, 1, 10));
  const gurt = [rohr(F.rucksack, 6, 1), rohr(F.rucksack, 6, 1)];
  const schulterKugel = [koerper(kugel(F.trikot, 1, 14)), koerper(kugel(F.trikotDunkel, 1, 14))];
  const hueftKugel = [koerper(kugel(F.hose, 1, 14)), koerper(kugel(F.hoseDunkel, 1, 14))];

  // --- Kopf -----------------------------------------------------------
  const kopfGruppe = new THREE.Group();
  wurzel.add(kopfGruppe);
  const schaedel = ellipsoid(F.haut, 0.095, 0.1, 0.088, 16);
  const nase = ellipsoid(F.haut, 0.02, 0.025, 0.02, 8);
  nase.position.set(0.095, -0.012, 0);
  // Helmschale: sitzt über Stirn und Hinterkopf, vorn bleibt das Gesicht frei.
  const schale = ellipsoid(F.helm, 0.132, 0.12, 0.116, 22);
  schale.position.set(-0.018, 0.03, 0);
  const streifen = ellipsoid(F.helmRot, 0.134, 0.018, 0.048, 14);
  streifen.position.set(-0.014, 0.084, 0);
  streifen.rotation.z = 0.06;
  const kinnbuegel = ellipsoid(F.helm, 0.064, 0.036, 0.078, 14);
  kinnbuegel.position.set(0.078, -0.092, 0);
  kinnbuegel.rotation.z = 0.18;
  const kinnLueftung = ellipsoid(F.schonerKappe, 0.012, 0.014, 0.04, 8);
  kinnLueftung.position.set(0.136, -0.086, 0);
  const schirm = ellipsoid(F.helmTeal, 0.085, 0.01, 0.09, 12);
  schirm.position.set(0.1, 0.076, 0);
  schirm.rotation.z = 0.2;
  const brille = ellipsoid(F.brille, 0.038, 0.042, 0.108, 12);
  brille.position.set(0.1, 0.0, 0);
  const linse = ellipsoid(F.linse, 0.016, 0.03, 0.09, 12);
  linse.position.set(0.131, 0.0, 0);
  const brillenband = ellipsoid(F.brille, 0.1, 0.012, 0.1, 12);
  brillenband.position.set(-0.01, 0.0, 0);
  brillenband.scale.set(0.108, 0.014, 0.11);
  kopfGruppe.add(schaedel, nase, schale, streifen, kinnbuegel, kinnLueftung, schirm, brille, linse, brillenband);

  // --- Beine ----------------------------------------------------------
  type Bein = {
    oberschenkel: Segment;
    unterschenkel: Segment;
    knieKugel: THREE.Mesh;
    knieschoner: THREE.Mesh;
    schienbein: THREE.Mesh;
    socke: Segment;
    schuh: THREE.Mesh;
    sohle: THREE.Mesh;
    kappe: THREE.Mesh;
  };
  const beinBauen = (nah: boolean): Bein => {
    const hose = nah ? F.hose : F.hoseDunkel;
    const schuhStoff = nah ? F.schuh : F.schuhDunkel;
    return {
      oberschenkel: rohr(hose, 14, 1.38),
      unterschenkel: rohr(hose, 14, 1.42),
      knieKugel: koerper(kugel(hose, 1, 12)),
      knieschoner: koerper(ellipsoid(F.schoner, 1, 1, 1, 12)),
      kappe: koerper(ellipsoid(F.schonerKappe, 1, 1, 1, 10)),
      schienbein: koerper(ellipsoid(F.schoner, 1, 1, 1, 12)),
      socke: rohr(F.socke, 10, 1.1),
      schuh: koerper(ellipsoid(schuhStoff, 1, 1, 1, 14)),
      sohle: koerper(ellipsoid(F.schuhDunkel, 1, 1, 1, 12)),
    };
  };
  const beinNah = beinBauen(true);
  const beinFern = beinBauen(false);

  // --- Arme -----------------------------------------------------------
  type Arm = {
    oberarm: Segment;
    unterarm: Segment;
    ellbogenKugel: THREE.Mesh;
    ellbogenSchoner: THREE.Mesh;
    manschette: Segment;
    faust: THREE.Mesh;
    daumen: THREE.Mesh;
  };
  const armBauen = (nah: boolean): Arm => {
    const stoff = nah ? F.trikot : F.trikotDunkel;
    return {
      oberarm: rohr(stoff, 12, 1.22),
      unterarm: rohr(stoff, 12, 1.28),
      ellbogenKugel: koerper(kugel(stoff, 1, 12)),
      ellbogenSchoner: koerper(ellipsoid(F.schoner, 1, 1, 1, 12)),
      manschette: rohr(F.schonerKappe, 10, 1),
      faust: koerper(ellipsoid(F.handschuh, 1, 1, 1, 12)),
      daumen: koerper(ellipsoid(F.handschuh, 1, 1, 1, 8)),
    };
  };
  const armNah = armBauen(true);
  const armFern = armBauen(false);

  /** Ein Glied mit Kugel am Ansatz: zeichnet Oberschenkel / Unterschenkel. */
  const setzen = (s: Skelett) => {
    // ===== Rumpf =====
    const huefte = s.huefte;
    const schulter = s.schulter;
    const achse = norm(minus(schulter, huefte));
    // Der Rücken: senkrecht zur Rumpfachse, nach hinten. Für eine senkrechte Achse (0, −1) ergibt
    // (achse.y, −achse.x) den Vektor (−1, 0), und beim Vorlehnen wandert er mit nach oben.
    const ruecken: P = { x: achse.y, y: -achse.x };

    setze(rumpf, plus(huefte, achse.x * 0.02, achse.y * 0.02), 0, plus(schulter, -achse.x * 0.06, -achse.y * 0.06), 0, 0.118);
    setze(saum, plus(huefte, achse.x * 0.0, achse.y * 0.0), 0, plus(huefte, achse.x * 0.075, achse.y * 0.075), 0, 0.107);

    // Brust: breiter als der Rumpf, die Schultern tragen den Körper.
    nachWelt(brust.position, plus(schulter, -achse.x * 0.1, -achse.y * 0.1));
    brust.scale.set(0.125, 0.115, 0.19);
    ausrichten(brust, achse);
    brust.rotation.z -= Math.PI / 2;
    // Becken.
    nachWelt(becken.position, plus(huefte, achse.x * 0.01, achse.y * 0.01));
    becken.scale.set(0.115, 0.09, 0.15);
    ausrichten(becken, achse);
    becken.rotation.z -= Math.PI / 2;

    // Schulter- und Hüftkugeln: die Gelenke, an denen Arm und Bein ansetzen.
    for (const [i, z] of [
      [0, Z.schulter],
      [1, -Z.schulter],
    ] as const) {
      const k = schulterKugel[i]!;
      nachWelt(k.position, plus(schulter, -achse.x * 0.02, -achse.y * 0.02), z);
      k.scale.setScalar(0.068);
    }
    for (const [i, z] of [
      [0, Z.huefte],
      [1, -Z.huefte],
    ] as const) {
      const k = hueftKugel[i]!;
      nachWelt(k.position, huefte, z);
      k.scale.setScalar(0.092);
    }

    // Hals und Kragen.
    const kopf = s.kopf;
    const halsBasis = plus(schulter, -achse.x * 0.03, -achse.y * 0.03);
    const zumKopf = norm(minus(kopf, schulter));
    setze(hals, halsBasis, 0, plus(kopf, -zumKopf.x * 0.05, -zumKopf.y * 0.05), 0, 0.056);
    nachWelt(kragen.position, plus(schulter, achse.x * 0.0 - 0.0, achse.y * 0.0 - 0.01));
    kragen.scale.set(0.075, 0.045, 0.11);
    ausrichten(kragen, zumKopf);
    kragen.rotation.z -= Math.PI / 2;

    // Rucksack auf dem Rücken, bis zur Hüfte.
    const rm = plus(lern(huefte, schulter, 0.62), ruecken.x * 0.135, ruecken.y * 0.135);
    nachWelt(rucksack.position, rm);
    rucksack.scale.set(0.075, 0.19, 0.125);
    ausrichten(rucksack, achse);
    rucksack.rotation.z -= Math.PI / 2;
    // Eine Tasche außen auf dem Rucksack, dunkler — ohne sie ist der Rücken eine einfarbige Wurst.
    const tm = plus(lern(huefte, schulter, 0.5), ruecken.x * 0.19, ruecken.y * 0.19);
    nachWelt(rucksackTasche.position, tm);
    rucksackTasche.scale.set(0.03, 0.09, 0.08);
    ausrichten(rucksackTasche, achse);
    rucksackTasche.rotation.z -= Math.PI / 2;
    // Gurte über die Schultern.
    for (const [i, z] of [
      [0, 0.1],
      [1, -0.1],
    ] as const) {
      setze(gurt[i]!, plus(schulter, ruecken.x * 0.03, ruecken.y * 0.03), z, plus(lern(huefte, schulter, 0.6), ruecken.x * 0.04, ruecken.y * 0.04), z * 1.1, 0.012);
    }

    // ===== Kopf =====
    // Der Kopf sitzt etwas tiefer als der Skelettpunkt: Dort endet nur der Hals, der Schädel liegt tiefer.
    nachWelt(kopfGruppe.position, plus(kopf, -zumKopf.x * 0.045, -zumKopf.y * 0.045));
    // Der Kopf folgt dem Rumpf nur zum Teil: Wer sich weit vorlehnt, hebt den Blick, um die Strecke zu sehen.
    kopfGruppe.rotation.z = s.lehn * 0.36 - 0.04;

    // ===== Beine =====
    const bein = (b: Bein, knie: P, knoechel: P, z: number, nah: boolean) => {
      const zk = z * (Z.knie / Z.huefte);
      const zf = z * (Z.fuss / Z.huefte);
      setze(b.oberschenkel, huefte, z, knie, zk, 0.062);
      setze(b.unterschenkel, knie, zk, plus(knoechel, 0, 0), zf, 0.041);
      nachWelt(b.knieKugel.position, knie, zk);
      b.knieKugel.scale.setScalar(0.064);

      // Knieschoner: nach vorn aus dem Knie heraus (die Seite, in die das Knie zeigt).
      const mitte = lern(huefte, knoechel, 0.5);
      const vorn = norm(minus(knie, mitte));
      nachWelt(b.knieschoner.position, plus(knie, vorn.x * 0.05, vorn.y * 0.05), zk);
      b.knieschoner.scale.set(0.045, 0.08, 0.072);
      ausrichten(b.knieschoner, minus(knie, huefte));
      b.knieschoner.rotation.z -= Math.PI / 2 - 0.1;
      nachWelt(b.kappe.position, plus(knie, vorn.x * 0.082, vorn.y * 0.082), zk);
      b.kappe.scale.set(0.016, 0.052, 0.052);
      ausrichten(b.kappe, minus(knie, huefte));
      b.kappe.rotation.z -= Math.PI / 2 - 0.1;
      // Schienbeinschützer.
      const wade = lern(knie, knoechel, 0.45);
      nachWelt(b.schienbein.position, plus(wade, vorn.x * 0.025, vorn.y * 0.025), zf);
      b.schienbein.scale.set(0.028, 0.115, 0.05);
      ausrichten(b.schienbein, minus(knoechel, knie));
      b.schienbein.rotation.z -= Math.PI / 2 + 0.0;
      // Socke über dem Schuh.
      setze(b.socke, plus(knoechel, 0, 0), zf, plus(knoechel, 0.012, 0.06), zf, 0.04);
      // Schuh: Mittelpunkt vor und unter dem Knöchel, auf dem Pedal.
      const sc = plus(knoechel, 0.07, 0.075);
      nachWelt(b.schuh.position, sc, zf);
      b.schuh.scale.set(0.135, 0.052, 0.056);
      b.schuh.rotation.z = nah ? -0.03 : -0.03;
      nachWelt(b.sohle.position, plus(sc, 0.005, 0.038), zf);
      b.sohle.scale.set(0.14, 0.017, 0.058);
    };
    bein(beinNah, s.knieNah, s.knoechelNah, 1 * Z.huefte, true);
    bein(beinFern, s.knieFern, s.knoechelFern, -1 * Z.huefte, false);

    // ===== Arme =====
    const arm = (a: Arm, ellbogen: P, hand: P, vorzeichen: 1 | -1) => {
      const zs = vorzeichen * Z.schulter;
      const ze = vorzeichen * Z.ellbogen;
      const zh = vorzeichen * Z.hand;
      const schulterP = plus(schulter, -achse.x * 0.02, -achse.y * 0.02);
      setze(a.oberarm, schulterP, zs, ellbogen, ze, 0.046);
      setze(a.unterarm, ellbogen, ze, hand, zh, 0.034);
      nachWelt(a.ellbogenKugel.position, ellbogen, ze);
      a.ellbogenKugel.scale.setScalar(0.05);
      // Ellbogenschoner: auf der Außenseite des Gelenks, also dort, wohin der Ellbogen knickt.
      const mitte = lern(schulterP, hand, 0.5);
      const aussen = norm(minus(ellbogen, mitte));
      nachWelt(a.ellbogenSchoner.position, plus(ellbogen, aussen.x * 0.032, aussen.y * 0.032), ze);
      a.ellbogenSchoner.scale.set(0.03, 0.07, 0.06);
      ausrichten(a.ellbogenSchoner, minus(hand, schulterP));
      a.ellbogenSchoner.rotation.z -= Math.PI / 2;
      // Handschuh-Manschette am Handgelenk und die Faust darum.
      const handgelenk = lern(ellbogen, hand, 0.82);
      setze(a.manschette, handgelenk, ze + (zh - ze) * 0.82, hand, zh, 0.04);
      nachWelt(a.faust.position, hand, zh);
      a.faust.scale.set(0.05, 0.045, 0.058);
      nachWelt(a.daumen.position, plus(hand, 0.02, 0.035), zh - vorzeichen * 0.01);
      a.daumen.scale.set(0.022, 0.016, 0.018);
    };
    arm(armNah, s.ellbogenNah, s.hand, 1);
    arm(armFern, s.ellbogenFern, s.handFern ?? s.hand, -1);
  };

  return { gruppe: wurzel, setzen };
}
