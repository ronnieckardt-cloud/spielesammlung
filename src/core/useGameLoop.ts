import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Die Spieluhr: ruft update mit festem Zeitschritt auf.
 *
 * Fester Schritt heißt: update bekommt immer dieselbe Zeitspanne, egal wie
 * schnell der Bildschirm ist. Ohne das läuft ein Spiel auf einem 120-Hz-Gerät
 * doppelt so schnell wie auf einem 60-Hz-Gerät.
 *
 * Pausiert von selbst, wenn der Tab in den Hintergrund geht, und holt die
 * verpasste Zeit danach nicht auf.
 */

export const MAX_VERGANGEN = 250; // ms — längere Lücken werden nicht aufgeholt
export const MAX_SCHRITTE = 5; // pro Bild — sonst überholt sich die Uhr selbst

/**
 * Rechenkern der Uhr, ohne Browser: Wie viele feste Schritte sind fällig,
 * und wie viel Zeit bleibt für das nächste Bild übrig?
 *
 * Hier steckt das Knifflige, deshalb ist es eine reine Funktion mit Tests:
 * lange Pausen abschneiden, angebrochene Schritte aufheben und nicht endlos
 * nachholen, wenn ein Bild einmal zu lange gedauert hat.
 */
export function takt(
  vergangen: number,
  rest: number,
  schrittMs: number,
): { schritte: number; rest: number } {
  const begrenzt = Math.min(Math.max(vergangen, 0), MAX_VERGANGEN);
  const angesammelt = rest + begrenzt;
  const faellig = Math.floor(angesammelt / schrittMs);

  // Zu viel auf einmal: den Überhang wegwerfen statt hinterherzuhetzen.
  if (faellig > MAX_SCHRITTE) return { schritte: MAX_SCHRITTE, rest: 0 };

  return { schritte: faellig, rest: angesammelt - faellig * schrittMs };
}

/** Meldet, ob der Tab gerade sichtbar ist. */
export function useTabSichtbar(): boolean {
  return useSyncExternalStore(
    (melden) => {
      document.addEventListener('visibilitychange', melden);
      return () => document.removeEventListener('visibilitychange', melden);
    },
    () => !document.hidden,
    () => true,
  );
}

type Optionen = {
  /** Schritte pro Sekunde. Rastermäßige Spiele kommen mit 20 bis 30 aus. */
  fps?: number;
  /** Auf false setzen, solange nicht gespielt wird (Spielende, Menü). */
  running?: boolean;
};

export function useGameLoop(
  update: (dt: number) => void,
  { fps = 60, running = true }: Optionen = {},
): { laeuft: boolean } {
  // update darf sich bei jedem Rendern ändern, ohne die Uhr neu zu starten.
  const updateRef = useRef(update);
  updateRef.current = update;

  const sichtbar = useTabSichtbar();
  const laeuft = running && sichtbar;

  useEffect(() => {
    if (!laeuft) return;

    const schrittMs = 1000 / fps;
    const dt = schrittMs / 1000;
    let letzte = performance.now();
    let rest = 0;
    let anforderung = 0;

    const bild = (jetzt: number) => {
      anforderung = requestAnimationFrame(bild);

      const ergebnis = takt(jetzt - letzte, rest, schrittMs);
      letzte = jetzt;
      rest = ergebnis.rest;

      for (let i = 0; i < ergebnis.schritte; i++) updateRef.current(dt);
    };

    anforderung = requestAnimationFrame(bild);
    return () => cancelAnimationFrame(anforderung);
  }, [fps, laeuft]);

  return { laeuft };
}
