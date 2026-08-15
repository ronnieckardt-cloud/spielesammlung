import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: Gehirn mit Blitz und einer kleinen Rechenaufgabe — die drei
 * Übungsarten des Spiels in einem Bild. Aufbau siehe `core/AppSymbol.tsx`.
 */
export function GehirnjoggingIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="gehirnjogging"
      verlauf={['#fbbf24', '#f59e0b', '#b45309']}
      schriftzug="BRAIN BLITZ"
      className={className}
    >
      {/* Gehirn: breite, runde Form. Die rechte Hälfte liegt als heller
          Bogen darüber, dazu ein paar Windungen. */}
      <ellipse cx="24" cy="18" rx="15" ry="12.5" fill="#fecdd3" />
      <path d="M24 5.5 A15 12.5 0 0 1 24 30.5 Z" fill="#ffffff" opacity="0.55" />
      <path d="M24 5.5 v25" stroke="#be185d" strokeWidth="1.5" opacity="0.4" />
      <g fill="none" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity="0.5">
        <path d="M13.5 13 q4 1.5 3 4.5" />
        <path d="M13.5 23 q4.5 0 4.5 3.5" />
        <path d="M34.5 13 q-4 1.5 -3 4.5" />
        <path d="M34.5 23 q-4.5 0 -4.5 3.5" />
      </g>

      {/* Blitz für das schnelle Denken. */}
      <path d="M49 7 L41.5 19 h4.8 l-2.5 9 L53 16.5 h-5 Z" fill="#38bdf8" />

      {/* Kleine Aufgabe darunter — Kopfrechnen ist eine der drei Arten. */}
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontSize="9.5"
        fontWeight="800"
        fill="#ffffff"
      >
        7 × 8 = ?
      </text>
    </AppSymbol>
  );
}
