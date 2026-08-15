import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Sechseck, sauber in zwei Hälften geteilt — die beiden
 * Stücke sind schon ein Stück auseinandergerutscht, wie im Spiel nach dem
 * Schnitt. Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Das Sechseck, einmal als obere und einmal als untere Hälfte. */
const OBEN = '32,4 47,12.5 47,21 17,21 17,12.5';
const UNTEN = '17,21 47,21 47,29.5 32,38 17,29.5';

export function HalbierenIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="evencut"
      verlauf={['#14b8a6', '#0f766e', '#134e4a']}
      schriftzug="EVEN CUT"
      className={className}
    >
      <defs>
        <linearGradient id="evencut-icon-form" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Die beiden Hälften, jeweils drei Einheiten von der Schnittlinie
          weggerückt — daran sieht man auf einen Blick, dass hier geteilt
          wurde und nicht bloß eine Linie darüberliegt. */}
      <polygon
        points={OBEN}
        fill="url(#evencut-icon-form)"
        stroke="#78350f"
        strokeWidth="1"
        transform="translate(0,-3)"
      />
      <polygon
        points={UNTEN}
        fill="url(#evencut-icon-form)"
        stroke="#78350f"
        strokeWidth="1"
        transform="translate(0,3)"
      />

      {/* Die Schnittgerade, gestrichelt wie im Spiel. */}
      <line
        x1="8"
        y1="21"
        x2="56"
        y2="21"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeDasharray="4 3"
        opacity="0.85"
      />
    </AppSymbol>
  );
}
