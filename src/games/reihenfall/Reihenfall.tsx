import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import { Komboherz } from '../../core/Komboherz';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  FARB_INDEX,
  FORMEN,
  HOEHE,
  aktionAnwenden,
  geisterStein,
  miniZellgroesse,
  neuesSpiel,
  zeitFortschritt,
  zellenVonStein,
} from './logik';
import type { Aktion, TeilTyp, Zustand } from './logik';
import { TEIL_NAMEN, reihenfallFarbe } from './farben';
import { ReihenfallIcon } from './Icon';

const ZELLE_PX = 22;

/**
 * Feld, Stein-Aufsatz und Zerbrösel-Animation liegen als drei Ebenen
 * übereinander und müssen sich deckungsgleich aufteilen — deshalb steht das
 * Raster genau einmal hier und nicht dreimal im Code.
 */
const RASTER_STIL: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `repeat(${BREITE}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${HOEHE}, minmax(0, 1fr))`,
  gap: 1,
};

/**
 * Erst ab einem echten Zeilentreffer melden.
 *
 * Weiches Fallen gibt einen Punkt je Feld — mit der Voreinstellung (jeder
 * Zuwachs zählt) sprang bei gehaltener Pfeiltaste zwanzigmal hintereinander
 * ein riesiges „+1" mitten über das Brett. Die kleinste echte Löschung
 * bringt 100 Punkte (`PUNKTE_PRO_ZEILEN` in `logik.ts`), hartes Fallen
 * höchstens 38 — die Schwelle trennt also genau richtig.
 */
const GEWINN_SCHWELLE = 100;

/** Lücke zwischen zwei Zellen in den kleinen Kästen, in Pixeln (`gap`). */
const MINI_LUECKE = 2;
/** Innenmaß der Kästen: `size-12` (48 px) minus je ein Pixel Rand. */
const MINI_KASTEN = 46;

/** Zeitversatz je Spalte beim Zerbröseln — die Zeile löst sich von links
 *  nach rechts auf statt schlagartig. Bei zehn Spalten macht das rund
 *  200 ms Gesamtlauf, kurz genug, um nicht im Weg zu sein. */
const ZERBROESELN_VERSATZ_MS = 22;

/** Flugrichtung der beiden Krümel je Zelle — fest, kein Zufall. */
const KRUEMEL: readonly { kx: string; ky: string }[] = [
  { kx: '-9px', ky: '11px' },
  { kx: '8px', ky: '13px' },
];

/**
 * Die eben gelöschten Zeilen zerbröseln über dem Feld.
 *
 * Das war die auffälligste Lücke im ganzen Spiel: Volle Zeilen
 * verschwanden bisher völlig lautlos — der Kern des Spiels, und optisch
 * passierte dabei nichts. Block Burst hatte dafür längst `.aufloesen-blitz`
 * und `.kruemel`; beide werden hier unverändert weiterverwendet.
 *
 * Die Zellen liegen als eigenes Raster **über** dem Feld, in derselben
 * Aufteilung. Das Feld selbst ist zu diesem Zeitpunkt bereits
 * zusammengefallen — die Blöcke hier sind also eine Erinnerung an das,
 * was da eben noch lag. Bei gut 200 ms Laufzeit liest sich das als
 * „die Zeile ist zerplatzt", nicht als Widerspruch, und die nach unten
 * wegfliegenden Krümel unterstützen den Zusammenfall sogar.
 */
