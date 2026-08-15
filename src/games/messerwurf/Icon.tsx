import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: der Stamm von vorn, drei Messer stecken schon, eines ist
 * unterwegs. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Die Figuren aus `figuren.tsx` lassen sich hier **nicht** wiederverwenden:
 * Sie sind auf die Zeichenfläche 100×130 des Spiels und einen Stamm mit
 * Radius 28 gerechnet. Das Symbol hat 64×64 und nur den Bereich bis y = 44,
 * die Maße wären also ohnehin komplett neu — dann lieber direkt und
 * lesbar hier, statt die Spielfiguren mit Maßstabsangaben zu überfrachten.
 */

const MITTE = { x: 32, y: 22 };
const RADIUS = 15;

const KLINGE = '#e2e8f0';
const GRIFF = '#3f2410';

/** Winkel der steckenden Messer, in Grad, 0 = unten. */
const STECKEN: readonly number[] = [-118, -18, 66];

/** Ein Messer, unten am Stamm, um `drehung` Grad weitergedreht. */
function Messer({ drehung, versatz = 0 }: { drehung: number; versatz?: number }) {
  const spitze = MITTE.y + RADIUS - 5;
  const schulter = MITTE.y + RADIUS + 2;
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y}) translate(0 ${versatz})`}>
      <path
        d={`M${MITTE.x} ${spitze} L${MITTE.x + 1.8} ${spitze + 4} L${MITTE.x + 1.8} ${schulter} L${MITTE.x - 1.8} ${schulter} L${MITTE.x - 1.8} ${spitze + 4} Z`}
        fill={KLINGE}
      />
      <rect x={MITTE.x - 2.7} y={schulter} width="5.4" height="1.5" rx="0.7" fill="#64748b" />
      <rect x={MITTE.x - 1.8} y={schulter + 1.5} width="3.6" height="7" rx="1.6" fill={GRIFF} />
    </g>
  );
}

export function BladeTossIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="bladetoss"
      verlauf={['#fbbf24', '#b45309', '#431407']}
      schriftzug="BLADE TOSS"
      className={className}
    >
      {/* Der Stamm mit Rinde und Jahresringen, wie im Spiel. */}
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS} fill="#5b3a1c" />
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS - 1.8} fill="#c08a4e" />
      {[11.5, 8, 4.5].map((r) => (
        <circle
          key={r}
          cx={MITTE.x}
          cy={MITTE.y}
          r={r}
          fill="none"
          stroke="#8a5c2b"
          strokeWidth="0.9"
          opacity="0.6"
        />
      ))}
      <circle cx={MITTE.x} cy={MITTE.y} r="1.5" fill="#8a5c2b" />

      {STECKEN.map((winkel) => (
        <Messer key={winkel} drehung={winkel} />
      ))}

      {/* Das fliegende Messer, kurz vorm Einschlag — es zeigt, worum es
          geht, ohne dass man das Spiel kennen muss. */}
      <Messer drehung={0} versatz={7} />
    </AppSymbol>
  );
}
