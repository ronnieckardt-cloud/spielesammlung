import { AppSymbol, GlanzBlock } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Ausschnitt des Stapels mit einer Reihe, die gerade
 * aufblitzt und verschwindet. Aufbau siehe `core/AppSymbol.tsx`.
 */

const BLOCK = 10;
/** Spalten von links nach rechts. */
const SPALTEN = [4, 15, 26, 37, 48];

/** Der Stapel: zwei lockere Zeilen und darunter die volle, blitzende Reihe. */
const STAPEL: readonly { x: number; y: number; farbe: string }[] = [
  { x: SPALTEN[1]!, y: 7, farbe: '#22d3ee' },
  { x: SPALTEN[2]!, y: 7, farbe: '#22d3ee' },
  { x: SPALTEN[0]!, y: 18, farbe: '#a855f7' },
  { x: SPALTEN[1]!, y: 18, farbe: '#4ade80' },
  { x: SPALTEN[3]!, y: 18, farbe: '#fbbf24' },
  { x: SPALTEN[4]!, y: 18, farbe: '#fbbf24' },
];

/** Farben der vollen Reihe, die gleich verschwindet. */
const VOLLE_REIHE: readonly string[] = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa'];
const REIHE_Y = 29;

export function ReihenfallIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="linefall"
      verlauf={['#4338ca', '#4c1d95', '#1e1b4b']}
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
        <GlanzBlock key={`${b.x},${b.y}`} x={b.x} y={b.y} groesse={BLOCK} farbe={b.farbe} rundung={2.5} />
      ))}

      {VOLLE_REIHE.map((farbe, i) => (
        <GlanzBlock
          key={`reihe-${i}`}
          x={SPALTEN[i]!}
          y={REIHE_Y}
          groesse={BLOCK}
          farbe={farbe}
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
