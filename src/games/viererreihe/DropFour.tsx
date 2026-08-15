import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { SPALTEN, ZEILEN, einwerfen, einwurfZeile, neuesSpiel } from './logik';
import type { Spieler, Stufe, Zustand } from './logik';
import { besterZug } from './gegner';
import { DropFourIcon } from './Icon';

/** Wie lange der Computer „nachdenkt", bevor sein Stein fällt. */
const BEDENKZEIT_MS = 520;

const FARBE: Record<Spieler, string> = {
  0: '#38bdf8', // Mensch — kalt
  1: '#fb923c', // Computer — warm
};
const FARBE_DUNKEL: Record<Spieler, string> = { 0: '#0369a1', 1: '#c2410c' };

const NAME: Record<Spieler, string> = { 0: 'Du', 1: 'Computer' };

const STUFEN: readonly { wert: Stufe; titel: string; text: string }[] = [
  { wert: 'leicht', titel: 'Leicht', text: 'Er passt auf, aber plant nicht.' },
  { wert: 'mittel', titel: 'Mittel', text: 'Denkt zwei Züge voraus.' },
  { wert: 'schwer', titel: 'Schwer', text: 'Denkt drei Züge voraus. Viel Glück.' },
];

/**
 * Ein Spielstein.
 *
 * Mensch und Computer unterscheiden sich in **Farbe und Form** — der Mensch
 * hat einen Kreis, der Computer eine Raute. Farbe allein reicht nicht: Ein
 * Spiel, in dem man ständig „wem gehört dieser Stein?" beantworten muss,
 * wäre sonst für farbfehlsichtige Spieler kaum spielbar.
 */
