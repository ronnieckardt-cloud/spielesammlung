import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import {
  DAUERN,
  bewertung,
  neuesSpiel,
  punkte,
  rest,
  stufeFuerTempo,
  takt,
  tempo,
  tippen,
} from './logik';
import type { Stufe, Zustand } from './logik';
import { TempoIcon } from './Icon';

/**
 * Tap Rush — so oft wie möglich tippen.
 *
 * Ronnis Idee, samt Farbverlauf: „Am Anfang rot, umso mehr du tippst wird's
 * grün, hellblau ist schon gut, und Regenbogen heißt übelst schnell."
 *
 * Gerechnet wird in `logik.ts`, hier steht nur die Anzeige. Das Tempo kommt
 * aus einem gleitenden Fenster über die letzten 1,2 Sekunden — die Farbe
 * reagiert dadurch sofort, ohne bei jedem einzelnen Tipp zu zappeln.
 */

/** Der Grund je Stufe. Der Regenbogen kommt aus `index.css`. */
const HINTERGRUND: Record<Exclude<Stufe, 'regenbogen'>, string> = {
  rot: 'linear-gradient(160deg, #7f1d1d 0%, #b91c1c 55%, #ef4444 100%)',
  gruen: 'linear-gradient(160deg, #14532d 0%, #15803d 55%, #4ade80 100%)',
  blau: 'linear-gradient(160deg, #0c4a6e 0%, #0284c7 55%, #7dd3fc 100%)',
};

/**
 * Die Farbe der großen Zahl — sie steigt mit, Ronnis ausdrücklicher Wunsch:
 * „der Score kann dann die Farben wechseln, umso höher man wird."
 *
 * Nicht dieselbe Farbe wie der Grund dahinter: Sonst verschwände die Zahl
 * genau dann, wenn man am schnellsten ist. Stattdessen wird sie mit jeder
 * Stufe **heller und wärmer**, und auf der höchsten selbst zum Regenbogen
 * (siehe `.tempo-zahl-regenbogen` in `index.css`).
 */
const ZAHLFARBE: Record<Exclude<Stufe, 'regenbogen'>, string> = {
  rot: '#fee2e2',
  gruen: '#fef08a',
  blau: '#ffffff',
};

/** Was in der Mitte steht, solange man tippt. */
const STUFENTEXT: Record<Stufe, string> = {
  rot: 'Schneller!',
  gruen: 'Weiter so!',
  blau: 'Sehr schnell!',
  regenbogen: 'REGENBOGEN!',
};

/** Titelbild mit der Zeitwahl — Vorlage ist der Drop-Four-Startbildschirm. */
function Startbildschirm({
  bestScore,
  onStart,
}: {
  bestScore: number;
  onStart: (dauer: number) => void;
}) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #be123c 0%, #7c2d12 45%, #1e1b4b 100%)' }}
    >
      <TempoIcon className="size-28 rounded-[2rem] shadow-2xl" />

      <div>
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Tap Rush
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Wie schnell bist du wirklich?'}
        </p>
      </div>

      <div className="w-full max-w-xs">
        <p className="mb-2 text-sm font-bold text-white/90">Wie lange?</p>
        <div className="grid grid-cols-2 gap-2.5">
          {DAUERN.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onStart(d)}
              className="rounded-2xl bg-white/95 px-4 py-4 text-xl font-black text-rose-700 shadow-xl transition-transform active:scale-95"
            >
              {d < 60 ? `${d} Sek.` : '1 Minute'}
            </button>
          ))}
        </div>
        {/* Der Satz muss sein: Ohne ihn wirkt es, als lohne sich immer die
            längste Runde. */}
        <p className="mt-3 text-xs text-white/70">
          Alle vier sind gleich viel wert — gezählt wird dein Tempo, nicht die Zeit.
        </p>
      </div>
    </div>
  );
}

/**
 * Die zuletzt gewählte Rundenlänge.
 *
 * **Modulweit, nicht im Zustand** — „Nochmal" hängt das Spiel per
 * `key={runde}` komplett neu ein. Vorher standen hier fest zehn Sekunden:
 * Wer eine Minute wählte und „Nochmal" tippte, bekam zehn Sekunden, und
 * die Auswahl war für den Rest der Sitzung weg. Gerade hier wiegt das
 * schwer — die Rundenlänge **ist** die Spielentscheidung.
 */
let zuletztGewaehlteDauer: number = DAUERN[1]!;

