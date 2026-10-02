import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { saatAus } from '../../core/rng';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { PlatzhalterIcon } from './Icon';
import { Sternenschlucker, SternenschluckerTeile } from './Figur';
import { FelsBild, GoldsternBild, KometBild, LochBild, SternBild } from './Teile';
import {
  START_ZEIT,
  STRAFE_S,
  gleiten,
  naechsteWelle,
  neuesSpiel,
  wellenZeit,
  zeitLaufen,
} from './logik';
import type { Richtung, Zustand } from './logik';

const AKZENT = '#7dd3fc';
const WARN_FARBE = '#f0b429';
/** Die Spielfigur ist ein erfundenes Wesen, siehe `Figur.tsx`. */
const FIGUR_NAME = 'Sternenschlucker';

/** Gleitdauer je Feld. Schnell genug für ein Kind, das sofort weiterwischt, langsam genug, um zu sehen, wo man durchkommt. */
const SCHRITT_MS = 55;
/** Ein Komet braucht für seinen Schritt etwas länger — er soll sich erkennbar *danach* bewegen. */
const KOMET_MS = 220;
/** So lange steht das Schild „Welle geschafft", bevor das neue Brett kommt. */
const FEIER_MS = 1300;
/**
 * Nach einem Zug, der Zeit gekostet hat (gegen ein Loch oder einen Kometen), wird dieselbe Richtung
 * eine Weile nicht noch einmal angenommen. Der Steuerkreuz-Baustein wiederholt bei Halten alle
 * 45 ms — und jeder Wiederholungs-Zug in dasselbe Loch kostete drei Sekunden. Jede ankommende
 * Wiederholung verlängert die Sperre, bis der Finger wirklich oben ist.
 *
 * Das trifft **nur** Richtungen nach einer Strafe. Eine erste Fassung verwarf jede Wiederholung
 * derselben Richtung innerhalb von 320 ms; mit Einzelschritten wäre damit schnelles Tippen
 * („dreimal rechts") unmöglich gewesen.
 */
const STRAFSPERRE_MS = 600;
/** Wie viele Züge vorgemerkt werden, solange die Figur noch unterwegs ist. */
const MAX_VORGEMERKT = 2;

/** Ein Zug, wie er ankommt: Richtung und wie weit höchstens (1 = ein Schritt). */
type Zug = { richtung: Richtung; hoechstens: number };

const istRichtung = (wert: string): wert is Richtung =>
  wert === 'up' || wert === 'down' || wert === 'left' || wert === 'right';

const VEKTOR: Record<Richtung, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Sterne und kleine Sternenschlucker als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 9, y: 13, winkel: -12, verzoegerung: 0, inhalt: <SternBild className="size-7" /> },
  { x: 85, y: 10, winkel: 14, verzoegerung: 0.6, inhalt: <SternBild className="size-5" /> },
  { x: 88, y: 72, winkel: -8, verzoegerung: 1.2, inhalt: <Sternenschlucker groesse={44} /> },
  { x: 5, y: 74, winkel: 10, verzoegerung: 0.35, inhalt: <GoldsternBild className="size-6" /> },
  { x: 92, y: 42, winkel: 20, verzoegerung: 1.6, inhalt: <FelsBild className="size-6" /> },
  { x: 3, y: 44, winkel: -22, verzoegerung: 0.9, inhalt: <Sternenschlucker groesse={34} /> },
];

/** Ein gerade geschluckter Stern, der noch zerplatzt. */
type Schluckend = { id: number; x: number; y: number; gold: boolean; verzoegerung: number };

type Schild = { welle: number; zuege: number; par: number; punkte: number; zeit: number };

type Zeithinweis = { id: number; text: string; gut: boolean };

const komma = (zahl: number) => (Math.round(zahl * 10) / 10).toFixed(1).replace('.', ',');

