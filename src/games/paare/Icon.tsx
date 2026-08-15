import { AppSymbol } from '../../core/AppSymbol';
import { MOTIVE } from './motive';

/**
 * App-Symbol: sechs Karten, davon zwei mit demselben Motiv aufgedeckt —
 * genau der Moment, um den es im Spiel geht. Der Rest liegt verdeckt.
 * Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Die Rückseite einer liegenden Karte. */
const RUECKSEITE = '#4c1d95';

/** Kartenmaße im Symbol — hochkant, wie im Spiel. */
const KARTE = { breite: 15, hoehe: 19 };

/** Sechs Plätze in zwei Reihen. `motiv` gesetzt = aufgedeckt. */
const PLAETZE: readonly { x: number; y: number; motiv?: number }[] = [
  { x: 6, y: 2, motiv: 0 }, // Stern
  { x: 24.5, y: 2 },
  { x: 43, y: 2 },
  { x: 6, y: 23 },
  { x: 24.5, y: 23 },
  { x: 43, y: 23, motiv: 0 }, // derselbe Stern — das ist das Paar
];

export function PaarUpIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="pairup"
      verlauf={['#22d3ee', '#6366f1', '#4c1d95']}
      schriftzug="PAIR UP"
      className={className}
    >
      {PLAETZE.map((p) => {
        const motiv = p.motiv === undefined ? undefined : MOTIVE[p.motiv];
        return (
          <g key={`${p.x},${p.y}`}>
            <rect
              x={p.x}
              y={p.y}
              width={KARTE.breite}
              height={KARTE.hoehe}
              rx="3"
              fill={motiv ? '#f8fafc' : RUECKSEITE}
              stroke="#0b1020"
              strokeWidth="1"
              strokeOpacity="0.35"
            />
            {motiv ? (
              // Das Motiv füllt die Karte mit etwas Luft ringsum. Es ist im
              // Bereich 0…100 gezeichnet, deshalb der Maßstab.
              <g
                transform={`translate(${p.x + KARTE.breite * 0.16} ${p.y + KARTE.hoehe * 0.16}) scale(${(KARTE.breite * 0.68) / 100})`}
              >
                <path d={motiv.pfad} fill={motiv.farbe} fillRule="evenodd" />
              </g>
            ) : (
              // Verdeckte Karten bekommen einen hellen Bogen, sonst sind sie
              // bei dieser Größe nur dunkle Klötze.
              <path
                d={`M${p.x + 3} ${p.y + 4} h${KARTE.breite - 6}`}
                stroke="#ffffff"
                strokeOpacity="0.28"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </AppSymbol>
  );
}
