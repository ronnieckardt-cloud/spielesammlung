import { AppSymbol } from '../../core/AppSymbol';
import { GEIST_FARBEN, PILLE_FARBE, PUNKT_FARBE, WAND_FARBE } from './farben';
import { GeistTeile, KRAFTPILLE_PFAD } from './figuren';

/**
 * App-Symbol: ein Ausschnitt des Labyrinths, wie er im Spiel wirklich
 * aussieht — dunkles Brett, Schiefer-Wände, gelbe Punkte, zwei Kraftpillen
 * als Sterne und mittendrin ein Geist. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Drei Dinge sind hier gerechnet, nicht geschätzt:
 *
 * 1. **Der Geist ist der Geist aus dem Spiel** (`GeistTeile` aus
 *    `figuren.tsx`), nur verkleinert — kein zweites Mal gezeichnet. Vorher
 *    stand hier eine eigene Zeichnung mit anderem Dach und spitzem
 *    Zickzacksaum; sie hätte sich beim nächsten Umbau der Figur still von
 *    ihr entfernt, und genau das will `CLAUDE.md` mit „der Einblick soll
 *    wirklich das Spiel zeigen" verhindern.
 * 2. **Die Wände brauchen ihr dunkles Brett.** Im Spiel sind sie
 *    `WAND_FARBE` (#334155) auf fast schwarzem Grund. Dieselbe Farbe direkt
 *    auf den Verlauf dieses Symbols gelegt ergibt gegen dessen Mitte
 *    (#3730a3) einen Kontrast von 1,04:1 — die Wände wären schlicht
 *    unsichtbar, derselbe Fehler wie einst bei Box Push. Deshalb liegt
 *    unter ihnen die Brettfläche des Spiels (`--color-grund`), und erst
 *    darauf stimmt die Farbe wieder.
 * 3. **Waagerechte *und* senkrechte Wände.** Vorher waren es sechs
 *    Querbalken ohne eine einzige Senkrechte — bei 64 Pixeln las sich das
 *    als gestreifter Hintergrund, nicht als Labyrinth. Erst die vier Ecken
 *    machen Gänge und Abzweigungen erkennbar.
 */

/** Die Brettfläche des Spiels (`--color-grund` aus `styles/index.css`). */
const BRETT_FARBE = '#0b0f14';

/**
 * Die Wandstücke des Ausschnitts: vier Ecken und ein Balken über dem Geist.
 * Gezeichnet als runde Balken, genau wie die Wandkacheln im Spiel.
 *
 * Die Ecken sind wichtig — sie tragen die Senkrechten. Und der Balken oben
 * liegt waagerecht quer und **nicht** als kurzer Steg mittig über dem Kopf:
 * Ein senkrechter Steg bei x = 32 sah in der Vorschau aus wie eine Antenne
 * am Geist, nicht wie eine Wand.
 */
const WAENDE: readonly string[] = [
  'M8 8 H15 V15', // Ecke oben links
  'M56 8 H49 V15', // Ecke oben rechts
  'M24 6 H40', // Decke über dem Geist
  'M8 31 H15 V25', // Ecke unten links
  'M56 31 H49 V25', // Ecke unten rechts
];

/** Die kleinen Punkte, die man einsammelt — im Gang unter dem Geist. */
const PUNKTE: readonly number[] = [11, 21, 31, 41, 51];

/** Die zwei Kraftpillen, in den Seitengängen links und rechts. */
const PILLEN: readonly { x: number; y: number }[] = [
  { x: 9, y: 19.5 },
  { x: 55, y: 19.5 },
];

/** Größe einer Kraftpille im Symbol; der Pfad selbst ist 24 Einheiten breit. */
const PILLE_SKALA = 0.45;

export function GeisterjagdIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="ghostchase"
      verlauf={['#4338ca', '#3730a3', '#1e1b4b']}
      schriftzug="GHOST CHASE"
      className={className}
    >
      {/* Das Brett, mit derselben feinen Lichtkante wie `.spielbrett-rahmen`
          im Spiel. Der Verlauf bleibt ringsum als Rahmen sichtbar. */}
      <rect
        x="3"
        y="2"
        width="58"
        height="39"
        rx="5"
        fill={BRETT_FARBE}
        stroke="#ffffff"
        strokeOpacity="0.1"
        strokeWidth="0.8"
      />

      <g fill="none" stroke={WAND_FARBE} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {WAENDE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {PUNKTE.map((x) => (
        <circle key={x} cx={x} cy="37.5" r="1.6" fill={PUNKT_FARBE} />
      ))}

      {PILLEN.map((p) => (
        <g
          key={`${p.x},${p.y}`}
          // Der Stern sitzt in seiner 24er-Fläche um (12, 11.2) — von dort
          // aus auf den gewünschten Mittelpunkt geschoben.
          transform={`translate(${p.x - 12 * PILLE_SKALA} ${p.y - 11.2 * PILLE_SKALA}) scale(${PILLE_SKALA})`}
        >
          <path d={KRAFTPILLE_PFAD} fill={PILLE_FARBE} />
        </g>
      ))}

      {/* Der Geist aus dem Spiel, rot wie `GEIST_FARBEN[0]` — so ändert sich
          das Symbol von allein mit, falls die Farben noch einmal gedreht
          werden. Die Zahlen: Die Figur füllt in `figuren.tsx` x = 4…36 und
          y = 4…34. Bei `scale(0.66)` bringt `translate(18.8, 10.36)` sie auf
          x = 21,4…42,6 (Mitte genau 32 von 64) und y = 13…32,8 — also mittig
          im Gang, mit fünf Einheiten Luft zur Decke und zu den Punkten
          darunter. Viel kleiner geht es nicht: Die Pupillen haben in der
          Figur Radius 2, hier also 1,3 — auf einer 64 Pixel großen Kachel
          sind das gut zweieinhalb Pixel Durchmesser. Bei halber Größe wäre
          davon ein Punkt übrig, und der Geist hätte keinen Blick mehr. */}
      <g transform="translate(18.8,10.36) scale(0.66)">
        <GeistTeile farbe={GEIST_FARBEN[0]!} />
      </g>
    </AppSymbol>
  );
}
