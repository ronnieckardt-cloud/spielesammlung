import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: eine tippende Hand über den vier Farbstufen des Spiels.
 * Aufbau siehe `core/AppSymbol.tsx`.
 */

/**
 * Die id des Regenbogen-Verlaufs.
 *
 * Fest und spielspezifisch, aus demselben Grund wie bei den ids in
 * `AppSymbol`: Das Symbol steht auf einer Seite mehrfach (Menü und
 * Bestenliste), und nur mit derselben id sieht es überall gleich aus.
 */
const REGENBOGEN_ID = 'taprush-regenbogen';

/**
 * Die vier Stufen, von langsam nach Regenbogen.
 *
 * Grün und Hellblau sind genau die hellen Enden der Verläufe aus
 * `TapRush.tsx`. Zwei Abweichungen, beide mit Grund:
 *
 * - Das Rot ist heller als im Spiel (`#fca5a5` statt `#ef4444`). Auf dem
 *   dunkelroten Grund des Symbols kam der Balken sonst auf gerade 2,4:1 und
 *   war auf einer 64-Pixel-Kachel schlicht nicht zu sehen.
 * - Die höchste Stufe ist **kein** einzelnes Pink, sondern der Regenbogen
 *   selbst — er ist das Aushängeschild des Spiels, und ein Symbol soll das
 *   Spiel zeigen. Ein Einzelton hier war der einzige Balken, der nicht zu
 *   dem passte, was man im Spiel sieht.
 */
const STUFEN = ['#fca5a5', '#4ade80', '#7dd3fc', `url(#${REGENBOGEN_ID})`];

export function TempoIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="taprush"
      verlauf={['#f43f5e', '#9f1239', '#1e1b4b']}
      schriftzug="TAP RUSH"
      className={className}
    >
      <defs>
        {/* Dieselbe Farbfolge wie `.tempo-regenbogen` in `index.css`, aber
            **längs** des Balkens statt quer: Quer über 4,4 Einheiten wären
            sieben Farben ein grauer Matsch, längs über 21 Einheiten bleibt
            jede einzeln erkennbar. Unten Rot wie bei Stufe eins, nach oben
            durch alle Farben — dieselbe Reise wie im Spiel. */}
        <linearGradient id={REGENBOGEN_ID} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ef4444" />
          <stop offset="0.17" stopColor="#f59e0b" />
          <stop offset="0.33" stopColor="#facc15" />
          <stop offset="0.5" stopColor="#22c55e" />
          <stop offset="0.67" stopColor="#06b6d4" />
          <stop offset="0.83" stopColor="#6366f1" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>

      {/* Die vier Stufen als Balken, von unten nach oben wachsend — genau
          die Reihenfolge, die man im Spiel durchläuft. Breiter als in der
          ersten Fassung (4,4 statt 3,4) und ohne Abschwächung: Bei 64 Pixel
          Kachelgröße ist ein Balken sonst drei Bildpunkte schmal. */}
      {STUFEN.map((farbe, i) => (
        <rect
          key={farbe}
          x={6.4 + i * 5.4}
          y={34 - i * 5}
          width={4.4}
          height={6 + i * 5}
          rx={2.2}
          fill={farbe}
        />
      ))}

      {/* Zwei Ringe als Anschlag — das Zeichen für „hier wurde getippt".
          Sie liegen **vor** der Hand in der Zeichenreihenfolge, damit der
          Finger anschließend darüber liegt: So kommt er von vorn auf den
          Ring zu, statt vom blassen Außenring durchgestrichen zu werden. */}
      <circle cx={40} cy={31} r={10.5} fill="none" stroke="#ffffff" strokeWidth={1.2} opacity={0.4} />
      <circle cx={40} cy={31} r={6} fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.85} />

      {/* Die tippende Hand: eine Faust mit ausgestrecktem Zeigefinger.
          Die Aufteilung ist hier das Ganze — der **breite** Teil ist die
          Hand und gehört nach oben, der **schmale** Finger zeigt nach unten
          auf den Ring. In der ersten Fassung war es andersherum, und das
          Bild las sich als Wattestäbchen oder Rakete.

          Die Hand wird zuletzt gezeichnet, damit der Finger sichtbar unter
          ihr hervorkommt statt oben mit einer eigenen Kuppe abzuschließen —
          zwei aneinandergesetzte Kapseln sahen aus wie ein Stecker. Der
          angelegte Daumen links bringt die Asymmetrie, an der man eine Hand
          überhaupt erst als Hand liest. */}
      <g>
        <rect x={30.6} y={7.5} width={4.8} height={8} rx={2.4} fill="#e0a273" />
        {/* Die Fingerkuppe endet bei y = 26,4 und liegt damit knapp auf dem
            inneren Ring (Oberkante 25): Der Finger berührt ihn sichtbar,
            statt darüber zu schweben. */}
        <rect x={36.9} y={9} width={6.2} height={17.4} rx={3.1} fill="#fcd5b0" />
        <rect x={32.6} y={3.5} width={14.8} height={11.5} rx={4.6} fill="#f3b98a" />
        {/* Licht von oben links — dieselbe Lichtrichtung wie überall im
            Projekt. Als Ellipse, nicht als Streifen: Der Streifen sah aus
            wie ein Pflaster quer über den Handrücken. */}
        <ellipse cx={38.4} cy={7.2} rx={4.2} ry={2} fill="#ffffff" opacity={0.22} />
      </g>
    </AppSymbol>
  );
}
