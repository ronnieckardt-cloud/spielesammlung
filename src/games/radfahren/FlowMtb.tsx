import { useCallback, useEffect, useRef, useState } from 'react';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { useGameLoop } from '../../core/useGameLoop';
import { haptik } from '../../core/haptik';
import type { GameProps } from '../../core/types';
import {
  STRECKE_LAENGE,
  TRICK_PUNKTE_JE_DREHUNG,
  neuesSpiel,
  punkte,
  streckenSaat,
  takt,
  tempoKmh,
} from './logik';
import type { Eingabe, Lauf } from './logik';
import type { Zeichner } from './zeichnen';
import { zeichnerBauen } from './zeichnen';
import { MtbIcon } from './Icon';

/**
 * Flow MTB — ein physikbasiertes 2-D-Mountainbike-Spiel.
 *
 * Ronnis Vorgabe: „Speed + Airtime + Control + Landing … leicht zu
 * verstehen, aber schwer zu meistern." Diese Datei verbindet nur Eingabe,
 * Uhr und Anzeige: Die Fahrphysik steht in `logik.ts` (ohne Browser
 * geprüft), gezeichnet wird in `zeichnen.ts` (kennt keine Regel).
 *
 * **Der Zustand liegt in einer Ref, nicht in `useState`.** Bei sechzig
 * Bildern je Sekunde hieße ein `setState` je Bild, sechzigmal je Sekunde
 * den React-Baum durchzurechnen, während daneben gezeichnet wird — genau
 * das macht ein Spiel ruckelig. Nach außen (`onScore`) geht der Stand nur
 * zweimal je Sekunde; die Anzeigen im Bild werden direkt ins DOM
 * geschrieben. Dasselbe Vorgehen wie bei Dash City.
 */

/*
 * **Der Startbildschirm war leer** — Rückmeldung: „Allein schon das
 * Titelding sieht kacke aus." `Startbildschirm` gibt jedem Spiel nur
 * Symbol, Titel und ein paar schwebende Deko-Teile vor; bei den anderen
 * Spielen reichen dafür kleine Formen (Gebäude, Berge), weil das Symbol
 * oben schon das Spiel zeigt. Hier stand bislang nur eine Handvoll
 * winziger Berg-Dreiecke — nichts, was nach Fahrrad aussah.
 *
 * Jetzt steht ein großes Helden-Bild des Bikes unten im Bild, im selben
 * Rot wie im Spiel, in einer Sprung-Schräglage: Genau das, um das sich
 * das ganze Spiel dreht, statt eines austauschbaren Icons. Die Berge
 * bleiben als Rahmen an den Rändern.
 */
const DEKO: readonly DekoTeil[] = [
  { x: 6, y: 14, winkel: -8, verzoegerung: 0, inhalt: <DekoBerg hoehe={50} /> },
  { x: 90, y: 10, winkel: 6, verzoegerung: 0.6, inhalt: <DekoBerg hoehe={64} /> },
  { x: 92, y: 32, winkel: -5, verzoegerung: 1.3, inhalt: <DekoBerg hoehe={36} /> },
  { x: 3, y: 34, winkel: 7, verzoegerung: 0.9, inhalt: <DekoBerg hoehe={40} /> },
  // Unter dem Knopf verankert, nicht in der Bildmitte: Der Inhaltsblock
  // (Symbol/Titel/Knopf) sitzt je nach Bildschirmhöhe unterschiedlich —
  // ein mittig verankertes Bild geriete auf kurzen Bildschirmen in den
  // Knopf. Die Illustration ist bewusst flach (breiter als hoch), damit
  // sie auch bei wenig Restplatz noch ganz hineinpasst.
  { x: 50, y: 78, verzoegerung: 0.4, inhalt: <DekoHeldenbike /> },
];

