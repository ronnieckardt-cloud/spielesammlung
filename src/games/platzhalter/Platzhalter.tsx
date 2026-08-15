import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { saatAus } from '../../core/rng';
import { sfx } from '../../core/sfx';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { PlatzhalterIcon } from './Icon';
import { bewegen, neuesSpiel, START_ZEIT, zeitLaufen } from './logik';
import type { Richtung } from './logik';
import { Sternenschlucker } from './Figur';

const AKZENT = '#7dd3fc';
const ZIEL_FARBE = '#f0b429';
/** Die Spielfigur ist ein erfundenes Wesen, siehe `Figur.tsx`. */
const FIGUR_NAME = 'Sternenschlucker';

const istRichtung = (wert: string): wert is Richtung =>
  wert === 'up' || wert === 'down' || wert === 'left' || wert === 'right';

/**
 * Platzhalter-Spiel: Sammle möglichst viele Sterne, bevor die Zeit abläuft.
 *
 * Der Zweck ist nicht das Spiel, sondern der Beweis, dass die Schnittstelle
 * trägt: Es benutzt alle vier gemeinsamen Bausteine (Uhr, Eingabe, Zufall,
 * Ton) und meldet Punkte und Ende ausschließlich über seine Props.
 */
/** Sterne und kleine Sternenschlucker als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 9, y: 13, winkel: -12, verzoegerung: 0, inhalt: <Stern groesse={26} /> },
  { x: 85, y: 10, winkel: 14, verzoegerung: 0.6, inhalt: <Stern groesse={18} /> },
  { x: 88, y: 72, winkel: -8, verzoegerung: 1.2, inhalt: <Sternenschlucker groesse={44} /> },
  { x: 5, y: 74, winkel: 10, verzoegerung: 0.35, inhalt: <Stern groesse={22} /> },
  { x: 92, y: 42, winkel: 20, verzoegerung: 1.6, inhalt: <Stern groesse={15} /> },
  { x: 3, y: 44, winkel: -22, verzoegerung: 0.9, inhalt: <Sternenschlucker groesse={34} /> },
];

/** Ein einzelner Stern fürs Titelbild. */
function Stern({ groesse }: { groesse: number }) {
  return (
    <svg viewBox="0 0 24 24" width={groesse} height={groesse} fill={ZIEL_FARBE} aria-hidden="true">
      <path d="M12 2l2.5 6.9H21l-5.6 4.4 2.1 7.1L12 16.2 6.5 20.4l2.1-7.1L3 8.9h6.5z" />
    </svg>
  );
}

export function Platzhalter({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState(() => neuesSpiel(saatAus('platzhalter', Date.now())));
  const brett = useRef<HTMLDivElement>(null);

  // Von Tastatur, Wischen und dem Steuerkreuz benutzt — ein Weg für alle drei.
  const bewege = useCallback((richtung: Richtung) => setZ((alt) => bewegen(alt, richtung)), []);

  useInput(
    (aktion) => {
      if (!istRichtung(aktion)) return;
      bewege(aktion);
    },
    { bereich: brett, wiederholen: ['up', 'down', 'left', 'right'], aktiv: gestartet && !z.vorbei },
  );

  useGameLoop((dt) => setZ((alt) => zeitLaufen(alt, dt)), { fps: 20, running: gestartet && !z.vorbei });

  useEffect(() => {
    onScore(z.punkte);
    if (z.punkte > 0) sfx('gut');
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte);
    }
    // onGameOver darf nur einmal kommen — deshalb hängt das nur an "vorbei".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Star Dash"
        untertitel="Fang die Sterne, bevor die Zeit abläuft!"
        bestScore={bestScore}
        verlauf="linear-gradient(165deg, #1e1b4b 0%, #1d4ed8 45%, #0ea5e9 100%)"
        deko={DEKO}
        Symbol={PlatzhalterIcon}
        knopfFarbe="#1d4ed8"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const anteil = Math.max(0, Math.min(1, z.restZeit / START_ZEIT));
  const knapp = z.restZeit <= 5;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden p-3 spielseite">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-baseline justify-between text-sm text-gedaempft">
          <span>Zeit</span>
          <span className="tabular-nums">{z.restZeit.toFixed(1)} s</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-flaeche-hoch"
          role="progressbar"
          aria-label="Verbleibende Zeit"
          aria-valuemin={0}
          aria-valuemax={Math.round(START_ZEIT)}
          aria-valuenow={Math.round(z.restZeit)}
        >
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${anteil * 100}%`, backgroundColor: knapp ? ZIEL_FARBE : AKZENT }}
          />
        </div>
      </div>

      <div className="spielbuehne">
      <div
        ref={brett}
        className="spielbrett spielbrett-rahmen grid touch-none gap-2 p-1.5"
        style={
          {
            gridTemplateColumns: `repeat(${z.breite}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${z.hoehe}, minmax(0, 1fr))`,
            '--vz': z.breite / z.hoehe,
          } as CSSProperties
        }
        role="img"
        aria-label={`Spielfeld. Dein ${FIGUR_NAME} ist in Reihe ${z.spieler.y + 1}, Spalte ${z.spieler.x + 1}. Der Stern ist in Reihe ${z.ziel.y + 1}, Spalte ${z.ziel.x + 1}.`}
      >
        {Array.from({ length: z.breite * z.hoehe }, (_, i) => {
          const x = i % z.breite;
          const y = Math.floor(i / z.breite);
          const istSpieler = x === z.spieler.x && y === z.spieler.y;
          const istZiel = x === z.ziel.x && y === z.ziel.y;
          return (
            <div
              key={i}
              aria-hidden="true"
              className="grid place-items-center overflow-visible rounded-xl border border-rand bg-flaeche"
              style={
                istSpieler
                  ? { borderColor: AKZENT }
                  : istZiel
                    ? { borderColor: ZIEL_FARBE }
                    : undefined
              }
            >
              {/* Größer als die Kachel, damit das Tier wie eine Figur wirkt
                  und nicht wie ein Symbol in einer Box. */}
              {istSpieler && <Sternenschlucker />}
              {/* Nur der Stern pulsiert, nicht die Kachel drum herum. */}
              {istZiel && (
                <span className="pulsiert text-2xl" style={{ color: ZIEL_FARBE }}>
                  ★
                </span>
              )}
            </div>
          );
        })}
      </div>
      </div>

      <Steuerkreuz onRichtung={bewege} aktiv={!z.vorbei} />

      <p className="nur-bei-platz max-w-sm text-center text-sm text-gedaempft">
        Fang mit deinem {FIGUR_NAME} die Sterne ein, bevor die Zeit abläuft.
        <br />
        Pfeiltasten, das Kreuz unten oder wischen.
      </p>

      <p className="sr-only" aria-live="polite">
        {z.punkte} Punkte
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
