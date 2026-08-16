/**
 * Die Bildteile von Blade Toss — Bretterwand, Stamm, Messer, Apfel.
 *
 * Alles im Koordinatensystem 0…100 waagerecht, 0…`HOEHE` senkrecht. Der
 * Stamm sitzt oben, darunter ist Platz für das anfliegende Messer.
 *
 * Ein steckendes Messer wird **nicht** an eine berechnete Position gesetzt,
 * sondern immer an derselben Stelle gezeichnet (unten am Stamm) und dann um
 * den Stammmittelpunkt gedreht. Das ist der Grund, warum die Logik
 * Steckwinkel und nicht Koordinaten speichert: Drehen ist eine einzige
 * Transformation, Koordinaten wären an jeder Stelle neu zu rechnen.
 */

export const MITTE = { x: 50, y: 45 };
export const RADIUS = 28;

/** Wie tief die Klinge im Holz steckt. */
const KLINGE_TIEFE = 9;

const HOLZ = '#c08a4e';
const HOLZ_DUNKEL = '#8a5c2b';
const RINDE = '#5b3a1c';
const KLINGE = '#cbd5e1';
const KLINGE_DUNKEL = '#64748b';
const GRIFF = '#3f2410';
/** Für die beiden Klingen, die am Rundenende zusammengestoßen sind. */
const ALARM_DUNKEL = '#dc2626';

const APFEL = '#dc2626';
const APFEL_RAND = '#7f1d1d';
/** Das Fruchtfleisch an der Schnittfläche. */
const APFEL_INNEN = '#fde68a';

/** Jahresringe — feste Liste, kein Zufall. */
const RINGE: readonly { r: number; breite: number }[] = [
  { r: 22, breite: 1.2 },
  { r: 17, breite: 0.9 },
  { r: 12, breite: 1.1 },
  { r: 7, breite: 0.8 },
];

/** Höhe der Zeichenfläche. Knapp bemessen: Unter dem Stamm braucht es nur
 *  so viel Platz, dass das fliegende Messer von außerhalb hereinkommt. */
export const HOEHE = 112;

/**
 * Die Bretterwand hinter dem Stamm.
 *
 * Als einziges Spiel hatte Blade Toss gar keine Brettfläche — der Stamm
 * schwebte frei auf dem Seitenhintergrund, und sein Schlagschatten lag auf
 * nichts. Die Wand gibt ihm einen Ort und ist bewusst dunkel und ruhig
 * gehalten: Das helle Holz und die Klingen sollen davor stehen, nicht mit
 * ihr um Aufmerksamkeit ringen.
 */
export function Bretterwand() {
  return (
    <g aria-hidden="true">
      <defs>
        {/* Feste id wie bei den App-Symbolen: Das Brett kann mehrfach auf
            einer Seite stehen, die Definition ist dann überall dieselbe. */}
        <linearGradient id="messerwurf-wand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f1e10" />
          <stop offset="0.55" stopColor="#1d120a" />
          <stop offset="1" stopColor="#120b05" />
        </linearGradient>
        <radialGradient id="messerwurf-schein" cx="0.5" cy={MITTE.y / HOEHE} r="0.55">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height={HOEHE} fill="url(#messerwurf-wand)" />
      {[20, 40, 60, 80].map((x) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2={HOEHE} stroke="#0a0603" strokeWidth="1" opacity="0.75" />
          <line x1={x + 0.9} y1="0" x2={x + 0.9} y2={HOEHE} stroke="#4a2f18" strokeWidth="0.5" opacity="0.5" />
        </g>
      ))}
      {/* Warmes Licht auf der Wand hinter dem Stamm — dadurch liest sich die
          Fläche als Raum und nicht als schwarzer Kasten. */}
      <rect width="100" height={HOEHE} fill="url(#messerwurf-schein)" />
    </g>
  );
}

/**
 * Der Stamm von vorn. Die Rinde ist ein eigener Ring außen, damit man
 * sieht, dass die Klingen wirklich **im** Holz stecken und nicht davor
 * liegen.
 */
