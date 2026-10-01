import * as THREE from 'three';
import { GRABEN_BODEN, bodenHoehe, lueckeEnde, lueckeKante } from './logik';
import type { Gelaende } from './logik';
import { mischen } from './farben';
import { gelaendeProfil } from './profil';
import type { ProfilPunkt } from './profil';
import type { Palette } from './umgebung';

/**
 * Das Gelände als Körper: ein Block, dessen Oberseite das Höhenprofil der Strecke ist.
 *
 * **Warum ein Block mit sichtbarem Schnitt.** Die Physik kennt nur das Profil `bodenHoehe(x)`.
 * Darum wird es nach hinten (−z) und nach vorn (+z) **ausgezogen**: eine Platte, deren Vorderseite
 * offen liegt — man sieht die Erdschichten im Anschnitt, genau wie in der 2-D-Fassung, nur dass
 * jetzt eine Oberfläche mit Tiefe dahinter liegt. Auf dieser Oberfläche verläuft ein
 * Pfad aus festgefahrener Erde, daneben Gras. Eine Lücke ist ein echter Graben mit Wänden, Boden
 * und einer Rückwand, nicht mehr ein dunkles Rechteck.
 *
 * Die Schichten laufen **parallel zur Oberfläche** (Tiefe unter dem Profil), nicht waagerecht:
 * An einer Kuppe biegen sie mit, wie in der Zeichnung. Eine Wand (Kante und Gegenseite einer
 * Lücke) trägt dieselben Schichten, gemessen ab der Oberkante.
 *
 * Alles hier ist **einmal** gebaut; pro Bild geschieht nichts. Die Farben sind Scheitelfarben,
 * dazu liegt ein feines Korn als Textur darüber — eine flache Farbfläche ist Pappe, Erde hat Korn.
 */

/** Wie weit das Gelände nach vorn (zur Kamera) und nach hinten reicht, in Metern. */
export const Z_VORN = 2.2;
export const Z_HINTEN = -6.5;
/** Halbe Breite des befahrenen Pfads. */
export const PFAD_BREITE = 0.55;

const TIEFE_UNTEN = 16;

export type Gelaende3D = {
  gruppe: THREE.Group;
  freigeben: () => void;
};

