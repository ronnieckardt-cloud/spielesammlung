import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: die goldene Frage über zwei Antwortbalken, wie sie auf der Gewinnleiter stehen.
 * Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Marineblau mit Gold — dieselben Farben wie das Spiel selbst (`LeiterStil` in `Quiz.tsx`). Das Symbol war
 * früher grün mit einer weißen Sprechblase, als Quiz Time noch zehn Fragen am Stück stellte; seit es eine
 * Leiter mit Jokern ist, soll die Kachel das versprechen.
 */
export function QuizIcon({ className }: { className?: string }) {
  return (
    <AppSymbol id="quiztime" verlauf={['#2744c9', '#14238a', '#070b36']} schriftzug="QUIZ TIME" className={className}>
      {/* Die Frage: eine goldene Scheibe mit Fragezeichen. */}
      <circle cx="32" cy="14.5" r="11.5" fill="#92400e" opacity="0.5" transform="translate(0 1.5)" />
      <circle cx="32" cy="14" r="11.5" fill="#fbbf24" />
      <circle cx="32" cy="14" r="9" fill="none" stroke="#fff7d6" strokeWidth="0.8" opacity="0.7" />
      <path
        d="M27.6 11.6c0-2.6 2-4.2 4.6-4.2 2.4 0 4.3 1.6 4.3 3.8 0 3.2-4.3 3-4.3 6.5"
        fill="none"
        stroke="#14238a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32.2" cy="22" r="1.9" fill="#14238a" />

      {/* Zwei Antwortbalken mit goldenem Rahmen und Buchstabenplakette. */}
      {[28.5, 36.5].map((y, i) => (
        <g key={y}>
          <rect x="7" y={y} width="50" height="6.5" rx="3.25" fill="#050a3d" stroke="#fbbf24" strokeWidth="1" />
          <circle cx="11.6" cy={y + 3.25} r="2.2" fill="#fbbf24" />
          <rect x="17" y={y + 2.3} width={i === 0 ? 24 : 18} height="1.9" rx="0.95" fill="#cbd5f5" opacity="0.8" />
        </g>
      ))}
    </AppSymbol>
  );
}
