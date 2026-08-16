import { useCallback, useEffect, useRef, useState } from 'react';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { useGameLoop } from '../../core/useGameLoop';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import type { GameProps } from '../../core/types';
import { STRECKE_LAENGE, neuesSpiel, punkte, streckenSaat, takt, tempoKmh } from './logik';
import type { Eingabe, Lauf } from './logik';
import type { Zeichner } from './zeichnen';
import { zeichnerBauen } from './zeichnen';
import { MtbIcon } from './Icon';

/**
 * Flow MTB — ein physikbasiertes 2-D-Mountainbike-Spiel.
 *
 * Ronnis Vorgabe: „Speed + Airtime + Control + Landing … leicht zu
 * verstehen, aber schwer zu meistern." Diese Datei verbindet nur Eingabe,
 * Uhr und Anzeige: Die Fahrphysik steht in `logik.ts` (ohne Browser
 * geprüft), gezeichnet wird in `zeichnen.ts` (kennt keine Regel).
 *
 * **Der Zustand liegt in einer Ref, nicht in `useState`.** Bei sechzig
 * Bildern je Sekunde hieße ein `setState` je Bild, sechzigmal je Sekunde
 * den React-Baum durchzurechnen, während daneben gezeichnet wird — genau
 * das macht ein Spiel ruckelig. Nach außen (`onScore`) geht der Stand nur
 * zweimal je Sekunde; die Anzeigen im Bild werden direkt ins DOM
 * geschrieben. Dasselbe Vorgehen wie bei Dash City.
 */

const DEKO: readonly DekoTeil[] = [
  { x: 10, y: 22, winkel: -8, verzoegerung: 0, inhalt: <DekoBerg hoehe={54} /> },
  { x: 86, y: 16, winkel: 6, verzoegerung: 0.6, inhalt: <DekoBerg hoehe={70} /> },
  { x: 88, y: 70, winkel: -5, verzoegerung: 1.2, inhalt: <DekoBerg hoehe={44} /> },
  { x: 7, y: 74, winkel: 7, verzoegerung: 0.35, inhalt: <DekoBerg hoehe={60} /> },
];

function DekoBerg({ hoehe }: { hoehe: number }) {
  return (
    <svg viewBox="0 0 40 40" className="w-10" style={{ height: hoehe }}>
      <path d="M20 4 L38 38 L2 38 Z" fill="#1e3a54" opacity={0.85} />
      <path d="M20 4 L27 17 L13 17 Z" fill="#e2f0f7" opacity={0.9} />
    </svg>
  );
}

