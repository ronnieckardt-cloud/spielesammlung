import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../core/sfx';
import { merkfolgeTippen } from './merkfolgen';
import type { MerkfolgenAufgabe } from './merkfolgen';

/** Eigene Farben und eigenes Layout (Raster, nicht die klassische Vierteil-Scheibe). */
const KACHELN: readonly { name: string; farbe: string }[] = [
  { name: 'Blau', farbe: '#3b82f6' },
  { name: 'Grün', farbe: '#22c55e' },
  { name: 'Gelb', farbe: '#eab308' },
  { name: 'Rot', farbe: '#ef4444' },
  { name: 'Lila', farbe: '#a855f7' },
  { name: 'Türkis', farbe: '#14b8a6' },
];

const ZEIGE_DAUER_MS = 550;
const PAUSE_DAUER_MS = 200;

type Phase = 'zeigen' | 'eingabe' | 'fertig';

export function MerkfolgenAnzeige({
  aufgabe,
  reducedMotion,
  onFertig,
}: {
  aufgabe: MerkfolgenAufgabe;
  reducedMotion: boolean;
  onFertig: (richtig: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>('zeigen');
  const [zeigeIndex, setZeigeIndex] = useState(-1);
  const [eingabe, setEingabe] = useState<readonly number[]>([]);
  const [letzterTipp, setLetzterTipp] = useState<{ index: number; richtig: boolean } | null>(null);
  const fertigGemeldet = useRef(false);

  // Folge automatisch der Reihe nach vorführen, dann zur Eingabe wechseln.
  useEffect(() => {
    const schrittDauer = reducedMotion ? 120 : ZEIGE_DAUER_MS;
    const pause = reducedMotion ? 60 : PAUSE_DAUER_MS;
    let abgebrochen = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function naechsterSchritt(i: number) {
      if (abgebrochen) return;
      if (i >= aufgabe.folge.length) {
        setZeigeIndex(-1);
        setPhase('eingabe');
        return;
      }
      setZeigeIndex(i);
      timeoutId = setTimeout(() => {
        if (abgebrochen) return;
        setZeigeIndex(-1);
        timeoutId = setTimeout(() => naechsterSchritt(i + 1), pause);
      }, schrittDauer);
    }
    timeoutId = setTimeout(() => naechsterSchritt(0), pause);

    return () => {
      abgebrochen = true;
      clearTimeout(timeoutId);
    };
    // aufgabe.folge steht schon durch die Remount-Konvention (key={level-index}) fest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beiTipp = (kachelIndex: number) => {
    if (phase !== 'eingabe') return;
    const { eingabe: neueEingabe, ergebnis } = merkfolgeTippen(aufgabe, eingabe, kachelIndex);
    setEingabe(neueEingabe);
    setLetzterTipp({ index: kachelIndex, richtig: ergebnis !== 'falsch' });
    sfx(ergebnis === 'falsch' ? 'schlecht' : 'klick');
    if (ergebnis !== 'lauft' && !fertigGemeldet.current) {
      fertigGemeldet.current = true;
      setPhase('fertig');
      onFertig(ergebnis === 'richtig');
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <p className="min-h-5 text-sm text-gedaempft" aria-live="polite">
        {phase === 'zeigen' && 'Merken …'}
        {phase === 'eingabe' && `Jetzt nachtippen (${eingabe.length} / ${aufgabe.folge.length})`}
        {phase === 'fertig' && (letzterTipp?.richtig === false ? 'Leider falsch' : 'Richtig!')}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {KACHELN.map((k, i) => {
          const leuchtet = phase === 'zeigen' && zeigeIndex >= 0 && aufgabe.folge[zeigeIndex] === i;
          const istLetzterTipp = letzterTipp?.index === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => beiTipp(i)}
              disabled={phase !== 'eingabe'}
              aria-label={k.name}
              className="h-20 w-20 rounded-xl border-4 transition-all duration-150 disabled:cursor-default"
              style={{
                backgroundColor: k.farbe,
                borderColor: istLetzterTipp ? (letzterTipp?.richtig ? '#22c55e' : '#ef4444') : 'transparent',
                opacity: phase !== 'zeigen' || leuchtet ? 1 : 0.4,
                transform: leuchtet ? 'scale(1.12)' : 'scale(1)',
                // Die vorgeführte Kachel wurde bisher nur um 8 % größer und
                // etwas heller — das ist die Kernmechanik dieses
                // Aufgabentyps und wirkte dafür viel zu lasch. Jetzt kommt
                // ein weißer Ring und deutlich mehr Helligkeit dazu.
                //
                // Als reiner Übergang, nicht als Keyframe-Animation: Unter
                // `.ruhig` entfällt dann nur die Überblendung, der Zustand
                // selbst bleibt richtig. Eine Kachel je 750 ms sind rund
                // 1,3 Hz und immer nur eine kleine Fläche — deutlich unter
                // der Grenze, ab der Blinken unangenehm wird.
                boxShadow: leuchtet ? `0 0 0 6px rgba(255,255,255,0.9), 0 0 18px ${k.farbe}` : undefined,
                filter: leuchtet ? 'brightness(1.6)' : undefined,
              }}
            />
          );
        })}
      </div>

      {phase === 'fertig' && (
        <div className="flex items-center gap-2 text-xs text-gedaempft">
          <span>Die Folge war:</span>
          <div className="flex gap-1">
            {aufgabe.folge.map((wert, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: KACHELN[wert]!.farbe }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