function Stein({ wer, faellt, siegt, fallhoehe }: { wer: Spieler; faellt: boolean; siegt: boolean; fallhoehe: number }) {
  return (
    <span
      className={`grid size-full place-items-center rounded-full ${faellt ? 'stein-faellt' : ''} ${siegt ? 'siegerstein' : ''}`}
      style={
        {
          background: `radial-gradient(circle at 34% 28%, ${FARBE[wer]}, ${FARBE_DUNKEL[wer]})`,
          boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.4)`,
          '--fallhoehe': `${fallhoehe}%`,
        } as CSSProperties
      }
    >
      {wer === 0 ? (
        <span className="block size-1/3 rounded-full bg-white/45" />
      ) : (
        <span className="block size-1/3 rotate-45 bg-white/45" />
      )}
    </span>
  );
}

/** Titelbild — Vorlage ist der Blockblitz-Startbildschirm. */
function Startbildschirm({
  bestScore,
  onStart,
}: {
  bestScore: number;
  onStart: (stufe: Stufe) => void;
}) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #0369a1 0%, #4338ca 50%, #7c2d12 100%)' }}
    >
      <DropFourIcon className="relative size-28 rounded-[1.75rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.28), 0 10px 24px rgba(0,0,0,0.4)' }}
        >
          Drop Four
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Vier in einer Reihe — gegen den Computer.'}
        </p>
      </div>

      {/* Die Stufe wird hier gewählt und nicht im Spiel: Mitten in einer
          Partie umzuschalten würde die Punktewertung sinnlos machen. */}
      <div className="relative flex w-full max-w-xs flex-col gap-2">
        {STUFEN.map((s, i) => (
          <button
            key={s.wert}
            type="button"
            autoFocus={i === 1}
            onClick={() => onStart(s.wert)}
            className="startknopf-puls rounded-2xl bg-white px-6 py-3 text-left shadow-2xl transition-transform active:scale-95"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <span className="block text-lg font-extrabold text-sky-800">{s.titel}</span>
            <span className="block text-xs font-medium text-slate-500">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DropFour({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [stufe, setStufe] = useState<Stufe | null>(istErsteRunde ? null : 'mittel');
  const [z, setZ] = useState<Zustand>(() => neuesSpiel('mittel'));

  const beiSpalte = useCallback((x: number) => {
    // Nur wenn der Mensch am Zug ist — sonst könnte man dem Computer
    // dazwischenfunken, solange er „nachdenkt".
    setZ((alt) => (alt.amZug === 0 ? einwerfen(alt, x) : alt));
  }, []);

  // Der Computer zieht nach einer kurzen Bedenkzeit. Ohne die käme sein
  // Stein im selben Augenblick wie der eigene an, und man sähe gar nicht,
  // dass überhaupt jemand geantwortet hat.
  const zugZaehlerRef = useRef(0);
  useEffect(() => {
    if (z.vorbei || z.amZug !== 1) return;
    zugZaehlerRef.current += 1;
    const saat = zugZaehlerRef.current;
    const uhr = window.setTimeout(() => {
      setZ((alt) => {
        if (alt.vorbei || alt.amZug !== 1) return alt;
        const x = besterZug(alt.feld, 1, alt.stufe, saat);
        return x === null ? alt : einwerfen(alt, x);
      });
    }, BEDENKZEIT_MS);
    return () => window.clearTimeout(uhr);
  }, [z.amZug, z.vorbei, z.feld]);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  const vorLetzterRef = useRef(z.letzter);
  useEffect(() => {
    if (z.letzter !== vorLetzterRef.current && z.letzter) sfx('klick');
    vorLetzterRef.current = z.letzter;
  }, [z.letzter]);

  useEffect(() => {
    if (!z.vorbei) return;
    sfx(z.gewinner === 0 ? 'stufe' : 'ende');
    onGameOver(z.punkte, z.gewinner === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (stufe === null) {
    return (
      <Startbildschirm
        bestScore={bestScore}
        onStart={(gewaehlt) => {
          setStufe(gewaehlt);
          setZ(neuesSpiel(gewaehlt));
        }}
      />
    );
  }

  const siegerZellen = new Set((z.gewinnlinie ?? []).map((p) => `${p.x},${p.y}`));

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden="true"
          className="size-3 rounded-full"
          style={{ backgroundColor: FARBE[z.vorbei ? (z.gewinner ?? 0) : z.amZug] }}
        />
        <span aria-live="polite">
          {z.vorbei
            ? z.unentschieden
              ? 'Unentschieden!'
              : z.gewinner === 0
                ? 'Du hast gewonnen!'
                : 'Der Computer hat gewonnen.'
            : z.amZug === 0
              ? 'Du bist dran'
              : 'Der Computer überlegt …'}
        </span>
        <span className="text-gedaempft">· {STUFEN.find((s) => s.wert === stufe)!.titel}</span>
      </div>

      <div className="spielbuehne">
        <div
          className="spielbrett grid touch-none gap-1.5 rounded-2xl p-2"
          style={
            {
              gridTemplateColumns: `repeat(${SPALTEN}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${ZEILEN}, minmax(0, 1fr))`,
              '--vz': SPALTEN / ZEILEN,
              background: 'linear-gradient(165deg, #1e3a8a, #172554)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -3px 0 rgba(0,0,0,0.3)',
            } as CSSProperties
          }
          role="grid"
          aria-label={`Drop Four, Stufe ${stufe}. ${z.vorbei ? 'Partie beendet.' : `${NAME[z.amZug]} am Zug.`}`}
        >
          {Array.from({ length: SPALTEN * ZEILEN }, (_, i) => {
            const x = i % SPALTEN;
            const y = Math.floor(i / SPALTEN);
            const wer = z.feld[y]![x];
            const istLetzter = z.letzter?.x === x && z.letzter?.y === y;
            // Fallweg in Prozent der eigenen Höhe: von ganz oben bis hierher.
            const fallhoehe = -(y + 1) * 100 - 40;
            // Die ganze Spalte ist ein Ziel — ein Kind trifft keine
            // einzelne Zelle, es tippt irgendwo in die Spalte.
            const spalteFrei = einwurfZeile(z.feld, x) !== null;

            return (
              <button
                key={i}
                type="button"
                disabled={z.vorbei || z.amZug !== 0 || !spalteFrei}
                onClick={() => beiSpalte(x)}
                aria-label={
                  wer === null
                    ? `Spalte ${x + 1}, Reihe ${ZEILEN - y}, frei`
                    : `Spalte ${x + 1}, Reihe ${ZEILEN - y}, ${NAME[wer]}`
                }
                className="grid aspect-square place-items-center rounded-full bg-[#0b1226] p-[7%] transition-transform enabled:active:scale-95 disabled:cursor-default"
              >
                {wer !== null && (
                  <Stein
                    wer={wer}
                    faellt={istLetzter && !settings.reducedMotion}
                    siegt={siegerZellen.has(`${x},${y}`) && !settings.reducedMotion}
                    fallhoehe={fallhoehe}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Tippe eine Spalte an, dein Stein fällt nach unten. Wer zuerst vier in
        einer Reihe hat — waagerecht, senkrecht oder schräg — gewinnt.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
