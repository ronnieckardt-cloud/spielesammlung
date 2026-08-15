import type { GameApi } from '../core/types';
import { spiele } from '../core/registry';
import { bestwert, fortschrittLesen, zuletztGespielt } from './speicher';
import { heute, stufeAus } from './fortschritt';
import {
  istGeschafft,
  standFuer,
  standFuerHeute,
  tagesaufgaben,
  type Aufgabe,
  type Tagesstand,
} from './herausforderungen';
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

/**
 * Die Wortmarke „FLOW GAMES".
 *
 * **Bewusst nicht die große `.wortmarke`-Maschinerie aus der Startseite von
 * früher.** Die baut ihre Räumlichkeit aus gestapelten Schatten, und deren
 * Kommentar sagt es selbst: Unter etwa 20 Pixeln Schriftgröße wird die
 * Extrusion ein bis zwei Pixel hoch und liest sich als schmutzige Kante.
 * Hier steht die Marke klein in einer Zeile mit dem Kontoknopf — also eine
 * eigene, flache Lösung.
 *
 * „FLOW" trägt den Farbverlauf, „GAMES" steht ruhig daneben. Ein Wortpaar,
 * bei dem **beide** Teile leuchten, hat keine Betonung mehr; so hat es
 * einen Anfang, den das Auge zuerst trifft.
 */
function Wortmarke() {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5" aria-label="Flow Games">
      <span
        aria-hidden="true"
        className="text-base font-black tracking-tight"
        style={{
          background: 'linear-gradient(100deg, #ffd23c, #ff9f45 45%, #ff5d8f)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          // Kein `text-shadow` an eingeclipptem Text — der wird hinter der
          // durchsichtigen Füllung gezeichnet und scheint hindurch. Dieselbe
          // Falle wie bei Tap Rush und der alten Wortmarke.
          filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.45))',
        }}
      >
        FLOW
      </span>
      <span
        aria-hidden="true"
        className="text-[13px] font-black tracking-[0.18em] text-white/75 uppercase"
      >
        Games
      </span>
    </span>
  );
}

/**
 * Der Einstieg nach Florianville.
 *
 * Steht **über** der Weiterspielen-Karte und ist die größte Fläche der
 * Seite. Das Abenteuer ist kein einundzwanzigstes Spiel in der Reihe,
 * sondern ein eigener Ort — es gehört nicht ins Kachelregal, sondern davor.
 */
function Abenteuerkarte({ onOeffnen }: { onOeffnen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      className="druckbar rein-von-unten relative w-full overflow-hidden rounded-3xl border border-white/25 p-4 text-left"
      style={{
        animationDelay: '40ms',
        background: 'linear-gradient(135deg, #1d7fd4 0%, #47b96a 55%, #f2c14e 100%)',
      }}
    >
      {/* Ein paar Dächer als Silhouette — sie machen aus einem Farbverlauf
          eine Stadt, und zwar mit sechs Rechtecken. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12">
        {[6, 22, 38, 56, 72, 88].map((links, i) => (
          <span
            key={links}
            className="absolute bottom-0 block rounded-t-sm bg-black/25"
            style={{ left: `${links}%`, width: 26, height: 16 + ((i * 13) % 26) }}
          />
        ))}
      </span>

      <span className="relative block text-[11px] font-black tracking-[0.2em] text-white/80 uppercase">
        Neu · Abenteuer
      </span>
      <span className="relative mt-0.5 block text-2xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
        Florianville
      </span>
      <span className="relative mt-0.5 block text-sm text-white/90">
        Lauf durch den Ahornweg und finde alle Sterne.
      </span>
    </button>
  );
}

export function StartSeite({
  konto,
  onSpielen,
  onAlleSpiele,
  onAbenteuer,
  onKonto,
}: {
  konto: Konto | null;
  onSpielen: (id: string) => void;
  onAlleSpiele: () => void;
  onAbenteuer: () => void;
  onKonto: () => void;
}) {
  // Frisch bei jedem Rendern gelesen. Beim Zurückkommen aus einem Spiel wird
  // die Seite ohnehin neu aufgebaut, es braucht dafür keinen eigenen Zustand.
  const fortschritt = fortschrittLesen();
  const stand = stufeAus(fortschritt.xp);
  const zuletzt = zuletztGespielt();
  const weiter = spiele.find((s) => s.id === zuletzt);

  /*
   * Die drei Tagesaufgaben. Sie stehen hier statt der nächsten Erfolge:
   * Ein Erfolg wie „100 Runden gespielt" ist wochenlang dieselbe Zeile und
   * damit kein Ziel für *heute*. Die gesammelten Erfolge stehen auf der
   * Fortschrittsseite, dort gehören sie hin.
   */
  const tag = heute();
  const aufgaben = tagesaufgaben(tag, spiele);
  const tagesstand = standFuerHeute(fortschritt.tages, tag);
  const offen = aufgaben.filter((a) => !istGeschafft(tagesstand, a)).length;

  /*
   * Acht Kacheln auf der Startseite: zuerst das zuletzt Gespielte, dann der
   * Rest in fester Reihenfolge. Die feste Ordnung ist Absicht — ein Kind
   * lernt „Snake Rush ist das grüne", und ein Raster, das sich ständig
   * umsortiert, nimmt genau diese Sicherheit weg.
   */
  /*
   * **Auf dem Handy acht, auf dem Tablet alle.**
   *
   * Auf einem 375er-iPhone sind acht Kacheln zwei volle Reihen und der
   * Rest gehört hinter „Alle 20". Auf einem iPad im Hochformat blieb mit
   * derselben Zahl die untere Hälfte der Seite leer — und eine halbleere
   * Seite wirkt nicht großzügig, sondern unfertig. Dort ist Platz für das
   * ganze Regal, und es füllt genau die Höhe, die sonst tot wäre.
   *
   * Die Kacheln ab der neunten tragen `nurBreit` und sind auf dem Handy
   * ausgeblendet — eine Regel im CSS statt einer Abfrage in JavaScript,
   * damit beim Drehen des Geräts nichts nachgerechnet werden muss.
   */
  const auswahl = [...(weiter ? [weiter] : []), ...spiele.filter((s) => s.id !== weiter?.id)];

  return (
    <BunterGrund>
      <header className="rein-von-oben mb-4">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
          <Wortmarke />
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

      {/*
       * Ab Tablet **zwei Spalten**.
       *
       * Auf dem iPad im Hochformat stand vorher alles untereinander: oben
       * gedrängt, das untere Drittel leer. Ein Handy-Layout auf einer
       * doppelt so hohen Fläche wirkt nicht großzügig, sondern unfertig —
       * dieselbe Regel wie umgekehrt, nur in die andere Richtung.
       *
       * Links die Dinge, die man *tut* (Abenteuer, Weiterspielen), rechts
       * die Dinge, die man *anschaut* (Ziele, Spieleregal). Die Reihenfolge
       * im Markup bleibt die des Handys — ein Vorleseprogramm und die
       * Tastatur laufen also weiter von oben nach unten in der Reihenfolge
       * der Wichtigkeit.
       */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-start md:gap-5">
        <div className="md:flex md:flex-col md:gap-3">
          <div className="mb-3 md:mb-0">
            <Abenteuerkarte onOeffnen={onAbenteuer} />
          </div>

          {weiter && <Weiterkarte spiel={weiter} onSpielen={onSpielen} />}

          <section
            className="rein-von-unten mt-4 md:mt-0"
            style={{ animationDelay: '180ms' }}
            aria-labelledby="ziele-titel"
          >
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 id="ziele-titel" className="text-sm font-black text-white/85">
                Heute zu holen
              </h2>
              <span className="text-xs font-bold text-white/70">
                {offen === 0 ? '✓ alle geschafft' : `noch ${offen} von ${aufgaben.length}`}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {aufgaben.map((a) => (
                <Aufgabenzeile key={a.id} aufgabe={a} stand={tagesstand} />
              ))}
            </ul>
          </section>
        </div>

        <section
          className="rein-von-unten mt-4 md:mt-0"
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
                nurBreit={i >= 8}
              />
            ))}
          </ul>
        </section>
      </div>
    </BunterGrund>
  );
}