/**
 * Eine Kachel des Bretts, per Prozent platziert. **Kein Raster mit Zwischenraum**: Die Figur und die
 * Kometen gleiten als Ganzes über das Brett, und das geht nur, wenn jede Kachel genau ein Zwölftel,
 * Siebtel usw. der Fläche ist — mit Raster-Lücken wäre jede Prozentangabe um die Lücken verrutscht.
 */
function Feld({
  x,
  y,
  breite,
  hoehe,
  einzug,
  children,
}: {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  /** Abstand zum Kachelrand in Prozent der **Kachel** (siehe `Einzug`). */
  einzug: number;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute"
      style={{
        left: `${(x * 100) / breite}%`,
        top: `${(y * 100) / hoehe}%`,
        width: `${100 / breite}%`,
        height: `${100 / hoehe}%`,
      }}
    >
      <Einzug prozent={einzug}>{children}</Einzug>
    </div>
  );
}

/**
 * Ein Innenabstand in Prozent der **Kachel**. `padding: 7%` wäre falsch: Prozent-Innenabstände
 * beziehen sich in CSS immer auf die *Breite des umgebenden Blocks*, hier also des ganzen Bretts —
 * die Kachel wäre darunter auf null geschrumpft (so sahen die ersten Felsen aus wie Kiesel und die
 * Sterne fehlten ganz). `inset` bezieht sich dagegen auf die Maße des Elternelements.
 */
function Einzug({ prozent, children }: { prozent: number; children: ReactNode }) {
  return (
    <div className="absolute" style={{ inset: `${prozent}%` }}>
      {children}
    </div>
  );
}

