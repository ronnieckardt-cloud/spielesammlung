import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Ausschnitt des Bretts mit einer fast fertigen
 * Viererreihe — der Moment, um den es geht. Aufbau siehe
 * `core/AppSymbol.tsx`.
 */

const BLAU = '#38bdf8';
const ORANGE = '#fb923c';

/** Steine im Ausschnitt: `m` Mensch, `c` Computer, sonst leer. */
const STEINE: Record<string, 'm' | 'c'> = {
  '0,2': 'm',
  '1,2': 'c',
  '2,2': 'm',
  '3,2': 'c',
  '1,1': 'm',
  '2,1': 'm',
  '3,1': 'c',
  '2,0': 'm',
};

const SPALTEN = 4;
const ZEILEN = 3;
const LOCH = 12;
const ABSTAND = 2.5;
const LINKS = 5;
const OBEN = 4;

export function DropFourIcon({ className }: { className?: string }) {
  const breite = SPALTEN * LOCH + (SPALTEN - 1) * ABSTAND + 5;
  const hoehe = ZEILEN * LOCH + (ZEILEN - 1) * ABSTAND + 5;

  return (
    <AppSymbol
      id="dropfour"
      verlauf={['#60a5fa', '#1d4ed8', '#172554']}
      schriftzug="DROP FOUR"
      className={className}
    >
      {/* Das Brett. */}
      <rect x={LINKS - 2.5} y={OBEN - 2.5} width={breite} height={hoehe} rx="4" fill="#1e3a8a" />
      <rect x={LINKS - 2.5} y={OBEN - 2.5} width={breite} height="2" rx="1" fill="#ffffff" opacity="0.16" />

      {Array.from({ length: SPALTEN * ZEILEN }, (_, i) => {
        const x = i % SPALTEN;
        const y = Math.floor(i / SPALTEN);
        const cx = LINKS + x * (LOCH + ABSTAND) + LOCH / 2;
        const cy = OBEN + y * (LOCH + ABSTAND) + LOCH / 2;
        const wer = STEINE[`${x},${y}`];
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={LOCH / 2} fill="#0b1226" />
            {wer && (
              <>
                <circle cx={cx} cy={cy} r={LOCH / 2 - 1} fill={wer === 'm' ? BLAU : ORANGE} />
                {/* Kreis gegen Raute — Farbe ist nie das einzige Merkmal,
                    auch nicht im Symbol. */}
                {wer === 'm' ? (
                  <circle cx={cx} cy={cy} r="1.9" fill="#ffffff" opacity="0.5" />
                ) : (
                  <rect
                    x={cx - 1.7}
                    y={cy - 1.7}
                    width="3.4"
                    height="3.4"
                    fill="#ffffff"
                    opacity="0.5"
                    transform={`rotate(45 ${cx} ${cy})`}
                  />
                )}
                <ellipse cx={cx - 1.6} cy={cy - 2.2} rx="2.4" ry="1.4" fill="#ffffff" opacity="0.28" />
              </>
            )}
          </g>
        );
      })}

      {/* Der fallende Stein, der die Reihe schließen wird. */}
      <circle cx={LINKS + 3 * (LOCH + ABSTAND) + LOCH / 2} cy="2" r={LOCH / 2 - 1} fill={BLAU} />
    </AppSymbol>
  );
}
