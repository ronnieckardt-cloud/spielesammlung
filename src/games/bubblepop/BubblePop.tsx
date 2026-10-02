import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../core/sfx';
import { haptik } from '../../core/haptik';
import { saatAus } from '../../core/rng';
import { Komboherz } from '../../core/Komboherz';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import type { GameProps } from '../../core/types';
import {
  ANZAHL_FARBEN,
  ETAPPEN_BONUS,
  STEIN,
  andocken,
  nachbarn,
  nachschubIntervall,
  neuesSpiel,
  regenbogenFarbe,
  serieFaktor,
  spezialUmschalten,
  tauschen,
} from './logik';
import type { Punkt, Spezial, Zustand } from './logik';
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
import { Bombe, Fels, Regenbogenkugel, SPEZIAL_NAME, SpezialDefs, SpezialSymbol } from './Spezialkugeln';

/** Wie lange geplatzte Kugeln noch nachleuchten, in Millisekunden. */
const PLATZ_DAUER_MS = 320;

/** Wie lange die nachfallenden Kugeln nach unten aus dem Feld sinken. */
const FALL_DAUER_MS = 420;

/** Wie lange eine Meldung über dem Feld steht, in Millisekunden. */
const MELDUNG_MS = 1500;

/** So lange nimmt das Feld nach einer geräumten Etappe keinen Schuss an — der Finger ist noch unterwegs. */
const ETAPPE_SPERRE_MS = 1000;

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
          Drei gleiche lassen es knallen — räume Feld um Feld leer
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
  // Der Fels ist keine Farbe: eigene Form, eigener Baustein.
  if (farbe === STEIN) return <Fels x={x} y={y} />;
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

/** Ein Schild über dem Feld: Etappe geräumt, Spezialkugel verdient. */
type Meldung = { id: number; titel: string; text?: string; gross: boolean };

/** Das zweite Symbol des Tausch-Knopfes: zwei Pfeile gegeneinander. */
function TauschSymbol() {
  return (
    // Auf dem schmalsten Handy (320 Pixel) fehlt der Platz: Dort bleiben Kugel und Wort, das Pfeilsymbol entfällt.
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hidden size-5 shrink-0 min-[360px]:block" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h14M14 4l4 4-4 4" />
      <path d="M20 16H6M10 12l-4 4 4 4" />
    </svg>
  );
}

/**
 * Prüfhaken nur für Bildschirmfotos (auf einem echten Gerät nie gesetzt): `__bubbleStart = { etappe, spezial,
 * serie }` beginnt in einer späteren Etappe, mit einer Spezialkugel im Vorrat oder laufender Serie.
 */
function startZustand(): Zustand {
  const haken = (
    globalThis as {
      __bubbleStart?: { etappe?: number; spezial?: Spezial; serie?: number; rest?: [number, number, number][] };
    }
  ).__bubbleStart;
  const z = neuesSpiel(saatAus('bubblepop', haken ? 1 : Date.now()), haken?.etappe ?? 1);
  if (!haken) return z;
  const gesetzt = { ...z, spezial: haken.spezial ?? null, serie: haken.serie ?? 0 };
  if (!haken.rest || haken.rest.length === 0) return gesetzt;
  // `rest`: Das Feld besteht nur noch aus diesen Kugeln [Spalte, Zeile, Farbe] — um das Ende einer Etappe zu zeigen.
  const wabe = z.wabe.map((zeile) => zeile.map(() => null as number | null));
  for (const [spalte, zeile, farbe] of haken.rest) wabe[zeile]![spalte] = farbe;
  const farbe = haken.rest[0]![2];
  return { ...gesetzt, wabe, aktuell: farbe, naechste: farbe };
}

