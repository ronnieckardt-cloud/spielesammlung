import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

const VERZOEGERUNG = 170; // ms bis zur ersten Wiederholung — wie bei gehaltener Taste
const TAKT = 45; // ms zwischen den weiteren Wiederholungen
/** Radius um die Kreuzmitte, in dem nichts ausgelöst wird. Ohne ihn löst
 *  schon ein versehentlich aufgelegter Daumen eine zufällige Richtung aus. */
const TOTBEREICH_PX = 14;

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

  const halten = useCallback(
    (richtung: Richtung) => {
      loslassen();
      onRichtung(richtung);
      start.current = window.setTimeout(() => {
        folge.current = window.setInterval(() => onRichtung(richtung), TAKT);
      }, VERZOEGERUNG);
    },
    [loslassen, onRichtung],
  );

  const druecken = (richtung: Richtung) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    halten(richtung);
  };

  /**
   * Die ganze Kreuzfläche nimmt Berührungen an, nicht nur die vier Pfeile.
   *
   * Vorher war das Kreuz ein 3×3-Raster, in dem fünf von neun Feldern leer
   * waren: Wer die Ecke zwischen „oben" und „rechts" traf, löste nichts
   * aus — auf einem 144 Pixel großen Kreuz über die halbe Fläche. Jetzt
   * entscheidet der **Winkel zur Mitte**, welche Richtung gemeint war.
   *
   * Die Mitte selbst bleibt tot (kleiner Totbereich), sonst löst schon ein
   * versehentliches Auflegen des Daumens eine zufällige Richtung aus.
   */
  const aufFlaeche = (e: PointerEvent<HTMLDivElement>) => {
    if (!aktiv) return;
    // Ein Pfeil-Knopf behandelt sich selbst.
    if (e.target instanceof Element && e.target.closest('button')) return;
    e.preventDefault();

    const kasten = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (kasten.left + kasten.width / 2);
    const dy = e.clientY - (kasten.top + kasten.height / 2);
    if (Math.hypot(dx, dy) < TOTBEREICH_PX) return;

    if (Math.abs(dx) > Math.abs(dy)) halten(dx > 0 ? 'right' : 'left');
    else halten(dy > 0 ? 'down' : 'up');
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
      className="grid touch-none grid-cols-3 grid-rows-3 gap-0.5 select-none"
      style={{ touchAction: 'none' }}
      role="group"
      aria-label="Steuerkreuz"
      onPointerDown={aufFlaeche}
      onPointerUp={loslassen}
      onPointerLeave={loslassen}
      onPointerCancel={loslassen}
      onContextMenu={(e) => e.preventDefault()}
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
