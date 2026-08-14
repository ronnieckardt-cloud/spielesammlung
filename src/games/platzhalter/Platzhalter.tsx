import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { saatAus } from '../../core/rng';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { bewegen, neuesSpiel, START_ZEIT, zeitLaufen } from './logik';
import type { Richtung } from './logik';

const AKZENT = '#7dd3fc';
const ZIEL_FARBE = '#f0b429';
const KATZE_FARBE = '#f5c518';
const TIER_NAME = 'Katze';

const istRichtung = (wert: string): wert is Richtung =>
  wert === 'up' || wert === 'down' || wert === 'left' || wert === 'right';

/**
 * Rundliche, gelbe Form mit angedeutetem Mund und Katzenohren — auf
 * ausdrücklichen Wunsch, obwohl das eigentlich der Projektregel "keine
 * gelbe Kreisfigur" widerspricht. Bleibt durch die Ohren als Katze lesbar.
 */
function KatzenGesicht() {
  return (
    <svg viewBox="0 0 100 100" width="46" height="46" className="drop-shadow-lg">
      <polygon points="24,24 14,2 37,17" fill={KATZE_FARBE} />
      <polygon points="63,17 86,2 76,24" fill={KATZE_FARBE} />
      <path d="M50,50 L88.97,27.5 A45,45 0 1 0 88.97,72.5 Z" fill={KATZE_FARBE} />
      <circle cx="46" cy="38" r="4" fill="#4a3708" />
    </svg>
  );
}

/**
 * Platzhalter-Spiel: Sammle möglichst viele Sterne, bevor die Zeit abläuft.
 *
 * Der Zweck ist nicht das Spiel, sondern der Beweis, dass die Schnittstelle
 * trägt: Es benutzt alle vier gemeinsamen Bausteine (Uhr, Eingabe, Zufall,
 * Ton) und meldet Punkte und Ende ausschließlich über seine Props.
 */
export function Platzhalter({ onScore, onGameOver, settings }: GameProps) {
  const [z, setZ] = useState(() => neuesSpiel(saatAus('platzhalter', Date.now())));
  const brett = useRef<HTMLDivElement>(null);

  // Von Tastatur, Wischen und dem Steuerkreuz benutzt — ein Weg für alle drei.
  const bewege = useCallback((richtung: Richtung) => setZ((alt) => bewegen(alt, richtung)), []);

  useInput(
    (aktion) => {
      if (!istRichtung(aktion)) return;
      bewege(aktion);
    },
    { bereich: brett, wiederholen: ['up', 'down', 'left', 'right'], aktiv: !z.vorbei },
  );

  useGameLoop((dt) => setZ((alt) => zeitLaufen(alt, dt)), { fps: 20, running: !z.vorbei });

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

  const anteil = Math.max(0, Math.min(1, z.restZeit / START_ZEIT));
  const knapp = z.restZeit <= 5;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4">
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

      <div
        ref={brett}
        className="grid w-full max-w-sm touch-none gap-2"
        style={{ gridTemplateColumns: `repeat(${z.breite}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Spielfeld. Deine ${TIER_NAME} ist in Reihe ${z.spieler.y + 1}, Spalte ${z.spieler.x + 1}. Der Stern ist in Reihe ${z.ziel.y + 1}, Spalte ${z.ziel.x + 1}.`}
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
              className="grid aspect-square place-items-center overflow-visible rounded-xl border border-rand bg-flaeche"
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
              {istSpieler && <KatzenGesicht />}
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

      <Steuerkreuz onRichtung={bewege} aktiv={!z.vorbei} />

      <p className="max-w-sm text-center text-sm text-gedaempft">
        Fang mit deiner {TIER_NAME} die Sterne ein, bevor die Zeit abläuft.
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
