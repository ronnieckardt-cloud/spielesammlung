import { FARBEN } from './farben';
import { ROEHRCHEN_UMRISS } from './geometrie';

/**
 * Gemeinsame SVG-Definitionen (Verläufe, Klip-Form) — einmal im Baum
 * vorhanden, von jedem einzelnen Röhrchen über `url(#id)` referenziert.
 * Referenzen funktionieren dokumentweit, auch über mehrere <svg>-Wurzeln
 * hinweg, deshalb genügt ein einziges verstecktes <svg> für alle zusammen.
 *
 * Ein Verlauf pro Farb-Kennung (nicht pro Levelposition!) — welche Farben
 * ein Level benutzt, wechselt, aber die Kennung je Farbe bleibt stabil.
 */
export function FarbMusterDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <clipPath id="roehrchen-form">
          <path d={ROEHRCHEN_UMRISS} />
        </clipPath>

        {/* Senkrechter Verlauf, dunkler am Boden — sieht nach Flüssigkeit im
            Licht aus, nicht nach einer flachen Fläche. */}
        {FARBEN.map((f) => (
          <linearGradient key={f.id} id={`fluessigkeit-${f.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={f.hex} />
            <stop offset="100%" stopColor={f.dunkel} />
          </linearGradient>
        ))}

        <linearGradient id="glaskoerper" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0.07" />
          <stop offset="35%" stopColor="white" stopOpacity="0.015" />
          <stop offset="100%" stopColor="white" stopOpacity="0.05" />
        </linearGradient>

        <linearGradient id="glanzstreifen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
