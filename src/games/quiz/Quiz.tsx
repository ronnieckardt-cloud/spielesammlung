import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { sfx } from '../../core/sfx';
import { levelstand } from '../../core/levelstand';
import { haptik } from '../../core/haptik';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import type { GameProps } from '../../core/types';
import { antwortWaehlen, naechsteFrage, neuesLevel } from './logik';
import type { Zustand } from './logik';
import { QuizIcon } from './Icon';

const RICHTIG_FARBE = '#22c55e';
const FALSCH_FARBE = '#ef4444';

/** Ab hier ist es eine Serie — eine einzelne richtige Antwort noch nicht. */
const SERIE_AB = 2;

/**
 * Feste Kennung je Antwortplatz — dieselben vier Farben wie im App-Symbol
 * (`Icon.tsx`), damit das Spielfeld hält, was die Kachel verspricht: vier
 * bunte Antwortfelder statt vier gleicher grauer Karten.
 *
 * Die Information trägt immer der **Buchstabe**, nicht die Farbe. Wer die
 * Farben nicht unterscheiden kann, verliert dadurch nichts (Projektregel
 * „Farbe nie als einziges Unterscheidungsmerkmal").
 */
const ANTWORT_KENNUNG: readonly { buchstabe: string; farbe: string }[] = [
  { buchstabe: 'A', farbe: '#f87171' },
  { buchstabe: 'B', farbe: '#60a5fa' },
  { buchstabe: 'C', farbe: '#facc15' },
  { buchstabe: 'D', farbe: '#4ade80' },
];

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

/**
 * Schwebende geometrische Formen im Hintergrund des Startbildschirms —
 * angelehnt an typische Quiz-Apps (bunte Kreise, Dreiecke, Quadrate), rein
 * dekorativ. Feste Liste, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
const DEKO_FORMEN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  winkel: number;
  verzoegerung: number;
  dreieck?: boolean;
}[] = [
  { x: 9, y: 12, groesse: 26, farbe: '#ef4444', winkel: 0, verzoegerung: 0, dreieck: true },
  { x: 87, y: 14, groesse: 22, farbe: '#facc15', winkel: 0, verzoegerung: 0.6 },
  { x: 80, y: 78, groesse: 20, farbe: '#3b82f6', winkel: 45, verzoegerung: 1.1 },
  { x: 9, y: 80, groesse: 30, farbe: '#22c55e', winkel: 0, verzoegerung: 0.3, dreieck: true },
  { x: 92, y: 46, groesse: 16, farbe: '#facc15', winkel: 45, verzoegerung: 1.6 },
  { x: 4, y: 48, groesse: 18, farbe: '#ef4444', winkel: 0, verzoegerung: 0.9 },
];

/**
 * Titelbild angelehnt an typische Quiz-Apps — kräftiger Blau-Lila-Verlauf,
 * bunte geometrische Formen, große runde Schrift. Eigene Gestaltung, siehe
 * Blockblitz-Startbildschirm für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_FORMEN.map((f, i) => (
          <span
            key={i}
            className={`block-schweben absolute opacity-90 ${f.dreieck ? '' : 'rounded-md'}`}
            style={
              {
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: f.groesse,
                height: f.groesse,
                backgroundColor: f.farbe,
                clipPath: f.dreieck ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
                animationDelay: `${f.verzoegerung}s`,
                '--grundwinkel': `${f.winkel}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <QuizIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Quiz Time
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Bereit für ein paar Fragen?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-violet-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

/**
 * Die laufende Serie als kleines Abzeichen oben rechts in der Frage-Karte.
 *
 * Der Serien-Bonus ist die einzige Punktmechanik des Spiels und war bisher
 * nirgends zu sehen. Bewusst **nicht** das `Komboherz` aus `core/`: Das ist
 * 86 Pixel hoch und lebt davon, sich über eine freie Brettecke zu hängen —
 * hier trägt jede Fläche unter der Kopfzeile Text, den man lesen muss, und
 * genau darüber läge das Herz. Die Zeile mit der Kategorie ist dagegen rechts
 * leer, das Abzeichen kostet dort keine einzige Zeile Höhe.
 *
 * Immer im Baum, nur unsichtbar — sonst springt die Frage jedes Mal um ein
 * paar Pixel, wenn eine Serie anfängt oder abreißt.
 */
