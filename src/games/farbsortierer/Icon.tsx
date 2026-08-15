import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: drei Röhrchen mit Farbschichten, wie sie im Spiel sortiert
 * werden. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Wichtig: Die Röhrchen sind **oben offen**. Die erste Fassung zeichnete
 * geschlossene Kapseln — Rückmeldung: „da könnte man ja gar nicht umfüllen,
 * das macht keinen Sinn." Deshalb jetzt ein sichtbarer Rand und ein Blick
 * ins Innere.
 */

/** Röhrchen von links nach rechts, jeweils mit ihren Schichten von unten. */
const ROEHRCHEN: readonly { x: number; schichten: readonly string[] }[] = [
  { x: 8, schichten: ['#fb923c', '#facc15', '#2dd4bf'] },
  { x: 26, schichten: ['#2dd4bf', '#f472b6'] },
  { x: 44, schichten: ['#facc15', '#fb923c', '#f472b6'] },
];

const OBEN = 7;
const UNTEN = 40;
const BREITE = 12;
const RADIUS = BREITE / 2;
/** Höhe einer Schicht — vier passen ins Röhrchen. */
const SCHICHT = (UNTEN - OBEN) / 4;

/** Umriss eines Röhrchens: unten rund, oben offen (keine Linie darüber). */
function umriss(x: number): string {
  return (
    `M${x} ${OBEN} L${x} ${UNTEN - RADIUS} ` +
    `A${RADIUS} ${RADIUS} 0 0 0 ${x + BREITE} ${UNTEN - RADIUS} ` +
    `L${x + BREITE} ${OBEN}`
  );
}

export function FarbsortiererIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="colorpour"
      verlauf={['#22d3ee', '#0ea5e9', '#a855f7']}
      schriftzug="COLOR POUR"
      className={className}
    >
      <defs>
        {/* Alle drei Innenräume in einer Maske — so bleiben die Schichten
            innerhalb der Glasform, ohne je eine eigene id. Hier geschlossen
            gezeichnet, damit die Füllung bis zur Öffnung reicht. */}
        <clipPath id="colorpour-glas">
          {ROEHRCHEN.map((r) => (
            <path key={r.x} d={`${umriss(r.x)} Z`} />
          ))}
        </clipPath>
      </defs>

      {/* Glasinneres, leicht dunkel, damit helle Schichten sich abheben. */}
      <g clipPath="url(#colorpour-glas)">
        {ROEHRCHEN.map((r) => (
          <rect
            key={`innen-${r.x}`}
            x={r.x}
            y={OBEN}
            width={BREITE}
            height={UNTEN - OBEN}
            fill="#0b1020"
            opacity="0.34"
          />
        ))}

        {ROEHRCHEN.map((r) =>
          r.schichten.map((farbe, i) => (
            <rect
              key={`${r.x}-${i}`}
              x={r.x}
              y={UNTEN - (i + 1) * SCHICHT}
              width={BREITE}
              height={SCHICHT}
              fill={farbe}
            />
          )),
        )}
      </g>

      {ROEHRCHEN.map((r) => (
        <g key={`rand-${r.x}`}>
          {/* Glaswand — oben bewusst offen. */}
          <path d={umriss(r.x)} fill="none" stroke="#ffffff" strokeWidth="1.7" opacity="0.9" />
          {/* Die Öffnung: ein Ring, dessen untere Hälfte ins Innere schaut. */}
          <ellipse
            cx={r.x + RADIUS}
            cy={OBEN}
            rx={RADIUS}
            ry="2.1"
            fill="#0b1020"
            opacity="0.45"
          />
          <ellipse
            cx={r.x + RADIUS}
            cy={OBEN}
            rx={RADIUS}
            ry="2.1"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.7"
            opacity="0.95"
          />
          {/* Glanzstreifen auf der Wand. */}
          <rect
            x={r.x + 2.4}
            y={OBEN + 4}
            width="2"
            height={UNTEN - OBEN - 11}
            rx="1"
            fill="#ffffff"
            opacity="0.35"
          />
        </g>
      ))}
    </AppSymbol>
  );
}
