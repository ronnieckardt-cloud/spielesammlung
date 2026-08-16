import { AppSymbol } from '../../core/AppSymbol';
import { FARBEN } from './farben';

/**
 * App-Symbol: ein **gelöstes** Brett — drei Wege, die sich umeinander
 * herumwinden, kein einziges freies Feld. Genau das ist die Aufgabe des
 * Spiels; ein Symbol mit sich kreuzenden Wegen würde zeigen, was hier
 * verboten ist. Aufbau siehe `core/AppSymbol.tsx`.
 */

/** Kantenlänge eines Feldes — dieselbe wie im Spiel (`FELD` in `FlowLink`). */
const FELD = 10;
/** Linke obere Ecke des Bretts. 5×3 Felder, damit mittig über dem Band. */
const RAND_X = 7;
const RAND_Y = 6;

/** Feldkoordinate → Mittelpunkt im Zeichensystem des Symbols. */
const mx = (spalte: number) => RAND_X + spalte * FELD + FELD / 2;
const my = (zeile: number) => RAND_Y + zeile * FELD + FELD / 2;

type Wegbild = { farbe: number; d: string; a: [number, number]; b: [number, number] };

/** Ein Weg samt seinen beiden Endpunkten. */
function Weg({ farbe, d, a, b }: Wegbild) {
  const f = FARBEN[farbe]!;
  return (
    <g>
      {/* Dieselben Maße wie im Spiel: Strich 0,52 und Punkt 0,36 der
          Feldbreite. So sieht das Symbol aus wie ein Ausschnitt des Bretts. */}
      <path
        d={d}
        fill="none"
        stroke={f.hex}
        strokeWidth={FELD * 0.52}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={a[0]} cy={a[1]} r={FELD * 0.36} fill={f.hex} stroke={f.rand} strokeWidth={0.8} />
      <circle cx={b[0]} cy={b[1]} r={FELD * 0.36} fill={f.hex} stroke={f.rand} strokeWidth={0.8} />
    </g>
  );
}

/**
 * Die drei Wege, Feld für Feld nachgerechnet (1 = Rot, 2 = Gelb, 3 = Grün):
 *
 * ```
 *   1 1 2 2 3
 *   1 1 2 3 3
 *   1 2 2 3 3
 * ```
 *
 * Jedes der 15 Felder gehört genau einem Weg: Das Brett ist voll, und kein
 * Weg berührt einen fremden Punkt oder Strich. Einzelne leere Felder sähen
 * bei großer Anzeige wie Löcher aus (siehe CLAUDE.md), und eine Kreuzung
 * würde ausgerechnet das zeigen, was das Spiel verbietet.
 */
const WEGE: readonly Wegbild[] = [
  // Rot: links hoch, nach rechts, wieder herunter.
  { farbe: 0, d: `M${mx(0)},${my(2)} V${my(0)} H${mx(1)} V${my(1)}`, a: [mx(0), my(2)], b: [mx(1), my(1)] },
  // Gelb: unten nach rechts, ganz hoch, oben nach rechts.
  { farbe: 1, d: `M${mx(1)},${my(2)} H${mx(2)} V${my(0)} H${mx(3)}`, a: [mx(1), my(2)], b: [mx(3), my(0)] },
  // Grün: herunter, nach rechts, ganz hoch.
  { farbe: 2, d: `M${mx(3)},${my(1)} V${my(2)} H${mx(4)} V${my(0)}`, a: [mx(3), my(1)], b: [mx(4), my(0)] },
];

export function VerbindenIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="flowlink"
      verlauf={['#4c1d95', '#312e81', '#0f172a']}
      schriftzug="FLOW LINK"
      className={className}
    >
      {/* Das Raster als aufgehellte **Felder**, nicht als dünne Linien: Ein
          Strich von 0,6 Einheiten liegt bei 64 Pixeln Anzeige unter einem
          Pixel und verschwindet ganz. Block Burst und Line Fall lösen dieselbe
          Aufgabe genauso. Nebenbei liegen die Wege dadurch sichtbar in
          Feldmitten statt neben den Linien. */}
      {[0, 1, 2].map((zeile) =>
        [0, 1, 2, 3, 4].map((spalte) => (
          <rect
            key={`${spalte},${zeile}`}
            x={RAND_X + spalte * FELD + 0.5}
            y={RAND_Y + zeile * FELD + 0.5}
            width={FELD - 1}
            height={FELD - 1}
            rx="2"
            fill="#ffffff"
            opacity="0.1"
          />
        )),
      )}

      {WEGE.map((w) => (
        <Weg key={w.farbe} {...w} />
      ))}
    </AppSymbol>
  );
}
