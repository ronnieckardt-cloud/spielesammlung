import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { bewegen, neuesSpiel, START_ZEIT, stufeFuer, zeitLaufen } from './logik';
import type { Richtung } from './logik';
import { Sternenschlucker } from './Figur';

const AKZENT = '#7dd3fc';
const ZIEL_FARBE = '#f0b429';
/** Die Spielfigur ist ein erfundenes Wesen, siehe `Figur.tsx`. */
const FIGUR_NAME = 'Sternenschlucker';

/**
 * Wie lange der zerplatzende Stern zu sehen ist.
 *
 * Deckt beide Keyframes ab: `.aufloesen-blitz` läuft 240 ms, `.kruemel`
 * 260 ms — beide aus Block Burst, unverändert weiterverwendet.
 */
const PLATZER_MS = 320;

/**
 * Wohin die Krümel des zerplatzenden Sterns spritzen — feste Liste, kein
 * Zufall (der gehört in `core/rng`, und für Deko braucht es ihn gar nicht).
 * Grob im Kreis verteilt, nach unten etwas weiter: Das liest sich als
 * Auseinanderfliegen und nicht als gleichmäßiges Aufblähen.
 */
const KRUEMEL: readonly { kx: string; ky: string }[] = [
  { kx: '-13px', ky: '-9px' },
  { kx: '13px', ky: '-9px' },
  { kx: '-15px', ky: '8px' },
  { kx: '15px', ky: '8px' },
  { kx: '0px', ky: '-16px' },
  { kx: '0px', ky: '15px' },
];

const istRichtung = (wert: string): wert is Richtung =>
  wert === 'up' || wert === 'down' || wert === 'left' || wert === 'right';

/**
 * Platzhalter-Spiel: Sammle möglichst viele Sterne, bevor die Zeit abläuft.
 *
 * Der Zweck ist nicht das Spiel, sondern der Beweis, dass die Schnittstelle
 * trägt: Es benutzt alle vier gemeinsamen Bausteine (Uhr, Eingabe, Zufall,
 * Ton) und meldet Punkte und Ende ausschließlich über seine Props.
 */
/** Sterne und kleine Sternenschlucker als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 9, y: 13, winkel: -12, verzoegerung: 0, inhalt: <Stern groesse={26} /> },
  { x: 85, y: 10, winkel: 14, verzoegerung: 0.6, inhalt: <Stern groesse={18} /> },
  { x: 88, y: 72, winkel: -8, verzoegerung: 1.2, inhalt: <Sternenschlucker groesse={44} /> },
  { x: 5, y: 74, winkel: 10, verzoegerung: 0.35, inhalt: <Stern groesse={22} /> },
  { x: 92, y: 42, winkel: 20, verzoegerung: 1.6, inhalt: <Stern groesse={15} /> },
  { x: 3, y: 44, winkel: -22, verzoegerung: 0.9, inhalt: <Sternenschlucker groesse={34} /> },
];

/** Ein einzelner Stern fürs Titelbild. */
function Stern({ groesse }: { groesse: number }) {
  return (
    <svg viewBox="0 0 24 24" width={groesse} height={groesse} fill={ZIEL_FARBE} aria-hidden="true">
      <path d="M12 2l2.5 6.9H21l-5.6 4.4 2.1 7.1L12 16.2 6.5 20.4l2.1-7.1L3 8.9h6.5z" />
    </svg>
  );
}

/** Ein gerade eingesammelter Stern, der noch zerplatzt. */
type Platzer = { x: number; y: number; nr: number };

