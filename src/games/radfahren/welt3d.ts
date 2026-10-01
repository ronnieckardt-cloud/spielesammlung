import * as THREE from 'three';
import {
  POP_FENSTER,
  POP_VOLL,
  TEMPO_MAX,
  bodenHoehe,
  bodenSteigung,
  lueckeBei,
  lueckeEnde,
  lueckeKante,
} from './logik';
import type { Gelaende, Lauf } from './logik';
import { mischen } from './farben';
import { streu } from './umgebung';
import type { Palette } from './umgebung';

/**
 * Alles, was auf und neben der Strecke steht: Rampen, Kanten, Schilder, Tore, Münzen,
 * Boost-Streifen, die Tipp-Zone vor jeder Lücke, Gras, Blumen, Steine.
 *
 * Wie das Gelände wird auch dies **einmal gebaut** und danach nur noch umgeschaltet: Münzen
 * drehen sich (eine Matrix je Münze), Boost-Streifen laufen (eine Zahl), die Tipp-Zone leuchtet
 * (eine Zahl). Gras, Blumen und Steine sind **Instanzen** — ein Zeichenaufruf je Sorte für die
 * ganze Strecke, und sie stehen auf Positionen aus Hashwerten, nie aus `Math.random`: Dieselbe
 * Stelle zeigt immer dasselbe, ganz gleich, wie oft die Szene neu gebaut wird.
 *
 * Nichts davon entscheidet eine Spielregel. Was eingesammelt ist, sagt `Lauf`.
 */

export type Welt3D = {
  gruppe: THREE.Group;
  aktualisieren: (lauf: Lauf, kameraX: number, uhr: number) => void;
  freigeben: () => void;
};

/** Wo auf der Strecke das Starttor steht — hinter dem Rad, am linken Bildrand. */
const START_TOR_X = 1.2;
const MUENZ_R = 0.34;

// ---------------------------------------------------------------------
// Texturen — alle im Code gezeichnet, keine Bilddateien (siehe Dash City).
// ---------------------------------------------------------------------
function leinwand(b: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function textur(c: HTMLCanvasElement, wiederholen = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (wiederholen) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function plankenTextur(): THREE.CanvasTexture {
  const [c, x] = leinwand(128, 128);
  x.fillStyle = '#cf9c5e';
  x.fillRect(0, 0, 128, 128);
  // Maserung: feine waagerechte Striche, nahtlos.
  let seed = 4711;
  const w = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 38; i++) {
    x.strokeStyle = w() < 0.5 ? 'rgba(120,72,30,0.22)' : 'rgba(255,230,180,0.16)';
    x.lineWidth = 1 + w() * 1.6;
    const y = w() * 128;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(128, y + (w() - 0.5) * 6);
    x.stroke();
  }
  // Die Fuge zwischen zwei Brettern.
  x.fillStyle = 'rgba(40,22,8,0.85)';
  x.fillRect(0, 0, 5, 128);
  x.fillStyle = 'rgba(255,236,190,0.35)';
  x.fillRect(5, 0, 3, 128);
  return textur(c, true);
}

function warnTextur(): THREE.CanvasTexture {
  const [c, x] = leinwand(128, 128);
  x.fillStyle = '#ffc928';
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#1b1b1f';
  x.lineWidth = 26;
  for (let i = -3; i < 7; i++) {
    x.beginPath();
    x.moveTo(-20, i * 36 + 40);
    x.lineTo(150, i * 36 - 40);
    x.stroke();
  }
  return textur(c, true);
}

function schildTextur(): THREE.CanvasTexture {
  const [c, x] = leinwand(160, 160);
  x.translate(80, 80);
  x.rotate(Math.PI / 4);
  x.fillStyle = '#1b1b1f';
  x.fillRect(-60, -60, 120, 120);
  x.fillStyle = '#ffc928';
  x.fillRect(-52, -52, 104, 104);
  x.strokeStyle = '#1b1b1f';
  x.lineWidth = 5;
  x.strokeRect(-42, -42, 84, 84);
  x.rotate(-Math.PI / 4);
  x.fillStyle = '#1b1b1f';
  x.font = '900 78px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('!', 0, 5);
  return textur(c);
}

function tafelTextur(text: string): THREE.CanvasTexture {
  const [c, x] = leinwand(256, 128);
  x.fillStyle = '#1d4d5c';
  x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#f8fafc';
  x.lineWidth = 8;
  x.strokeRect(8, 8, 240, 112);
  x.fillStyle = '#f8fafc';
  x.font = '800 62px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 128, 68);
  return textur(c);
}

function torTextur(ziel: boolean): THREE.CanvasTexture {
  const [c, x] = leinwand(512, 112);
  if (ziel) {
    const f = 112 / 3;
    const n = Math.round(512 / f);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        x.fillStyle = (i + j) % 2 === 0 ? '#f8fafc' : '#111827';
        x.fillRect(i * f, j * f, f + 1, f + 1);
      }
    }
  } else {
    x.fillStyle = '#1d4d5c';
    x.fillRect(0, 0, 512, 112);
    x.fillStyle = '#f8fafc';
    x.font = '900 72px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('START', 256, 60);
  }
  return textur(c);
}

