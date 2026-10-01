import * as THREE from 'three';
import type { Effekt } from './rig';
import type { Palette } from './umgebung';
import { mischen } from './farben';

/**
 * Erdbrocken, Staub, Funken und Ringe in 3-D.
 *
 * Die Effekte kommen als reine Daten aus `rig.ts` (`Effekt`); hier wird nur gezeigt, was dort
 * entschieden ist. Wie in der 2-D-Fassung gilt: **dezent, schwer, in der Farbe des Bodens.**
 * Staub und Rauch waren schon einmal drin und wurden entfernt („sieht komisch aus") — der zweite
 * Anlauf bleibt bei kleinen Krümeln und einem Hauch Staub nur bei einem echten Einschlag.
 *
 * Alle Streuung kommt aus einem festen Zahlengenerator, nie aus `Math.random`: Zwei Läufe mit
 * derselben Eingabe zeigen dasselbe Bild.
 *
 * Technik: Brocken sind **eine** `InstancedMesh`, Funken und Staub je **eine** `Points`-Wolke mit
 * eigenem Schattierer (Größe und Deckkraft je Punkt), Ringe ein kleiner fester Vorrat. Nichts
 * davon legt im Spiel neue Objekte an.
 */

const MAX_BROCKEN = 100;
const MAX_FUNKEN = 90;
const MAX_STAUB = 24;
const MAX_RINGE = 4;

type Brocken = { x: number; y: number; z: number; vx: number; vy: number; vz: number; leben: number; dauer: number; groesse: number; dreh: number };
type Punkt = { x: number; y: number; z: number; vx: number; vy: number; vz: number; leben: number; dauer: number; groesse: number; r: number; g: number; b: number };

export type Teilchen3D = {
  gruppe: THREE.Group;
  erzeugen: (e: Effekt, p: Palette) => void;
  schritt: (dt: number, boden: (x: number) => number) => void;
  /** Muss jedes Bild gesetzt werden: Bildpunkte je Meter in Einheitsentfernung (für die Punktgröße). */
  skala: (pixelJeMeter: number) => void;
  freigeben: () => void;
};

