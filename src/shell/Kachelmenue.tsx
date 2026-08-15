import type { CSSProperties } from 'react';
import type { GameApi } from '../core/types';
import { spiele } from '../core/registry';
import { bestwert, zuletztGespielt } from './speicher';

/**
 * Schwebende Farbflecken im Hintergrund der Startseite — feste Liste, rein
 * dekorativ, deutlich unschärfer/blasser als bei den Startbildschirmen der
 * einzelnen Spiele, damit sie nicht mit den Kacheln konkurrieren. Gleiches
 * Muster wie dort (`.block-schweben` in index.css).
 */
const DEKO_FLECKEN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 6, y: 8, groesse: 90, farbe: '#f472b6', verzoegerung: 0 },
  { x: 88, y: 6, groesse: 70, farbe: '#38bdf8', verzoegerung: 0.8 },
  { x: 92, y: 60, groesse: 100, farbe: '#facc15', verzoegerung: 1.4 },
  { x: 4, y: 70, groesse: 80, farbe: '#2dd4bf', verzoegerung: 0.4 },
];

/**
 * Die große Karte über dem Raster: ein Klick, und man ist wieder da, wo man
 * aufgehört hat.
 *
 * Der Grund, warum das **über** dem Raster steht und nicht das Raster
 * umsortiert: Ein Kind lernt „Snake Rush ist das grüne unten links" und
 * tippt es beim zehnten Mal blind. Ein Raster, das sich nach jedem Spielen
 * neu sortiert, nimmt genau diese Sicherheit weg — und ausgerechnet beim
 * Lieblingsspiel, das dann ständig woanders läge. Also: Dynamik oben,
 * feste Ordnung unten.
 *
 * Hier darf der Bestwert auch sichtbar stehen. Im Raster bleibt er
 * weiterhin nur im `aria-label`; das ist eine bewusste Entscheidung für
 * die Kacheln, keine Regel für die ganze Seite.
 */
function Weiterkarte({ spiel, onSpielen }: { spiel: GameApi; onSpielen: (id: string) => void }) {
  const beste = bestwert(spiel.id);
  const Icon = spiel.Icon;

  return (
    <button
      type="button"
      onClick={() => onSpielen(spiel.id)}
      className="mb-4 flex w-full items-center gap-4 rounded-3xl border border-white/20 bg-white/15 p-4 text-left shadow-2xl backdrop-blur-sm transition-transform active:scale-[0.98]"
    >
      <Icon className="size-16 shrink-0 rounded-2xl shadow-lg" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wide text-white/70 uppercase">
          Weiterspielen
        </span>
        <span className="block truncate text-xl font-black text-white">{spiel.title}</span>
        <span className="block text-xs text-white/75">
          {beste > 0 ? `Beste Punktzahl: ${beste}` : 'Noch keine Punkte — auf geht’s!'}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl text-indigo-700"
      >
        ▶
      </span>
    </button>
  );
}

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
  // Frisch bei jedem Rendern gelesen, genau wie `bestwert` unten. Beim
  // Zurückkommen aus einem Spiel wird das Menü ohnehin neu aufgebaut, es
  // braucht dafür keinen eigenen Zustand.
  const zuletzt = zuletztGespielt();
  const weiter = spiele.find((s) => s.id === zuletzt);
  const angespielt = spiele.filter((s) => bestwert(s.id) > 0).length;

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #1e1b4b 0%, #4338ca 30%, #7c3aed 60%, #db2777 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {DEKO_FLECKEN.map((f, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-20 blur-2xl"
            style={
              {
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: f.groesse,
                height: f.groesse,
                backgroundColor: f.farbe,
                animationDelay: `${f.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6"
        // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-3xl font-black tracking-tight text-white"
              style={{ textShadow: '0 3px 0 rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.3)' }}
            >
              Spielesammlung
            </h1>
            <p className="text-sm text-white/75">
              {angespielt > 0
                ? `${angespielt} von ${spiele.length} Spielen ausprobiert.`
                : 'Läuft auch ohne Internet.'}
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBestenliste}
              className="rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-white/25"
            >
              Bestenliste
            </button>
            <button
              type="button"
              onClick={onEinstellungen}
              className="rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-white/25"
            >
              Einstellungen
            </button>
          </nav>
        </header>

        {weiter && <Weiterkarte spiel={weiter} onSpielen={onSpielen} />}

        {/* Icon-Kacheln wie kleine App-Symbole vom Handy-Startbildschirm —
            feste, kleinere Größe statt sich über Grid-Spalten an die
            Bildschirmbreite anzupassen (Rückmeldung: wirkten zu groß, sollen
            so wirken wie normale App-Symbole auf dem Handy). Auf einer
            eigenen, mattierten Karte statt direkt auf dem Verlauf — wirkt
            wie ein Spiele-Regal, nicht wie lose verstreute Symbole. */}
        <ul className="flex flex-wrap gap-x-5 gap-y-4 rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
          {spiele.map((spiel) => {
            const beste = bestwert(spiel.id);
            const Icon = spiel.Icon;
            // Fertige App-Symbole bringen Hintergrund und Ecken selbst mit —
            // von der Hülle kommt dann nur noch der farbige Schatten.
            const vollflaechig = spiel.iconVollflaechig === true;
            return (
              <li key={spiel.id} className="relative flex w-20 flex-col items-center gap-1.5">
                {/* „Neu" als Wort, nicht nur als farbiger Punkt — Farbe darf
                    nie das einzige Merkmal sein. Für Screenreader steht
                    dasselbe schon im aria-label des Knopfes.

                    Nicht am Spiel der Weiterspielen-Karte: „Weiterspielen"
                    und „Neu" gleichzeitig widerspricht sich. Das passiert
                    genau dann, wenn eine Runde abgebrochen wurde, bevor es
                    Punkte gab — also gar nicht so selten. */}
                {beste === 0 && spiel.id !== weiter?.id && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-0.5 z-10 rounded-full bg-amber-400 px-1.5 py-px text-[9px] font-black text-amber-950 shadow"
                  >
                    Neu
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSpielen(spiel.id)}
                  aria-label={`${spiel.title} — ${beste > 0 ? `beste Punktzahl ${beste}` : 'noch nicht gespielt'}`}
                  style={{
                    background: vollflaechig
                      ? undefined
                      : `linear-gradient(150deg, color-mix(in srgb, ${spiel.accent} 100%, white 30%), ${spiel.accent} 55%, color-mix(in srgb, ${spiel.accent} 100%, black 22%))`,
                    boxShadow: `0 6px 16px -6px color-mix(in srgb, ${spiel.accent} 70%, transparent)`,
                  }}
                  className="grid size-16 place-items-center rounded-2xl text-white transition-transform active:scale-95"
                >
                  {vollflaechig ? (
                    <Icon className="size-full" />
                  ) : (
                    <Icon className="size-7 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
                  )}
                </button>
                <span className="w-full text-center text-[11px] leading-tight font-medium text-white/90">
                  {spiel.title}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-xs text-white/70">
          Tastatur: Pfeiltasten oder WASD bewegen, X dreht, Leertaste lässt fallen, Eingabetaste
          wählt. Am Handy: wischen und tippen.
        </p>
      </div>
    </div>
  );
}