export function Stamm() {
  return (
    <g aria-hidden="true">
      <circle cx={MITTE.x} cy={MITTE.y + 1.5} r={RADIUS} fill="#000000" opacity="0.35" />
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS} fill={RINDE} />
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS - 3} fill={HOLZ} />
      {RINGE.map((ring) => (
        <circle
          key={ring.r}
          cx={MITTE.x}
          cy={MITTE.y}
          r={ring.r}
          fill="none"
          stroke={HOLZ_DUNKEL}
          strokeWidth={ring.breite}
          opacity="0.55"
        />
      ))}
      <circle cx={MITTE.x} cy={MITTE.y} r="2.6" fill={HOLZ_DUNKEL} />
      {/* Lichtkante oben links, wie bei den anderen Figuren im Projekt. */}
      <path
        d={`M${MITTE.x - 19} ${MITTE.y - 16} A26 26 0 0 1 ${MITTE.x + 12} ${MITTE.y - 23}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.18"
      />
    </g>
  );
}

/**
 * Ein Messer, gezeichnet unten am Stamm und nach oben zeigend.
 *
 * `alarm` zieht einen roten Umriss darum: So ist am Rundenende zu sehen,
 * welche beiden Klingen zusammengestoßen sind.
 */
function MesserForm({ alarm = false }: { alarm?: boolean }) {
  const spitze = MITTE.y + RADIUS - KLINGE_TIEFE;
  const schulter = MITTE.y + RADIUS + 3;
  const klinge = `M${MITTE.x} ${spitze} L${MITTE.x + 3} ${spitze + 7} L${MITTE.x + 3} ${schulter} L${MITTE.x - 3} ${schulter} L${MITTE.x - 3} ${spitze + 7} Z`;
  return (
    <>
      <path d={klinge} fill={KLINGE} />
      {/* Schattenseite rechts — macht aus der Fläche eine Klinge. */}
      <path
        d={`M${MITTE.x + 0.8} ${spitze + 2} L${MITTE.x + 3} ${spitze + 7} L${MITTE.x + 3} ${schulter} L${MITTE.x + 0.8} ${schulter} Z`}
        fill={KLINGE_DUNKEL}
      />
      <rect x={MITTE.x - 4.6} y={schulter} width="9.2" height="2.4" rx="1" fill={KLINGE_DUNKEL} />
      <rect x={MITTE.x - 3} y={schulter + 2.4} width="6" height="12" rx="2.6" fill={GRIFF} />
      <rect x={MITTE.x - 1.4} y={schulter + 4} width="1.4" height="8" rx="0.7" fill="#ffffff" opacity="0.22" />
      {/* Der rote Umriss kommt **über** die Klinge und ist dünn: Ein dicker
          Saum darunter verschmolz die beiden beteiligten Messer zu einem
          roten Klecks, und dann sah man erst recht nicht, was passiert ist.
          Die Klinge bleibt stahlfarben und damit als Messer erkennbar. */}
      {alarm && <path d={klinge} fill="none" stroke={ALARM_DUNKEL} strokeWidth="1.6" strokeLinejoin="round" />}
    </>
  );
}

/**
 * Der Aufschlag zweier Klingen: ein Funkenstern am Stammrand.
 *
 * Am Rundenende stehen dort zwei Messer fast übereinander — die
 * unterscheidet niemand. Der Stern sagt „hier war der Zusammenstoß", und
 * zwar ohne sich allein auf die Farbe Rot zu verlassen.
 */
export function Zusammenstoss({ drehung }: { drehung: number }) {
  const y = MITTE.y + RADIUS - 2;
  const strahlen = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <circle cx={MITTE.x} cy={y} r="9" fill={ALARM_DUNKEL} opacity="0.3" />
      {strahlen.map((winkel) => {
        const bogen = (winkel * Math.PI) / 180;
        const lang = winkel % 90 === 0 ? 12.5 : 9.5;
        return (
          <line
            key={winkel}
            x1={MITTE.x + Math.cos(bogen) * 5}
            y1={y + Math.sin(bogen) * 5}
            x2={MITTE.x + Math.cos(bogen) * lang}
            y2={y + Math.sin(bogen) * lang}
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.95"
          />
        );
      })}
    </g>
  );
}

/**
 * Ein steckendes Messer. `drehung` ist der Winkel in Grad, um den es
 * gegenüber der Einschlagstelle unten weitergedreht ist.
 */
export function SteckendesMesser({ drehung, alarm = false }: { drehung: number; alarm?: boolean }) {
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <MesserForm alarm={alarm} />
    </g>
  );
}

/** Startversatz des fliegenden Messers — so weit unterhalb seiner Endlage
 *  beginnt es, also außerhalb der Zeichenfläche. */
const ANFLUG = 36;

/** Das Messer auf dem Weg zum Stamm. `fortschritt` läuft von 0 bis 1. */
export function FliegendesMesser({ fortschritt }: { fortschritt: number }) {
  return (
    <g transform={`translate(0 ${(1 - fortschritt) * ANFLUG})`} aria-hidden="true">
      <MesserForm />
    </g>
  );
}

/** Wo ein Apfel auf dem Stammrand sitzt. */
const APFEL_Y = MITTE.y + RADIUS - 4;

/** Ein Apfel auf dem Stammrand. */
export function Apfel({ drehung }: { drehung: number }) {
  const y = APFEL_Y;
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <path
        d={`M${MITTE.x} ${y - 5.5} q-1.5 -2.5 -3.5 -2.8`}
        fill="none"
        stroke="#4d7c0f"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx={MITTE.x} cy={y} r="4.6" fill={APFEL} stroke={APFEL_RAND} strokeWidth="1" paintOrder="stroke" />
      <ellipse cx={MITTE.x - 1.6} cy={y - 1.8} rx="1.5" ry="1" fill="#ffffff" opacity="0.5" />
    </g>
  );
}

/**
 * Die beiden Hälften eines eben zerteilten Apfels.
 *
 * Sie fliegen quer zur Klinge auseinander — das Messer kommt von unten, der
 * Schnitt liegt also senkrecht, und die Hälften weichen nach links und
 * rechts aus. `fortschritt` läuft von 0 (gerade getroffen, beide Hälften
 * liegen noch aufeinander) bis 1 (verschwunden).
 *
 * Die Zeit dafür zählt die Logik mit (`ZERTEILT_S`), nicht eine
 * CSS-Animation: Der Apfel ist im selben Augenblick aus `aepfel`
 * verschwunden, in dem er getroffen wird — die Anzeige hätte gar nichts
 * mehr, woran sie eine Animation aufhängen könnte.
 */
export function ZerteilterApfel({ drehung, fortschritt }: { drehung: number; fortschritt: number }) {
  const y = APFEL_Y;
  const weg = fortschritt * 7;
  const kippen = fortschritt * 40;
  // Erst gegen Ende ausblenden, sonst sieht man das Auseinanderfliegen kaum.
  const deckkraft = Math.max(0, 1 - fortschritt * fortschritt);
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true" opacity={deckkraft}>
      {[-1, 1].map((seite) => (
        <g
          key={seite}
          transform={`translate(${seite * weg} ${fortschritt * 2}) rotate(${seite * kippen} ${MITTE.x} ${y})`}
        >
          <path
            d={`M${MITTE.x} ${y - 4.6} A4.6 4.6 0 0 ${seite > 0 ? 1 : 0} ${MITTE.x} ${y + 4.6} Z`}
            fill={APFEL}
            stroke={APFEL_RAND}
            strokeWidth="1"
            paintOrder="stroke"
          />
          {/* Die helle Schnittfläche ist das, was „zerteilt" überhaupt lesbar
              macht — zwei rote Halbkreise allein sähen aus wie ein Apfel. */}
          <path
            d={`M${MITTE.x} ${y - 4.4} L${MITTE.x} ${y + 4.4}`}
            stroke={APFEL_INNEN}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

/** Kleines Messer für die Vorratsanzeige unten. */
export function VorratsMesser({ verbraucht }: { verbraucht: boolean }) {
  return (
    <svg viewBox="0 0 12 30" width="10" height="25" aria-hidden="true" opacity={verbraucht ? 0.22 : 1}>
      <path d="M6 0 L9 7 L9 17 L3 17 L3 7 Z" fill={KLINGE} />
      <rect x="1.4" y="17" width="9.2" height="2.4" rx="1" fill={KLINGE_DUNKEL} />
      <rect x="3" y="19.4" width="6" height="10" rx="2.6" fill={GRIFF} />
    </svg>
  );
}
