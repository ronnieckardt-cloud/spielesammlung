import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Stück der Wabe, in der gerade eine Kugel platzt — mit dem
 * Versatz jeder zweiten Zeile wie im Spiel. Aufbau siehe
 * `core/AppSymbol.tsx`.
 */

const R = 6.4;

/** Zwei Wabenzeilen, die untere um einen halben Kugeldurchmesser versetzt. */
const KUGELN: readonly { x: number; y: number; farbe: string }[] = [
  { x: 9, y: 9, farbe: '#f43f5e' },
  { x: 22, y: 9, farbe: '#38bdf8' },
  { x: 35, y: 9, farbe: '#facc15' },
  { x: 48, y: 9, farbe: '#4ade80' },
  { x: 15.5, y: 21, farbe: '#c084fc' },
  { x: 28.5, y: 21, farbe: '#4ade80' },
  { x: 41.5, y: 21, farbe: '#f43f5e' },
];

export function BubblePopIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="bubblepop"
      verlauf={['#a855f7', '#c026d3', '#86198f']}
      schriftzug="BUBBLE POP"
      className={className}
    >
      {KUGELN.map((k) => (
        <g key={`${k.x},${k.y}`}>
          <circle cx={k.x} cy={k.y} r={R} fill={k.farbe} />
          <ellipse cx={k.x - 1.9} cy={k.y - 2.2} rx="2.2" ry="1.5" fill="#ffffff" opacity="0.45" />
        </g>
      ))}

      {/* Die platzende Kugel: Ring statt Fläche, dazu wegspritzende Funken. */}
      <circle cx="22" cy="33.5" r={R - 0.6} fill="none" stroke="#ffffff" strokeWidth="2.4" />
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M13.5 25 l2.6 2.6" />
        <path d="M30.5 25 l-2.6 2.6" />
        <path d="M13.5 42 l2.6-2.6" />
        <path d="M30.5 42 l-2.6-2.6" />
      </g>

      {/* Die Kugel im Rohr, unten mittig — bereit zum Schuss. */}
      <circle cx="45" cy="36" r={R - 1} fill="#facc15" />
      <ellipse cx="43.5" cy="34.2" rx="1.8" ry="1.2" fill="#ffffff" opacity="0.45" />
    </AppSymbol>
  );
}
