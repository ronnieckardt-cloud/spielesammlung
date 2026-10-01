import * as THREE from 'three';

/**
 * Licht und Spiegelung für die Dash-City-Szene.
 *
 * Zwei Dinge, die aus „Kunststoff im Raum" ein Bild machen:
 *
 * 1. **Eine Umgebung zum Spiegeln.** Ein metallischer Gegenstand ohne etwas,
 *    das er spiegeln kann, ist einfach dunkel — eine Münze wirkt dann wie
 *    gelber Pappkarton. Die Umgebung ist ein kleiner, im Code gebauter
 *    Himmel mit einer hellen Sonne und zwei Leuchtflächen; daraus rechnet
 *    three.js einmal eine Spiegelungsvorlage (PMREM). Kosten: einmalig ein
 *    paar Millisekunden beim Aufbau, danach nichts mehr.
 * 2. **Schatten von der Sonne**, nur für das Bewegte und das Nahe: Figur,
 *    Hindernisse, Bäume, Laternen. Die Häuser werfen keinen — ihr Schatten
 *    läge permanent quer über der halben Straße und machte sie dunkel; den
 *    Schatten der Häuserzeile liefert weiterhin der gemalte Randschatten.
 */

/** Baut die Spiegelungsvorlage. Muss mit `dispose()` freigegeben werden. */
export function umgebungBauen(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget | null {
  try {
    return umgebungErzeugen(renderer);
  } catch {
    // Spiegelungen sind Verzierung. Ein Gerät, das sie nicht rechnen kann,
    // bekommt matte statt glänzender Oberflächen — das Spiel läuft.
    return null;
  }
}

function umgebungErzeugen(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const buehne = new THREE.Scene();

  // Himmelskuppel mit Farbverlauf: oben satt blau, am Horizont fast weiß,
  // unter dem Horizont ein neutrales Grau (der Boden).
  const kuppel = new THREE.SphereGeometry(20, 32, 16);
  const farben: number[] = [];
  const oben = new THREE.Color(0x4a86d8);
  const horizont = new THREE.Color(0xe9f4ff);
  const unten = new THREE.Color(0x4a4e55);
  const pos = kuppel.attributes['position']!;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 20;
    if (h >= 0) c.copy(horizont).lerp(oben, Math.pow(h, 0.6));
    else c.copy(horizont).lerp(unten, Math.min(1, -h * 3));
    farben.push(c.r, c.g, c.b);
  }
  kuppel.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  buehne.add(
    new THREE.Mesh(kuppel, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })),
  );

  // Die Sonne: viel heller als 1, damit sich in Glanzstellen ein scharfer
  // Lichtpunkt abzeichnet. Das geht nur, weil die Vorlage in Gleitkomma
  // gerechnet wird.
  const sonne = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 6.6), side: THREE.DoubleSide }),
  );
  sonne.position.set(-9, 12, 8);
  sonne.lookAt(0, 0, 0);
  buehne.add(sonne);

  // Zwei Leuchtflächen wie bei einem Fotostudio: Sie geben Metall und Lack
  // lange, weiche Lichtstreifen statt eines gleichmäßigen Grau.
  for (const [x, z] of [
    [10, -4],
    [-6, -12],
  ] as const) {
    const flaeche = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.7), side: THREE.DoubleSide }),
    );
    flaeche.position.set(x, 8, z);
    flaeche.lookAt(0, 0, 0);
    buehne.add(flaeche);
  }

  const erzeuger = new THREE.PMREMGenerator(renderer);
  const ziel = erzeuger.fromScene(buehne, 0.03);
  erzeuger.dispose();
  kuppel.dispose();
  return ziel;
}

/** Stellt die Sonne so ein, dass sie einen scharfen Schatten über den nahen Bereich wirft. */
export function schattenEinrichten(sonne: THREE.DirectionalLight): void {
  sonne.shadow.mapSize.set(1024, 1024);
  const k = sonne.shadow.camera;
  // Der Würfel liegt um die Mitte des Nahbereichs (siehe `sonne.target`).
  // 36 m Kantenlänge bei 1024 Punkten sind knapp vier Zentimeter je Punkt —
  // genug, um die Kante eines Hindernisses sauber abzubilden.
  k.left = -18;
  k.right = 18;
  k.top = 18;
  k.bottom = -18;
  k.near = 1;
  k.far = 70;
  // Ein kleiner negativer Wert gegen Streifen auf ebenen Flächen („Akne"),
  // der Normalenversatz gegen Streifen an schrägen Kanten.
  sonne.shadow.bias = -0.0006;
  sonne.shadow.normalBias = 0.04;
  sonne.shadow.radius = 3;
}

/** Alles unter `wurzel` wirft einen Schatten. */
export function wirftSchatten(wurzel: THREE.Object3D, an = true): void {
  wurzel.traverse((t) => {
    if ((t as THREE.Mesh).isMesh) (t as THREE.Mesh).castShadow = an;
  });
}

/** Alles unter `wurzel` empfängt Schatten. */
export function empfaengtSchatten(wurzel: THREE.Object3D, an = true): void {
  wurzel.traverse((t) => {
    if ((t as THREE.Mesh).isMesh) (t as THREE.Mesh).receiveShadow = an;
  });
}
