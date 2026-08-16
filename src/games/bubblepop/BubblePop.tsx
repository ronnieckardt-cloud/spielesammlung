import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import { saatAus } from '../../core/rng';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import type { GameProps } from '../../core/types';
import { ANZAHL_FARBEN, NACHSCHUB_NACH_SCHUESSEN, andocken, neuesSpiel } from './logik';
import type { Punkt, Zustand } from './logik';
import {
  FELD_BREITE,
  FELD_HOEHE,
  KANONE,
  RADIUS,
  begrenzeWinkel,
  flugbahn,
  mittelpunkt,
  winkelZu,
} from './geometrie';
import type { Stelle } from './geometrie';
import {
  ZEICHEN_DECKUNG,
  ZEICHEN_FARBE,
  kugelFarbe,
  kugelName,
  kugelZeichen,
  kugelZeichenName,
} from './farben';
import { BubblePopIcon } from './Icon';

/** Wie lange geplatzte Kugeln noch nachleuchten, in Millisekunden. */
const PLATZ_DAUER_MS = 320;

/** Wie lange die nachfallenden Kugeln nach unten aus dem Feld sinken. */
const FALL_DAUER_MS = 420;

/** Länge des Kanonenrohrs im Rechenraum von geometrie.ts. */
const ROHR_LAENGE = 8;

/** Wie weit ein Druck auf eine Pfeiltaste das Rohr dreht (2 Grad). */
const TASTEN_SCHRITT = (Math.PI / 180) * 2;

/**
 * Schwebende Deko-Kugeln im Hintergrund des Startbildschirms — feste Liste,
 * rein dekorativ, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
const DEKO_KUGELN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 9, y: 13, groesse: 28, farbe: '#f43f5e', verzoegerung: 0 },
  { x: 86, y: 9, groesse: 22, farbe: '#facc15', verzoegerung: 0.6 },
  { x: 81, y: 79, groesse: 32, farbe: '#38bdf8', verzoegerung: 1.1 },
  { x: 8, y: 79, groesse: 24, farbe: '#4ade80', verzoegerung: 0.3 },
  { x: 92, y: 45, groesse: 17, farbe: '#c084fc', verzoegerung: 1.6 },
  { x: 4, y: 46, groesse: 19, farbe: '#facc15', verzoegerung: 0.9 },
];

/**
 * Titelbild im Stil bunter Blasen-Spiele — kräftiger Verlauf, schwebende
 * Kugeln, dicke Schrift. Eigene Gestaltung, siehe Blockblitz-Startbildschirm
 * für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #7c3aed 0%, #d946ef 40%, #f43f5e 72%, #f97316 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_KUGELN.map((k, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-85"
            style={
              {
                left: `${k.x}%`,
                top: `${k.y}%`,
                width: k.groesse,
                height: k.groesse,
                backgroundColor: k.farbe,
                animationDelay: `${k.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <BubblePopIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Bubble Pop
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          Drei gleiche lassen es knallen
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
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-fuchsia-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

/**
 * Eine Kugel im Feld: Schattenkante, Farbverlauf, Zeichen, Glanzpunkt.
 *
 * Als eigener Baustein, weil dieselbe Kugel an drei Stellen vorkommt — in
 * der Wabe, im Kanonenrohr und beim Herunterfallen. Vorher stand die
 * Zeichenfolge zweimal fast gleich da, und das Zeichen wäre beim dritten
 * Mal sicher vergessen worden.
 */
function Kugel({ x, y, farbe }: { x: number; y: number; farbe: number }) {
  return (
    <>
      {/* Dunkler Rand als Schattenkante unter der Kugel. */}
      <circle cx={x} cy={y + 0.35} r={RADIUS * 0.94} fill="#0b1020" opacity="0.45" />
      <circle cx={x} cy={y} r={RADIUS * 0.94} fill={`url(#kugel-${farbe})`} />
      <path
        d={kugelZeichen(farbe)}
        transform={`translate(${x} ${y}) scale(${RADIUS})`}
        fill={ZEICHEN_FARBE}
        fillRule="evenodd"
        opacity={ZEICHEN_DECKUNG}
      />
      <ellipse
        cx={x - RADIUS * 0.32}
        cy={y - RADIUS * 0.38}
        rx={RADIUS * 0.22}
        ry={RADIUS * 0.14}
        fill="#ffffff"
        opacity="0.85"
      />
    </>
  );
}