function DekoBerg({ hoehe }: { hoehe: number }) {
  return (
    <svg viewBox="0 0 40 40" className="w-10" style={{ height: hoehe }}>
      <path d="M20 4 L38 38 L2 38 Z" fill="#1e3a54" opacity={0.85} />
      <path d="M20 4 L27 17 L13 17 Z" fill="#e2f0f7" opacity={0.9} />
    </svg>
  );
}

/**
 * Das Bike, in Sprung-Schräglage — dasselbe Rot, dieselbe Doppelbrücken-
 * gabel wie im Spiel, hier als flaches Poster-Bild statt als Canvas-
 * Zeichnung. Eine eigene, einfachere Bauart als `zeichnen.ts` ist hier
 * richtig: Der Startbildschirm ist ein Standbild, kein bewegtes Rad mit
 * Federweg — er darf, anders als das Spielbild, ruhig grob vereinfachen.
 */
function DekoHeldenbike() {
  // Feste Punkte statt Freihand-Kurven — jeder einzeln nachvollziehbar,
  // damit sich keine zweite sich selbst überschneidende Fläche mehr
  // einschleicht (das Rahmen-Vieleck der ersten Fassung tat genau das
  // und ergab den unförmigen roten Fleck aus der Rückmeldung).
  const RW = { x: 66, y: 114 }; // Hinterrad-Achse
  const FW = { x: 226, y: 114 }; // Vorderrad-Achse
  const BB = { x: 138, y: 116 }; // Tretlager
  const ST = { x: 116, y: 54 }; // Sattelrohr oben
  const HT = { x: 194, y: 60 }; // Steuerrohr oben
  const KRONE = { x: 192, y: 48 }; // Doppelbrücke unten
  const LENKER_MITTE = { x: 190, y: 29 }; // Doppelbrücke oben, Vorbau
  const GRIFF = { x: 221, y: 27 }; // Lenkergriff
  const HUEFTE = { x: 124, y: 54 };
  const SCHULTER = { x: 163, y: 17 };
  const KNIE = { x: 147, y: 74 };
  const PEDAL = { x: 147, y: 101 };
  const KOPF = { x: 173, y: 6 };

  return (
    <svg
      viewBox="0 0 300 150"
      className="w-[70vw] max-w-[300px] -translate-x-1/2 drop-shadow-[0_16px_26px_rgba(0,0,0,0.4)]"
      aria-hidden="true"
    >
      {/* Weicher Lichtschein hinter dem Rad — dieselbe Regel wie beim
          App-Symbol: ein Fleck Licht macht aus einer Silhouette ein Bild. */}
      <ellipse cx={150} cy={80} rx={140} ry={78} fill="#ffffff" opacity={0.1} />

      {/* Nur eine leichte Schräglage (6°), nicht die dramatische
          Sprunghaltung der ersten Fassung — die hatte den Kopf so weit
          nach oben verschoben, dass er den Spielen-Knopf überlappte. */}
      <g transform={`rotate(-6 ${BB.x} ${BB.y})`}>
        {/* Schwungspuren hinter dem Rad. */}
        <g stroke="#ffffff" strokeOpacity={0.3} strokeWidth={4} strokeLinecap="round">
          <path d="M4 68 L38 65" />
          <path d="M0 84 L42 82" />
          <path d="M8 100 L46 99" />
        </g>

        {/* Hinterrad. */}
        <Rad mitte={RW} />
        {/* Vorderrad. */}
        <Rad mitte={FW} />

        {/* Doppelbrücken-Gabel: Standrohr, Brücke, Fahrwerksbein zum Rad —
            dasselbe Erkennungsmerkmal wie im Spiel. */}
        <line
          x1={HT.x}
          y1={HT.y}
          x2={LENKER_MITTE.x}
          y2={LENKER_MITTE.y}
          stroke="#c9ced6"
          strokeWidth={8}
          strokeLinecap="round"
        />
        <line
          x1={KRONE.x}
          y1={KRONE.y}
          x2={FW.x}
          y2={FW.y}
          stroke="#3d434d"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <line
          x1={KRONE.x - 17}
          y1={KRONE.y}
          x2={KRONE.x + 17}
          y2={KRONE.y + 3}
          stroke="#8c1710"
          strokeWidth={12}
          strokeLinecap="round"
        />

        {/* Rahmen — ein einziges, garantiert einfaches Dreieck. */}
        <path
          d={`M${BB.x},${BB.y} L${ST.x},${ST.y} L${HT.x},${HT.y} Z`}
          fill="#d92d20"
          stroke="#8c1710"
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {/* Teal-Akzentstreifen aufs Unterrohr — derselbe Farbtupfer wie im
            Spiel selbst, damit das Heldenbike zum neuen Look passt. */}
        <line
          x1={BB.x - 4}
          y1={BB.y - 6}
          x2={HT.x - 6}
          y2={HT.y + 5}
          stroke="#38d9a9"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Kettenstrebe und Sitzstrebe zum Hinterrad. */}
        <line x1={RW.x} y1={RW.y} x2={BB.x} y2={BB.y} stroke="#8c1710" strokeWidth={9} strokeLinecap="round" />
        <line x1={RW.x} y1={RW.y} x2={ST.x} y2={ST.y} stroke="#8c1710" strokeWidth={7} strokeLinecap="round" />

        {/* Sattel und Lenker. */}
        <line
          x1={ST.x - 14}
          y1={ST.y - 3}
          x2={ST.x + 8}
          y2={ST.y - 5}
          stroke="#101014"
          strokeWidth={8}
          strokeLinecap="round"
        />
        <line
          x1={LENKER_MITTE.x}
          y1={LENKER_MITTE.y}
          x2={GRIFF.x}
          y2={GRIFF.y}
          stroke="#101014"
          strokeWidth={7}
          strokeLinecap="round"
        />

        {/* Dämpfer mit Spiralfeder — dieselbe Wendel wie im Spiel, hier
            als vereinfachtes Zickzack, weil sie bei dieser Größe ohnehin
            nur als Textur wahrgenommen wird. */}
        <line
          x1={(BB.x + RW.x) / 2}
          y1={BB.y - 4}
          x2={ST.x - 6}
          y2={ST.y + 16}
          stroke="#3d434d"
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d={`M${(BB.x + RW.x) / 2 + 4},${BB.y - 6} L${(BB.x + RW.x) / 2 - 5},${BB.y - 16} L${(BB.x + RW.x) / 2 + 4},${BB.y - 26} L${ST.x - 10},${ST.y + 20}`}
          fill="none"
          stroke="#38d9a9"
          strokeWidth={3.5}
          strokeLinecap="round"
        />

        {/* --- Der Fahrer: Hüfte → Knie → Pedal, Hüfte → Schulter → Griff --- */}
        <g strokeLinecap="round" fill="none">
          <path
            d={`M${HUEFTE.x},${HUEFTE.y} L${KNIE.x},${KNIE.y} L${PEDAL.x},${PEDAL.y}`}
            stroke="#232830"
            strokeWidth={15}
          />
          <path
            d={`M${HUEFTE.x},${HUEFTE.y} L${SCHULTER.x},${SCHULTER.y}`}
            stroke="#4a5566"
            strokeWidth={20}
          />
          <path
            d={`M${SCHULTER.x},${SCHULTER.y} L${GRIFF.x},${GRIFF.y}`}
            stroke="#4a5566"
            strokeWidth={13}
          />
        </g>
        {/* Schuh. */}
        <ellipse cx={PEDAL.x + 8} cy={PEDAL.y - 2} rx={13} ry={7} fill="#15161b" />

        {/* Fullface-Helm mit rotem Streifen — derselbe Kontrast wie im
            Spiel: hell gegen die dunkle Kleidung. */}
        <circle cx={KOPF.x} cy={KOPF.y} r={16} fill="#f4f6f8" />
        <path
          d={`M${KOPF.x - 4},${KOPF.y - 15} Q${KOPF.x + 16},${KOPF.y - 17} ${KOPF.x + 20},${KOPF.y - 1} Q${KOPF.x + 8},${KOPF.y - 8} ${KOPF.x - 4},${KOPF.y - 5} Z`}
          fill="#d92d20"
        />
        <ellipse cx={KOPF.x + 8} cy={KOPF.y + 1} rx={8} ry={6} fill="#1e2a33" />
      </g>
    </svg>
  );
}

