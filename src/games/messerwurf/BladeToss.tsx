import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import {
  ANKUNFT,
  flugFortschritt,
  messerFuerLevel,
  neuesSpiel,
  werfen,
  zeitFortschritt,
} from './logik';
import type { Zustand } from './logik';
import { Apfel, FliegendesMesser, HOEHE, SteckendesMesser, Stamm, VorratsMesser } from './figuren';
import { BladeTossIcon } from './Icon';

/** Rechnet einen Steckwinkel in die Drehung um, die die Anzeige braucht. */
const alsGrad = (steck: number, stammwinkel: number) =>
  ((steck + stammwinkel - ANKUNFT) * 180) / Math.PI;

/** Schwebende Messer im Hintergrund des Startbildschirms, feste Liste. */
const DEKO_MESSER: readonly { x: number; y: number; winkel: number; verzoegerung: number }[] = [
  { x: 9, y: 14, winkel: -25, verzoegerung: 0 },
  { x: 86, y: 11, winkel: 18, verzoegerung: 0.7 },
  { x: 89, y: 70, winkel: -14, verzoegerung: 1.3 },
  { x: 6, y: 74, winkel: 32, verzoegerung: 0.4 },
  { x: 92, y: 42, winkel: 8, verzoegerung: 1.7 },
  { x: 3, y: 44, winkel: -38, verzoegerung: 1.0 },
];

/** Titelbild — eigene Gestaltung, Vorlage ist der Blockblitz-Startbildschirm. */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #a16207 0%, #7c2d12 45%, #431407 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_MESSER.map((m, i) => (
          <span
            key={i}
            className="block-schweben absolute"
            style={
              {
                left: `${m.x}%`,
                top: `${m.y}%`,
                animationDelay: `${m.verzoegerung}s`,
                '--grundwinkel': `${m.winkel}deg`,
              } as CSSProperties
            }
          >
            <VorratsMesser verbraucht={false} />
          </span>
        ))}
      </div>

      <BladeTossIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.28), 0 10px 24px rgba(0,0,0,0.4)' }}
        >
          Blade Toss
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Triff das Holz, nicht dein Messer!'}
        </p>
      </div>

      <button
        type="button"
        autoFocus
        onClick={onStart}
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-amber-800 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function BladeToss({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('messerwurf', Date.now())));
  const buehne = useRef<HTMLDivElement>(null);

  const wirf = useCallback(() => setZ((alt) => werfen(alt)), []);

  /**
   * Eigener, schmaler Tastatur-Listener statt `useInput`.
   *
   * Grund: `useInput` erkennt ein Antippen erst beim **Loslassen**. Zusammen
   * mit dem `onPointerDown` unten (das den Wurf im Moment der Berührung
   * auslöst, weil sich alles andere träge anfühlt) käme pro Tipp zweimal
   * ein Wurf an — der erste beim Berühren, der zweite beim Loslassen, sobald
   * das erste Messer schon eingeschlagen ist. Das kostete jedes Mal ein
   * Messer. Hier gibt es ohnehin nur eine einzige Handlung, die sieben
   * Aktionen von `useInput` werden also gar nicht gebraucht.
   */
  useEffect(() => {
    if (!gestartet || z.vorbei) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'ArrowUp') return;
      // Nicht dazwischenfunken, wenn gerade ein Knopf den Fokus hat.
      if (e.target instanceof Element && e.target.closest('button, a[href]')) return;
      e.preventDefault();
      wirf();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [gestartet, z.vorbei, wirf]);

  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), {
    fps: 60,
    running: gestartet && !z.vorbei,
  });

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  // Ton: je nach dem, was der Einschlag ausgelöst hat.
  const vorMesserRef = useRef(z.messer.length);
  const vorAepfelRef = useRef(z.aepfel.length);
  const vorLevelRef = useRef(z.level);
  useEffect(() => {
    if (z.aepfel.length < vorAepfelRef.current) sfx('stufe');
    else if (z.messer.length > vorMesserRef.current) sfx('klick');
    if (z.level > vorLevelRef.current) sfx('gut');
    vorMesserRef.current = z.messer.length;
    vorAepfelRef.current = z.aepfel.length;
    vorLevelRef.current = z.level;
  }, [z]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const gesamt = messerFuerLevel(z.level);
  const geworfen = gesamt - z.uebrig;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <output
        key={z.punkte}
        aria-live="polite"
        aria-label={`${z.punkte} Punkte`}
        className="punkte-bumsen text-5xl leading-none font-extrabold tabular-nums sm:text-6xl"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {z.punkte}
      </output>
      <span className="text-sm text-gedaempft">
        Level {z.level} · {z.messer.length} im Holz
      </span>

      <div className="spielbuehne" ref={buehne}>
        <svg
          viewBox={`0 0 100 ${HOEHE}`}
          className="spielbrett touch-none"
          style={{ '--vz': 100 / HOEHE } as CSSProperties}
          role="img"
          aria-label={`Blade Toss, Level ${z.level}. Noch ${z.uebrig} von ${gesamt} Messern zu werfen.${z.vorbei ? ' Vorbei — eigenes Messer getroffen.' : ''}`}
          // Antippen wird zusätzlich hier abgefangen: `useInput` erkennt ein
          // Tippen erst beim Loslassen, das fühlt sich bei einem Wurfspiel
          // träge an. Der Wurf soll im Moment der Berührung losgehen.
          onPointerDown={(e) => {
            e.preventDefault();
            wirf();
          }}
        >
          {/* Stamm zuerst, Messer darüber. Die Klinge liegt damit sichtbar
              auf dem Holz — genauso machen es die Vorbilder, und man
              erkennt auf einen Blick, wie viel Platz noch frei ist. Ein
              erster Versuch zeichnete die Messer unter den Stamm, damit die
              Klinge „im Holz verschwindet"; dann waren aber alle Messer
              unsichtbar, sobald sie nach oben zeigten. */}
          <Stamm />
          {z.aepfel.map((steck, i) => (
            <Apfel key={i} drehung={alsGrad(steck, z.winkel)} />
          ))}
          {z.messer.map((steck, i) => (
            <SteckendesMesser key={i} drehung={alsGrad(steck, z.winkel)} />
          ))}

          {z.fliegend !== null && <FliegendesMesser fortschritt={flugFortschritt(z)} />}
        </svg>
      </div>

      {/* Vorrat: ein Symbol je Messer dieses Levels, verbrauchte blass. */}
      <div className="flex items-end gap-1" aria-hidden="true">
        {Array.from({ length: gesamt }, (_, i) => (
          <VorratsMesser key={i} verbraucht={i < geworfen} />
        ))}
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Antippen wirft ein Messer. Triff das Holz — aber nie ein Messer, das
        schon steckt. Äpfel geben Extrapunkte.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
