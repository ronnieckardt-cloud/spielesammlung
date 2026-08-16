import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import { saatAus } from '../../core/rng';
import { Komboherz } from '../../core/Komboherz';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  HOEHE,
  legen,
  loesbareLinien,
  neuesSpiel,
  passtAn,
  PUNKTE_SCHWELLE_ANZEIGE,
  teilLegen,
  volleZeilenUndSpalten,
} from './logik';
import type { Teil, TeilForm, Zustand } from './logik';
import { ankerAufBrett, ankerFuerZelle, formGroesse } from './geometrie';
import { blockFarbe } from './farben';
import { BlockblitzIcon } from './Icon';

const VERSATZ_Y = 60; // Pixel, um die das gezogene Teil über den Finger gehoben wird
const SCHWELLE_TIPP = 8; // Pixel Bewegung, unterhalb derer ein Antippen statt Ziehen gilt
/**
 * Wie weit neben dem Brett ein Loslassen noch als „hierhin gemeint" gilt.
 * Eine halbe Zelle ist Nachsicht für ungenaue Finger — mehr wäre gefährlich,
 * weil das Tablett direkt unter dem Brett liegt und ein Zurücklegen dort
 * sonst zu einem Zug in der untersten Reihe würde.
 */
const TOLERANZ_ZELLEN = 0.5;
/** Wie lange das Teil nach einem misslungenen Zug wackelt (siehe index.css). */
const FEHLER_DAUER_MS = 400;
// Straff und "zack zack zack": großer Versatz, aber jede Zelle für sich kurz —
// das wirkt wie ein schnelles, hintereinander laufendes Wegkrattern statt
// eines einzigen langsamen, gemeinsamen Aufblitzens.
const ZERBROESELN_VERSATZ_MS = 55; // Zeitversatz je Diagonal-Schritt beim Auflösen
const ZERBROESELN_DAUER_MS = 260; // Dauer einer einzelnen Zelle, siehe index.css

/** Wohin die Krümel wegspritzen. Feste Liste, damit es nicht flackert. */
const KRUEMEL: readonly { kx: string; ky: string }[] = [
  { kx: '-10px', ky: '8px' },
  { kx: '9px', ky: '11px' },
];

/** Lage und Größe des Rasters auf dem Bildschirm, einmal gemessen. */
type RasterMasse = { links: number; oben: number; breite: number; hoehe: number };

type Anker = { ankerX: number; ankerY: number };

type ZugZustand = {
  pointerId: number;
  tablettIndex: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /**
   * Das Rechteck des Rasters, **einmal** beim Aufnehmen gemessen.
   *
   * Vorher stand `getBoundingClientRect()` mitten im Rendern: Bei jeder
   * Fingerbewegung erzwang das ein sofortiges Neuberechnen des Layouts,
   * direkt bevor 64 Zellen neu aufgebaut werden. Während eines Zuges kann
   * das Brett seine Lage gar nicht ändern — die Spielseite scrollt nicht
   * (`overflow-hidden`), und Brett wie Tablett tragen `touch-none`.
   */
  rect: RasterMasse;
};

/**
 * Zielanker für eine Zeigerposition auf dem Bildschirm (Ziehen).
 *
 * `VERSATZ_Y` gehört hier mit hinein: Das Teil schwebt über dem Finger,
 * gezielt wird also mit dem Teil und nicht mit der Fingerkuppe.
 */
function ankerAusZeiger(form: TeilForm, x: number, y: number, rect: RasterMasse): Anker | null {
  const rasterX = (x - rect.links) / (rect.breite / BREITE);
  const rasterY = (y - VERSATZ_Y - rect.oben) / (rect.hoehe / HOEHE);
  return ankerAufBrett(form, rasterX, rasterY, BREITE, HOEHE, TOLERANZ_ZELLEN);
}

/** Zielanker für eine angetippte oder mit den Pfeiltasten gewählte Zelle. */
function ankerAusZelle(form: TeilForm, x: number, y: number): Anker | null {
  return ankerFuerZelle(form, x, y, BREITE, HOEHE);
}

