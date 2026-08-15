import type { GameApi } from '../core/types';
import { spiele } from '../core/registry';
import { bestwert, fortschrittLesen, zuletztGespielt } from './speicher';
import { ALLE_ERFOLGE, stufeAus } from './fortschritt';
import { BunterGrund } from './BunterGrund';
import { Spielkachel } from './Spielkachel';
import { Stufenkarte } from './Stufenkarte';
import type { Konto } from './konto';

/**
 * Die Startseite als **Spiele-Zentrale**, nicht als Regal.
 *
 * Vorher war die Startseite das Kachelraster plus Kopfzeile. Mit zwanzig
 * Spielen war das eine Wand aus Symbolen, die scrollte — und alles, was
 * nicht Kachel war (Bestenliste, Duelle), lag darunter außer Sicht.
 *
 * Jetzt beantwortet die Seite von oben nach unten vier Fragen, in der
 * Reihenfolge, in der ein Kind sie stellt:
 *
 * 1. „Bin ich das?" — Begrüßung und Stufe.
 * 2. „Wo war ich?" — die Weiterspielen-Karte, der größte Knopf der Seite.
 * 3. „Was kann ich als Nächstes holen?" — die nächsten Ziele.
 * 4. „Was gibt's noch?" — eine Auswahl Spiele, der Rest hinter einem Knopf.
 *
 * Das vollständige Raster liegt auf einer **eigenen** Seite. Es musste hier
 * nicht bleiben: Wer gezielt ein bestimmtes Spiel sucht, geht auf „Spiele";
 * wer nur weiterspielen will, tippt oben. Vorher bediente eine einzige
 * lange Seite beide Fälle schlecht.
 */

/**
 * Die große Karte: ein Tipp, und man ist wieder da, wo man aufgehört hat.
 *
 * Sie ist bewusst der größte und einzige helle Knopf des oberen Bereichs.
 * In neun von zehn Fällen ist genau das die Absicht, mit der die App
 * geöffnet wird — dann darf man dafür nicht suchen müssen.
 */
function Weiterkarte({ spiel, onSpielen }: { spiel: GameApi; onSpielen: (id: string) => void }) {
  const beste = bestwert(spiel.id);
  const Icon = spiel.Icon;

  return (
    <button
      type="button"
      onClick={() => onSpielen(spiel.id)}
      className="druckbar rein-von-unten flex w-full items-center gap-4 rounded-3xl border border-white/25 bg-white/18 p-4 text-left backdrop-blur-sm"
      style={{ animationDelay: '120ms' }}
    >
      {/* Größe über eine Hülle statt über das Symbol selbst: `GameApi.Icon`
          nimmt laut Schnittstelle nur `className`, und die Schnittstelle
          wird für so etwas nicht angefasst. */}
      <span
        className="block shrink-0"
        style={{ inlineSize: 'calc(var(--kachel) * 1.15)', blockSize: 'calc(var(--kachel) * 1.15)' }}
      >
        <Icon className="size-full rounded-2xl shadow-lg" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-wide text-white/70 uppercase">
          Weiterspielen
        </span>
        <span className="block truncate text-xl font-black text-white">{spiel.title}</span>
        <span className="block text-xs text-white/75">
          {beste > 0 ? `Beste Punktzahl: ${beste}` : 'Noch keine Punkte — auf geht’s!'}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-xl text-indigo-700"
        style={{ boxShadow: 'var(--schatten-2)' }}
      >
        ▶
      </span>
    </button>
  );
}