/**
 * Eine Tagesaufgabe mit ihrem Stand.
 *
 * **Der Balken ist der Punkt.** „Spiele 4 Runden" allein ist eine
 * Anweisung; „Spiele 4 Runden — 3 von 4" ist ein Ziel, das man fast hat.
 * Genau dieser Unterschied bringt die vierte Runde.
 *
 * Geschaffte Aufgaben verschwinden nicht, sie werden grün abgehakt. Was
 * verschwindet, wirkt, als hätte man es sich eingebildet — und die Liste
 * wäre am Abend leer statt voller Häkchen.
 */
function Aufgabenzeile({ aufgabe, stand }: { aufgabe: Aufgabe; stand: Tagesstand }) {
  const jetzt = Math.min(aufgabe.ziel, standFuer(stand, aufgabe));
  const fertig = jetzt >= aufgabe.ziel;

  return (
    <li
      className="flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 backdrop-blur-sm"
      style={{
        borderColor: fertig
          ? 'color-mix(in oklab, var(--color-erfolg) 45%, transparent)'
          : 'rgb(255 255 255 / 0.15)',
        background: fertig
          ? 'color-mix(in oklab, var(--color-erfolg) 14%, rgb(255 255 255 / 0.08))'
          : 'rgb(255 255 255 / 0.1)',
      }}
    >
      <span aria-hidden="true" className={fertig ? 'text-2xl' : 'text-2xl opacity-70'}>
        {aufgabe.symbol}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-bold text-white">{aufgabe.text}</span>
          <span className="shrink-0 text-xs font-bold text-white/70 tabular-nums">
            {jetzt}/{aufgabe.ziel}
          </span>
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/30">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.round((jetzt / aufgabe.ziel) * 100)}%`,
              background: fertig
                ? 'var(--color-erfolg)'
                : 'linear-gradient(90deg, var(--color-xp), var(--color-fokus))',
              transition: 'width var(--zeit-lang) var(--kurve)',
            }}
          />
        </span>
      </span>

      {/* **Nicht** `--color-xp` hier. Das Violett ist im Rundenende richtig
          (dunkler Grund, sonst nichts Violettes im Bild) — auf der
          Startseite ist der Hintergrund *selbst* violett, und die Zahl
          verschwindet darin fast. Eine Farbe, die an einer Stelle Bedeutung
          trägt, muss an einer anderen trotzdem lesbar bleiben; im Zweifel
          gewinnt die Lesbarkeit. */}
      <span className="shrink-0 text-sm font-black text-white/85">
        {fertig ? (
          <>
            <span aria-hidden="true" style={{ color: 'var(--color-erfolg)' }}>
              ✓
            </span>
            <span className="sr-only">geschafft</span>
          </>
        ) : (
          `+${aufgabe.xp}`
        )}
      </span>
    </li>
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