function muenzTextur(): THREE.CanvasTexture {
  const [c, x] = leinwand(128, 128);
  const g = x.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.45, '#ffc933');
  g.addColorStop(1, '#c47a0a');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,248,205,0.9)';
  x.lineWidth = 7;
  x.beginPath();
  x.arc(64, 64, 44, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = 'rgba(147,86,6,0.9)';
  x.beginPath();
  for (let k = 0; k < 10; k++) {
    const w = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 === 0 ? 30 : 13;
    const px = 64 + Math.cos(w) * r;
    const py = 64 + Math.sin(w) * r;
    if (k === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
  x.fill();
  return textur(c);
}

function leuchtTextur(farbe = '255,255,255'): THREE.CanvasTexture {
  const [c, x] = leinwand(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${farbe},1)`);
  g.addColorStop(0.35, `rgba(${farbe},0.35)`);
  g.addColorStop(1, `rgba(${farbe},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return textur(c);
}

function boostTextur(): THREE.CanvasTexture {
  // Eine Teilung des Streifens: Grund in zwei Blautönen und ein Pfeil. Wiederholt sich entlang x.
  const [c, x] = leinwand(128, 128);
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#16c4d6');
  g.addColorStop(1, '#0a7d95');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(235,252,255,0.95)';
  x.lineWidth = 12;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(34, 24);
  x.lineTo(92, 64);
  x.lineTo(34, 104);
  x.stroke();
  return textur(c, true);
}

function pfeilTextur(): THREE.CanvasTexture {
  const [c, x] = leinwand(128, 128);
  x.lineCap = 'round';
  x.lineJoin = 'round';
  for (const [farbe, breite] of [
    ['rgba(60,28,0,0.7)', 20],
    ['#ffc233', 12],
  ] as const) {
    x.strokeStyle = farbe;
    x.lineWidth = breite;
    x.beginPath();
    x.moveTo(30, 20);
    x.lineTo(98, 64);
    x.lineTo(30, 108);
    x.stroke();
  }
  return textur(c);
}

// ---------------------------------------------------------------------
// Bauen
// ---------------------------------------------------------------------

/** Ein Streifen entlang der Strecke, der dem Boden folgt: x von `a` bis `b`, z von `z0` bis `z1`. */
function streifen(
  g: Gelaende,
  a: number,
  b: number,
  z0: number,
  z1: number,
  heb: number,
  schritt: number,
  uvX: number,
  uvZ = 1,
): THREE.BufferGeometry {
  const n = Math.max(1, Math.ceil((b - a) / schritt));
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = bodenHoehe(g, Math.min(x, lueckeFreiBis(g, x))) + heb;
    for (const [z, v] of [
      [z0, 0],
      [z1, uvZ],
    ] as const) {
      pos.push(x, y, z);
      nor.push(0, 1, 0);
      uv.push((x - a) * uvX, v);
    }
  }
  for (let i = 0; i < n; i++) {
    const a0 = i * 2;
    // Von oben gesehen gegen den Uhrzeigersinn: x nach rechts, z zur Kamera.
    idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** Innerhalb eines Grabens gibt es keinen Boden: Streifen enden an der Kante. */
function lueckeFreiBis(g: Gelaende, x: number): number {
  const l = lueckeBei(g, x);
  return l ? lueckeKante(l) - 1e-4 : x;
}

export function weltBauen(g: Gelaende, p: Palette, umgebung: THREE.Texture | null, ruhig: boolean): Welt3D {
  const gruppe = new THREE.Group();
  const geometrien: THREE.BufferGeometry[] = [];
  const stoffe: THREE.Material[] = [];
  const texturen: THREE.Texture[] = [];
  const geo = <T extends THREE.BufferGeometry>(x: T): T => {
    geometrien.push(x);
    return x;
  };
  const stoff = <T extends THREE.Material>(x: T): T => {
    stoffe.push(x);
    return x;
  };
  const tex = <T extends THREE.Texture>(x: T): T => {
    texturen.push(x);
    return x;
  };
  const spiegeln = (m: THREE.MeshStandardMaterial, k: number) => {
    if (umgebung) {
      m.envMap = umgebung;
      m.envMapIntensity = k;
    }
    return m;
  };

  /** Liegt x so, dass dort etwas stehen kann (nicht im Graben, nicht auf der Rampe)? */
  const frei = (x: number, rand = 1.2) => !g.luecken.some((l) => x > l.x0 - rand && x < lueckeEnde(l) + 2);

  // ======================== Rampen und Kanten ========================
  const planken = tex(plankenTextur());
  const warn = tex(warnTextur());
  const holzOben = stoff(new THREE.MeshStandardMaterial({ map: planken, roughness: 0.7, metalness: 0 }));
  const holzSeite = stoff(new THREE.MeshStandardMaterial({ map: planken, color: '#a07040', roughness: 0.8 }));
  const warnStoff = stoff(new THREE.MeshStandardMaterial({ map: warn, roughness: 0.55, metalness: 0.05 }));
  const lippenStoff = stoff(new THREE.MeshStandardMaterial({ color: '#e9c88e', roughness: 0.8 }));

  for (const l of g.luecken) {
    const kante = lueckeKante(l);
    const ende = lueckeEnde(l);
    const anfang = l.x0 + 0.4;

    // Die Rampe: ein Band aus Brettern über dem Boden, mit Seitenwand.
    const oben = geo(streifen(g, anfang, kante - 0.0001, -1.3, 1.3, 0.05, 0.25, 1 / 0.55, 1));
    const rampeOben = new THREE.Mesh(oben, holzOben);
    rampeOben.castShadow = true;
    rampeOben.receiveShadow = true;
    gruppe.add(rampeOben);
    // Seitenwand an der nahen Seite: Streifen von der Oberkante der Rampe nach unten.
    const n = Math.max(1, Math.ceil((kante - anfang) / 0.25));
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = anfang + ((kante - 0.0001 - anfang) * i) / n;
      const y = bodenHoehe(g, x);
      pos.push(x, y + 0.05, 1.3, x, y - 0.18, 1.3);
      nor.push(0, 0, 1, 0, 0, 1);
      uv.push((x - anfang) / 0.55, 1, (x - anfang) / 0.55, 0);
    }
    for (let i = 0; i < n; i++) {
      const a0 = i * 2;
      idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
    const seite = geo(new THREE.BufferGeometry());
    seite.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    seite.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    seite.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    seite.setIndex(idx);
    const seitenMesh = new THREE.Mesh(seite, holzSeite);
    seitenMesh.castShadow = true;
    gruppe.add(seitenMesh);

    // Die Kappe an der Kante: ein Balken in Warnstreifen.
    const kantenHoehe = bodenHoehe(g, kante - 1e-4);
    const kappe = new THREE.Mesh(geo(new THREE.BoxGeometry(0.22, 0.44, 2.7)), warnStoff);
    kappe.position.set(kante - 0.1, kantenHoehe - 0.12, 0);
    kappe.castShadow = true;
    kappe.receiveShadow = true;
    gruppe.add(kappe);

    // Die Lippe an der Gegenseite: ein heller Streifen auf der Oberkante der Wand.
    const hZiel = bodenHoehe(g, ende + 1e-6);
    const lippe = new THREE.Mesh(geo(new THREE.BoxGeometry(0.6, 0.12, 2.6)), lippenStoff);
    lippe.position.set(ende + 0.3, hZiel + 0.02, 0);
    lippe.receiveShadow = true;
    gruppe.add(lippe);
  }

  // ======================== Warnschilder ========================
  const schild = tex(schildTextur());
  const schildStoff = stoff(new THREE.MeshStandardMaterial({ map: schild, transparent: true, alphaTest: 0.4, roughness: 0.5, side: THREE.DoubleSide }));
  const pfostenStoff = stoff(spiegeln(new THREE.MeshStandardMaterial({ color: '#b9bec7', metalness: 0.8, roughness: 0.35 }), 1.0));
  const pfostenGeo = geo(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8));
  const schildGeo = geo(new THREE.PlaneGeometry(0.95, 0.95));
  for (const l of g.luecken) {
    const wx = l.x0 - 9;
    const y = bodenHoehe(g, wx);
    const pfosten = new THREE.Mesh(pfostenGeo, pfostenStoff);
    pfosten.position.set(wx, y + 0.7, 1.75);
    pfosten.castShadow = true;
    const tafel = new THREE.Mesh(schildGeo, schildStoff);
    tafel.position.set(wx, y + 1.65, 1.78);
    tafel.castShadow = true;
    gruppe.add(pfosten, tafel);
  }

  // ======================== Distanztafeln und Tore ========================
  const tafelGeo = geo(new THREE.BoxGeometry(1.1, 0.55, 0.06));
  const brettStoff = stoff(new THREE.MeshStandardMaterial({ color: '#1d4d5c', roughness: 0.6 }));
  for (let wx = 100; wx < g.laenge - 20; wx += 100) {
    if (!frei(wx - 1.5) || !frei(wx + 1.5)) continue;
    const y = bodenHoehe(g, wx);
    const t = tex(tafelTextur(`${wx} m`));
    const vorn = stoff(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    const board = new THREE.Mesh(tafelGeo, [brettStoff, brettStoff, brettStoff, brettStoff, vorn, brettStoff]);
    board.position.set(wx, y + 1.5, 1.7);
    board.castShadow = true;
    const stiel = new THREE.Mesh(pfostenGeo, pfostenStoff);
    stiel.position.set(wx, y + 0.7, 1.68);
    gruppe.add(board, stiel);
  }

  const torPfosten = geo(new THREE.CylinderGeometry(0.075, 0.075, 3.6, 12));
  const torBannerGeo = geo(new THREE.BoxGeometry(3.4, 0.62, 0.07));
  for (const ziel of [false, true]) {
    const wx = ziel ? g.laenge : START_TOR_X;
    const y = bodenHoehe(g, wx);
    const t = tex(torTextur(ziel));
    const vorn = stoff(new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
    const dunkelBanner = stoff(new THREE.MeshStandardMaterial({ color: ziel ? '#101418' : '#1d4d5c', roughness: 0.6 }));
    const banner = new THREE.Mesh(torBannerGeo, [dunkelBanner, dunkelBanner, dunkelBanner, dunkelBanner, vorn, dunkelBanner]);
    // Das Tor steht **hinter** der Bahn: Das Rad fährt davor vorbei, der Fahrer verdeckt das Banner nicht.
    banner.position.set(wx, y + 3.2, -2.1);
    banner.castShadow = true;
    gruppe.add(banner);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(torPfosten, pfostenStoff);
      post.position.set(wx + s * 1.75, y + 1.8, -2.1);
      post.castShadow = true;
      gruppe.add(post);
    }
  }

  // ======================== Münzen ========================
  const muenzenAnzahl = g.muenzen.length;
  const mTex = tex(muenzTextur());
  const goldSeite = stoff(spiegeln(new THREE.MeshStandardMaterial({ color: '#d9a021', metalness: 0.9, roughness: 0.28 }), 1.5));
  const goldFlaeche = stoff(spiegeln(new THREE.MeshStandardMaterial({ map: mTex, metalness: 0.7, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.55 }), 1.1));
  const muenzGeo = geo(new THREE.CylinderGeometry(MUENZ_R, MUENZ_R, 0.075, 32).rotateX(Math.PI / 2));
  const muenzen = new THREE.InstancedMesh(muenzGeo, [goldSeite, goldFlaeche, goldFlaeche], Math.max(1, muenzenAnzahl));
  muenzen.frustumCulled = false;
  gruppe.add(muenzen);
  const leuchtTex = tex(leuchtTextur('255,205,70'));
  const leuchtStoff = stoff(
    new THREE.MeshBasicMaterial({ map: leuchtTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }),
  );
  const muenzLeuchten = new THREE.InstancedMesh(geo(new THREE.PlaneGeometry(1, 1)), leuchtStoff, Math.max(1, muenzenAnzahl));
  muenzLeuchten.frustumCulled = false;
  gruppe.add(muenzLeuchten);

  // ======================== Boost-Streifen ========================
  const boostTex = tex(boostTextur());
  boostTex.repeat.set(1, 1);
  type PadMesh = { mesh: THREE.Mesh; stoff: THREE.MeshBasicMaterial };
  const padMeshes: PadMesh[] = [];
  for (const pad of g.pads) {
    const s = stoff(
      new THREE.MeshBasicMaterial({
        map: boostTex,
        transparent: true,
        color: new THREE.Color(1.15, 1.25, 1.3),
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    // Eine Teilung des Bildes je 0,85 m, damit die Pfeile in einem festen Takt wandern.
    const m = new THREE.Mesh(geo(streifen(g, pad.x, pad.x + pad.laenge, -0.75, 0.75, 0.035, 0.25, 1 / 0.85, 1)), s);
    m.receiveShadow = false;
    gruppe.add(m);
    padMeshes.push({ mesh: m, stoff: s });
  }
  const padLeuchten = new THREE.InstancedMesh(
    geo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    stoff(
      new THREE.MeshBasicMaterial({
        map: tex(leuchtTextur('60,220,255')),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.45,
      }),
    ),
    Math.max(1, g.pads.length),
  );
  {
    const o = new THREE.Object3D();
    g.pads.forEach((pad, i) => {
      o.position.set(pad.x + pad.laenge / 2, bodenHoehe(g, pad.x + pad.laenge / 2) + 0.06, 0);
      o.scale.set(pad.laenge * 1.6, 1, 3.2);
      o.updateMatrix();
      padLeuchten.setMatrixAt(i, o.matrix);
    });
    padLeuchten.count = g.pads.length;
    padLeuchten.frustumCulled = false;
    gruppe.add(padLeuchten);
  }

  // ======================== Absprungmarken und Tipp-Zone ========================
  const pfeilTex = tex(pfeilTextur());
  const pfeilStoff = stoff(
    new THREE.MeshBasicMaterial({
      map: pfeilTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const pfeilGeo = geo(new THREE.PlaneGeometry(0.62, 0.7).rotateX(-Math.PI / 2));
  const markenAnzahl = g.absprung.length * 3;
  const marken = new THREE.InstancedMesh(pfeilGeo, pfeilStoff, Math.max(1, markenAnzahl));
  marken.frustumCulled = false;
  {
    const o = new THREE.Object3D();
    const farbe = new THREE.Color(1, 1, 1);
    g.absprung.forEach((a, j) => {
      for (let k = 0; k < 3; k++) {
        const wx = a - 0.4 - k * 0.62;
        o.position.set(wx, bodenHoehe(g, wx) + 0.05, 0);
        o.rotation.set(0, 0, Math.atan(bodenSteigung(g, wx)));
        o.updateMatrix();
        marken.setMatrixAt(j * 3 + k, o.matrix);
        marken.setColorAt(j * 3 + k, farbe);
      }
    });
    marken.count = markenAnzahl;
  }
  gruppe.add(marken);

  /** Die Tipp-Zone vor einer Lücke: ein Lichtvorhang hinter der Bahn und ein leuchtender Streifen auf ihr. */
  type Zone = { a: number; vorhang: THREE.Mesh; boden: THREE.Mesh; stoffV: THREE.MeshBasicMaterial; stoffB: THREE.MeshBasicMaterial; index: number };
  const zonen: Zone[] = [];
  const laengeZone = TEMPO_MAX * POP_FENSTER;
  const laengeVoll = TEMPO_MAX * POP_VOLL;
  for (const l of g.luecken) {
    const a = lueckeKante(l);
    const SPALTEN = 22;
    const pos: number[] = [];
    const farb: number[] = [];
    const idx: number[] = [];
    const bodenPos: number[] = [];
    const bodenFarb: number[] = [];
    const bodenIdx: number[] = [];
    for (let k = 0; k <= SPALTEN; k++) {
      const wx = a - laengeZone * (1 - k / SPALTEN);
      const dA = laengeZone * (1 - k / SPALTEN);
      const voll = dA <= laengeVoll;
      const y = bodenHoehe(g, Math.min(wx, a - 1e-4));
      const hoch = voll ? 0.5 + 0.9 * (1 - dA / laengeVoll) : 0.28;
      const al = Math.min(0.95, (voll ? 0.55 + 0.3 * (1 - dA / laengeVoll) : 0.3) * 1.25);
      pos.push(wx, y + 0.03, -1.0, wx, y + 0.03 + hoch * 1.15, -1.0);
      farb.push(1, 0.77, 0.16, al, 1, 0.77, 0.16, 0);
      bodenPos.push(wx, y + 0.06, -0.9, wx, y + 0.06, 0.9);
      const ba = voll ? 0.5 + 0.4 * (1 - dA / laengeVoll) : 0.2;
      bodenFarb.push(1, 0.85, 0.3, ba, 1, 0.85, 0.3, ba);
    }
    for (let k = 0; k < SPALTEN; k++) {
      const a0 = k * 2;
      idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3);
      bodenIdx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
    const mk = (pp: number[], ff: number[], ii: number[]) => {
      const bg = geo(new THREE.BufferGeometry());
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(ff, 4));
      bg.setIndex(ii);
      return bg;
    };
    const mat = () =>
      stoff(
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
    const sV = mat();
    const sB = mat();
    const vorhang = new THREE.Mesh(mk(pos, farb, idx), sV);
    const boden = new THREE.Mesh(mk(bodenPos, bodenFarb, bodenIdx), sB);
    vorhang.frustumCulled = false;
    boden.frustumCulled = false;
    gruppe.add(vorhang, boden);
    zonen.push({ a, vorhang, boden, stoffV: sV, stoffB: sB, index: g.absprung.findIndex((x) => Math.abs(x - a) < 0.01) });
  }

  // ======================== Gras, Blumen, Steine ========================
  const rnd = (n: number, k: number) => streu(n, k);
  // Ein Büschel: drei gekreuzte Halme.
  const halmPos: number[] = [];
  const halmIdx: number[] = [];
  for (let k = 0; k < 3; k++) {
    const w = (k / 3) * Math.PI;
    const dx = Math.cos(w) * 0.05;
    const dz = Math.sin(w) * 0.05;
    const b = halmPos.length / 3;
    halmPos.push(-dx, 0, -dz, dx, 0, dz, dx * 0.2 + 0.015, 0.2, dz * 0.2);
    halmIdx.push(b, b + 1, b + 2);
  }
  const buescheGeo = geo(new THREE.BufferGeometry());
  buescheGeo.setAttribute('position', new THREE.Float32BufferAttribute(halmPos, 3));
  buescheGeo.setIndex(halmIdx);
  buescheGeo.computeVertexNormals();
  const buescheStoff = stoff(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));

  const stellen: { x: number; z: number; s: number; farbe: number }[] = [];
  for (let x = -12; x < g.laenge + 34; x += 0.3) {
    const xr = x + (rnd(x, 1) - 0.5) * 0.3;
    if (!frei(xr, 0.5)) continue;
    // Vorn am Rand: dicht, aber niedrig — sonst verdeckt es dem Rad die Reifen.
    stellen.push({ x: xr, z: 1.6 + rnd(x, 2) * 0.5, s: 0.55 + rnd(x, 3) * 0.5, farbe: Math.floor(rnd(x, 4) * 3) });
    if (rnd(x, 5) < 0.45) stellen.push({ x: xr + 0.2, z: 1.15 + rnd(x, 6) * 0.45, s: 0.4 + rnd(x, 7) * 0.4, farbe: Math.floor(rnd(x, 8) * 3) });
    // Hinter der Bahn: Gras, höher.
    if (rnd(x, 9) < 0.6) stellen.push({ x: xr, z: -1.1 - rnd(x, 10) * 4.6, s: 1.0 + rnd(x, 11) * 0.9, farbe: Math.floor(rnd(x, 12) * 3) });
  }
  const buesche = new THREE.InstancedMesh(buescheGeo, buescheStoff, stellen.length);
  {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    stellen.forEach((st, i) => {
      o.position.set(st.x, bodenHoehe(g, st.x) - 0.01, st.z);
      o.rotation.set(0, rnd(i, 13) * Math.PI, 0);
      o.scale.set(st.s, st.s * (0.8 + rnd(i, 14) * 0.5), st.s);
      o.updateMatrix();
      buesche.setMatrixAt(i, o.matrix);
      c.set(p.gras[st.farbe]!);
      buesche.setColorAt(i, c);
    });
    buesche.count = stellen.length;
  }
  buesche.frustumCulled = false;
  gruppe.add(buesche);

  // Blumen: ein Stiel und eine Blüte; nachts leuchten sie (Pilze).
  const blumenStellen: { x: number; z: number; h: number }[] = [];
  for (let x = -8; x < g.laenge + 30; x += 1.9) {
    const xr = x + rnd(x, 21) * 1.4;
    if (!frei(xr, 0.5) || rnd(x, 22) < 0.3) continue;
    blumenStellen.push({ x: xr, z: rnd(x, 23) < 0.7 ? 1.25 + rnd(x, 24) * 0.8 : -1.2 - rnd(x, 25) * 3.5, h: 0.2 + rnd(x, 26) * 0.12 });
  }
  const bluetenStoff = stoff(
    new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: p.nacht ? '#ffffff' : '#000000', emissiveIntensity: p.nacht ? 0.75 : 0 }),
  );
  const bluetenGeo = geo(new THREE.SphereGeometry(0.06, 8, 6));
  const stielGeo = geo(new THREE.CylinderGeometry(0.006, 0.006, 1, 5).translate(0, 0.5, 0));
  const stielStoff = stoff(new THREE.MeshLambertMaterial({ color: p.gras[2] }));
  const bluten = new THREE.InstancedMesh(bluetenGeo, bluetenStoff, Math.max(1, blumenStellen.length));
  const stiele = new THREE.InstancedMesh(stielGeo, stielStoff, Math.max(1, blumenStellen.length));
  {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    blumenStellen.forEach((b, i) => {
      const y = bodenHoehe(g, b.x);
      o.position.set(b.x, y, b.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, b.h, 1);
      o.updateMatrix();
      stiele.setMatrixAt(i, o.matrix);
      o.position.set(b.x, y + b.h, b.z);
      o.scale.set(1, 0.8, 1);
      o.updateMatrix();
      bluten.setMatrixAt(i, o.matrix);
      c.set(p.blumen[Math.floor(rnd(i, 27) * p.blumen.length)]!);
      bluten.setColorAt(i, c);
    });
    bluten.count = blumenStellen.length;
    stiele.count = blumenStellen.length;
  }
  bluten.frustumCulled = false;
  stiele.frustumCulled = false;
  gruppe.add(bluten, stiele);

  // Steine: unregelmäßige Brocken am Rand der Bahn.
  const steinStellen: { x: number; z: number; s: number }[] = [];
  for (let x = -10; x < g.laenge + 30; x += 2.6) {
    const xr = x + rnd(x, 31) * 2.2;
    if (!frei(xr, 0.5) || rnd(x, 32) < 0.35) continue;
    steinStellen.push({
      x: xr,
      z: rnd(x, 33) < 0.65 ? 1.2 + rnd(x, 34) * 0.9 : -1.3 - rnd(x, 35) * 3.2,
      s: 0.07 + rnd(x, 36) * 0.18,
    });
  }
  const steinGeo = geo(new THREE.IcosahedronGeometry(1, 0));
  const steinStoff = stoff(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }));
  const steine = new THREE.InstancedMesh(steinGeo, steinStoff, Math.max(1, steinStellen.length));
  {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    steinStellen.forEach((s, i) => {
      o.position.set(s.x, bodenHoehe(g, s.x) + s.s * 0.15, s.z);
      o.rotation.set(rnd(i, 37) * 3, rnd(i, 38) * 3, rnd(i, 39) * 3);
      o.scale.set(s.s * (1 + rnd(i, 40) * 0.5), s.s * 0.65, s.s * (0.8 + rnd(i, 41) * 0.5));
      o.updateMatrix();
      steine.setMatrixAt(i, o.matrix);
      c.set(mischen(p.stein, rnd(i, 42) < 0.5 ? '#000000' : '#ffffff', 0.08 + rnd(i, 43) * 0.12));
      steine.setColorAt(i, c);
    });
    steine.count = steinStellen.length;
  }
  steine.castShadow = true;
  steine.receiveShadow = true;
  steine.frustumCulled = false;
  gruppe.add(steine);

  // ======================== Umschalten je Bild ========================
  const dummy = new THREE.Object3D();
  const farbeHell = new THREE.Color(1, 1, 1);
  const farbeBlass = new THREE.Color(0.2, 0.2, 0.2);
  let letzterPadStand = -1;
  let letzterMarkenStand = -1;

  const aktualisieren = (lauf: Lauf, kameraX: number, uhr: number) => {
    // --- Münzen: nur die im Bild, nur die noch nicht eingesammelten ---
    const von = kameraX - 16;
    const bis = kameraX + 28;
    let n = 0;
    for (let i = 0; i < muenzenAnzahl; i++) {
      const c = g.muenzen[i]!;
      if (c.x < von || c.x > bis || lauf.geholt.has(i)) continue;
      const wipp = ruhig ? 0 : Math.sin(uhr * 2.2 + i * 0.9) * 0.07;
      dummy.position.set(c.x, c.y + wipp, 0);
      // Die Münze dreht sich um die Hochachse. Bei „weniger Bewegung" steht sie leicht schräg still.
      dummy.rotation.set(0, ruhig ? 0.5 : uhr * 2.6 + i * 0.7, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      muenzen.setMatrixAt(n, dummy.matrix);
      dummy.position.set(c.x, c.y + wipp, -0.2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(MUENZ_R * 4.2);
      dummy.updateMatrix();
      muenzLeuchten.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    muenzen.count = n;
    muenzLeuchten.count = n;
    muenzen.instanceMatrix.needsUpdate = true;
    muenzLeuchten.instanceMatrix.needsUpdate = true;

    // --- Boost-Streifen: Pfeile wandern, genommene verblassen ---
    // Eine Teilung je 0,85 m; die Phase läuft mit 0,95 Teilungen je Sekunde, ruhig genug, um nicht zu stören.
    boostTex.offset.x = ruhig ? 0 : -(uhr * 0.95) % 1;
    const stand = lauf.padsGenommen.size;
    if (stand !== letzterPadStand) {
      letzterPadStand = stand;
      g.pads.forEach((_, i) => {
        padMeshes[i]!.stoff.opacity = lauf.padsGenommen.has(i) ? 0.4 : 1;
      });
    }

    // --- Absprungmarken: atmen mit 0,8 Hz, passierte werden blass ---
    const atmen = ruhig ? 0.65 : 0.65 + 0.35 * Math.sin(uhr * Math.PI * 1.6);
    pfeilStoff.opacity = Math.min(1, 0.55 + 0.35 * atmen);
    const markenStand = Math.floor(lauf.x * 2);
    if (markenStand !== letzterMarkenStand) {
      letzterMarkenStand = markenStand;
      g.absprung.forEach((a, j) => {
        const vorbei = a < lauf.x - 1;
        for (let k = 0; k < 3; k++) marken.setColorAt(j * 3 + k, vorbei ? farbeBlass : farbeHell);
      });
      if (marken.instanceColor) marken.instanceColor.needsUpdate = true;
    }

    // --- Tipp-Zone: leuchtet stärker, solange man darin fährt ---
    for (const z of zonen) {
      const vorbei = z.a < lauf.x - 1;
      z.vorhang.visible = !vorbei;
      z.boden.visible = !vorbei;
      if (vorbei) continue;
      const imFenster = lauf.amBoden && lauf.x >= z.a - lauf.vx * POP_FENSTER && lauf.x < z.a;
      const staerke = imFenster ? 1 : 0.7 + 0.12 * atmen;
      z.stoffV.opacity = staerke;
      z.stoffB.opacity = staerke * 0.9;
    }
  };

  const freigeben = () => {
    geometrien.forEach((x) => x.dispose());
    stoffe.forEach((x) => x.dispose());
    texturen.forEach((x) => x.dispose());
    muenzen.dispose();
    muenzLeuchten.dispose();
    padLeuchten.dispose();
    marken.dispose();
    buesche.dispose();
    bluten.dispose();
    stiele.dispose();
    steine.dispose();
  };

  return { gruppe, aktualisieren, freigeben };
}
