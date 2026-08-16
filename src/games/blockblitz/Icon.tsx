import { AppSymbol, GlanzBlock } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Ausschnitt des Spielbretts mit bunten Blöcken und einem
 * Funken fürs „Burst". Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Blöcke auf dem Brett. Kantenlänge 12, Lücke 2. Bis auf das Feld mit dem
 * Funken ist es voll — einzelne leere Felder sahen groß wie Lücken aus.
 *
 * **Oben links keine kalte Farbe.** Dort ist der Grund am hellsten: Der
 * Verlauf steht an dieser Stelle noch bei einem kräftigen Blau, und der
 * weiße Lichtschein aus `AppSymbol` liegt genau darüber und hellt ihn
 * weiter auf. Ein Violett (vorher `#a78bfa`) kam dadurch auf 1,05:1 gegen
 * seinen Untergrund — ohne Glanzkante und Schatten wäre der Block schlicht
 * unsichtbar gewesen. Das Limettengrün aus dem eigenen `farben.ts` ist die
 * hellste Farbe der Spielpalette und liegt mit rund 1,9:1 (2,4:1 ohne den
 * Lichtschein) auf der Höhe der übrigen Blöcke. Warme Töne helfen hier
 * ausdrücklich **nicht**: Orange hat fast dieselbe Helligkeit wie das Blau
 * darunter und käme auf 1,0:1. */
const BLOECKE: readonly { x: number; y: number; farbe: string }[] = [
  { x: 5, y: 7, farbe: '#a3e635' },
  { x: 19, y: 7, farbe: '#fbbf24' },
  { x: 33, y: 7, farbe: '#f472b6' },
  { x: 5, y: 21, farbe: '#22d3ee' },
  { x: 19, y: 21, farbe: '#4ade80' },
  { x: 33, y: 21, farbe: '#fb923c' },
  { x: 47, y: 21, farbe: '#f87171' },
];

const RASTER_X = [5, 19, 33, 47];
const RASTER_Y = [7, 21];

export function BlockblitzIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="blockburst"
      verlauf={['#38bdf8', '#4f46e5', '#7e22ce']}
      schriftzug="BLOCK BURST"
      className={className}
    >
      {RASTER_Y.map((y) =>
        RASTER_X.map((x) => (
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width="12"
            height="12"
            rx="3"
            fill="#0b1020"
            opacity="0.12"
          />
        )),
      )}

      {BLOECKE.map((b) => (
        <GlanzBlock key={`${b.x},${b.y}`} x={b.x} y={b.y} farbe={b.farbe} />
      ))}

      {/* Funken fürs „Burst" — vierzackiger Stern. */}
      <path
        d="M53 5.5 L55.4 11.6 L61.5 14 L55.4 16.4 L53 22.5 L50.6 16.4 L44.5 14 L50.6 11.6 Z"
        fill="#ffffff"
        opacity="0.95"
      />
    </AppSymbol>
  );
}
