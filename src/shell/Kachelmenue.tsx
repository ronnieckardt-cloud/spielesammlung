import { spiele } from '../core/registry';
import { bestwert } from './speicher';

/** Die Startseite: eine Kachel je Spiel. */
export function Kachelmenue({
  onSpielen,
  onEinstellungen,
  onBestenliste,
}: {
  onSpielen: (id: string) => void;
  onEinstellungen: () => void;
  onBestenliste: () => void;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6"
      // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
      style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
    >
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spielesammlung</h1>
          <p className="text-sm text-gedaempft">Läuft auch ohne Internet.</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBestenliste}
            className="rounded-lg border border-rand bg-flaeche px-3 py-2 text-sm hover:bg-flaeche-hoch"
          >
            Bestenliste
          </button>
          <button
            type="button"
            onClick={onEinstellungen}
            className="rounded-lg border border-rand bg-flaeche px-3 py-2 text-sm hover:bg-flaeche-hoch"
          >
            Einstellungen
          </button>
        </nav>
      </header>

      {/* Bewusst nur Icon-Kacheln, ohne Namen oder Beschreibung — wie eine
          Reihe kleiner App-Symbole. Name und Bestwert bleiben für
          Screenreader über aria-label erhalten. */}
      <ul className="grid grid-cols-4 gap-4 sm:grid-cols-5">
        {spiele.map((spiel) => {
          const beste = bestwert(spiel.id);
          const Icon = spiel.Icon;
          return (
            <li key={spiel.id}>
              <button
                type="button"
                onClick={() => onSpielen(spiel.id)}
                aria-label={`${spiel.title} — ${beste > 0 ? `beste Punktzahl ${beste}` : 'noch nicht gespielt'}`}
                style={{ backgroundColor: spiel.accent }}
                className="flex aspect-square w-full items-center justify-center rounded-2xl text-white shadow-sm transition-transform active:scale-95"
              >
                <Icon className="size-8 sm:size-9" />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-xs text-gedaempft">
        Tastatur: Pfeiltasten oder WASD bewegen, X dreht, Leertaste lässt fallen, Eingabetaste
        wählt. Am Handy: wischen und tippen.
      </p>
    </div>
  );
}
