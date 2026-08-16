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

/**
 * Die zuletzt gewählte Stufe.
 *
 * **Modulweit, nicht im Zustand** — „Nochmal" hängt das Spiel per
 * `key={runde}` komplett neu ein, jeder Zustand darin ist danach weg.
 * Vorher stand hier fest `'mittel'`: Wer auf „Schwer" spielte und
 * „Nochmal" tippte, saß wieder auf Mittel, und die Stufenwahl war für
 * den Rest der Sitzung unerreichbar. Dieselbe Lösung wie in Even Cut und
 * Flow Link, wo sie sich bewährt hat.
 */
let zuletztGewaehlteStufe: Stufe = 'mittel';

export function DropFour({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [stufe, setStufe] = useState<Stufe | null>(
    istErsteRunde ? null : zuletztGewaehlteStufe,
  );
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(zuletztGewaehlteStufe));

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
          // Auch für das nächste „Nochmal" merken.
          zuletztGewaehlteStufe = gewaehlt;
          setStufe(gewaehlt);
          setZ(neuesSpiel(gewaehlt));
        }}
      />
    );
  }

  const siegerZellen = new Set((z.gewinnlinie ?? []).map((p) => `${p.x},${p.y}`));
  const stufenTitel = STUFEN.find((s) => s.wert === stufe)!.titel;
  // Umstellen nur, solange noch kein Stein liegt. Mitten in der Partie
  // wäre die Wertung sinnlos — direkt nach „Nochmal" ist es dagegen genau
  // der Moment, in dem man die Stufe wechseln will.
  const darfStufeWechseln = z.zuege === 0 && !z.vorbei;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      {/* Feste Mindesthöhe: Der Stufenknopf verschwindet nach dem ersten
          Stein, und ohne sie würde das Brett in diesem Moment springen. */}
      <div className="flex min-h-11 items-center gap-2 text-sm font-semibold">
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
        {darfStufeWechseln ? (
          <button
            type="button"
            // Zurück auf den Startbildschirm: Dort steht die Stufenwahl
            // schon, samt Erklärung, was die drei Stufen unterscheidet.
            onClick={() => setStufe(null)}
            className="spielknopf text-xs"
            aria-label={`Stufe ändern, gerade ${stufenTitel}`}
          >
            Stufe: {stufenTitel}
          </button>
        ) : (
          <span className="text-gedaempft">· {stufenTitel}</span>
        )}
      </div>

      <div className="spielbuehne">
        {/*
          Eine Spalte ist **ein** Knopf über die ganze Bretthöhe, die Löcher
          darin sind nur noch Anzeige. Vorher war jedes der 42 Löcher ein
          eigener Knopf: Auf einem 375 Pixel breiten iPhone war ein Loch
          damit rund 42 Pixel breit — unter Apples Mindestmaß — und
          zwischen zwei Spalten lagen 6 Pixel, auf denen ein Tipp gar
          nichts auslöste, ohne jede Rückmeldung.

          Deshalb liegt der Spaltenabstand jetzt **innen** im Knopf
          (`p-[3px]`) statt als `gap` zwischen den Knöpfen: Optisch ändert
          sich nichts, aber die Spaltenknöpfe stoßen lückenlos aneinander
          und sind rund 48 Pixel breit. Nebenbei sind es sieben statt 42
          Anlaufpunkte für die Tabulatortaste.
        */}
        <div
          className="spielbrett grid touch-none rounded-2xl p-2"
          style={
            {
              gridTemplateColumns: `repeat(${SPALTEN}, minmax(0, 1fr))`,
              gridTemplateRows: 'minmax(0, 1fr)',
              '--vz': SPALTEN / ZEILEN,
              background: 'linear-gradient(165deg, #1e3a8a, #172554)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -3px 0 rgba(0,0,0,0.3)',
            } as CSSProperties
          }
          role="group"
          aria-label={`Drop Four, Stufe ${stufenTitel}. ${z.vorbei ? 'Partie beendet.' : `${NAME[z.amZug]} am Zug.`}`}
        >
          {Array.from({ length: SPALTEN }, (_, x) => {
            const landung = einwurfZeile(z.feld, x);
            const spielbar = !z.vorbei && z.amZug === 0 && landung !== null;
            // Von unten nach oben vorlesen — so, wie die Steine liegen.
            const belegung = Array.from({ length: ZEILEN }, (_, y) => z.feld[ZEILEN - 1 - y]![x])
              .filter((wer): wer is Spieler => wer !== null)
              .map((wer) => NAME[wer]);

            return (
              <button
                key={x}
                type="button"
                disabled={!spielbar}
                onClick={() => beiSpalte(x)}
                aria-label={
                  landung === null
                    ? `Spalte ${x + 1} ist voll`
                    : `Spalte ${x + 1}, ${
                        belegung.length === 0 ? 'leer' : `von unten: ${belegung.join(', ')}`
                      }`
                }
                className="group flex flex-col gap-1.5 rounded-2xl p-[3px] transition-colors disabled:cursor-default enabled:active:bg-white/10"
              >
                {Array.from({ length: ZEILEN }, (_, y) => {
                  const wer = z.feld[y]![x];
                  const istLetzter = z.letzter?.x === x && z.letzter?.y === y;
                  // Fallweg in Prozent der eigenen Höhe: von ganz oben bis hierher.
                  const fallhoehe = -(y + 1) * 100 - 40;

                  return (
                    <span
                      key={y}
                      className="grid min-h-0 flex-1 place-items-center rounded-full bg-[#0b1226] p-[7%]"
                    >
                      {wer !== null ? (
                        <Stein
                          wer={wer}
                          faellt={istLetzter && !settings.reducedMotion}
                          siegt={siegerZellen.has(`${x},${y}`) && !settings.reducedMotion}
                          fallhoehe={fallhoehe}
                        />
                      ) : (
                        // Schattenstein im Zielloch: zeigt vor dem Loslassen,
                        // wo der Stein landet. Er hängt an der Spalte, nicht
                        // am Loch — angetippt wird ja die ganze Spalte.
                        spielbar &&
                        y === landung && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none block size-full rounded-full opacity-0 transition-opacity group-hover:opacity-40 group-focus-visible:opacity-40 group-active:opacity-70"
                            style={{
                              background: `radial-gradient(circle at 34% 28%, ${FARBE[0]}, ${FARBE_DUNKEL[0]})`,
                            }}
                          />
                        )
                      )}
                    </span>
                  );
                })}
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