/** Ein Korn aus hellen und dunklen Punkten, nahtlos kachelbar. Wird als `map` über die Scheitelfarben gelegt. */
export function kornTextur(groesse = 192, staerke = 1): THREE.CanvasTexture {
  const S = groesse;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e8e8e8';
  x.fillRect(0, 0, S, S);
  let seed = 90210 + S;
  const w = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1500; i++) {
    const hell = w() < 0.5;
    x.fillStyle = hell ? `rgba(255,255,255,${0.35 * staerke})` : `rgba(90,90,90,${0.28 * staerke})`;
    const px = Math.floor(w() * S);
    const py = Math.floor(w() * S);
    const s = w() < 0.2 ? 3 : 2;
    for (const dx of [0, -S]) for (const dy of [0, -S]) x.fillRect(px + dx, py + dy, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type Stopp = { d: number; farbe: THREE.Color };

/** Die Erdschichten von der Oberfläche nach unten. Gleiche `d` hintereinander ergeben eine harte Kante. */
function schichten(p: Palette, kahl: boolean): Stopp[] {
  const c = (s: string) => new THREE.Color(s);
  const oberflaeche = kahl ? c(p.boden.saum) : c(p.gras[0]);
  return [
    { d: 0, farbe: oberflaeche },
    { d: 0.16, farbe: oberflaeche },
    { d: 0.16, farbe: c(p.boden.saum) },
    { d: 0.75, farbe: c(p.boden.oben) },
    { d: 0.75, farbe: c(p.boden.rost) },
    { d: 1.45, farbe: c(mischen(p.boden.rost, p.boden.tief, 0.45)) },
    { d: 1.45, farbe: c(p.boden.tief) },
    { d: 5, farbe: c(mischen(p.boden.tief, '#000000', 0.1)) },
    { d: TIEFE_UNTEN, farbe: c(mischen(p.boden.tief, '#000000', 0.5)) },
  ];
}

export function gelaendeBauen3d(g: Gelaende, p: Palette): Gelaende3D {
  const von = -34;
  const bis = g.laenge + 46;
  const profil: ProfilPunkt[] = gelaendeProfil(g, von, bis);

  /** Liegt x auf einem Kicker, einer Rampe oder einem Landehang? Dort ist der Boden kahl, nicht Gras. */
  const kahl = (x: number) =>
    g.kicker.some((k) => Math.abs(x - k.x) < k.breite * 1.3) ||
    g.luecken.some((l) => x > l.x0 - 0.5 && x < lueckeEnde(l) + l.hang);

  // Pro Profilpunkt: kahl oder nicht, und wie dunkel (Graben).
  const kahlWert = profil.map((q) => (kahl(q.x) ? 1 : 0));
  const dunkel = profil.map((q) => (q.y <= GRABEN_BODEN + 1e-6 ? 0.2 : 1));

  const cG0 = new THREE.Color(p.gras[0]);
  const cG1 = new THREE.Color(p.gras[1]);
  const cG2 = new THREE.Color(p.gras[2]);
  // Der Pfad ist festgefahrene Erde mit einem Hauch Gras — er muss sich vom Rasen deutlich abheben, sonst liest sich der Boden als eine Fläche.
  const cPfad = new THREE.Color(mischen(mischen(p.boden.saum, p.boden.oben, 0.5), p.gras[0], 0.1));
  const cDunst = new THREE.Color(p.himmel[3]);
  const cKahl = new THREE.Color(p.boden.saum);
  const cKahlDunkel = new THREE.Color(mischen(p.boden.saum, p.boden.oben, 0.5));
  const cGrabenBoden = new THREE.Color(mischen(p.boden.rost, p.boden.tief, 0.45));

  /** Querreihen der Oberseite: z und Grundfarbe (Gras), dazu, wie stark kahle Erde durchschlägt. */
  const reihen: { z: number; gras: THREE.Color; pfad: number; kahl: number; dunst: number }[] = [
    { z: Z_HINTEN, gras: cG2, pfad: 0, kahl: 0, dunst: 0.34 },
    { z: -3.4, gras: cG0, pfad: 0, kahl: 0.1, dunst: 0.14 },
    { z: -1.7, gras: cG0, pfad: 0, kahl: 0.7, dunst: 0.04 },
    { z: -PFAD_BREITE, gras: cPfad, pfad: 1, kahl: 1, dunst: 0 },
    { z: PFAD_BREITE, gras: cPfad, pfad: 1, kahl: 1, dunst: 0 },
    { z: 1.7, gras: cG1, pfad: 0, kahl: 0.7, dunst: 0 },
    { z: Z_VORN, gras: cG1, pfad: 0, kahl: 0.2, dunst: 0 },
  ];

  const lage: number[] = [];
  const normalen: number[] = [];
  const farben: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  const normaleVon = (a: ProfilPunkt, b: ProfilPunkt): [number, number] => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };

  const tmp = new THREE.Color();
  const KORN = 2.6;

  // ======================== Oberseite (mit Wänden) ========================
  for (let i = 0; i < profil.length - 1; i++) {
    const a = profil[i]!;
    const b = profil[i + 1]!;
    const wand = a.x === b.x;
    const [nx, ny] = normaleVon(a, b);

    // Geglättete Normalen an den Enden: Mit dem Nachbarsegment mitteln, wenn der Knick klein ist.
    const glatt = (j: number, rueck: boolean): [number, number] => {
      const nachbar = rueck ? profil[j - 1] : profil[j + 1];
      const hier = profil[j]!;
      if (!nachbar) return [nx, ny];
      const [mx, my] = rueck ? normaleVon(nachbar, hier) : normaleVon(hier, nachbar);
      if (nx * mx + ny * my < 0.8) return [nx, ny];
      const sx = nx + mx;
      const sy = ny + my;
      const l = Math.hypot(sx, sy) || 1;
      return [sx / l, sy / l];
    };

    if (!wand) {
      const [naX, naY] = glatt(i, true);
      const [nbX, nbY] = glatt(i + 1, false);
      const basis = lage.length / 3;
      for (const [q, k, nX, nY, dk] of [
        [a, kahlWert[i]!, naX, naY, dunkel[i]!],
        [b, kahlWert[i + 1]!, nbX, nbY, dunkel[i + 1]!],
      ] as const) {
        for (const r of reihen) {
          lage.push(q.x, q.y, r.z);
          normalen.push(nX, nY, 0);
          // Farbe: Gras der Reihe, zum Pfad hin Erde; auf Kickern schlägt die kahle Erde durch.
          tmp.copy(r.gras);
          if (r.kahl > 0 && k > 0) tmp.lerp(r.pfad > 0 ? cKahl : cKahlDunkel, Math.min(1, r.kahl * k));
          // Der Boden des Grabens ist Erde, kein Rasen.
          if (dk < 1) tmp.copy(cGrabenBoden);
          // Fleckige Helligkeit in großen Wellen: Eine Wiese ist nie überall gleich hell.
          const fleck = 0.95 + 0.05 * Math.sin(q.x * 0.31 + r.z * 1.9) * Math.sin(q.x * 0.113 + 1.3);
          tmp.multiplyScalar((dk < 1 ? 0.7 : dk) * fleck);
          // Weit hinten verschwimmt der Boden zum Horizont: Luftperspektive.
          if (r.dunst > 0 && dk >= 1) tmp.lerp(cDunst, r.dunst);
          farben.push(tmp.r, tmp.g, tmp.b);
          uv.push(q.x / KORN, r.z / KORN);
        }
      }
      const R = reihen.length;
      for (let r = 0; r < R - 1; r++) {
        const a0 = basis + r;
        const a1 = basis + r + 1;
        const b0 = basis + R + r;
        const b1 = basis + R + r + 1;
        // Oberseite zeigt nach oben (+y): Wickelsinn so, dass die Normale nach oben geht.
        index.push(a0, a1, b0, a1, b1, b0);
      }
    } else {
      // Senkrechte Wand: aufgeteilt nach Erdschichten (gemessen ab der Oberkante), über die ganze Tiefe.
      const oben = Math.max(a.y, b.y);
      const unten = Math.min(a.y, b.y);
      const hoehe = oben - unten;
      const stopps = schichten(p, true);
      const normalX = nx;
      // Stufen der Wand: alle Schichtgrenzen im Bereich, dazu Anfang und Ende.
      const ds: { d: number; farbe: THREE.Color }[] = [];
      for (const s of stopps) {
        if (s.d > hoehe + 1e-6) break;
        ds.push({ d: s.d, farbe: s.farbe });
      }
      if (ds.length === 0 || ds[ds.length - 1]!.d < hoehe - 1e-6) {
        // Farbe am Ende der Wand: Schichtfarbe an dieser Tiefe.
        const nach = stopps.find((s) => s.d >= hoehe) ?? stopps[stopps.length - 1]!;
        const vor = [...stopps].reverse().find((s) => s.d <= hoehe) ?? stopps[0]!;
        const t = nach.d === vor.d ? 0 : (hoehe - vor.d) / (nach.d - vor.d);
        ds.push({ d: hoehe, farbe: vor.farbe.clone().lerp(nach.farbe, t) });
      }
      // Dunkelheit: oben (Oberkante) 1, am Boden des Grabens 0,2 — linear über die Wand.
      const dunkelBei = (d: number) => 1 - 0.8 * Math.min(1, d / Math.max(0.001, hoehe));
      const basis = lage.length / 3;
      const nRows = ds.length;
      for (const r of [Z_HINTEN, Z_VORN]) {
        for (const s of ds) {
          lage.push(a.x, oben - s.d, r);
          normalen.push(normalX, 0, 0);
          tmp.copy(s.farbe).multiplyScalar(dunkelBei(s.d));
          farben.push(tmp.r, tmp.g, tmp.b);
          uv.push(r / KORN, (oben - s.d) / KORN);
        }
      }
      for (let k = 0; k < nRows - 1; k++) {
        const v0 = basis + k;
        const v1 = basis + k + 1;
        const w0 = basis + nRows + k;
        const w1 = basis + nRows + k + 1;
        // Die Wand schaut in ±x: Wickelsinn je nach Richtung.
        if (normalX > 0) index.push(v0, w0, v1, v1, w0, w1);
        else index.push(v0, v1, w0, v1, w1, w0);
      }
    }
  }

  // ======================== Vorderseite (Schnitt) ========================
  // Reihen mit Tiefe unter dem Profil; kahle Stellen haben eine kahle Deckschicht statt Gras.
  {
    const gras = schichten(p, false);
    const bloss = schichten(p, true);
    const nR = gras.length;
    for (let i = 0; i < profil.length - 1; i++) {
      const a = profil[i]!;
      const b = profil[i + 1]!;
      if (a.x === b.x) continue;
      const basis = lage.length / 3;
      for (const [q, k, dk] of [
        [a, kahlWert[i]!, dunkel[i]!],
        [b, kahlWert[i + 1]!, dunkel[i + 1]!],
      ] as const) {
        for (let r = 0; r < nR; r++) {
          const s = gras[r]!;
          lage.push(q.x, q.y - s.d, Z_VORN);
          normalen.push(0, 0, 1);
          tmp.copy(s.farbe).lerp(bloss[r]!.farbe, k);
          // Die Vorderseite im Graben ist dunkel — dort fällt kaum Licht hin.
          tmp.multiplyScalar(0.55 + 0.45 * dk);
          farben.push(tmp.r, tmp.g, tmp.b);
          uv.push(q.x / KORN, (q.y - s.d) / KORN);
        }
      }
      for (let r = 0; r < nR - 1; r++) {
        const a0 = basis + r;
        const a1 = basis + r + 1;
        const b0 = basis + nR + r;
        const b1 = basis + nR + r + 1;
        index.push(a0, a1, b0, a1, b1, b0);
      }
    }
  }

  // ======================== Rückwand (schließt die Gräben) ========================
  /*
   * Hinter der Platte geht die Landschaft weiter. Ein Graben, dessen Rückseite offen bliebe, wäre
   * ein Fenster auf den Himmel — man sähe quer durch die Welt. Die Rückwand reicht deshalb im
   * Graben bis zur Höhe der **niedrigeren** Seite hinauf (wie in der 2-D-Fassung: darüber ist offener
   * Himmel, darunter schaut man in den Schnitt der Erde).
   */
  {
    const basis = lage.length / 3;
    // Der Schnitt der Erde, wie man ihn in einem Graben sieht: oben noch hell, nach unten schnell dunkel.
    const hell = new THREE.Color(mischen(p.boden.rost, p.boden.tief, 0.35));
    const mitte = new THREE.Color(mischen(p.boden.tief, '#000000', 0.5));
    const unten = new THREE.Color(mischen(p.boden.tief, '#000000', 0.85));
    const randHoehe = (x: number): number | null => {
      for (const l of g.luecken) {
        if (x > l.x0 + l.rampe - 1e-6 && x < lueckeEnde(l) + 1e-6) {
          return Math.min(bodenHoehe(g, lueckeKante(l) - 1e-4), bodenHoehe(g, lueckeEnde(l) + 1e-6));
        }
      }
      return null;
    };
    // Drei Reihen je Profilpunkt: Oberkante (Rand), Höhe des Profils (Grabenboden) und tief darunter.
    for (const q of profil) {
      const rand = q.y <= GRABEN_BODEN + 1e-6 ? randHoehe(q.x) : null;
      const oben = rand ?? q.y;
      const reihen3: [number, THREE.Color][] = [
        [oben, rand !== null ? hell : mitte],
        [q.y, rand !== null ? mitte : mitte],
        [q.y - TIEFE_UNTEN, unten],
      ];
      for (const [y, c] of reihen3) {
        lage.push(q.x, y, Z_HINTEN);
        normalen.push(0, 0, 1);
        farben.push(c.r, c.g, c.b);
        uv.push(q.x / KORN, y / KORN);
      }
    }
    for (let i = 0; i < profil.length - 1; i++) {
      const a = profil[i]!;
      const b = profil[i + 1]!;
      if (a.x === b.x) continue;
      for (let r = 0; r < 2; r++) {
        const a0 = basis + i * 3 + r;
        const a1 = a0 + 1;
        const b0 = basis + (i + 1) * 3 + r;
        const b1 = b0 + 1;
        index.push(a0, a1, b0, a1, b1, b0);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(lage, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalen, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();

  const korn = kornTextur();
  const stoff = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: korn,
    roughness: 0.96,
    metalness: 0,
  });
  const netz = new THREE.Mesh(geo, stoff);
  netz.receiveShadow = true;
  netz.frustumCulled = false;

  const gruppe = new THREE.Group();
  gruppe.add(netz);

  return {
    gruppe,
    freigeben: () => {
      geo.dispose();
      stoff.dispose();
      korn.dispose();
    },
  };
}