export function Platzhalter({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState(() => neuesSpiel(saatAus('platzhalter', Date.now())));
  // Eine Spiegelung des Zustands für Eingaben und Uhr: `gleiten` ist rein, und ein Updater, der
  // Töne und Zeitgeber auslöst, würde unter StrictMode doppelt feuern. So rechnet jeder Aufruf
  // genau einmal und ruft danach `setzen`.
  const zRef = useRef(z);
  const setzen = useCallback((neu: Zustand) => {
    zRef.current = neu;
    setZ(neu);
  }, []);

  const [gleitMs, setGleitMs] = useState(0);
  const [schluckend, setSchluckend] = useState<Schluckend[]>([]);
  const [schild, setSchild] = useState<Schild | null>(null);
  const [zeithinweis, setZeithinweis] = useState<Zeithinweis | null>(null);

  const buehne = useRef<HTMLDivElement>(null);
  const brett = useRef<HTMLDivElement>(null);
  const figurInnen = useRef<HTMLDivElement>(null);
  const gesperrtBis = useRef(0);
  const vorgemerkt = useRef<Zug[]>([]);
  const letzteStrafe = useRef<{ richtung: Richtung | null; zeit: number }>({ richtung: null, zeit: 0 });
  const zaehler = useRef(0);
  const ausfuehrenRef = useRef<(richtung: Richtung, hoechstens?: number) => void>(() => {});
  const timer = useRef<number[]>([]);
  const gewinn = usePunktegewinn(z.punkte);

  const spaeter = useCallback((aktion: () => void, ms: number) => {
    timer.current.push(window.setTimeout(aktion, Math.max(0, ms)));
  }, []);
  useEffect(
    () => () => {
      timer.current.forEach((t) => window.clearTimeout(t));
      timer.current = [];
    },
    [],
  );

  const bewegungErlaubt = !settings.reducedMotion;

  const ausfuehren = useCallback(
    (richtung: Richtung, hoechstens = Infinity) => {
      const alt = zRef.current;
      if (alt.vorbei || alt.welleGeschafft) return;
      const erg = gleiten(alt, richtung, hoechstens);
      const d = VEKTOR[richtung];
      if (erg.strafe) letzteStrafe.current = { richtung, zeit: performance.now() };

      // Ein Wisch gegen eine Wand ist kein Zug. Trotzdem soll man sehen, dass er angekommen ist:
      // ein kurzer Ruck in die gewählte Richtung. Ohne den wirkt ein blockierter Wisch wie ein
      // verschluckter.
      if (!erg.bewegt && !erg.strafe) {
        if (bewegungErlaubt) {
          figurInnen.current?.animate(
            [
              { transform: 'translate(0,0)' },
              { transform: `translate(${d.x * 7}px, ${d.y * 7}px)` },
              { transform: 'translate(0,0)' },
            ],
            { duration: 150, easing: 'ease-out' },
          );
        }
        return;
      }

      const dauer = bewegungErlaubt ? erg.weg.length * SCHRITT_MS : 0;
      const kometZeit = alt.kometen.length > 0 && bewegungErlaubt ? KOMET_MS : 0;
      gesperrtBis.current = performance.now() + dauer + kometZeit + 30;
      setGleitMs(dauer);
      setzen(erg.zustand);

      // Sterne platzen genau dann, wenn die Figur sie erreicht.
      if (erg.gesammelt.length > 0) {
        const neue: Schluckend[] = erg.gesammelt.map((g) => ({
          id: ++zaehler.current,
          x: g.stern.x,
          y: g.stern.y,
          gold: g.stern.gold,
          verzoegerung: bewegungErlaubt ? Math.max(0, g.schritt * SCHRITT_MS - 30) : 0,
        }));
        setSchluckend((liste) => [...liste, ...neue]);
        const weg = new Set(neue.map((n) => n.id));
        spaeter(() => setSchluckend((liste) => liste.filter((s) => !weg.has(s.id))), dauer + 450);
        erg.gesammelt.forEach((g, i) => {
          spaeter(() => sfx('gut', i * 2), Math.max(0, g.schritt * SCHRITT_MS - 30));
        });
      } else if (!erg.strafe) {
        spaeter(() => sfx('klick'), dauer);
      }

      // Ankunft: ein kleines Stauchen in Flugrichtung.
      if (bewegungErlaubt && erg.bewegt) {
        const waagerecht = d.x !== 0;
        figurInnen.current?.animate(
          [
            { transform: 'scale(1,1)' },
            { transform: waagerecht ? 'scale(0.84,1.14)' : 'scale(1.14,0.84)', offset: 0.35 },
            { transform: 'scale(1,1)' },
          ],
          { duration: 240, delay: dauer, easing: 'ease-out' },
        );
      }

      // Strafe: Zeithinweis, Ton und ein Ruck am ganzen Brett — nach der Ankunft, nicht schon beim Wisch.
      const verlorene = (erg.strafe ? STRAFE_S : 0) + (erg.kometGetroffen ? STRAFE_S : 0);
      if (verlorene > 0) {
        spaeter(() => {
          const id = ++zaehler.current;
          setZeithinweis({ id, text: `−${verlorene} s`, gut: false });
          spaeter(() => setZeithinweis((h) => (h?.id === id ? null : h)), 1000);
          sfx('schlecht');
          haptik('fehler');
          if (bewegungErlaubt) {
            brett.current?.animate(
              [
                { transform: 'translateX(0)' },
                { transform: 'translateX(-5px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(-3px)' },
                { transform: 'translateX(0)' },
              ],
              { duration: 280 },
            );
          }
        }, dauer);
      }

      if (erg.welleGeschafft && !erg.zustand.vorbei) {
        const bonusZeit = wellenZeit(alt.par, alt.welle);
        spaeter(() => {
          setSchild({
            welle: alt.welle,
            zuege: erg.zustand.zuege,
            par: alt.par,
            punkte: erg.welleBonus,
            zeit: bonusZeit,
          });
          const id = ++zaehler.current;
          setZeithinweis({ id, text: `+${komma(bonusZeit)} s`, gut: true });
          spaeter(() => setZeithinweis((h) => (h?.id === id ? null : h)), 1000);
          sfx('stufe');
          haptik('jubel');
        }, dauer + 150);
        spaeter(() => {
          setSchild(null);
          setzen(naechsteWelle(zRef.current));
          gesperrtBis.current = 0;
          vorgemerkt.current = [];
        }, dauer + 150 + FEIER_MS);
      } else {
        // Hat man während des Gleitens schon den nächsten Zug gemacht, kommt er jetzt dran.
        spaeter(() => {
          const v = vorgemerkt.current.shift();
          if (v) ausfuehrenRef.current(v.richtung, v.hoechstens);
        }, dauer + kometZeit + 40);
      }
    },
    [bewegungErlaubt, setzen, spaeter],
  );

  ausfuehrenRef.current = ausfuehren;

  /**
   * Der eine Eingang für alle Wege. **Wischen und Tasten gleiten** (`hoechstens` unbegrenzt), das
   * **Kreuz macht einen Schritt**: Rückmeldung war, dass man mit dem Gleiten allein nie ein
   * einzelnes Feld gehen kann.
   */
  const richten = useCallback((richtung: Richtung, hoechstens = Infinity) => {
    const jetzt = performance.now();
    const strafe = letzteStrafe.current;
    if (strafe.richtung === richtung && jetzt - strafe.zeit < STRAFSPERRE_MS) {
      letzteStrafe.current = { richtung, zeit: jetzt };
      return;
    }
    const s = zRef.current;
    if (s.vorbei || s.welleGeschafft) return;
    if (jetzt < gesperrtBis.current) {
      if (vorgemerkt.current.length < MAX_VORGEMERKT) vorgemerkt.current.push({ richtung, hoechstens });
      return;
    }
    ausfuehrenRef.current(richtung, hoechstens);
  }, []);

  const schritt = useCallback((richtung: Richtung) => richten(richtung, 1), [richten]);

  useInput(
    (aktion) => {
      if (!istRichtung(aktion)) return;
      richten(aktion);
    },
    {
      bereich: buehne,
      // Wiederholen macht hier `richten` selbst unschädlich; ein gehaltener Zug wäre ein Fehler.
      wiederholen: [],
      // `wurf: 'down'` statt der Voreinstellung: Ein schneller Wisch nach unten ist hier einfach
      // „nach unten", und die Leertaste soll kein Zug sein.
      wurf: 'down',
      aktiv: gestartet && !z.vorbei,
    },
  );

  useGameLoop(
    (dt) => {
      const neu = zeitLaufen(zRef.current, dt);
      if (neu !== zRef.current) setzen(neu);
    },
    { fps: 20, running: gestartet && !z.vorbei },
  );

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (!z.vorbei) return;
    // Läuft gerade noch ein Gleitzug (die Strafe hat die Zeit aufgebraucht), darf er zu Ende
    // laufen, bevor das Rundenende aufspringt.
    const rest = Math.max(0, gesperrtBis.current - performance.now()) + 350;
    const uhr = window.setTimeout(() => {
      sfx('ende');
      haptik('ende');
      onGameOver(zRef.current.punkte);
    }, rest);
    return () => window.clearTimeout(uhr);
    // onGameOver darf nur einmal kommen — deshalb hängt das nur an "vorbei".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Star Dash"
        untertitel="Wische: Dein Sternenschlucker gleitet, bis etwas im Weg ist, und schluckt jeden Stern auf dem Weg. Mit dem Kreuz geht er einzelne Felder."
        bestScore={bestScore}
        verlauf="linear-gradient(165deg, #1e1b4b 0%, #1d4ed8 45%, #0ea5e9 100%)"
        deko={DEKO}
        Symbol={PlatzhalterIcon}
        knopfFarbe="#1d4ed8"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const anteil = Math.max(0, Math.min(1, z.restZeit / START_ZEIT));
  const knapp = z.restZeit <= 5;
  const { breite, hoehe } = z;
  const zellBreite = 100 / breite;
  const zellHoehe = 100 / hoehe;
  const ms = bewegungErlaubt ? gleitMs : 0;
  const kometMs = bewegungErlaubt ? KOMET_MS : 0;

  const beschreibung =
    `Spielfeld, Welle ${z.welle}. Dein ${FIGUR_NAME} steht in Reihe ${z.spieler.y + 1}, Spalte ${z.spieler.x + 1}. ` +
    `Noch ${z.sterne.length} ${z.sterne.length === 1 ? 'Stern' : 'Sterne'}: ${z.sterne
      .map((s) => `${s.gold ? 'Goldstern' : 'Stern'} in Reihe ${s.y + 1}, Spalte ${s.x + 1}`)
      .join('; ')}. ` +
    `${z.felsen.length} Felsen, ${z.loecher.length} Löcher, ${z.kometen.length} Kometen.`;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden p-3 spielseite">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm text-gedaempft">
          {/* Die Welle ist die sichtbare Spur der Schwierigkeitskurve; der Puls über `key`
              macht den Wechsel im Vorbeigehen bemerkbar. */}
          <span key={z.welle} className="punkte-bumsen inline-block font-semibold">
            Welle {z.welle}
          </span>
          {/* Die Bestmarke steht dabei: Wer sie kennt, versteht, warum ein überlegter Zug mehr
              Punkte bringt als drei hastige. */}
          <span className="tabular-nums">
            Züge {z.zuege} <span className="opacity-70">· Bestmarke {z.par}</span>
          </span>
          <span className="relative tabular-nums">
            Zeit {komma(z.restZeit)} s
            {zeithinweis && (
              <span
                key={zeithinweis.id}
                aria-hidden="true"
                className="punkte-auftauchen pointer-events-none absolute top-full right-0 z-10 text-base font-extrabold"
                style={{
                  color: zeithinweis.gut ? 'var(--color-erfolg)' : 'var(--color-fehler)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                }}
              >
                {zeithinweis.text}
              </span>
            )}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-flaeche-hoch"
          role="progressbar"
          aria-label="Verbleibende Zeit"
          aria-valuemin={0}
          aria-valuemax={Math.round(START_ZEIT)}
          aria-valuenow={Math.round(z.restZeit)}
        >
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${anteil * 100}%`, backgroundColor: knapp ? WARN_FARBE : AKZENT }}
          />
        </div>
      </div>

      <div ref={buehne} className="spielbuehne touch-none">
        <div
          ref={brett}
          // `relative` steht hier ausdrücklich, obwohl `.spielbuehne > *` es ohnehin setzt: Das
          // Punktgewinn-Popup und das Schild hängen daran.
          className="spielbrett spielbrett-rahmen relative overflow-hidden bg-flaeche"
          style={{ '--vz': breite / hoehe } as CSSProperties}
          role="img"
          aria-label={beschreibung}
        >
          {/* Schachbrett als Untergrund: Es zeigt, in welchen Kacheln man gleitet, ohne Linien. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, transparent 0% 50%)',
              backgroundSize: `${(200 / breite).toFixed(4)}% ${(200 / hoehe).toFixed(4)}%`,
            }}
          />

          {/* Alles Bewegliche liegt in einer Ebene, die mit der Welle neu eingehängt wird: Die
              Figur soll nicht quer über das neue Brett gleiten, sondern dort stehen, wo sie war. */}
          <div key={z.welle} className="welle-rein absolute inset-0">
            {z.felsen.map((p) => (
              <Feld key={`f${p.x}-${p.y}`} x={p.x} y={p.y} breite={breite} hoehe={hoehe} einzug={7}>
                <FelsBild />
              </Feld>
            ))}
            {z.loecher.map((p) => (
              <Feld key={`l${p.x}-${p.y}`} x={p.x} y={p.y} breite={breite} hoehe={hoehe} einzug={6}>
                <LochBild />
              </Feld>
            ))}
            {z.sterne.map((s) => (
              <Feld key={`s${s.x}-${s.y}`} x={s.x} y={s.y} breite={breite} hoehe={hoehe} einzug={14}>
                {s.gold ? <GoldsternBild /> : <SternBild />}
              </Feld>
            ))}
            {schluckend.map((s) => (
              <Feld key={`g${s.id}`} x={s.x} y={s.y} breite={breite} hoehe={hoehe} einzug={14}>
                <div
                  className="stern-schluckt size-full"
                  style={{ '--verzoegerung': `${s.verzoegerung}ms` } as CSSProperties}
                >
                  {s.gold ? <GoldsternBild /> : <SternBild />}
                </div>
              </Feld>
            ))}

            {z.kometen.map((k, i) => (
              <div
                key={`k${i}`}
                aria-hidden="true"
                className="absolute top-0 left-0"
                style={{
                  width: `${zellBreite}%`,
                  height: `${zellHoehe}%`,
                  transform: `translate(${k.x * 100}%, ${k.y * 100}%)`,
                  transition: `transform ${kometMs}ms ease-in-out`,
                  // Der Komet zieht erst, wenn die Figur angekommen ist.
                  transitionDelay: `${ms}ms`,
                }}
              >
                <Einzug prozent={4}>
                  <div
                    className="size-full"
                    style={{ transform: `rotate(${(Math.atan2(k.dy, k.dx) * 180) / Math.PI}deg)` }}
                  >
                    <KometBild />
                  </div>
                </Einzug>
              </div>
            ))}

            <div
              aria-hidden="true"
              className="absolute top-0 left-0"
              style={{
                width: `${zellBreite}%`,
                height: `${zellHoehe}%`,
                transform: `translate(${z.spieler.x * 100}%, ${z.spieler.y * 100}%)`,
                transition: `transform ${ms}ms linear`,
                zIndex: 2,
              }}
            >
              <Einzug prozent={2}>
                <div ref={figurInnen} className="size-full">
                  <svg viewBox="0 0 100 100" className="size-full drop-shadow-lg">
                    <SternenschluckerTeile />
                  </svg>
                </div>
              </Einzug>
            </div>
          </div>

          {schild && (
            <div
              aria-hidden="true"
              className="absolute inset-x-3 top-3 z-20 grid justify-items-center rounded-2xl border border-white/20 bg-black/65 px-3 py-2.5 text-center backdrop-blur-sm"
            >
              <div className="welle-schild grid justify-items-center gap-0.5">
                <p className="text-lg font-extrabold text-white">Welle {schild.welle} geschafft!</p>
                <p className="text-xs text-white/80">
                  {schild.zuege} {schild.zuege === 1 ? 'Zug' : 'Züge'} · Bestmarke {schild.par}
                  {schild.zuege <= schild.par ? ' erreicht' : ''}
                </p>
                <p className="text-sm font-bold" style={{ color: 'var(--color-erfolg)' }}>
                  +{schild.punkte} Punkte · +{komma(schild.zeit)} s
                </p>
              </div>
            </div>
          )}

          {/* Gehört ins Brett, nicht in die Bühne: Ein absolut liegendes Kind der Bühne wird von
              deren Regel auf `relative` zurückgesetzt und schiebt das Brett dann bei jedem Punkt
              zur Seite (siehe `.spielbuehne > *:not(.absolute)` in index.css). */}
          <Punktegewinn gewinn={gewinn} />
        </div>
      </div>

      <Steuerkreuz onRichtung={schritt} aktiv={!z.vorbei} kompakt />

      {/* Das Spielziel steht immer da, die Zeichenerklärung nur, wenn Platz ist — dieselbe
          Aufteilung wie in den anderen Spielen. */}
      <div className="max-w-sm text-center text-gedaempft">
        <p className="text-xs">Wischen: gleiten. Kreuz: ein Feld. Felsen bremsen, Löcher und Kometen kosten Zeit.</p>
        <p className="nur-bei-platz mt-1 text-sm">Pfeiltasten gleiten, das Kreuz unten geht Feld für Feld.</p>
      </div>

      <p className="sr-only" aria-live="polite">
        Welle {z.welle}, {z.sterne.length} {z.sterne.length === 1 ? 'Stern' : 'Sterne'} übrig, {z.punkte} Punkte
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