function Rad({ mitte }: { mitte: { x: number; y: number } }) {
  const speichen = [0, 60, 120, 180, 240, 300];
  return (
    <g>
      <circle cx={mitte.x} cy={mitte.y} r={32} fill="#16161a" />
      <circle cx={mitte.x} cy={mitte.y} r={32} fill="none" stroke="#26262c" strokeWidth={7} />
      {/* Seitenwand: ein schmaler, hellerer Ring — passend zum
          zweizeiligen Stollenprofil im eigentlichen Spiel. */}
      <circle cx={mitte.x} cy={mitte.y} r={27} fill="none" stroke="#3a3a44" strokeWidth={2} />
      <circle cx={mitte.x} cy={mitte.y} r={22} fill="none" stroke="#8d939e" strokeWidth={4} />
      <g stroke="#dfe3e9" strokeWidth={2} opacity={0.85}>
        {speichen.map((w) => (
          <line
            key={w}
            x1={mitte.x + Math.cos((w * Math.PI) / 180) * 6}
            y1={mitte.y + Math.sin((w * Math.PI) / 180) * 6}
            x2={mitte.x + Math.cos((w * Math.PI) / 180) * 21}
            y2={mitte.y + Math.sin((w * Math.PI) / 180) * 21}
          />
        ))}
      </g>
      <circle cx={mitte.x} cy={mitte.y} r={6.5} fill="#c3c8d0" />
    </g>
  );
}

