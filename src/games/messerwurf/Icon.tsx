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

/**
 * Der Stamm sitzt höher und ist kleiner als in der ersten Fassung, und das
 * Messer ist kürzer. Grund: Das fliegende Messer reichte bis y = 54,5 und
 * lag damit mitten im Schriftband — vom Griff war nur noch ein heller Fleck
 * in der Schrift zu sehen. Alles muss über `BAND_OBEN` (44) bleiben.
 *
 * Die Rechnung dahinter: Das Griffende liegt `RADIUS + 7,9` unter dem
 * Mittelpunkt, beim fliegenden Messer zusätzlich um `ANFLUG` versetzt. Bei
 * einem steckenden Messer verkürzt sich der senkrechte Anteil um den Kosinus
 * seines Winkels — der tiefste ist deshalb der bei −42 Grad.
 */
const MITTE = { x: 32, y: 18 };
const RADIUS = 13;

const KLINGE = '#e2e8f0';
const GRIFF = '#3f2410';

/** Winkel der steckenden Messer, in Grad, 0 = unten. */
const STECKEN: readonly number[] = [-128, -42, 58];

/** So weit unter seiner Endlage steht das fliegende Messer noch. */
const ANFLUG = 4.5;

/** Ein Messer, unten am Stamm, um `drehung` Grad weitergedreht. */
function Messer({ drehung, versatz = 0 }: { drehung: number; versatz?: number }) {
  const spitze = MITTE.y + RADIUS - 3.5;
  const schulter = MITTE.y + RADIUS + 1.5;
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y}) translate(0 ${versatz})`}>
      <path
        d={`M${MITTE.x} ${spitze} L${MITTE.x + 1.8} ${spitze + 3} L${MITTE.x + 1.8} ${schulter} L${MITTE.x - 1.8} ${schulter} L${MITTE.x - 1.8} ${spitze + 3} Z`}
        fill={KLINGE}
      />
      <rect x={MITTE.x - 2.7} y={schulter} width="5.4" height="1.4" rx="0.7" fill="#64748b" />
      <rect x={MITTE.x - 1.8} y={schulter + 1.4} width="3.6" height="5" rx="1.6" fill={GRIFF} />
    </g>
  );
}

export function BladeTossIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="bladetoss"
      // Waldgrün statt Bernstein/Braun. Zwei Gründe: Box Push hatte
      // praktisch denselben Verlauf, und im Menü sind zwei braune Kacheln
      // mit einem braunen Ding in der Mitte bei 64 Pixeln kaum
      // auseinanderzuhalten. Dazu stand das Holz mit 1,53:1 dicht am
      // eigenen Grund — auf dem dunklen Grün sind es jetzt rund 3,8:1,
      // der Stamm steht also wirklich frei.
      verlauf={['#4d7c0f', '#1f3d0c', '#0a1503']}
      schriftzug="BLADE TOSS"
      className={className}
    >
      {/* Der Stamm mit Rinde und Jahresringen, wie im Spiel. */}
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS} fill="#5b3a1c" />
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS - 1.8} fill="#c08a4e" />
      {[9.5, 6.5, 3.5].map((r) => (
        <circle
          key={r}
          cx={MITTE.x}
          cy={MITTE.y}
          r={r}
          fill="none"
          stroke="#8a5c2b"
          // Breiter als die früheren 0,9: Bei 64 Pixeln war davon nichts
          // mehr zu sehen, und die Jahresringe sind das, was den Kreis als
          // Baumstamm lesbar macht.
          strokeWidth="1.4"
          opacity="0.65"
        />
      ))}
      <circle cx={MITTE.x} cy={MITTE.y} r="1.5" fill="#8a5c2b" />
      {/* Lichtkante oben links wie im Spiel. Auf dem dunklen Grün trägt die
          Rinde den Umriss nicht mehr allein — diese helle Kante schon. */}
      <path
        d={`M${MITTE.x - 9.5} ${MITTE.y - 7} A${RADIUS - 1} ${RADIUS - 1} 0 0 1 ${MITTE.x + 5.5} ${MITTE.y - 11.5}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.22"
      />

      {STECKEN.map((winkel) => (
        <Messer key={winkel} drehung={winkel} />
      ))}

      {/* Das fliegende Messer, kurz vorm Einschlag — es zeigt, worum es
          geht, ohne dass man das Spiel kennen muss. */}
      <Messer drehung={0} versatz={ANFLUG} />
    </AppSymbol>
  );
}