/** Dieselbe Kugel klein und für sich — für die Vorschau neben dem Feld. */
function KugelPlaettchen({ farbe }: { farbe: number }) {
  return (
    <svg viewBox="-1 -1 2 2" aria-hidden="true" className="inline-block size-4 shrink-0">
      <circle cx="0" cy="0" r="0.94" fill={kugelFarbe(farbe)} />
      <path
        d={kugelZeichen(farbe)}
        fill={ZEICHEN_FARBE}
        fillRule="evenodd"
        opacity={ZEICHEN_DECKUNG}
      />
    </svg>
  );
}

/** Eine Kugel, die gerade heruntersinkt — merkt sich ihre Farbe selbst. */
type Fallkugel = Punkt & { farbe: number };

export function BubblePop({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('bubblepop', Date.now())));
  const [zielWinkel, setZielWinkel] = useState(-Math.PI / 2);
  const [platzend, setPlatzend] = useState<readonly Punkt[]>([]);
  // `lauf` zählt die Fallvorgänge durch und dient unten als Schlüssel: Ohne
  // ihn würde React das `<g>` des vorigen Falls wiederverwenden, und ein
  // zweiter Fall kurz nach dem ersten ließe die Kugeln erst sichtbar wieder
  // nach oben zurückfahren.
  const [fall, setFall] = useState<{ lauf: number; kugeln: readonly Fallkugel[] }>({
    lauf: 0,
    kugeln: [],
  });
  const [unten, setUnten] = useState(false);
  const brettRef = useRef<HTMLDivElement>(null);

  // Der Zielwinkel steht doppelt: als Zustand für die Anzeige und als Ref
  // für den Tasten-Listener. Ohne die Ref müsste der Listener bei jedem
  // Grad neu aufgehängt werden — dieselbe Überlegung wie beim Ziehen in
  // Block Burst.
  const winkelRef = useRef(zielWinkel);
  const zielSetzen = useCallback((winkel: number) => {
    winkelRef.current = winkel;
    setZielWinkel(winkel);
  }, []);

  const gewinn = usePunktegewinn(z.punkte);

  // Die Flugbahn hängt nur von Wabe und Winkel ab. Gemerkt statt bei jedem
  // Rendern neu gerechnet: Bei einem flachen Winkel prallt die Kugel oft ab
  // und läuft über tausend Schritte, jeder mit einer Abstandsprüfung gegen
  // alle Nachbarn — das ist nicht mehr „billig genug", wenn es bei jeder
  // Fingerbewegung passiert.
  const bahn = useMemo(() => flugbahn(z.wabe, zielWinkel), [z.wabe, zielWinkel]);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx(z.gewonnen ? 'stufe' : 'ende');
      haptik(z.gewonnen ? 'jubel' : 'ende');
      onGameOver(z.punkte, z.gewonnen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  useEffect(() => {
    if (platzend.length === 0) return;
    const uhr = window.setTimeout(() => setPlatzend([]), PLATZ_DAUER_MS);
    return () => window.clearTimeout(uhr);
  }, [platzend]);

  /**
   * Die gefallenen Kugeln in Bewegung setzen.
   *
   * Ein Übergang braucht zwei Bilder: erst müssen die Kugeln an ihrem alten
   * Platz stehen, erst danach darf die Endlage kommen. Stünde beides im
   * selben Bild, gäbe es nichts zu überblenden und sie wären einfach weg.
   * Deshalb `requestAnimationFrame` — der Startwert `unten = false` wird
   * schon beim Schuss gesetzt, im selben Rutsch wie die Kugeln selbst.
   */
  useEffect(() => {
    if (fall.kugeln.length === 0) return;
    const bild = requestAnimationFrame(() => setUnten(true));
    const uhr = window.setTimeout(
      () => setFall((alt) => (alt.kugeln.length === 0 ? alt : { ...alt, kugeln: [] })),
      FALL_DAUER_MS + 80,
    );
    return () => {
      cancelAnimationFrame(bild);
      window.clearTimeout(uhr);
    };
  }, [fall]);

  /** Bildpunkt des Zeigers in den Rechenraum des Felds umrechnen. */
  const stelleAus = useCallback((e: ReactPointerEvent<HTMLDivElement>): Stelle | null => {
    const brett = brettRef.current;
    if (!brett) return null;
    const kasten = brett.getBoundingClientRect();
    return {
      x: ((e.clientX - kasten.left) / kasten.width) * FELD_BREITE,
      y: ((e.clientY - kasten.top) / kasten.height) * FELD_HOEHE,
    };
  }, []);

  /**
   * Schießen — die eine Stelle, an der ein Schuss stattfindet.
   *
   * Nimmt den fertigen Winkel entgegen, nicht das Ereignis: Finger und
   * Pfeiltasten kommen auf ganz verschiedenen Wegen zu ihrem Winkel, ab
   * hier ist der Ablauf aber derselbe.
   */
  const abschiessen = useCallback(
    (winkel: number) => {
      if (z.vorbei) return;

      const schuss = flugbahn(z.wabe, winkel);
      if (!schuss.ziel) return;

      const ergebnis = andocken(z, schuss.ziel);
      if (ergebnis.zustand === z) return;

      setZ(ergebnis.zustand);
      if (ergebnis.geplatzt.length > 0) {
        setPlatzend(ergebnis.geplatzt);
        // Die Farbe muss jetzt gemerkt werden — im neuen Zustand sind die
        // gefallenen Felder schon leer. `unten` gehört in denselben Rutsch:
        // Die neuen Kugeln müssen oben starten, sonst stehen sie sofort am
        // unteren Rand.
        setFall((alt) => ({
          lauf: alt.lauf + 1,
          kugeln: ergebnis.gefallen.map((p) => ({ ...p, farbe: z.wabe[p.zeile]![p.spalte] ?? 0 })),
        }));
        setUnten(false);
        sfx(ergebnis.geplatzt.length + ergebnis.gefallen.length >= 6 ? 'stufe' : 'gut');
      } else {
        sfx('klick');
      }
    },
    [z],
  );

  const zielen = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (z.vorbei) return;
      const stelle = stelleAus(e);
      if (stelle) zielSetzen(winkelZu(stelle));
    },
    [stelleAus, zielSetzen, z.vorbei],
  );

  /**
   * Beim Berühren nur zielen, **nicht** schießen.
   *
   * Vorher hing der Schuss an `pointerdown`. Auf einem Handy heißt das: Die
   * Kugel ist schon unterwegs, bevor je ein `pointermove` ankommt — die
   * gerechnete Flugbahn mit den Abprallern an den Wänden war damit auf dem
   * Hauptgerät **nie zu sehen**, und aus dem Zielspiel wurde ein Ratespiel.
   * Mit Maus fiel es nicht auf, weil der Zeiger schon vor dem Klick über
   * dem Feld liegt.
   *
   * `setPointerCapture` sorgt dafür, dass auch ein Loslassen außerhalb des
   * Felds noch hier ankommt.
   */
  const anlegen = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (z.vorbei) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      zielen(e);
    },
    [zielen, z.vorbei],
  );

  const loslassen = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (z.vorbei) return;
      const stelle = stelleAus(e);
      if (!stelle) return;
      const winkel = winkelZu(stelle);
      zielSetzen(winkel);
      abschiessen(winkel);
    },
    [abschiessen, stelleAus, zielSetzen, z.vorbei],
  );

  /**
   * Eigener, schmaler Tastatur-Listener statt `useInput`.
   *
   * Grund wie bei Blade Toss: `useInput` meldet ein Antippen erst beim
   * Loslassen und kennt nur sieben feste Aktionen — hier braucht es aber
   * ein feines Weiterdrehen um wenige Grad, kein „links/rechts" in
   * Feldschritten. Die Pfeiltasten drehen deshalb den vorhandenen
   * Zielwinkel weiter; das Halten wiederholt der Browser von selbst,
   * indem er weitere `keydown` schickt.
   */
  useEffect(() => {
    if (!gestartet || z.vorbei) return;
    const beiTaste = (e: KeyboardEvent) => {
      // Nicht dazwischenfunken, wenn gerade ein Knopf den Fokus hat —
      // sonst schießt die Leertaste, statt den Knopf zu drücken.
      if (e.target instanceof Element && e.target.closest('button, a[href]')) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const richtung = e.key === 'ArrowLeft' ? -1 : 1;
        zielSetzen(begrenzeWinkel(winkelRef.current + richtung * TASTEN_SCHRITT));
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'ArrowUp') {
        // Halten darf nicht dauerfeuern: Ein Schuss je Druck.
        if (e.repeat) return;
        e.preventDefault();
        abschiessen(winkelRef.current);
      }
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [gestartet, z.vorbei, abschiessen, zielSetzen]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const platzendeSchluessel = new Set(platzend.map((p) => `${p.spalte},${p.zeile}`));
  const belegte = z.wabe.flat().filter((f) => f !== null).length;

  // Der Nachschub ist die einzige echte Bedrohung im Spiel — er kam bisher
  // ohne jede Vorwarnung. Beim letzten Schuss davor pulsiert zusätzlich die
  // oberste Zeile, damit man sieht, wo es gleich enger wird.
  const bisNachschub = Math.max(0, NACHSCHUB_NACH_SCHUESSEN - z.seitNachschub);
  const warnung = !z.vorbei && bisNachschub <= 1;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <output
        aria-live="off"
        key={z.punkte}
        className="punkte-bumsen text-5xl font-black tabular-nums text-text sm:text-6xl"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {z.punkte}
      </output>

      <div className="spielbuehne">
        {/* Das Brett ist ein eigener Behälter um das SVG — nur so kann das
            „+N" darüberliegen, ohne als zweites Kind der Bühne das Feld zur
            Seite zu schieben (siehe Kommentar zu `.spielbuehne` in
            index.css; Ghost Chase macht es genauso). */}
        <div
          ref={brettRef}
          className="spielbrett spielbrett-rahmen relative touch-none overflow-hidden bg-flaeche"
          style={{ '--vz': FELD_BREITE / FELD_HOEHE } as CSSProperties}
          onPointerDown={anlegen}
          onPointerMove={zielen}
          onPointerUp={loslassen}
          tabIndex={0}
          role="button"
          aria-label={`Spielfeld mit ${belegte} Kugeln. Im Rohr: ${kugelName(z.aktuell)} mit ${kugelZeichenName(z.aktuell)}, danach ${kugelName(z.naechste)} mit ${kugelZeichenName(z.naechste)}. Nachschub in ${bisNachschub} Schüssen. Pfeiltasten zielen, Leertaste schießt.${z.vorbei ? (z.gewonnen ? ' Alle Kugeln weg, gewonnen!' : ' Vorbei.') : ''}`}
        >
          <svg
            viewBox={`0 0 ${FELD_BREITE} ${FELD_HOEHE}`}
            className="size-full select-none"
            aria-hidden="true"
          >
            <defs>
              {/* Je Farbe ein Kugelverlauf: heller Punkt oben links, zum Rand
                  hin dunkler. Das lässt die flachen Kreise rund wirken. Einmal
                  hier definiert und unten mehrfach benutzt — die Farben stehen
                  fest, deshalb reichen feste ids. */}
              {Array.from({ length: ANZAHL_FARBEN }, (_, i) => (
                <radialGradient key={i} id={`kugel-${i}`} cx="0.35" cy="0.3" r="0.75">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
                  <stop offset="0.35" stopColor={kugelFarbe(i)} />
                  <stop offset="1" stopColor={kugelFarbe(i)} stopOpacity="1" />
                </radialGradient>
              ))}
            </defs>

            {/* Warnbalken an der Oberkante: Beim nächsten Schuss ohne Treffer
                schiebt sich von hier eine neue Zeile herein.

                Der Balken steht **zusätzlich** zum Pochen der obersten
                Zeile. Bei „weniger Bewegung" bleibt vom Pochen nichts übrig
                — die Warnung darf davon nicht abhängen. */}
            {warnung && (
              <rect
                x="0"
                y="0"
                width={FELD_BREITE}
                height="1.4"
                fill="var(--color-warnung)"
                opacity="0.85"
              />
            )}

            {/* Zielhilfe: die gerechnete Flugbahn inklusive Abprallern. */}
            {!z.vorbei && (
              <polyline
                points={bahn.punkte.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={kugelFarbe(z.aktuell)}
                strokeWidth="0.6"
                strokeDasharray="1.5 1.5"
                opacity="0.55"
              />
            )}

            {/* Vorschau, wo die Kugel landen würde — mit dem Zeichen der
                Kugel im Rohr, damit auch hier nicht die Farbe allein den
                Unterschied macht. */}
            {!z.vorbei && bahn.ziel && (
              <g opacity="0.8">
                <circle
                  cx={mittelpunkt(bahn.ziel).x}
                  cy={mittelpunkt(bahn.ziel).y}
                  r={RADIUS * 0.85}
                  fill="none"
                  stroke={kugelFarbe(z.aktuell)}
                  strokeWidth="0.7"
                />
                <path
                  d={kugelZeichen(z.aktuell)}
                  transform={`translate(${mittelpunkt(bahn.ziel).x} ${mittelpunkt(bahn.ziel).y}) scale(${RADIUS * 0.6})`}
                  fill={kugelFarbe(z.aktuell)}
                  fillRule="evenodd"
                  opacity="0.7"
                />
              </g>
            )}

            {z.wabe.map((zeile, y) =>
              zeile.map((farbe, x) => {
                if (farbe === null) return null;
                const m = mittelpunkt({ spalte: x, zeile: y });
                return (
                  <g
                    key={`${x},${y}`}
                    // Die oberste Zeile pocht, wenn beim nächsten Fehlschuss
                    // eine neue Zeile nachrückt.
                    className={warnung && y === 0 ? 'pulsiert-sanft' : undefined}
                  >
                    <Kugel x={m.x} y={m.y} farbe={farbe} />
                  </g>
                );
              }),
            )}

            {/* Nachleuchten der geplatzten Kugeln. */}
            {[...platzendeSchluessel].map((schluessel) => {
              const [x, y] = schluessel.split(',').map(Number);
              const m = mittelpunkt({ spalte: x!, zeile: y! });
              return (
                <circle
                  key={`platz-${schluessel}`}
                  className="aufloesen-blitz"
                  cx={m.x}
                  cy={m.y}
                  r={RADIUS}
                  fill="white"
                />
              );
            })}

            {/* Nachfallende Kugeln.

                Sie bekommen bewusst **nicht** den Blitz der geplatzten: Für
                sie gibt es doppelte Punkte, und dieser Unterschied war
                vorher nirgends zu sehen. Hier fallen sie in ihrer echten
                Farbe nach unten aus dem Feld heraus.

                Ein Übergang statt Keyframes — so kürzt die globale
                `.ruhig`-Regel bei „weniger Bewegung" einfach die Dauer, ganz
                ohne Sonderfall für eine Verzögerung. */}
            {fall.kugeln.length > 0 && (
              <g
                key={`fall-${fall.lauf}`}
                style={{
                  transform: unten ? `translateY(${FELD_HOEHE}px)` : 'none',
                  opacity: unten ? 0 : 1,
                  transition: `transform ${FALL_DAUER_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${FALL_DAUER_MS}ms ease-in`,
                }}
              >
                {fall.kugeln.map((k) => {
                  const m = mittelpunkt(k);
                  return (
                    <Kugel key={`${k.spalte},${k.zeile}`} x={m.x} y={m.y} farbe={k.farbe} />
                  );
                })}
              </g>
            )}

            {/* Kanone mit der Kugel im Rohr. */}
            <line
              x1={KANONE.x}
              y1={KANONE.y}
              x2={KANONE.x + Math.cos(zielWinkel) * ROHR_LAENGE}
              y2={KANONE.y + Math.sin(zielWinkel) * ROHR_LAENGE}
              stroke="#97a3b8"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <Kugel x={KANONE.x} y={KANONE.y} farbe={z.aktuell} />
          </svg>

          <Punktegewinn gewinn={gewinn} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-gedaempft">
        <p className="flex items-center gap-1.5">
          Als Nächstes: <KugelPlaettchen farbe={z.naechste} />
          <span className="font-semibold text-text">
            {kugelName(z.naechste)} ({kugelZeichenName(z.naechste)})
          </span>
        </p>

        {/* Acht Punkte für acht Schüsse: gefüllt gegen leer ist ein
            Formunterschied, keine Farbunterscheidung. */}
        <p className={`flex items-center gap-1.5 ${warnung ? 'font-bold text-warnung' : ''}`}>
          <span>{warnung ? 'Gleich Nachschub!' : 'Nachschub:'}</span>
          <span
            role="img"
            aria-label={`Nachschub von oben in ${bisNachschub} Schüssen ohne Treffer.`}
            className="flex items-center gap-1"
          >
            {Array.from({ length: NACHSCHUB_NACH_SCHUESSEN }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`size-2 rounded-full ${
                  i < z.seitNachschub
                    ? warnung
                      ? 'bg-warnung'
                      : 'bg-gedaempft'
                    : 'border border-gedaempft/70'
                }`}
              />
            ))}
          </span>
        </p>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Zum Zielen über das Feld fahren oder wischen, zum Schießen antippen —
        mit der Tastatur zielen die Pfeiltasten und die Leertaste schießt.
        Drei gleiche Farben platzen; was danach den Halt verliert, fällt
        hinterher und gibt Extrapunkte. Alle Kugeln weg heißt gewonnen.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