function Serienanzeige({ serie }: { serie: number }) {
  const sichtbar = serie >= SERIE_AB;
  return (
    <span
      aria-hidden={!sichtbar}
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black whitespace-nowrap transition-opacity duration-200 ${
        sichtbar ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: `${RICHTIG_FARBE}26`, color: RICHTIG_FARBE }}
    >
      {/* Der Schlüssel lässt die Zahl bei jeder Stufe kurz aufploppen — wie
          die Kombo-Zahl in Block Burst. */}
      <span key={serie} className="punkte-bumsen inline-block">
        <span aria-hidden="true">🔥 </span>Serie ×{Math.max(SERIE_AB, serie)}
      </span>
    </span>
  );
}

export function Quiz({
  onScore,
  onGameOver,
  settings,
  bestScore,
  istErsteRunde,
  level: festesLevel,
  startLevel,
  onLevel,
}: GameProps) {
  /*
   * Setzt den Sitzungsstand **und** meldet ihn der Hülle, die ihn ablegt.
   * Vorher stand hier nur die Zuweisung an eine Modul-Variable — die war
   * beim Schließen der App weg, und Florian fing jedes Mal bei Level 1 an.
   *
   * Im Duell (`festesLevel` gesetzt) ruft die Hülle nichts auf: Ein
   * vorgegebenes Level ist kein Fortschritt und darf den echten Stand
   * nicht überschreiben.
   */
  const meldeLevel = (n: number) => {
    levelStand.setzen(n);
    onLevel?.(n);
  };
  // Nach „Nochmal" (= nächstes Level) direkt weiterspielen statt wieder
  // über den Startbildschirm zu gehen — der gehört nur ans Betreten.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(festesLevel ?? levelStand.anfang(startLevel)));

  // Der Serien-Bonus war die einzige Punktmechanik des Spiels und blieb
  // komplett unsichtbar. Schwelle 1, weil hier jede richtige Antwort zählt —
  // anders als in Ghost Chase gibt es keinen Kleinkram, der wegzufiltern wäre.
  const gewinn = usePunktegewinn(z.punkte, 1);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      const perfekt = z.richtigeAnzahl === z.fragen.length;
      sfx(perfekt ? 'stufe' : 'ende');
      haptik(perfekt ? 'jubel' : 'ende');
      if (festesLevel === undefined) meldeLevel(z.level + 1);
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const beiAntwort = useCallback((index: 0 | 1 | 2 | 3) => {
    setZ((alt) => {
      const frage = alt.fragen[alt.index];
      const nach = antwortWaehlen(alt, index);
      if (nach !== alt && frage) {
        // Der Ton steigt mit der Serie — dieselbe Idee wie die
        // Halbton-Hebung in Block Burst: Man hört, dass gerade etwas läuft,
        // noch bevor man die Zahl gelesen hat. `sfx` deckelt selbst bei 12.
        if (index === frage.richtig) sfx('gut', (nach.serie - 1) * 2);
        else sfx('schlecht');
      }
      return nach;
    });
  }, []);

  const beiWeiter = useCallback(() => setZ((alt) => naechsteFrage(alt)), []);

  const beiLevelWechsel = useCallback((neu: number) => {
    // Im Duell steht das Level fest — sonst könnte man sich das
    // leichteste aussuchen und der Vergleich wäre wertlos.
    if (festesLevel !== undefined) return;
    const geklemmt = Math.max(1, neu);
    meldeLevel(geklemmt);
    setZ(neuesLevel(geklemmt));
  }, []);

  const frage = z.fragen[z.index];
  if (!frage) return null;

  const beantwortet = z.ausgewaehlt !== null;

  if (!gestartet) {
    return (
      <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />
    );
  }

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1 || festesLevel !== undefined}
            aria-label="Voriges Level"
            className="spielknopf text-base leading-none"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            disabled={festesLevel !== undefined}
            aria-label="Nächstes Level"
            className="spielknopf text-base leading-none"
          >
            ›
          </button>
        </div>
        <span className="text-gedaempft">
          {z.index + 1}/{z.fragen.length} · richtig {z.richtigeAnzahl}
        </span>
      </div>

      <div
        className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-flaeche-hoch"
        role="progressbar"
        aria-label="Fortschritt in dieser Runde"
        aria-valuemin={0}
        aria-valuemax={z.fragen.length}
        aria-valuenow={z.index}
      >
        <div
          className="h-full rounded-full bg-fokus transition-[width] duration-200"
          style={{ width: `${(z.index / z.fragen.length) * 100}%` }}
        />
      </div>

      {/* Nur dieser Teil scrollt, wenn eine Frage lang ist — der
          Weiter-Knopf darunter bleibt dadurch immer erreichbar. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto">
      <div className="w-full max-w-md rounded-karte border border-rand bg-flaeche p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium tracking-wide text-gedaempft uppercase">
            {frage.kategorie}
          </span>
          <Serienanzeige serie={z.serie} />
        </div>
        <p className="mt-2 text-lg font-semibold">{frage.frage}</p>
      </div>

      {/* Der Behälter mit `relative` ist Absicht: Das „+N" liegt als Aufsatz
          über den Antworten und kostet dadurch keine Höhe — auf einem kleinen
          Handy scrollt hier ohnehin schon alles knapp. */}
      <div className="relative grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <Punktegewinn gewinn={gewinn} />
        {frage.antworten.map((antwort, i) => {
          const istAusgewaehlt = z.ausgewaehlt === i;
          const istRichtigeAntwort = i === frage.richtig;

          let rahmenfarbe: string | undefined;
          let hintergrund: string | undefined;
          let deckkraft: number | undefined;
          // Die richtige Antwort ploppt immer auf, auch wenn danebengetippt
          // wurde — sie ist die Antwort, die man sich merken soll. Gewackelt
          // wird nur bei der tatsächlich angetippten falschen.
          let bewegung = '';
          if (beantwortet && istRichtigeAntwort) {
            rahmenfarbe = RICHTIG_FARBE;
            hintergrund = `${RICHTIG_FARBE}26`;
            bewegung = 'antwort-richtig';
          } else if (beantwortet && istAusgewaehlt) {
            rahmenfarbe = FALSCH_FARBE;
            hintergrund = `${FALSCH_FARBE}26`;
            bewegung = 'antwort-falsch';
          } else if (beantwortet) {
            deckkraft = 0.5;
          }

          const kennung = ANTWORT_KENNUNG[i]!;

          return (
            <button
              key={i}
              type="button"
              onClick={() => beiAntwort(i as 0 | 1 | 2 | 3)}
              disabled={beantwortet}
              // Antipp-Reaktion wie bei `.spielknopf`: 5 % kleiner, 100 ms.
              // Die Klasse selbst passt hier nicht (eigene Ecken,
              // Innenabstände, `inline-flex`), ihr Verhalten schon — genau
              // wie in `gehirnjogging/ZahlAntworten.tsx`. Die Übergänge
              // stehen einzeln statt als `transition-colors
              // transition-transform`, weil beide Kurzformen dieselbe
              // CSS-Eigenschaft setzen und dann nur eine von beiden gälte.
              // `enabled:` hört nach der Antwort auf und kommt so
              // `antwort-richtig` nicht in die Quere, das `scale` bewegt.
              className={`flex items-center gap-3 rounded-xl border border-rand bg-flaeche p-4 text-left transition-[background-color,border-color,opacity] duration-100 enabled:active:scale-95 disabled:cursor-default ${bewegung}`}
              style={{ borderColor: rahmenfarbe, backgroundColor: hintergrund, opacity: deckkraft }}
            >
              {/* Nur fürs Auge: Der Screenreader liest die Antwort selbst
                  vor, ein vorgelesenes „A" davor wäre reiner Ballast. */}
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full text-sm font-black text-grund"
                style={{ backgroundColor: kennung.farbe }}
              >
                {kennung.buchstabe}
              </span>
              <span className="min-w-0 flex-1">{antwort}</span>
              {beantwortet && istRichtigeAntwort && (
                <span aria-hidden="true" className="shrink-0">
                  ✓
                </span>
              )}
              {beantwortet && istAusgewaehlt && !istRichtigeAntwort && (
                <span aria-hidden="true" className="shrink-0">
                  ✗
                </span>
              )}
            </button>
          );
        })}
      </div>

      {beantwortet && (
        <div className="w-full max-w-md rounded-karte border border-rand bg-flaeche-hoch p-4 text-sm">
          <span aria-hidden="true">💡</span> {frage.erklaerung}
        </div>
      )}

      </div>

      {beantwortet && !z.vorbei && (
        <button
          type="button"
          onClick={beiWeiter}
          autoFocus
          className="spielknopf spielknopf-gross text-grund"
          style={{ backgroundColor: 'var(--color-fokus)' }}
        >
          Weiter
        </button>
      )}

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
