import { AppSymbol } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Gehirn mit Blitz, darunter die drei Übungsarten als kleine
 * Marken. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Drei Dinge waren an der ersten Fassung falsch, alle drei sind der Grund
 * für den Umbau:
 *
 * 1. **Der Grund ist jetzt Indigo/Violett statt Bernstein.** Ein blassrosa
 *    Gehirn auf Bernstein kam auf rund 1,4:1 Kontrast — auf der 56 Pixel
 *    kleinen Kachel war das ein heller Fleck ohne Form. Dasselbe Rosa
 *    trägt auf dem dunklen Indigo 4,46:1 (gegen #4f46e5) bis 7,77:1
 *    (gegen #4c1d95) und liest sich sofort.
 * 2. **Der Umriss ist gelappt, nicht oval.** Eine einzelne Ellipse las sich
 *    als rosa Ei. Die Lappen entstehen aus sechs überlappenden Kreisen in
 *    derselben Füllfarbe — die ergeben von selbst eine saubere Wolkenkante,
 *    und ein von Hand gezogener Pfad wäre bei dieser Größe nicht genauer,
 *    aber deutlich schwerer zu ändern.
 * 3. **Die Formel „7 × 8 = ?" ist weg.** Als einziges der zwanzig Symbole
 *    trug dieses eine freistehende Textzeile direkt über dem Schriftband —
 *    das Bild zerfiel dadurch in Motiv, Formel und Name — und sie zeigte
 *    nur eine der drei Übungsarten. Die drei Marken unten zeigen jetzt
 *    alle drei, ohne ein einziges Zeichen Text.
 */

/** Die Farben der Merk-Folgen-Kacheln — die Marke soll dieses Spiel zeigen. */
const FOLGE_FARBEN = ['#3b82f6', '#22c55e', '#eab308'];

const GEHIRN = '#fecdd3';
const FURCHE = '#9f1239';

/** Die sechs Lappen des Umrisses: Mittelpunkt und Radius. */
const LAPPEN: readonly (readonly [number, number, number])[] = [
  [14, 12, 7],
  [22.5, 9.5, 7.5],
  [31, 12.5, 7],
  [13.5, 19, 7],
  [22.5, 20.5, 7.5],
  [31.5, 19, 7],
];

/** Balkenhöhen der Muster-Marke — eine wachsende Reihe. */
const REIHE_HOEHEN = [3.5, 5.5, 7.5];

export function GehirnjoggingIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="brainblitz"
            /*
       * **Gold statt Indigo/Violett.** War eines von sieben Symbolen im
       * selben Farbfeld — passend zur Idee „aufleuchtender Gedanke" statt
       * eines weiteren dunkelblauen Symbols.
       */
      verlauf={['#e7ea3e', '#aaac15', '#373710']}
      schriftzug="BRAIN BLITZ"
      className={className}
    >
      {/* Gehirn: sechs Kreise in einer Farbe ergeben den gelappten Umriss. */}
      {LAPPEN.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={GEHIRN} />
      ))}

      {/* Licht von oben links, wie überall im Projekt. */}
      <ellipse
        cx="16"
        cy="10"
        rx="6.5"
        ry="3.6"
        fill="#ffffff"
        opacity="0.4"
        transform="rotate(-24 16 10)"
      />

      {/* Mittelfurche und Windungen — erst sie machen aus der Wolke ein Gehirn. */}
      <g fill="none" stroke={FURCHE} strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
        <path d="M22.5 3.5 q2.5 4.5 -0.5 8 q-2.5 3.5 0.5 7 q2 3 0 5.5" />
        <path d="M11 12.5 q4 1 3 4" />
        <path d="M11.5 20.5 q4.5 0 4 3.5" />
        <path d="M34 12.5 q-4 1 -3 4" />
        <path d="M33.5 20.5 q-4.5 0 -4 3.5" />
      </g>

      {/* Blitz für das schnelle Denken — das Spiel heißt Brain Blitz. */}
      <path d="M49 6 L41.5 18 h4.8 l-2.5 9 L53 15.5 h-5 Z" fill="#38bdf8" />

      {/* Die drei Übungsarten als Marken: Rechnen, Farbfolge, Musterreihe.
          Sie sitzen zwischen y = 31 und y = 42, bleiben also über dem
          Schriftband (BAND_OBEN = 44). */}
      {[5, 24, 43].map((x) => (
        <rect key={x} x={x} y="31" width="16" height="11" rx="3.5" fill="#ffffff" opacity="0.16" />
      ))}

      {/* Kopfrechnen: ein Pluszeichen aus zwei Balken, kein Text. */}
      <rect x="8.6" y="35.5" width="8.8" height="2" rx="1" fill="#ffffff" />
      <rect x="12" y="32.1" width="2" height="8.8" rx="1" fill="#ffffff" />

      {/* Merk-Folgen: drei Kacheln in den Farben aus dem Spiel. */}
      {FOLGE_FARBEN.map((farbe, i) => (
        <rect key={farbe} x={24.5 + i * 5.5} y="34.5" width="4" height="4" rx="1" fill={farbe} />
      ))}

      {/* Muster erkennen: eine Reihe, die einer Regel folgt und wächst. */}
      {REIHE_HOEHEN.map((hoehe, i) => (
        <rect
          key={hoehe}
          x={45 + i * 4.5}
          y={40 - hoehe}
          width="3"
          height={hoehe}
          rx="1"
          fill="#ffffff"
        />
      ))}
    </AppSymbol>
  );
}
