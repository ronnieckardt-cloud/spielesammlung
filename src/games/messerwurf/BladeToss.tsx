import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ZeigerEreignis } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import type { GameProps } from '../../core/types';
import {
  ANKUNFT,
  MESSER_PUNKTE,
  flugFortschritt,
  messerFuerLevel,
  neuesSpiel,
  stossPartner,
  werfen,
  zeitFortschritt,
  zerteiltFortschritt,
} from './logik';
import type { Zustand } from './logik';
import {
  Apfel,
  Bretterwand,
  FliegendesMesser,
  HOEHE,
  SteckendesMesser,
  Stamm,
  VorratsMesser,
  ZerteilterApfel,
  Zusammenstoss,
} from './figuren';
import { BladeTossIcon } from './Icon';

/**
 * Wie lange das Bild des Zusammenstoßes stehen bleibt, bevor die Hülle den
 * Rundenende-Bildschirm zeigt. Ohne diese Pause verschwände genau der eine
 * Augenblick, an dem man sieht, woran es lag.
 */
const STOSS_ZEIGEN_MS = 750;

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
        {/* Regel **und** Bestleistung, nicht die eine statt der anderen:
            Sobald ein Bestwert vorlag, verschwand die einzige Stelle, an
            der die zentrale Regel des Spiels überhaupt noch stand. */}
        <p className="mt-3 text-sm font-semibold text-white/85">Triff das Holz, nicht dein Messer!</p>
        {bestScore > 0 && (
          <p className="mt-1 text-sm font-semibold text-white/70">🏆 Beste Punktzahl: {bestScore}</p>
        )}
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

  /**
   * Das „+N" über dem Brett. Die Schwelle liegt über `MESSER_PUNKTE`: Jeder
   * Treffer ins Holz gibt ohnehin schon Ton, Vorratsmesser und eine neue
   * Klinge im Stamm — ein Popup dazu wäre Dauerflimmern. Gemeldet wird, was
   * wirklich außer der Reihe ist: der zerteilte Apfel und der Levelbonus.
   */
  const gewinn = usePunktegewinn(z.punkte, MESSER_PUNKTE + 1);

  const wirf = useCallback(() => setZ((alt) => werfen(alt)), []);

  /**
   * Werfen auf der **ganzen Seite**, nicht nur auf dem Brett.
   *
   * Vorher hing der Griff am Brett allein: Der Messervorrat direkt darunter
   * — der aussieht wie der Vorrat, aus dem man wirft —, der Punktestand
   * darüber und die Ränder links und rechts waren tot. Beim schnellen
   * Tippen trifft man aber genau dorthin, und ein Wurfspiel, das jeden
   * dritten Tipp verschluckt, fühlt sich kaputt an. Genau wie Ring Rise.
   *
   * Knöpfe und Verweise bleiben ausgenommen, dieselbe Prüfung wie im
   * Tastatur-Listener unten. Ein doppelter Wurf kann dabei nicht
   * herauskommen: `werfen` gibt den Zustand unverändert zurück, solange
   * noch ein Messer unterwegs ist.
   */
  const antippen = useCallback(
    (e: ZeigerEreignis<HTMLDivElement>) => {
      if (e.target instanceof Element && e.target.closest('button, a[href]')) return;
      // Beim Berühren, nicht beim Loslassen: Alles andere fühlt sich bei
      // einem Wurfspiel träge an.
      e.preventDefault();
      wirf();
    },
    [wirf],
  );

  /**
   * Eigener, schmaler Tastatur-Listener statt `useInput`.
   *
   * Grund: `useInput` erkennt ein Antippen erst beim **Loslassen**. Zusammen
   * mit `antippen` oben (das den Wurf im Moment der Berührung
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

  // Das Rundenende wird bewusst verzögert gemeldet: Erst steht das Bild vom
  // Zusammenstoß, dann kommt der Bildschirm der Hülle darüber.
  useEffect(() => {
    if (!z.vorbei) return;
    sfx('ende');
    const uhr = window.setTimeout(() => onGameOver(z.punkte), STOSS_ZEIGEN_MS);
    return () => window.clearTimeout(uhr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const gesamt = messerFuerLevel(z.level);
  const geworfen = gesamt - z.uebrig;
  // Welche steckende Klinge der tödliche Wurf erwischt hat — beide werden
  // rot, damit der Zusammenstoß als Paar zu lesen ist.
  const stossIndex = stossPartner(z);

  return (
    <div
      className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3"
      onPointerDown={antippen}
    >
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

      <div className="spielbuehne">
        {/* Das Brett ist ein eigenes Element um das SVG herum, nicht das SVG
            selbst: Der Punktegewinn ist ein `div` und gehört ins Brett (so
            macht es Ghost Chase) — direkt in der Bühne würde er das Brett
            zur Seite schieben, siehe Kommentar in `index.css`. */}
        <div
          className="spielbrett spielbrett-rahmen relative touch-none overflow-hidden"
          style={{ '--vz': 100 / HOEHE } as CSSProperties}
        >
          <svg
            viewBox={`0 0 100 ${HOEHE}`}
            className="h-full w-full"
            role="img"
            aria-label={`Blade Toss, Level ${z.level}. Noch ${z.uebrig} von ${gesamt} Messern zu werfen.${z.vorbei ? ' Vorbei — eigenes Messer getroffen.' : ''}`}
          >
            <Bretterwand />

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
              <SteckendesMesser key={i} drehung={alsGrad(steck, z.winkel)} alarm={i === stossIndex} />
            ))}

            {/* Der zerteilte Apfel über den Klingen: Die Hälften fliegen nach
                vorn weg, sie sollen nicht hinter einem Messer hervorlugen. */}
            {z.zerteilt !== null && (
              <ZerteilterApfel
                drehung={alsGrad(z.zerteilt.steck, z.winkel)}
                fortschritt={zerteiltFortschritt(z)}
              />
            )}

            {z.fliegend !== null && <FliegendesMesser fortschritt={flugFortschritt(z)} />}

            {/* Das tödliche Messer bleibt stehen, wo es aufgeschlagen ist,
                und darüber blitzt der Zusammenstoß auf — sonst wäre die
                Runde ohne ein einziges Bild vorbei. */}
            {z.stoss !== null && (
              <>
                {/* Funken zuerst, Messer darüber: Andersherum verdeckt der
                    Stern genau die beiden Klingen, um die es geht. */}
                <Zusammenstoss drehung={alsGrad(z.stoss, z.winkel)} />
                <SteckendesMesser drehung={alsGrad(z.stoss, z.winkel)} alarm />
              </>
            )}
          </svg>

          <Punktegewinn gewinn={gewinn} />
        </div>
      </div>

      {/* Vorrat: ein Symbol je Messer dieses Levels, verbrauchte blass. */}
      <div className="flex items-end gap-1" aria-hidden="true">
        {Array.from({ length: gesamt }, (_, i) => (
          <VorratsMesser key={i} verbraucht={i < geworfen} />
        ))}
      </div>

      {/* Der Kern der Regel bleibt immer stehen; nur der Zusatz weicht auf
          kurzen Bildschirmen. Vorher verschwand der ganze Absatz unter 720
          Pixeln Höhe — und damit ab der zweiten Runde die einzige Stelle,
          an der überhaupt noch stand, worum es geht. */}
      <p className="max-w-sm text-center text-xs text-gedaempft">
        Irgendwo antippen wirft ein Messer — nie in ein Messer, das schon steckt.
        <span className="nur-bei-platz"> Äpfel geben Extrapunkte.</span>
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
