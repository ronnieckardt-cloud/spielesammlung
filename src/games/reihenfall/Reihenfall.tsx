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

/** Zeitversatz je Spalte beim Zerbröseln — die Zeile löst sich von links
 *  nach rechts auf statt schlagartig. Bei zehn Spalten macht das rund
 *  200 ms Gesamtlauf, kurz genug, um nicht im Weg zu sein. */
const ZERBROESELN_VERSATZ_MS = 22;

/** Flugrichtung der beiden Krümel je Zelle — fest, kein Zufall. */
const KRUEMEL: readonly { kx: string; ky: string }[] = [
  { kx: '-9px', ky: '11px' },
  { kx: '8px', ky: '13px' },
];

/**
 * Die eben gelöschten Zeilen zerbröseln über dem Feld.
 *
 * Das war die auffälligste Lücke im ganzen Spiel: Volle Zeilen
 * verschwanden bisher völlig lautlos — der Kern des Spiels, und optisch
 * passierte dabei nichts. Block Burst hatte dafür längst `.aufloesen-blitz`
 * und `.kruemel`; beide werden hier unverändert weiterverwendet.
 *
 * Die Zellen liegen als eigenes Raster **über** dem Feld, in derselben
 * Aufteilung. Das Feld selbst ist zu diesem Zeitpunkt bereits
 * zusammengefallen — die Blöcke hier sind also eine Erinnerung an das,
 * was da eben noch lag. Bei gut 200 ms Laufzeit liest sich das als
 * „die Zeile ist zerplatzt", nicht als Widerspruch, und die nach unten
 * wegfliegenden Krümel unterstützen den Zusammenfall sogar.
 */
function ZerbroeselndeZeilen({
  geloescht,
  ruhig,
}: {
  geloescht: Zustand['geloescht'];
  ruhig: boolean;
}) {
  if (geloescht.zeilen.length === 0) return null;

  return (
    <div
      // Der Schlüssel ist der Auslöser: Bei jeder neuen Löschung wird das
      // Raster neu eingehängt, und die CSS-Animationen laufen von vorn.
      key={geloescht.tick}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid"
      style={{
        gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${HOEHE}, minmax(0, 1fr))`,
        gap: 1,
      }}
    >
      {geloescht.zeilen.flatMap(({ y, farben }) =>
        farben.map((farbe, x) => {
          if (farbe === null) return null;
          // Bei „weniger Bewegung" selbst auf 0 setzen: `.ruhig` kürzt nur
          // die Dauer, nicht die Verzögerung.
          const versatz = ruhig ? 0 : x * ZERBROESELN_VERSATZ_MS;
          const zeit = { '--verzoegerung': `${versatz}ms` } as CSSProperties;
          return (
            <div
              key={`${y},${x}`}
              className="relative"
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
            >
              <div
                className="aufloesen-blitz glanzstein absolute inset-0 rounded-[3px]"
                style={{ ...zeit, backgroundColor: reihenfallFarbe(farbe) }}
              />
              {/* Der weiße Blitz darüber — er macht aus dem Schrumpfen ein
                  Aufleuchten. */}
              <div
                className="aufloesen-blitz absolute inset-0 rounded-[3px] bg-white"
                style={zeit}
              />
              {KRUEMEL.map((k) => (
                <span
                  key={k.kx}
                  className="kruemel absolute top-1/2 left-1/2 size-1 rounded-full bg-white"
                  style={{ ...zeit, '--kx': k.kx, '--ky': k.ky } as CSSProperties}
                />
              ))}
            </div>
          );
        }),
      )}
    </div>
  );
}

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
            className={`rounded-[3px] ${gefuellt ? 'glanzstein' : ''}`}
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

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <ReihenfallIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

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
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3 spielseite">
      <div className="flex w-full items-center justify-center gap-6 text-sm text-gedaempft">
        <span>Level {z.level}</span>
        <span>Zeilen {z.zeilenGesamt}</span>
      </div>

      {/* Halten und Vorschau als schmale Zeile über dem Brett. Nebeneinander
          nahmen sie dem Brett die Breite weg — auf einem kleinen Handy blieb
          davon fast nichts übrig. */}
      <div className="flex w-full max-w-xs items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gedaempft">Halten</span>
          <div className="grid size-10 place-items-center rounded-lg border border-rand bg-flaeche">
            {z.haltePosition && <MiniTeil typ={z.haltePosition} abgedunkelt={z.halteBenutzt} />}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gedaempft">Nächste</span>
          {z.warteschlange.slice(0, 3).map((typ, i) => (
            <div key={i} className="grid size-9 place-items-center rounded-lg border border-rand bg-flaeche">
              <MiniTeil typ={typ} />
            </div>
          ))}
        </div>
      </div>

      <div className="spielbuehne">
        <div
          ref={feldRef}
          className="spielbrett relative touch-none rounded-lg border border-rand bg-rand"
          style={
            {
              maxWidth: BREITE * ZELLE_PX,
              '--vz': BREITE / HOEHE,
              display: 'grid',
              gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${HOEHE}, minmax(0, 1fr))`,
              gap: 1,
            } as CSSProperties
          }
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

            const istStein = istAktuell || belegtFarbe !== null;
            let hintergrund = 'var(--color-flaeche)';
            if (istAktuell) hintergrund = reihenfallFarbe(FARB_INDEX[z.aktuell!.typ]);
            else if (belegtFarbe !== null) hintergrund = reihenfallFarbe(belegtFarbe);

            return (
              <div
                key={i}
                className={`rounded-[3px] ${istStein ? 'glanzstein' : ''}`}
                style={{
                  backgroundColor: hintergrund,
                  outline: istGeist ? '2px solid var(--color-gedaempft)' : undefined,
                  outlineOffset: istGeist ? -2 : undefined,
                }}
              />
            );
          })}

          <ZerbroeselndeZeilen geloescht={z.geloescht} ruhig={settings.reducedMotion} />

          {/* Kein eigenes „Vorbei" mehr im Feld — die Hülle legt direkt
              darüber ihr Rundenende-Fenster, das stand doppelt. */}
        </div>

      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => anwenden('drehenUhr')}
          disabled={z.vorbei}
          className="spielknopf rounded-lg border border-rand bg-flaeche px-4 py-2 text-sm disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">↺</span> Drehen
        </button>
        <button
          type="button"
          onClick={() => anwenden('hartFallen')}
          disabled={z.vorbei}
          className="spielknopf rounded-lg border border-rand bg-flaeche px-4 py-2 text-sm disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">⬇</span> Fallen
        </button>
        <button
          type="button"
          onClick={() => anwenden('halten')}
          disabled={z.vorbei || z.halteBenutzt}
          className="spielknopf rounded-lg border border-rand bg-flaeche px-4 py-2 text-sm disabled:opacity-30 transition-transform active:scale-95"
        >
          <span aria-hidden="true">⇄</span> Halten
        </button>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten oder Wischen bewegen, X oder Antippen dreht, Leertaste
        oder schnelles Wischen nach unten lässt hart fallen. Aktuell:{' '}
        {z.aktuell ? TEIL_NAMEN[z.aktuell.typ] : '–'}.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
