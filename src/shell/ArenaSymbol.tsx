import { AppSymbol } from '../core/AppSymbol';

/**
 * App-Symbol für Arena Brawler: von oben gesehen die Arena mit dem blauen Pfeil des Helden in der Mitte,
 * rote Gegner rundherum, ein paar gelbe Schüsse. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Es liegt in der Hülle und nicht in `src/games/`, weil Arena Brawler kein `GameApi`-Spiel ist (siehe
 * `Linkkachel.tsx`). Der Held ist derselbe blaue Pfeil wie im Godot-Symbol des Spiels (`icon.svg`).
 */
export function ArenaSymbol({ className }: { className?: string }) {
  return (
    <AppSymbol id="arenabrawler" verlauf={['#4b5278', '#262a40', '#10121c']} schriftzug="ARENA BRAWLER" className={className}>
      {/* Die Arena: dunkler Boden mit orangem Rand. */}
      <rect x="6" y="4.5" width="52" height="36" rx="7" fill="#161927" stroke="#f59e0b" strokeWidth="1.4" />
      <rect x="9.5" y="8" width="45" height="29" rx="4.5" fill="none" stroke="#f59e0b" strokeWidth="0.6" opacity="0.4" />

      {/* Gegner: rote Scheiben mit hellem Glanzpunkt. */}
      {[
        [15, 13],
        [49, 12],
        [50, 32],
        [14, 31],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y! + 0.9} r="4.2" fill="#7f1d1d" />
          <circle cx={x} cy={y} r="4.2" fill="#ef4444" />
          <circle cx={x! - 1.3} cy={y! - 1.4} r="1.1" fill="#fecaca" opacity="0.9" />
        </g>
      ))}

      {/* Schüsse zum nächsten Gegner. */}
      <circle cx="39.5" cy="17" r="1.4" fill="#fde047" />
      <circle cx="43.5" cy="13.6" r="1.1" fill="#fde047" opacity="0.8" />

      {/* Der Held: ein blauer Pfeil. */}
      <polygon points="32,12.5 40,24.5 35.2,24.5 35.2,33 28.8,33 28.8,24.5 24,24.5" fill="#1e3a8a" transform="translate(0 1.2)" opacity="0.6" />
      <polygon points="32,12.5 40,24.5 35.2,24.5 35.2,33 28.8,33 28.8,24.5 24,24.5" fill="#3d8bf2" stroke="#dbeafe" strokeWidth="0.9" strokeLinejoin="round" />
    </AppSymbol>
  );
}