export function TapRush({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [dauer, setDauer] = useState<number | null>(
    istErsteRunde ? null : zuletztGewaehlteDauer,
  );
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(zuletztGewaehlteDauer));
  const gemeldet = useRef(false);

  useGameLoop((dt) => setZ((alt) => takt(alt, dt)), {
    fps: 60,
    running: dauer !== null && !z.vorbei,
  });

  /** Ein Tipp — von woher auch immer er kommt. */
  const antippen = useCallback(() => {
    setZ((alt) => {
      const neu = tippen(alt);
      if (neu !== alt) sfx('klick', Math.min(12, Math.round(tempo(neu))));
      return neu;
    });
  }, []);

  const beiZeiger = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      // Beim Berühren, nicht beim Loslassen — bei einem Tempospiel ist alles
      // andere spürbar träge, und man könnte durch Halten schummeln.
      e.preventDefault();
      antippen();
    },
    [antippen],
  );

  /**
   * Dasselbe mit der Tastatur.
   *
   * Muss sein: Ein Knopf schickt bei Leertaste und Enter von sich aus nur
   * ein `click`-Ereignis, nie ein `pointerdown` — das Feld ließ sich also
   * anfokussieren und tat dann nichts. Ein `onClick` ohne Prüfung wäre der
   * falsche Weg: Mit Maus käme jeder Tipp doppelt, weil auf `pointerdown`
   * ohnehin noch ein `click` folgt. `preventDefault` unterdrückt hier auch
   * gleich den Klick, den die Taste sonst auslösen würde — der Tipp zählt
   * also genau einmal.
   */
  const beiTaste = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      // Vor der Wiederholungsprüfung: Sonst scrollt die gehaltene Leertaste
      // die Seite, während man denkt, man tippe.
      e.preventDefault();
      // Wer die Taste hält, tippt sonst mit der Tastenwiederholung des
      // Systems — gleichmäßig schnell, ohne einen Finger zu bewegen.
      if (e.repeat) return;
      antippen();
    },
    [antippen],
  );

  /**
   * Klicks, die **nicht** von einem Zeiger kommen: Bedienhilfen wie
   * VoiceOver schicken beim Doppeltippen einen nackten `click` ohne
   * `pointerdown` und ohne `keydown` (`detail === 0`). Dieselbe Stelle wie
   * in Block Burst. Für Maus und Finger passiert hier nichts, weil deren
   * `click` immer `detail >= 1` hat — der Tipp käme sonst doppelt.
   */
  const beiKlick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) antippen();
    },
    [antippen],
  );

  useEffect(() => {
    onScore(punkte(z.tipps, z.dauer));
  }, [z.tipps, z.dauer, onScore]);

  useEffect(() => {
    if (!z.vorbei || gemeldet.current) return;
    gemeldet.current = true;
    sfx('ende');
    onGameOver(punkte(z.tipps, z.dauer));
  }, [z.vorbei, z.tipps, z.dauer, onGameOver]);

  if (dauer === null) {
    return (
      <Startbildschirm
        bestScore={bestScore}
        onStart={(gewaehlt) => {
          // Auch für das nächste „Nochmal" merken.
          zuletztGewaehlteDauer = gewaehlt;
          setDauer(gewaehlt);
          setZ(neuesSpiel(gewaehlt));
        }}
      />
    );
  }

  const jetzt = tempo(z);
  const stufe = stufeFuerTempo(jetzt);
  const restZeit = rest(z);
  const anteil = z.dauer > 0 ? restZeit / z.dauer : 0;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2">
      <div className="flex w-full items-baseline justify-between text-sm">
        <span className="font-semibold text-gedaempft tabular-nums">
          {z.laeuft ? `${restZeit.toFixed(1)} s` : `${z.dauer} s — tipp los!`}
        </span>
        <span className="text-gedaempft tabular-nums">{jetzt.toFixed(1)} pro Sekunde</span>
      </div>

      {/* Die Restzeit als Balken. Läuft von voll nach leer, ohne Blinken —
          eine Zahl allein übersieht man beim schnellen Tippen. */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-flaeche">
        <div
          className="h-full rounded-full bg-fokus"
          style={{
            width: `${(anteil * 100).toFixed(1)}%`,
            transition: settings.reducedMotion ? undefined : 'width 0.1s linear',
          }}
        />
      </div>

      <button
        type="button"
        onPointerDown={beiZeiger}
        onKeyDown={beiTaste}
        onClick={beiKlick}
        // Damit die Leertaste sofort zieht: Ohne das läge der Fokus nach der
        // Zeitwahl im Nichts, und man müsste sich erst durch die Kopfzeile
        // der Hülle tabben. Für Finger und Maus ändert sich nichts — der
        // Fokusrahmen kommt nur über `:focus-visible`.
        autoFocus
        disabled={z.vorbei}
        aria-label={`Zum Tippen, mit der Tastatur die Leertaste. ${z.tipps} Tipps, ${jetzt.toFixed(1)} pro Sekunde.`}
        className={`spielbrett-rahmen relative flex min-h-0 flex-1 touch-none flex-col items-center justify-center gap-2 select-none ${
          stufe === 'regenbogen' ? 'tempo-regenbogen' : ''
        }`}
        style={
          {
            background: stufe === 'regenbogen' ? undefined : HINTERGRUND[stufe],
            // Weicher Übergang zwischen den Stufen, damit die Farbe nicht
            // umspringt. Kein Hell-Dunkel-Wechsel, nur ein Farbwechsel.
            transition: settings.reducedMotion ? undefined : 'background 0.4s ease-out',
          } as CSSProperties
        }
      >
        <span
          className={`text-7xl leading-none font-black tabular-nums ${
            stufe === 'regenbogen' ? 'tempo-zahl-regenbogen' : ''
          }`}
          style={
            stufe === 'regenbogen'
              ? undefined
              : {
                  color: ZAHLFARBE[stufe],
                  textShadow: '0 4px 0 rgba(0,0,0,0.25), 0 12px 30px rgba(0,0,0,0.45)',
                  transition: settings.reducedMotion ? undefined : 'color 0.4s ease-out',
                }
          }
        >
          {z.tipps}
        </span>
        <span className="text-lg font-black text-white/90">
          {z.vorbei ? bewertung(stufe) : z.laeuft ? STUFENTEXT[stufe] : 'Tippen!'}
        </span>
        {/* Der Punktestand steht klein dabei — er ist nicht dasselbe wie die
            Tippzahl, und wer das nicht sieht, wundert sich am Rundenende. */}
        {z.laeuft && (
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {punkte(z.tipps, z.dauer)} Punkte
          </span>
        )}
      </button>

      <p className="nur-bei-platz text-center text-xs text-gedaempft">
        Tipp so oft du kannst. Die Uhr startet erst beim ersten Tipp. Rot heißt langsam, dann
        grün, dann hellblau — und wer richtig schnell ist, bekommt den Regenbogen.
      </p>
    </div>
  );
}
