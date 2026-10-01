import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Nachbearbeitung — alles, was nach dem eigentlichen Zeichnen mit dem fertigen
 * Bild passiert: Leuchten (Bloom), Farbgrading, Vignette, Tempo-Unschärfe.
 *
 * Das ist der größte Einzelsprung zwischen „sieht nach Webspiel aus" und „sieht
 * nach App-Store-Spiel aus": Dieselbe Szene, aber Laternen, Münzen und
 * Leuchtschilder strahlen, die Ränder sind dunkler, und bei hohem Tempo wird
 * der Rand weich gezogen.
 *
 * **Die Qualität regelt sich selbst.** Ich kenne das Gerät nicht — ein neues
 * iPad trägt das alles mühelos, ein altes nicht. Deshalb beginnt Dash City auf
 * der höchsten Stufe und schaltet **nach Messung der Bildzeit** zurück, nie
 * wieder hinauf (sonst pendelt es an der Grenze hin und her, und jedes
 * Umschalten kostet einen Ruckler). Stufen:
 *
 * | Stufe | Inhalt |
 * |---|---|
 * | 3 | Bloom, Grading, Schatten, volle Auflösung |
 * | 2 | Bloom, Grading, **ohne** Schatten, etwas kleinere Auflösung |
 * | 1 | direkt zeichnen, ohne Nachbearbeitung, Auflösung 1,25 |
 * | 0 | direkt zeichnen, Auflösung 1 |
 */
export type Stufe = 0 | 1 | 2 | 3;

export type GradeWerte = {
  /** 0 bis 1 — wie stark der Rand zur Mitte hin verwischt wird (Tempo). */
  tempo: number;
  /** 0 bis 1 — Farbsäume am Rand, nur bei Turbo. */
  turbo: number;
};

export type Nachbearbeitung = {
  stufe: () => Stufe;
  /** Zeichnet ein Bild. `dt` dient der Messung der Bildzeit. */
  rendern: (dt: number, werte: GradeWerte) => void;
  groesse: (breite: number, hoehe: number) => void;
  aufraeumen: () => void;
};

/**
 * Nur für Prüfungen am Rechner: Ein Software-Renderer schafft nie 40 Bilder je
 * Sekunde und würde sofort auf Stufe 0 zurückschalten, und dann wäre von allem
 * hier nichts zu sehen. Auf einem echten Gerät ist der Wert nie gesetzt.
 */
function startStufe(haken: string): Stufe {
  const wert = (globalThis as Record<string, unknown>)[haken];
  return wert === 0 || wert === 1 || wert === 2 || wert === 3 ? wert : 3;
}

/** Soll das automatische Zurückschalten laufen? Aus, wenn die Stufe erzwungen ist. */
function automatisch(haken: string): boolean {
  return (globalThis as Record<string, unknown>)[haken] === undefined;
}

