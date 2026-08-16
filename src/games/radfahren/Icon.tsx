import { AppSymbol } from '../../core/AppSymbol';

/**
 * Das App-Symbol: ein springendes Mountainbike über einer Kuppe.
 *
 * Der Einblick bleibt oberhalb von y = 44, darunter liegt das Schriftband
 * (siehe `AppSymbol`). Schwarzes Rad, weißer Helm — dieselbe Farbregel wie
 * im Spiel, damit die Kachel und das Spiel zusammengehören.
 */
export function MtbIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="mtb"
      verlauf={['#2a6f8a', '#1d4d5c', '#0f2b40']}
      schriftzug="FLOW MTB"
      className={className}
    >
      {/* Die Kuppe, über die gesprungen wird. */}
      <path d="M0 40 Q14 26 26 34 Q38 42 64 30 L64 44 L0 44 Z" fill="#1f3a2c" />
      <path d="M0 40 Q14 26 26 34 Q38 42 64 30" stroke="#5c9448" strokeWidth="2" fill="none" />

      {/* Rad, leicht angestellt wie im Flug. */}
      <g transform="translate(33 20) rotate(-16)">
        <circle cx="-8" cy="4" r="6" fill="none" stroke="#0d0d10" strokeWidth="2.4" />
        <circle cx="9" cy="4" r="6" fill="none" stroke="#0d0d10" strokeWidth="2.4" />
        <path d="M-8 4 L0 -3 L9 4 M0 -3 L-4 4" stroke="#17171c" strokeWidth="2" fill="none" />
        {/* Fahrer: schwarz, mit weißem Fullface. */}
        <path d="M-2 -5 L2 -10" stroke="#17171c" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="4" cy="-12" r="3.4" fill="#f4f6f8" />
      </g>
    </AppSymbol>
  );
}
