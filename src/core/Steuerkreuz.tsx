import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

const VERZOEGERUNG = 170; // ms bis zur ersten Wiederholung — wie bei gehaltener Taste
const TAKT = 45; // ms zwischen den weiteren Wiederholungen

/**
 * Absichtlich nur diese vier. Reihenfall (das erste Spiel mit Drehen/hartem
 * Fallen/Halten) benutzt dafür lieber `useInput`s Wischen/Tastatur plus
 * eigene, klar beschriftete Knöpfe — eine Erweiterung hier hätte den
 * gemeinsamen Baustein für alle anderen Spiele mit angefasst.
 */
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
      // Ohne Kasten drumherum: Der Rahmen brauchte Platz und Aufmerksamkeit,
      // ohne etwas zu erklären — der Pfeil allein ist eindeutig. Die
      // Trefffläche bleibt mit 48 Pixeln über Apples Mindestmaß, das Kreuz
      // ist dadurch aber rund 80 Pixel flacher. Bei Ghost Chase war es
      // vorher höher als das Labyrinth selbst.
      className="grid size-12 touch-none select-none place-items-center text-3xl text-text/80 transition-transform active:scale-90 active:text-text disabled:opacity-30"
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );

  const platz = <div className="size-12" aria-hidden="true" />;

  return (
    <div
      className="grid grid-cols-3 grid-rows-3 gap-0.5"
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
