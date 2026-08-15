import { AppSymbol } from '../../core/AppSymbol';
import { SternenschluckerTeile } from './Figur';

/**
 * App-Symbol: der Sternenschlucker reißt sein Maul auf, ein Stern fällt
 * hinein. Die Figur ist dieselbe wie im Spiel (`Figur.tsx`), nur
 * verkleinert — kein zweites Mal gezeichnet. Aufbau siehe
 * `core/AppSymbol.tsx`.
 */

/** Kleine Sterne im Hintergrund, als Nachthimmel — bewusst an den Rändern,
 * damit die Mitte für Figur und fallenden Stern frei bleibt. */
const STERNE: readonly { x: number; y: number; r: number }[] = [
  { x: 7, y: 7, r: 1.2 },
  { x: 56, y: 9, r: 0.9 },
  { x: 57, y: 32, r: 1.1 },
  { x: 6, y: 30, r: 0.9 },
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

      {/* Der fallende Stern samt Schweif, genau über dem Maul — er ist
          gleich drin. */}
      <path d="M32 0 L32 4" stroke="#facc15" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path
        d="M32 3 L34.1 9.2 L40.7 9.4 L35.4 13.4 L37.3 19.8 L32 16 L26.7 19.8 L28.6 13.4 L23.3 9.4 L29.9 9.2 Z"
        fill="#facc15"
      />

      {/* Der Sternenschlucker, aus dem Spiel übernommen — mittig, damit das
          Maul unter dem Stern steht. */}
      <g transform="translate(15.5,12) scale(0.33)">
        <SternenschluckerTeile />
      </g>
    </AppSymbol>
  );
}
