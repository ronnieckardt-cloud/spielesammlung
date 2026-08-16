import { AppSymbol, GlanzBlock } from '../../core/AppSymbol';
import { FARB_INDEX } from './logik';
import { reihenfallFarbe } from './farben';

/**
 * App-Symbol: ein Ausschnitt des Stapels mit einer Reihe, die gerade
 * aufblitzt und verschwindet. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * **Alle Farben kommen aus `farben.ts`**, so wie Merge Up seine Kachelfarben
 * aus dem eigenen Farbsatz holt. Vorher standen hier eigene Werte, und die
 * volle Reihe war ausgerechnet ein Rot-Orange-Gelb-Grün-Blau-Regenbogen —
 * also genau die klassische Zuordnung, von der sich das Spiel bewusst gelöst
 * hat. Das Symbol zeigt jetzt wirklich die Steine, die im Spiel fallen, und
 * ändert sich von allein mit, wenn der Farbsatz sich ändert.
 *
 * Nur der S-Stein (Indigo) bleibt außen vor: Er liegt genau auf dem
 * indigo-violetten Verlauf des Symbols und wäre darauf kaum zu sehen.
 */

const BLOCK = 10;
/** Spalten von links nach rechts. */
const SPALTEN = [4, 15, 26, 37, 48];

/** Der Stapel: zwei lockere Zeilen und darunter die volle, blitzende Reihe. */
const STAPEL: readonly { x: number; y: number; teil: keyof typeof FARB_INDEX }[] = [
  { x: SPALTEN[1]!, y: 7, teil: 'L' },
  { x: SPALTEN[2]!, y: 7, teil: 'L' },
  { x: SPALTEN[0]!, y: 18, teil: 'J' },
  { x: SPALTEN[1]!, y: 18, teil: 'Z' },
  { x: SPALTEN[3]!, y: 18, teil: 'T' },
  { x: SPALTEN[4]!, y: 18, teil: 'T' },
];

/** Die volle Reihe, die gleich verschwindet — fünf verschiedene Teilfarben. */
const VOLLE_REIHE: readonly (keyof typeof FARB_INDEX)[] = ['I', 'O', 'T', 'Z', 'L'];
const REIHE_Y = 29;

export function ReihenfallIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="linefall"
            /*
       * **Warmes Rot-Orange statt Indigo/Violett.** War eines von sieben
       * Symbolen im selben Farbfeld — bei 64 Pixeln kaum von Ghost Chase
       * oder Ring Rise zu unterscheiden. Die Spielsteine selbst behalten
       * ihre eigene Zuordnung aus `farben.ts`, nur der Kachel-Hintergrund
       * ändert sich.
       */
      verlauf={['#ea663e', '#ac3915', '#371910']}
      schriftzug="LINE FALL"
      className={className}
    >
      {/* Angedeutetes Spielfeldraster im Hintergrund. */}
      {[7, 18, 29].map((y) =>
        SPALTEN.map((x) => (
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width={BLOCK}
            height={BLOCK}
            rx="2.5"
            fill="#0b1020"
            opacity="0.2"
          />
        )),
      )}

      {STAPEL.map((b) => (
        <GlanzBlock
          key={`${b.x},${b.y}`}
          x={b.x}
          y={b.y}
          groesse={BLOCK}
          farbe={reihenfallFarbe(FARB_INDEX[b.teil])}
          rundung={2.5}
        />
      ))}

      {VOLLE_REIHE.map((teil, i) => (
        <GlanzBlock
          key={`reihe-${i}`}
          x={SPALTEN[i]!}
          y={REIHE_Y}
          groesse={BLOCK}
          farbe={reihenfallFarbe(FARB_INDEX[teil])}
          rundung={2.5}
        />
      ))}

      {/* Die volle Reihe blitzt auf: nur ein leichter Schleier plus heller
          Rand, damit die Farben darunter erkennbar bleiben. */}
      <rect
        x="2"
        y={REIHE_Y - 1.5}
        width="60"
        height={BLOCK + 3}
        rx="3"
        fill="#ffffff"
        opacity="0.22"
      />
      <rect
        x="2"
        y={REIHE_Y - 1.5}
        width="60"
        height={BLOCK + 3}
        rx="3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.4"
        opacity="0.9"
      />
    </AppSymbol>
  );
}
