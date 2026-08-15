import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import { Komboherz } from '../../core/Komboherz';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  HOEHE,
  legen,
  loesbareLinien,
  neuesSpiel,
  passtAn,
  punkteFuerZug,
  teilLegen,
  volleZeilenUndSpalten,
} from './logik';
import type { Teil, Zustand } from './logik';
import { ankerZentriertAuf, formGroesse } from './geometrie';
import { blockFarbe } from './farben';
import { BlockblitzIcon } from './Icon';

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
            className={`rounded-[3px] ${gefuellt ? 'glanzstein' : ''}`}
            style={{ backgroundColor: gefuellt ? blockFarbe(teil.farbe) : 'transparent' }}
          />
        );
      })}
    </div>
  );
}

/**
 * Schwebende Deko-Blöcke im Hintergrund des Startbildschirms — feste Liste,
 * kein Zufall nötig (rein dekorativ, keine Spiellogik, muss nicht
 * reproduzierbar sein). Position in Prozent, Größe/Winkel/Verzögerung von
 * Hand für eine unregelmäßige, nicht symmetrische Verteilung gewählt.
 */
const DEKO_BLOECKE: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  winkel: number;
  verzoegerung: number;
}[] = [
  { x: 8, y: 12, groesse: 30, farbe: '#facc15', winkel: 14, verzoegerung: 0 },
  { x: 86, y: 8, groesse: 22, farbe: '#f472b6', winkel: -18, verzoegerung: 0.5 },
  { x: 80, y: 78, groesse: 36, farbe: '#2dd4bf', winkel: 10, verzoegerung: 0.9 },
  { x: 10, y: 80, groesse: 26, farbe: '#38bdf8', winkel: -8, verzoegerung: 1.3 },
  { x: 92, y: 42, groesse: 18, farbe: '#facc15', winkel: 22, verzoegerung: 0.2 },
  { x: 4, y: 46, groesse: 20, farbe: '#f472b6', winkel: -6, verzoegerung: 1.7 },
  { x: 55, y: 6, groesse: 16, farbe: '#2dd4bf', winkel: 30, verzoegerung: 1.0 },
];

/**
 * Farbenfrohes Titelbild vor der ersten Runde — bewusst nicht der übliche
 * dunkle App-Hintergrund, sondern ein eigener, kräftiger Farbverlauf mit
 * schwebenden Blöcken, wie bei typischen, poliert wirkenden Puzzle-Spielen.
 * Eigene Gestaltung, keine kopierten Bilder oder Logos.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #4338ca 0%, #7c3aed 38%, #db2777 72%, #f97316 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_BLOECKE.map((b, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-xl opacity-80"
            style={
              {
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.groesse,
                height: b.groesse,
                backgroundColor: b.farbe,
                animationDelay: `${b.verzoegerung}s`,
                '--grundwinkel': `${b.winkel}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <BlockblitzIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Block Burst
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Bereit für deine erste Runde?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-violet-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function Blockblitz({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
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
        // Die Tonhöhe klettert mit der Serie — bei jeder weiteren
        // Kombo eine Stufe höher. Das ist der Effekt, den man aus
        // Handyspielen am stärksten wiedererkennt.
        sfx('stufe', aktuell.kombo * 2);

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

  // Dauerhinweis: Welche Reihen ließen sich mit einem der Teile im Tablett
  // gerade wegmachen? Gemerkt, weil es sonst bei jedem Bild neu liefe.
  const hinweisLinien = useMemo(() => loesbareLinien(z.raster, z.tablett), [z.raster, z.tablett]);
  // Beim Ziehen ausgeblendet — dann führt die stärkere Zug-Vorschau, und
  // zwei blinkende Signale nebeneinander wären nur unruhig.
  const zeigeHinweis = !zug && !z.vorbei;
  const hinweisZeilen = zeigeHinweis ? hinweisLinien.zeilen : [];
  const hinweisSpalten = zeigeHinweis ? hinweisLinien.spalten : [];

  if (!gestartet) {
    return (
      <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />
    );
  }

  return (
    <div
      className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3"
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
      </div>

      <div className="spielbuehne relative">
        {/* Statt eines Textbandes ein pochendes Herz, das mit der Serie
            wächst — man merkt am Rand des Blickfelds, dass etwas läuft,
            ohne die Zahl lesen zu müssen. Liegt über der oberen rechten
            Ecke des Feldes und kostet deshalb keine Höhe. */}
        <Komboherz
          kombo={z.kombo}
          ruhig={settings.reducedMotion}
          className="absolute -top-2 right-0 z-10"
        />
        <div
          ref={rasterRef}
          className="spielbrett grid touch-none gap-1"
          style={
            {
              gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${HOEHE}, minmax(0, 1fr))`,
              '--vz': BREITE / HOEHE,
            } as CSSProperties
          }
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
            // Nur schon belegte Steine leuchten mit — die Lücke bleibt
            // dunkel und zeigt dadurch gleich, wo das Teil hinmuss.
            const istHinweis =
              belegtFarbe !== null &&
              !istVorschau &&
              blitzVersatz === undefined &&
              (hinweisZeilen.includes(y) || hinweisSpalten.includes(x));

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
                className={`relative rounded-md ${leer ? 'border border-rand bg-flaeche' : 'glanzstein'} ${istVorschauLinie ? 'vorschau-linie-puls' : ''} ${istHinweis ? 'linie-moeglich' : ''}`}
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

      <p className="nur-bei-platz max-w-sm text-center text-sm text-gedaempft">
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
