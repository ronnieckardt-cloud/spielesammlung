import type { CSSProperties } from 'react';
import type { GameApi } from '../core/types';
import { spiele } from '../core/registry';
import { bestwert, zuletztGespielt } from './speicher';
import type { Konto } from './konto';

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
      className="rein-von-unten mb-4 flex w-full items-center gap-4 rounded-3xl border border-white/20 bg-white/15 p-4 text-left shadow-2xl backdrop-blur-sm transition-transform duration-100 ease-out active:scale-[0.97]"
      style={{ animationDelay: '90ms' }}
    >
      {/* Größe über eine Hülle statt über das Symbol selbst: `GameApi.Icon`
          nimmt laut Schnittstelle nur `className`, und die Schnittstelle
          wird für so etwas nicht angefasst. */}
      <span
        className="block shrink-0"
        style={{ inlineSize: 'var(--kachel)', blockSize: 'var(--kachel)' }}
      >
        <Icon className="size-full rounded-2xl shadow-lg" />
      </span>
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

/**
 * Wer gerade spielt — oder die Einladung, sich anzumelden.
 *
 * Steht bewusst **oben links neben dem Zahnrad** und nicht als eigene große
 * Karte: Angemeldet zu sein ändert am Spielen nichts, es ist eine
 * Nebeninformation. Wichtig ist nur, dass Florian auf einen Blick sieht,
 * unter welchem Namen seine Punkte laufen — sonst spielt er versehentlich
 * eine Woche lang unangemeldet.
 */
