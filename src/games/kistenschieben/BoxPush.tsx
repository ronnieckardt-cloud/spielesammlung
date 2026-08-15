import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import {
  LEVEL_ANZAHL,
  alsPunkt,
  gehen,
  neuesLevel,
  neustart,
  punkteFuerZuege,
  zurueck,
} from './logik';
import type { Richtung, Zustand } from './logik';
import { KistenIcon } from './Icon';

/**
 * Box Push — Kisten auf ihre Zielfelder schieben.
 *
 * Das erste Spiel der Sammlung, in dem man einen Zug wirklich **verbauen**
 * kann: Eine Kiste lässt sich nur schieben, nie ziehen. Steht sie in der
 * Ecke, bleibt sie dort. Deshalb sind Zurück und Neustart hier keine
 * Bequemlichkeit, sondern Teil der Regeln.
 *
 * Gerechnet wird in `logik.ts`, die Level stehen als Textraster in
 * `level.ts` — beides ohne Browser geprüft, samt Suchlauf, der jedes Level
 * wirklich löst.
 */

/** Kantenlänge eines Feldes im Zeichensystem. */
const FELD = 10;

/**
 * Welches Level als Nächstes drankommt — Modul-Variable, kein State:
 * „Nochmal" mountet das Spiel per neuem `key` neu. Gleiche Begründung wie
 * bei Color Pour.
 */
let naechstesLevel = 1;

const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 16, winkel: -10, verzoegerung: 0, inhalt: <DekoKiste /> },
  { x: 86, y: 12, winkel: 14, verzoegerung: 0.6, inhalt: <DekoKiste /> },
  { x: 88, y: 72, winkel: -6, verzoegerung: 1.2, inhalt: <DekoKiste /> },
  { x: 5, y: 74, winkel: 18, verzoegerung: 0.4, inhalt: <DekoKiste /> },
];

function DekoKiste() {
  return (
    <svg viewBox="0 0 20 20" className="size-11">
      <Kiste x={0} y={0} groesse={20} aufZiel={false} />
    </svg>
  );
}

/**
 * Eine Kiste. Holzoptik mit Diagonalbändern — dieselbe Machart wie der
 * Glanzstein in Block Burst: Schatten unten, Lichtkante oben, damit sie
 * nicht flach wirkt.
 */
function Kiste({
  x,
  y,
  groesse,
  aufZiel,
}: {
  x: number;
  y: number;
  groesse: number;
  aufZiel: boolean;
}) {
  const rand = groesse * 0.09;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={rand}
        y={rand}
        width={groesse - rand * 2}
        height={groesse - rand * 2}
        rx={groesse * 0.12}
        fill={aufZiel ? '#a16207' : '#b45309'}
        stroke={aufZiel ? '#facc15' : '#78350f'}
        strokeWidth={groesse * 0.07}
      />
      {/* Die beiden Bänder über Eck — daran erkennt man eine Kiste sofort. */}
      <path
        d={`M ${rand} ${rand} L ${groesse - rand} ${groesse - rand}
            M ${groesse - rand} ${rand} L ${rand} ${groesse - rand}`}
        stroke={aufZiel ? '#fde68a' : '#92400e'}
        strokeWidth={groesse * 0.06}
        opacity={0.9}
      />
      {/* Lichtkante oben. */}
      <path
        d={`M ${rand * 1.6} ${rand * 1.8} H ${groesse - rand * 1.6}`}
        stroke="#ffffff"
        strokeWidth={groesse * 0.05}
        strokeLinecap="round"
        opacity={0.35}
      />
    </g>
  );
}

/** Der Schieber. Bewusst schlicht — die Kisten sind der Star. */
function Schieber({ x, y, groesse }: { x: number; y: number; groesse: number }) {
  const m = groesse / 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={m} cy={groesse * 0.86} rx={groesse * 0.3} ry={groesse * 0.09} opacity={0.28} />
      <circle cx={m} cy={groesse * 0.34} r={groesse * 0.2} fill="#38bdf8" />
      <circle cx={m - groesse * 0.06} cy={groesse * 0.3} r={groesse * 0.05} fill="#ffffff" opacity={0.8} />
      <rect
        x={m - groesse * 0.19}
        y={groesse * 0.5}
        width={groesse * 0.38}
        height={groesse * 0.32}
        rx={groesse * 0.12}
        fill="#2563eb"
      />
    </g>
  );
}

