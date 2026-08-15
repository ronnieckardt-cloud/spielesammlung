/**
 * Die Bildteile von Blade Toss — Stamm, Messer, Apfel.
 *
 * Alles im Koordinatensystem 0…100 waagerecht, 0…130 senkrecht. Der Stamm
 * sitzt oben, darunter ist Platz für das fliegende Messer und den Vorrat.
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

/** Jahresringe — feste Liste, kein Zufall. */
const RINGE: readonly { r: number; breite: number }[] = [
  { r: 22, breite: 1.2 },
  { r: 17, breite: 0.9 },
  { r: 12, breite: 1.1 },
  { r: 7, breite: 0.8 },
];

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

/** Ein Messer, gezeichnet unten am Stamm und nach oben zeigend. */
function MesserForm() {
  const spitze = MITTE.y + RADIUS - KLINGE_TIEFE;
  const schulter = MITTE.y + RADIUS + 3;
  return (
    <>
      <path
        d={`M${MITTE.x} ${spitze} L${MITTE.x + 3} ${spitze + 7} L${MITTE.x + 3} ${schulter} L${MITTE.x - 3} ${schulter} L${MITTE.x - 3} ${spitze + 7} Z`}
        fill={KLINGE}
      />
      {/* Schattenseite rechts — macht aus der Fläche eine Klinge. */}
      <path
        d={`M${MITTE.x + 0.8} ${spitze + 2} L${MITTE.x + 3} ${spitze + 7} L${MITTE.x + 3} ${schulter} L${MITTE.x + 0.8} ${schulter} Z`}
        fill={KLINGE_DUNKEL}
      />
      <rect x={MITTE.x - 4.6} y={schulter} width="9.2" height="2.4" rx="1" fill={KLINGE_DUNKEL} />
      <rect x={MITTE.x - 3} y={schulter + 2.4} width="6" height="12" rx="2.6" fill={GRIFF} />
      <rect x={MITTE.x - 1.4} y={schulter + 4} width="1.4" height="8" rx="0.7" fill="#ffffff" opacity="0.22" />
    </>
  );
}

/**
 * Ein steckendes Messer. `drehung` ist der Winkel in Grad, um den es
 * gegenüber der Einschlagstelle unten weitergedreht ist.
 */
export function SteckendesMesser({ drehung }: { drehung: number }) {
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <MesserForm />
    </g>
  );
}

/** Höhe der Zeichenfläche. Knapp bemessen: Unter dem Stamm braucht es nur
 *  so viel Platz, dass das fliegende Messer von außerhalb hereinkommt. */
export const HOEHE = 112;

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

/** Ein Apfel auf dem Stammrand. */
export function Apfel({ drehung }: { drehung: number }) {
  const y = MITTE.y + RADIUS - 4;
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <path
        d={`M${MITTE.x} ${y - 5.5} q-1.5 -2.5 -3.5 -2.8`}
        fill="none"
        stroke="#4d7c0f"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx={MITTE.x} cy={y} r="4.6" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" paintOrder="stroke" />
      <ellipse cx={MITTE.x - 1.6} cy={y - 1.8} rx="1.5" ry="1" fill="#ffffff" opacity="0.5" />
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
