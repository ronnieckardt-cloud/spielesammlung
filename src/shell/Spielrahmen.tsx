import { useCallback, useEffect, useRef, useState } from 'react';
import type { Einstellungen, GameApi } from '../core/types';
import { bestwert, ergebnisEintragen } from './speicher';

type Ende = { punkte: number; beste: number; rekord: boolean; gewonnen: boolean };

/**
 * Rahmen um ein laufendes Spiel: Kopfzeile mit Punktestand und Zurück-Knopf,
 * Eintrag in die Bestenliste am Ende, Neustart.
 *
 * Das Spiel selbst bekommt davon nichts mit — es meldet nur Punkte und
 * Spielende über seine Props.
 */
export function Spielrahmen({
  spiel,
  einstellungen,
  onExit,
}: {
  spiel: GameApi;
  einstellungen: Einstellungen;
  onExit: () => void;
}) {
  const [punkte, setPunkte] = useState(0);
  const [runde, setRunde] = useState(0);
  const [ende, setEnde] = useState<Ende | null>(null);

  // Schutz davor, dass ein Spiel das Ende versehentlich zweimal meldet.
  const rundeLaeuft = useRef(true);

  const beiPunkten = useCallback((wert: number) => setPunkte(wert), []);

  const beiEnde = useCallback(
    (wert: number, gewonnen = false) => {
      if (!rundeLaeuft.current) return;
      rundeLaeuft.current = false;

      const vorher = bestwert(spiel.id);
      const liste = ergebnisEintragen(spiel.id, wert);
      setPunkte(wert);
      setEnde({ punkte: wert, beste: liste[0]?.punkte ?? wert, rekord: wert > vorher, gewonnen });
    },
    [spiel.id],
  );

  const nochmal = useCallback(() => {
    rundeLaeuft.current = true;
    setEnde(null);
    setPunkte(0);
    setRunde((r) => r + 1);
  }, []);

  // Escape führt immer zurück ins Menü.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [onExit]);

  const Spiel = spiel.Component;
  // Frisch bei jedem Rendern gelesen (billige, synchrone localStorage-
  // Abfrage) — nach beiEnde() steht der neue Rekord schon drin, bevor
  // dieser Wert das nächste Mal gebraucht wird.
  const beste = bestwert(spiel.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <header
        className="flex items-center gap-3 border-b border-rand px-4 pb-3"
        // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-rand bg-flaeche px-3 py-2 text-sm font-medium hover:bg-flaeche-hoch"
        >
          <span aria-hidden="true">←</span> Zurück
        </button>
        <h1 className="min-w-0 flex-1 truncate font-semibold" style={{ color: spiel.accent }}>
          {spiel.title}
        </h1>
        <p className="text-right text-sm text-gedaempft">
          Punkte{' '}
          <output aria-live="polite" className="text-base font-bold text-text tabular-nums">
            {punkte}
          </output>
        </p>
      </header>

      <main className="relative flex flex-1 flex-col">
        <Spiel
          key={runde}
          onScore={beiPunkten}
          onGameOver={beiEnde}
          onExit={onExit}
          settings={einstellungen}
          bestScore={beste}
        />

        {ende && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Spiel beendet"
            className="absolute inset-0 grid place-items-center bg-grund/85 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-xs rounded-karte border border-rand bg-flaeche p-5 text-center">
              <h2 className="text-lg font-bold">{ende.gewonnen ? '🎉 Gewonnen!' : 'Vorbei'}</h2>
              <p className="mt-3 text-4xl font-bold tabular-nums" style={{ color: spiel.accent }}>
                {ende.punkte}
              </p>
              <p className="mt-1 text-sm text-gedaempft">
                {ende.rekord ? '★ Neue Bestleistung!' : `Beste Punktzahl: ${ende.beste}`}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={nochmal}
                  className="rounded-lg px-4 py-3 font-semibold text-grund"
                  style={{ backgroundColor: spiel.accent }}
                >
                  Nochmal
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-lg border border-rand px-4 py-3 hover:bg-flaeche-hoch"
                >
                  Zurück zum Menü
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
