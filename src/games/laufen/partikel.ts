import * as THREE from 'three';
import { leuchtTextur } from './texturen';

/**
 * Partikel für Dash City: Funken beim Einsammeln, Staub beim Landen, Splitter
 * beim Aufprall.
 *
 * Zwei Systeme mit je **einem** Zeichenaufruf — Funken leuchten (additiv),
 * Staub verdeckt (normale Mischung). Beide sind feste Ringspeicher: Wer mehr
 * ausstößt, als Platz ist, überschreibt die ältesten. Es wird nie etwas
 * angelegt oder freigegeben, und nie `Math.random` benutzt (dasselbe Gesetz
 * wie in der Spiellogik: gleiche Eingabe, gleiches Bild). Die Streuung kommt
 * aus einem festen Zahlengenerator.
 *
 * Wer „weniger Bewegung" will, bekommt keine Partikel: Sie sind reine
 * Verzierung, die Spielinformation steckt woanders.
 */

const VERT = /* glsl */ `
  attribute float groesse;
  attribute float alpha;
  attribute vec3 farbe;
  varying vec3 vFarbe;
  varying float vAlpha;
  uniform float uSkala;
  void main() {
    vFarbe = farbe;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Was der Kamera zu nahe kommt, blendet aus: Eine Staubwolke, die unter
    // der Linse durchläuft, wäre ein riesiger heller Fleck.
    vAlpha = alpha * clamp((-mv.z - 1.5) / 3.5, 0.0, 1.0);
    gl_PointSize = groesse * uSkala / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D karte;
  varying vec3 vFarbe;
  varying float vAlpha;
  void main() {
    float a = texture2D(karte, gl_PointCoord).a * vAlpha;
    gl_FragColor = vec4(vFarbe * a, a);
  }
`;

type System = {
  punkte: THREE.Points;
  stoff: THREE.ShaderMaterial;
  platz: number;
  pos: Float32Array;
  geschw: Float32Array;
  leben: Float32Array;
  dauer: Float32Array;
  start: Float32Array;
  farben: Float32Array;
  attrAlpha: Float32Array;
  attrGroesse: Float32Array;
  naechster: number;
  schwerkraft: number;
  bremse: number;
};

