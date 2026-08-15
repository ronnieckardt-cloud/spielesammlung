import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import { ANZAHL_FARBEN, andocken, neuesSpiel } from './logik';
import type { Punkt, Zustand } from './logik';
import {
  FELD_BREITE,
  FELD_HOEHE,
  KANONE,
  RADIUS,
  flugbahn,
  mittelpunkt,
  winkelZu,
} from './geometrie';
import type { Stelle } from './geometrie';
import { kugelFarbe, kugelName } from './farben';
import { BubblePopIcon } from './Icon';

/** Wie lange geplatzte Kugeln noch nachleuchten, in Millisekunden. */
const PLATZ_DAUER_MS = 320;

/** Länge des Kanonenrohrs im Rechenraum von geometrie.ts. */
const ROHR_LAENGE = 8;

/**
 * Schwebende Deko-Kugeln im Hintergrund des Startbildschirms — feste Liste,
 * rein dekorativ, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
const DEKO_KUGELN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 9, y: 13, groesse: 28, farbe: '#f43f5e', verzoegerung: 0 },
  { x: 86, y: 9, groesse: 22, farbe: '#facc15', verzoegerung: 0.6 },
  { x: 81, y: 79, groesse: 32, farbe: '#38bdf8', verzoegerung: 1.1 },
  { x: 8, y: 79, groesse: 24, farbe: '#4ade80', verzoegerung: 0.3 },
  { x: 92, y: 45, groesse: 17, farbe: '#c084fc', verzoegerung: 1.6 },
  { x: 4, y: 46, groesse: 19, farbe: '#facc15', verzoegerung: 0.9 },
];

/**
 * Titelbild im Stil bunter Blasen-Spiele — kräftiger Verlauf, schwebende
 * Kugeln, dicke Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm
 * für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #7c3aed 0%, #d946ef 40%, #f43f5e 72%, #f97316 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_KUGELN.map((k, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-85"
            style={
              {
                left: `${k.x}%`,
                top: `${k.y}%`,
                width: k.groesse,
                height: k.groesse,
                backgroundColor: k.farbe,
                animationDelay: `${k.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <BubblePopIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Bubble Pop
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Drei gleiche lassen es knallen'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-fuchsia-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function BubblePop({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('bubblepop', Date.now())));
  const [zielWinkel, setZielWinkel] = useState(-Math.PI / 2);
  const [platzend, setPlatzend] = useState<readonly Punkt[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // Die Flugbahn hängt nur von Wabe und Winkel ab — bei jedem Rendern neu
  // gerechnet, das ist billig genug (ein paar hundert Schritte).
  const bahn = flugbahn(z.wabe, zielWinkel);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx(z.gewonnen ? 'stufe' : 'ende');
      onGameOver(z.punkte, z.gewonnen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  useEffect(() => {
    if (platzend.length === 0) return;
    const uhr = window.setTimeout(() => setPlatzend([]), PLATZ_DAUER_MS);
    return () => window.clearTimeout(uhr);
  }, [platzend]);

  /** Bildpunkt des Zeigers in den Rechenraum des Felds umrechnen. */
  const stelleAus = useCallback((e: ReactPointerEvent<SVGSVGElement>): Stelle | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const kasten = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - kasten.left) / kasten.width) * FELD_BREITE,
      y: ((e.clientY - kasten.top) / kasten.height) * FELD_HOEHE,
    };
  }, []);

  const zielen = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (z.vorbei) return;
      const stelle = stelleAus(e);
      if (stelle) setZielWinkel(winkelZu(stelle));
    },
    [stelleAus, z.vorbei],
  );

  const schiessen = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (z.vorbei) return;
      const stelle = stelleAus(e);
      if (!stelle) return;

      const winkel = winkelZu(stelle);
      setZielWinkel(winkel);

      const schuss = flugbahn(z.wabe, winkel);
      if (!schuss.ziel) return;

      const ergebnis = andocken(z, schuss.ziel);
      if (ergebnis.zustand === z) return;

      setZ(ergebnis.zustand);
      if (ergebnis.geplatzt.length > 0) {
        setPlatzend([...ergebnis.geplatzt, ...ergebnis.gefallen]);
        sfx(ergebnis.geplatzt.length + ergebnis.gefallen.length >= 6 ? 'stufe' : 'gut');
      } else {
        sfx('klick');
      }
    },
    [z],
  );

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const platzendeSchluessel = new Set(platzend.map((p) => `${p.spalte},${p.zeile}`));
  const belegte = z.wabe.flat().filter((f) => f !== null).length;

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

      <svg
        ref={svgRef}
        viewBox={`0 0 ${FELD_BREITE} ${FELD_HOEHE}`}
        className="w-full max-w-sm touch-none rounded-2xl border border-rand bg-flaeche"
        style={{ aspectRatio: `${FELD_BREITE} / ${FELD_HOEHE}` }}
        onPointerMove={zielen}
        onPointerDown={schiessen}
        role="img"
        aria-label={`Spielfeld mit ${belegte} Kugeln. Im Rohr: ${kugelName(z.aktuell)}, danach ${kugelName(z.naechste)}.${z.vorbei ? (z.gewonnen ? ' Alle Kugeln weg, gewonnen!' : ' Vorbei.') : ''}`}
      >
        <defs>
          {/* Je Farbe ein Kugelverlauf: heller Punkt oben links, zum Rand
              hin dunkler. Das lässt die flachen Kreise rund wirken. Einmal
              hier definiert und unten mehrfach benutzt — die Farben stehen
              fest, deshalb reichen feste ids. */}
          {Array.from({ length: ANZAHL_FARBEN }, (_, i) => (
            <radialGradient key={i} id={`kugel-${i}`} cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
              <stop offset="0.35" stopColor={kugelFarbe(i)} />
              <stop offset="1" stopColor={kugelFarbe(i)} stopOpacity="1" />
            </radialGradient>
          ))}
        </defs>

        {/* Zielhilfe: die gerechnete Flugbahn inklusive Abprallern. */}
        {!z.vorbei && (
          <polyline
            points={bahn.punkte.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={kugelFarbe(z.aktuell)}
            strokeWidth="0.6"
            strokeDasharray="1.5 1.5"
            opacity="0.55"
          />
        )}

        {/* Vorschau, wo die Kugel landen würde. */}
        {!z.vorbei && bahn.ziel && (
          <circle
            cx={mittelpunkt(bahn.ziel).x}
            cy={mittelpunkt(bahn.ziel).y}
            r={RADIUS * 0.85}
            fill="none"
            stroke={kugelFarbe(z.aktuell)}
            strokeWidth="0.7"
            opacity="0.8"
          />
        )}

        {z.wabe.map((zeile, y) =>
          zeile.map((farbe, x) => {
            if (farbe === null) return null;
            const m = mittelpunkt({ spalte: x, zeile: y });
            return (
              <g key={`${x},${y}`}>
                {/* Dunkler Rand als Schattenkante unter der Kugel. */}
                <circle cx={m.x} cy={m.y + 0.35} r={RADIUS * 0.94} fill="#0b1020" opacity="0.45" />
                <circle cx={m.x} cy={m.y} r={RADIUS * 0.94} fill={`url(#kugel-${farbe})`} />
                <ellipse
                  cx={m.x - RADIUS * 0.32}
                  cy={m.y - RADIUS * 0.38}
                  rx={RADIUS * 0.22}
                  ry={RADIUS * 0.14}
                  fill="#ffffff"
                  opacity="0.85"
                />
              </g>
            );
          }),
        )}

        {/* Nachleuchten der geplatzten Kugeln. */}
        {[...platzendeSchluessel].map((schluessel) => {
          const [x, y] = schluessel.split(',').map(Number);
          const m = mittelpunkt({ spalte: x!, zeile: y! });
          return (
            <circle
              key={`platz-${schluessel}`}
              className="aufloesen-blitz"
              cx={m.x}
              cy={m.y}
              r={RADIUS}
              fill="white"
            />
          );
        })}

        {/* Kanone mit der Kugel im Rohr. */}
        <line
          x1={KANONE.x}
          y1={KANONE.y}
          x2={KANONE.x + Math.cos(zielWinkel) * ROHR_LAENGE}
          y2={KANONE.y + Math.sin(zielWinkel) * ROHR_LAENGE}
          stroke="#97a3b8"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx={KANONE.x} cy={KANONE.y + 0.35} r={RADIUS} fill="#0b1020" opacity="0.45" />
        <circle cx={KANONE.x} cy={KANONE.y} r={RADIUS} fill={`url(#kugel-${z.aktuell})`} />
        <ellipse
          cx={KANONE.x - RADIUS * 0.32}
          cy={KANONE.y - RADIUS * 0.38}
          rx={RADIUS * 0.24}
          ry={RADIUS * 0.15}
          fill="#ffffff"
          opacity="0.85"
        />
      </svg>

      <p className="text-sm text-gedaempft">
        Als Nächstes:{' '}
        <span
          aria-hidden="true"
          className="ml-1 inline-block size-3.5 translate-y-0.5 rounded-full"
          style={{ backgroundColor: kugelFarbe(z.naechste) }}
        />{' '}
        <span className="font-semibold text-text">{kugelName(z.naechste)}</span>
      </p>

      <p className="max-w-sm text-center text-xs text-gedaempft">
        Zum Zielen über das Feld fahren oder wischen, zum Schießen antippen.
        Drei gleiche Farben platzen; was danach den Halt verliert, fällt
        hinterher und gibt Extrapunkte. Alle Kugeln weg heißt gewonnen.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
