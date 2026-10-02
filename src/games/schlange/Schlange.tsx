import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { Komboherz } from '../../core/Komboherz';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import {
  BREITE,
  FUTTER_JE_ETAPPE,
  HOEHE,
  ZEITLUPE_SCHRITTE,
  bildGeaendert,
  etappenBonus,
  etappenPlan,
  naechsteEtappe,
  neuesSpiel,
  richtungWaehlen,
  startLaengeNach,
  zeitFortschritt,
} from './logik';
import type { Richtung, Zustand } from './logik';
import { SchlangeIcon } from './Icon';
import { Apfel, ExtraBild, Fels, Goldstern, Kopf, Koerper, Randrahmen, Raster, Ringe } from './figuren';

/** So lange steht das Schild „Etappe geschafft", bevor die neue Arena kommt. Die Uhr steht dabei. */
const FEIER_MS = 1500;

/** Das Schild am Ende einer Etappe. */
type Schild = {
  etappe: number;
  bonus: number;
  abgeworfen: number;
  /** Was als Nächstes kommt — eine Mauer will man vorher wissen. */
  naechsteMauer: boolean;
};


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

/** Sinnbild für den Rand-Durchlauf: rechts hinaus, links wieder herein. */
function RandPfeil() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="4" fill="#0b0f14" opacity="0.5" />
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="4"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.3"
        strokeDasharray="3 3"
        opacity="0.8"
      />
      <g stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M13 12 h9 M19 9 l3 3 l-3 3" />
        <path d="M2 12 h6 M5 9 l3 3 l-3 3" opacity="0.7" />
      </g>
    </svg>
  );
}

/**
 * Die Regeln, die man ohne Erklärung nicht errät.
 *
 * Sie standen bisher **nur** im Hinweistext unter dem Feld — und der trägt `nur-bei-platz`, ist auf
 * Bildschirmen unter 720 Pixel Höhe also ausgeblendet. Auf genau den Geräten erfuhr man nie, was
 * der Goldstern soll und dass die Ränder durchlässig sind. Hier ist Platz, und man liest es einmal
 * in Ruhe vor dem Start.
 *
 * Apfel, Fels und Extras werden mit denselben Figuren gezeichnet wie im Spiel — ein nachgebautes
 * Symbol wäre genau das, was man später nicht wiedererkennt.
 */
function Regeln() {
  const klein = 'size-5 shrink-0';
  return (
    <ul className="relative flex w-full max-w-xs flex-col gap-2 rounded-2xl bg-black/25 p-3 text-left text-xs font-semibold text-white">
      <li className="flex items-center gap-2.5">
        <svg viewBox="-0.15 -0.25 1.3 1.4" className={klein} aria-hidden="true">
          <Apfel ort={{ x: 0, y: 0 }} />
        </svg>
        <span>Sieben Äpfel schaffen eine Etappe — dann wartet eine neue Arena.</span>
      </li>
      <li className="flex items-center gap-2.5">
        <svg viewBox="-0.1 -0.1 1.2 1.2" className={klein} aria-hidden="true">
          <Fels ort={{ x: 0, y: 0 }} />
        </svg>
        <span>Felsen sind tabu. Ist der Rand rot gestreift, auch er.</span>
      </li>
      <li className="flex items-center gap-2.5">
        <RandPfeil />
        <span>Ist er nur gepunktet, kommst du auf der anderen Seite wieder heraus.</span>
      </li>
      <li className="flex items-center gap-2.5">
        <svg viewBox="-0.15 -0.25 1.3 1.4" className={klein} aria-hidden="true">
          <Goldstern ort={{ x: 0, y: 0 }} ruhig />
        </svg>
        <span>Schnell hintereinander gegessen gibt eine Serie. Gold, Uhr und Schere helfen.</span>
      </li>
    </ul>
  );
}

