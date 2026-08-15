import type { GeistModus, Richtung } from './logik';
import { SPIELER_FARBE } from './farben';

const HAUT = '#fcd5b4';
const HAAR = '#78350f';
const HOSE = '#1d4ed8';

/**
 * Die Spielfigur: ein kleines Männchen, das vor den Geistern wegläuft.
 * Vorher war es ein Pfeil — verständlich, aber leblos.
 *
 * Bewusst kurze Beine und großer Kopf: Die Figur wird nur 18 Pixel groß
 * gezeigt, in echten Proportionen wäre davon nichts mehr zu erkennen. Alles
 * unter etwa drei Einheiten dieser 40er-Zeichenfläche verschwindet bei der
 * Größe, deshalb keine feineren Einzelheiten.
 *
 * Laufrichtung: nach links wird die Figur gespiegelt (Arme und Beine stehen
 * dafür im Schritt, sonst sähe man den Unterschied nicht), nach oben zeigt
 * sie den Rücken — also kein Gesicht.
 */
export function Spieler({ richtung }: { richtung: Richtung }) {
  const vonHinten = richtung === 'up';

  return (
    <svg
      viewBox="0 0 40 40"
      style={{ transform: richtung === 'left' ? 'scaleX(-1)' : undefined }}
    >
      {/* Beine im Schritt. */}
      <rect x="14" y="27" width="5.5" height="11" rx="2.75" fill={HOSE} transform="rotate(-14 16.75 27)" />
      <rect x="21" y="27" width="5.5" height="11" rx="2.75" fill={HOSE} transform="rotate(13 23.75 27)" />

      {/* Arme, ebenfalls versetzt. */}
      <rect x="8.5" y="18" width="4.5" height="10" rx="2.25" fill={HAUT} transform="rotate(24 10.75 18)" />
      <rect x="27" y="18" width="4.5" height="10" rx="2.25" fill={HAUT} transform="rotate(-30 29.25 18)" />

      {/* Rumpf. */}
      <rect x="11.5" y="17" width="17" height="13" rx="5.5" fill={SPIELER_FARBE} />

      {/* Kopf mit Haarkappe — die Kappe zeigt auch von hinten, wo oben ist. */}
      <circle cx="20" cy="10" r="7.8" fill={HAUT} />
      <path d="M12.4 8.2 A7.8 7.8 0 0 1 27.6 8.2 Q20 12 12.4 8.2 Z" fill={HAAR} />

      {!vonHinten && (
        <>
          <circle cx="17" cy="11.5" r="1.6" fill="#1e293b" />
          <circle cx="23" cy="11.5" r="1.6" fill="#1e293b" />
        </>
      )}
    </svg>
  );
}

/**
 * Ein Geist — rundes Dach, gewellter Saum, eigene Wellenzahl und
 * Proportionen. Im Angst-Modus dunkler ohne Augen, blinkt kurz vor Ende.
 * Im Augen-Modus nur die Augen, kein Körper.
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
      <path
        d="M4,34 L4,17 Q4,4 20,4 Q36,4 36,17 L36,34 L30,29 L24,34 L20,29 L16,34 L10,29 Z"
        fill={koerperfarbe}
      />
      {modus !== 'angst' && <Augen />}
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
