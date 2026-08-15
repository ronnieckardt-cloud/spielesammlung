/**
 * Der Sternenschlucker — die Spielfigur von Star Dash.
 *
 * Ausdrücklich **kein** bekanntes Tier und keine Emoji-Figur: ein
 * erfundenes Wesen, dessen ganze Oberseite ein weit offenes Maul ist. Es
 * schluckt die Sterne von oben. Die Augen sitzen deshalb unter dem Maul,
 * am Bauch — das ist der Kniff, der es von allem Bekannten wegrückt.
 *
 * Vorgänger war eine gelbe Kreisfigur mit Kerbe; die sah zu sehr nach
 * einem bekannten Spielhallen-Klassiker aus.
 *
 * Gezeichnet im Koordinatensystem 0…100, ohne eigenes `<svg>` — so lässt
 * sie sich sowohl im Spiel (eigenes svg) als auch im App-Symbol (über
 * `<g transform>` verkleinert) verwenden, ohne sie zweimal zu zeichnen.
 */

export const KOERPER = '#fb7185';
export const KOERPER_DUNKEL = '#be123c';
export const SCHLUND = '#4c0519';

export function SternenschluckerTeile() {
  return (
    <>
      {/* Füße, zuerst — sie sollen hinter dem Körper liegen. */}
      <ellipse cx="33" cy="88" rx="9" ry="6" fill={KOERPER_DUNKEL} />
      <ellipse cx="67" cy="88" rx="9" ry="6" fill={KOERPER_DUNKEL} />

      {/* Seitenflossen statt Ohren — nichts Säugetierhaftes. */}
      <path d="M17 52 L4 46 L15 66 Z" fill={KOERPER_DUNKEL} />
      <path d="M83 52 L96 46 L85 66 Z" fill={KOERPER_DUNKEL} />

      {/* Körper: oben der Maulrand, unten rund auslaufend. */}
      <path d="M16 34 A34 11 0 0 1 84 34 L84 62 C84 88 16 88 16 62 Z" fill={KOERPER} />

      {/* Das offene Maul: der dunkle Schlund, darum der dicke Rand. */}
      <ellipse cx="50" cy="34" rx="34" ry="11" fill={SCHLUND} />
      <ellipse
        cx="50"
        cy="34"
        rx="34"
        ry="11"
        fill="none"
        stroke={KOERPER}
        strokeWidth="5"
      />
      {/* Zunge, tief im Schlund. */}
      <ellipse cx="50" cy="39" rx="15" ry="4" fill={KOERPER_DUNKEL} />

      {/* Augen am Bauch, leicht unterschiedlich groß — das gibt Charakter. */}
      <circle cx="35" cy="56" r="9" fill="#ffffff" />
      <circle cx="66" cy="57" r="7.5" fill="#ffffff" />
      <circle cx="37" cy="57" r="4.4" fill={SCHLUND} />
      <circle cx="67.5" cy="58" r="3.7" fill={SCHLUND} />
      <circle cx="34.5" cy="54" r="1.7" fill="#ffffff" />
      <circle cx="65.5" cy="55.5" r="1.4" fill="#ffffff" />

      {/* Glanz auf dem Bauch. */}
      <ellipse cx="27" cy="70" rx="7" ry="4.5" fill="#ffffff" opacity="0.25" />
    </>
  );
}

/** Die Figur als eigenständiges Bild — so benutzt sie das Spiel. */
export function Sternenschlucker({ groesse = 46 }: { groesse?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={groesse} height={groesse} className="drop-shadow-lg">
      <SternenschluckerTeile />
    </svg>
  );
}