function systemBauen(
  szene: THREE.Scene,
  karte: THREE.Texture,
  platz: number,
  additiv: boolean,
  schwerkraft: number,
  bremse: number,
): System {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(platz * 3);
  const farben = new Float32Array(platz * 3);
  const attrAlpha = new Float32Array(platz);
  const attrGroesse = new Float32Array(platz);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('farbe', new THREE.BufferAttribute(farben, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(attrAlpha, 1));
  geo.setAttribute('groesse', new THREE.BufferAttribute(attrGroesse, 1));
  const stoff = new THREE.ShaderMaterial({
    uniforms: { karte: { value: karte }, uSkala: { value: 400 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    // Der Fragment-Shader liefert Farbe **schon mit Alpha multipliziert**.
    // Additiv: Funken addieren Licht (Ziel × 1). Normal: Staub verdeckt, was
    // hinter ihm liegt (Ziel × (1 − Alpha)).
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: additiv ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
  });
  const punkte = new THREE.Points(geo, stoff);
  punkte.frustumCulled = false;
  szene.add(punkte);
  return {
    punkte,
    stoff,
    platz,
    pos,
    geschw: new Float32Array(platz * 3),
    leben: new Float32Array(platz),
    dauer: new Float32Array(platz).fill(1),
    start: new Float32Array(platz),
    farben,
    attrAlpha,
    attrGroesse,
    naechster: 0,
    schwerkraft,
    bremse,
  };
}

export type Ausstoss = {
  x: number;
  y: number;
  z: number;
  /** Anzahl Teilchen. */
  n: number;
  /** Streuung der Anfangsgeschwindigkeit je Achse. */
  streu: readonly [number, number, number];
  /** Mittlere Geschwindigkeit je Achse. */
  zug?: readonly [number, number, number];
  farbe: readonly [number, number, number];
  groesse: number;
  dauer: number;
};

export type Partikel = {
  funken: (a: Ausstoss) => void;
  staub: (a: Ausstoss) => void;
  /** `zRuecklauf`: Wie schnell die Welt auf die Kamera zuläuft (m/s). */
  aktualisieren: (dt: number, zRuecklauf: number) => void;
  skala: (hoehePixel: number, sichtfeldGrad: number) => void;
  an: (an: boolean) => void;
};

export function partikelBauen(szene: THREE.Scene): Partikel {
  const karte = leuchtTextur();
  const funkenSys = systemBauen(szene, karte, 160, true, -6.5, 0.6);
  const staubSys = systemBauen(szene, karte, 120, false, 0.4, 1.8);

  // Fester Zahlengenerator (siehe oben).
  let z = 0x9e3779b9;
  const zufall = () => {
    z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
    return z / 4294967296;
  };

  const ausstossen = (sys: System, a: Ausstoss) => {
    for (let k = 0; k < a.n; k++) {
      const i = sys.naechster;
      sys.naechster = (sys.naechster + 1) % sys.platz;
      sys.pos[i * 3] = a.x + (zufall() - 0.5) * 0.2;
      sys.pos[i * 3 + 1] = a.y + (zufall() - 0.5) * 0.2;
      sys.pos[i * 3 + 2] = a.z + (zufall() - 0.5) * 0.2;
      const zg = a.zug ?? [0, 0, 0];
      sys.geschw[i * 3] = zg[0] + (zufall() - 0.5) * 2 * a.streu[0];
      sys.geschw[i * 3 + 1] = zg[1] + (zufall() - 0.5) * 2 * a.streu[1];
      sys.geschw[i * 3 + 2] = zg[2] + (zufall() - 0.5) * 2 * a.streu[2];
      sys.dauer[i] = a.dauer * (0.7 + zufall() * 0.6);
      sys.leben[i] = sys.dauer[i]!;
      sys.start[i] = a.groesse * (0.6 + zufall() * 0.8);
      sys.farben[i * 3] = a.farbe[0];
      sys.farben[i * 3 + 1] = a.farbe[1];
      sys.farben[i * 3 + 2] = a.farbe[2];
    }
  };

  const schritt = (sys: System, dt: number, zRuecklauf: number) => {
    const bremse = Math.max(0, 1 - sys.bremse * dt);
    for (let i = 0; i < sys.platz; i++) {
      if (sys.leben[i]! <= 0) {
        sys.attrAlpha[i] = 0;
        sys.attrGroesse[i] = 0;
        continue;
      }
      sys.leben[i] = sys.leben[i]! - dt;
      const t = Math.max(0, sys.leben[i]! / sys.dauer[i]!);
      sys.geschw[i * 3 + 1] = sys.geschw[i * 3 + 1]! + sys.schwerkraft * dt;
      sys.geschw[i * 3] = sys.geschw[i * 3]! * bremse;
      sys.geschw[i * 3 + 2] = sys.geschw[i * 3 + 2]! * bremse;
      sys.pos[i * 3] = sys.pos[i * 3]! + sys.geschw[i * 3]! * dt;
      sys.pos[i * 3 + 1] = Math.max(0.02, sys.pos[i * 3 + 1]! + sys.geschw[i * 3 + 1]! * dt);
      // Die Welt läuft auf uns zu: Was auf der Straße zurückbleibt, wandert
      // mit ihr nach hinten (−z).
      sys.pos[i * 3 + 2] = sys.pos[i * 3 + 2]! + (sys.geschw[i * 3 + 2]! - zRuecklauf) * dt;
      // Aufblühen und Ausblenden: kurz hoch, dann langsam weg.
      sys.attrAlpha[i] = Math.min(1, t * 2.4) * Math.min(1, (1 - t) * 14 + 0.2);
      sys.attrGroesse[i] = sys.start[i]! * (0.55 + 0.45 * t);
    }
    const g = sys.punkte.geometry;
    (g.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes['farbe'] as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes['alpha'] as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes['groesse'] as THREE.BufferAttribute).needsUpdate = true;
  };

  return {
    // Funken sind Lichtpunkte, keine Bälle: Die Größen in den Aufrufen sind
    // für Staub gedacht, bei Funken zählt gut die Hälfte.
    funken: (a) => ausstossen(funkenSys, { ...a, groesse: a.groesse * 0.55 }),
    staub: (a) => ausstossen(staubSys, a),
    aktualisieren: (dt, zRuecklauf) => {
      schritt(funkenSys, dt, zRuecklauf);
      schritt(staubSys, dt, zRuecklauf);
    },
    skala: (hoehePixel, sichtfeldGrad) => {
      const k = hoehePixel / (2 * Math.tan((sichtfeldGrad * Math.PI) / 360));
      funkenSys.stoff.uniforms['uSkala']!.value = k;
      staubSys.stoff.uniforms['uSkala']!.value = k;
    },
    an: (an) => {
      funkenSys.punkte.visible = an;
      staubSys.punkte.visible = an;
    },
  };
}
