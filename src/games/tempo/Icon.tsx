import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: eine tippende Hand über den vier Farbstufen des Spiels.
 * Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Die vier Stufen, von langsam nach Regenbogen. */
const STUFEN = ['#ef4444', '#4ade80', '#7dd3fc', '#e879f9'];

export function TempoIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="taprush"
      verlauf={['#f43f5e', '#9f1239', '#1e1b4b']}
      schriftzug="TAP RUSH"
      className={className}
    >
      {/* Die vier Stufen als Balken, von unten nach oben wachsend — genau
          die Reihenfolge, die man im Spiel durchläuft. */}
      {STUFEN.map((farbe, i) => (
        <rect
          key={farbe}
          x={7 + i * 5}
          y={34 - i * 5}
          width={3.4}
          height={6 + i * 5}
          rx={1.7}
          fill={farbe}
          opacity={0.9}
        />
      ))}

      {/* Die tippende Hand: ein Finger von oben. */}
      <g transform="translate(40 6)">
        <rect x={-3.4} y={0} width={6.8} height={14} rx={3.4} fill="#fcd5b0" />
        <rect x={-4.6} y={11} width={9.2} height={9} rx={3} fill="#f3b98a" />
      </g>

      {/* Zwei Ringe als Anschlag — das Zeichen für „hier wurde getippt". */}
      <circle cx={40} cy={31} r={6} fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.85} />
      <circle cx={40} cy={31} r={10.5} fill="none" stroke="#ffffff" strokeWidth={1.2} opacity={0.4} />
    </AppSymbol>
  );
}
