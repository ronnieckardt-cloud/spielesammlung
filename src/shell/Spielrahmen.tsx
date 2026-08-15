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
    <div
      // Genau eine Bildschirmhöhe, nicht mehr: Ohne feste Höhe wächst der
      // Rahmen mit seinem Inhalt und schiebt die unterste Reihe aus dem
      // Bild — bei textlastigen Spielen den Weiter-Knopf.
      className="mx-auto flex h-dvh min-h-0 w-full max-w-3xl flex-col overflow-hidden"
    >
      <header
        className="flex items-center gap-3 border-b border-rand px-4 pb-3"
        // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onExit}
          className="spielknopf rounded-lg border border-rand bg-flaeche px-3 py-2 text-sm font-medium hover:bg-flaeche-hoch"
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

      <main className="relative flex min-h-0 flex-1 flex-col">
        <Spiel
          key={runde}
          onScore={beiPunkten}
          onGameOver={beiEnde}
          onExit={onExit}
          settings={einstellungen}
          bestScore={beste}
          istErsteRunde={runde === 0}
        />

        {ende && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Spiel beendet"
            className="dialog-grund-auf absolute inset-0 grid place-items-center bg-grund/85 p-4 backdrop-blur-sm"
          >
            {/* Der Moment, in dem man auf sein Ergebnis schaut — deshalb in
                der Farbe des Spiels statt im grauen Systemkasten. */}
            <div
              className="dialog-auf w-full max-w-sm rounded-karte p-6 text-center shadow-2xl ring-1 ring-white/15"
              style={{
                background: `linear-gradient(160deg, color-mix(in srgb, ${spiel.accent} 34%, var(--color-flaeche)), var(--color-flaeche) 70%)`,
              }}
            >
              <h2 className="text-xl font-black tracking-tight">
                {ende.gewonnen ? '🎉 Gewonnen!' : 'Vorbei'}
              </h2>
              <p
                className="punkte-bumsen mt-2 text-6xl leading-none font-black tabular-nums"
                style={{ color: spiel.accent, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
              >
                {ende.punkte}
              </p>
              {ende.rekord ? (
                <p className="mt-3 text-base font-bold" style={{ color: '#facc15' }}>
                  ★ Neue Bestleistung!
                </p>
              ) : (
                <p className="mt-3 text-sm text-gedaempft">Beste Punktzahl: {ende.beste}</p>
              )}
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  autoFocus
                  onClick={nochmal}
                  className="rounded-xl px-4 py-3.5 text-lg font-extrabold text-grund transition-transform active:scale-95"
                  style={{ backgroundColor: spiel.accent }}
                >
                  Nochmal
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-medium transition-transform hover:bg-white/10 active:scale-95"
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
