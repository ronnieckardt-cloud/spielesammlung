import { AppSymbol } from '../../core/AppSymbol';
import { FARBEN } from './farben';

/**
 * App-Symbol: ein Ring aus vier Farbbögen, die Kugel steigt gerade hindurch.
 * Der Einblick zeigt genau die Frage, um die es im Spiel geht — passt meine
 * Farbe zu dem Bogen da? Aufbau siehe `core/AppSymbol.tsx`.
 */

const MITTE_X = 32;
const MITTE_Y = 22;
const R = 13;

/** Viertelbogen im Symbol-Koordinatensystem (y nach unten). */
function bogen(i: number): string {
  const a = (i * Math.PI) / 2;
  const b = ((i + 1) * Math.PI) / 2;
  const x1 = MITTE_X + Math.cos(a) * R;
  const y1 = MITTE_Y + Math.sin(a) * R;
  const x2 = MITTE_X + Math.cos(b) * R;
  const y2 = MITTE_Y + Math.sin(b) * R;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
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
          // Die Muster sind für Halbmesser ~25 gedacht; hier ist der Ring
          // halb so groß, also auch die Striche.
          strokeDasharray={f.muster ? f.muster.split(' ').map((n) => +n / 2).join(' ') : undefined}
        />
      ))}

      {/* Die Kugel schlüpft unten durch — in Türkis, passend zum unteren
          Bogen. Ein Symbol, das eine unmögliche Lage zeigt, wäre eine
          kleine Lüge über das Spiel. */}
      <circle cx={MITTE_X} cy={MITTE_Y + R} r={4.2} fill={FARBEN[2]!.hex} />
      <circle cx={MITTE_X - 1.4} cy={MITTE_Y + R - 1.5} r={1.3} fill="#ffffff" opacity={0.7} />

      {/* Schwungspur darunter: sie kommt von unten. */}
      <path
        d={`M ${MITTE_X} ${MITTE_Y + R + 7} L ${MITTE_X} ${MITTE_Y + R + 13}`}
        stroke={FARBEN[2]!.hex}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.45}
      />
    </AppSymbol>
  );
}
