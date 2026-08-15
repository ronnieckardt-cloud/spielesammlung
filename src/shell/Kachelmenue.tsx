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

      {/* Icon-Kacheln wie kleine App-Symbole vom Handy-Startbildschirm —
          feste, kleinere Größe statt sich über Grid-Spalten an die
          Bildschirmbreite anzupassen (Rückmeldung: wirkten zu groß, sollen
          so wirken wie normale App-Symbole auf dem Handy). Farbverlauf
          statt Volltonfarbe, Name als kleine, zweizeilig umbrechende
          Beschriftung darunter. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-4">
        {spiele.map((spiel) => {
          const beste = bestwert(spiel.id);
          const Icon = spiel.Icon;
          return (
            <li key={spiel.id} className="flex w-20 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSpielen(spiel.id)}
                aria-label={`${spiel.title} — ${beste > 0 ? `beste Punktzahl ${beste}` : 'noch nicht gespielt'}`}
                style={{
                  background: `linear-gradient(150deg, color-mix(in srgb, ${spiel.accent} 100%, white 30%), ${spiel.accent} 55%, color-mix(in srgb, ${spiel.accent} 100%, black 22%))`,
                  boxShadow: `0 6px 16px -6px color-mix(in srgb, ${spiel.accent} 70%, transparent)`,
                }}
                className="grid size-16 place-items-center rounded-2xl text-white transition-transform active:scale-95"
              >
                <Icon className="size-7 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
              </button>
              <span className="w-full text-center text-[11px] leading-tight font-medium text-gedaempft">
                {spiel.title}
              </span>
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
