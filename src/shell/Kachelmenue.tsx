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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
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

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {spiele.map((spiel) => {
          const beste = bestwert(spiel.id);
          return (
            <li key={spiel.id}>
              <button
                type="button"
                onClick={() => onSpielen(spiel.id)}
                style={{ borderLeftColor: spiel.accent }}
                className="flex w-full items-center gap-4 rounded-karte border border-rand border-l-4 bg-flaeche p-4 text-left transition-colors hover:bg-flaeche-hoch"
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: spiel.accent }}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-xl font-bold text-grund"
                >
                  {spiel.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{spiel.title}</span>
                  <span className="block text-sm text-gedaempft">{spiel.blurb}</span>
                  <span className="mt-1 block text-xs text-gedaempft">
                    {beste > 0 ? `Beste Punktzahl: ${beste}` : 'Noch nicht gespielt'}
                  </span>
                </span>
                <span aria-hidden="true" className="text-gedaempft">
                  ▸
                </span>
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
