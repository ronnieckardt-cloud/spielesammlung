import type { GeistModus, Richtung } from './logik';
import { SPIELER_FARBE, SPIELER_HOSE } from './farben';

const HAUT = '#fcd5b4';
/** Hell genug, um auf fast schwarzem Grund noch als Haar zu lesen — die
 *  erste Fassung war `#78350f` und verschwand komplett. */
const HAAR = '#c2854a';
/** Dunkler Saum um jede Fläche. Nicht reines Schwarz: Das würde bei einer
 *  17 Pixel großen Figur die Farbe darunter auffressen. */
const SAUM = '#0b1020';

/** Saum um eine Fläche legen, ohne sie schmaler zu machen. */
const UMRISS = { stroke: SAUM, paintOrder: 'stroke' } as const;

/**
 * Der Umriss des Geists — einmal als Fläche, einmal für die Wölbung.
 * Rundes Dach, gewellter Saum, eigene Wellenzahl und Proportionen.
 */
const GEIST_PFAD =
  'M4,34 L4,17 Q4,4 20,4 Q36,4 36,17 L36,34 L30,29 L24,34 L20,29 L16,34 L10,29 Z';

/**
 * Verlaufs-ids. Fest und nicht zufällig: Auf dem Spielfeld stehen vier
 * Geister gleichzeitig, alle vier definieren denselben Verlauf. Es ist
 * also gleichgültig, welche Definition gewinnt — dieselbe Überlegung wie
 * in `core/AppSymbol.tsx`.
 */
const HOF_ID = 'geisterjagd-spielerhof';
const WOELBUNG_ID = 'geisterjagd-geistwoelbung';

/**
 * Die Spielfigur: ein kleines Männchen, das vor den Geistern wegläuft.
 * Vorher war es ein Pfeil — verständlich, aber leblos.
 *
 * Bewusst kurze Beine und großer Kopf: Die Figur wird nur etwa 17 Pixel
 * groß gezeigt, in echten Proportionen wäre davon nichts mehr zu erkennen.
 * Alles unter etwa drei Einheiten dieser 40er-Zeichenfläche verschwindet
 * bei der Größe, deshalb keine feineren Einzelheiten.
 *
 * Rückmeldung war „bei mir ist da immer noch so klein" und der Wunsch nach
 * mehr Realismus. Bei 17 Pixeln würde mehr Realismus die Figur allerdings
 * **schlechter** erkennbar machen, nicht besser — ankommen tun nur drei
 * Dinge, und genau die sind hier gedreht worden:
 *
 * 1. **Breite.** Die Figur nutzte vorher nur 57 % der Kachelbreite. Jetzt
 *    füllt sie sie fast aus. In der Höhe geht bewusst nichts mehr: Die
 *    Gänge sind eine Kachel breit, eine höhere Figur ragte in die Wand
 *    und man sähe an einer Kreuzung nicht mehr, in welchem Gang sie steht.
 * 2. **Kontrast.** Dunkelblaue Hose und dunkelbraune Haare auf fast
 *    schwarzem Grund waren schlicht unsichtbar; übrig blieb ein Klecks
 *    mit einem hellen Punkt darüber. Jetzt hellere Farben, ein dunkler
 *    Saum um jede Fläche und ein weicher Lichthof dahinter.
 * 3. **Bewegung.** Siehe `laeuft` — die schwingenden Glieder sagen dem
 *    Auge mehr über die Figur als jede zusätzliche Einzelheit.
 *
 * Laufrichtung: nach links wird die Figur gespiegelt (Arme und Beine
 * stehen dafür im Schritt, sonst sähe man den Unterschied nicht), nach
 * oben zeigt sie den Rücken — also kein Gesicht.
 */
