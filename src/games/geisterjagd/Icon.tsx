import { AppSymbol } from '../../core/AppSymbol';
import { GEIST_FARBEN } from './farben';

/**
 * App-Symbol: ein Ausschnitt des Labyrinths mit Punkten, einem Geist und
 * einer Kraftpille. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Der Geist war hier weiß, im Spiel ist er seit der Farbumstellung rot —
 * das Symbol zeigt jetzt dieselbe Farbe wie das Spiel. Alles andere ist
 * unverändert geblieben.
 */

/** Die kleinen Punkte, die man einsammelt. */
const PUNKTE: readonly { x: number; y: number }[] = [
  { x: 9, y: 33 },
  { x: 18, y: 33 },
  { x: 27, y: 33 },
  { x: 36, y: 33 },
];

export function GeisterjagdIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="ghostchase"
      verlauf={['#4338ca', '#3730a3', '#1e1b4b']}
      schriftzug="GHOST CHASE"
      className={className}
    >
      {/* Labyrinthwände, wie im Spiel als runde Balken. */}
      <g fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round">
        <path d="M6 8 H30" />
        <path d="M40 8 H58" />
        <path d="M6 20 H16" />
        <path d="M26 20 H58" />
        <path d="M6 41 H24" />
        <path d="M34 41 H58" />
      </g>

      {PUNKTE.map((p) => (
        <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r="1.8" fill="#facc15" />
      ))}

      {/* Kraftpille als Stern — im Spiel macht sie die Geister fressbar. */}
      <path
        d="M50 27.5 L51.9 32.3 L56.7 34.2 L51.9 36.1 L50 40.9 L48.1 36.1 L43.3 34.2 L48.1 32.3 Z"
        fill="#facc15"
      />

      {/* Der Geist: runder Kopf, gezackter Saum, große Augen. Rot wie der
          erste Geist im Spiel (`GEIST_FARBEN[0]`) — so ändert sich das
          Symbol automatisch mit, falls die Farben im Spiel noch einmal
          gedreht werden. */}
      <g transform="translate(0,-1)">
        <path
          d="M20 30 a8 8 0 0 1 16 0 v8.5 l-2.7-2.4 -2.6 2.4 -2.7-2.4 -2.7 2.4 -2.6-2.4 -2.7 2.4 Z"
          fill={GEIST_FARBEN[0]}
        />
        <circle cx="24.6" cy="28.6" r="2.5" fill="#ffffff" />
        <circle cx="31.4" cy="28.6" r="2.5" fill="#ffffff" />
        <circle cx="25.2" cy="28.8" r="1.2" fill="#1e1b4b" />
        <circle cx="32" cy="28.8" r="1.2" fill="#1e1b4b" />
      </g>
    </AppSymbol>
  );
}
