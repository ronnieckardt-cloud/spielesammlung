import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import { BREITE, HOEHE, neuesSpiel, richtungWaehlen, zeitFortschritt } from './logik';
import type { Richtung, Zustand } from './logik';
import { SchlangeIcon } from './Icon';
import { Apfel, Goldstern, Kopf, Koerper, Raster, Ringe } from './figuren';


/**
 * Schwebende Deko-Punkte im Hintergrund des Startbildschirms — feste Liste,
 * rein dekorativ, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
const DEKO_PUNKTE: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 10, y: 14, groesse: 24, farbe: '#f43f5e', verzoegerung: 0 },
  { x: 86, y: 10, groesse: 18, farbe: '#facc15', verzoegerung: 0.6 },
  { x: 82, y: 78, groesse: 28, farbe: '#4ade80', verzoegerung: 1.1 },
  { x: 8, y: 80, groesse: 20, farbe: '#facc15', verzoegerung: 0.3 },
  { x: 92, y: 46, groesse: 15, farbe: '#f43f5e', verzoegerung: 1.6 },
  { x: 5, y: 46, groesse: 17, farbe: '#4ade80', verzoegerung: 0.9 },
];

/**
 * Titelbild im Stil klassischer Arcade-Spiele — kräftiges Grün, schwebende
 * Punkte, dicke Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm
 * für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #065f46 0%, #16a34a 45%, #65a30d 75%, #ca8a04 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_PUNKTE.map((p, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-85"
            style={
              {
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.groesse,
                height: p.groesse,
                backgroundColor: p.farbe,
                animationDelay: `${p.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <SchlangeIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Snake Rush
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Wie lang wird deine Schlange?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-green-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function Schlange({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('schlange', Date.now())));
  const feldRef = useRef<SVGSVGElement>(null);
  const punkteVorherRef = useRef(0);

  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), {
    fps: 60,
    running: gestartet && !z.vorbei,
  });

  // Die vier Himmelsrichtungen des Eingabe-Bausteins heißen im Spiel anders.
  // Eine Abbildung für Tastatur, Wischen **und** Steuerkreuz.
  const beiKreuz = useCallback((eingabe: 'up' | 'down' | 'left' | 'right') => {
    const richtungen: Record<typeof eingabe, Richtung> = {
      up: 'hoch',
      down: 'runter',
      left: 'links',
      right: 'rechts',
    };
    setZ((alt) => richtungWaehlen(alt, richtungen[eingabe]));
  }, []);

  useInput(
    (eingabe) => {
      if (eingabe === 'up' || eingabe === 'down' || eingabe === 'left' || eingabe === 'right') {
        beiKreuz(eingabe);
      }
    },
    // Kein Wiederholen bei gehaltener Taste: die Richtung gilt ohnehin bis
    // zur nächsten Eingabe, mehrfaches Auslösen brächte nichts.
    { bereich: feldRef, wiederholen: [], aktiv: gestartet && !z.vorbei },
  );

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    const differenz = z.punkte - punkteVorherRef.current;
    punkteVorherRef.current = z.punkte;
    if (differenz > 0) sfx(differenz > 10 ? 'stufe' : 'gut');
  }, [z.punkte]);

  // Der Zuwachs war bisher nur am Zähler oben zu sehen, nicht am Ort des
  // Geschehens. Jeder Apfel zählt, deshalb Schwelle 1.
  const gewinn = usePunktegewinn(z.punkte);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }


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

      <div className="spielbuehne relative">
        <Punktegewinn gewinn={gewinn} />
        {/* Ein SVG über dem ganzen Brett statt 289 einzelner Kacheln: Nur so
            hängt der Körper wirklich zusammen. Vorher lag zwischen zwei
            Gliedern immer eine Fuge — sie konnten sich gar nicht berühren. */}
        <svg
          ref={feldRef}
          viewBox={`0 0 ${BREITE} ${HOEHE}`}
          className="spielbrett spielbrett-rahmen touch-none bg-flaeche"
          style={{ '--vz': BREITE / HOEHE } as CSSProperties}
          role="img"
          aria-label={`Spielfeld. Schlange ${z.schlange.length} Glieder lang, ${z.punkte} Punkte.${z.vorbei ? ' Vorbei.' : ''}`}
        >
          <Raster breite={BREITE} hoehe={HOEHE} />
          <Apfel ort={z.futter} />
          {z.gold && <Goldstern ort={z.gold} ruhig={settings.reducedMotion} />}
          <Koerper schlange={z.schlange} />
          <Ringe schlange={z.schlange} />
          {/* key auf die Länge: Beim Fressen läuft die Schluck-Animation neu an. */}
          <Kopf
            key={z.schlange.length}
            kopf={z.schlange[0]!}
            richtung={z.richtung}
            ruhig={settings.reducedMotion}
          />
        </svg>
      </div>

      {/* Der gemeinsame Baustein statt einer Kopie. Die Kopie hier hatte
          weder `touch-none` noch die Unterdrückung des Kontextmenüs — langes
          Drücken auf einen Pfeil öffnete auf dem iPhone das Auswahlmenü. */}
      <Steuerkreuz kompakt onRichtung={beiKreuz} aktiv={!z.vorbei} />

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder die Knöpfe steuern. Rote Äpfel machen dich
        länger und schneller, goldene geben Extrapunkte — sie liegen aber nur
        kurz. An den Rändern läufst du auf der anderen Seite weiter.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
