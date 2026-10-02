import { RADIUS } from './geometrie';
import { kugelFarbe, kugelZeichen } from './farben';
import type { Spezial } from './logik';

/**
 * Was in Bubble Pop **keine** gewöhnliche Farbkugel ist: der Fels und die beiden Spezialkugeln.
 *
 * Alle drei unterscheiden sich in der **Form** von den fünf Farbkugeln, nicht nur in der Farbe: Der Fels
 * ist eckig, die Bombe hat eine Zündschnur, der Regenbogen einen weißen Ring und einen Stern. Bei einem
 * Spiel, in dem man ständig „was ist das für eine Kugel?" beantwortet, darf Farbe allein nie die
 * Antwort sein (siehe die Zeichen in `farben.ts`).
 *
 * Die Zeichnungen stehen im Rechenraum des Felds (`RADIUS` = 5) und werden wie `Kugel` an einen
 * Mittelpunkt gesetzt. Die Verläufe liegen in `SpezialDefs`; wer diese Bausteine in einem eigenen
 * `<svg>` benutzt (die Knöpfe), nimmt `SpezialDefs` mit hinein — gleiche Definitionen unter gleicher id
 * sind unschädlich, wie bei den App-Symbolen.
 */

export function SpezialDefs() {
  return (
    <defs>
      <radialGradient id="bp-fels" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#e2e8f0" />
        <stop offset="0.45" stopColor="#94a3b8" />
        <stop offset="1" stopColor="#475569" />
      </radialGradient>
      <radialGradient id="bp-bombe" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#64748b" />
        <stop offset="0.5" stopColor="#1e293b" />
        <stop offset="1" stopColor="#020617" />
      </radialGradient>
    </defs>
  );
}

/** Eckiger Umriss um den Mittelpunkt, in Vielfachen des Radius. */
const FELS_UMRISS: readonly (readonly [number, number])[] = [
  [-0.15, -1],
  [0.6, -0.8],
  [1, -0.15],
  [0.85, 0.55],
  [0.2, 1],
  [-0.55, 0.9],
  [-1, 0.25],
  [-0.85, -0.5],
];

function punkte(x: number, y: number, r: number, liste: readonly (readonly [number, number])[], dy = 0): string {
  return liste.map(([a, b]) => `${(x + a * r).toFixed(2)},${(y + b * r + dy).toFixed(2)}`).join(' ');
}

/** Ein Fels: platzt nie nach Farbe, fällt aber, sobald ihm der Halt fehlt. */
export function Fels({ x, y }: { x: number; y: number }) {
  const r = RADIUS * 0.94;
  return (
    <>
      <polygon points={punkte(x, y, r, FELS_UMRISS, 0.35)} fill="#0b1020" opacity="0.45" />
      <polygon points={punkte(x, y, r, FELS_UMRISS)} fill="url(#bp-fels)" stroke="#0f172a" strokeWidth="0.5" strokeLinejoin="round" />
      {/* Eine helle Facette oben links und zwei Risse: Erst damit liest er sich als Stein und nicht als graue Kugel. */}
      <polygon
        points={punkte(x, y, r, [[-0.15, -1], [0.6, -0.8], [0.1, -0.35], [-0.6, -0.4]])}
        fill="#ffffff"
        opacity="0.28"
      />
      <polyline points={punkte(x, y, r, [[0.1, -0.35], [0.25, 0.1], [0.05, 0.45]])} fill="none" stroke="#1e293b" strokeWidth="0.45" strokeLinecap="round" opacity="0.8" />
      <polyline points={punkte(x, y, r, [[-0.6, 0.2], [-0.2, 0.3]])} fill="none" stroke="#1e293b" strokeWidth="0.4" strokeLinecap="round" opacity="0.7" />
    </>
  );
}

/** Die Bombe: dunkle Kugel mit Zündschnur und Funke. */
export function Bombe({ x, y }: { x: number; y: number }) {
  const r = RADIUS * 0.84;
  const fx = x + r * 1.05;
  const fy = y - r * 1.15;
  return (
    <>
      <circle cx={x} cy={y + 0.35} r={r} fill="#0b1020" opacity="0.45" />
      <circle cx={x} cy={y} r={r} fill="url(#bp-bombe)" stroke="#020617" strokeWidth="0.4" />
      <ellipse cx={x - r * 0.35} cy={y - r * 0.4} rx={r * 0.24} ry={r * 0.15} fill="#ffffff" opacity="0.7" />
      {/* Die Schnur kommt oben rechts heraus, der Funke sitzt an ihrem Ende. */}
      <path
        d={`M ${x + r * 0.45} ${y - r * 0.8} Q ${x + r * 0.9} ${y - r * 1.05} ${fx} ${fy}`}
        fill="none"
        stroke="#d6b88a"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      <polygon
        points={[
          [0, -1.7],
          [0.45, -0.45],
          [1.7, 0],
          [0.45, 0.45],
          [0, 1.7],
          [-0.45, 0.45],
          [-1.7, 0],
          [-0.45, -0.45],
        ]
          .map(([a, b]) => `${(fx + a! * 0.9).toFixed(2)},${(fy + b! * 0.9).toFixed(2)}`)
          .join(' ')}
        fill="#fbbf24"
        stroke="#f97316"
        strokeWidth="0.3"
      />
    </>
  );
}

/** Der Regenbogen: fünf Farbkeile, weißer Ring, heller Stern in der Mitte. */
export function Regenbogenkugel({ x, y }: { x: number; y: number }) {
  const r = RADIUS * 0.94;
  const keil = (i: number) => {
    const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a1 + (2 * Math.PI) / 5;
    const p = (a: number) => `${(x + r * Math.cos(a)).toFixed(2)} ${(y + r * Math.sin(a)).toFixed(2)}`;
    return `M ${x} ${y} L ${p(a1)} A ${r} ${r} 0 0 1 ${p(a2)} Z`;
  };
  return (
    <>
      <circle cx={x} cy={y + 0.35} r={r} fill="#0b1020" opacity="0.45" />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={keil(i)} fill={kugelFarbe(i)} />
      ))}
      <circle cx={x} cy={y} r={r} fill="none" stroke="#ffffff" strokeWidth="0.8" />
      <circle cx={x} cy={y} r={r * 0.4} fill="#ffffff" opacity="0.92" />
      <path d={kugelZeichen(4)} transform={`translate(${x} ${y}) scale(${r * 0.42})`} fill="#0b1020" opacity="0.75" />
      <ellipse cx={x - r * 0.32} cy={y - r * 0.5} rx={r * 0.22} ry={r * 0.12} fill="#ffffff" opacity="0.7" />
    </>
  );
}

export const SPEZIAL_NAME: Record<Spezial, string> = { bombe: 'Bombe', regenbogen: 'Regenbogen' };

/** Die Spezialkugel klein und für sich — für den Knopf unter dem Feld. */
export function SpezialSymbol({ art, className = 'size-6' }: { art: Spezial; className?: string }) {
  return (
    <svg viewBox="-6 -7.2 13 13" aria-hidden="true" className={className}>
      <SpezialDefs />
      {art === 'bombe' ? <Bombe x={0} y={0.4} /> : <Regenbogenkugel x={0} y={0} />}
    </svg>
  );
}
