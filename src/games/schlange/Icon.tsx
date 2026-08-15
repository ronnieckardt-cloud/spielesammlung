import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: die Schlange kringelt sich übers Feld und ist gleich am
 * Apfel. Aufbau siehe `core/AppSymbol.tsx`.
 */
export function SchlangeIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="snakerush"
      verlauf={['#34d399', '#059669', '#064e3b']}
      schriftzug="SNAKE RUSH"
      className={className}
    >
      {/* Angedeutetes Spielfeldraster. */}
      <g fill="#0b1020" opacity="0.13">
        {[4, 16, 28, 40].map((y) =>
          [4, 16, 28, 40, 52].map((x) => (
            <rect key={`${x},${y}`} x={x} y={y} width="10" height="10" rx="2" />
          )),
        )}
      </g>

      {/* Der Körper als ein Zug — dunkle Kante, darauf die helle Fläche. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 34 H21 V21 H33 V9" stroke="#065f46" strokeWidth="11" />
        <path d="M9 34 H21 V21 H33 V9" stroke="#4ade80" strokeWidth="8" />
      </g>

      {/* Kopf mit Auge. */}
      <circle cx="33" cy="9" r="5.6" fill="#22c55e" />
      <circle cx="34.8" cy="7.6" r="1.6" fill="#0b1020" />

      {/* Der Apfel, den sie fressen will. */}
      <circle cx="49" cy="27" r="6" fill="#f43f5e" />
      <ellipse cx="46.8" cy="24.8" rx="1.8" ry="1.2" fill="#ffffff" opacity="0.45" />
      <path d="M49 21 v-3" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" />
    </AppSymbol>
  );
}
