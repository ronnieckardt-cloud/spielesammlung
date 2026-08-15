import { useCallback, useEffect, useState } from 'react';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { KopfrechnenAnzeige } from './KopfrechnenAnzeige';
import { aufgabeAbschliessen, naechsteAufgabe, neuesLevel } from './logik';
import type { Zustand } from './logik';
import { MerkfolgenAnzeige } from './MerkfolgenAnzeige';
import { MusterAnzeige } from './MusterAnzeige';

/**
 * Welches Level als Nächstes drankommt — wie beim Farbsortierer und beim
 * Wissensquiz eine Modul-Variable, weil "Nochmal" die Komponente komplett
 * neu mountet.
 */
let naechsteLevelNummer = 1;

const VARIANTEN_NAMEN: Record<Zustand['variante'], string> = {
  kopfrechnen: 'Kopfrechnen',
  merkfolgen: 'Merk-Folgen',
  muster: 'Muster erkennen',
};

export function Gehirnjogging({ onScore, onGameOver, settings }: GameProps) {
  const [z, setZ] = useState<Zustand>(() => neuesLevel(naechsteLevelNummer));
  // Nur für Kopfrechnen/Muster: welche der vier Zahlen wurde angeklickt.
  // Merk-Folgen führt seine Eingabe selbst, siehe MerkfolgenAnzeige.
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx(z.richtigeAnzahl === z.aufgaben.length ? 'stufe' : 'ende');
      naechsteLevelNummer = z.level + 1;
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  // Auswahl zurücksetzen, sobald eine neue Aufgabe drankommt — auch beim
  // Levelwechsel, der den Index wieder auf 0 setzen kann, ohne dass sich
  // der Index selbst ändert.
  useEffect(() => {
    setAusgewaehlt(null);
  }, [z.index, z.level]);

  const beiErgebnis = useCallback((richtig: boolean) => {
    sfx(richtig ? 'gut' : 'schlecht');
    setZ((alt) => aufgabeAbschliessen(alt, richtig));
  }, []);

  const beiZahlAntwort = useCallback(
    (index: 0 | 1 | 2 | 3, richtigIndex: 0 | 1 | 2 | 3) => {
      setAusgewaehlt(index);
      beiErgebnis(index === richtigIndex);
    },
    [beiErgebnis],
  );

  const beiWeiter = useCallback(() => setZ((alt) => naechsteAufgabe(alt)), []);

  const beiLevelWechsel = useCallback((neu: number) => {
    const geklemmt = Math.max(1, neu);
    naechsteLevelNummer = geklemmt;
    setZ(neuesLevel(geklemmt));
  }, []);

  const aufgabe = z.aufgaben[z.index];
  if (!aufgabe) return null;

  const beantwortet = z.ergebnis !== null;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4">
      <div className="flex w-full max-w-md items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1}
            aria-label="Voriges Level"
            className="rounded-lg border border-rand bg-flaeche spielknopf px-2 py-1 text-base leading-none disabled:opacity-30"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            aria-label="Nächstes Level"
            className="rounded-lg border border-rand bg-flaeche spielknopf px-2 py-1 text-base leading-none"
          >
            ›
          </button>
        </div>
        <span className="text-gedaempft">
          Aufgabe {z.index + 1} / {z.aufgaben.length}
        </span>
      </div>

      <div
        className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-flaeche-hoch"
        role="progressbar"
        aria-label="Fortschritt in dieser Runde"
        aria-valuemin={0}
        aria-valuemax={z.aufgaben.length}
        aria-valuenow={z.index}
      >
        <div
          className="h-full rounded-full bg-fokus transition-[width] duration-200"
          style={{ width: `${(z.index / z.aufgaben.length) * 100}%` }}
        />
      </div>

      <span className="text-xs font-medium tracking-wide text-gedaempft uppercase">
        {VARIANTEN_NAMEN[z.variante]}
      </span>

      {aufgabe.art === 'kopfrechnen' && (
        <KopfrechnenAnzeige
          aufgabe={aufgabe.daten}
          ausgewaehlt={ausgewaehlt}
          onWaehlen={(i) => beiZahlAntwort(i, aufgabe.daten.richtig)}
        />
      )}
      {aufgabe.art === 'muster' && (
        <MusterAnzeige
          aufgabe={aufgabe.daten}
          ausgewaehlt={ausgewaehlt}
          onWaehlen={(i) => beiZahlAntwort(i, aufgabe.daten.richtig)}
        />
      )}
      {aufgabe.art === 'merkfolgen' && (
        <MerkfolgenAnzeige
          key={`${z.level}-${z.index}`}
          aufgabe={aufgabe.daten}
          reducedMotion={settings.reducedMotion}
          onFertig={beiErgebnis}
        />
      )}

      {beantwortet && !z.vorbei && (
        <button
          type="button"
          onClick={beiWeiter}
          autoFocus
          className="rounded-lg px-6 py-3 font-semibold text-grund"
          style={{ backgroundColor: 'var(--color-fokus)' }}
        >
          Weiter
        </button>
      )}

      <p className="text-sm text-gedaempft">Richtig gelöst: {z.richtigeAnzahl}</p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