/**
 * Titelbild im Stil klassischer Arcade-Spiele — kräftiges Grün, schwebende
 * Punkte, dicke Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm
 * für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #065f46 0%, #16a34a 45%, #65a30d 75%, #ca8a04 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
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
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Wie viele Etappen schaffst du?'}
        </p>
      </div>

      <Regeln />

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

/**
 * Der Anfangszustand. **Prüfhaken nur für Bildschirmfotos** (auf einem echten Gerät nie gesetzt):
 * `globalThis.__schlangeStart = { etappe }` beginnt gleich in einer späteren Etappe, und solange er
 * gesetzt ist, liefert `globalThis.__schlangeStand()` den laufenden Zustand — damit lässt sich das
 * Spiel von außen mit echten Tasten spielen. Mit Playwright über `page.addInitScript` setzen.
 */
type Haken = { __schlangeStart?: { etappe?: number }; __schlangeStand?: () => Zustand };
function anfang(): Zustand {
  let z = neuesSpiel(saatAus('schlange', Date.now()));
  const wunsch = (globalThis as Haken).__schlangeStart?.etappe ?? 1;
  while (z.etappe < wunsch) z = naechsteEtappe({ ...z, etappeGeschafft: true });
  return z;
}

export function Schlange({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => anfang());
  const [schild, setSchild] = useState<Schild | null>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const vorherRef = useRef({ punkte: 0, futter: 0, etappe: 1 });

  // Der Zustand wird **hier** geführt, nicht im React-Zustand: Die Uhr
  // tickt 60-mal je Sekunde, die Schlange rückt aber nur 4,5- bis 12,5-mal
  // je Sekunde weiter. Ginge jeder Tick durch `setZ`, würde React
  // achtzig Prozent der Bilder umsonst neu aufbauen. Die angesammelte Zeit
  // muss dabei trotzdem weiterlaufen — deshalb ein Ref und nicht einfach
  // ein unverändert zurückgegebenes `z`.
  const standRef = useRef(z);
  if ((globalThis as Haken).__schlangeStart) (globalThis as Haken).__schlangeStand = () => standRef.current;

  useGameLoop(
    (dt) => {
      const vorher = standRef.current;
      const nachher = zeitFortschritt(vorher, dt);
      standRef.current = nachher;
      if (bildGeaendert(vorher, nachher)) setZ(nachher);
    },
    { fps: 60, running: gestartet && !z.vorbei },
  );

  // Die vier Himmelsrichtungen des Eingabe-Bausteins heißen im Spiel anders.
  // Eine Abbildung für Tastatur, Wischen **und** Steuerkreuz.
  const beiKreuz = useCallback((eingabe: 'up' | 'down' | 'left' | 'right') => {
    const richtungen: Record<typeof eingabe, Richtung> = {
      up: 'hoch',
      down: 'runter',
      left: 'links',
      right: 'rechts',
    };
    // Auch die Eingabe geht durch das Ref: Die Uhr liest von dort, eine
    // nur im React-Zustand vermerkte Richtung wäre im nächsten Takt weg.
    const neu = richtungWaehlen(standRef.current, richtungen[eingabe]);
    if (neu === standRef.current) return;
    standRef.current = neu;
    setZ(neu);
  }, []);

  useInput(
    (eingabe) => {
      if (eingabe === 'up' || eingabe === 'down' || eingabe === 'left' || eingabe === 'right') {
        beiKreuz(eingabe);
      }
    },
    {
      // Wischen gilt auf der ganzen Bühne, nicht nur auf dem Brett: Auf einem kleinen Handy ist das
      // Brett schmal, und der Daumen trifft gern daneben.
      bereich: buehneRef,
      // Kein Wiederholen bei gehaltener Taste: die Richtung gilt ohnehin bis
      // zur nächsten Eingabe, mehrfaches Auslösen brächte nichts.
      wiederholen: [],
      // **Ohne diese Zeile kam jeder lange oder schnelle Wisch nach unten nie an.** `useInput`
      // macht daraus standardmäßig `drop` („fallen lassen"), und das kennt Snake Rush nicht — die
      // Schlange ignorierte genau die Geste, mit der man in der Hitze des Gefechts nach unten wischt.
      wurf: 'down',
      aktiv: gestartet && !z.vorbei && !z.etappeGeschafft,
    },
  );

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  // Töne: Ein Apfel klingt mit der Serie höher, ein Extra anders als ein Apfel. Gemerkt wird, was
  // vorher war — aus dem Punktezuwachs allein ließe sich Apfel (×5 = 50) nicht von Gold (50) trennen.
  useEffect(() => {
    const vorher = vorherRef.current;
    vorherRef.current = { punkte: z.punkte, futter: z.futterInEtappe, etappe: z.etappe };
    if (z.etappe !== vorher.etappe || z.etappeGeschafft || z.punkte <= vorher.punkte) return;
    if (z.futterInEtappe > vorher.futter) sfx('gut', Math.min(12, (z.serie - 1) * 2));
    else sfx('stufe');
  }, [z.punkte, z.futterInEtappe, z.etappe, z.etappeGeschafft, z.serie]);

  // Der Zuwachs war bisher nur am Zähler oben zu sehen, nicht am Ort des
  // Geschehens. Jeder Apfel zählt, deshalb Schwelle 1.
  const gewinn = usePunktegewinn(z.punkte);

  // Das Ende einer Etappe: Schild zeigen, kurz feiern, dann die nächste Arena. Die Uhr steht
  // währenddessen (`zeitFortschritt` rührt sich bei `etappeGeschafft` nicht).
  useEffect(() => {
    if (!z.etappeGeschafft || z.vorbei) return;
    setSchild({
      etappe: z.etappe,
      bonus: etappenBonus(z.etappe),
      abgeworfen: z.schlange.length - startLaengeNach(z.schlange.length),
      naechsteMauer: etappenPlan(z.etappe + 1).rand === 'mauer',
    });
    sfx('stufe');
    haptik('jubel');
    const uhr = window.setTimeout(() => {
      const neu = naechsteEtappe(standRef.current);
      standRef.current = neu;
      setZ(neu);
      setSchild(null);
    }, FEIER_MS);
    return () => window.clearTimeout(uhr);
    // Hängt absichtlich nur an der Etappe: Alles andere ändert sich während der Feier nicht mehr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.etappeGeschafft, z.etappe]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      haptik('ende');
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const mauer = z.rand === 'mauer';

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3 spielseite">
      <div className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-end gap-2 px-1">
        <div className="text-left text-xs leading-tight font-bold text-gedaempft">
          <p>
            Etappe <span className="text-base text-text">{z.etappe}</span>
          </p>
          {/* Der Rand steht als **Wort** da, nicht nur als Farbe am Brett. */}
          <p className={mauer ? 'text-fehler' : undefined}>{mauer ? 'Mauer-Rand' : 'Offener Rand'}</p>
        </div>
        <output
          aria-live="off"
          key={z.punkte}
          className="punkte-bumsen text-5xl font-black tabular-nums text-text sm:text-6xl"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {z.punkte}
        </output>
        <div
          className="flex justify-end gap-1 pb-1.5"
          role="img"
          aria-label={`${z.futterInEtappe} von ${FUTTER_JE_ETAPPE} Äpfeln gegessen`}
        >
          {Array.from({ length: FUTTER_JE_ETAPPE }, (_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full border ${
                i < z.futterInEtappe ? 'border-fehler bg-fehler' : 'border-gedaempft bg-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      <div ref={buehneRef} className="spielbuehne relative touch-none">
        <Punktegewinn gewinn={gewinn} />
        {/* Das Herz hängt über der oberen rechten Ecke des Feldes, wie in Block Burst: Es kostet
            keine Höhe, und die Serie ist am Rand des Blickfelds zu spüren. */}
        <Komboherz
          kombo={z.serie}
          ruhig={settings.reducedMotion}
          className="absolute -top-2 right-0 z-10"
        />
        {z.zeitlupeRest > 0 && (
          <div
            className="absolute top-0 left-0 z-10 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-xs font-bold text-white"
            role="status"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="#0ea5e9" />
              <path d="M12 12 V6.5 M12 12 l4 2.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Zeitlupe
            <span className="h-1.5 w-10 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${(z.zeitlupeRest / ZEITLUPE_SCHRITTE) * 100}%` }}
              />
            </span>
          </div>
        )}
        {/* Ein SVG über dem ganzen Brett statt 289 einzelner Kacheln: Nur so
            hängt der Körper wirklich zusammen. Vorher lag zwischen zwei
            Gliedern immer eine Fuge — sie konnten sich gar nicht berühren. */}
        <svg
          viewBox={`0 0 ${BREITE} ${HOEHE}`}
          className="spielbrett spielbrett-rahmen touch-none bg-flaeche"
          style={{ '--vz': BREITE / HOEHE } as CSSProperties}
          role="img"
          aria-label={`Spielfeld, Etappe ${z.etappe}, ${mauer ? 'tödlicher Rand' : 'offener Rand'}. Schlange ${z.schlange.length} Glieder lang, ${z.punkte} Punkte.${
            z.vorbei ? ' Vorbei.' : ''
          }`}
        >
          <Raster breite={BREITE} hoehe={HOEHE} />
          <Randrahmen rand={z.rand} breite={BREITE} hoehe={HOEHE} />
          {/* Mit der Etappe neu eingehängt: Die Felsen erscheinen mit der neuen Arena, nicht
              ruckartig mitten im Bild. */}
          <g key={z.etappe} className={settings.reducedMotion ? undefined : 'arena-rein'}>
            {z.felsen.map((f) => (
              <Fels key={`${f.x},${f.y}`} ort={f} />
            ))}
          </g>
          {z.futter && <Apfel ort={z.futter} />}
          {z.extra && <ExtraBild extra={z.extra} rest={z.extraRest} ruhig={settings.reducedMotion} />}
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

        {schild && (
          <div
            aria-hidden="true"
            className="absolute inset-x-4 top-[16%] z-20 grid justify-items-center rounded-2xl border border-white/20 bg-black/70 px-3 py-2.5 text-center backdrop-blur-sm"
          >
            <div className="welle-schild grid justify-items-center gap-0.5">
              <p className="text-lg font-extrabold text-white">Etappe {schild.etappe} geschafft!</p>
              <p className="text-sm font-bold" style={{ color: 'var(--color-erfolg)' }}>
                +{schild.bonus} Punkte
              </p>
              {schild.abgeworfen > 0 && (
                <p className="text-xs text-white/80">
                  Du wirfst {schild.abgeworfen} {schild.abgeworfen === 1 ? 'Glied' : 'Glieder'} Schwanz ab.
                </p>
              )}
              <p className="text-xs font-semibold text-white/90">
                {schild.naechsteMauer ? 'Als Nächstes: tödlicher Rand!' : 'Als Nächstes: neue Felsen.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Der gemeinsame Baustein statt einer Kopie. Die Kopie hier hatte
          weder `touch-none` noch die Unterdrückung des Kontextmenüs — langes
          Drücken auf einen Pfeil öffnete auf dem iPhone das Auswahlmenü. */}
      <Steuerkreuz kompakt onRichtung={beiKreuz} aktiv={!z.vorbei && !z.etappeGeschafft} />

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder die Knöpfe steuern. Sieben Äpfel schaffen eine Etappe. Felsen und
        der rot gestreifte Rand sind tödlich; der gepunktete lässt dich auf der anderen Seite wieder
        heraus.
      </p>

      <p className="sr-only" aria-live="polite">
        Etappe {z.etappe}, {z.futterInEtappe} von {FUTTER_JE_ETAPPE} Äpfeln, {z.punkte} Punkte
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
