import { AppSymbol } from '../../core/AppSymbol';
import { DUNKLE, HELLE } from './farben';

/**
 * App-Symbol: der Augenblick, in dem gegossen wird. Aufbau siehe
 * `core/AppSymbol.tsx`.
 *
 * Drei Dinge stecken darin, die alle drei aus dem Spiel selbst kommen:
 *
 * 1. **Die Röhrchen sind oben offen.** Die erste Fassung zeichnete
 *    geschlossene Kapseln — Rückmeldung: „da könnte man ja gar nicht
 *    umfüllen, das macht keinen Sinn."
 * 2. **Es gießt wirklich.** Vorher standen drei Röhrchen unbewegt
 *    nebeneinander, obwohl der Guss der ganze Ablauf des Spiels ist
 *    (geometrie.ts: anheben, hinfliegen, kippen, gießen …). Jetzt schwebt
 *    das rechte gekippt über dem Ziel und ein Strahl läuft hinein — und
 *    zwar Hellgelb auf Hellgelb, denn genau das ist die Spielregel:
 *    gegossen werden darf nur auf dieselbe Farbe.
 * 3. **Die Farben kommen aus `farben.ts`**, nicht aus eigenen Werten. Je
 *    Röhrchen zwei helle und eine dunkle Schicht — dieselbe Hell/Dunkel-
 *    Teilung, die im Spiel für Kontrast sorgt. Vier eigene Mitteltöne
 *    sahen genau so flau aus, wie die Teilung es verhindern soll.
 */

const [hellgelb, hellblau, hellgruen, hellrosa] = HELLE.map((f) => f.hex);
const [dunkellila, dunkelrot, dunkelblau] = DUNKLE.map((f) => f.hex);

type Roehre = {
  /** Je Symbol eindeutig — daraus wird die id des Ausschnitts. */
  id: string;
  /** Obere linke Ecke der Öffnung, vor dem Kippen. */
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  /**
   * Kippwinkel um die Ausgusskante (die linke obere Ecke), in Grad.
   * Ohne Winkel steht das Röhrchen und füllt sich von unten; mit Winkel
   * hängt der Inhalt an der Öffnung, so wie beim Gießen im Spiel.
   */
  drehung?: number;
  /** Aufrecht von unten nach oben, gekippt von der Öffnung aus. */
  schichten: readonly string[];
};

/** Vier Schichten passen in ein Röhrchen — dieselbe Kapazität wie im Spiel. */
const KAPAZITAET = 4;

/** Umriss: unten rund wie ein Reagenzglas, oben offen (keine Linie darüber). */
function umriss(r: Roehre): string {
  const radius = r.breite / 2;
  return (
    `M0 0 L0 ${r.hoehe - radius} ` +
    `A${radius} ${radius} 0 0 0 ${r.breite} ${r.hoehe - radius} ` +
    `L${r.breite} 0`
  );
}

function RoehrchenBild({ r }: { r: Roehre }) {
  const radius = r.breite / 2;
  const schichthoehe = r.hoehe / KAPAZITAET;
  const gekippt = r.drehung !== undefined;

  return (
    <g transform={`translate(${r.x} ${r.y})${gekippt ? ` rotate(${r.drehung})` : ''}`}>
      <defs>
        {/* Der Ausschnitt ist in den Koordinaten *dieses* Röhrchens
            beschrieben und wird von innerhalb derselben Gruppe benutzt —
            das Kippen gilt damit für Glas und Inhalt gemeinsam. */}
        <clipPath id={`colorpour-glas-${r.id}`}>
          <path d={`${umriss(r)} Z`} />
        </clipPath>
      </defs>

      <g clipPath={`url(#colorpour-glas-${r.id})`}>
        {/* Glasinneres, leicht dunkel, damit helle Schichten sich abheben. */}
        <rect x={0} y={0} width={r.breite} height={r.hoehe} fill="#0b1020" opacity="0.34" />
        {r.schichten.map((farbe, i) => (
          <rect
            key={`${r.id}-${i}`}
            x={0}
            y={gekippt ? i * schichthoehe : r.hoehe - (i + 1) * schichthoehe}
            width={r.breite}
            height={schichthoehe}
            fill={farbe}
          />
        ))}
      </g>

      {/* Glaswand — oben bewusst offen. */}
      <path d={umriss(r)} fill="none" stroke="#ffffff" strokeWidth="1.7" opacity="0.9" />
      {/* Die Öffnung: ein Ring, dessen untere Hälfte ins Innere schaut. */}
      <ellipse cx={radius} cy={0} rx={radius} ry="2.1" fill="#0b1020" opacity="0.45" />
      <ellipse
        cx={radius}
        cy={0}
        rx={radius}
        ry="2.1"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        opacity="0.95"
      />
      {/* Glanzstreifen auf der Wand. */}
      <rect
        x={2.4}
        y={4}
        width="2"
        height={r.hoehe - 11}
        rx="1"
        fill="#ffffff"
        opacity="0.35"
      />
    </g>
  );
}

/**
 * Zwei stehende Röhrchen unten links, das gießende oben rechts — die
 * Schräge hält den Einblick über dem Schriftband (y = 44) und lässt das
 * Bild nach Bewegung aussehen statt nach einer Reihe Fläschchen.
 */
const STEHEND: readonly Roehre[] = [
  // Hellgrün zuoberst und nicht Hellblau: Die obere Schicht steht vor dem
  // hellblauen Teil des Verlaufs, dort ginge Hellblau fast unter.
  { id: 'links', x: 11, y: 21, breite: 13, hoehe: 20, schichten: [hellblau, dunkellila, hellgruen] },
  // Oben Hellgelb: Dort kommt der Strahl an, und gegossen werden darf nur
  // auf dieselbe Farbe.
  { id: 'ziel', x: 28, y: 21, breite: 13, hoehe: 20, schichten: [dunkelblau, hellgelb] },
];

const GIESSENDES: Roehre = {
  id: 'guss',
  x: 35,
  y: 19,
  breite: 11,
  hoehe: 18,
  // Etwa 115 Grad: Die Öffnung zeigt klar nach unten, das Röhrchen bleibt
  // aber vollständig im Bild (im Spiel sind es 128).
  drehung: -115,
  schichten: [hellgelb, hellrosa, dunkelrot],
};

export function FarbsortiererIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="colorpour"
      verlauf={['#22d3ee', '#0ea5e9', '#a855f7']}
      schriftzug="COLOR POUR"
      className={className}
    >
      {STEHEND.map((r) => (
        <RoehrchenBild key={r.id} r={r} />
      ))}

      {/* Der Strahl: von der Ausgusskante des gekippten Röhrchens bis auf
          die Oberfläche im Ziel (zwei Schichten hoch, also y = 31). Vor
          dem gießenden Röhrchen gezeichnet, damit er unter dessen Öffnung
          hervorzukommen scheint. */}
      <path
        d="M33.5 18.6 Q33 25 33.2 31 L36 31 Q36.2 25 36.3 18.6 Z"
        fill={hellgelb}
      />
      <ellipse cx="34.6" cy="31" rx="4.6" ry="1.2" fill="#ffffff" opacity="0.35" />

      <RoehrchenBild r={GIESSENDES} />
    </AppSymbol>
  );
}
