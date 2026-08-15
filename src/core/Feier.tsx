import type { CSSProperties } from 'react';

/**
 * Konfetti für die großen Momente.
 *
 * **Nicht für jede Runde.** Es gibt in dieser App genau drei Anlässe, die
 * das rechtfertigen: eine neue Stufe, ein frisch freigeschalteter Erfolg
 * und eine neue persönliche Bestleistung. Würde jede beendete Runde
 * feiern, wäre das Feiern nichts mehr wert — und ein Kind, das gerade nach
 * drei Sekunden verloren hat, mit Konfetti zu überschütten, wirkt sogar
 * hämisch.
 *
 * ## Warum das nicht das vorhandene `.konfetti` benutzt
 *
 * Color Pour hat schon Konfetti, aber das sind **SVG**-Teilchen
 * (`transform-box: fill-box`) innerhalb einer Zeichnung. Hier liegen die
 * Teilchen über einem Dialog aus normalen Elementen. Zwei verschiedene
 * Sachen mit demselben Namen wären schlimmer als zwei Namen.
 *
 * ## Kein Zufall
 *
 * Die Streuung kommt aus dem Index, nicht aus `Math.random`. Das ist hier
 * keine Regeltreue um ihrer selbst willen: React kann eine Komponente
 * mehrfach rendern (im Entwicklungsmodus sogar absichtlich doppelt), und
 * mit Zufall bekäme jedes Teilchen dabei eine neue Flugbahn — das Konfetti
 * würde mitten im Flug springen.
 */

/** Wie viele Teilchen. Genug für Fülle, wenig genug für ein altes iPad. */
const ANZAHL = 22;

const FARBEN = [
  'var(--color-gold)',
  'var(--color-xp)',
  'var(--color-fokus)',
  'var(--color-erfolg)',
  '#f472b6',
] as const;

export function Feier({ ruhig = false }: { ruhig?: boolean }) {
  // Bei „weniger Bewegung" gar nichts rendern. Ein stehendes Konfetti-Bild
  // wäre schlechter als keines: Es bliebe als Fleckenmuster über dem Text
  // liegen, weil die Animation nur gekürzt und nicht abgeschaltet wird.
  if (ruhig) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 2 }}
    >
      {Array.from({ length: ANZAHL }, (_, i) => {
        /*
         * Feste Streuung aus dem Index. Die drei Primzahlfaktoren sorgen
         * dafür, dass Startpunkt, Richtung und Zeitversatz nicht im
         * Gleichtakt laufen — sonst fliegen die Teilchen in sichtbaren
         * Gruppen statt gestreut.
         */
        const links = 6 + ((i * 37) % 88);
        const seite = ((i * 53) % 100) / 100 - 0.5;
        const weite = 60 + ((i * 29) % 90);
        const dreh = ((i * 71) % 720) - 360;
        const versatz = (i * 31) % 260;
        const dauer = 1000 + ((i * 43) % 500);
        const breit = i % 3 === 0;

        return (
          <span
            key={i}
            className="feier-teil absolute block"
            style={
              {
                left: `${links}%`,
                top: '38%',
                width: breit ? 9 : 6,
                height: breit ? 5 : 10,
                borderRadius: 2,
                background: FARBEN[i % FARBEN.length],
                animationDelay: `${versatz}ms`,
                animationDuration: `${dauer}ms`,
                '--fx': `${seite * 150}px`,
                '--fy': `${-weite}px`,
                '--fdreh': `${dreh}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
