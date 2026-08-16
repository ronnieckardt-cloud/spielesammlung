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

/**
 * Wie weit der dunkle Saum über jede Kachel hinaussteht.
 *
 * Ohne ihn verschwand die erste Kachel im Hintergrund: Der Grundverlauf des
 * Symbols ist Türkis, und Stufe 1 (`#38bdf8`) liegt genau darauf — nachgemessen
 * 1,0:1, also überhaupt kein Unterschied. Der Saum trennt jede Kachel vom
 * Grund (rund 5:1 nach beiden Seiten), egal welche Farbe später einmal in
 * `farben.ts` steht. Derselbe Griff wie beim Männchen in Ghost Chase, wo ein
 * dunkler Saum um jede Fläche die Figur bei 17 Pixeln lesbar hält.
 */
const SAUM = 1;

/**
 * Stufen 3 bis 6, angezeigt als 8, 16, 32 und 64.
 *
 * Vorher standen hier 2, 4, 8 und 16 — die vier Anfangsfarben liegen aber alle
 * im selben Türkisbereich, das Symbol war ein einziger blaugrüner Fleck mit
 * Zahlen darin. Diese vier laufen von Türkis über Grün und Limette bis Gelb
 * und zeigen damit genau das, worum es im Spiel geht: Die Farbe verrät, wie
 * weit eine Kachel schon ist.
 */
const STUFEN = [3, 4, 5, 6] as const;

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
        const wert = 2 ** stufe;
        return (
          <g key={stufe}>
            {/* Saum und Schlagschatten in einem: rundum dunkel, nach unten
                einen halben Punkt versetzt, damit die Kachel weiter aufliegt
                statt nur umrandet zu sein. */}
            <rect
              x={x - SAUM}
              y={y - SAUM + 0.5}
              width={KACHEL + 2 * SAUM}
              height={KACHEL + 2 * SAUM}
              rx={3.5 + SAUM}
              fill="#0b1020"
              opacity="0.7"
            />
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
              // Nach Stellenzahl, nicht nach Stufe: Eine zweistellige Zahl
              // braucht die kleinere Schrift, sonst stößt sie an den Rand.
              // An der Stufe festgemacht stimmte das nur zufällig für die
              // damals gezeigten Werte.
              fontSize={String(wert).length >= 2 ? 8 : 9.5}
              fontWeight="800"
              fill={kachelTextFarbe(stufe)}
            >
              {wert}
            </text>
          </g>
        );
      })}
    </AppSymbol>
  );
}
