import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import { GROESSE, neuesSpiel, wertVonStufe, ziehen } from './logik';
import type { Richtung, Zustand } from './logik';
import { kachelFarbe, kachelTextFarbe } from './farben';
import { MergeUpIcon } from './Icon';

/**
 * Schwebende Deko-Kacheln im Hintergrund des Startbildschirms — feste Liste,
 * rein dekorativ, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
const DEKO_KACHELN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  winkel: number;
  verzoegerung: number;
}[] = [
  { x: 9, y: 13, groesse: 28, farbe: '#38bdf8', winkel: 10, verzoegerung: 0 },
  { x: 86, y: 9, groesse: 22, farbe: '#facc15', winkel: -12, verzoegerung: 0.6 },
  { x: 81, y: 79, groesse: 32, farbe: '#4ade80', winkel: 6, verzoegerung: 1.1 },
  { x: 8, y: 79, groesse: 24, farbe: '#f472b6', winkel: -8, verzoegerung: 0.3 },
  { x: 92, y: 45, groesse: 17, farbe: '#fb923c', winkel: 18, verzoegerung: 1.6 },
  { x: 4, y: 46, groesse: 19, farbe: '#c084fc', winkel: -5, verzoegerung: 0.9 },
];

/**
 * Titelbild im Stil bunter Zahlen-Puzzles — kräftiger Verlauf, schwebende
 * Kacheln, dicke Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm
 * für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #0369a1 0%, #0891b2 40%, #0d9488 70%, #65a30d 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_KACHELN.map((k, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-lg opacity-85"
            style={
              {
                left: `${k.x}%`,
                top: `${k.y}%`,
                width: k.groesse,
                height: k.groesse,
                backgroundColor: k.farbe,
                animationDelay: `${k.verzoegerung}s`,
                '--grundwinkel': `${k.winkel}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <MergeUpIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Merge Up
        </h1>
        {/* Die Regel, nicht „Wie weit kommst du?". Das war die einzige Stelle
            im Spiel, die vor der ersten Runde noch etwas erklären konnte —
            der Hilfetext unten im Spiel fällt auf Handys unter 720 Pixel Höhe
            weg (`.nur-bei-platz`), und nach „Nochmal" kommt dieser Bildschirm
            gar nicht mehr. Steht bewusst **neben** der Bestleistung, nicht
            statt ihrer — siehe core/Startbildschirm.tsx. */}
        <p className="mt-3 text-sm font-semibold text-white/85">
          Wische die Kacheln zusammen — zwei gleiche werden eine doppelte.
        </p>
        {bestScore > 0 && (
          <p className="mt-1.5 text-sm font-bold text-white/70">
            <span aria-hidden="true">🏆</span> Beste Punktzahl: {bestScore}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-cyan-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

/**
 * Die vier Himmelsrichtungen des Eingabe-Bausteins heißen im Spiel anders.
 * Eine Abbildung für Tastatur, Wischen **und** Steuerkreuz.
 */
const RICHTUNGEN: Record<'up' | 'down' | 'left' | 'right', Richtung> = {
  up: 'hoch',
  down: 'runter',
  left: 'links',
  right: 'rechts',
};

/**
 * Muss zur Tailwind-Klasse `gap-2` am Brett passen: Ein Feld weiter heißt für
 * eine Kachel „die eigene Breite plus die Lücke dazwischen". Über Prozent
 * gerechnet statt in Pixeln, damit die Bewegung auf jeder Brettgröße stimmt,
 * ohne etwas messen zu müssen.
 */
const LUECKE = '0.5rem';

/** Wie lange eine Kachel für ihren Weg braucht — kurz genug, dass ein
 *  schnelles Kind nicht wartet, lang genug, dass man die Bewegung sieht. */
const RUTSCH_MS = 130;

/** Wie weit das Brett nachgibt, wenn ein Zug nichts bewegt. */
const STUPS_PX = 7;
const STUPS_VERSATZ: Record<Richtung, string> = {
  hoch: `translateY(-${STUPS_PX}px)`,
  runter: `translateY(${STUPS_PX}px)`,
  links: `translateX(-${STUPS_PX}px)`,
  rechts: `translateX(${STUPS_PX}px)`,
};

export function MergeUp({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('mergeup', Date.now())));
  const feldRef = useRef<HTMLDivElement>(null);
  const punkteVorherRef = useRef(0);
  const gewonnenVorherRef = useRef(false);
  // Schwelle 32: Bei jedem Vierer-Verschmelzen ein „+4" quer über das Brett
  // wäre Dauerflimmern — gemeldet wird, was sich lohnt (siehe Ghost Chase).
  const gewinn = usePunktegewinn(z.punkte, 32);

  const ruhig = settings.reducedMotion;

  // Der Zustand zusätzlich als Ref: `beiKreuz` rechnet den Zug selbst aus, um
  // einen wirkungslosen Zug zu erkennen, und darf dabei nicht in einer
  // veralteten Closure hängen (gleicher Griff wie beim Ziehen in Block Burst).
  const zRef = useRef(z);
  zRef.current = z;

  // Ein Zug wird in zwei Bildern gezeichnet: erst stehen die Kacheln noch auf
  // ihrem Herkunftsfeld, dann rutschen sie ins Ziel. `false` heißt „noch am
  // Start". Ohne diesen Zwischenschritt gäbe es kein Von-Bild, von dem aus
  // der Übergang laufen könnte.
  const [gelandet, setGelandet] = useState(true);
  const [stups, setStups] = useState<Richtung | null>(null);
  const stupsUhrRef = useRef(0);

  useLayoutEffect(() => {
    if (ruhig || z.bild === null) return;
    // `useLayoutEffect`, nicht `useEffect`: Das Zurücksetzen auf die
    // Startfelder muss **vor** dem Zeichnen passieren, sonst blitzt das
    // Endbild für ein Bild auf und die Bewegung fängt zu spät an.
    setGelandet(false);
    let zweiter = 0;
    const erster = requestAnimationFrame(() => {
      zweiter = requestAnimationFrame(() => setGelandet(true));
    });
    return () => {
      cancelAnimationFrame(erster);
      cancelAnimationFrame(zweiter);
    };
    // Nur die Zugnummer zählt: Zwei gleiche Züge hintereinander sollen die
    // Bewegung erneut auslösen, ein bloßes Neuzeichnen nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.zug]);

  const fehlzug = useCallback(
    (richtung: Richtung) => {
      // „Geht nicht" muss sich anders anfühlen als „nicht angekommen": Ohne
      // jede Rückmeldung war ein Wisch gegen die Wand von einer verschluckten
      // Eingabe nicht zu unterscheiden. Das Brett gibt kurz in die
      // gewünschte Richtung nach und federt zurück.
      sfx('klick');
      haptik('fehler');
      if (ruhig) return;
      setStups(richtung);
      window.clearTimeout(stupsUhrRef.current);
      stupsUhrRef.current = window.setTimeout(() => setStups(null), 110);
    },
    [ruhig],
  );

  useEffect(() => () => window.clearTimeout(stupsUhrRef.current), []);

  const beiKreuz = useCallback(
    (eingabe: 'up' | 'down' | 'left' | 'right') => {
      const alt = zRef.current;
      const richtung = RICHTUNGEN[eingabe];
      const neu = ziehen(alt, richtung);
      if (neu === alt) {
        // `ziehen` gibt denselben Zustand zurück, wenn sich nichts bewegt hat.
        if (!alt.vorbei) fehlzug(richtung);
        return;
      }
      // Sofort mitschreiben: Zwei schnelle Wische hintereinander sollen nicht
      // beide vom selben, noch nicht gezeichneten Stand ausgehen.
      zRef.current = neu;
      setZ(neu);
    },
    [fehlzug],
  );

  useInput(
    (eingabe) => {
      // Ein schneller Wisch nach unten ist hier schlicht ein Zug nach
      // unten — es gibt nichts fallen zu lassen. Das steht als
      // `wurf: 'down'` unten in den Optionen und **nicht** mehr als
      // Umdeutung von 'drop' an dieser Stelle: Die Leertaste liegt in
      // `useInput` ebenfalls auf 'drop' und löste über die alte Umdeutung
      // still einen Zug aus.
      if (eingabe === 'up' || eingabe === 'down' || eingabe === 'left' || eingabe === 'right') {
        beiKreuz(eingabe);
      }
    },
    // Kein Wiederholen bei gehaltener Taste — ein Zug soll ein Tastendruck
    // sein, sonst rauscht das halbe Spiel bei einem zu langen Druck durch.
    { bereich: feldRef, wiederholen: [], wurf: 'down', aktiv: gestartet && !z.vorbei },
  );

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    const differenz = z.punkte - punkteVorherRef.current;
    punkteVorherRef.current = z.punkte;
    if (differenz > 0) sfx(differenz >= 64 ? 'stufe' : 'gut');
  }, [z.punkte]);

  useEffect(() => {
    if (z.gewonnen && !gewonnenVorherRef.current) {
      gewonnenVorherRef.current = true;
      sfx('stufe');
    }
  }, [z.gewonnen]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte, z.gewonnen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const beschreibung = z.raster
    .map(
      (reihe, y) =>
        `Zeile ${y + 1}: ${reihe.map((f) => (f === null ? 'leer' : wertVonStufe(f))).join(', ')}`,
    )
    .join('. ');

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3 spielseite">
      <output
        aria-live="off"
        key={z.punkte}
        className="punkte-bumsen text-5xl font-black tabular-nums text-text sm:text-6xl"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {z.punkte}
      </output>

      <p className="text-sm text-gedaempft">
        Beste Kachel:{' '}
        <span className="font-bold tabular-nums text-text">
          {z.hoechsteStufe > 0 ? wertVonStufe(z.hoechsteStufe) : '–'}
        </span>
        {z.gewonnen && <span className="ml-2">🎉 2048 geschafft!</span>}
      </p>

      <div className="spielbuehne">
      <div
        ref={feldRef}
        className="spielbrett spielbrett-rahmen relative grid touch-none gap-2 bg-flaeche p-2"
        style={
          {
            gridTemplateColumns: `repeat(${GROESSE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GROESSE}, minmax(0, 1fr))`,
            '--vz': 1,
            transform: stups ? STUPS_VERSATZ[stups] : undefined,
            transition: 'transform 90ms ease-out',
          } as CSSProperties
        }
        role="img"
        aria-label={`Spielfeld. ${beschreibung}.${z.vorbei ? ' Vorbei.' : ''}`}
      >
        {z.raster.flat().map((feld, i) => {
          const x = i % GROESSE;
          const y = Math.floor(i / GROESSE);
          const bild = z.bild?.[y]?.[x] ?? null;
          // Nur im ersten der beiden Bilder sitzt die Kachel auf ihrem
          // Herkunftsfeld; danach steht sie im Ziel und der Übergang
          // erledigt den Weg.
          const dx = bild && !gelandet ? bild.vonX - x : 0;
          const dy = bild && !gelandet ? bild.vonY - y : 0;
          return (
            <div key={i} className="grid place-items-center rounded-xl bg-flaeche-hoch">
              {feld !== null && (
                <div
                  // `relative z-10`: Eine rutschende Kachel zieht über fremde
                  // Felder hinweg. Ohne eigene Ebene malt der Hintergrund des
                  // später kommenden Feldes sie unterwegs zu.
                  //
                  // Der farbige Schein sitzt hier und nicht auf der Kachel
                  // selbst: Dort überschrieb er als Inline-Stil die
                  // Lichtkanten von `.glanzstein` restlos — der Stein sah
                  // flach aus, obwohl die Klasse dranstand.
                  className="relative z-10 size-full rounded-xl"
                  style={{
                    transform:
                      dx || dy
                        ? `translate(calc(${dx} * (100% + ${LUECKE})), calc(${dy} * (100% + ${LUECKE})))`
                        : undefined,
                    transition: gelandet ? `transform ${RUTSCH_MS}ms ease-out` : 'none',
                    boxShadow: `0 4px 12px -4px ${kachelFarbe(feld)}`,
                  }}
                >
                  <div
                    // Schlüsselwechsel nur beim Verschmelzen — dann läuft der
                    // Puls neu an. Vorher hing er am Wert und pulste auch beim
                    // bloßen Nachrücken; dadurch sahen Rutschen, Verschmelzen
                    // und neue Kachel alle drei gleich aus.
                    key={bild?.verschmolzen ? `v${z.zug}` : 'kachel'}
                    className={`glanzstein grid size-full place-items-center rounded-xl font-black tabular-nums${
                      bild?.verschmolzen && !ruhig ? ' punkte-bumsen' : ''
                    }`}
                    style={{
                      backgroundColor: kachelFarbe(feld),
                      color: kachelTextFarbe(feld),
                      // Große Zahlen brauchen kleinere Schrift, sonst passen sie nicht.
                      fontSize: wertVonStufe(feld) >= 1024 ? '1.1rem' : wertVonStufe(feld) >= 128 ? '1.4rem' : '1.7rem',
                      // Die frisch dazugelegte Kachel ploppt auf — das dritte
                      // der drei Ereignisse, und das einzige, das keinen Weg
                      // zurücklegt. `scale` als eigene Eigenschaft, damit es
                      // sich nicht mit dem `transform` oben beißt.
                      scale: bild?.neu && !gelandet ? '0.3' : '1',
                      transition: gelandet ? `scale ${RUTSCH_MS}ms ease-out` : 'none',
                    }}
                  >
                    {wertVonStufe(feld)}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Gehört ins Brett, nicht in die Bühne: In der Bühne würde die Regel
            `.spielbuehne > *:not(.absolute)` das Popup zu einem zweiten
            Flex-Kind machen und das Brett zur Seite schieben. */}
        <Punktegewinn gewinn={gewinn} />
      </div>

      </div>

      {/* Der gemeinsame Baustein statt einer Kopie. Der Kopie hier fehlten
          `touch-none` und die Unterdrückung des Kontextmenüs — langes
          Drücken auf einen Pfeil öffnete auf dem iPhone das Auswahlmenü. */}
      <Steuerkreuz kompakt onRichtung={beiKreuz} aktiv={!z.vorbei} />

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder die Knöpfe schieben alle Kacheln. Zwei
        gleiche verschmelzen zur doppelten. Ziel ist die 2048 — danach darfst
        du weiterspielen, solange noch ein Zug geht.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