export function Platzhalter({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState(() => neuesSpiel(saatAus('platzhalter', Date.now())));
  const [platzer, setPlatzer] = useState<Platzer | null>(null);
  const brett = useRef<HTMLDivElement>(null);
  const stufe = stufeFuer(z.punkte);
  const gewinn = usePunktegewinn(z.punkte);

  // Von Tastatur, Wischen und dem Steuerkreuz benutzt — ein Weg für alle drei.
  const bewege = useCallback((richtung: Richtung) => setZ((alt) => bewegen(alt, richtung)), []);

  useInput(
    (aktion) => {
      if (!istRichtung(aktion)) return;
      bewege(aktion);
    },
    { bereich: brett, wiederholen: ['up', 'down', 'left', 'right'], aktiv: gestartet && !z.vorbei },
  );

  useGameLoop((dt) => setZ((alt) => zeitLaufen(alt, dt)), { fps: 20, running: gestartet && !z.vorbei });

  useEffect(() => {
    onScore(z.punkte);
    if (z.punkte === 0) return;
    sfx('gut');
    haptik('jubel');

    // Zum Zeitpunkt des Punktgewinns steht die Figur genau auf dem Feld, auf
    // dem der Stern lag — dort und nirgendwo sonst soll er zerplatzen.
    // Vorher war ein Ton die einzige Rückmeldung, der Stern erschien einfach
    // woanders wieder.
    setPlatzer({ x: z.spieler.x, y: z.spieler.y, nr: z.punkte });
    const uhr = window.setTimeout(() => setPlatzer(null), PLATZER_MS);
    return () => window.clearTimeout(uhr);
    // Absichtlich nur an der Punktzahl: Die Figur läuft auch ohne Punktgewinn
    // übers Feld, dann darf weder etwas klingen noch etwas zerplatzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.punkte, onScore]);

  // Stufenwechsel eigens hörbar machen — sonst merkt man nur daran, dass die
  // Zeit plötzlich knapper wird, dass sich etwas geändert hat.
  const stufeVorher = useRef(stufe);
  useEffect(() => {
    if (stufe === stufeVorher.current) return;
    stufeVorher.current = stufe;
    sfx('stufe');
  }, [stufe]);

  useEffect(() => {
    if (z.vorbei) {
      sfx('ende');
      haptik('ende');
      onGameOver(z.punkte);
    }
    // onGameOver darf nur einmal kommen — deshalb hängt das nur an "vorbei".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Star Dash"
        untertitel="Fang die Sterne, bevor die Zeit abläuft!"
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

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden p-3 spielseite">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm text-gedaempft">
          {/* Die Stufe ist die einzige sichtbare Spur der Schwierigkeitskurve:
              Je höher sie steht, desto weniger Zeit bringt ein Stern
              (`zeitBonusFuer` in logik.ts). Der Puls über `key` macht den
              Wechsel im Vorbeigehen bemerkbar. */}
          <span key={stufe} className="punkte-bumsen inline-block">
            Stufe {stufe}
          </span>
          <span className="tabular-nums">Zeit {z.restZeit.toFixed(1)} s</span>
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
            style={{ width: `${anteil * 100}%`, backgroundColor: knapp ? ZIEL_FARBE : AKZENT }}
          />
        </div>
      </div>

      <div className="spielbuehne">
      <div
        ref={brett}
        // `relative` steht hier ausdrücklich, obwohl `.spielbuehne > *` es
        // ohnehin setzt: Das Punktgewinn-Popup darunter hängt daran, und
        // diese Abhängigkeit soll in der Datei zu sehen sein — genauso wie
        // bei Ghost Chase.
        className="spielbrett spielbrett-rahmen relative grid touch-none gap-2 p-1.5"
        style={
          {
            gridTemplateColumns: `repeat(${z.breite}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${z.hoehe}, minmax(0, 1fr))`,
            '--vz': z.breite / z.hoehe,
          } as CSSProperties
        }
        role="img"
        aria-label={`Spielfeld, Stufe ${stufe}. Dein ${FIGUR_NAME} ist in Reihe ${z.spieler.y + 1}, Spalte ${z.spieler.x + 1}. Der Stern ist in Reihe ${z.ziel.y + 1}, Spalte ${z.ziel.x + 1}.`}
      >
        {Array.from({ length: z.breite * z.hoehe }, (_, i) => {
          const x = i % z.breite;
          const y = Math.floor(i / z.breite);
          const istSpieler = x === z.spieler.x && y === z.spieler.y;
          const istZiel = x === z.ziel.x && y === z.ziel.y;
          const istPlatzer = platzer !== null && x === platzer.x && y === platzer.y;
          return (
            <div
              key={i}
              aria-hidden="true"
              // `relative` ist der Aufhänger für den zerplatzenden Stern: Er
              // liegt absolut über der Kachel und wird dadurch **kein**
              // zweites Rasterkind, das die Figur zur Seite schöbe.
              className="relative grid place-items-center overflow-visible rounded-xl border border-rand bg-flaeche"
              style={
                istSpieler
                  ? { borderColor: AKZENT }
                  : istZiel
                    ? { borderColor: ZIEL_FARBE }
                    : undefined
              }
            >
              {/* Größer als die Kachel, damit das Tier wie eine Figur wirkt
                  und nicht wie ein Symbol in einer Box. */}
              {istSpieler && <Sternenschlucker />}
              {/* Nur der Stern pulsiert, nicht die Kachel drum herum. */}
              {istZiel && (
                <span className="pulsiert text-2xl" style={{ color: ZIEL_FARBE }}>
                  ★
                </span>
              )}
              {istPlatzer && (
                // Der Schlüssel ist der Auslöser: Zwei Sterne kurz
                // hintereinander sollen die Animation neu starten, nicht die
                // erste stehen lassen.
                <span key={platzer.nr} className="pointer-events-none absolute inset-0">
                  {settings.reducedMotion ? (
                    // Bei „weniger Bewegung" kürzt `.ruhig` jede Animation auf
                    // 0,01 ms; das Element bleibt auf seinem Schlussbild stehen
                    // — und das ist bei `.aufloesen-blitz` wie bei `.kruemel`
                    // durchsichtig. Ohne diesen Zweig gäbe es hier also
                    // ausgerechnet gar keine Rückmeldung. Der Stern steht
                    // stattdessen kurz still und groß auf dem Feld: sichtbar,
                    // aber ohne jede Bewegung.
                    <span
                      className="absolute inset-0 grid place-items-center text-3xl"
                      style={{ color: ZIEL_FARBE }}
                    >
                      ★
                    </span>
                  ) : (
                    <>
                      <span
                        className="aufloesen-blitz absolute inset-0 grid place-items-center text-2xl"
                        style={{ color: ZIEL_FARBE }}
                      >
                        ★
                      </span>
                      {KRUEMEL.map((k) => (
                        <span
                          key={`${k.kx}${k.ky}`}
                          className="kruemel absolute top-1/2 left-1/2 size-1.5 rounded-full"
                          style={
                            {
                              backgroundColor: ZIEL_FARBE,
                              '--kx': k.kx,
                              '--ky': k.ky,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </>
                  )}
                </span>
              )}
            </div>
          );
        })}

        {/* Gehört ins Brett, nicht in die Bühne: Ein absolut liegendes Kind
            der Bühne wird von deren Regel auf `relative` zurückgesetzt und
            schiebt das Brett dann bei jedem Punkt zur Seite (siehe den
            Kommentar zu `.spielbuehne > *:not(.absolute)` in index.css). */}
        <Punktegewinn gewinn={gewinn} />
      </div>
      </div>

      <Steuerkreuz onRichtung={bewege} aktiv={!z.vorbei} />

      {/* Das Spielziel steht immer da, die Steuerhinweise nur, wenn Platz ist.
          Vorher lag beides unter `.nur-bei-platz` — und weil der
          Startbildschirm den Untertitel ab dem ersten Bestwert durch die
          Bestleistung ersetzt, stand auf kurzen Bildschirmen (Querformat,
          iPhone SE) danach nirgends mehr, was zu tun ist. Die eine schmale
          Zeile kostet das Brett ein paar Pixel; die Bühne schrumpft mit,
          gescrollt wird deshalb nichts. */}
      <div className="max-w-sm text-center text-gedaempft">
        <p className="text-xs">
          Fang mit deinem {FIGUR_NAME} die Sterne ein, bevor die Zeit abläuft.
        </p>
        <p className="nur-bei-platz mt-1 text-sm">Pfeiltasten, das Kreuz unten oder wischen.</p>
      </div>

      <p className="sr-only" aria-live="polite">
        {z.punkte} Punkte
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
