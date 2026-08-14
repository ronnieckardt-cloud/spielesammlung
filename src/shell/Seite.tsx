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
    <div className="sicherer-rand mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-rand bg-grund/90 px-4 py-3 backdrop-blur">
        {onZurueck && (
          <button
            type="button"
            onClick={onZurueck}
            className="rounded-lg border border-rand bg-flaeche px-3 py-2 text-sm font-medium hover:bg-flaeche-hoch"
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
