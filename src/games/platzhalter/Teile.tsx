/**
 * Die Dinge auf dem Brett von Star Dash — jedes eine eigene **Form**, nicht nur eine eigene Farbe.
 *
 * Das Spiel besteht daraus, auf einen Blick zu unterscheiden, was bremst (Fels), was kostet (Loch,
 * Komet) und was Punkte bringt (Stern, Goldstern). Bei Tempo und auf einem kleinen Bildschirm muss
 * die Silhouette allein das sagen; Farbe ist bei Rot/Grün-Schwäche kein verlässlicher Unterschied.
 *
 * Alle Zeichnungen füllen ihre Kachel (`size-full`) und kennen keine Größe, die Kachel gibt sie vor.
 */

export const STERN_FARBE = '#fde047';
export const STERN_RAND = '#a16207';
export const GOLD_FARBE = '#fbbf24';

const STERN_PFAD = 'M12 2l2.5 6.9H21l-5.6 4.4 2.1 7.1L12 16.2 6.5 20.4l2.1-7.1L3 8.9h6.5z';

/** Ein gewöhnlicher Stern: leuchtend gelb mit dunklerem Saum und einem Glanzpunkt. */
export function SternBild({ className = 'size-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={STERN_PFAD} fill={STERN_FARBE} stroke={STERN_RAND} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 5.2l1.1 3.1" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/**
 * Der Goldstern ist eine **Münze** mit Stern darin, kein größerer gelber Stern: Er zählt dreifach
 * und soll sich schon an der Umrissform vom gewöhnlichen unterscheiden.
 */
export function GoldsternBild({ className = 'size-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="stardash-gold" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.55" stopColor={GOLD_FARBE} />
          <stop offset="1" stopColor="#d97706" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10.4" fill="url(#stardash-gold)" stroke="#92400e" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#92400e" strokeWidth="0.7" opacity="0.55" />
      <path
        d="M12 5.4l1.7 4.5h4.7l-3.8 2.9 1.4 4.6L12 14.6l-4 2.8 1.4-4.6-3.8-2.9h4.7z"
        fill="#fff7d6"
        stroke="#92400e"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Ein Fels: kantig, grau, mit heller Oberseite — ein Prellbock, kein Hindernis zum Fürchten. */
export function FelsBild({ className = 'size-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <ellipse cx="20" cy="34" rx="14" ry="3" fill="#000000" opacity="0.28" />
      <path d="M6 31 L4 20 L11 8 L25 5 L35 13 L36 27 L28 34 L12 34Z" fill="#6b7280" stroke="#374151" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 8 L25 5 L35 13 L22 15 L13 18 L4 20Z" fill="#9ca3af" />
      <path d="M22 15 L35 13 L36 27 L28 34 L24 24Z" fill="#4b5563" />
      <path d="M13 18 L22 15 L24 24 L28 34 L12 34 L6 31 L4 20Z" fill="#6b7280" opacity="0.7" />
    </svg>
  );
}

/**
 * Ein Loch: dunkle Mitte, heller Rand, ein innerer Ring — Ringe sagen „tief", und ein Ring ist
 * eine ganz andere Form als der kantige Fels.
 */
export function LochBild({ className = 'size-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="stardash-loch" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000000" />
          <stop offset="0.62" stopColor="#0b0620" />
          <stop offset="1" stopColor="#3b2a8a" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="16" fill="url(#stardash-loch)" stroke="#a5b4fc" strokeWidth="2" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#818cf8" strokeWidth="1.2" opacity="0.7" />
      <circle cx="20" cy="20" r="4.5" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/**
 * Ein Komet: ein Feuerkopf mit Schweif. Gezeichnet nach **rechts** fliegend (Kopf rechts, Schweif
 * links); die Kachel dreht ihn je nach Flugrichtung. Der Schweif verrät, wohin er als Nächstes zieht.
 */
export function KometBild({ className = 'size-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="stardash-komet" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#fff7ed" />
          <stop offset="0.45" stopColor="#fb923c" />
          <stop offset="1" stopColor="#b91c1c" />
        </radialGradient>
        <linearGradient id="stardash-schweif" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#f97316" stopOpacity="0.95" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M25 6 L1 20 L25 34Z" fill="url(#stardash-schweif)" />
      <path d="M24 12 L7 20 L24 28Z" fill="#fde68a" opacity="0.8" />
      <circle cx="25" cy="20" r="12.5" fill="url(#stardash-komet)" stroke="#7f1d1d" strokeWidth="1.6" />
      <circle cx="21.5" cy="16" r="2.8" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}