export function FlowMtb({
  onScore,
  onGameOver,
  bestScore,
  istErsteRunde,
  settings,
}: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [zeigeHinweis, setZeigeHinweis] = useState(true);

  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const zeichnerRef = useRef<Zeichner | null>(null);

  /**
   * Der Lauf entsteht **beim ersten Zugriff**, nicht bei jedem Rendern —
   * `useRef(neuesSpiel(…))` würde sein Argument bei jedem Rendern auswerten
   * und das Ergebnis wegwerfen, und `neuesSpiel` baut ein komplettes
   * Gelände. Dieselbe Falle wie in Dash City.
   */
  const laufRef = useRef<Lauf | null>(null);
  const holeLauf = useCallback(() => {
    if (!laufRef.current) {
      // Jede Runde eine andere Strecke, aber innerhalb der Runde fest.
      laufRef.current = neuesSpiel(streckenSaat(Date.now() % 100000));
    }
    return laufRef.current;
  }, []);

  /** Die Eingaben. Auch in einer Ref — sie ändern sich mehrmals je Sekunde. */
  const eingabeRef = useRef<Eingabe>({ gas: false, bremse: false, lehnen: 0 });
  /** `onGameOver` darf genau einmal je Runde raus. */
  const beendet = useRef(false);

  // Anzeigen: direkt ins DOM, siehe Kopfkommentar.
  const tempoRef = useRef<HTMLSpanElement>(null);
  const zeitRef = useRef<HTMLSpanElement>(null);
  const balkenRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const meldungRef = useRef<HTMLDivElement>(null);

  // --- Leinwand aufsetzen -----------------------------------------
  useEffect(() => {
    if (!gestartet) return;
    const leinwand = leinwandRef.current;
    if (!leinwand) return;

    const zeichner = zeichnerBauen(leinwand);
    zeichnerRef.current = zeichner;

    const messen = () => {
      const eltern = leinwand.parentElement;
      if (eltern) zeichner.groesseAendern(eltern.clientWidth, eltern.clientHeight);
    };
    messen();
    window.addEventListener('resize', messen);
    // Ein einzelnes Bild sofort zeichnen, damit nicht kurz eine leere
    // Fläche steht, bevor die Uhr das erste Mal tickt.
    zeichner.zeichnen(holeLauf(), 0);

    return () => {
      window.removeEventListener('resize', messen);
      zeichnerRef.current = null;
    };
  }, [gestartet, holeLauf]);

  // --- Tastatur ----------------------------------------------------
  useEffect(() => {
    if (!gestartet) return;

    const setzen = (code: string, an: boolean) => {
      const e = eingabeRef.current;
      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          e.gas = an;
          return true;
        case 'ArrowDown':
        case 'KeyS':
          e.bremse = an;
          return true;
        case 'ArrowRight':
        case 'KeyD':
          e.lehnen = an ? 1 : 0;
          return true;
        case 'ArrowLeft':
        case 'KeyA':
          e.lehnen = an ? -1 : 0;
          return true;
        default:
          return false;
      }
    };

    const runter = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.target instanceof Element && ev.target.closest('button, a[href], input')) return;
      if (setzen(ev.code, true)) {
        ev.preventDefault();
        setZeigeHinweis(false);
      }
    };
    const hoch = (ev: KeyboardEvent) => {
      if (setzen(ev.code, false)) ev.preventDefault();
    };

    window.addEventListener('keydown', runter, { passive: false });
    window.addEventListener('keyup', hoch, { passive: false });
    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
    };
  }, [gestartet]);

  // --- Die Uhr -----------------------------------------------------
  const lauf = laufRef.current;
  useGameLoop(
    (dt) => {
      const vorher = holeLauf();
      const neu = takt(vorher, dt, eingabeRef.current);
      laufRef.current = neu;

      // Ton bei einer Landung — einmal, beim Wechsel.
      if (neu.letzteLandung !== vorher.letzteLandung && neu.letzteLandung) {
        if (neu.letzteLandung === 'perfekt') sfx('gut', Math.min(12, neu.flow * 2));
        else if (neu.letzteLandung === 'sturz') {
          sfx('ende');
          haptik('ende');
        } else if (neu.letzteLandung === 'hart') sfx('klick');
      }

      zeichnerRef.current?.zeichnen(neu, dt);

      // --- Anzeigen ---
      if (tempoRef.current) tempoRef.current.textContent = String(Math.round(tempoKmh(neu)));
      if (zeitRef.current) zeitRef.current.textContent = neu.zeit.toFixed(1);
      if (balkenRef.current) {
        const anteil = Math.min(100, (neu.x / neu.gelaende.laenge) * 100);
        balkenRef.current.style.width = `${anteil.toFixed(1)}%`;
      }
      if (flowRef.current) {
        flowRef.current.style.opacity = neu.flow > 1 ? '1' : '0';
        flowRef.current.textContent = `FLOW ×${neu.flow}`;
      }
      if (meldungRef.current) {
        const zeigen = neu.meldungRest > 0 && neu.letzteLandung;
        meldungRef.current.style.opacity = zeigen ? '1' : '0';
        if (zeigen) {
          const text =
            neu.letzteLandung === 'perfekt'
              ? 'PERFEKT!'
              : neu.letzteLandung === 'gut'
                ? 'Gut gelandet'
                : neu.letzteLandung === 'hart'
                  ? 'Harte Landung'
                  : 'Gestürzt';
          meldungRef.current.textContent = text;
          meldungRef.current.style.color =
            neu.letzteLandung === 'perfekt'
              ? '#38d9a9'
              : neu.letzteLandung === 'gut'
                ? '#e2e8f0'
                : '#fca5a5';
        }
      }

      if (neu.vorbei && !beendet.current) {
        beendet.current = true;
        const p = punkte(neu);
        onScore(p);
        if (neu.gewonnen) {
          sfx('stufe');
          haptik('jubel');
        }
        /*
         * Kurz warten, bevor der Rundenende-Bildschirm kommt: Beim Sturz
         * soll man sehen, **dass** man gestürzt ist. Ein sofortiger
         * Wechsel liest sich wie ein Fehler des Spiels statt wie ein
         * eigener — dieselbe Überlegung wie beim Aufprall in Dash City.
         */
        window.setTimeout(() => onGameOver(p, neu.gewonnen), neu.gewonnen ? 700 : 1100);
      }
    },
    { fps: 60, running: gestartet && !(lauf?.vorbei && beendet.current) },
  );

  // Punktestand nach außen, zweimal je Sekunde.
  useEffect(() => {
    if (!gestartet) return;
    const uhr = window.setInterval(() => {
      const l = laufRef.current;
      if (l && !l.vorbei) onScore(punkte(l));
    }, 500);
    return () => window.clearInterval(uhr);
  }, [gestartet, onScore]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Flow MTB"
        untertitel="Gas geben, springen, sauber landen. In der Luft das Rad gerade halten."
        bestScore={bestScore}
        verlauf="linear-gradient(165deg, #0f2b40 0%, #1d4d5c 45%, #0b1a24 100%)"
        deko={DEKO}
        Symbol={MtbIcon}
        knopfFarbe="#0f2b40"
        onStart={() => setGestartet(true)}
      />
    );
  }

  /** Ein Steuerknopf. Er hält, solange der Finger liegt. */
  const Knopf = ({
    kind,
    label,
    zeichen,
    setzen,
  }: {
    kind: string;
    label: string;
    zeichen: string;
    setzen: (an: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto flex size-16 select-none flex-col items-center justify-center rounded-2xl border border-white/25 bg-black/35 backdrop-blur-sm active:bg-white/25 ${kind}`}
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        setzen(true);
        setZeigeHinweis(false);
      }}
      onPointerUp={() => setzen(false)}
      onPointerCancel={() => setzen(false)}
      onPointerLeave={() => setzen(false)}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {zeichen}
      </span>
      <span className="mt-0.5 text-[10px] font-bold text-white/75">{label}</span>
    </button>
  );

  return (
    <div ref={buehneRef} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden">
      <canvas ref={leinwandRef} className="block size-full" />

      {/* Kopfzeile: Tempo, Zeit, Fortschritt */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="rounded-2xl bg-black/40 px-3 py-1.5 backdrop-blur-sm">
          <span
            ref={tempoRef}
            className="text-2xl leading-none font-black text-white tabular-nums"
          >
            0
          </span>
          <span className="ml-1 text-xs font-bold text-white/70">km/h</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="rounded-2xl bg-black/40 px-3 py-1.5 text-sm font-bold text-white tabular-nums backdrop-blur-sm">
            <span ref={zeitRef}>0.0</span>s
          </div>
          <div
            ref={flowRef}
            className="rounded-full bg-teal-400/25 px-2.5 py-1 text-xs font-black text-teal-200 transition-opacity duration-200"
            style={{ opacity: 0 }}
          >
            FLOW ×1
          </div>
        </div>
      </div>

      {/* Landungsmeldung in der Bildmitte, knapp über der Strecke */}
      <div
        ref={meldungRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[22%] text-center text-2xl font-black transition-opacity duration-200"
        style={{ opacity: 0, textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}
      />

      {/* Streckenfortschritt unten */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/45">
          <div
            ref={balkenRef}
            className="h-full rounded-full bg-gradient-to-r from-teal-300 to-emerald-400"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* Steuerung: links Gewicht, rechts Antrieb — genau wie gewünscht */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex items-end justify-between px-4">
        <div className="flex gap-2">
          <Knopf
            kind=""
            label="Hinten"
            zeichen="↺"
            setzen={(an) => (eingabeRef.current.lehnen = an ? -1 : 0)}
          />
          <Knopf
            kind=""
            label="Vorne"
            zeichen="↻"
            setzen={(an) => (eingabeRef.current.lehnen = an ? 1 : 0)}
          />
        </div>
        <div className="flex gap-2">
          <Knopf
            kind=""
            label="Bremse"
            zeichen="⊘"
            setzen={(an) => (eingabeRef.current.bremse = an)}
          />
          <Knopf
            kind="bg-teal-500/35"
            label="Gas"
            zeichen="▶"
            setzen={(an) => (eingabeRef.current.gas = an)}
          />
        </div>
      </div>

      {/* Der Hinweis verschwindet mit der ersten Eingabe. */}
      {zeigeHinweis && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] grid place-items-center px-6">
          <div className="rounded-2xl bg-black/60 px-5 py-4 text-center backdrop-blur-sm">
            <p className="text-base font-black text-white">So geht&apos;s</p>
            <ul className="mt-2 space-y-1 text-sm text-white/90">
              <li>
                <span aria-hidden="true">▶</span> Gas geben und Schwung holen
              </li>
              <li>
                <span aria-hidden="true">↺↻</span> In der Luft das Rad gerade halten
              </li>
              <li>Beide Räder zugleich aufsetzen = perfekt</li>
            </ul>
            <p className="mt-2 text-xs text-white/60">
              {settings.reducedMotion ? 'Pfeiltasten gehen auch' : 'Pfeiltasten oder WASD gehen auch'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export { STRECKE_LAENGE };
