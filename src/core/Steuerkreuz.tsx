import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

const VERZOEGERUNG = 170; // ms bis zur ersten Wiederholung — wie bei gehaltener Taste
const TAKT = 45; // ms zwischen den weiteren Wiederholungen

/** Absichtlich nur diese vier — rotate/drop/select kommen erst mit Reihenfall dazu. */
type Richtung = 'up' | 'down' | 'left' | 'right';

/**
 * Vier Tasten zum Antippen, als Ergänzung zum Wischen.
 *
 * Auf dem Handy ist eine Wischgeste manchen zu ungenau oder zu langsam —
 * eine Taste reagiert sofort. Gedrückt halten wiederholt die Richtung,
 * genau wie eine gehaltene Pfeiltaste auf der Tastatur.
 */
export function Steuerkreuz({
  onRichtung,
  aktiv = true,
}: {
  onRichtung: (richtung: Richtung) => void;
  aktiv?: boolean;
}) {
  const start = useRef<number | undefined>(undefined);
  const folge = useRef<number | undefined>(undefined);

  const loslassen = useCallback(() => {
    window.clearTimeout(start.current);
    window.clearInterval(folge.current);
  }, []);

  // Aufräumen, wenn das Spiel endet, während eine Taste noch gehalten wird.
  useEffect(() => {
    if (!aktiv) loslassen();
  }, [aktiv, loslassen]);
  useEffect(() => loslassen, [loslassen]);

  const druecken = (richtung: Richtung) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    loslassen();
    onRichtung(richtung);
    start.current = window.setTimeout(() => {
      folge.current = window.setInterval(() => onRichtung(richtung), TAKT);
    }, VERZOEGERUNG);
  };

  const taste = (richtung: Richtung, beschriftung: string, symbol: string) => (
    <button
      type="button"
      aria-label={beschriftung}
      disabled={!aktiv}
      onPointerDown={druecken(richtung)}
      onPointerUp={loslassen}
      onPointerLeave={loslassen}
      onPointerCancel={loslassen}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-14 touch-none select-none place-items-center rounded-xl border border-rand bg-flaeche text-2xl active:bg-flaeche-hoch disabled:opacity-40"
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );

  const platz = <div className="size-14" aria-hidden="true" />;

  return (
    <div
      className="grid grid-cols-3 grid-rows-3 gap-2"
      style={{ touchAction: 'none' }}
      role="group"
      aria-label="Steuerkreuz"
    >
      {platz}
      {taste('up', 'Nach oben', '↑')}
      {platz}
      {taste('left', 'Nach links', '←')}
      {platz}
      {taste('right', 'Nach rechts', '→')}
      {platz}
      {taste('down', 'Nach unten', '↓')}
      {platz}
    </div>
  );
}
