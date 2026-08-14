import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  HOEHE,
  legen,
  neuesSpiel,
  passtAn,
  teilLegen,
  volleZeilenUndSpalten,
} from './logik';
import type { Teil, Zustand } from './logik';
import { ankerZentriertAuf, formGroesse } from './geometrie';
import { blockFarbe } from './farben';

const VERSATZ_Y = 60; // Pixel, um die das gezogene Teil über den Finger gehoben wird
const SCHWELLE_TIPP = 8; // Pixel Bewegung, unterhalb derer ein Antippen statt Ziehen gilt
const BLITZ_DAUER_MS = 320;

type ZugZustand = {
  pointerId: number;
  tablettIndex: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

/** Zeigt die Form eines Teils als kleines Raster — für Tablett und fliegendes Teil. */
function TeilAnzeige({ teil, zellgroesse }: { teil: Teil; zellgroesse: number }) {
  const { breite, hoehe } = formGroesse(teil.form);
  const belegt = new Set(teil.form.map((v) => `${v.dx},${v.dy}`));
  return (
    <div
      className="grid gap-0.5"
      style={{
        gridTemplateColumns: `repeat(${breite}, ${zellgroesse}px)`,
        gridTemplateRows: `repeat(${hoehe}, ${zellgroesse}px)`,
      }}
    >
      {Array.from({ length: breite * hoehe }, (_, i) => {
        const x = i % breite;
        const y = Math.floor(i / breite);
        const gefuellt = belegt.has(`${x},${y}`);
        return (
          <div
            key={i}
            className="rounded-[3px]"
            style={{ backgroundColor: gefuellt ? blockFarbe(teil.farbe) : 'transparent' }}
          />
        );
      })}
    </div>
  );
}

export function Blockblitz({ onScore, onGameOver, settings }: GameProps) {
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('blockblitz', Date.now())));
  const [zug, setZug] = useState<ZugZustand | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);
  const [blitzZellen, setBlitzZellen] = useState<ReadonlySet<string> | null>(null);
  const rasterRef = useRef<HTMLDivElement>(null);

  // Immer der aktuelle Stand, ohne dass platzieren() dafür seine Identität
  // wechseln müsste — sonst hängt sich der Zieh-Effekt unten nach jedem
  // einzelnen Zug neu auf (ein neuer Zustand → neues platzieren → Effekt
  // läuft erneut), was bei einem verzögerten oder verirrten Zeiger-Ereignis
  // zu einer Kettenreaktion führen kann.
  const zRef = useRef(z);
  zRef.current = z;

  const platzieren = useCallback(
    (tablettIndex: number, ankerX: number, ankerY: number) => {
      const aktuell = zRef.current;
      const teil = aktuell.tablett[tablettIndex];
      if (!teil || !passtAn(aktuell.raster, teil.form, ankerX, ankerY)) return;

      const nachLegen = legen(aktuell.raster, teil.form, ankerX, ankerY, teil.farbe);
      const { zeilen, spalten } = volleZeilenUndSpalten(nachLegen);

      if (zeilen.length + spalten.length > 0) {
        const positionen = new Set<string>();
        for (let y = 0; y < HOEHE; y++) {
          for (let x = 0; x < BREITE; x++) {
            if (zeilen.includes(y) || spalten.includes(x)) positionen.add(`${x},${y}`);
          }
        }
        setBlitzZellen(positionen);
        window.setTimeout(() => setBlitzZellen(null), settings.reducedMotion ? 0 : BLITZ_DAUER_MS);
        sfx('stufe');
      } else {
        sfx('gut');
      }

      setZ((alt) => teilLegen(alt, tablettIndex, ankerX, ankerY));
    },
    [settings.reducedMotion],
  );

  const beiTablettPointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!z.tablett[index] || z.vorbei) return;
    e.preventDefault();
    setZug({
      pointerId: e.pointerId,
      tablettIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    });
    setAusgewaehlt(index);
  };

  useEffect(() => {
    if (!zug) return;

    const beiBewegen = (e: PointerEvent) => {
      if (e.pointerId !== zug.pointerId) return;
      setZug((z2) => z2 && { ...z2, x: e.clientX, y: e.clientY });
    };

    const beiEnde = (e: PointerEvent) => {
      if (e.pointerId !== zug.pointerId) return;
      const bewegt = Math.hypot(e.clientX - zug.startX, e.clientY - zug.startY) > SCHWELLE_TIPP;
      if (bewegt) {
        const rect = rasterRef.current?.getBoundingClientRect();
        const teil = zRef.current.tablett[zug.tablettIndex];
        if (rect && teil) {
          const rasterX = (e.clientX - rect.left) / (rect.width / BREITE);
          const rasterY = (e.clientY - VERSATZ_Y - rect.top) / (rect.height / HOEHE);
          const { ankerX, ankerY } = ankerZentriertAuf(teil.form, rasterX, rasterY);
          platzieren(zug.tablettIndex, ankerX, ankerY);
        }
        setAusgewaehlt(null);
      }
      // Bei reinem Antippen bleibt "ausgewaehlt" stehen — das Ziel kommt
      // beim nächsten Antippen einer Rasterzelle.
      setZug(null);
    };

    const beiAbbruch = () => setZug(null);

    window.addEventListener('pointermove', beiBewegen);
    window.addEventListener('pointerup', beiEnde);
    window.addEventListener('pointercancel', beiAbbruch);
    return () => {
      window.removeEventListener('pointermove', beiBewegen);
      window.removeEventListener('pointerup', beiEnde);
      window.removeEventListener('pointercancel', beiAbbruch);
    };
    // z.tablett absichtlich nicht in den Abhängigkeiten — der Handler liest
    // den aktuellen Stand über zRef, damit dieser Effekt nur bei einem
    // wirklich neuen Zieh-Vorgang neu aufgesetzt wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zug, platzieren]);

  const beiZelleKlick = (x: number, y: number) => () => {
    if (ausgewaehlt === null || zug) return;
    const teil = z.tablett[ausgewaehlt];
    if (!teil) return;
    const { ankerX, ankerY } = ankerZentriertAuf(teil.form, x, y);
    platzieren(ausgewaehlt, ankerX, ankerY);
    setAusgewaehlt(null);
  };

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte);
    }
    // onGameOver darf nur einmal kommen — deshalb hängt das nur an "vorbei".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  // Vorschau während des Ziehens: Zielzellen und ob dort eine Linie fertig würde.
  const ziehendesTeil = zug ? z.tablett[zug.tablettIndex] : null;
  let vorschauAnker: { ankerX: number; ankerY: number } | null = null;
  if (zug && ziehendesTeil && rasterRef.current) {
    const rect = rasterRef.current.getBoundingClientRect();
    const rasterX = (zug.x - rect.left) / (rect.width / BREITE);
    const rasterY = (zug.y - VERSATZ_Y - rect.top) / (rect.height / HOEHE);
    vorschauAnker = ankerZentriertAuf(ziehendesTeil.form, rasterX, rasterY);
  }
  const vorschauGueltig =
    !!vorschauAnker && !!ziehendesTeil && passtAn(z.raster, ziehendesTeil.form, vorschauAnker.ankerX, vorschauAnker.ankerY);
  const vorschauZellen = new Set<string>(
    vorschauAnker && ziehendesTeil
      ? ziehendesTeil.form.map((v) => `${vorschauAnker!.ankerX + v.dx},${vorschauAnker!.ankerY + v.dy}`)
      : [],
  );
  let vorschauZeilen: number[] = [];
  let vorschauSpalten: number[] = [];
  if (vorschauGueltig && vorschauAnker && ziehendesTeil) {
    const testRaster = legen(z.raster, ziehendesTeil.form, vorschauAnker.ankerX, vorschauAnker.ankerY, ziehendesTeil.farbe);
    const linien = volleZeilenUndSpalten(testRaster);
    vorschauZeilen = linien.zeilen;
    vorschauSpalten = linien.spalten;
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-4">
      <div className="flex h-8 items-center">
        {z.kombo >= 2 && (
          <span className="rounded-full bg-flaeche-hoch px-3 py-1 text-sm font-bold text-fokus">
            🔥 Kombo ×{z.kombo}
          </span>
        )}
      </div>

      <div
        ref={rasterRef}
        className="grid w-full max-w-sm touch-none gap-1"
        style={{ gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Spielfeld, ${BREITE} mal ${HOEHE} Felder. ${z.raster.flat().filter((c) => c !== null).length} von ${BREITE * HOEHE} belegt.`}
      >
        {Array.from({ length: BREITE * HOEHE }, (_, i) => {
          const x = i % BREITE;
          const y = Math.floor(i / BREITE);
          const schluessel = `${x},${y}`;
          const belegtFarbe = z.raster[y]![x];
          const istVorschau = vorschauZellen.has(schluessel);
          const istVorschauLinie =
            istVorschau && vorschauGueltig && (vorschauZeilen.includes(y) || vorschauSpalten.includes(x));
          const leer = belegtFarbe === null && !istVorschau;

          let farbe: string | undefined;
          if (istVorschau) farbe = vorschauGueltig ? blockFarbe(ziehendesTeil!.farbe) : '#ef4444';
          else if (belegtFarbe !== null) farbe = blockFarbe(belegtFarbe);

          return (
            <button
              key={i}
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={beiZelleKlick(x, y)}
              className={`relative aspect-square rounded-md ${leer ? 'border border-rand bg-flaeche' : ''}`}
              style={
                farbe
                  ? {
                      backgroundColor: farbe,
                      opacity: istVorschau ? 0.65 : 1,
                      boxShadow: istVorschauLinie ? '0 0 0 2px white inset' : undefined,
                    }
                  : undefined
              }
            >
              {blitzZellen?.has(schluessel) && (
                <span className="aufloesen-blitz absolute inset-0 rounded-md bg-white" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-4">
        {z.tablett.map((teil, i) => (
          <button
            key={teil?.id ?? `leer-${i}`}
            type="button"
            disabled={!teil || z.vorbei}
            onPointerDown={teil ? beiTablettPointerDown(i) : undefined}
            aria-label={teil ? `Teil ${i + 1}, ${teil.form.length} Felder` : `Platz ${i + 1}, leer`}
            className={`grid size-20 touch-none place-items-center rounded-xl border transition-transform disabled:opacity-30 ${
              ausgewaehlt === i || zug?.tablettIndex === i
                ? 'border-fokus bg-flaeche-hoch -translate-y-1'
                : 'border-rand bg-flaeche'
            }`}
          >
            {teil && <TeilAnzeige teil={teil} zellgroesse={16} />}
          </button>
        ))}
      </div>

      <p className="max-w-sm text-center text-sm text-gedaempft">
        Ziehen oder antippen und ein Zielfeld antippen. Volle Reihen und
        Spalten lösen sich auf.
      </p>

      {zug && ziehendesTeil && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-flaeche/90 p-1.5 shadow-lg"
          style={{ left: zug.x, top: zug.y - VERSATZ_Y }}
        >
          <TeilAnzeige teil={ziehendesTeil} zellgroesse={24} />
        </div>
      )}

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