/** Bewegungen der Pfeiltasten auf dem Brett. */
const PFEILE: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

function klemmen(wert: number, max: number): number {
  return Math.max(0, Math.min(max, wert));
}

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
        {/* Was man tun soll, steht hier — und nur hier zuverlässig: Die
            Regelzeile im Spiel trägt `.nur-bei-platz` und fällt auf kurzen
            Bildschirmen weg. Vorher stand an dieser Stelle „Bereit für
            deine erste Runde?", das erklärte in beiden Zweigen nichts. */}
        <p className="mt-3 text-sm font-semibold text-white/85">
          Lege die Teile aufs Feld — volle Reihen und Spalten lösen sich auf.
        </p>
        {bestScore > 0 && (
          /* Regel und Bestleistung stehen nebeneinander, nicht
             statt einander — siehe core/Startbildschirm.tsx. */
          <p className="mt-1.5 text-sm font-bold text-white/70">
            <span aria-hidden="true">🏆</span> Beste Punktzahl: {bestScore}
          </p>
        )}
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
  /**
   * Zellenschlüssel → Zeitversatz **und Farbe**, für das gestaffelte
   * Zerbröseln.
   *
   * Die Farbe muss mit, und das ist der ganze Witz: `setBlitzZellen` und
   * `setZ` landen im selben Rendern, das Feld ist beim Start der Animation
   * also längst leer. Ohne die mitgeführte Farbe blieb nur ein weißes
   * Quadrat übrig — die Steine verschwanden schlagartig, und es sah aus,
   * als gäbe es überhaupt keine Animation. Line Fall macht es mit
   * `geloescht.zeilen[].farben` seit jeher genauso.
   */
  const [blitzZellen, setBlitzZellen] = useState<ReadonlyMap<
    string,
    { versatz: number; farbe: number }
  > | null>(null);
  const rasterRef = useRef<HTMLDivElement>(null);
  /**
   * Das Zielfeld für Antippen und Tastatur — der „Cursor" auf dem Brett.
   * Startet in der Mitte, weil von dort jedes Teil in jede Richtung passt.
   */
  const [zielFeld, setZielFeld] = useState({
    x: Math.floor(BREITE / 2),
    y: Math.floor(HOEHE / 2),
  });
  /**
   * Nur wenn das Raster selbst den Tastaturfokus hat, wird das Zielfeld
   * markiert. Ein Zeigerklick auf eine Zelle gibt den Fokus an diese Zelle
   * weiter und löscht die Markierung damit wieder — richtig so: Wer tippt,
   * navigiert nicht mit einem Cursor, und ein stehen gebliebener Ring wäre
   * auf dem Handy nur ein Fleck, den niemand zuordnen kann.
   */
  const [rasterFokus, setRasterFokus] = useState(false);
  /** Welches Tablett-Teil gerade wackelt, weil der Zug nicht ging. */
  const [fehler, setFehler] = useState<{ index: number; nr: number } | null>(null);
  const fehlerNr = useRef(0);

  // Das „+N" über dem Feld kommt aus dem gemeinsamen Baustein statt aus
  // einer zweiten, eigenen Rechnung: Es liest den wirklichen Zuwachs des
  // Punktestands ab, kann also gar nicht mehr von dem abweichen, was die
  // Logik gutgeschrieben hat.
  const gewinn = usePunktegewinn(z.punkte, PUNKTE_SCHWELLE_ANZEIGE);

  // Immer der aktuelle Stand, ohne dass platzieren() dafür seine Identität
  // wechseln müsste — sonst hängt sich der Zieh-Effekt unten nach jedem
  // einzelnen Zug neu auf (ein neuer Zustand → neues platzieren → Effekt
  // läuft erneut), was bei einem verzögerten oder verirrten Zeiger-Ereignis
  // zu einer Kettenreaktion führen kann.
  const zRef = useRef(z);
  zRef.current = z;

  /**
   * Ein misslungener Zug war vorher völlig stumm: Erfolg klingt, Misserfolg
   * gar nicht — das Kind konnte nicht unterscheiden, ob das Spiel den Zug
   * nicht wollte oder die Eingabe nicht angekommen ist. Jetzt Ton, Stups
   * und ein kurzes Wackeln des Teils, das nicht passte.
   */
  const meldeFehler = useCallback((tablettIndex: number) => {
    sfx('schlecht');
    haptik('fehler');
    // Eigene laufende Nummer: Zwei Fehlversuche hintereinander am selben
    // Teil sollen die Animation neu starten, nicht stehen lassen.
    fehlerNr.current += 1;
    setFehler({ index: tablettIndex, nr: fehlerNr.current });
  }, []);

  useEffect(() => {
    if (!fehler) return;
    const uhr = window.setTimeout(() => setFehler(null), FEHLER_DAUER_MS);
    return () => window.clearTimeout(uhr);
  }, [fehler]);

  /** Meldet zurück, ob wirklich gelegt wurde — der Aufrufer entscheidet
   *  daran, ob die Auswahl stehen bleibt und ob es einen Fehler zu melden gibt. */
  const platzieren = useCallback(
    (tablettIndex: number, ankerX: number, ankerY: number): boolean => {
      const aktuell = zRef.current;
      const teil = aktuell.tablett[tablettIndex];
      if (!teil || !passtAn(aktuell.raster, teil.form, ankerX, ankerY)) return false;

      const nachLegen = legen(aktuell.raster, teil.form, ankerX, ankerY, teil.farbe);
      const { zeilen, spalten } = volleZeilenUndSpalten(nachLegen);
      const anzahlLinien = zeilen.length + spalten.length;

      if (anzahlLinien > 0) {
        // Diagonal versetzt, wie beim wirklichen Zerbröseln — nicht alle Zellen
        // auf einmal. Bei "weniger Bewegung" kein Versatz, alles sofort weg.
        const positionen = new Map<string, { versatz: number; farbe: number }>();
        for (let y = 0; y < HOEHE; y++) {
          for (let x = 0; x < BREITE; x++) {
            // `nachLegen` ist das Feld **mit** dem gerade gelegten Teil und
            // **vor** dem Abräumen — nur dort stehen die Farben noch drin.
            const farbe = nachLegen[y]![x];
            if (farbe !== null && (zeilen.includes(y) || spalten.includes(x))) {
              positionen.set(`${x},${y}`, {
                versatz: settings.reducedMotion ? 0 : (x + y) * ZERBROESELN_VERSATZ_MS,
                farbe,
              });
            }
          }
        }
        const maxVersatz = Math.max(0, ...[...positionen.values()].map((p) => p.versatz));
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
          const stufen = new Set([...positionen.values()].map((p) => p.versatz));
          for (const stufe of stufen) {
            if (stufe === 0) continue;
            window.setTimeout(() => sfx('klick'), stufe);
          }
        }
      } else {
        sfx('gut');
      }

      setZ((alt) => teilLegen(alt, tablettIndex, ankerX, ankerY));
      return true;
    },
    [settings.reducedMotion],
  );

  /**
   * Der eine Weg, auf dem ein Teil das Brett erreicht — egal ob gezogen,
   * angetippt oder mit der Tastatur abgelegt.
   *
   * Ein Fehlversuch räumte vorher die Auswahl kommentarlos ab: Das Teil war
   * weg vom Tablett-Hervorheben, nichts war passiert, und man wusste nicht,
   * ob das Spiel den Zug abgelehnt oder die Eingabe verschluckt hat. Jetzt
   * bleibt die Auswahl stehen und der Fehlversuch meldet sich.
   *
   * `null` als Anker heißt „weit neben dem Brett losgelassen" — das ist
   * ausdrücklich ein Zurücklegen und kein Fehler, es bleibt still.
   */
  const legenVersuchen = useCallback(
    (tablettIndex: number, anker: Anker | null) => {
      if (!anker) {
        setAusgewaehlt(null);
        return;
      }
      if (platzieren(tablettIndex, anker.ankerX, anker.ankerY)) setAusgewaehlt(null);
      else meldeFehler(tablettIndex);
    },
    [platzieren, meldeFehler],
  );

  const beiTablettPointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!z.tablett[index] || z.vorbei) return;
    e.preventDefault();
    setAusgewaehlt(index);
    // Einmal messen und mitführen, statt bei jeder Fingerbewegung neu —
    // siehe `ZugZustand.rect`. Ohne Maße kein Ziehen; das Antippen mit
    // anschließendem Zielfeld funktioniert trotzdem.
    const kasten = rasterRef.current?.getBoundingClientRect();
    if (!kasten) return;
    setZug({
      pointerId: e.pointerId,
      tablettIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      rect: { links: kasten.left, oben: kasten.top, breite: kasten.width, hoehe: kasten.height },
    });
  };

  /**
   * Der Tastaturweg ins Spiel.
   *
   * Vorher hing `setAusgewaehlt` ausschließlich am `pointerdown` — Enter
   * oder Leertaste auf einem Knopf lösen im Browser aber nur ein `click`
   * aus, nie ein `pointerdown`. Ein Teil war per Tastatur also gar nicht
   * auswählbar. Hier abgefangen statt über `onClick`: `preventDefault()`
   * unterdrückt den sonst folgenden synthetischen Klick, damit es keine
   * zweite Auslösung gibt und Zeiger- und Tastenweg sich nicht überlagern.
   *
   * Der Fokus wandert gleich mit aufs Raster — dort geht es mit den
   * Pfeiltasten weiter, ohne dass man erst wieder Tab drücken muss.
   */
  const beiTablettTaste = (index: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setAusgewaehlt(index);
    rasterRef.current?.focus();
  };

  /**
   * Klicks, die **nicht** von einem Zeiger kommen: Bedienhilfen wie
   * VoiceOver schicken einen nackten `click` ohne `pointerdown`
   * (`detail === 0`). Für einen echten Mausklick ist das Setzen unschädlich,
   * weil `pointerdown` genau dasselbe schon gesetzt hat.
   */
  const beiTablettKlick = (index: number) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    setAusgewaehlt(index);
    if (e.detail === 0) rasterRef.current?.focus();
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
        const teil = zRef.current.tablett[zug.tablettIndex];
        if (teil) legenVersuchen(zug.tablettIndex, ankerAusZeiger(teil.form, e.clientX, e.clientY, zug.rect));
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
  }, [zug, legenVersuchen]);

  const beiZelleKlick = (x: number, y: number) => () => {
    // Der Cursor folgt dem Finger, damit Antippen und Tastatur dieselbe
    // Stelle meinen — sonst stünde die Vorschau nach einem Fehlversuch
    // woanders als der letzte Tipp.
    setZielFeld({ x, y });
    if (ausgewaehlt === null || zug || z.vorbei) return;
    const teil = z.tablett[ausgewaehlt];
    if (!teil) return;
    legenVersuchen(ausgewaehlt, ankerAusZelle(teil.form, x, y));
  };

  /**
   * Das ganze Brett ist ein einziger Tabstopp: Pfeiltasten bewegen das
   * Zielfeld, die Ziffern 1 bis 3 wählen ein Teil, Enter legt ab.
   *
   * Bewusst **nicht** 64 einzelne Tabstopps — bis zur letzten Zelle wären
   * das 64 Tastendrücke, und der Weg zurück zum Tablett noch einmal so
   * viele.
   */
  const beiRasterTaste = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const pfeil = PFEILE[e.key];
    if (pfeil) {
      e.preventDefault(); // sonst scrollt die Seite unter dem Brett weg
      setZielFeld((alt) => ({
        x: klemmen(alt.x + pfeil.dx, BREITE - 1),
        y: klemmen(alt.y + pfeil.dy, HOEHE - 1),
      }));
      return;
    }

    if (e.key === 'Escape') {
      setAusgewaehlt(null);
      return;
    }

    // Ziffern wählen ein Teil, ohne dass der Fokus das Brett verlassen muss.
    const nummer = Number(e.key);
    if (Number.isInteger(nummer) && nummer >= 1 && nummer <= z.tablett.length) {
      e.preventDefault();
      if (z.tablett[nummer - 1] && !z.vorbei) setAusgewaehlt(nummer - 1);
      return;
    }

    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (z.vorbei) return;
    // Ohne vorherige Auswahl das erste liegende Teil nehmen — sonst
    // passiert bei Enter gar nichts und man sucht den Fehler bei sich.
    const index = ausgewaehlt ?? z.tablett.findIndex((t) => t !== null);
    const teil = index >= 0 ? z.tablett[index] : null;
    if (!teil) return;
    setAusgewaehlt(index); // damit man auch bei Fehlversuch sieht, womit gelegt wurde
    legenVersuchen(index, ankerAusZelle(teil.form, zielFeld.x, zielFeld.y));
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

  /**
   * Die Vorschau — dieselbe Rechnung für beide Wege.
   *
   * Sie hing vorher ausschließlich am Ziehen. Beim Antippen sah man deshalb
   * nichts: weder wohin das Teil kommt (es wird auf die Zelle **zentriert**,
   * liegt also gar nicht dort, wo man tippt) noch ob es überhaupt passt.
   * Jetzt speist sich der Anker beim Ziehen aus der Zeigerposition und
   * sonst aus dem Zielfeld — angezeigt wird in beiden Fällen dasselbe.
   */
  const vorschauIndex = zug ? zug.tablettIndex : ausgewaehlt;
  const vorschauTeil = vorschauIndex !== null && !z.vorbei ? (z.tablett[vorschauIndex] ?? null) : null;
  const vorschauAnker: Anker | null = !vorschauTeil
    ? null
    : zug
      ? ankerAusZeiger(vorschauTeil.form, zug.x, zug.y, zug.rect)
      : ankerAusZelle(vorschauTeil.form, zielFeld.x, zielFeld.y);
  const vorschauGueltig =
    !!vorschauAnker &&
    !!vorschauTeil &&
    passtAn(z.raster, vorschauTeil.form, vorschauAnker.ankerX, vorschauAnker.ankerY);
  const vorschauZellen = new Set<string>(
    vorschauAnker && vorschauTeil
      ? vorschauTeil.form.map((v) => `${vorschauAnker.ankerX + v.dx},${vorschauAnker.ankerY + v.dy}`)
      : [],
  );
  let vorschauZeilen: number[] = [];
  let vorschauSpalten: number[] = [];
  if (vorschauGueltig && vorschauAnker && vorschauTeil) {
    const testRaster = legen(
      z.raster,
      vorschauTeil.form,
      vorschauAnker.ankerX,
      vorschauAnker.ankerY,
      vorschauTeil.farbe,
    );
    const linien = volleZeilenUndSpalten(testRaster);
    vorschauZeilen = linien.zeilen;
    vorschauSpalten = linien.spalten;
  }

  // Das fliegende Teil benutzt dieselbe gemessene Zellgröße wie das Raster,
  // damit es beim Ziehen genauso groß erscheint wie später auf dem Feld.
  const zellgroesseAmFinger = zug ? zug.rect.breite / BREITE : 0;

  // Dauerhinweis: Welche Reihen ließen sich mit einem der Teile im Tablett
  // gerade wegmachen? Gemerkt, weil es sonst bei jedem Bild neu liefe.
  const hinweisLinien = useMemo(() => loesbareLinien(z.raster, z.tablett), [z.raster, z.tablett]);
  // Beim Ziehen ausgeblendet — dann führt die stärkere Zug-Vorschau, und
  // zwei blinkende Signale nebeneinander wären nur unruhig.
  const zeigeHinweis = !zug && !z.vorbei;
  const hinweisZeilen = zeigeHinweis ? hinweisLinien.zeilen : [];
  const hinweisSpalten = zeigeHinweis ? hinweisLinien.spalten : [];

  const belegteFelder = z.raster.flat().filter((c) => c !== null).length;

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
          className="spielbrett spielbrett-rahmen relative grid touch-none gap-1 p-1"
          style={
            {
              gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${HOEHE}, minmax(0, 1fr))`,
              '--vz': BREITE / HOEHE,
            } as CSSProperties
          }
          // Ein einziger Tabstopp fürs ganze Brett. Vorher war es ein
          // `role="img"` und die 64 Zellen trugen `aria-hidden` — das Feld
          // war mit der Tastatur überhaupt nicht erreichbar.
          role="grid"
          tabIndex={0}
          aria-label={
            `Spielfeld, ${BREITE} mal ${HOEHE} Felder, ${belegteFelder} belegt. ` +
            'Mit den Pfeiltasten das Zielfeld wählen, mit den Tasten 1 bis 3 ein Teil, mit Enter ablegen.'
          }
          aria-activedescendant={`bb-zelle-${zielFeld.x}-${zielFeld.y}`}
          onKeyDown={beiRasterTaste}
          onFocus={() => setRasterFokus(true)}
          onBlur={() => setRasterFokus(false)}
        >
          {/* `display: contents` löst die Zeilen wieder auf: Das Raster
              braucht sie fürs Vorlesen (eine Tabelle ohne Zeilen ist keine),
              das Layout darf aber weiter ein einziges 8×8-Gitter sein. */}
          {Array.from({ length: HOEHE }, (_, y) => (
            <div key={y} role="row" style={{ display: 'contents' }}>
              {Array.from({ length: BREITE }, (_, x) => {
                const schluessel = `${x},${y}`;
                const belegtFarbe = z.raster[y]![x];
                const istVorschau = vorschauZellen.has(schluessel);
                const istVorschauLinie =
                  istVorschau && vorschauGueltig && (vorschauZeilen.includes(y) || vorschauSpalten.includes(x));
                const leer = belegtFarbe === null && !istVorschau;
                const blitz = blitzZellen?.get(schluessel);
                const istZiel = rasterFokus && zielFeld.x === x && zielFeld.y === y;
                // Nur schon belegte Steine leuchten mit — die Lücke bleibt
                // dunkel und zeigt dadurch gleich, wo das Teil hinmuss.
                const istHinweis =
                  belegtFarbe !== null &&
                  !istVorschau &&
                  blitz === undefined &&
                  (hinweisZeilen.includes(y) || hinweisSpalten.includes(x));

                let farbe: string | undefined;
                if (istVorschau) farbe = vorschauGueltig ? blockFarbe(vorschauTeil!.farbe) : '#ef4444';
                else if (belegtFarbe !== null) farbe = blockFarbe(belegtFarbe);

                return (
                  // Ein echtes `<button>`, obwohl die Tastatur über das
                  // Raster läuft und die Zelle deshalb kein Tabstopp ist:
                  // Auf iOS lösen `click`-Ereignisse auf gewöhnlichen Divs
                  // nicht zuverlässig aus, weil React den Hörer an der
                  // Wurzel hängt und am Element selbst kein `onclick`
                  // steht. `role="gridcell"` setzt die Rolle passend zum
                  // Raster darüber.
                  <button
                    key={x}
                    type="button"
                    id={`bb-zelle-${x}-${y}`}
                    role="gridcell"
                    tabIndex={-1}
                    onClick={beiZelleKlick(x, y)}
                    aria-label={`Spalte ${x + 1}, Reihe ${y + 1}, ${belegtFarbe === null ? 'frei' : 'belegt'}`}
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
                    {/* Der Tastatur-Cursor. Liegt als eigene Auflage über der
                        Zelle, damit er sich nicht mit dem Rand der
                        Linien-Vorschau ins Gehege kommt. */}
                    {istZiel && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-px rounded-md ring-2 ring-white"
                      />
                    )}
                    {blitz !== undefined && (
                      <>
                        {/* Erst der Stein selbst — in seiner Farbe, mit Glanz.
                            Er schrumpft und dreht sich weg. */}
                        <span
                          className="aufloesen-blitz glanzstein absolute inset-0 rounded-md"
                          style={
                            {
                              '--verzoegerung': `${blitz.versatz}ms`,
                              backgroundColor: blockFarbe(blitz.farbe),
                            } as CSSProperties
                          }
                        />
                        {/* Der weiße Blitz darüber macht aus dem Schrumpfen ein
                            Aufleuchten — dieselbe Machart wie in Line Fall. */}
                        <span
                          className="aufloesen-blitz absolute inset-0 rounded-md bg-white"
                          style={{ '--verzoegerung': `${blitz.versatz}ms` } as CSSProperties}
                        />
                        {KRUEMEL.map((k) => (
                          <span
                            key={k.kx}
                            className="kruemel absolute top-1/2 left-1/2 size-1.5 rounded-full bg-white"
                            style={
                              {
                                '--verzoegerung': `${blitz.versatz}ms`,
                                '--kx': k.kx,
                                '--ky': k.ky,
                              } as CSSProperties
                            }
                          />
                        ))}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Das „+N" gehört ins Brett, nicht in die Bühne: Die Bühne ist
              breiter als das Brett, und `.spielbuehne > *:not(.absolute)`
              in index.css greift dort in die Positionierung ein. */}
          <Punktegewinn gewinn={gewinn} />
        </div>
      </div>

      <div className="flex justify-center gap-4">
        {z.tablett.map((teil, i) => (
          <button
            key={teil?.id ?? `leer-${i}`}
            type="button"
            disabled={!teil || z.vorbei}
            onPointerDown={teil ? beiTablettPointerDown(i) : undefined}
            onKeyDown={teil ? beiTablettTaste(i) : undefined}
            onClick={teil ? beiTablettKlick(i) : undefined}
            // Nur ein wirklich belegter Platz ist ein Schalter, der
            // gedrückt sein kann — ein leerer Platz meldet sonst „nicht
            // gedrückt" und klingt dadurch nach einem Teil, das es gibt.
            aria-pressed={teil ? ausgewaehlt === i : undefined}
            aria-label={teil ? `Teil ${i + 1}, ${teil.form.length} Felder` : `Platz ${i + 1}, leer`}
            className={`grid size-24 touch-none place-items-center rounded-xl transition-all disabled:opacity-30 ${
              ausgewaehlt === i || zug?.tablettIndex === i
                ? '-translate-y-1.5 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]'
                : ''
            }`}
          >
            {teil && (
              // Das Wackeln nach einem Fehlversuch. Der Schlüssel wechselt
              // mit der Fehlernummer, damit zwei Fehlversuche kurz
              // hintereinander die Animation wirklich neu starten — und er
              // sitzt hier innen, damit der Knopf dabei seinen Fokus behält.
              <div
                key={fehler?.index === i ? `fehler-${fehler.nr}` : 'ruhig'}
                className={fehler?.index === i ? 'antwort-falsch' : undefined}
              >
                <TeilAnzeige teil={teil} zellgroesse={16} />
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-sm text-gedaempft">
        Ziehen oder antippen und ein Zielfeld antippen. Volle Reihen und
        Spalten lösen sich auf.
      </p>

      {zug && vorschauTeil && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-flaeche/90 p-1.5 shadow-lg"
          style={{ left: zug.x, top: zug.y - VERSATZ_Y }}
        >
          <TeilAnzeige teil={vorschauTeil} zellgroesse={zellgroesseAmFinger} />
        </div>
      )}

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