function Kontoknopf({ konto, onKonto }: { konto: Konto | null; onKonto: () => void }) {
  if (!konto) {
    return (
      <button
        type="button"
        onClick={onKonto}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-bold text-white transition-colors hover:bg-white/25 active:bg-white/30"
      >
        <span aria-hidden="true">👤</span> Anmelden
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onKonto}
      aria-label={`Konto von ${konto.name}`}
      className="flex min-h-11 min-w-0 shrink items-center gap-2 rounded-full px-1 text-white transition-colors hover:bg-white/10 active:bg-white/20"
    >
      {/* Der erste Buchstabe als Zeichen — bis es Avatare gibt, ist das die
          schnellste Art zu erkennen, wer angemeldet ist. */}
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-black"
      >
        {konto.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 truncate text-xs font-bold">{konto.name}</span>
    </button>
  );
}

/** Die Startseite: eine Kachel je Spiel. */
export function Kachelmenue({
  konto,
  onSpielen,
  onEinstellungen,
  onBestenliste,
  onDuelle,
  onKonto,
}: {
  konto: Konto | null;
  onSpielen: (id: string) => void;
  onEinstellungen: () => void;
  onBestenliste: () => void;
  onDuelle: () => void;
  onKonto: () => void;
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
        className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-5"
        style={{
          // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          // Die Kachelgröße wächst mit der Bildschirmbreite, statt fest zu
          // sein. Obergrenze 80 Pixel — darüber wirken sie nicht mehr wie
          // App-Symbole, und genau das war die frühere Rückmeldung.
          //
          // Die Untergrenze ist so gewählt, dass auf einem 375er-iPhone
          // **vier** Kacheln je Reihe passen. Bei drei bräuchten vierzehn
          // Spiele fünf Reihen, und die Seite fing an zu scrollen.
          '--kachel': 'clamp(3.5rem, 14vw, 5rem)',
        } as CSSProperties}
      >
        <header className="rein-von-oben mb-4">
          {/* Schmale Leiste über der Wortmarke. Neben einem so breiten Titel
              passt auf einem 375er-Handy nichts mehr daneben — deshalb
              darüber statt rechts. Links der Fortschritt, damit die Leiste
              nicht leer wirkt, rechts das Zahnrad. */}
          <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
            {/* Auf einem 375er-Handy wird es hier eng: Fortschritt, Konto und
                Zahnrad teilen sich eine Zeile. Der Fortschritt ist das am
                wenigsten Wichtige und gibt deshalb als Erster nach. */}
            <span className="min-w-0 truncate text-xs font-medium text-white/75">
              {angespielt > 0
                ? `${angespielt} von ${spiele.length} Spielen ausprobiert`
                : 'Läuft auch ohne Internet'}
            </span>

            <Kontoknopf konto={konto} onKonto={onKonto} />

            {/* Einstellungen tritt zurück: kein Rand, keine Füllung, nur das
                Zahnrad — man muss da nicht ständig rein. Die Trefferfläche
                bleibt trotzdem volle 44 × 44 (Apple-Vorgabe); vorher waren
                beide Kopfknöpfe nur 38 Pixel hoch, die Regel war an dieser
                Stelle also ohnehin verletzt. */}
            <button
              type="button"
              onClick={onEinstellungen}
              aria-label="Einstellungen"
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
            >
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
                />
                <path
                  fill="currentColor"
                  d="m10.6 2.9-.35 2.03a7.4 7.4 0 0 0-1.5.87L6.83 5.1 4.2 9.66l1.6 1.3a7.5 7.5 0 0 0 0 1.74l-1.6 1.3 2.63 4.56 1.92-.7c.46.35.96.64 1.5.87l.35 2.03h5.26l.35-2.03c.54-.23 1.04-.52 1.5-.87l1.92.7 2.63-4.56-1.6-1.3a7.5 7.5 0 0 0 0-1.74l1.6-1.3-2.63-4.56-1.92.7a7.4 7.4 0 0 0-1.5-.87l-.35-2.03h-5.26Zm1.7 2h1.86l.26 1.55.98.4c.4.17.78.39 1.12.65l.83.63 1.47-.54.93 1.6-1.22 1 .1 1.03a5.5 5.5 0 0 1 0 1.03l-.1 1.03 1.22 1-.93 1.6-1.47-.54-.83.63c-.34.26-.72.48-1.12.65l-.98.4-.26 1.55h-1.86l-.26-1.55-.98-.4a5.4 5.4 0 0 1-1.12-.65l-.83-.63-1.47.54-.93-1.6 1.22-1-.1-1.03a5.5 5.5 0 0 1 0-1.03l.1-1.03-1.22-1 .93-1.6 1.47.54.83-.63c.34-.26.72-.48 1.12-.65l.98-.4.26-1.55Z"
                />
              </svg>
            </button>
          </div>

          {/* Mittig, nicht linksbündig — links hängend sah es unfertig aus. */}
          <h1 className="wortmarke" aria-label="Florians Spielesammlung">
            <span aria-hidden="true" className="wortmarke-vorname">
              Florians
            </span>
            <span aria-hidden="true" className="wortmarke-wort" data-text="Spielesammlung">
              Spielesammlung
            </span>
          </h1>
        </header>

        {weiter && <Weiterkarte spiel={weiter} onSpielen={onSpielen} />}

        {/* Icon-Kacheln wie kleine App-Symbole vom Handy-Startbildschirm.
            Auf einer eigenen, mattierten Karte statt direkt auf dem
            Verlauf — wirkt wie ein Spiele-Regal, nicht wie lose verstreute
            Symbole.

            `justify-center`: Die letzte Reihe ist selten voll, und
            linksbündig hing sie dann sichtbar schief im Regal. Mittig
            gesetzt sieht auch eine halbe Reihe aufgeräumt aus.

            Die Kachelgröße wächst mit dem Bildschirm (`--kachel`, siehe
            unten). Vorher war sie fest auf 64 Pixel — auf einem iPad wirkte
            das verloren, auf einem kleinen iPhone eng. */}
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-3 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-sm sm:gap-x-6 sm:gap-y-4 sm:p-5">
          {spiele.map((spiel, i) => {
            const beste = bestwert(spiel.id);
            const Icon = spiel.Icon;
            // Fertige App-Symbole bringen Hintergrund und Ecken selbst mit —
            // von der Hülle kommt dann nur noch der farbige Schatten.
            const vollflaechig = spiel.iconVollflaechig === true;
            return (
              <li
                key={spiel.id}
                className="kachel-rein relative flex flex-col items-center gap-1.5"
                style={
                  {
                    // Beschriftungsbreite wächst mit der Kachel mit. Knapp
                    // bemessen: Jeder zusätzliche Zentimeter hier kostet auf
                    // einem 375er-iPhone die vierte Kachel je Reihe — und
                    // damit eine ganze zusätzliche Reihe. Längere Namen
                    // brechen lieber um (`leading-tight`, kein `truncate`).
                    width: 'calc(var(--kachel) + 0.5rem)',
                    // Gedeckelt: Bei vierzehn Kacheln wäre eine
                    // durchgezählte Staffel sonst über eine halbe Sekunde
                    // lang, und die letzten Kacheln kämen spürbar zu spät.
                    '--verzoegerung': `${140 + Math.min(i * 28, 380)}ms`,
                  } as CSSProperties
                }
              >
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
                    inlineSize: 'var(--kachel)',
                    blockSize: 'var(--kachel)',
                    background: vollflaechig
                      ? undefined
                      : `linear-gradient(150deg, color-mix(in srgb, ${spiel.accent} 100%, white 30%), ${spiel.accent} 55%, color-mix(in srgb, ${spiel.accent} 100%, black 22%))`,
                    boxShadow: `0 6px 16px -6px color-mix(in srgb, ${spiel.accent} 70%, transparent)`,
                  }}
                  className="grid place-items-center rounded-[22%] text-white transition-transform duration-100 ease-out active:scale-90"
                >
                  {vollflaechig ? (
                    <Icon className="size-full" />
                  ) : (
                    <Icon className="size-2/5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
                  )}
                </button>
                <span className="w-full text-center text-[11px] leading-tight font-medium text-white/90">
                  {spiel.title}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Die Bestenliste ist jetzt der einzige laute Knopf der Seite — im
            Kopf ist kein Platz mehr, und unter dem Regal ist im Spielmenü
            ohnehin der übliche Ort für eine Rangliste. Große, sichere
            Trefferfläche, und sie ersetzt einen Text, der auf dem Handy
            niemandem nützt. */}
        <button
          type="button"
          onClick={onBestenliste}
          className="rein-von-unten mt-4 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white shadow-lg backdrop-blur-sm transition-transform duration-100 ease-out active:scale-[0.985]"
          style={{ animationDelay: '260ms' }}
        >
          <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-amber-300" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6 4h12v2h3v3a4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A6 6 0 0 1 7.3 13H7a4 4 0 0 1-4-4V6h3V4Zm0 4H5v1a2 2 0 0 0 1 1.7V8Zm12 2.7A2 2 0 0 0 19 9V8h-1v2.7Z"
            />
          </svg>
          <span className="flex-1 font-bold">Bestenliste</span>
          <span aria-hidden="true" className="text-lg text-white/60">
            ›
          </span>
        </button>

        {/* Duelle stehen gleich neben der Bestenliste: Beides beantwortet
            dieselbe Frage — „wie stehe ich gegen die anderen da?" —, nur
            einmal gegen alle und einmal gegen einen bestimmten. */}
        <button
          type="button"
          onClick={onDuelle}
          className="rein-von-unten mt-2 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white shadow-lg backdrop-blur-sm transition-transform duration-100 ease-out active:scale-[0.985]"
          style={{ animationDelay: '300ms' }}
        >
          <span aria-hidden="true" className="text-xl">
            ⚔️
          </span>
          <span className="flex-1 font-bold">Duelle</span>
          <span aria-hidden="true" className="text-lg text-white/60">
            ›
          </span>
        </button>

        {/* Nur auf breiten Bildschirmen: Auf dem Handy gibt es keine
            Tastatur, und die Zeile kostete 48 Pixel Höhe — die fehlen dort
            an anderer Stelle. */}
        <p className="mt-3 hidden text-center text-xs text-white/60 sm:block">
          Tastatur: Pfeiltasten oder WASD bewegen, X dreht, Leertaste lässt fallen, Eingabetaste
          wählt.
        </p>
      </div>
    </div>
  );
}
