import type { ReactNode } from 'react';

/** Gemeinsames Gerüst für alle Seiten der Hülle: Kopfzeile und Inhalt. */
export function Seite({
  titel,
  onZurueck,
  rechts,
  children,
}: {
  titel: string;
  onZurueck?: () => void;
  rechts?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="seiten-auftritt flex min-h-full flex-1 flex-col"
      /*
       * Ein gedämpfter Abkömmling des Startseiten-Verlaufs statt des fast
       * schwarzen Grundtons. Vorher war der Sprung von der kräftig bunten
       * Startseite auf die nahezu schwarze Bestenliste der auffälligste
       * Bruch der ganzen App — es wirkte wie zwei verschiedene Programme.
       *
       * Bewusst **dunkel** gehalten und nicht der volle Verlauf: Diese
       * Seiten sind Text- und Listenseiten, und ihre Farbtokens
       * (`text-gedaempft`, `border-rand`) sind für dunklen Grund
       * ausgelegt. Auf dem hellen Verlauf wären sie kontrastarm.
       */
      style={{
        background:
          'linear-gradient(168deg, #171634 0%, #1c1b45 42%, #241a4a 72%, #2e1740 100%)',
      }}
    >
      {/* Auf Tablets breiter — siehe BunterGrund, gleiche Begründung. */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col md:max-w-5xl">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-black/25 px-4 pb-3 backdrop-blur-lg"
        // Auf dem iPhone als installierte App liegt die Statusleiste (Uhr,
        // Akku) sonst über dieser Zeile — env(safe-area-inset-top) schiebt
        // sie runter. Auf normalen Bildschirmen ist der Wert 0, also ohne
        // Wirkung.
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        {onZurueck && (
          <button
            type="button"
            onClick={onZurueck}
            className="spielknopf text-sm font-medium"
          >
            <span aria-hidden="true">←</span> Zurück
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{titel}</h1>
        {rechts}
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