export function Spieler({ richtung, laeuft }: { richtung: Richtung; laeuft: boolean }) {
  const vonHinten = richtung === 'up';
  // Zwei gegenläufige Klassen: Das linke Bein schwingt mit dem rechten Arm,
  // wie beim echten Gehen. Steht die Figur, bekommt sie gar keine Klasse —
  // ein stehendes Männchen soll nicht auf der Stelle strampeln.
  const vor = laeuft ? 'glied-vor' : undefined;
  const zurueck = laeuft ? 'glied-zurueck' : undefined;

  return (
    <svg
      viewBox="0 0 40 40"
      style={{ transform: richtung === 'left' ? 'scaleX(-1)' : undefined }}
    >
      {/* Lichthof: findet die Figur im vollen Labyrinth auf einen Blick
          wieder. Muss ein Verlauf sein — als schlichter Kreis mit 13 %
          Deckkraft wurde daraus auf dem fast schwarzen Grund eine dunkle
          Scheibe mit harter Kante hinter der Figur, also genau das
          Gegenteil von „leuchtet". */}
      <defs>
        <radialGradient id={HOF_ID}>
          <stop offset="0.3" stopColor={SPIELER_FARBE} stopOpacity="0.3" />
          <stop offset="1" stopColor={SPIELER_FARBE} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="21" r="19" fill={`url(#${HOF_ID})`} />

      <g className={laeuft ? 'laeuft-huepf' : undefined}>
        {/* Beine. Der Drehpunkt sitzt oben mittig (die Hüfte), das steht
            in der Klasse selbst — hier nur die Form. */}
        <rect className={vor} x="12" y="28" width="7" height="9" rx="3.5" fill={SPIELER_HOSE} strokeWidth="1.6" {...UMRISS} />
        <rect className={zurueck} x="21" y="28" width="7" height="9" rx="3.5" fill={SPIELER_HOSE} strokeWidth="1.6" {...UMRISS} />

        {/* Arme, gegenläufig zu den Beinen auf derselben Seite. */}
        <rect className={zurueck} x="5.5" y="18" width="5.5" height="10" rx="2.75" fill={HAUT} strokeWidth="1.4" {...UMRISS} />
        <rect className={vor} x="29" y="18" width="5.5" height="10" rx="2.75" fill={HAUT} strokeWidth="1.4" {...UMRISS} />

        {/* Rumpf mit Lichtkante oben und Schatten unten — dieselbe Machart
            wie bei den Spielsteinen in Line Fall und Block Burst. */}
        <rect x="9" y="17" width="22" height="14" rx="6" fill={SPIELER_FARBE} strokeWidth="1.6" {...UMRISS} />
        <rect x="11" y="18.5" width="18" height="4" rx="2" fill="#ffffff" opacity="0.32" />
        <rect x="11" y="26.5" width="18" height="3" rx="1.5" fill="#000000" opacity="0.22" />

        {/* Kopf mit Haarkappe — die Kappe zeigt auch von hinten, wo oben ist. */}
        <circle cx="20" cy="9.5" r="8.4" fill={HAUT} strokeWidth="1.6" {...UMRISS} />
        <path d="M12 7.6 A8.4 8.4 0 0 1 28 7.6 Q20 11.8 12 7.6 Z" fill={HAAR} />

        {!vonHinten && (
          <>
            <circle cx="16.8" cy="11" r="1.8" fill="#1e293b" />
            <circle cx="23.2" cy="11" r="1.8" fill="#1e293b" />
          </>
        )}
      </g>
    </svg>
  );
}

/**
 * Ein Geist — rundes Dach, gewellter Saum, eigene Wellenzahl und
 * Proportionen. Im Angst-Modus dunkler ohne Augen, blinkt kurz vor Ende.
 * Im Augen-Modus nur die Augen, kein Körper.
 *
 * Die Farben kommen aus `farben.ts` und sind seit der Rückmeldung „mach den
 * Geist rot, dann fällt er besser auf" durchgehend warm — der blaue Spieler
 * ist damit die einzige kalte Farbe im Bild.
 */
export function Geist({
  modus,
  farbe,
  blinkt,
}: {
  modus: GeistModus;
  farbe: string;
  blinkt: boolean;
}) {
  if (modus === 'augen') {
    return (
      <svg viewBox="0 0 40 40">
        <Augen />
      </svg>
    );
  }

  const koerperfarbe = modus === 'angst' ? (blinkt ? '#e2e8f0' : '#475569') : farbe;

  return (
    <svg viewBox="0 0 40 40">
      {/* Licht oben, Schatten unten — als Verlauf über **derselben** Form,
          nicht als aufgelegter Balken. Der erste Versuch war ein waagerechter
          Strich mit wenig Deckkraft; der las sich als Gürtel quer über den
          Geist. Weil der Verlauf nur mit Weiß und Schwarz arbeitet, passt
          er zu allen vier Geisterfarben, ohne dass es vier Verläufe braucht. */}
      <defs>
        <linearGradient id={WOELBUNG_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <path
        d={GEIST_PFAD}
        fill={koerperfarbe}
        stroke={SAUM}
        strokeWidth="1.6"
        paintOrder="stroke"
      />
      {/* Im Angst-Modus bleibt der Geist flach und stumpf — genau das ist
          dort das Signal, dass er gerade fressbar ist. */}
      {modus !== 'angst' && (
        <>
          <path d={GEIST_PFAD} fill={`url(#${WOELBUNG_ID})`} />
          <Augen />
        </>
      )}
    </svg>
  );
}

function Augen() {
  return (
    <>
      <circle cx="14" cy="17" r="4.2" fill="white" />
      <circle cx="26" cy="17" r="4.2" fill="white" />
      <circle cx="14" cy="17" r="2" fill="#1e293b" />
      <circle cx="26" cy="17" r="2" fill="#1e293b" />
    </>
  );
}
