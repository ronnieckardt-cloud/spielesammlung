import { useCallback, useEffect, useRef, useState } from 'react';
import type { Einstellungen, GameApi } from '../core/types';
import { bestwert, ergebnisEintragen, zuletztGespieltMerken } from './speicher';
import { ergebnisMelden } from './konto';
import { spielfarbenStil, toenung } from './spielfarbe';

type Ende = {
  punkte: number;
  beste: number;
  rekord: boolean;
  gewonnen: boolean;
  /** Platz unter allen Angemeldeten — kommt erst nach, wenn der Server antwortet. */
  platz?: { platz: number; teilnehmer: number };
};

/**
 * Rahmen um ein laufendes Spiel: Kopfzeile mit Punktestand und Zurück-Knopf,
 * Eintrag in die Bestenliste am Ende, Neustart.
 *
 * Das Spiel selbst bekommt davon nichts mit — es meldet nur Punkte und
 * Spielende über seine Props.
 */
/** Wie lange die Zahl braucht, um auf den neuen Wert zu laufen. */
const HOCHZAEHLEN_MS = 320;

/**
 * Lässt den Punktestand auf seinen neuen Wert **laufen**, statt zu springen.
 *
 * Sitzt bewusst in der Hülle und nicht in den Spielen: Eine Datei, und es
 * wirkt sofort in allen vierzehn. Bei Quiz Time (0 bis 10) sieht man kaum
 * etwas, bei Block Burst mit Sprüngen über 500 verändert es den Eindruck
 * deutlich.
 *
 * Läuft nur nach oben. Ein Rücksprung (neue Runde, Punktestand zurück auf 0)
 * wird sofort übernommen — eine rückwärts zählende Zahl sähe aus wie ein
 * Fehler.
 */