export function StartSeite({
  konto,
  onSpielen,
  onAlleSpiele,
  onKonto,
}: {
  konto: Konto | null;
  onSpielen: (id: string) => void;
  onAlleSpiele: () => void;
  onKonto: () => void;
}) {
  // Frisch bei jedem Rendern gelesen. Beim Zurückkommen aus einem Spiel wird
  // die Seite ohnehin neu aufgebaut, es braucht dafür keinen eigenen Zustand.
  const fortschritt = fortschrittLesen();
  const stand = stufeAus(fortschritt.xp);
  const zuletzt = zuletztGespielt();
  const weiter = spiele.find((s) => s.id === zuletzt);

  /*
   * Die nächsten drei noch verschlossenen Erfolge. Mehr wären eine Liste
   * statt eines Ziels — und die Reihenfolge in `ALLE_ERFOLGE` steigt bereits
   * von leicht nach schwer, die obersten drei sind also immer die
   * erreichbarsten.
   */
  const ziele = ALLE_ERFOLGE.filter((e) => !fortschritt.erfolge.includes(e.id)).slice(0, 3);

  /*
   * Acht Kacheln auf der Startseite: zuerst das zuletzt Gespielte, dann der
   * Rest in fester Reihenfolge. Die feste Ordnung ist Absicht — ein Kind
   * lernt „Snake Rush ist das grüne", und ein Raster, das sich ständig
   * umsortiert, nimmt genau diese Sicherheit weg.
   */
  const auswahl = [
    ...(weiter ? [weiter] : []),
    ...spiele.filter((s) => s.id !== weiter?.id),
  ].slice(0, 8);

  return (
    <BunterGrund>
      <header className="rein-von-oben mb-4">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
          <span
            aria-hidden="true"
            className="min-w-0 truncate text-[11px] font-black tracking-[0.22em] text-white/55 uppercase"
          >
            Florians Spielesammlung
          </span>
          <Kontoknopf konto={konto} onKonto={onKonto} />
        </div>

        {/* Die Begrüßung steht dort, wo vorher die Wortmarke stand. Ein Name
            ist persönlicher als ein Logo — und die App weiß ihn, sobald
            jemand angemeldet ist. */}
        <h1 className="text-3xl leading-tight font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          {konto ? (
            <>
              Hallo {konto.name}! <span aria-hidden="true">👋</span>
            </>
          ) : (
            <>
              Los geht’s! <span aria-hidden="true">🎮</span>
            </>
          )}
        </h1>
        <p className="mt-1 text-sm text-white/75">
          {fortschritt.serie >= 2
            ? `🔥 ${fortschritt.serie} Tage am Stück — weiter so!`
            : 'Bereit für die nächste Runde?'}
        </p>
      </header>

      <div className="rein-von-unten mb-3" style={{ animationDelay: '60ms' }}>
        <Stufenkarte stand={stand} />
      </div>

      {weiter && <Weiterkarte spiel={weiter} onSpielen={onSpielen} />}

      {ziele.length > 0 && (
        <section
          className="rein-von-unten mt-4"
          style={{ animationDelay: '180ms' }}
          aria-labelledby="ziele-titel"
        >
          <h2 id="ziele-titel" className="mb-2 px-1 text-sm font-black text-white/85">
            Deine nächsten Ziele
          </h2>
          <ul className="flex flex-col gap-2">
            {ziele.map((z) => (
              <li
                key={z.id}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm"
              >
                {/* Verschlossene Ziele stehen blass da, statt zu fehlen —
                    sonst wüsste ein Kind nicht, dass es etwas zu holen gibt. */}
                <span aria-hidden="true" className="text-2xl opacity-45 grayscale">
                  {z.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{z.titel}</span>
                  <span className="block text-xs text-white/70">{z.beschreibung}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className="rein-von-unten mt-4"
        style={{ animationDelay: '240ms' }}
        aria-labelledby="spiele-titel"
      >
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 id="spiele-titel" className="text-sm font-black text-white/85">
            Spiele
          </h2>
          <button
            type="button"
            onClick={onAlleSpiele}
            className="min-h-8 rounded-full px-2 text-xs font-bold text-white/80"
          >
            Alle {spiele.length} ›
          </button>
        </div>
        <ul className="buehne-3d flex flex-wrap justify-center gap-x-3 gap-y-3 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:gap-x-6">
          {auswahl.map((spiel, i) => (
            <Spielkachel
              key={spiel.id}
              spiel={spiel}
              sterne={fortschritt.jeSpiel[spiel.id]?.besteSterne ?? 0}
              onSpielen={onSpielen}
              verzoegerung={280 + i * 26}
            />
          ))}
        </ul>
      </section>
    </BunterGrund>
  );
}

/**
 * Wer gerade spielt — oder die Einladung, sich anzumelden.
 *
 * Klein und oben rechts: Angemeldet zu sein ändert am Spielen nichts. Aber
 * Florian muss auf einen Blick sehen, unter welchem Namen seine Punkte
 * laufen — sonst spielt er versehentlich eine Woche lang unangemeldet.
 */
function Kontoknopf({ konto, onKonto }: { konto: Konto | null; onKonto: () => void }) {
  if (!konto) {
    return (
      <button
        type="button"
        onClick={onKonto}
        className="druckbar flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/18 px-3 text-xs font-bold text-white"
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
      className="flex min-h-9 min-w-0 shrink items-center gap-2 rounded-full px-1 text-white"
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
