import type { GeistModus, Richtung } from './logik';
import { SPIELER_FARBE } from './farben';

const WINKEL: Record<Richtung, number> = { right: 0, down: 90, left: 180, up: 270 };

/**
 * Eigene Spielfigur — ein Pfeil/Chevron statt einer Kreisfigur, dreht sich
 * sichtbar in die Laufrichtung. Bewusst nicht wie das Original.
 */
export function Spieler({ richtung }: { richtung: Richtung }) {
  return (
    <svg viewBox="0 0 40 40" style={{ transform: `rotate(${WINKEL[richtung]}deg)` }}>
      <path d="M8,7 L33,20 L8,33 Q17,20 8,7 Z" fill={SPIELER_FARBE} />
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