/** Eine Wolke aus Punkten mit Größe, Farbe und Deckkraft je Punkt, in einem Zeichenaufruf. */
function punkteWolke(max: number, additiv: boolean) {
  const lage = new Float32Array(max * 3);
  const farbe = new Float32Array(max * 4);
  const groesse = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(lage, 3));
  geo.setAttribute('farbe', new THREE.BufferAttribute(farbe, 4));
  geo.setAttribute('groesse', new THREE.BufferAttribute(groesse, 1));
  const stoff = new THREE.ShaderMaterial({
    uniforms: { uSkala: { value: 600 } },
    transparent: true,
    depthWrite: false,
    blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute vec4 farbe;
      attribute float groesse;
      uniform float uSkala;
      varying vec4 vFarbe;
      void main() {
        vFarbe = farbe;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, groesse * uSkala / max(0.1, -mv.z));
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec4 vFarbe;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;
        float a = smoothstep(1.0, 0.0, r);
        a = a * a;
        gl_FragColor = vec4(vFarbe.rgb, vFarbe.a * a);
      }
    `,
  });
  const punkte = new THREE.Points(geo, stoff);
  punkte.frustumCulled = false;
  return { punkte, lage, farbe, groesse, geo, stoff };
}

export function teilchenBauen(ruhig: boolean): Teilchen3D {
  const gruppe = new THREE.Group();
  let zufallsZustand = 0x2b1f9a3d;
  const zufall = () => {
    zufallsZustand = (Math.imul(zufallsZustand, 1664525) + 1013904223) >>> 0;
    return zufallsZustand / 4294967296;
  };
  const streuung = (k = 1) => (zufall() - 0.5) * 2 * k;

  // --- Brocken -----------------------------------------------------
  const brockenGeo = new THREE.IcosahedronGeometry(1, 0);
  const brockenStoff = new THREE.MeshLambertMaterial({ flatShading: true });
  const brockenMesh = new THREE.InstancedMesh(brockenGeo, brockenStoff, MAX_BROCKEN);
  brockenMesh.frustumCulled = false;
  brockenMesh.count = 0;
  gruppe.add(brockenMesh);
  const brocken: Brocken[] = [];
  const brockenFarbe: THREE.Color[] = [];

  // --- Funken und Staub -------------------------------------------
  const funkenWolke = punkteWolke(MAX_FUNKEN, true);
  const staubWolke = punkteWolke(MAX_STAUB, false);
  gruppe.add(staubWolke.punkte, funkenWolke.punkte);
  const funken: Punkt[] = [];
  const staub: Punkt[] = [];

  // --- Ringe -------------------------------------------------------
  type RingZustand = { mesh: THREE.Mesh; stoff: THREE.MeshBasicMaterial; leben: number; dauer: number };
  const ringGeo = new THREE.RingGeometry(0.88, 1, 40);
  const ringe: RingZustand[] = [];
  for (let i = 0; i < MAX_RINGE; i++) {
    const stoff = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(ringGeo, stoff);
    mesh.visible = false;
    gruppe.add(mesh);
    ringe.push({ mesh, stoff, leben: 0, dauer: 0.55 });
  }
  let naechsterRing = 0;

  const farbeVon = (s: string) => new THREE.Color(s);

  const erzeugen = (e: Effekt, p: Palette) => {
    if (e.art === 'erde') {
      const farbeBasis = e.farbe === 'boden' ? p.boden.oben : p.boden.saum;
      for (let i = 0; i < e.zahl; i++) {
        if (brocken.length >= MAX_BROCKEN) break;
        brocken.push({
          x: e.x,
          y: e.y + 0.08,
          z: streuung(0.5),
          // Nach hinten und oben, wie von einem Reifen abgeworfen; bei Tempo weiter.
          vx: -Math.max(1.5, e.tempo * 0.28) * (0.4 + zufall() * 0.9) + streuung(1.2),
          vy: (1.6 + zufall() * 3.4) * e.staerke,
          vz: streuung(1.1),
          leben: 0,
          dauer: 0.5 + zufall() * 0.45,
          groesse: 0.035 + zufall() * 0.05,
          dreh: zufall() * 6,
        });
        brockenFarbe.push(farbeVon(mischen(farbeBasis, zufall() < 0.5 ? '#000000' : '#ffffff', 0.05 + zufall() * 0.2)));
      }
    } else if (e.art === 'staub') {
      for (let i = 0; i < e.zahl; i++) {
        if (staub.length >= MAX_STAUB) break;
        const c = farbeVon(mischen(p.boden.saum, '#ffffff', 0.25));
        staub.push({ x: e.x + streuung(0.3), y: e.y + 0.15, z: streuung(0.5), vx: streuung(0.6) - 0.5, vy: 0.5 + zufall() * 0.7, vz: streuung(0.3), leben: 0, dauer: 0.7 + zufall() * 0.3, groesse: 0.35, r: c.r, g: c.g, b: c.b });
      }
    } else if (e.art === 'funken') {
      const c = farbeVon(e.farbe);
      for (let i = 0; i < e.zahl; i++) {
        if (funken.length >= MAX_FUNKEN) break;
        const w = zufall() * Math.PI * 2;
        const v = (1.8 + zufall() * 3.2) * e.staerke;
        funken.push({ x: e.x, y: e.y, z: 0.2, vx: Math.cos(w) * v, vy: Math.sin(w) * v + 0.8, vz: streuung(1), leben: 0, dauer: 0.35 + zufall() * 0.35, groesse: 0.09 + zufall() * 0.07, r: c.r * 1.4, g: c.g * 1.4, b: c.b * 1.4 });
      }
    } else {
      const r = ringe[naechsterRing]!;
      naechsterRing = (naechsterRing + 1) % MAX_RINGE;
      r.leben = 0;
      r.dauer = 0.55;
      r.stoff.color.set(e.farbe).multiplyScalar(1.4);
      r.mesh.position.set(e.x, e.y + 0.3, 0.3);
      r.mesh.visible = true;
    }
  };

  const o = new THREE.Object3D();

  const schritt = (dt: number, boden: (x: number) => number) => {
    if (dt <= 0) return;
    // --- Brocken ---
    for (let i = brocken.length - 1; i >= 0; i--) {
      const b = brocken[i]!;
      b.leben += dt;
      b.vy -= 18 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      const g = boden(b.x) + b.groesse * 0.6;
      if (b.y < g) {
        // Ein Hüpfer, dann ist Schluss: Krümel sollen liegen bleiben, nicht rollen.
        b.y = g;
        b.vy = Math.abs(b.vy) * 0.25;
        b.vx *= 0.5;
        b.vz *= 0.5;
        if (b.vy < 0.6) b.leben = b.dauer;
      }
      if (b.leben >= b.dauer) {
        brocken.splice(i, 1);
        brockenFarbe.splice(i, 1);
      }
    }
    brockenMesh.count = brocken.length;
    brocken.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(b.dreh + b.leben * 7, b.dreh * 2 + b.leben * 5, 0);
      // Zum Ende hin schrumpfen, statt plötzlich zu verschwinden.
      const rest = Math.min(1, (b.dauer - b.leben) * 6);
      o.scale.setScalar(b.groesse * rest);
      o.updateMatrix();
      brockenMesh.setMatrixAt(i, o.matrix);
      brockenMesh.setColorAt(i, brockenFarbe[i]!);
    });
    brockenMesh.instanceMatrix.needsUpdate = true;
    if (brockenMesh.instanceColor) brockenMesh.instanceColor.needsUpdate = true;

    // --- Funken ---
    for (let i = funken.length - 1; i >= 0; i--) {
      const f = funken[i]!;
      f.leben += dt;
      f.vy -= 9 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      if (f.leben >= f.dauer) funken.splice(i, 1);
    }
    for (let i = 0; i < MAX_FUNKEN; i++) {
      const f = funken[i];
      if (!f) {
        funkenWolke.farbe[i * 4 + 3] = 0;
        funkenWolke.groesse[i] = 0;
        continue;
      }
      const t = f.leben / f.dauer;
      funkenWolke.lage[i * 3] = f.x;
      funkenWolke.lage[i * 3 + 1] = f.y;
      funkenWolke.lage[i * 3 + 2] = f.z;
      funkenWolke.farbe[i * 4] = f.r;
      funkenWolke.farbe[i * 4 + 1] = f.g;
      funkenWolke.farbe[i * 4 + 2] = f.b;
      funkenWolke.farbe[i * 4 + 3] = 1 - t * t;
      funkenWolke.groesse[i] = f.groesse * (1 - t * 0.6);
    }
    funkenWolke.geo.attributes['position']!.needsUpdate = true;
    funkenWolke.geo.attributes['farbe']!.needsUpdate = true;
    funkenWolke.geo.attributes['groesse']!.needsUpdate = true;

    // --- Staub ---
    for (let i = staub.length - 1; i >= 0; i--) {
      const s = staub[i]!;
      s.leben += dt;
      s.vx *= Math.exp(-1.6 * dt);
      s.vy *= Math.exp(-2 * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.leben >= s.dauer) staub.splice(i, 1);
    }
    for (let i = 0; i < MAX_STAUB; i++) {
      const s = staub[i];
      if (!s) {
        staubWolke.farbe[i * 4 + 3] = 0;
        staubWolke.groesse[i] = 0;
        continue;
      }
      const t = s.leben / s.dauer;
      staubWolke.lage[i * 3] = s.x;
      staubWolke.lage[i * 3 + 1] = s.y;
      staubWolke.lage[i * 3 + 2] = s.z;
      staubWolke.farbe[i * 4] = s.r;
      staubWolke.farbe[i * 4 + 1] = s.g;
      staubWolke.farbe[i * 4 + 2] = s.b;
      staubWolke.farbe[i * 4 + 3] = 0.42 * (1 - t) * (1 - t);
      staubWolke.groesse[i] = s.groesse * (0.7 + t * 1.3);
    }
    staubWolke.geo.attributes['position']!.needsUpdate = true;
    staubWolke.geo.attributes['farbe']!.needsUpdate = true;
    staubWolke.geo.attributes['groesse']!.needsUpdate = true;

    // --- Ringe ---
    for (const r of ringe) {
      if (!r.mesh.visible) continue;
      r.leben += dt;
      const t = r.leben / r.dauer;
      if (t >= 1) {
        r.mesh.visible = false;
        continue;
      }
      // Er wächst, solange er schwächer wird — wie ein Stoß, der sich ausbreitet.
      r.mesh.scale.setScalar(0.3 + 1.6 * (1 - (1 - t) * (1 - t)));
      r.stoff.opacity = 0.85 * (1 - t);
    }
  };

  const skala = (pixelJeMeter: number) => {
    funkenWolke.stoff.uniforms['uSkala']!.value = pixelJeMeter;
    staubWolke.stoff.uniforms['uSkala']!.value = pixelJeMeter;
  };

  void ruhig;
  return {
    gruppe,
    erzeugen,
    schritt,
    skala,
    freigeben: () => {
      brockenGeo.dispose();
      brockenStoff.dispose();
      brockenMesh.dispose();
      funkenWolke.geo.dispose();
      funkenWolke.stoff.dispose();
      staubWolke.geo.dispose();
      staubWolke.stoff.dispose();
      ringGeo.dispose();
      ringe.forEach((r) => r.stoff.dispose());
    },
  };
}
