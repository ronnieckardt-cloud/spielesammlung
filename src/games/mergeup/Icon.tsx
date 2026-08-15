import { AppSymbol } from '../../core/AppSymbol';
import { kachelFarbe, kachelTextFarbe } from './farben';

/**
 * App-Symbol: vier Zahlenkacheln, wie sie auf dem Brett liegen — in
 * denselben Farben wie im Spiel (`farben.ts`), damit das Symbol wirklich
 * ein Einblick ist und keine eigene Erfindung. Aufbau siehe
 * `core/AppSymbol.tsx`.
 */

const KACHEL = 16;
const LUECKE = 3;
const LINKS = (64 - (2 * KACHEL + LUECKE)) / 2;
const OBEN = 4;

/** Stufen 1 bis 4, angezeigt als 2, 4, 8 und 16. */
const STUFEN = [1, 2, 3, 4] as const;

export function MergeUpIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="mergeup"
      verlauf={['#22d3ee', '#0891b2', '#155e75']}
      schriftzug="MERGE UP"
      className={className}
    >
      {STUFEN.map((stufe, i) => {
        const x = LINKS + (i % 2) * (KACHEL + LUECKE);
        const y = OBEN + Math.floor(i / 2) * (KACHEL + LUECKE);
        return (
          <g key={stufe}>
            <rect x={x} y={y + 1} width={KACHEL} height={KACHEL} rx="3.5" fill="#0b1020" opacity="0.25" />
            <rect x={x} y={y} width={KACHEL} height={KACHEL} rx="3.5" fill={kachelFarbe(stufe)} />
            <rect
              x={x + 2}
              y={y + 2}
              width={KACHEL - 4}
              height="4"
              rx="2"
              fill="#ffffff"
              opacity="0.35"
            />
            <text
              x={x + KACHEL / 2}
              y={y + KACHEL - 4.4}
              textAnchor="middle"
              fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              fontSize={stufe >= 4 ? 8 : 9.5}
              fontWeight="800"
              fill={kachelTextFarbe(stufe)}
            >
              {2 ** stufe}
            </text>
          </g>
        );
      })}
    </AppSymbol>
  );
}
