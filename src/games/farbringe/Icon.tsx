import { AppSymbol } from '../../core/AppSymbol';
import { FARBEN } from './farben';

/**
 * App-Symbol: ein Ring aus vier Farbbögen, die Kugel steigt gerade hindurch.
 * Der Einblick zeigt genau die Frage, um die es im Spiel geht — passt meine
 * Farbe zu dem Bogen da? Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Alles muss über `BAND_OBEN` (44) bleiben, darunter liegt das Schriftband.
 * Der Ring sitzt deshalb höher, als es die Mitte des Symbols wäre: Unter der
 * Kugel braucht die Schwungspur noch Platz.
 */

const MITTE_X = 32;
const MITTE_Y = 18;
const R = 12.5;

/**
 * Welcher Bogen unten am Tor liegt — **und** welche Farbe die Kugel trägt.
 *
 * Im Spiel kommt man nur dort durch, wo die eigene Farbe unten am Ring
 * steht. Ein Symbol, das eine unmögliche Lage zeigt, wäre eine kleine Lüge
 * über das Spiel; die beiden Stellen hängen deshalb an einer Zahl.
 */
const TOR_FARBE = 2;
const TOR = FARBEN[TOR_FARBE]!;

/** Wo die Kugel sitzt: unten am Ring, mitten im Tor. */
const KUGEL_Y = MITTE_Y + R;

/**
 * Dreht die Bögen um einen halben Bogen, damit die **Mitte** von `TOR_FARBE`
 * genau auf dem 6-Uhr-Punkt liegt.
 *
 * Ohne diese Drehung lag dort die Naht zwischen zwei Bögen — die Kugel
 * schlüpfte im Symbol also durch eine Farbe, die sie gar nicht hatte.
 */
const VERSATZ = Math.PI / 2 - (TOR_FARBE + 0.5) * (Math.PI / 2);

/** Viertelbogen im Symbol-Koordinatensystem (y nach unten). */
function bogen(i: number): string {
  const a = VERSATZ + (i * Math.PI) / 2;
  const b = VERSATZ + ((i + 1) * Math.PI) / 2;
  const x1 = MITTE_X + Math.cos(a) * R;
  const y1 = MITTE_Y + Math.sin(a) * R;
  const x2 = MITTE_X + Math.cos(b) * R;
  const y2 = MITTE_Y + Math.sin(b) * R;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Kürzester Strich, der bei 64 Einheiten Kachelbreite noch etwas hergibt. */
const MIN_STRICH = 2;

/**
 * Rechnet ein Strichmuster auf die Größe des Symbols herunter.
 *
 * Die Muster in `farben.ts` gelten für Ringhalbmesser um die 25, hier ist
 * der Ring halb so groß — also halbe Werte. Aber nie kürzer als
 * `MIN_STRICH`: Violett („1.5 6") wurde sonst zu einem Strich von 0,75
 * Einheiten auf drei Einheiten Lücke, und bei 64 Pixeln Kachelbreite sah
 * der Ring aus, als fehle ihm ein Viertel.
 */
function musterFuerSymbol(muster: string | undefined): string | undefined {
  if (!muster) return undefined;
  return muster
    .split(' ')
    .map((n) => Math.max(MIN_STRICH, +n / 2))
    .join(' ');
}

export function FarbringeIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="ringrise"
      verlauf={['#312e81', '#1e1b4b', '#020617']}
      schriftzug="RING RISE"
      className={className}
    >
      {/* Der Ring, vier Bögen mit ihren Mustern — genau wie im Spiel. */}
      <circle
        cx={MITTE_X}
        cy={MITTE_Y}
        r={R}
        fill="none"
        stroke="#0b1020"
        strokeOpacity={0.6}
        strokeWidth={6}
      />
      {FARBEN.map((f, i) => (
        <path
          key={f.id}
          d={bogen(i)}
          fill="none"
          stroke={f.hex}
          strokeWidth={4}
          strokeDasharray={musterFuerSymbol(f.muster)}
        />
      ))}

      {/* Die Kugel schlüpft unten durch, in der Farbe des unteren Bogens. */}
      <circle cx={MITTE_X} cy={KUGEL_Y} r={4.2} fill={TOR.hex} />
      <circle cx={MITTE_X - 1.4} cy={KUGEL_Y - 1.5} r={1.3} fill="#ffffff" opacity={0.7} />
      {/* Der gestrichelte Ring um die Kugel ist Pflicht, keine Zierde: Im
          Spiel wird Muster mit Muster verglichen, nicht nur Farbe mit Farbe
          (siehe farben.ts) — sonst wäre es für ein farbfehlsichtiges Kind
          nicht spielbar. Ein Symbol ohne dieses Merkmal ließe ausgerechnet
          das weg, was das Spiel als unverzichtbar beschreibt. */}
      <circle
        cx={MITTE_X}
        cy={KUGEL_Y}
        r={6.4}
        fill="none"
        stroke={TOR.hex}
        strokeWidth={1.2}
        strokeDasharray={musterFuerSymbol(TOR.muster)}
        opacity={0.95}
      />

      {/* Schwungspur darunter: sie kommt von unten. Endet bei 41,9 und damit
          knapp über dem Schriftband. */}
      <path
        d={`M ${MITTE_X} ${KUGEL_Y + 8} L ${MITTE_X} ${KUGEL_Y + 10.5}`}
        stroke={TOR.hex}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.45}
      />
    </AppSymbol>
  );
}