function ZerbroeselndeZeilen({
  geloescht,
  ruhig,
}: {
  geloescht: Zustand['geloescht'];
  ruhig: boolean;
}) {
  if (geloescht.zeilen.length === 0) return null;

  return (
    <div
      // Der Schlüssel ist der Auslöser: Bei jeder neuen Löschung wird das
      // Raster neu eingehängt, und die CSS-Animationen laufen von vorn.
      key={geloescht.tick}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={RASTER_STIL}
    >
      {geloescht.zeilen.flatMap(({ y, farben }) =>
        farben.map((farbe, x) => {
          if (farbe === null) return null;
          // Bei „weniger Bewegung" selbst auf 0 setzen: `.ruhig` kürzt nur
          // die Dauer, nicht die Verzögerung.
          const versatz = ruhig ? 0 : x * ZERBROESELN_VERSATZ_MS;
          const zeit = { '--verzoegerung': `${versatz}ms` } as CSSProperties;
          return (
            <div
              key={`${y},${x}`}
              className="relative"
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
            >
              <div
                className="aufloesen-blitz glanzstein absolute inset-0 rounded-[3px]"
                style={{ ...zeit, backgroundColor: reihenfallFarbe(farbe) }}
              />
              {/* Der weiße Blitz darüber — er macht aus dem Schrumpfen ein
                  Aufleuchten. */}
              <div
                className="aufloesen-blitz absolute inset-0 rounded-[3px] bg-white"
                style={zeit}
              />
              {KRUEMEL.map((k) => (
                <span
                  key={k.kx}
                  className="kruemel absolute top-1/2 left-1/2 size-1 rounded-full bg-white"
                  style={{ ...zeit, '--kx': k.kx, '--ky': k.ky } as CSSProperties}
                />
              ))}
            </div>
          );
        }),
      )}
    </div>
  );
}

/**
 * Zeigt ein Teil in seiner Start-Lage als kleines Raster — für Halten und
 * Vorschau.
 *
 * Die Zellgröße kommt aus dem Kasten (`miniZellgroesse`) und ist nicht mehr
 * fest: Mit den früheren 11 Pixeln brauchte der I-Stein 50 Pixel Breite und
 * ragte damit aus seinem 36 Pixel breiten Kästchen heraus — er lag über den
 * Nachbarkästchen.
 */
