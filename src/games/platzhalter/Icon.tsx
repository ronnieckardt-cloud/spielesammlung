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

      {/* Der fallende Stern, genau über dem Maul — er ist gleich drin.
          Bewusst klein: In der ersten Fassung war er fast so hoch wie die
          Figur und drückte sie ans Schriftband. Die Figur ist der Held des
          Symbols, der Stern nur ihr Futter. */}
      <path
        d="M32 2 L33.53 5.9 L37.71 6.15 L34.47 8.8 L35.53 12.85 L32 10.6 L28.47 12.85 L29.53 8.8 L26.29 6.15 L30.47 5.9 Z"
        fill="#facc15"
      />

      {/* Der Sternenschlucker, aus dem Spiel übernommen.
          Ohne Bodenschatten: hier schwebt er vor dem Nachthimmel, ein
          Schatten hätte nichts, worauf er fällt.

          Die Zahlen sind ausgerechnet, nicht geschätzt. Die Figur füllt in
          `Figur.tsx` das Feld x = 4…96 und y = 23…94. Bei `scale(0.36)`
          bringt `translate(14, 8.2)` sie damit auf x = 15,4…48,6 (Mitte
          genau 32 von 64) und y = 16,5…42,0 — also mittig und mit zwei
          Einheiten Luft über dem Schriftband bei y = 44. Vorher saß sie
          bündig an diesem Band; auf einem Handy sah das aus, als hinge sie
          unten aus der Kachel heraus. */}
      <g transform="translate(14,8.2) scale(0.36)">
        <SternenschluckerTeile mitBodenschatten={false} />
      </g>
    </AppSymbol>
  );
}
