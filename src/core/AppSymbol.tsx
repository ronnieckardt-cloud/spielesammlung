import type { ReactNode } from 'react';

/**
 * Gemeinsamer Rahmen für die App-Symbole der Spiele.
 *
 * Ein Symbol besteht aus immer denselben Teilen: abgerundetes Quadrat mit
 * Farbverlauf, weicher Lichtschein oben links, darauf ein kleiner Einblick
 * ins Spiel, unten ein dunkles Band mit dem Schriftzug. Nur der Einblick
 * unterscheidet sich — deshalb steht der Rest einmal hier statt elfmal in
 * den einzelnen Icon-Dateien.
 *
 * Der Einblick (`children`) wird in den Bereich **oberhalb von y = 44**
 * gezeichnet; darunter liegt das Schriftband. Das Koordinatensystem ist
 * immer 64 × 64, unabhängig davon, wie groß das Symbol angezeigt wird.
 */

/** Ab hier beginnt das Schriftband — der Einblick muss darüber bleiben. */
export const BAND_OBEN = 44;

export function AppSymbol({
  id,
  verlauf,
  schriftzug,
  className,
  children,
}: {
  /** Kurz und je Spiel eindeutig — daraus werden die SVG-internen ids. */
  id: string;
  /** Zwei bis drei Farben von oben nach unten. */
  verlauf: readonly string[];
  /** Steht im Band unten, in Großbuchstaben. */
  schriftzug: string;
  className?: string;
  /** Der Einblick ins Spiel, im Bereich y = 0 bis 44. */
  children: ReactNode;
}) {
  // Lange Namen brauchen eine kleinere Schrift, sonst quetscht textLength
  // sie zu einem unleserlichen Strich zusammen. Die Grenze liegt bei 11
  // Zeichen, damit „BLOCK BURST" unverändert bleibt.
  const schriftgroesse = schriftzug.length <= 11 ? 11 : 8.5;

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        {/* Die ids sind fest vergeben, nicht zufällig: Ein Symbol kann
            mehrfach auf einer Seite stehen (Menü und Bestenliste). Die
            Definitionen sind dann identisch, das Bild also überall gleich. */}
        <linearGradient id={`${id}-grund`} x1="0" y1="0" x2="0.35" y2="1">
          {verlauf.map((farbe, i) => (
            <stop key={farbe} offset={i / Math.max(1, verlauf.length - 1)} stopColor={farbe} />
          ))}
        </linearGradient>
        <clipPath id={`${id}-ecken`}>
          {/* rx 16 bei 64 Breite = dieselbe Rundung wie rounded-2xl auf der
              64px großen Kachel, und skaliert überall mit. */}
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-ecken)`}>
        <rect width="64" height="64" fill={`url(#${id}-grund)`} />
        <ellipse cx="16" cy="4" rx="34" ry="20" fill="#ffffff" opacity="0.16" />

        {children}

        <rect y={BAND_OBEN} width="64" height={64 - BAND_OBEN} fill="#0b1020" opacity="0.42" />
        <text
          x="32"
          y="57.5"
          textAnchor="middle"
          // textLength zwingt den Schriftzug auf die Breite — so passt er
          // auch, wenn ein Gerät eine andere Schrift einsetzt.
          textLength="50"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          fontSize={schriftgroesse}
          fontWeight="800"
          fill="#ffffff"
        >
          {schriftzug}
        </text>
      </g>
    </svg>
  );
}

/**
 * Ein glänzender Spielblock, wie ihn mehrere Symbole brauchen: Schatten
 * unten, Grundfarbe, Lichtkante oben.
 */
export function GlanzBlock({
  x,
  y,
  groesse = 12,
  farbe,
  rundung = 3,
}: {
  x: number;
  y: number;
  groesse?: number;
  farbe: string;
  rundung?: number;
}) {
  return (
    <>
      <rect x={x} y={y + 1} width={groesse} height={groesse} rx={rundung} fill="#0b1020" opacity="0.25" />
      <rect x={x} y={y} width={groesse} height={groesse} rx={rundung} fill={farbe} />
      <rect
        x={x + groesse * 0.13}
        y={y + groesse * 0.13}
        width={groesse * 0.73}
        height={groesse * 0.28}
        rx={groesse * 0.14}
        fill="#ffffff"
        opacity="0.45"
      />
    </>
  );
}