export function BoxPush({ onScore, onGameOver, bestScore, istErsteRunde, level: festesLevel }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(festesLevel ?? naechstesLevel));
  const gemeldet = useRef(false);
  const { breite, hoehe, wand, ziel } = z.brett;

  const beiRichtung = useCallback((richtung: Richtung) => {
    setZ((alt) => {
      const neu = gehen(alt, richtung);
      if (neu === alt) return alt;
      // Ein Schub klingt anders als ein Schritt — daran hört man, dass man
      // gerade etwas bewegt hat, ohne hinzusehen.
      sfx(neu.kisten !== alt.kisten ? 'gut' : 'klick');
      return neu;
    });
  }, []);

  useInput(
    (aktion) => {
      if (aktion === 'up') beiRichtung('oben');
      else if (aktion === 'down') beiRichtung('unten');
      else if (aktion === 'left') beiRichtung('links');
      else if (aktion === 'right') beiRichtung('rechts');
    },
    { aktiv: gestartet && !z.geloest },
  );

  useEffect(() => {
    onScore(z.geloest ? punkteFuerZuege(z.level, z.zuege) : 0);
  }, [z.geloest, z.level, z.zuege, onScore]);

  useEffect(() => {
    if (!z.geloest || gemeldet.current) return;
    gemeldet.current = true;
    sfx('stufe');
    if (festesLevel === undefined) naechstesLevel = z.level + 1;
    // Kurz stehen lassen: Der Augenblick, in dem die letzte Kiste einrastet,
    // ist das, worauf man hingearbeitet hat.
    const uhr = window.setTimeout(() => onGameOver(punkteFuerZuege(z.level, z.zuege), true), 800);
    return () => window.clearTimeout(uhr);
  }, [z.geloest, z.level, z.zuege, onGameOver]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Box Push"
        untertitel="Schieb jede Kiste auf ein Zielfeld. Ziehen geht nicht — überleg vorher."
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #b45309 0%, #78350f 45%, #1c1917 100%)"
        deko={DEKO}
        Symbol={KistenIcon}
        knopfFarbe="#78350f"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const geschafft = z.kisten.filter((k) => ziel[k]).length;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 px-3 pt-2">
      <div className="flex w-full max-w-md items-baseline justify-between text-sm">
        <span className="font-semibold text-gedaempft">
          Level {((z.level - 1) % LEVEL_ANZAHL) + 1} von {LEVEL_ANZAHL}
        </span>
        <span className="text-gedaempft tabular-nums">
          {geschafft}/{z.kisten.length} Kisten · {z.zuege} Züge
        </span>
      </div>

      <div className="spielbuehne">
        <svg
          viewBox={`0 0 ${breite * FELD} ${hoehe * FELD}`}
          className="spielbrett spielbrett-rahmen select-none"
          style={{ '--vz': breite / hoehe } as CSSProperties}
          role="img"
          aria-label={`Box Push, Level ${z.level}. ${geschafft} von ${z.kisten.length} Kisten auf dem Ziel, ${z.zuege} Züge.`}
        >
          {/* Boden und Wände */}
          {Array.from({ length: breite * hoehe }, (_, f) => {
            const { x, y } = alsPunkt(f, breite);
            if (wand[f]) {
              return (
                <g key={f}>
                  <rect x={x * FELD} y={y * FELD} width={FELD} height={FELD} fill="#3f3f46" />
                  <rect
                    x={x * FELD + 0.6}
                    y={y * FELD + 0.6}
                    width={FELD - 1.2}
                    height={FELD - 1.2}
                    rx={1}
                    fill="#52525b"
                  />
                </g>
              );
            }
            return (
              <rect
                key={f}
                x={x * FELD}
                y={y * FELD}
                width={FELD}
                height={FELD}
                fill={y % 2 === x % 2 ? '#1c1917' : '#231f1c'}
              />
            );
          })}

          {/* Zielfelder — als Ring, damit eine daraufstehende Kiste sie nicht
              verdeckt und man immer sieht, wie viele noch frei sind. */}
          {ziel.map((istZiel, f) => {
            if (!istZiel) return null;
            const { x, y } = alsPunkt(f, breite);
            return (
              <circle
                key={`z${f}`}
                cx={x * FELD + FELD / 2}
                cy={y * FELD + FELD / 2}
                r={FELD * 0.22}
                fill="none"
                stroke="#facc15"
                strokeWidth={FELD * 0.09}
                opacity={0.8}
              />
            );
          })}

          {z.kisten.map((f) => {
            const { x, y } = alsPunkt(f, breite);
            return (
              <Kiste key={`k${f}`} x={x * FELD} y={y * FELD} groesse={FELD} aufZiel={!!ziel[f]} />
            );
          })}

          <Schieber x={z.spieler.x * FELD} y={z.spieler.y * FELD} groesse={FELD} />
        </svg>
      </div>

      <div className="flex items-center gap-3">
        {/* Zurück ist hier kein Komfort, sondern Teil der Regeln: Ohne ihn
            müsste ein Kind bei jeder verschobenen Kiste von vorn anfangen. */}
        <button
          type="button"
          onClick={() => {
            setZ((alt) => {
              const neu = zurueck(alt);
              if (neu !== alt) sfx('klick');
              return neu;
            });
          }}
          disabled={z.verlauf.length === 0 || z.geloest}
          className="spielknopf text-sm font-medium"
        >
          <span aria-hidden="true">↶</span> Zurück
        </button>

        {/* Das Steuerkreuz spricht die vier englischen Richtungen der
            Bausteine; die Spiellogik hier die deutschen. Übersetzt wird an
            genau dieser einen Stelle. */}
        <Steuerkreuz
          onRichtung={(r) =>
            beiRichtung(
              r === 'up' ? 'oben' : r === 'down' ? 'unten' : r === 'left' ? 'links' : 'rechts',
            )
          }
          aktiv={!z.geloest}
          kompakt
        />

        <button
          type="button"
          onClick={() => setZ((alt) => neustart(alt))}
          disabled={z.geloest}
          className="spielknopf text-sm font-medium"
        >
          <span aria-hidden="true">⟳</span> Neu
        </button>
      </div>

      <p className="nur-bei-platz max-w-md text-center text-xs text-gedaempft">
        Wischen oder die Pfeile benutzen. Kisten lassen sich nur <strong>schieben</strong>, nie
        ziehen — eine Kiste in der Ecke bleibt dort. Dafür gibt es „Zurück", so oft du willst.
      </p>
    </div>
  );
}
