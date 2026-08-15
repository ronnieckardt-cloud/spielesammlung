import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { sfx } from '../../core/sfx';
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
        <p className="mt-3 text-sm font-semibold text-white/85">
          Wie weit kommst du?
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
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-cyan-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function MergeUp({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('mergeup', Date.now())));
  const feldRef = useRef<HTMLDivElement>(null);
  const punkteVorherRef = useRef(0);
  const gewonnenVorherRef = useRef(false);

  // Die vier Himmelsrichtungen des Eingabe-Bausteins heißen im Spiel anders.
  // Eine Abbildung für Tastatur, Wischen **und** Steuerkreuz.
  const beiKreuz = useCallback((eingabe: 'up' | 'down' | 'left' | 'right') => {
    const richtungen: Record<typeof eingabe, Richtung> = {
      up: 'hoch',
      down: 'runter',
      left: 'links',
      right: 'rechts',
    };
    setZ((alt) => ziehen(alt, richtungen[eingabe]));
  }, []);

  useInput(
    (eingabe) => {
      if (eingabe === 'up' || eingabe === 'down' || eingabe === 'left' || eingabe === 'right') {
        beiKreuz(eingabe);
      }
    },
    // Kein Wiederholen bei gehaltener Taste — ein Zug soll ein Tastendruck
    // sein, sonst rauscht das halbe Spiel bei einem zu langen Druck durch.
    { bereich: feldRef, wiederholen: [], aktiv: gestartet && !z.vorbei },
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
        className="spielbrett spielbrett-rahmen grid touch-none gap-2 bg-flaeche p-2"
        style={
          {
            gridTemplateColumns: `repeat(${GROESSE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GROESSE}, minmax(0, 1fr))`,
            '--vz': 1,
          } as CSSProperties
        }
        role="img"
        aria-label={`Spielfeld. ${beschreibung}.${z.vorbei ? ' Vorbei.' : ''}`}
      >
        {z.raster.flat().map((feld, i) => (
          <div
            key={i}
            className="grid place-items-center rounded-xl bg-flaeche-hoch"
          >
            {feld !== null && (
              <div
                // key auf den Wert: bei jeder Änderung spielt der kurze Puls
                // erneut ab, dadurch sieht man das Verschmelzen.
                key={feld}
                className="punkte-bumsen glanzstein grid size-full place-items-center rounded-xl font-black tabular-nums"
                style={{
                  backgroundColor: kachelFarbe(feld),
                  color: kachelTextFarbe(feld),
                  // Große Zahlen brauchen kleinere Schrift, sonst passen sie nicht.
                  fontSize: wertVonStufe(feld) >= 1024 ? '1.1rem' : wertVonStufe(feld) >= 128 ? '1.4rem' : '1.7rem',
                  boxShadow: `0 4px 12px -4px ${kachelFarbe(feld)}`,
                }}
              >
                {wertVonStufe(feld)}
              </div>
            )}
          </div>
        ))}
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
