import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  FARB_INDEX,
  FORMEN,
  HOEHE,
  aktionAnwenden,
  geisterStein,
  neuesSpiel,
  zeitFortschritt,
  zellenVonStein,
} from './logik';
import type { Aktion, TeilTyp, Zustand } from './logik';
import { TEIL_NAMEN, reihenfallFarbe } from './farben';
import { ReihenfallIcon } from './Icon';

const ZELLE_PX = 22;

/** Zeigt ein Teil in seiner Start-Lage als kleines Raster — für Halten und Vorschau. */
function MiniTeil({ typ, abgedunkelt = false }: { typ: TeilTyp; abgedunkelt?: boolean }) {
  const form = FORMEN[typ][0];
  const breite = Math.max(...form.map((v) => v.dx)) + 1;
  const hoehe = Math.max(...form.map((v) => v.dy)) + 1;
  const belegt = new Set(form.map((v) => `${v.dx},${v.dy}`));
  const groesse = 11;
  return (
    <div
      className="grid gap-0.5"
      style={{
        gridTemplateColumns: `repeat(${breite}, ${groesse}px)`,
        gridTemplateRows: `repeat(${hoehe}, ${groesse}px)`,
        opacity: abgedunkelt ? 0.35 : 1,
      }}
    >
      {Array.from({ length: breite * hoehe }, (_, i) => {
        const x = i % breite;
        const y = Math.floor(i / breite);
        const gefuellt = belegt.has(`${x},${y}`);
        return (
          <div
            key={i}
            className="rounded-[2px]"
            style={{ backgroundColor: gefuellt ? reihenfallFarbe(FARB_INDEX[typ]) : 'transparent' }}
          />
        );
      })}
    </div>
  );
}

/**
 * Fallende Blöcke im Hintergrund des Startbildschirms, in klassischen
 * Tetromino-Farben — feste Liste, rein dekorativ, siehe
 * Blockblitz-Startbildschirm für dasselbe Muster.
 */
const DEKO_BLOECKE: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  winkel: number;
  verzoegerung: number;
}[] = [
  { x: 10, y: 12, groesse: 24, farbe: '#22d3ee', winkel: 6, verzoegerung: 0 },
  { x: 86, y: 16, groesse: 20, farbe: '#facc15', winkel: -10, verzoegerung: 0.7 },
  { x: 80, y: 76, groesse: 26, farbe: '#a855f7', winkel: 4, verzoegerung: 1.2 },
  { x: 8, y: 80, groesse: 22, farbe: '#4ade80', winkel: -6, verzoegerung: 0.4 },
  { x: 92, y: 46, groesse: 16, farbe: '#f87171', winkel: 12, verzoegerung: 1.7 },
  { x: 4, y: 48, groesse: 18, farbe: '#60a5fa', winkel: -4, verzoegerung: 1.0 },
  { x: 55, y: 8, groesse: 14, farbe: '#fb923c', winkel: 20, verzoegerung: 0.2 },
];