function MiniTeil({ typ, abgedunkelt = false }: { typ: TeilTyp; abgedunkelt?: boolean }) {
  const form = FORMEN[typ][0];
  /*
   * **Auf den kleinsten Wert normiert, nicht bloß auf den größten.**
   *
   * Die Formen stehen in einem Raster, das nicht bei 0 anfangen muss: Beim
   * I-Stein liegen alle vier Zellen auf `dy = 1`. Ohne diese Verschiebung
   * bekam sein Vorschaukasten eine **leere Kopfzeile**, und als einziges
   * der sieben Teile saß er rund sechs Pixel unter der Mitte — in einer
   * Reihe nebeneinander fällt genau das auf.
   */
  const minDx = Math.min(...form.map((v) => v.dx));
  const minDy = Math.min(...form.map((v) => v.dy));
  const breite = Math.max(...form.map((v) => v.dx)) - minDx + 1;
  const hoehe = Math.max(...form.map((v) => v.dy)) - minDy + 1;
  const belegt = new Set(form.map((v) => `${v.dx - minDx},${v.dy - minDy}`));
  const groesse = miniZellgroesse(MINI_KASTEN, MINI_LUECKE);
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${breite}, ${groesse}px)`,
        gridTemplateRows: `repeat(${hoehe}, ${groesse}px)`,
        gap: MINI_LUECKE,
        opacity: abgedunkelt ? 0.35 : 1,
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
            style={{ backgroundColor: gefuellt ? reihenfallFarbe(FARB_INDEX[typ]) : 'transparent' }}
          />
        );
      })}
    </div>
  );
}

/** Wartezeit bis zur ersten Wiederholung — wie in `core/Steuerkreuz.tsx`. */
const WIEDERHOL_VERZOEGERUNG = 170;
/** Abstand der weiteren Wiederholungen, ebenfalls wie beim Steuerkreuz. */
const WIEDERHOL_TAKT = 45;

/**
 * Ein Knopf, der seine Aktion bei gehaltenem Finger wiederholt.
 *
 * Zur Seite ging es bisher **nur** per Wischgeste, und `useInput` wertet je
 * Wisch genau einen Zug aus (es sperrt den Zeiger, sobald die Richtung
 * erkannt ist). Drei Spalten nach links waren also drei einzelne Wischer —
 * während eine gehaltene Pfeiltaste längst wiederholt. Auf dem Touchgerät,
 * also überall dort, wo dieses Spiel wirklich gespielt wird, fehlte das
 * Gegenstück komplett.
 *
 * Zeiten und Aufbau bewusst wie in `core/Steuerkreuz.tsx`. Das Kreuz selbst
 * passt hier nicht — siehe den Kommentar dort: Line Fall braucht daneben
 * Drehen, hartes Fallen und Halten, und dafür wären die vier Richtungen
 * eines Kreuzes plus drei Knöpfe zu viel Höhe.
 */
function WiederholKnopf({
  onAktion,
  beschriftung,
  symbol,
  aktiv,
}: {
  onAktion: () => void;
  beschriftung: string;
  symbol: string;
  aktiv: boolean;
}) {
  // Über eine Ref, damit die laufende Wiederholung nicht auf einer alten
  // Fassung der Funktion hängen bleibt — dasselbe Muster wie in useInput.
  const aktionRef = useRef(onAktion);
  aktionRef.current = onAktion;

  const start = useRef<number | undefined>(undefined);
  const folge = useRef<number | undefined>(undefined);

  const loslassen = useCallback(() => {
    window.clearTimeout(start.current);
    window.clearInterval(folge.current);
  }, []);

  // Aufräumen, wenn die Runde endet, während der Finger noch liegt — und
  // wenn der Knopf ganz verschwindet.
  useEffect(() => {
    if (!aktiv) loslassen();
  }, [aktiv, loslassen]);
  useEffect(() => loslassen, [loslassen]);

  const druecken = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    loslassen();
    aktionRef.current();
    start.current = window.setTimeout(() => {
      folge.current = window.setInterval(() => aktionRef.current(), WIEDERHOL_TAKT);
    }, WIEDERHOL_VERZOEGERUNG);
  };

  return (
    <button
      type="button"
      aria-label={beschriftung}
      disabled={!aktiv}
      onPointerDown={druecken}
      onPointerUp={loslassen}
      onPointerLeave={loslassen}
      onPointerCancel={loslassen}
      // `detail === 0` heißt: Der Klick kam von der Tastatur (Enter oder
      // Leertaste auf dem fokussierten Knopf), nicht vom Finger. Ohne diese
      // Zeile wäre der Knopf für Tastaturbedienung tot, mit einem
      // ungeprüften `onClick` würde jede Berührung doppelt zählen.
      onClick={(e) => {
        if (e.detail === 0) aktionRef.current();
      }}
      // Ohne das öffnet langes Drücken auf einem Handy das Auswahlmenü.
      onContextMenu={(e) => e.preventDefault()}
      className="spielknopf touch-none select-none text-xl"
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

/**
 * Fallende Blöcke im Hintergrund des Startbildschirms, in klassischen
 * Tetromino-Farben — feste Liste, rein dekorativ, siehe
 * Blockblitz-Startbildschirm für dasselbe Muster.
 */
const DEKO_BLOECKE: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  winkel: number;
  verzoegerung: number;
}[] = [
  { x: 10, y: 12, groesse: 24, farbe: '#22d3ee', winkel: 6, verzoegerung: 0 },
  { x: 86, y: 16, groesse: 20, farbe: '#facc15', winkel: -10, verzoegerung: 0.7 },
  { x: 80, y: 76, groesse: 26, farbe: '#a855f7', winkel: 4, verzoegerung: 1.2 },
  { x: 8, y: 80, groesse: 22, farbe: '#4ade80', winkel: -6, verzoegerung: 0.4 },
  { x: 92, y: 46, groesse: 16, farbe: '#f87171', winkel: 12, verzoegerung: 1.7 },
  { x: 4, y: 48, groesse: 18, farbe: '#60a5fa', winkel: -4, verzoegerung: 1.0 },
  { x: 55, y: 8, groesse: 14, farbe: '#fb923c', winkel: 20, verzoegerung: 0.2 },
];

/**
 * Titelbild angelehnt an klassische Stapel-Puzzles wie Tetris — dunkles,
 * aber nicht schwarzes Blau mit Neon-Raster und bunten Tetromino-Farben,
 * blockige Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm für
 * die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{
        background:
          'linear-gradient(180deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%),' +
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 34px),' +
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 34px)',
        backgroundBlendMode: 'normal, normal, normal',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_BLOECKE.map((b, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-md opacity-90"
            style={
              {
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.groesse,
                height: b.groesse,
                backgroundColor: b.farbe,
                boxShadow: `0 0 14px ${b.farbe}`,
                animationDelay: `${b.verzoegerung}s`,
                '--grundwinkel': `${b.winkel}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <ReihenfallIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(96,165,250,0.5)' }}
        >
          Line Fall
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/80">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Bereit, Reihen zu räumen?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-indigo-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function Reihenfall({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('reihenfall', Date.now())));
  const feldRef = useRef<HTMLDivElement>(null);
  const zeilenVorherRef = useRef(0);

  /*
   * `gestartet` gehört mit in die Bedingung — und das ist kein Feinschliff.
   *
   * Ohne es lief die Schleife **hinter dem Startbildschirm weiter**: Der
   * Stein fiel, der Stapel wuchs, und wer sich den Titel eine Weile ansah,
   * tippte auf „Spielen" und stand vor einem halb vollen Feld — im
   * schlimmsten Fall vor einer schon verlorenen Runde.
   */
  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), {
    fps: 30,
    running: gestartet && !z.vorbei,
  });

  const anwenden = (aktion: Aktion) => setZ((alt) => aktionAnwenden(alt, aktion));

  useInput(
    (eingabe) => {
      if (z.vorbei) return;
      switch (eingabe) {
        case 'left':
          anwenden('links');
          break;
        case 'right':
          anwenden('rechts');
          break;
        case 'down':
          anwenden('weichFallen');
          break;
        case 'up':
          anwenden('drehenGegenUhr');
          break;
        case 'rotate':
        case 'select':
          anwenden('drehenUhr');
          break;
        case 'drop':
          anwenden('hartFallen');
          break;
      }
    },
    { bereich: feldRef, wiederholen: ['left', 'right', 'down'], tippen: 'select', aktiv: !z.vorbei },
  );

  // Zusätzliche Taste fürs Halten — kein Platz mehr in den sieben
  // Aktionen von useInput, deshalb ein eigener, schmaler Listener.
  useEffect(() => {
    if (z.vorbei) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.code === 'KeyC' && !e.repeat) {
        e.preventDefault();
        anwenden('halten');
      }
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  // Line Fall zeigte die Punktzahl bisher gar nicht im Spielbereich — nur in
  // der Kopfzeile der Hülle. Das Popup über dem Brett bringt den Gewinn
  // dorthin, wo man ohnehin hinsieht, und kostet keine Höhe.
  const gewinn = usePunktegewinn(z.punkte, GEWINN_SCHWELLE);

  useEffect(() => {
    const differenz = z.zeilenGesamt - zeilenVorherRef.current;
    zeilenVorherRef.current = z.zeilenGesamt;
    // Höher bei einer Serie von Vierfach-Löschungen, siehe core/sfx.ts.
    if (differenz >= 4) sfx('stufe', Math.max(0, z.vierfachStreak - 1) * 3);
    else if (differenz > 0) sfx('gut', differenz - 1);
  }, [z.zeilenGesamt]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  /**
   * Das ruhende Feld wird nur neu gezeichnet, wenn sich wirklich etwas darin
   * ändert — also wenn ein Stein einrastet oder Zeilen wegfallen.
   *
   * Ohne die Merkung wurden alle 10 × 20 = 200 Zellen dreißigmal je Sekunde
   * neu abgeglichen, obwohl sich je Bild höchstens die vier Zellen des
   * fallenden Steins bewegen: 6000 React-Elemente in der Sekunde für ein
   * Raster, das zwischen zwei Einrastungen unverändert bleibt. Genau dieselbe
   * Stelle war bei Ghost Chase die teuerste im ganzen Projekt.
   *
   * `zeitFortschritt` liefert zwar jedes Bild ein frisches Zustandsobjekt,
   * aber `z.feld` bleibt dabei dasselbe Feld — die eine Abhängigkeit reicht.
   */
  const ruhendesFeld = useMemo(
    () => (
      <div className="absolute inset-0" style={RASTER_STIL}>
        {z.feld.flatMap((zeile, y) =>
          zeile.map((farbe, x) => (
            <div
              key={`${x},${y}`}
              className={`rounded-[3px] ${farbe !== null ? 'glanzstein' : ''}`}
              style={{
                backgroundColor: farbe === null ? 'var(--color-flaeche)' : reihenfallFarbe(farbe),
              }}
            />
          )),
        )}
      </div>
    ),
    [z.feld],
  );

  const geist = z.aktuell ? geisterStein(z.feld, z.aktuell) : null;
  // Vier Schlüssel, kein Raster: Wo der Stein schon aufliegt, deckt er den
  // Geist genau zu — und ein Umriss wird immer **zuletzt** gezeichnet, läge
  // also sonst als doppelter Rand über dem Stein.
  const aktuelleZellen = new Set(
    z.aktuell ? zellenVonStein(z.aktuell).map((p) => `${p.x},${p.y}`) : [],
  );

  if (!gestartet) {
    return (
      <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3 spielseite">
      <div className="flex w-full items-center justify-center gap-6 text-sm text-gedaempft">
        <span>Level {z.level}</span>
        <span>Zeilen {z.zeilenGesamt}</span>
      </div>

      {/* Halten und Vorschau als schmale Zeile über dem Brett. Nebeneinander
          nahmen sie dem Brett die Breite weg — auf einem kleinen Handy blieb
          davon fast nichts übrig. */}
      <div className="flex w-full max-w-xs items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gedaempft">Halten</span>
          {/* `overflow-hidden` ist die Absicherung: Sollte die Zellgröße je
              wieder nicht zum Kasten passen, bleibt der Überstand wenigstens
              im Kasten und liegt nicht über dem Nachbarn. */}
          <div className="grid size-12 place-items-center overflow-hidden rounded-lg border border-rand bg-flaeche">
            {z.haltePosition && <MiniTeil typ={z.haltePosition} abgedunkelt={z.halteBenutzt} />}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gedaempft">Nächste</span>
          {z.warteschlange.slice(0, 3).map((typ, i) => (
            <div
              key={i}
              className="grid size-12 place-items-center overflow-hidden rounded-lg border border-rand bg-flaeche"
            >
              <MiniTeil typ={typ} />
            </div>
          ))}
        </div>
      </div>

      <div className="spielbuehne relative">
        {/* Dasselbe Kombo-Herz wie in Block Burst. Hier zählt es die Serie
            von Vierfach-Löschungen — die ist selten, und genau deshalb darf
            sie auffallen. */}
        <Komboherz
          kombo={z.vierfachStreak}
          ruhig={settings.reducedMotion}
          beschriftung="Vierfach"
          className="absolute -top-2 right-0 z-10"
        />
        <div
          ref={feldRef}
          className="spielbrett spielbrett-rahmen relative touch-none bg-rand"
          style={{ maxWidth: BREITE * ZELLE_PX, '--vz': BREITE / HOEHE } as CSSProperties}
          role="img"
          aria-label={`Spielfeld, Level ${z.level}, ${z.zeilenGesamt} Zeilen geschafft.${z.vorbei ? ' Spiel vorbei.' : ''}`}
        >
          {ruhendesFeld}

          {/* Der fallende Stein und sein Schatten als dünner Aufsatz über dem
              ruhenden Feld — acht Elemente je Bild statt zweihundert. Zellen
              oberhalb der Feldkante (y < 0) fallen weg, sie haben keine
              Rasterzeile. */}
          <div className="pointer-events-none absolute inset-0" style={RASTER_STIL} aria-hidden="true">
            {geist &&
              zellenVonStein(geist)
                .filter((p) => p.y >= 0 && !aktuelleZellen.has(`${p.x},${p.y}`))
                .map((p) => (
                  <div
                    key={`geist-${p.x},${p.y}`}
                    className="rounded-[3px]"
                    style={{
                      gridColumn: p.x + 1,
                      gridRow: p.y + 1,
                      outline: '2px solid var(--color-gedaempft)',
                      outlineOffset: -2,
                    }}
                  />
                ))}
            {z.aktuell &&
              zellenVonStein(z.aktuell)
                .filter((p) => p.y >= 0)
                .map((p) => (
                  <div
                    key={`stein-${p.x},${p.y}`}
                    className="glanzstein rounded-[3px]"
                    style={{
                      gridColumn: p.x + 1,
                      gridRow: p.y + 1,
                      backgroundColor: reihenfallFarbe(FARB_INDEX[z.aktuell!.typ]),
                    }}
                  />
                ))}
          </div>

          <ZerbroeselndeZeilen geloescht={z.geloescht} ruhig={settings.reducedMotion} />

          {/* Das „+N" liegt im Brett, nicht in der Bühne — so macht es Ghost
              Chase, und das ist die haltbarere Bauweise: Es erscheint mittig
              über dem Feld statt mittig über der ganzen (breiteren) Bühne,
              und es hängt nicht an der Sonderregel `.spielbuehne > .absolute`
              in index.css, die genau dieses Popup einmal zum zweiten
              Flex-Kind gemacht und das Brett zur Seite geschoben hat. */}
          <Punktegewinn gewinn={gewinn} />

          {/* Kein eigenes „Vorbei" mehr im Feld — die Hülle legt direkt
              darüber ihr Rundenende-Fenster, das stand doppelt. */}
        </div>

      </div>

      {/* Zwei Reihen, nicht eine: Fünf Knöpfe nebeneinander passen auf einem
          Handy nicht mehr in die Breite (die drei beschrifteten allein
          brauchen rund 270 Pixel). Oben steht, was man ständig braucht —
          seitwärts und drehen. */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          <WiederholKnopf
            onAktion={() => anwenden('links')}
            beschriftung="Nach links"
            symbol="←"
            aktiv={!z.vorbei}
          />
          <button
            type="button"
            onClick={() => anwenden('drehenUhr')}
            disabled={z.vorbei}
            className="spielknopf text-sm"
          >
            <span aria-hidden="true">↺</span> Drehen
          </button>
          <WiederholKnopf
            onAktion={() => anwenden('rechts')}
            beschriftung="Nach rechts"
            symbol="→"
            aktiv={!z.vorbei}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => anwenden('hartFallen')}
            disabled={z.vorbei}
            className="spielknopf text-sm"
          >
            <span aria-hidden="true">⬇</span> Fallen
          </button>
          <button
            type="button"
            onClick={() => anwenden('halten')}
            disabled={z.vorbei || z.halteBenutzt}
            className="spielknopf text-sm"
          >
            <span aria-hidden="true">⇄</span> Halten
          </button>
        </div>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder die Pfeilknöpfe bewegen — gedrückt halten
        wiederholt. X oder Antippen dreht, Leertaste oder schnelles Wischen
        nach unten lässt hart fallen. Aktuell:{' '}
        {z.aktuell ? TEIL_NAMEN[z.aktuell.typ] : '–'}.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
