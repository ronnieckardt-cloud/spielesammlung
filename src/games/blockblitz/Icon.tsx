/**
 * Fertiges App-Symbol im Stil echter Handyspiele — nicht wie die übrigen
 * Icons ein kleines Zeichen auf farbigem Grund, sondern die ganze Kachel:
 * eigener Farbverlauf, angedeutetes Spielbrett, glänzende Blöcke mit
 * Lichtkante, ein Funken und ein Schriftzug unten.
 *
 * Deshalb steht in `index.ts` `iconVollflaechig: true` — die Hülle legt
 * dann keinen eigenen Farbverlauf mehr darunter.
 *
 * Eigene Gestaltung: die Machart (Verlauf, Glanz, Schriftzug) ist bei
 * Puzzle-Spielen üblich, Formen und Farben sind unsere.
 */

/**
 * Rasterfelder, auf denen die bunten Blöcke sitzen. Kantenlänge 12, Lücke 2.
 * Bis auf ein Feld oben rechts (dort sitzt der Funken) ist das Brett voll —
 * einzelne leere Felder sahen bei großer Anzeige wie Lücken aus.
 */
const BLOECKE: readonly { x: number; y: number; farbe: string }[] = [
  { x: 5, y: 7, farbe: '#a78bfa' },
  { x: 19, y: 7, farbe: '#fbbf24' },
  { x: 33, y: 7, farbe: '#f472b6' },
  { x: 5, y: 21, farbe: '#22d3ee' },
  { x: 19, y: 21, farbe: '#4ade80' },
  { x: 33, y: 21, farbe: '#fb923c' },
  { x: 47, y: 21, farbe: '#f87171' },
];

/** Die schwach durchscheinenden Felder des Bretts dahinter. */
const RASTER_X = [5, 19, 33, 47];
const RASTER_Y = [7, 21];

export function BlockblitzIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        {/* Feste ids: Das Symbol kann mehrfach auf einer Seite stehen. Die
            Verläufe sind dann identisch, das Bild also überall gleich. */}
        <linearGradient id="blockburst-grund" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.45" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7e22ce" />
        </linearGradient>
        <clipPath id="blockburst-ecken">
          {/* rx 16 bei 64 Breite = dieselbe Rundung wie rounded-2xl auf der
              64px großen Kachel, und skaliert überall mit. */}
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>

      <g clipPath="url(#blockburst-ecken)">
        <rect width="64" height="64" fill="url(#blockburst-grund)" />

        {/* Weicher Lichtschein oben links, wie bei glänzenden App-Symbolen. */}
        <ellipse cx="16" cy="4" rx="34" ry="20" fill="#ffffff" opacity="0.16" />

        {/* Angedeutetes Spielbrett. */}
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

        {/* Die bunten Blöcke, jeder mit Lichtkante oben und Schatten unten. */}
        {BLOECKE.map((b) => (
          <g key={`${b.x},${b.y}`}>
            <rect x={b.x} y={b.y + 1} width="12" height="12" rx="3" fill="#0b1020" opacity="0.25" />
            <rect x={b.x} y={b.y} width="12" height="12" rx="3" fill={b.farbe} />
            <rect
              x={b.x + 1.6}
              y={b.y + 1.6}
              width="8.8"
              height="3.4"
              rx="1.7"
              fill="#ffffff"
              opacity="0.45"
            />
          </g>
        ))}

        {/* Funken für das „Burst" — vierzackiger Stern. */}
        <path
          d="M53 5.5 L55.4 11.6 L61.5 14 L55.4 16.4 L53 22.5 L50.6 16.4 L44.5 14 L50.6 11.6 Z"
          fill="#ffffff"
          opacity="0.95"
        />

        {/* Schriftzug auf dunklem Band, damit er auf jedem Verlauf lesbar
            bleibt. textLength zwingt ihn auf die Breite — so passt er auch,
            wenn ein Gerät eine andere Schrift einsetzt. */}
        <rect y="44" width="64" height="20" fill="#0b1020" opacity="0.42" />
        <text
          x="32"
          y="57.5"
          textAnchor="middle"
          textLength="50"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          fontSize="11"
          fontWeight="800"
          fill="#ffffff"
        >
          BLOCK BURST
        </text>
      </g>
    </svg>
  );
}
