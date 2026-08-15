import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import { istWand, schluessel } from './labyrinth';
import { STARTLEBEN, neuesSpiel, richtungEingeben, zeitFortschritt } from './logik';
import type { Richtung, Zustand } from './logik';
import { GEIST_FARBEN, PILLE_FARBE, PUNKT_FARBE, WAND_FARBE } from './farben';
import { Geist, Spieler } from './figuren';

const ZELLE_PX = 18;

const istRichtung = (wert: string): wert is Richtung =>
  wert === 'up' || wert === 'down' || wert === 'left' || wert === 'right';

export function Geisterjagd({ onScore, onGameOver, settings }: GameProps) {
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('geisterjagd', Date.now())));
  const bereich = useRef<HTMLDivElement>(null);

  const bewege = useCallback(
    (richtung: Richtung) => setZ((alt) => richtungEingeben(alt, richtung)),
    [],
  );

  useInput(
    (aktion) => {
      if (!istRichtung(aktion)) return;
      bewege(aktion);
    },
    { bereich, aktiv: !z.vorbei },
  );

  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), { fps: 60, running: !z.vorbei });

  useEffect(() => {
    onScore(z.score);
  }, [z.score, onScore]);

  const vorScoreRef = useRef(z.score);
  useEffect(() => {
    const differenz = z.score - vorScoreRef.current;
    vorScoreRef.current = z.score;
    if (differenz >= 200) sfx('stufe'); // Geist gefressen
    else if (differenz >= 50) sfx('gut'); // Kraftpille
  }, [z.score]);

  const vorLebenRef = useRef(z.leben);
  useEffect(() => {
    if (z.leben < vorLebenRef.current) sfx('schlecht');
    vorLebenRef.current = z.leben;
  }, [z.leben]);

  const vorLevelRef = useRef(z.level);
  useEffect(() => {
    if (z.level > vorLevelRef.current) sfx('stufe');
    vorLevelRef.current = z.level;
  }, [z.level]);

  useEffect(() => {
    if (z.vorbei) onGameOver(z.score, z.gewonnen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const { breite, hoehe } = z.labyrinth;

  return (
    <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-4">
      <div className="flex items-center justify-center gap-6 text-sm text-gedaempft">
        <span>Level {z.level}</span>
        <span aria-label={`${z.leben} von ${STARTLEBEN} Leben`}>
          {'♥'.repeat(z.leben)}
          <span className="opacity-30">{'♥'.repeat(Math.max(0, STARTLEBEN - z.leben))}</span>
        </span>
      </div>

      <div
        ref={bereich}
        className="relative touch-none"
        style={{ width: breite * ZELLE_PX, height: hoehe * ZELLE_PX }}
        role="img"
        aria-label={`Labyrinth, Level ${z.level}, ${z.leben} Leben, ${z.score} Punkte.${z.gewonnen ? ' Alle Geister gefressen, gewonnen!' : z.vorbei ? ' Spiel vorbei.' : ''}`}
      >
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${breite}, ${ZELLE_PX}px)`,
            gridTemplateRows: `repeat(${hoehe}, ${ZELLE_PX}px)`,
          }}
        >
          {Array.from({ length: breite * hoehe }, (_, i) => {
            const x = i % breite;
            const y = Math.floor(i / breite);
            const wand = istWand(z.labyrinth, x, y);
            const schl = schluessel(x, y);
            const hatPunkt = z.punkte.has(schl);
            const hatPille = z.kraftpillen.has(schl);
            return (
              <div key={i} className="relative">
                {wand && (
                  <div className="absolute inset-[1px] rounded-[3px]" style={{ backgroundColor: WAND_FARBE }} />
                )}
                {hatPunkt && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="size-[5px] rounded-full" style={{ backgroundColor: PUNKT_FARBE }} />
                  </div>
                )}
                {hatPille && (
                  <div className="pulsiert absolute inset-0 grid place-items-center">
                    <svg viewBox="0 0 24 24" className="size-3.5" fill={PILLE_FARBE} aria-hidden="true">
                      <path d="M12 2l2.5 6.9H21l-5.6 4.4 2.1 7.1L12 16.2 6.5 20.4l2.1-7.1L3 8.9h6.5z" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="absolute transition-transform duration-100 ease-linear"
          style={{
            width: ZELLE_PX,
            height: ZELLE_PX,
            transform: `translate(${z.spieler.position.x * ZELLE_PX}px, ${z.spieler.position.y * ZELLE_PX}px)`,
          }}
        >
          <Spieler richtung={z.spieler.richtung} />
        </div>

        {z.geister.map((g) => (
          <div
            key={g.id}
            className="absolute transition-transform duration-100 ease-linear"
            style={{
              width: ZELLE_PX,
              height: ZELLE_PX,
              transform: `translate(${g.position.x * ZELLE_PX}px, ${g.position.y * ZELLE_PX}px)`,
            }}
          >
            <Geist
              modus={g.modus}
              farbe={GEIST_FARBEN[g.id]!}
              blinkt={g.modus === 'angst' && g.angstZeitRest < 2 && Math.floor(g.angstZeitRest * 5) % 2 === 0}
            />
          </div>
        ))}
      </div>

      <Steuerkreuz onRichtung={bewege} aktiv={!z.vorbei} />

      <p className="max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder das Kreuz oben bewegen. Die großen Sterne
        machen die Geister kurz ängstlich — dann kannst du sie fangen. Frisst
        du alle vier auf einmal, ist die Runde sofort gewonnen!
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
