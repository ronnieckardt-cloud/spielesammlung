import { AppSymbol } from '../../core/AppSymbol';
import { FARBEN } from './farben';

/**
 * App-Symbol: drei Punktepaare, zwei davon schon verbunden — und die Wege
 * machen einen Bogen umeinander herum. Genau das ist der Reiz des Spiels:
 * nicht der kürzeste Weg zählt, sondern der, der alles unterbringt.
 * Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Ein Weg samt seinen beiden Endpunkten. */
function Weg({ farbe, d, a, b }: { farbe: number; d: string; a: [number, number]; b: [number, number] }) {
  const f = FARBEN[farbe]!;
  return (
    <g>
      <path d={d} fill="none" stroke={f.hex} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={a[0]} cy={a[1]} r={4} fill={f.hex} stroke={f.rand} strokeWidth={0.8} />
      <circle cx={b[0]} cy={b[1]} r={4} fill={f.hex} stroke={f.rand} strokeWidth={0.8} />
    </g>
  );
}

export function VerbindenIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="flowlink"
      verlauf={['#4c1d95', '#312e81', '#0f172a']}
      schriftzug="FLOW LINK"
      className={className}
    >
      {/* Zartes Raster darunter — es macht klar, dass die Wege auf Feldern
          laufen und nicht frei gezeichnet sind. */}
      <g stroke="#ffffff" strokeOpacity={0.13} strokeWidth={0.6}>
        {[10, 20, 30, 40, 50].map((v) => (
          <line key={`s${v}`} x1={v} y1={5} x2={v} y2={40} />
        ))}
        {[10, 20, 30].map((v) => (
          <line key={`z${v}`} x1={8} y1={v} x2={56} y2={v} />
        ))}
      </g>

      <Weg farbe={0} d="M12,10 H32 V20 H52" a={[12, 10]} b={[52, 20]} />
      <Weg farbe={3} d="M12,30 H22 V20 H12" a={[12, 30]} b={[12, 20]} />
      <Weg farbe={2} d="M32,30 H52 V10" a={[32, 30]} b={[52, 10]} />
    </AppSymbol>
  );
}
