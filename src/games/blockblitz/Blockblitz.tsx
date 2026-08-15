import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  HOEHE,
  legen,
  neuesSpiel,
  passtAn,
  punkteFuerZug,
  teilLegen,
  volleZeilenUndSpalten,
} from './logik';
import type { Teil, Zustand } from './logik';
import { ankerZentriertAuf, formGroesse } from './geometrie';
import { blockFarbe } from './farben';

const VERSATZ_Y = 60; // Pixel, um die das gezogene Teil über den Finger gehoben wird
const SCHWELLE_TIPP = 8; // Pixel Bewegung, unterhalb derer ein Antippen statt Ziehen gilt
const FALLBACK_ZELLGROESSE = 40; // bevor das Raster zum ersten Mal gemessen wurde
// Straff und "zack zack zack": großer Versatz, aber jede Zelle für sich kurz —
// das wirkt wie ein schnelles, hintereinander laufendes Wegkrattern statt
// eines einzigen langsamen, gemeinsamen Aufblitzens.
const ZERBROESELN_VERSATZ_MS = 55; // Zeitversatz je Diagonal-Schritt beim Auflösen
const ZERBROESELN_DAUER_MS = 260; // Dauer einer einzelnen Zelle, siehe index.css
const PUNKTE_ANZEIGE_DAUER_MS = 900;

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
  // Zellenschlüssel → Zeitversatz in ms, für das gestaffelte Zerbröseln.
  const [blitzZellen, setBlitzZellen] = useState<ReadonlyMap<string, number> | null>(null);
  const [punkteAnzeige, setPunkteAnzeige] = useState<{ id: number; text: string } | null>(null);
  const punkteAnzeigeId = useRef(0);
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
      const anzahlLinien = zeilen.length + spalten.length;

      if (anzahlLinien > 0) {
        // Diagonal versetzt, wie beim wirklichen Zerbröseln — nicht alle Zellen
        // auf einmal. Bei "weniger Bewegung" kein Versatz, alles sofort weg.
        const positionen = new Map<string, number>();
        for (let y = 0; y < HOEHE; y++) {
          for (let x = 0; x < BREITE; x++) {
            if (zeilen.includes(y) || spalten.includes(x)) {
              positionen.set(`${x},${y}`, settings.reducedMotion ? 0 : (x + y) * ZERBROESELN_VERSATZ_MS);
            }
          }
        }
        const maxVersatz = Math.max(0, ...positionen.values());
        setBlitzZellen(positionen);
        window.setTimeout(
          () => setBlitzZellen(null),
          settings.reducedMotion ? 0 : maxVersatz + ZERBROESELN_DAUER_MS,
        );
        sfx('stufe');

        // Kleine, gestaffelte "Kratz"-Klicks passend zum Zerbröseln — ein Klick
        // je Zeitstufe, nicht je Zelle, sonst wird es bei vielen Zellen zu viel.
        if (!settings.reducedMotion) {
          const stufen = new Set(positionen.values());
          for (const stufe of stufen) {
            if (stufe === 0) continue;
            window.setTimeout(() => sfx('klick'), stufe);
          }
        }

        const zugPunkte = punkteFuerZug(teil.form.length, anzahlLinien, aktuell.kombo + 1);
        punkteAnzeigeId.current += 1;
        const dieseId = punkteAnzeigeId.current;
        setPunkteAnzeige({ id: dieseId, text: `+${zugPunkte}` });
        window.setTimeout(() => {
          setPunkteAnzeige((p) => (p?.id === dieseId ? null : p));
        }, PUNKTE_ANZEIGE_DAUER_MS);
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
  // Dieselbe gemessene Zellgröße benutzt auch das fliegende Teil weiter unten,
  // damit es beim Ziehen genauso groß erscheint wie später auf dem Feld.
  const ziehendesTeil = zug ? z.tablett[zug.tablettIndex] : null;
  const rasterRect = zug && rasterRef.current ? rasterRef.current.getBoundingClientRect() : null;
  const rasterZellgroesse = rasterRect ? rasterRect.width / BREITE : FALLBACK_ZELLGROESSE;
  let vorschauAnker: { ankerX: number; ankerY: number } | null = null;
  if (zug && ziehendesTeil && rasterRect) {
    const rasterX = (zug.x - rasterRect.left) / (rasterRect.width / BREITE);
    const rasterY = (zug.y - VERSATZ_Y - rasterRect.top) / (rasterRect.height / HOEHE);
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
    <div
      className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-4"
      // Extra Luft unten, über die reine Geräte-Aussparung hinaus: Safaris
      // eigene (schwebende) Adressleiste liegt am unteren Rand über der
      // Seite, ohne dass CSS ihre Höhe kennt — ohne diesen Puffer landet das
      // Tablett dahinter und Antippen trifft die Browserleiste statt das Spiel.
      style={{ paddingBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom) + 2rem))' }}
    >
      <div className="flex flex-col items-center gap-1">
        <output
          key={z.punkte}
          aria-live="polite"
          aria-label={`${z.punkte} Punkte`}
          className="punkte-bumsen text-5xl leading-none font-extrabold tabular-nums text-white sm:text-6xl"
          style={{ textShadow: '0 2px 16px rgba(0,0,0,0.55)' }}
        >
          {z.punkte}
        </output>
        <span
          className={`rounded-full bg-flaeche-hoch px-3 py-1 text-sm font-bold text-fokus transition-opacity ${
            z.kombo >= 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          🔥 Kombo ×{z.kombo}
        </span>
      </div>

      <div className="relative w-full max-w-sm">
        <div
          ref={rasterRef}
          className="grid touch-none gap-1"
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
            const blitzVersatz = blitzZellen?.get(schluessel);

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
                {blitzVersatz !== undefined && (
                  <>
                    <span
                      className="aufloesen-blitz absolute inset-0 rounded-md bg-white"
                      style={{ '--verzoegerung': `${blitzVersatz}ms` } as CSSProperties}
                    />
                    <span
                      className="kruemel absolute top-1/2 left-1/2 size-1.5 rounded-full bg-white"
                      style={{ '--verzoegerung': `${blitzVersatz}ms`, '--kx': '-10px', '--ky': '8px' } as CSSProperties}
                    />
                    <span
                      className="kruemel absolute top-1/2 left-1/2 size-1.5 rounded-full bg-white"
                      style={{ '--verzoegerung': `${blitzVersatz}ms`, '--kx': '9px', '--ky': '11px' } as CSSProperties}
                    />
                  </>
                )}
              </button>
            );
          })}
        </div>

        {punkteAnzeige && (
          <div
            key={punkteAnzeige.id}
            aria-hidden="true"
            className="punkte-auftauchen pointer-events-none absolute inset-0 grid place-items-center text-4xl font-extrabold text-fokus"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
          >
            {punkteAnzeige.text}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4">
        {z.tablett.map((teil, i) => (
          <button
            key={teil?.id ?? `leer-${i}`}
            type="button"
            disabled={!teil || z.vorbei}
            onPointerDown={teil ? beiTablettPointerDown(i) : undefined}
            aria-label={teil ? `Teil ${i + 1}, ${teil.form.length} Felder` : `Platz ${i + 1}, leer`}
            className={`grid size-24 touch-none place-items-center rounded-xl transition-all disabled:opacity-30 ${
              ausgewaehlt === i || zug?.tablettIndex === i
                ? '-translate-y-1.5 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]'
                : ''
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
          <TeilAnzeige teil={ziehendesTeil} zellgroesse={rasterZellgroesse} />
        </div>
      )}

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
