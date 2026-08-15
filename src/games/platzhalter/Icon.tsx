import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: die Katze aus dem Spiel jagt einen Stern über das Feld.
 * Die Katzenform ist dieselbe wie in `Platzhalter.tsx` (`KatzenGesicht`),
 * nur kleiner. Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Kleine Sterne im Hintergrund, als Nachthimmel. */
const STERNE: readonly { x: number; y: number; r: number }[] = [
  { x: 9, y: 9, r: 1.2 },
  { x: 22, y: 5, r: 0.9 },
  { x: 53, y: 30, r: 1.1 },
  { x: 12, y: 33, r: 0.9 },
];

export function PlatzhalterIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="stardash"
      verlauf={['#38bdf8', '#2563eb', '#1e1b4b']}
      schriftzug="STAR DASH"
      className={className}
    >
      {STERNE.map((s) => (
        <circle key={`${s.x},${s.y}`} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity="0.7" />
      ))}

      {/* Die Katze, aus dem Spiel übernommen: Ohren, runder Kopf, ein Auge. */}
      <g transform="translate(8,10) scale(0.26)">
        <polygon points="24,24 14,2 37,17" fill="#fbbf24" />
        <polygon points="63,17 86,2 76,24" fill="#fbbf24" />
        <path d="M50,50 L88.97,27.5 A45,45 0 1 0 88.97,72.5 Z" fill="#fbbf24" />
        <circle cx="46" cy="38" r="6" fill="#4a3708" />
      </g>

      {/* Der Stern, den sie einsammeln will — größer und mit Schein. */}
      <circle cx="45" cy="21" r="11" fill="#facc15" opacity="0.2" />
      <path
        d="M45 10.5 L47.9 18.4 L56.3 18.7 L49.7 23.9 L52 32 L45 27.3 L38 32 L40.3 23.9 L33.7 18.7 L42.1 18.4 Z"
        fill="#facc15"
      />
    </AppSymbol>
  );
}
