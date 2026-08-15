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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-rand bg-grund/90 px-4 pb-3 backdrop-blur"
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
  );
}
