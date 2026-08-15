import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: die Straße läuft in die Tiefe, die Figur rennt darauf zu.
 * Der Fluchtpunkt ist hier das Wichtigste — er sagt sofort „3-D".
 * Aufbau siehe `core/AppSymbol.tsx`.
 */
export function LaufenIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="dashcity"
      verlauf={['#4338ca', '#1e1b4b', '#020617']}
      schriftzug="DASH CITY"
      className={className}
    >
      {/* Häuser links und rechts, nach hinten kleiner werdend. */}
      {[
        { x: 2, y: 8, b: 9, h: 26 },
        { x: 11, y: 14, b: 7, h: 20 },
        { x: 46, y: 6, b: 10, h: 28 },
        { x: 39, y: 13, b: 7, h: 21 },
      ].map((h) => (
        <rect key={`${h.x}`} x={h.x} y={h.y} width={h.b} height={h.h} rx={1} fill="#334155" />
      ))}

      {/* Die Straße als Trapez — das ist die Zentralprojektion in einem Bild. */}
      <path d="M20,20 L44,20 L58,42 L6,42 Z" fill="#2f3542" />
      {/* Zwei Spurtrennlinien, die auf den Fluchtpunkt zulaufen. */}
      <path d="M28,20 L22,42" stroke="#f7d774" strokeWidth={1.6} strokeDasharray="3 3" />
      <path d="M36,20 L42,42" stroke="#f7d774" strokeWidth={1.6} strokeDasharray="3 3" />

      {/* Ein Hindernis weiter hinten, klein. */}
      <rect x={29} y={23} width={7} height={3} rx={0.8} fill="#f97316" />

      {/* Die Figur, vorn und groß — von hinten, wie im Spiel. */}
      <g transform="translate(32 30)">
        <ellipse cx={0} cy={11} rx={4} ry={1.2} fill="#000000" opacity={0.35} />
        <rect x={-3} y={-2} width={6} height={9} rx={3} fill="#38bdf8" />
        <circle cx={0} cy={-5} r={3} fill="#fcd5b0" />
        <path d="M-3,-6 a3,3 0 0 1 6,0 Z" fill="#f43f5e" />
        <rect x={-3.4} y={6} width={2.6} height={5} rx={1.2} fill="#1e40af" />
        <rect x={0.8} y={6} width={2.6} height={5} rx={1.2} fill="#1e40af" />
      </g>
    </AppSymbol>
  );
}