export function FlowMtb({
  onScore,
  onGameOver,
  bestScore,
  istErsteRunde,
  settings,
}: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [zeigeHinweis, setZeigeHinweis] = useState(true);

  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const zeichnerRef = useRef<Zeichner | null>(null);

  /**
   * Der Lauf entsteht **beim ersten Zugriff**, nicht bei jedem Rendern —
   * `useRef(neuesSpiel(…))` würde sein Argument bei jedem Rendern auswerten
   * und das Ergebnis wegwerfen, und `neuesSpiel` baut ein komplettes
   * Gelände. Dieselbe Falle wie in Dash City.
   */
  const laufRef = useRef<Lauf | null>(null);
  const holeLauf = useCallback(() => {
    if (!laufRef.current) {
      // Jede Runde eine andere Strecke, aber innerhalb der Runde fest.
      laufRef.current = neuesSpiel(streckenSaat(Date.now() % 100000));
    }
    return laufRef.current;
  }, []);

  /** Die Eingaben. Auch in einer Ref — sie ändern sich mehrmals je Sekunde. */
  const eingabeRef = useRef<Eingabe>({ gas: false, bremse: false, lehnen: 0 });
  /** `onGameOver` darf genau einmal je Runde raus. */
  const beendet = useRef(false);

  // Anzeigen: direkt ins DOM, siehe Kopfkommentar.
  const tempoRef = useRef<HTMLSpanElement>(null);
  const zeitRef = useRef<HTMLSpanElement>(null);
  const balkenRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const trickRef = useRef<HTMLDivElement>(null);
  /** Bis zu welcher Laufzeit die Trick-Anzeige noch sichtbar bleibt. */
  const trickBisZeitRef = useRef(0);

  // --- Leinwand aufsetzen -----------------------------------------
  useEffect(() => {
    if (!gestartet) return;
    const leinwand = leinwandRef.current;
    if (!leinwand) return;

    const zeichner = zeichnerBauen(leinwand);
    zeichnerRef.current = zeichner;

    const messen = () => {
      const eltern = leinwand.parentElement;
      if (eltern) zeichner.groesseAendern(eltern.clientWidth, eltern.clientHeight);
    };
    messen();
    window.addEventListener('resize', messen);
    // Ein einzelnes Bild sofort zeichnen, damit nicht kurz eine leere
    // Fläche steht, bevor die Uhr das erste Mal tickt.
    zeichner.zeichnen(holeLauf(), 0);

    return () => {
      window.removeEventListener('resize', messen);
      zeichnerRef.current = null;
    };
  }, [gestartet, holeLauf]);

  // --- Tastatur ----------------------------------------------------
  useEffect(() => {
    if (!gestartet) return;

    const setzen = (code: string, an: boolean) => {
      const e = eingabeRef.current;
      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          e.gas = an;
          return true;
        case 'ArrowDown':
        case 'KeyS':
          e.bremse = an;
          return true;
        case 'ArrowRight':
        case 'KeyD':
          e.lehnen = an ? 1 : 0;
          return true;
        case 'ArrowLeft':
        case 'KeyA':
          e.lehnen = an ? -1 : 0;
          return true;
        default:
          return false;
      }
    };

    const runter = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.target instanceof Element && ev.target.closest('button, a[href], input')) return;
      if (setzen(ev.code, true)) {
        ev.preventDefault();
        setZeigeHinweis(false);
      }
    };
    const hoch = (ev: KeyboardEvent) => {
      if (setzen(ev.code, false)) ev.preventDefault();
    };

    window.addEventListener('keydown', runter, { passive: false });
    window.addEventListener('keyup', hoch, { passive: false });
    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
    };
  }, [gestartet]);

  // --- Die Uhr -----------------------------------------------------
  const lauf = laufRef.current;
  useGameLoop(
    (dt) => {
      const vorher = holeLauf();
      const neu = takt(vorher, dt, eingabeRef.current);
      laufRef.current = neu;

      // Rückmeldung bei einem Sturz — einmal, beim Wechsel. Ronni wollte
      // ausdrücklich keine Töne im Spiel („macht die Sounds weg"); Haptik
      // bleibt, das ist keine Tonausgabe und auf Florians Geräten (iOS)
      // ohnehin stumm, siehe `core/haptik.ts`.
      if (neu.letzteLandung !== vorher.letzteLandung && neu.letzteLandung === 'sturz') {
        haptik('ende');
      }

      zeichnerRef.current?.zeichnen(neu, dt);

      // --- Anzeigen ---
      if (tempoRef.current) tempoRef.current.textContent = String(Math.round(tempoKmh(neu)));
      if (zeitRef.current) zeitRef.current.textContent = neu.zeit.toFixed(1);
      if (balkenRef.current) {
        const anteil = Math.min(100, (neu.x / neu.gelaende.laenge) * 100);
        balkenRef.current.style.width = `${anteil.toFixed(1)}%`;
      }
      if (flowRef.current) {
        flowRef.current.style.opacity = neu.flow > 1 ? '1' : '0';
        flowRef.current.textContent = `FLOW ×${neu.flow}`;
      }
      /*
       * Trick-Anzeige: nur beim Wechsel auf eine gestandene Landung mit
       * mindestens einer vollen Drehung neu einblenden, dann `zeit`-
       * gesteuert wieder ausblenden — dieselbe Zeitsteuerung wie sonst
       * über `meldungRest`, hier aber direkt aus der Laufzeit, weil kein
       * eigenes Feld in `Lauf` für „Sekunden, die diese Anzeige noch
       * steht" gebraucht wird.
       */
      if (
        neu.letzteLandung !== vorher.letzteLandung &&
        neu.letzteLandung !== 'sturz' &&
        neu.letzterTrick > 0
      ) {
        trickBisZeitRef.current = neu.zeit + 1.6;
      }
      if (trickRef.current) {
        const sichtbar = neu.zeit < trickBisZeitRef.current;
        trickRef.current.style.opacity = sichtbar ? '1' : '0';
        if (sichtbar) {
          trickRef.current.textContent = `${neu.letzterTrick * 360}° +${neu.letzterTrick * TRICK_PUNKTE_JE_DREHUNG}`;
        }
      }
      /*
       * Bewusst **keine** Text-Einblendung „PERFEKT!" / „Harte Landung" /
       * „Gestürzt" mehr. Rückmeldung, wörtlich: „Ich will nicht, dass
       * dieses perfekt gut und harte Landung oder gestürzt dasteht, das
       * brauch ich auch nicht, es sieht nur doof aus." Der Flow-Zähler
       * oben rechts sagt ohnehin, wie sauber man landet — ein Wort quer
       * über dem Bild ist keine zusätzliche Auskunft, nur Lärm.
       */

      if (neu.vorbei && !beendet.current) {
        beendet.current = true;
        const p = punkte(neu);
        onScore(p);
        if (neu.gewonnen) {
          haptik('jubel');
        }
        /*
         * Kurz warten, bevor der Rundenende-Bildschirm kommt: Beim Sturz
         * soll man sehen, **dass** man gestürzt ist. Ein sofortiger
         * Wechsel liest sich wie ein Fehler des Spiels statt wie ein
         * eigener — dieselbe Überlegung wie beim Aufprall in Dash City.
         */
        window.setTimeout(() => onGameOver(p, neu.gewonnen), neu.gewonnen ? 700 : 1100);
      }
    },
    { fps: 60, running: gestartet && !(lauf?.vorbei && beendet.current) },
  );

  // Punktestand nach außen, zweimal je Sekunde.
  useEffect(() => {
    if (!gestartet) return;
    const uhr = window.setInterval(() => {
      const l = laufRef.current;
      if (l && !l.vorbei) onScore(punkte(l));
    }, 500);
    return () => window.clearInterval(uhr);
  }, [gestartet, onScore]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Flow MTB"
        untertitel="Gas geben, springen, sauber landen. In der Luft das Rad gerade halten."
        bestScore={bestScore}
        verlauf="linear-gradient(165deg, #0f2b40 0%, #1d4d5c 45%, #0b1a24 100%)"
        deko={DEKO}
        Symbol={MtbIcon}
        knopfFarbe="#0f2b40"
        onStart={() => setGestartet(true)}
      />
    );
  }

  /**
   * Ein Steuerknopf. Er hält, solange der Finger liegt.
   *
   * **`touch-none` steht hier zusätzlich zum übergeordneten Bereich noch
   * einmal direkt am Knopf.** Rückmeldung: „Ich kann nur eine Taste
   * drücken, dann geht Vorne/Hinten nicht mehr." Auf `buehneRef` (dem
   * ganzen Spielbereich) stand `touch-action: none` schon, aber manche
   * mobilen Browser — vor allem iOS Safari — werten das nicht zuverlässig
   * als vererbt: Setzt ein zweiter Finger auf einem ANDEREN Element auf,
   * während der erste noch hält, kann der Browser das als Beginn einer
   * Mehrfinger-Geste statt als eigenen, unabhängigen Tastendruck
   * einstufen — genau dann bleibt „Gas" gedrückt, aber „Vorne"/„Hinten"
   * reagiert nicht mehr. Jeder Knopf braucht `touch-action: none` **an
   * sich selbst**, nicht nur am Elternbereich, damit zwei Finger auf zwei
   * Knöpfen unabhängig voneinander erkannt werden.
   */
  const Knopf = ({
    kind,
    label,
    zeichen,
    setzen,
  }: {
    kind: string;
    label: string;
    zeichen: string;
    setzen: (an: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto touch-none flex size-16 select-none flex-col items-center justify-center rounded-2xl border border-white/25 bg-black/35 backdrop-blur-sm active:bg-white/25 ${kind}`}
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        setzen(true);
        setZeigeHinweis(false);
      }}
      onPointerUp={() => setzen(false)}
      onPointerCancel={() => setzen(false)}
      onPointerLeave={() => setzen(false)}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {zeichen}
      </span>
      <span className="mt-0.5 text-[10px] font-bold text-white/75">{label}</span>
    </button>
  );

  return (
    <div ref={buehneRef} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden">
      <canvas ref={leinwandRef} className="block size-full" />

      {/* Kopfzeile: Tempo, Zeit, Fortschritt */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="rounded-2xl bg-black/40 px-3 py-1.5 backdrop-blur-sm">
          <span
            ref={tempoRef}
            className="text-2xl leading-none font-black text-white tabular-nums"
          >
            0
          </span>
          <span className="ml-1 text-xs font-bold text-white/70">km/h</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="rounded-2xl bg-black/40 px-3 py-1.5 text-sm font-bold text-white tabular-nums backdrop-blur-sm">
            <span ref={zeitRef}>0.0</span>s
          </div>
          <div
            ref={flowRef}
            className="rounded-full bg-teal-400/25 px-2.5 py-1 text-xs font-black text-teal-200 transition-opacity duration-200"
            style={{ opacity: 0 }}
          >
            FLOW ×1
          </div>
          {/* Trick-Anzeige: eigene Farbe (Pink) statt Teal, damit sie sich
              von der Flow-Anzeige direkt darüber klar unterscheidet. */}
          <div
            ref={trickRef}
            className="rounded-full bg-pink-400/25 px-2.5 py-1 text-xs font-black text-pink-200 transition-opacity duration-200"
            style={{ opacity: 0 }}
          >
            360° +200
          </div>
        </div>
      </div>

      {/* Streckenfortschritt unten */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/45">
          <div
            ref={balkenRef}
            className="h-full rounded-full bg-gradient-to-r from-teal-300 to-emerald-400"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* Steuerung: links Gewicht, rechts Antrieb — genau wie gewünscht */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex items-end justify-between px-4">
        <div className="flex gap-2">
          <Knopf
            kind=""
            label="Hinten"
            zeichen="↺"
            setzen={(an) => (eingabeRef.current.lehnen = an ? -1 : 0)}
          />
          <Knopf
            kind=""
            label="Vorne"
            zeichen="↻"
            setzen={(an) => (eingabeRef.current.lehnen = an ? 1 : 0)}
          />
        </div>
        <div className="flex gap-2">
          <Knopf
            kind=""
            label="Bremse"
            zeichen="⊘"
            setzen={(an) => (eingabeRef.current.bremse = an)}
          />
          <Knopf
            kind="bg-teal-500/35"
            label="Gas"
            zeichen="▶"
            setzen={(an) => (eingabeRef.current.gas = an)}
          />
        </div>
      </div>

      {/* Der Hinweis verschwindet mit der ersten Eingabe. */}
      {zeigeHinweis && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] grid place-items-center px-6">
          <div className="rounded-2xl bg-black/60 px-5 py-4 text-center backdrop-blur-sm">
            <p className="text-base font-black text-white">So geht&apos;s</p>
            <ul className="mt-2 space-y-1 text-sm text-white/90">
              <li>
                <span aria-hidden="true">▶</span> Gas geben und Schwung holen
              </li>
              <li>
                <span aria-hidden="true">↺↻</span> In der Luft das Rad gerade halten
              </li>
              <li>Beide Räder zugleich aufsetzen = perfekt</li>
            </ul>
            <p className="mt-2 text-xs text-white/60">
              {settings.reducedMotion ? 'Pfeiltasten gehen auch' : 'Pfeiltasten oder WASD gehen auch'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export { STRECKE_LAENGE };