export function BubblePop({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(startZustand);
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
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const brettRef = useRef<HTMLDivElement>(null);
  // Bis wann kein Schuss angenommen wird (nur nach einer geräumten Etappe). Eine Ref, kein Zustand: Es muss
  // nichts neu gezeichnet werden, nur der nächste Schuss fragt danach.
  const sperreBisRef = useRef(0);
  const meldungIdRef = useRef(0);

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

  useEffect(() => {
    if (!meldung) return;
    const uhr = window.setTimeout(() => setMeldung((alt) => (alt?.id === meldung.id ? null : alt)), MELDUNG_MS);
    return () => window.clearTimeout(uhr);
  }, [meldung]);

  const melden = useCallback((titel: string, text?: string, gross = false) => {
    meldungIdRef.current += 1;
    setMeldung({ id: meldungIdRef.current, titel, text, gross });
  }, []);

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
      if (performance.now() < sperreBisRef.current) return;

      const schuss = flugbahn(z.wabe, winkel);
      if (!schuss.ziel) return;

      const ergebnis = andocken(z, schuss.ziel);
      if (ergebnis.zustand === z) return;

      setZ(ergebnis.zustand);
      // Auch die Bombe zählt, wenn sie ins Leere ging: `geplatzt` ist dann leer, und es klingt wie ein Fehlschuss.
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
        // Der Ton steigt mit der Serie — man hört, wie weit man schon ist.
        const hoch = Math.min(12, (ergebnis.zustand.serie - 1) * 2);
        sfx(ergebnis.geplatzt.length + ergebnis.gefallen.length >= 6 ? 'stufe' : 'gut', hoch);
        if (ergebnis.art === 'bombe') haptik('jubel');
      } else {
        sfx('klick');
      }

      if (ergebnis.etappeGeschafft) {
        sperreBisRef.current = performance.now() + ETAPPE_SPERRE_MS;
        const n = ergebnis.zustand.etappe;
        melden(
          `Feld geräumt! +${ETAPPEN_BONUS * (n - 1)}`,
          n === 2
            ? 'Etappe 2 — neu: Felsen. Sie platzen nicht; lass sie fallen oder sprenge sie.'
            : `Etappe ${n} — mehr Felsen, früherer Nachschub.`,
          true,
        );
        sfx('stufe', 7);
        haptik('jubel');
      } else if (ergebnis.verdient) {
        // Kurz und unten im leeren Teil des Felds: Das passiert oft, und die Meldung soll die Kugeln nicht verdecken.
        melden(`${SPEZIAL_NAME[ergebnis.verdient]} verdient!`, ergebnis.verdient === 'bombe' ? 'Sprengt auch Felsen.' : 'Passt sich an.');
        sfx('stufe');
      }
    },
    [z, melden],
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

  const kugelTauschen = useCallback(() => {
    const neu = tauschen(z);
    if (neu === z) return;
    setZ(neu);
    sfx('klick');
  }, [z]);

  const spezialAnlegen = useCallback(() => {
    const neu = spezialUmschalten(z);
    if (neu === z) return;
    setZ(neu);
    sfx('klick');
  }, [z]);

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

      if (e.code === 'KeyT') {
        if (e.repeat) return;
        kugelTauschen();
        return;
      }
      if (e.code === 'KeyB') {
        if (e.repeat) return;
        spezialAnlegen();
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
  }, [gestartet, z.vorbei, abschiessen, zielSetzen, kugelTauschen, spezialAnlegen]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const platzendeSchluessel = new Set(platzend.map((p) => `${p.spalte},${p.zeile}`));
  const belegte = z.wabe.flat().filter((f) => f !== null).length;
  const felsen = z.wabe.flat().filter((f) => f === STEIN).length;

  // Der Nachschub ist die einzige echte Bedrohung im Spiel — er kam bisher
  // ohne jede Vorwarnung. Beim letzten Schuss davor pulsiert zusätzlich die
  // oberste Zeile, damit man sieht, wo es gleich enger wird.
  const intervall = nachschubIntervall(z.etappe);
  const bisNachschub = Math.max(0, intervall - z.seitNachschub);
  const warnung = !z.vorbei && bisNachschub <= 1;

  const faktor = z.serie >= 2 ? serieFaktor(z.serie) : 1;
  const spezialImRohr: Spezial | null = z.bereit ? z.spezial : null;
  const kannTauschen = !z.vorbei && !z.bereit && z.aktuell !== z.naechste;

  // Was ein Schuss jetzt treffen würde — für die Vorschau am Landepunkt.
  const regenFarbe =
    spezialImRohr === 'regenbogen' && bahn.ziel ? regenbogenFarbe(z.wabe, bahn.ziel, z.aktuell) : null;
  const zielKugel = regenFarbe ?? z.aktuell;
  const zielfarbe = spezialImRohr === 'bombe' ? '#fb923c' : spezialImRohr === 'regenbogen' ? '#ffffff' : kugelFarbe(z.aktuell);

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <div className="relative flex w-full max-w-sm items-center justify-center md:max-w-xl">
        <p className="absolute left-0 top-1/2 -translate-y-1/2 text-left leading-none" aria-label={`Etappe ${z.etappe}`}>
          <span className="block text-[11px] font-bold tracking-wider text-gedaempft uppercase">Etappe</span>
          <span key={z.etappe} className="punkte-bumsen block text-2xl font-black text-text tabular-nums">
            {z.etappe}
          </span>
        </p>
        <output
          aria-live="off"
          key={z.punkte}
          className="punkte-bumsen text-5xl font-black tabular-nums text-text sm:text-6xl"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {z.punkte}
        </output>
        {/* Das Herz hängt neben der Zahl und wächst mit der Serie — es zeigt den **Faktor**, nicht die Länge der
            Serie (die hört bei ×4 auf zu zählen, und „×7" neben einem Höchstfaktor von vier wäre gelogen). */}
        <Komboherz
          kombo={faktor}
          ruhig={settings.reducedMotion}
          beschriftung="Faktor"
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2"
        />
      </div>

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
          aria-label={`Spielfeld, Etappe ${z.etappe}, mit ${belegte} Kugeln${felsen > 0 ? `, davon ${felsen} Felsen` : ''}. Im Rohr: ${
            spezialImRohr ? SPEZIAL_NAME[spezialImRohr] : `${kugelName(z.aktuell)} mit ${kugelZeichenName(z.aktuell)}`
          }, danach ${kugelName(z.naechste)} mit ${kugelZeichenName(z.naechste)}. ${
            z.spezial && !z.bereit ? `Spezialkugel bereit: ${SPEZIAL_NAME[z.spezial]}. ` : ''
          }Nachschub in ${bisNachschub} Schüssen. Pfeiltasten zielen, Leertaste schießt, T tauscht, B legt die Spezialkugel ins Rohr.${z.vorbei ? (z.gewonnen ? ' Vorbei — mindestens ein Feld geräumt, gewonnen!' : ' Vorbei.') : ''}`}
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
            <SpezialDefs />

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
                stroke={zielfarbe}
                strokeWidth="0.6"
                strokeDasharray="1.5 1.5"
                opacity="0.55"
              />
            )}

            {/* Vorschau, wo die Kugel landen würde — mit dem Zeichen der
                Kugel im Rohr, damit auch hier nicht die Farbe allein den
                Unterschied macht. Die Bombe zeigt stattdessen, **was sie
                sprengt**; der Regenbogen die Farbe, die er annehmen würde. */}
            {!z.vorbei && bahn.ziel && spezialImRohr === 'bombe' && (
              <g opacity="0.9">
                {[bahn.ziel, ...nachbarn(bahn.ziel)].map((p, i) => {
                  const m = mittelpunkt(p);
                  const belegt = z.wabe[p.zeile]![p.spalte] !== null;
                  return (
                    <circle
                      key={`${p.spalte},${p.zeile}`}
                      cx={m.x}
                      cy={m.y}
                      r={RADIUS * 0.92}
                      fill={belegt ? 'rgba(251,146,60,0.5)' : 'none'}
                      stroke="#fb923c"
                      strokeWidth={belegt || i === 0 ? 0.9 : 0.3}
                      strokeDasharray={i === 0 ? '1.2 1' : undefined}
                    />
                  );
                })}
              </g>
            )}
            {!z.vorbei && bahn.ziel && spezialImRohr !== 'bombe' && (
              <g opacity="0.8">
                <circle
                  cx={mittelpunkt(bahn.ziel).x}
                  cy={mittelpunkt(bahn.ziel).y}
                  r={RADIUS * 0.85}
                  fill="none"
                  stroke={kugelFarbe(zielKugel)}
                  strokeWidth="0.7"
                />
                <path
                  d={kugelZeichen(zielKugel)}
                  transform={`translate(${mittelpunkt(bahn.ziel).x} ${mittelpunkt(bahn.ziel).y}) scale(${RADIUS * 0.6})`}
                  fill={kugelFarbe(zielKugel)}
                  fillRule="evenodd"
                  opacity="0.7"
                />
              </g>
            )}

            {/* Beim Beginn einer Etappe rutscht das neue Feld von oben herein. Der Schlüssel macht daraus einen
                frischen Einstieg; in der ersten Etappe steht das Feld einfach da. */}
            <g key={`etappe-${z.etappe}`} className={z.etappe > 1 && !settings.reducedMotion ? 'bubble-etappe-rein' : undefined}>
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
            </g>

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

            {/* Kanone mit der Kugel im Rohr — oder, wenn man sie angelegt hat, mit der Spezialkugel. */}
            <line
              x1={KANONE.x}
              y1={KANONE.y}
              x2={KANONE.x + Math.cos(zielWinkel) * ROHR_LAENGE}
              y2={KANONE.y + Math.sin(zielWinkel) * ROHR_LAENGE}
              stroke="#97a3b8"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {spezialImRohr === 'bombe' ? (
              <Bombe x={KANONE.x} y={KANONE.y} />
            ) : spezialImRohr === 'regenbogen' ? (
              <Regenbogenkugel x={KANONE.x} y={KANONE.y} />
            ) : (
              <Kugel x={KANONE.x} y={KANONE.y} farbe={z.aktuell} />
            )}
          </svg>

          <Punktegewinn gewinn={gewinn} />

          {/* Meldungen liegen im unteren, meist leeren Teil des Felds und nehmen keine Berührung an: Der Finger zielt weiter. */}
          {meldung && (
            <div className="pointer-events-none absolute inset-x-3 bottom-[13%] z-10 grid place-items-center" role="status">
              <div
                key={meldung.id}
                className={`${settings.reducedMotion ? '' : 'bubble-meldung '}max-w-full rounded-2xl border border-white/30 bg-black/75 px-4 text-center shadow-xl backdrop-blur-sm ${meldung.gross ? 'py-3' : 'py-1.5'}`}
              >
                <p className={`leading-tight font-black text-white ${meldung.gross ? 'text-lg' : 'text-base'}`}>{meldung.titel}</p>
                {meldung.text && <p className="mt-0.5 text-[13px] leading-snug font-semibold text-white/85">{meldung.text}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drei Dinge unter dem Feld: Tauschen (zeigt die nächste Kugel), der Nachschub-Zähler, die Spezialkugel.
          Jeder Knopf trägt Symbol **und** Wort — zwei bildlose Rundknöpfe muss man erst ausprobieren. */}
      <div className="flex w-full max-w-sm items-stretch justify-between gap-1 text-gedaempft min-[360px]:gap-2 md:max-w-xl">
        <button
          type="button"
          onClick={kugelTauschen}
          disabled={!kannTauschen}
          aria-label={`Kugel tauschen: ${kugelName(z.aktuell)} im Rohr gegen ${kugelName(z.naechste)} als Nächste`}
          className="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-xl border px-1 text-xs font-bold text-text transition-[transform,opacity] duration-100 enabled:active:scale-95 disabled:opacity-35 min-[360px]:gap-1.5 min-[360px]:px-2 min-[360px]:text-[13px]"
          style={{ borderColor: 'var(--color-rand)', backgroundColor: 'var(--color-flaeche)' }}
        >
          <TauschSymbol />
          <KugelPlaettchen farbe={z.naechste} />
          <span>Tauschen</span>
        </button>

        {/* Acht Punkte für acht Schüsse: gefüllt gegen leer ist ein
            Formunterschied, keine Farbunterscheidung. */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-0.5 min-[360px]:px-1">
          <span className={`text-[11px] leading-none font-semibold ${warnung ? 'font-bold text-warnung' : ''}`}>
            {warnung ? 'Gleich Nachschub!' : 'Nachschub'}
          </span>
          <span
            role="img"
            aria-label={`Nachschub von oben in ${bisNachschub} Schüssen ohne Treffer.`}
            className="flex items-center gap-1"
          >
            {Array.from({ length: intervall }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  i < z.seitNachschub
                    ? warnung
                      ? 'bg-warnung'
                      : 'bg-gedaempft'
                    : 'border border-gedaempft/70'
                }`}
              />
            ))}
          </span>
        </div>

        <button
          type="button"
          onClick={spezialAnlegen}
          disabled={z.vorbei || z.spezial === null}
          aria-pressed={z.bereit}
          aria-label={
            z.spezial === null
              ? 'Keine Spezialkugel. Man verdient sie mit vier Treffern in Folge oder einem Schuss, der vier Kugeln herunterholt.'
              : z.bereit
                ? `${SPEZIAL_NAME[z.spezial]} liegt im Rohr. Antippen nimmt sie wieder heraus.`
                : `${SPEZIAL_NAME[z.spezial]} ins Rohr legen`
          }
          className="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-xl border px-1 text-xs font-bold transition-[transform,opacity] duration-100 enabled:active:scale-95 disabled:opacity-35 min-[360px]:gap-1.5 min-[360px]:px-2 min-[360px]:text-[13px]"
          style={
            z.spezial === null
              ? { borderColor: 'var(--color-rand)', backgroundColor: 'var(--color-flaeche)', color: 'var(--color-text)' }
              : z.bereit
                ? { borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.28)', color: '#fff' }
                : { borderColor: '#fbbf24', backgroundColor: 'var(--color-flaeche)', color: 'var(--color-text)' }
          }
        >
          {z.spezial === null ? (
            <>
              <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-dashed border-gedaempft/70" />
              <span>Spezial</span>
            </>
          ) : (
            <>
              <span key={z.spezial} className="punkte-bumsen shrink-0">
                <SpezialSymbol art={z.spezial} className="size-4 min-[360px]:size-6" />
              </span>
              <span>{z.bereit ? 'Abbrechen' : SPEZIAL_NAME[z.spezial]}</span>
            </>
          )}
        </button>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft md:max-w-xl">
        Zum Zielen über das Feld fahren, zum Schießen loslassen. Drei gleiche Farben platzen, was den Halt verliert,
        fällt hinterher, und Treffer in Folge zählen mehr. Felsen platzen nie — lass sie fallen oder sprenge sie.
        <span className="hidden md:inline"> Tastatur: Pfeile zielen, Leertaste schießt, T tauscht, B legt die Spezialkugel ein.</span>
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
