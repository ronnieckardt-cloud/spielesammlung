import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import { BREITE, HOEHE, neuesSpiel, richtungWaehlen, zeitFortschritt } from './logik';
import type { Richtung, Zustand } from './logik';
import { SchlangeIcon } from './Icon';

const KOPF_FARBE = '#22c55e';
const KOERPER_FARBE = '#4ade80';
const FUTTER_FARBE = '#f43f5e';
const GOLD_FARBE = '#facc15';

/**
 * Schwebende Deko-Punkte im Hintergrund des Startbildschirms — feste Liste,
 * rein dekorativ, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
const DEKO_PUNKTE: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 10, y: 14, groesse: 24, farbe: '#f43f5e', verzoegerung: 0 },
  { x: 86, y: 10, groesse: 18, farbe: '#facc15', verzoegerung: 0.6 },
  { x: 82, y: 78, groesse: 28, farbe: '#4ade80', verzoegerung: 1.1 },
  { x: 8, y: 80, groesse: 20, farbe: '#facc15', verzoegerung: 0.3 },
  { x: 92, y: 46, groesse: 15, farbe: '#f43f5e', verzoegerung: 1.6 },
  { x: 5, y: 46, groesse: 17, farbe: '#4ade80', verzoegerung: 0.9 },
];

/**
 * Titelbild im Stil klassischer Arcade-Spiele — kräftiges Grün, schwebende
 * Punkte, dicke Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm
 * für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #065f46 0%, #16a34a 45%, #65a30d 75%, #ca8a04 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_PUNKTE.map((p, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-85"
            style={
              {
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.groesse,
                height: p.groesse,
                backgroundColor: p.farbe,
                animationDelay: `${p.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <SchlangeIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Snake Rush
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Wie lang wird deine Schlange?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-green-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function Schlange({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('schlange', Date.now())));
  const feldRef = useRef<HTMLDivElement>(null);
  const punkteVorherRef = useRef(0);

  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), {
    fps: 60,
    running: gestartet && !z.vorbei,
  });

  useInput(
    (eingabe) => {
      const richtungen: Partial<Record<typeof eingabe, Richtung>> = {
        up: 'hoch',
        down: 'runter',
        left: 'links',
        right: 'rechts',
      };
      const richtung = richtungen[eingabe];
      if (richtung) setZ((alt) => richtungWaehlen(alt, richtung));
    },
    // Kein Wiederholen bei gehaltener Taste: die Richtung gilt ohnehin bis
    // zur nächsten Eingabe, mehrfaches Auslösen brächte nichts.
    { bereich: feldRef, wiederholen: [], aktiv: gestartet && !z.vorbei },
  );

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    const differenz = z.punkte - punkteVorherRef.current;
    punkteVorherRef.current = z.punkte;
    if (differenz > 0) sfx(differenz > 10 ? 'stufe' : 'gut');
  }, [z.punkte]);

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

  const kopf = z.schlange[0]!;
  const koerper = new Map(z.schlange.slice(1).map((p, i) => [`${p.x},${p.y}`, i]));

  return (
    <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-4">
      <output
        aria-live="off"
        key={z.punkte}
        className="punkte-bumsen text-5xl font-black tabular-nums text-text sm:text-6xl"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {z.punkte}
      </output>

      <div
        ref={feldRef}
        className="grid w-full max-w-md touch-none gap-px rounded-xl border border-rand bg-rand p-px"
        style={{ gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Spielfeld. Schlange ${z.schlange.length} Glieder lang, ${z.punkte} Punkte.${z.vorbei ? ' Vorbei.' : ''}`}
      >
        {Array.from({ length: BREITE * HOEHE }, (_, i) => {
          const x = i % BREITE;
          const y = Math.floor(i / BREITE);
          const schluessel = `${x},${y}`;
          const istKopf = kopf.x === x && kopf.y === y;
          const gliedIndex = koerper.get(schluessel);
          const istFutter = z.futter.x === x && z.futter.y === y;
          const istGold = !!z.gold && z.gold.x === x && z.gold.y === y;

          let inhalt: CSSProperties | undefined;
          if (istKopf) {
            inhalt = { backgroundColor: KOPF_FARBE, borderRadius: '35%' };
          } else if (gliedIndex !== undefined) {
            // Zum Schwanz hin etwas durchsichtiger — macht die Laufrichtung
            // auf einen Blick erkennbar.
            inhalt = {
              backgroundColor: KOERPER_FARBE,
              opacity: Math.max(0.45, 1 - gliedIndex / (z.schlange.length + 4)),
              borderRadius: '30%',
            };
          }

          return (
            <div key={i} className="relative aspect-square bg-flaeche">
              {inhalt && <div className="absolute inset-[8%]" style={inhalt} />}
              {istFutter && (
                <div
                  className="absolute inset-[18%] rounded-full"
                  style={{ backgroundColor: FUTTER_FARBE, boxShadow: `0 0 6px ${FUTTER_FARBE}` }}
                />
              )}
              {istGold && (
                <div
                  className="pulsiert absolute inset-[14%] rounded-full"
                  style={{ backgroundColor: GOLD_FARBE, boxShadow: `0 0 10px ${GOLD_FARBE}` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Steuerung">
        <span />
        <button
          type="button"
          onClick={() => setZ((alt) => richtungWaehlen(alt, 'hoch'))}
          disabled={z.vorbei}
          aria-label="Nach oben"
          className="rounded-lg border border-rand bg-flaeche px-5 py-3 disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">↑</span>
        </button>
        <span />
        <button
          type="button"
          onClick={() => setZ((alt) => richtungWaehlen(alt, 'links'))}
          disabled={z.vorbei}
          aria-label="Nach links"
          className="rounded-lg border border-rand bg-flaeche px-5 py-3 disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          onClick={() => setZ((alt) => richtungWaehlen(alt, 'runter'))}
          disabled={z.vorbei}
          aria-label="Nach unten"
          className="rounded-lg border border-rand bg-flaeche px-5 py-3 disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">↓</span>
        </button>
        <button
          type="button"
          onClick={() => setZ((alt) => richtungWaehlen(alt, 'rechts'))}
          disabled={z.vorbei}
          aria-label="Nach rechts"
          className="rounded-lg border border-rand bg-flaeche px-5 py-3 disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p className="max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder die Knöpfe steuern. Rote Äpfel machen dich
        länger und schneller, goldene geben Extrapunkte — sie liegen aber nur
        kurz. An den Rändern läufst du auf der anderen Seite weiter.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
