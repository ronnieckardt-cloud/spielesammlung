import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: Buchstabenkärtchen mit einem Haken — im Spiel sucht man aus
 * vier Schreibweisen die richtige. Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Die Kärtchen mit ihren Buchstaben — dasselbe Wort wie im Schriftzug,
 * sonst liest sich das Symbol wie ein Tippfehler. */
const KAERTCHEN: readonly { x: number; buchstabe: string }[] = [
  { x: 6, buchstabe: 'W' },
  { x: 20, buchstabe: 'O' },
  { x: 34, buchstabe: 'R' },
  { x: 48, buchstabe: 'D' },
];

const KARTE = 11;
const OBEN = 11;

export function WortspielIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="wordplay"
      verlauf={['#f472b6', '#db2777', '#9d174d']}
      schriftzug="WORD PLAY"
      className={className}
    >
      {KAERTCHEN.map((k) => (
        <g key={k.x}>
          <rect x={k.x} y={OBEN + 1} width={KARTE} height={KARTE} rx="2.5" fill="#0b1020" opacity="0.25" />
          <rect x={k.x} y={OBEN} width={KARTE} height={KARTE} rx="2.5" fill="#ffffff" />
          <text
            x={k.x + KARTE / 2}
            y={OBEN + KARTE - 2.6}
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            fontSize="8.5"
            fontWeight="800"
            fill="#9d174d"
          >
            {k.buchstabe}
          </text>
        </g>
      ))}

      {/* Haken: die richtige Schreibweise ist gefunden. */}
      <path
        d="M22 33.5 l5.5 5.5 L42 27"
        fill="none"
        stroke="#4ade80"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </AppSymbol>
  );
}