/**
 * Titelbild angelehnt an klassische Stapel-Puzzles wie Tetris — dunkles,
 * aber nicht schwarzes Blau mit Neon-Raster und bunten Tetromino-Farben,
 * blockige Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm für
 * die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{
        background:
          'linear-gradient(180deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%),' +
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 34px),' +
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 34px)',
        backgroundBlendMode: 'normal, normal, normal',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_BLOECKE.map((b, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-md opacity-90"
            style={
              {
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.groesse,
                height: b.groesse,
                backgroundColor: b.farbe,
                boxShadow: `0 0 14px ${b.farbe}`,
                animationDelay: `${b.verzoegerung}s`,
                '--grundwinkel': `${b.winkel}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative grid size-28 place-items-center rounded-2xl bg-white/10 shadow-2xl ring-1 ring-white/25 backdrop-blur-sm">
        <ReihenfallIcon className="size-16 drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]" />
      </div>

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(96,165,250,0.5)' }}
        >
          Line Fall
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/80">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Bereit, Reihen zu räumen?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-indigo-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function Reihenfall({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('reihenfall', Date.now())));
  const feldRef = useRef<HTMLDivElement>(null);
  const zeilenVorherRef = useRef(0);

  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), { fps: 30, running: !z.vorbei });

  const anwenden = (aktion: Aktion) => setZ((alt) => aktionAnwenden(alt, aktion));

  useInput(
    (eingabe) => {
      if (z.vorbei) return;
      switch (eingabe) {
        case 'left':
          anwenden('links');
          break;
        case 'right':
          anwenden('rechts');
          break;
        case 'down':
          anwenden('weichFallen');
          break;
        case 'up':
          anwenden('drehenGegenUhr');
          break;
        case 'rotate':
        case 'select':
          anwenden('drehenUhr');
          break;
        case 'drop':
          anwenden('hartFallen');
          break;
      }
    },
    { bereich: feldRef, wiederholen: ['left', 'right', 'down'], tippen: 'select', aktiv: !z.vorbei },
  );

  // Zusätzliche Taste fürs Halten — kein Platz mehr in den sieben
  // Aktionen von useInput, deshalb ein eigener, schmaler Listener.
  useEffect(() => {
    if (z.vorbei) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.code === 'KeyC' && !e.repeat) {
        e.preventDefault();
        anwenden('halten');
      }
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    const differenz = z.zeilenGesamt - zeilenVorherRef.current;
    zeilenVorherRef.current = z.zeilenGesamt;
    if (differenz >= 4) sfx('stufe');
    else if (differenz > 0) sfx('gut');
  }, [z.zeilenGesamt]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const geist = z.aktuell ? geisterStein(z.feld, z.aktuell) : null;
  const aktuelleZellen = new Set(
    z.aktuell ? zellenVonStein(z.aktuell).map((p) => `${p.x},${p.y}`) : [],
  );
  const geisterZellen = new Set(
    geist ? zellenVonStein(geist).filter((p) => p.y >= 0).map((p) => `${p.x},${p.y}`) : [],
  );

  if (!gestartet) {
    return (
      <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-4">
      <div className="flex w-full items-center justify-center gap-6 text-sm text-gedaempft">
        <span>Level {z.level}</span>
        <span>Zeilen {z.zeilenGesamt}</span>
      </div>

      <div className="flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gedaempft">Halten</span>
          <div className="grid size-14 place-items-center rounded-lg border border-rand bg-flaeche">
            {z.haltePosition && <MiniTeil typ={z.haltePosition} abgedunkelt={z.halteBenutzt} />}
          </div>
          <span className="text-[10px] text-gedaempft">C</span>
        </div>

        <div
          ref={feldRef}
          className="relative touch-none rounded-lg border border-rand bg-rand"
          style={{
            width: BREITE * ZELLE_PX,
            height: HOEHE * ZELLE_PX,
            display: 'grid',
            gridTemplateColumns: `repeat(${BREITE}, ${ZELLE_PX}px)`,
            gap: 1,
          }}
          role="img"
          aria-label={`Spielfeld, Level ${z.level}, ${z.zeilenGesamt} Zeilen geschafft.${z.vorbei ? ' Spiel vorbei.' : ''}`}
        >
          {Array.from({ length: BREITE * HOEHE }, (_, i) => {
            const x = i % BREITE;
            const y = Math.floor(i / BREITE);
            const schluessel = `${x},${y}`;
            const istAktuell = aktuelleZellen.has(schluessel);
            const belegtFarbe = z.feld[y]![x];
            const istGeist = !istAktuell && belegtFarbe === null && geisterZellen.has(schluessel);

            let hintergrund = 'var(--color-flaeche)';
            if (istAktuell) hintergrund = reihenfallFarbe(FARB_INDEX[z.aktuell!.typ]);
            else if (belegtFarbe !== null) hintergrund = reihenfallFarbe(belegtFarbe);

            return (
              <div
                key={i}
                className="rounded-[2px]"
                style={{
                  backgroundColor: hintergrund,
                  outline: istGeist ? '2px solid var(--color-gedaempft)' : undefined,
                  outlineOffset: istGeist ? -2 : undefined,
                }}
              />
            );
          })}

          {z.vorbei && (
            <div className="absolute inset-0 grid place-items-center rounded-lg bg-grund/70">
              <span className="text-sm font-semibold text-text">Vorbei</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gedaempft">Nächste</span>
          <div className="flex flex-col gap-2">
            {z.warteschlange.slice(0, 3).map((typ, i) => (
              <div key={i} className="grid size-11 place-items-center rounded-lg border border-rand bg-flaeche">
                <MiniTeil typ={typ} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => anwenden('drehenUhr')}
          disabled={z.vorbei}
          className="rounded-lg border border-rand bg-flaeche px-4 py-2 text-sm disabled:opacity-30"
        >
          <span aria-hidden="true">↺</span> Drehen
        </button>
        <button
          type="button"
          onClick={() => anwenden('hartFallen')}
          disabled={z.vorbei}
          className="rounded-lg border border-rand bg-flaeche px-4 py-2 text-sm disabled:opacity-30"
        >
          <span aria-hidden="true">⬇</span> Fallen
        </button>
        <button
          type="button"
          onClick={() => anwenden('halten')}
          disabled={z.vorbei || z.halteBenutzt}
          className="rounded-lg border border-rand bg-flaeche px-4 py-2 text-sm disabled:opacity-30"
        >
          <span aria-hidden="true">⇄</span> Halten
        </button>
      </div>

      <p className="max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten oder Wischen bewegen, X oder Antippen dreht, Leertaste
        oder schnelles Wischen nach unten lässt hart fallen. Aktuell:{' '}
        {z.aktuell ? TEIL_NAMEN[z.aktuell.typ] : '–'}.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
