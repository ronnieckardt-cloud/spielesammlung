import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: die Frage als Sprechblase, darunter die vier Antwortfelder in
 * den vier Farben. Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Die vier Antwortfelder, wie sie im Spiel nebeneinander stehen. */
const ANTWORTEN: readonly { x: number; farbe: string }[] = [
  { x: 5, farbe: '#f87171' },
  { x: 20, farbe: '#60a5fa' },
  { x: 35, farbe: '#facc15' },
  { x: 50, farbe: '#4ade80' },
];

export function QuizIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="quiztime"
      verlauf={['#6366f1', '#7c3aed', '#4338ca']}
      schriftzug="QUIZ TIME"
      className={className}
    >
      {/* Sprechblase mit Fragezeichen. */}
      <rect x="12" y="5" width="40" height="23" rx="6" fill="#ffffff" />
      <path d="M20 27.5 L16 34 L27 27.5 Z" fill="#ffffff" />
      <path
        d="M27.4 13.6c0-2.6 2.1-4.4 4.8-4.4 2.5 0 4.5 1.7 4.5 4 0 3.4-4.5 3.2-4.5 6.9"
        fill="none"
        stroke="#16a34a"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32.1" cy="24.4" r="2.1" fill="#16a34a" />

      {/* Die vier Antwortfelder. */}
      {ANTWORTEN.map((a) => (
        <g key={a.x}>
          <rect x={a.x} y="34.5" width="9" height="7" rx="2" fill="#0b1020" opacity="0.25" />
          <rect x={a.x} y="33.5" width="9" height="7" rx="2" fill={a.farbe} />
        </g>
      ))}
    </AppSymbol>
  );
}
