import type { CSSProperties } from 'react';

/**
 * Die Kombo-Anzeige: ein pochendes Herz, davor die Zahl.
 *
 * Wunsch war, dass eine Serie sich nicht nur als Zahl bemerkbar macht,
 * sondern als etwas, das lebt: „dass dann son Herz, was pocht, so etwas
 * größer". Genau das macht es — und es **wächst mit der Serie**, damit man
 * am Rand des Blickfelds merkt, dass gerade etwas läuft, ohne die Zahl
 * lesen zu müssen.
 *
 * Von Block Burst und Line Fall gemeinsam benutzt. Bewusst ein eigener
 * Baustein und keine Änderung an einem bestehenden — die vorhandenen
 * Bausteine in `core/` bleiben unberührt.
 *
 * Der Schlag ist ein echter Doppelschlag (laut-leise, dann Pause), nicht
 * ein gleichmäßiges Auf und Ab. Erst dadurch liest es sich als Herzschlag
 * und nicht als zappelndes Symbol. Rund 0,9 Schläge je Sekunde — deutlich
 * unter der Grenze, ab der Blinken unangenehm wird, und es ist eine kleine
 * Fläche, keine ganzflächige Helligkeitsänderung.
 */

/** Ab hier gilt es als Serie — ein einzelner Treffer ist noch keine. */
export const KOMBO_AB = 2;

/** Grundgröße des Herzens und Zuwachs je Stufe, beides in Pixeln. */
const GRUND_PX = 44;
const ZUWACHS_PX = 7;
/** Deckel, sonst deckt das Herz bei einer langen Serie das halbe Feld zu. */
const MAX_PX = 86;

export function Komboherz({
  kombo,
  ruhig,
  beschriftung = 'Kombo',
  className = '',
}: {
  kombo: number;
  ruhig: boolean;
  /** Wort vor der Zahl — Line Fall nennt es „Vierfach", nicht „Kombo". */
  beschriftung?: string;
  /** Zum Platzieren. Beide Spiele hängen das Herz **über** das Feld statt
   *  in die Kopfzeile: In Block Burst und Line Fall ist der Platz nach oben
   *  knapp, und 86 Pixel feste Höhe hätten auf einem kleinen Handy genau
   *  das Scrollen zurückgebracht, das wir mühsam abgestellt haben. */
  className?: string;
}) {
  const sichtbar = kombo >= KOMBO_AB;
  // Nach unten abfangen: Ohne die Klammer wäre das Herz bei Kombo 0 kleiner
  // als seine Grundgröße und spränge beim Einblenden.
  const stufen = Math.max(0, kombo - KOMBO_AB);
  const groesse = Math.min(MAX_PX, GRUND_PX + stufen * ZUWACHS_PX);

  return (
    <div
      // Immer im Baum lassen und nur ausblenden, damit nichts springt,
      // sobald eine Serie anfängt oder abreißt.
      className={`pointer-events-none grid place-items-center transition-opacity duration-200 ${
        sichtbar ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{ height: MAX_PX, width: MAX_PX }}
      aria-hidden={!sichtbar}
    >
      <svg
        viewBox="0 0 100 100"
        width={groesse}
        height={groesse}
        aria-hidden="true"
        // Ohne Serie nicht pochen lassen — ein unsichtbares Herz, das im
        // Hintergrund weiterschlägt, kostet nur Rechenzeit.
        className={sichtbar && !ruhig ? 'herz-pocht' : undefined}
        style={{ transition: 'width 0.2s ease-out, height 0.2s ease-out' }}
      >
        <path
          d="M50 92 C6 62 4 34 24 21 C37 13 50 21 50 34 C50 21 63 13 76 21 C96 34 94 62 50 92 Z"
          fill="#f43f5e"
          stroke="#7f1d3a"
          strokeWidth="4"
          strokeLinejoin="round"
          paintOrder="stroke"
        />
        {/* Glanzpunkt oben links — macht aus der Fläche eine Form. */}
        <ellipse cx="34" cy="34" rx="9" ry="6" fill="#ffffff" opacity="0.4" transform="rotate(-30 34 34)" />
      </svg>

      <span
        // Der Schlüssel lässt die Zahl bei jeder Stufe kurz aufploppen.
        key={kombo}
        className="punkte-bumsen absolute text-lg font-black text-white"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' } as CSSProperties}
      >
        ×{Math.max(KOMBO_AB, kombo)}
      </span>

      <span className="sr-only" aria-live="polite">
        {sichtbar ? `${beschriftung} mal ${kombo}` : ''}
      </span>
    </div>
  );
}