function useHochzaehlen(ziel: number, ruhig: boolean): number {
  const [gezeigt, setGezeigt] = useState(ziel);
  const vonRef = useRef(ziel);

  useEffect(() => {
    if (ruhig || ziel <= vonRef.current) {
      vonRef.current = ziel;
      setGezeigt(ziel);
      return;
    }
    const von = vonRef.current;
    const start = performance.now();
    let bild = 0;

    const schritt = (jetzt: number) => {
      const anteil = Math.min(1, (jetzt - start) / HOCHZAEHLEN_MS);
      // Am Anfang schnell, zum Ende hin langsam — das liest sich als
      // „läuft aus", nicht als gleichmäßiger Zähler.
      const weich = 1 - (1 - anteil) ** 3;
      setGezeigt(Math.round(von + (ziel - von) * weich));
      if (anteil < 1) bild = requestAnimationFrame(schritt);
      else vonRef.current = ziel;
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
  }, [ziel, ruhig]);

  return gezeigt;
}

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
  // Zählt jede beendete Runde. Eine spät eintreffende Antwort aus einer
  // früheren Runde darf nicht am Dialog der aktuellen kleben.
  const endeMarke = useRef(0);

  const beiPunkten = useCallback((wert: number) => setPunkte(wert), []);

  const beiEnde = useCallback(
    (wert: number, gewonnen = false) => {
      if (!rundeLaeuft.current) return;
      rundeLaeuft.current = false;

      const vorher = bestwert(spiel.id);
      const { liste, schluessel } = ergebnisEintragen(spiel.id, wert);
      setPunkte(wert);
      setEnde({ punkte: wert, beste: liste[0]?.punkte ?? wert, rekord: wert > vorher, gewonnen });

      // Der Platz kommt **nachträglich** dazu. Der Dialog steht sofort, ohne
      // auf das Netz zu warten — das ist der ganze Sinn der Warteschlange.
      // Ohne Konto oder ohne Netz kommt schlicht nichts zurück.
      const marke = ++endeMarke.current;
      void ergebnisMelden(schluessel).then((platz) => {
        if (platz && marke === endeMarke.current) {
          setEnde((alt) => (alt ? { ...alt, platz } : alt));
        }
      });
    },
    [spiel.id],
  );

  const nochmal = useCallback(() => {
    rundeLaeuft.current = true;
    setEnde(null);
    setPunkte(0);
    setRunde((r) => r + 1);
  }, []);

  // Fürs Weiterspielen-Angebot auf der Startseite. Bewusst beim **Betreten**
  // und nicht erst am Rundenende: Eine abgebrochene Runde ist beim Kind der
  // Normalfall, und genau dann will man beim nächsten Öffnen dort weitermachen.
  useEffect(() => {
    zuletztGespieltMerken(spiel.id);
  }, [spiel.id]);

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

  const farbe = toenung(spiel.id, spiel.accent);
  const gezeigtePunkte = useHochzaehlen(punkte, einstellungen.reducedMotion);

  return (
    <div
      // Genau eine Bildschirmhöhe, nicht mehr: Ohne feste Höhe wächst der
      // Rahmen mit seinem Inhalt und schiebt die unterste Reihe aus dem
      // Bild — bei textlastigen Spielen den Weiter-Knopf.
      className="mx-auto flex h-dvh min-h-0 w-full max-w-3xl flex-col overflow-hidden"
      // Färbt die vier Grundtokens leicht in der Spielfarbe ein. Wirkt
      // dadurch in jedem Element des Spiels, ohne dass ein Spiel etwas
      // davon wissen muss. Siehe `spielfarbe.ts`.
      style={spielfarbenStil(spiel.id, spiel.accent)}
    >
      <header
        className="flex items-center gap-3 px-4 pb-3"
        style={{
          // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
          // Genau hier passiert der Bruch: Die Kopfzeile ist das Erste, was
          // nach dem bunten Startbildschirm zu sehen ist. Statt grauer
          // Trennlinie ein flacher Verlauf in der Spielfarbe und eine
          // farbige Unterkante.
          background: `linear-gradient(180deg, color-mix(in srgb, ${farbe} 20%, transparent), transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${farbe} 40%, var(--color-rand))`,
        }}
      >
        <button
          type="button"
          onClick={onExit}
          className="spielknopf text-sm font-medium"
        >
          <span aria-hidden="true">←</span> Zurück
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" style={{ color: spiel.accent }}>
          {spiel.title}
        </h1>
        <p className="text-right text-sm text-gedaempft">
          Punkte{' '}
          <output aria-live="polite" className="text-base font-bold text-text tabular-nums">
            {/* Vorgelesen wird der echte Wert, angezeigt der hochzählende —
                sonst läse ein Screenreader jede Zwischenzahl mit. */}
            <span aria-hidden="true">{gezeigtePunkte}</span>
            <span className="sr-only">{punkte}</span>
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
            // `z-20` ist nicht schmückend, sondern nötig: `.spielbuehne > *`
            // gibt dem Brett `z-index: 1`, und ein positioniertes Element mit
            // Stufe 1 wird über einem mit `auto` gezeichnet — ganz gleich,
            // was weiter unten im Baum steht. Ohne diese Zeile lag das Brett
            // über dem Rundenende, in **jedem** Spiel mit Bühne.
            className="dialog-grund-auf absolute inset-0 z-20 grid place-items-center bg-grund/85 p-4 backdrop-blur-sm"
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

              {/* Kommt nach, sobald der Server geantwortet hat — und nur,
                  wenn jemand angemeldet ist. Der Auftritt ist bewusst
                  auffällig: Das ist der ganze Reiz daran, ein Konto zu haben.
                  „Platz 1" bekommt dazu einen eigenen Satz, „Platz 1 von 8"
                  liest sich sonst kleiner als es ist. */}
              {ende.platz && (
                <p className="dialog-auf mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">
                  {ende.platz.platz === 1 ? (
                    <>🥇 Du bist die Nummer 1 von {ende.platz.teilnehmer}!</>
                  ) : (
                    <>
                      Platz {ende.platz.platz} von {ende.platz.teilnehmer}
                    </>
                  )}
                </p>
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
