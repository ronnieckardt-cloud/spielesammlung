import * as THREE from 'three';

/**
 * Kleine Bausteine für das 3-D-Modell von Rad und Fahrer.
 *
 * Alles hier arbeitet mit **Grundkörpern, die zwischen zwei Punkten gestreckt werden**:
 * ein Rohr, ein Glied, eine Speiche. Der Körper wird einmal gebaut und danach nur noch
 * umgesetzt — Position, Drehung und Länge —, nie neu erzeugt. Pro Bild entstehen so
 * keine Geometrien, und ein altes iPad merkt nichts davon.
 *
 * Dieselbe Regel wie bei der Figur von Dash City: Wo zwei Körper aufeinandertreffen,
 * **überlappen** sie, statt sich nur zu berühren. Ein Gelenk, an dem zwei Rohre mit
 * glatten Enden stoßen, sieht aus wie ein Spalt; eine Kugel an der Stelle schließt ihn.
 */

const ACHSE_Y = new THREE.Vector3(0, 1, 0);
const _richtung = new THREE.Vector3();
const _mitte = new THREE.Vector3();

/** Ein Rohr (oder Glied) zwischen zwei Punkten. `a` ist das untere Ende des Zylinders, `b` das obere. */
export type Segment = {
  mesh: THREE.Mesh;
  /** Setzt es zwischen `a` und `b`. `radiusB` ist der Halbmesser am Ende `b`; am Ende `a` ist er `radiusB × verjuengung`. */
  setzen: (a: THREE.Vector3, b: THREE.Vector3, radiusB: number) => void;
};

/** Gemeinsame Geometrien, damit nicht jedes Rohr seine eigene hat. Schlüssel: Segmentzahl und Verjüngung. */
const zylinder = new Map<string, THREE.CylinderGeometry>();
function zylinderGeometrie(radial: number, verjuengung: number, kappen: boolean): THREE.CylinderGeometry {
  const schluessel = `${radial}|${verjuengung}|${kappen ? 1 : 0}`;
  let g = zylinder.get(schluessel);
  if (!g) {
    g = new THREE.CylinderGeometry(1, verjuengung, 1, radial, 1, !kappen);
    zylinder.set(schluessel, g);
  }
  return g;
}

export type SegmentOptionen = {
  /** Wie viele Seiten der Zylinder hat. Klein genug für viele Teile, groß genug für runde Silhouetten. */
  radial?: number;
  /** Verhältnis der Halbmesser unten zu oben (1 = gerade). */
  verjuengung?: number;
  /** Mit Deckeln — für sichtbare Enden. Rohre, deren Enden in Knoten stecken, brauchen keine. */
  kappen?: boolean;
  /** Streckt den Querschnitt in z — aus einem Rundrohr wird ein flaches Band (Kette, Kurbel). */
  breite?: number;
};

export function segment(material: THREE.Material, opt: SegmentOptionen = {}): Segment {
  const geo = zylinderGeometrie(opt.radial ?? 12, opt.verjuengung ?? 1, opt.kappen ?? false);
  const mesh = new THREE.Mesh(geo, material);
  const breite = opt.breite ?? 1;
  const setzen = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    _richtung.subVectors(b, a);
    const laenge = _richtung.length();
    if (laenge < 1e-6) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    _mitte.addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(_mitte);
    mesh.quaternion.setFromUnitVectors(ACHSE_Y, _richtung.divideScalar(laenge));
    mesh.scale.set(r, laenge, r * breite);
  };
  return { mesh, setzen };
}

/** Eine Kugel — für Gelenke, Köpfe, Hände. */
export function kugel(material: THREE.Material, radius = 1, segmente = 14): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, segmente, Math.max(8, Math.round(segmente * 0.7))), material);
  return m;
}

/** Ein Ellipsoid: eine Einheitskugel, in drei Richtungen gestreckt. */
export function ellipsoid(material: THREE.Material, sx: number, sy: number, sz: number, segmente = 16): THREE.Mesh {
  const m = kugel(material, 1, segmente);
  m.scale.set(sx, sy, sz);
  return m;
}

/** Ein Quader mit den angegebenen Kantenlängen. */
export function quader(material: THREE.Material, bx: number, by: number, bz: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(bx, by, bz), material);
}

/** Wirft alle Körper unter `wurzel` ins Gedächtnis zum späteren Freigeben. */
export function sammler(): { merke: <T extends THREE.Object3D>(o: T) => T; freigeben: () => void } {
  const geometrien = new Set<THREE.BufferGeometry>();
  const stoffe = new Set<THREE.Material>();
  const texturen = new Set<THREE.Texture>();
  return {
    merke: (o) => {
      o.traverse((t) => {
        const m = t as THREE.Mesh;
        if (m.geometry) geometrien.add(m.geometry);
        const st = m.material;
        if (st) for (const s of Array.isArray(st) ? st : [st]) stoffe.add(s);
      });
      return o;
    },
    freigeben: () => {
      // Die gemeinsamen Zylinder liegen in einem Zwischenspeicher: Sie werden mit freigegeben
      // und beim nächsten Gebrauch neu angelegt.
      for (const g of zylinder.values()) g.dispose();
      zylinder.clear();
      geometrien.forEach((g) => g.dispose());
      stoffe.forEach((s) => {
        for (const wert of Object.values(s)) if (wert instanceof THREE.Texture) texturen.add(wert);
        s.dispose();
      });
      texturen.forEach((t) => t.dispose());
    },
  };
}

/** y nach unten (2-D-Maße) → y nach oben (Welt). Schreibt in `ziel` und gibt es zurück. */
export function nachWelt(ziel: THREE.Vector3, p: { x: number; y: number }, z = 0): THREE.Vector3 {
  return ziel.set(p.x, -p.y, z);
}
