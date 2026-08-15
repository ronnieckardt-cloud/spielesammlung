import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: dieselbe Schlange wie im Spiel — durchgehender Körper aus
 * vier Schichten, Querringe, Kopf mit Augen, spitzer Schwanz. Vorher war
 * hier ein einfacher grüner Strich; jetzt sieht man auf der Startseite,
 * was einen im Spiel erwartet. Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Der Weg der Schlange durchs Symbol. Endet oben rechts — dort sitzt der Kopf. */
/* Endet bei y = 17, nicht höher: Sonst stößt die Zunge über den oberen
   Rand des Symbols und wird abgeschnitten. */
const KOERPER = 'M8 35 H20 V22 H32 V17';
/** Die letzten beiden Stücke laufen dünner aus, das ergibt den Schwanz. */
const SCHWANZ = 'M8 35 H14';

const RUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Querringe: senkrecht auf waagerechten Stücken und umgekehrt. */
const RINGE: readonly { x: number; y: number; quer: boolean }[] = [
  { x: 17, y: 35, quer: true },
  { x: 20, y: 29, quer: false },
  { x: 20, y: 25, quer: false },
  { x: 25, y: 22, quer: true },
  { x: 29, y: 22, quer: true },
  { x: 32, y: 20, quer: false },
];

export function SchlangeIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="snakerush"
      verlauf={['#34d399', '#059669', '#064e3b']}
      schriftzug="SNAKE RUSH"
      className={className}
    >
      {/* Angedeutetes Spielfeldraster. */}
      <g stroke="#0b1020" strokeWidth="0.6" opacity="0.2">
        {[10, 20, 30, 40, 50].map((x) => (
          <line key={`s${x}`} x1={x} y1={2} x2={x} y2={42} />
        ))}
        {[12, 22, 32].map((y) => (
          <line key={`z${y}`} x1={3} y1={y} x2={61} y2={y} />
        ))}
      </g>

      {/* Apfel mit dunklem Hof — hebt sich so vom Grün ab. */}
      <circle cx="48" cy="33" r="6" fill="#0b0f14" opacity="0.55" />
      <circle cx="48" cy="33" r="4.6" fill="#f43f5e" />
      <ellipse cx="46.4" cy="31.4" rx="1.5" ry="1" fill="#ffffff" opacity="0.5" />
      <path d="M48 28.4 v-2" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round" />

      {/* Körper: Schatten, dunkle Kante, Fläche, Lichtkante — erst alle
          Kanten, dann alle Flächen, sonst malt die schmale Schwanzkante
          einen Ring quer über den breiten Körper. */}
      <g transform="translate(0 1.7)" opacity="0.4">
        <path d={KOERPER} stroke="#000000" strokeWidth="10.6" {...RUND} />
      </g>
      <path d={KOERPER} stroke="#065f46" strokeWidth="10.4" {...RUND} />
      <path d={SCHWANZ} stroke="#065f46" strokeWidth="6.2" {...RUND} />
      <path d={KOERPER} stroke="#16a34a" strokeWidth="8.6" {...RUND} />
      <path d={SCHWANZ} stroke="#16a34a" strokeWidth="4.5" {...RUND} />
      <g transform="translate(0 -1.6)" opacity="0.5">
        <path d={KOERPER} stroke="#6ee7b7" strokeWidth="2.9" {...RUND} />
      </g>

      {RINGE.map((r) => (
        <line
          key={`${r.x},${r.y}`}
          x1={r.x - (r.quer ? 0 : 3.6)}
          y1={r.y - (r.quer ? 3.6 : 0)}
          x2={r.x + (r.quer ? 0 : 3.6)}
          y2={r.y + (r.quer ? 3.6 : 0)}
          stroke="#065f46"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.85"
        />
      ))}

      {/* Kopf, nach oben blickend. */}
      <g transform="translate(32 17) rotate(-90)">
        <path
          d="M7.6 0 h4.6 l2.4 -1.7 M12.2 0 l2.4 1.7"
          stroke="#f43f5e"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse rx="8" ry="6.4" fill="#065f46" />
        <ellipse rx="6.9" ry="5.3" fill="#22c55e" />
        <ellipse cx="-0.7" cy="-1.6" rx="5" ry="1.9" fill="#ffffff" opacity="0.28" />
        {[-1, 1].map((seite) => (
          <g key={seite}>
            <circle cx="2" cy={2.7 * seite} r="2.2" fill="#ffffff" />
            <circle cx="2.7" cy={2.7 * seite} r="1.15" fill="#0b1020" />
          </g>
        ))}
      </g>
    </AppSymbol>
  );
}