const GRADE = {
  name: 'Grade',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTempo: { value: 0 },
    uTurbo: { value: 0 },
    uVignette: { value: 0.38 },
    uSat: { value: 1.1 },
    uKon: { value: 1.07 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /*
   * Das Bild kommt hier schon **fertig tonwertgemappt und in sRGB** an (der
   * OutputPass steht davor). Vignette, Sättigung und Kontrast verhalten sich
   * nur in diesem Raum so, wie man sie erwartet — im linearen HDR-Raum wirkt
   * dieselbe Sättigungszahl völlig anders.
   */
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTempo;
    uniform float uTurbo;
    uniform float uVignette;
    uniform float uSat;
    uniform float uKon;
    varying vec2 vUv;

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);

      // Tempo: Der Rand wird zur Mitte hin gezogen. Fünf Abtastungen reichen,
      // das Ergebnis ist ein weicher Fluchtstrich, kein echtes Bewegungsbild.
      vec3 farbe;
      if (uTempo > 0.01) {
        float zug = uTempo * r2 * 0.12;
        vec3 summe = vec3(0.0);
        for (int i = 0; i < 5; i++) {
          float t = float(i) / 4.0;
          summe += texture2D(tDiffuse, vUv - c * zug * t).rgb;
        }
        farbe = summe / 5.0;
      } else {
        farbe = texture2D(tDiffuse, vUv).rgb;
      }

      // Farbsäume am Rand — nur bei Turbo, sonst wirkt es wie ein Fehler.
      if (uTurbo > 0.01) {
        float s = uTurbo * r2 * 0.011;
        farbe.r = texture2D(tDiffuse, vUv - c * s).r;
        farbe.b = texture2D(tDiffuse, vUv + c * s).b;
      }

      float hell = dot(farbe, vec3(0.299, 0.587, 0.114));
      farbe = mix(vec3(hell), farbe, uSat);
      farbe = (farbe - 0.5) * uKon + 0.5;

      // Vignette: Die Mitte bleibt frei, nur die Ecken werden dunkel.
      float rand = smoothstep(0.12, 0.62, r2);
      farbe *= 1.0 - uVignette * rand;

      // Ein Hauch Rauschen gegen Streifen im Himmelsverlauf — fest je Pixel,
      // **nicht** zeitabhängig: Flimmern wäre ein Dauerpuls.
      float k = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      farbe += (k - 0.5) / 255.0;

      gl_FragColor = vec4(farbe, 1.0);
    }
  `,
};

export function nachbearbeitungBauen(
  renderer: THREE.WebGLRenderer,
  szene: THREE.Scene,
  kamera: THREE.Camera,
  beiStufe: (stufe: Stufe) => void,
  ruhig: boolean,
  /**
   * Name des Prüfhakens, der eine Stufe erzwingt (nur für Bildschirmfotos am Rechner).
   * Jedes Spiel hat seinen eigenen, damit ein gesetzter Wert nie ein anderes Spiel beeinflusst.
   */
  haken = '__dashQualitaet',
): Nachbearbeitung {
  let stufe: Stufe = startStufe(haken);
  let breite = 1;
  let hoehe = 1;

  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  let grade: ShaderPass | null = null;

  const pixelDichte = (s: Stufe) => {
    const geraet = window.devicePixelRatio || 1;
    return Math.min(geraet, s === 3 ? 1.75 : s === 2 ? 1.5 : s === 1 ? 1.25 : 1);
  };

  const composerBauen = () => {
    const ziel = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      // Vierfache Kantenglättung im Zwischenbild: Der Standard-Rahmen glättet
      // nur, wenn direkt auf den Bildschirm gezeichnet wird.
      samples: stufe === 3 ? 4 : 2,
    });
    composer = new EffectComposer(renderer, ziel);
    composer.addPass(new RenderPass(szene, kamera));
    // Bloom auf halber Auflösung: Ein Leuchten ist ohnehin weich, und der
    // Unterschied zur vollen Auflösung ist nicht zu sehen.
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GRADE);
    composer.addPass(grade);
  };

  const anwenden = () => {
    renderer.setPixelRatio(pixelDichte(stufe));
    renderer.setSize(breite, hoehe, false);
    if (composer) {
      composer.setPixelRatio(pixelDichte(stufe));
      composer.setSize(breite, hoehe);
      bloom?.setSize(Math.round(breite * pixelDichte(stufe) * 0.5), Math.round(hoehe * pixelDichte(stufe) * 0.5));
    }
  };

  // Gleitkomma-Zwischenbilder braucht der Leuchtfilter. Fehlt dem Gerät die
  // Erweiterung, bleibt nur das direkte Zeichnen — ohne diese Prüfung gäbe
  // es kein Fehlersignal, sondern ein schwarzes Bild.
  const hdrMoeglich =
    renderer.extensions.has('EXT_color_buffer_float') ||
    renderer.extensions.has('EXT_color_buffer_half_float');
  if (!hdrMoeglich && stufe >= 2) stufe = 1;
  if (stufe >= 2) {
    try {
      composerBauen();
    } catch {
      // Lieber ein schlichteres Bild als gar keins.
      composer = null;
      bloom = null;
      grade = null;
      stufe = 1;
    }
  }
  beiStufe(stufe);

  // --- Bildzeit messen -------------------------------------------------
  let eingewoehnung = 45; // Die ersten Bilder übersetzen Shader und sind immer langsam.
  let summe = 0;
  let zahl = 0;
  const FENSTER = 70;
  /** Ab 28 ms je Bild (rund 35 Bilder/s) wird zurückgeschaltet. */
  const GRENZE = 0.028;

  const stufeSenken = () => {
    if (stufe === 0) return;
    stufe = (stufe - 1) as Stufe;
    if (stufe < 2 && composer) {
      composer.dispose();
      composer = null;
      bloom = null;
      grade = null;
    }
    anwenden();
    beiStufe(stufe);
    // Nach dem Umschalten wieder einwöhnen: Neu übersetzte Programme und
    // Zwischenspeicher lassen das nächste Fenster zu schlecht aussehen.
    eingewoehnung = 30;
    summe = 0;
    zahl = 0;
  };

  const beobachten = (dt: number) => {
    if (!automatisch(haken)) return;
    if (eingewoehnung > 0) {
      eingewoehnung -= 1;
      return;
    }
    // Ein gedeckelter Zeitschritt (50 ms) heißt: App-Wechsel oder Pause — das
    // sagt nichts über die Leistung des Geräts.
    if (dt >= 0.049) return;
    summe += dt;
    zahl += 1;
    if (zahl >= FENSTER) {
      if (summe / zahl > GRENZE) stufeSenken();
      summe = 0;
      zahl = 0;
    }
  };

  // Tempo und Turbo gleiten, statt zu springen.
  let tempoWeich = 0;
  let turboWeich = 0;

  const rendern = (dt: number, werte: GradeWerte) => {
    if (composer && grade) {
      const f = Math.min(1, dt * 5);
      tempoWeich += ((ruhig ? 0 : werte.tempo) - tempoWeich) * f;
      turboWeich += ((ruhig ? 0 : werte.turbo) - turboWeich) * f;
      grade.uniforms['uTempo']!.value = tempoWeich;
      grade.uniforms['uTurbo']!.value = turboWeich;
      composer.render(dt);
    } else {
      renderer.render(szene, kamera);
    }
    beobachten(dt);
  };

  const groesse = (b: number, h: number) => {
    breite = b;
    hoehe = h;
    anwenden();
  };

  const aufraeumen = () => {
    composer?.dispose();
    composer = null;
  };

  return { stufe: () => stufe, rendern, groesse, aufraeumen };
}
