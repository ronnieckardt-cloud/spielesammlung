import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: eine Kiste kurz vor ihrem Zielring, ein Pfeil zeigt die
 * Schubrichtung. Aufbau siehe `core/AppSymbol.tsx`.
 */
export function KistenIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="boxpush"
      verlauf={['#f59e0b', '#b45309', '#451a03']}
      schriftzug="BOX PUSH"
      className={className}
    >
      {/* Bodenraster — macht klar, dass auf Feldern geschoben wird. */}
      <g stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.6}>
        {[14, 26, 38, 50].map((v) => (
          <line key={`s${v}`} x1={v} y1={8} x2={v} y2={40} />
        ))}
        {[14, 26, 38].map((v) => (
          <line key={`z${v}`} x1={8} y1={v} x2={56} y2={v} />
        ))}
      </g>

      {/* Der Zielring, rechts. */}
      <circle cx={44} cy={26} r={5} fill="none" stroke="#facc15" strokeWidth={2.4} />

      {/* Die Kiste, links daneben. */}
      <g transform="translate(20 18)">
        <rect x={0} y={0} width={16} height={16} rx={2.4} fill="#b45309" stroke="#78350f" strokeWidth={1.6} />
        <path d="M0,0 L16,16 M16,0 L0,16" stroke="#92400e" strokeWidth={1.6} />
        <path d="M2.4,2.6 H13.6" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" opacity={0.35} />
      </g>

      {/* Der Schubpfeil dazwischen. */}
      <path
        d="M12 26 H17"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.75}
      />
      <path d="M16 23 L19 26 L16 29 Z" fill="#ffffff" opacity={0.75} />
    </AppSymbol>
  );
}
