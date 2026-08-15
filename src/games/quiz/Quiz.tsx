import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { antwortWaehlen, naechsteFrage, neuesLevel } from './logik';
import type { Zustand } from './logik';
import { QuizIcon } from './Icon';

const RICHTIG_FARBE = '#22c55e';
const FALSCH_FARBE = '#ef4444';

/**
 * Welches Level als Nächstes drankommt — wie beim Farbsortierer eine
 * Modul-Variable, weil "Nochmal" die Komponente komplett neu mountet.
 */
let naechsteLevelNummer = 1;

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

export function Quiz({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" (= nächstes Level) direkt weiterspielen statt wieder
  // über den Startbildschirm zu gehen — der gehört nur ans Betreten.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(naechsteLevelNummer));

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx(z.richtigeAnzahl === z.fragen.length ? 'stufe' : 'ende');
      naechsteLevelNummer = z.level + 1;
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const beiAntwort = useCallback((index: 0 | 1 | 2 | 3) => {
    setZ((alt) => {
      const frage = alt.fragen[alt.index];
      const nach = antwortWaehlen(alt, index);
      if (nach !== alt && frage) sfx(index === frage.richtig ? 'gut' : 'schlecht');
      return nach;
    });
  }, []);

  const beiWeiter = useCallback(() => setZ((alt) => naechsteFrage(alt)), []);

  const beiLevelWechsel = useCallback((neu: number) => {
    const geklemmt = Math.max(1, neu);
    naechsteLevelNummer = geklemmt;
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
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4">
      <div className="flex w-full max-w-md items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1}
            aria-label="Voriges Level"
            className="rounded-lg border border-rand bg-flaeche spielknopf px-2 py-1 text-base leading-none disabled:opacity-30"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            aria-label="Nächstes Level"
            className="rounded-lg border border-rand bg-flaeche spielknopf px-2 py-1 text-base leading-none"
          >
            ›
          </button>
        </div>
        <span className="text-gedaempft">
          Frage {z.index + 1} / {z.fragen.length}
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

      <div className="w-full max-w-md rounded-karte border border-rand bg-flaeche p-5">
        <span className="text-xs font-medium tracking-wide text-gedaempft uppercase">
          {frage.kategorie}
        </span>
        <p className="mt-2 text-lg font-semibold">{frage.frage}</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        {frage.antworten.map((antwort, i) => {
          const istAusgewaehlt = z.ausgewaehlt === i;
          const istRichtigeAntwort = i === frage.richtig;

          let rahmenfarbe: string | undefined;
          let hintergrund: string | undefined;
          let deckkraft: number | undefined;
          if (beantwortet && istRichtigeAntwort) {
            rahmenfarbe = RICHTIG_FARBE;
            hintergrund = `${RICHTIG_FARBE}26`;
          } else if (beantwortet && istAusgewaehlt) {
            rahmenfarbe = FALSCH_FARBE;
            hintergrund = `${FALSCH_FARBE}26`;
          } else if (beantwortet) {
            deckkraft = 0.5;
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => beiAntwort(i as 0 | 1 | 2 | 3)}
              disabled={beantwortet}
              className="rounded-xl border border-rand bg-flaeche p-4 text-left transition-colors disabled:cursor-default"
              style={{ borderColor: rahmenfarbe, backgroundColor: hintergrund, opacity: deckkraft }}
            >
              {antwort}
              {beantwortet && istRichtigeAntwort && (
                <span aria-hidden="true" className="ml-2">
                  ✓
                </span>
              )}
              {beantwortet && istAusgewaehlt && !istRichtigeAntwort && (
                <span aria-hidden="true" className="ml-2">
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

      {beantwortet && !z.vorbei && (
        <button
          type="button"
          onClick={beiWeiter}
          autoFocus
          className="rounded-lg px-6 py-3 font-semibold text-grund"
          style={{ backgroundColor: 'var(--color-fokus)' }}
        >
          Weiter
        </button>
      )}

      <p className="text-sm text-gedaempft">Richtig beantwortet: {z.richtigeAnzahl}</p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
