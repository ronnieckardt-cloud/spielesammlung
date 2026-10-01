import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { useGameLoop } from '../../core/useGameLoop';
import { haptik } from '../../core/haptik';
import type { GameProps } from '../../core/types';
import {
  MISSION_NAMEN,
  POP_FENSTER,
  STRECKE_LAENGE,
  TEMPO_MAX,
  TRICK_PUNKTE_JE_DREHUNG,
  bodenHoehe,
  bodenWinkel,
  missionFortschritt,
  missionsLohn,
  neuesSpiel,
  punkte,
  streckenSaat,
  takt,
  tempoKmh,
} from './logik';
import type { Eingabe, Lauf } from './logik';
import type { Zeichner } from './zeichnen';
import { heldenbildZeichnen, zeichnerBauen } from './zeichnen';

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

/**
 * Das Titelbild ist der echte Fahrer auf dem echten Rad — dieselbe Zeichnung
 * wie im Spiel (`heldenbildZeichnen`). Rückmeldung zu einer früheren Fassung:
 * „Allein schon das Titelding sieht kacke aus." Ein grobes Poster, das anders
 * aussieht als das Spiel, war der Kern davon.
 */
function HeldenSymbol(_: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) heldenbildZeichnen(ref.current, 250, 200);
  }, []);
  // Steht anstelle des App-Symbols über dem Titel — es ist die Hauptfigur des
  // Bildschirms, nicht Deko im Hintergrund. Als Deko lag der Spielen-Knopf
  // über dem Kopf des Fahrers.
  return <canvas ref={ref} aria-hidden="true" className="relative drop-shadow-[0_14px_22px_rgba(0,0,0,0.35)]" />;
}

/** Eine kleine Münze als Schmuck — dieselbe Prägung wie im Spiel, ohne Drehung. */
function DekoMuenze({ gross }: { gross: number }) {
  return (
    <svg viewBox="0 0 40 40" style={{ width: gross, height: gross }}>
      <circle cx="20" cy="20" r="17" fill="#ffc933" stroke="#8a5206" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="12" fill="none" stroke="#fff3b0" strokeWidth="1.6" opacity="0.8" />
      <path
        d="M20 11 L22.6 17 L29 17.4 L24 21.6 L25.7 28 L20 24.4 L14.3 28 L16 21.6 L11 17.4 L17.4 17 Z"
        fill="#935606"
        opacity="0.85"
      />
      <ellipse cx="14" cy="12.5" rx="4" ry="2" fill="#fff" opacity="0.7" transform="rotate(-35 14 12.5)" />
    </svg>
  );
}

/** Drei Pfeile wie die Absprungmarken auf der Strecke. */
function DekoPfeile({ farbe }: { farbe: string }) {
  return (
    <svg viewBox="0 0 48 24" className="w-12" fill="none" stroke={farbe} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4 L14 12 L6 20" />
      <path d="M20 4 L28 12 L20 20" opacity="0.75" />
      <path d="M34 4 L42 12 L34 20" opacity="0.5" />
    </svg>
  );
}

const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 12, winkel: -8, verzoegerung: 0, inhalt: <DekoMuenze gross={34} /> },
  { x: 86, y: 9, winkel: 10, verzoegerung: 0.6, inhalt: <DekoMuenze gross={44} /> },
  { x: 90, y: 34, winkel: -6, verzoegerung: 1.3, inhalt: <DekoMuenze gross={28} /> },
  { x: 4, y: 36, winkel: 8, verzoegerung: 0.9, inhalt: <DekoPfeile farbe="#ffc233" /> },
  { x: 74, y: 24, winkel: 0, verzoegerung: 0.3, inhalt: <DekoPfeile farbe="#7cf1ff" /> },
];

/**
 * Ein Steuerknopf. Er hält, solange der Finger liegt.
 *
 * **Auf Modulebene, nicht in `FlowMtb`.** Als Funktion innerhalb der
 * Komponente wäre `Knopf` bei jedem Rendern ein neuer Komponententyp, und
 * React hängt dann die Knöpfe neu ein. Weil der Punktestand zweimal je
 * Sekunde nach außen geht und die Hülle dabei neu rendert, wäre jeder
 * Knopf zweimal je Sekunde ausgetauscht worden — mitten im Halten, ohne dass
 * je ein `pointerup` am neuen Knopf ankäme. Das Rad blieb dann „gelehnt".
 *
 * **`touch-none` steht hier zusätzlich zum übergeordneten Bereich noch
 * einmal direkt am Knopf.** Rückmeldung: „Ich kann nur eine Taste
 * drücken, dann geht Vorne/Hinten nicht mehr." Auf iOS Safari wird
 * `touch-action: none` nicht zuverlässig vererbt: Setzt ein zweiter Finger
 * auf einem ANDEREN Element auf, während der erste noch hält, kann der
 * Browser das als Mehrfinger-Geste einstufen.
 */
type KnopfFarbe = 'bernstein' | 'tuerkis' | 'rot';
const KNOPF_STIL: Record<KnopfFarbe, { grund: string; rand: string }> = {
  bernstein: {
    grund: 'linear-gradient(160deg, rgba(251,191,36,0.5), rgba(180,83,9,0.55))',
    rand: 'rgba(253,224,71,0.65)',
  },
  tuerkis: {
    grund: 'linear-gradient(160deg, rgba(45,212,191,0.5), rgba(15,118,110,0.55))',
    rand: 'rgba(94,234,212,0.65)',
  },
  rot: {
    grund: 'linear-gradient(160deg, rgba(248,113,113,0.5), rgba(153,27,27,0.55))',
    rand: 'rgba(252,165,165,0.6)',
  },
};

function Knopf({
  label,
  zeichen,
  farbe,
  setzen,
  beiDruck,
  knopfRef,
}: {
  label: string;
  zeichen: ReactNode;
  farbe: KnopfFarbe;
  setzen: (an: boolean) => void;
  beiDruck: () => void;
  /** Für das Leuchten, wenn die Tipp-Zone offen ist — es wird direkt gesetzt, ohne React. */
  knopfRef?: Ref<HTMLButtonElement>;
}) {
  const stil = KNOPF_STIL[farbe];
  return (
    <button
      ref={knopfRef}
      type="button"
      aria-label={label}
      className="pointer-events-auto flex size-[4.25rem] touch-none flex-col items-center justify-center rounded-2xl border backdrop-blur-sm select-none transition-transform duration-100 active:scale-95 active:brightness-125"
      style={{ background: stil.grund, borderColor: stil.rand, boxShadow: '0 6px 14px rgba(0,0,0,0.3)' }}
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        setzen(true);
        beiDruck();
      }}
      onPointerUp={() => setzen(false)}
      onPointerCancel={() => setzen(false)}
      onPointerLeave={() => setzen(false)}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      <span aria-hidden="true" className="text-2xl leading-none text-white">
        {zeichen}
      </span>
      <span className="mt-0.5 text-[10px] font-bold text-white/85">{label}</span>
    </button>
  );
}

/** Eine Zeile der Anleitung: ein Farbzeichen, ein Satz. */
function HinweisZeile({ zeichen, children }: { zeichen: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-left text-[13px] leading-snug text-white/90">
      <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center">
        {zeichen}
      </span>
      <span>{children}</span>
    </p>
  );
}

const ANZAHL_MISSIONEN = 3;

export function FlowMtb({
  onScore,
  onGameOver,
  bestScore,
  istErsteRunde,
  settings,
}: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [zeigeHinweis, setZeigeHinweis] = useState(true);
  /**
   * Die Uhr läuft nach dem Aus noch ein paar Sekunden weiter. Vorher hielt sie
   * mit dem ersten erneuten Rendern nach `vorbei` an (der Punktestand geht an
   * die Hülle und löst es aus) — der Sturz stand dadurch im ersten Bild still,
   * und das Ausrutschen und Liegenbleiben war nie zu sehen.
   */
  const [ausgelaufen, setAusgelaufen] = useState(false);

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
      let neu = neuesSpiel(streckenSaat(Date.now() % 100000));
      // Nur für Bildschirmfotos am Rechner (auf einem echten Gerät nie gesetzt):
      // setzt das Rad vor eine Lücke, mit Höchsttempo.
      const hilfe = (globalThis as { __mtbStart?: { luecke: number; anlauf: number; halt?: boolean } }).__mtbStart;
      const l = hilfe ? neu.gelaende.luecken[hilfe.luecke] : undefined;
      if (hilfe && l) {
        const x = l.x0 - hilfe.anlauf;
        neu = { ...neu, x, y: bodenHoehe(neu.gelaende, x), vx: TEMPO_MAX, winkel: bodenWinkel(neu.gelaende, x) };
      }
      laufRef.current = neu;
    }
    return laufRef.current;
  }, []);

  /*
   * Die Eingaben. Auch in einer Ref — sie ändern sich mehrmals je Sekunde.
   *
   * **`gas` startet auf `true` und bleibt es — kein Knopf dafür mehr.**
   * Rückmeldung: „Wenn ich Gas drücke, kann ich nicht zur gleichen Zeit
   * auch nach hinten oder vorne lehnen. Das funktioniert nicht … vielleicht,
   * dass es automatisch fährt." Der Multitouch-Fix an den Knöpfen (siehe
   * `Knopf` unten) reicht auf manchen Geräten offenbar nicht — zwei
   * gleichzeitige Finger sind ohnehin ein hohes Risiko für genau diese Art
   * Bug, egal wie sorgfältig man sie behandelt. Die robustere Lösung ist,
   * das Problem gar nicht erst entstehen zu lassen: Fahren ist ab jetzt
   * kein Knopf mehr, sondern der Grundzustand. Übrig bleibt genau eine
   * Sache, die während der Fahrt gleichzeitig gebraucht wird — Lehnen —,
   * und die braucht nur einen Finger. Bremsen bleibt als zweite, bewusst
   * seltene Aktion erhalten (siehe unten), für die man ohnehin kurz nicht
   * lehnt.
   */
  const eingabeRef = useRef<Eingabe>({ gas: true, bremse: false, lehnen: 0 });
  /**
   * Wohin `lehnen` gerade will — Taste/Knopf schreiben nur hierhin, nie
   * direkt in `eingabeRef`. `lehnen` selbst nähert sich dem Ziel jedes
   * Bild ein Stück an (siehe die Uhr unten), statt beim Loslassen/Drücken
   * sofort auf −1/0/1 zu springen. Ohne die Rampe fühlt sich Steuern wie
   * ein Schalter an: entweder volle Auslenkung oder gar keine, mit nichts
   * dazwischen — bei rein binärer Tasten-/Knopf-Eingabe (siehe unten,
   * `lehnen` ist im ganzen Spiel nie ein Analogwert) ist das der einzige
   * Hebel, um die Steuerung weicher wirken zu lassen, ohne die Physik
   * selbst anzufassen: `takt()` bekommt weiterhin nur eine Zahl zwischen
   * −1 und 1, egal ob sie von einer Taste oder von hier kommt.
   */
  const lehnenZielRef = useRef(0);
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
  const tempoKapselRef = useRef<HTMLDivElement>(null);
  const muenzKapselRef = useRef<HTMLDivElement>(null);
  const muenzRef = useRef<HTMLSpanElement>(null);
  const missionNameRef = useRef<(HTMLSpanElement | null)[]>([]);
  const missionBalkenRef = useRef<(HTMLDivElement | null)[]>([]);
  const meldungRef = useRef<HTMLDivElement>(null);
  /** Bis zu welcher Laufzeit die „Aufgabe geschafft"-Meldung steht. */
  const meldungBisZeitRef = useRef(0);
  const boostAktivRef = useRef(false);
  const hintenKnopfRef = useRef<HTMLButtonElement>(null);
  /** Ob die Tipp-Zone gerade offen ist und der Knopf leuchtet. */
  const popOffenRef = useRef(false);
  /**
   * Hält ein Antippen fest, bis die Uhr es gesehen hat. Ein Finger, der binnen eines
   * Bildes (16 ms) wieder abhebt, wäre sonst für die Physik nie dagewesen — und
   * ausgerechnet das schnelle, entschlossene Tippen an der Kante ist das, was der
   * Pop belohnen soll.
   */
  const hintenMerkerRef = useRef(false);
  /** `settings` für die Anzeige-Funktion, ohne sie bei jeder Änderung neu zu bauen. */
  const reduziertRef = useRef(settings.reducedMotion);
  reduziertRef.current = settings.reducedMotion;

  /**
   * Schreibt den Stand in die Anzeigen — direkt ins DOM, ohne React. Wird
   * nach jedem Bild gerufen und einmal beim Aufbau, damit die Aufgaben schon
   * im ersten Bild dastehen.
   */
  const anzeigen = useCallback((neu: Lauf, vorher: Lauf) => {
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

    // Münzen: die Zahl, und ein kurzes Aufploppen beim Einsammeln.
    if (muenzRef.current) muenzRef.current.textContent = String(neu.muenzenZahl);
    if (neu.muenzenZahl > vorher.muenzenZahl && !reduziertRef.current) {
      muenzKapselRef.current?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
        { duration: 170, easing: 'ease-out' },
      );
    }

    /*
     * Die Tipp-Zone ist offen: Eine Absprungmarke liegt voraus, und bis dahin
     * bleibt weniger Zeit als das Fenster des Pop. Der Knopf „Hinten" leuchtet
     * dann — wer den Finger darauf hat, sieht es, ohne hinzuschauen. Die Zone
     * am Boden zeigt dasselbe (siehe `absprungMarken`); das Leuchten ist die
     * Zugabe, nicht der einzige Hinweis.
     */
    const marke = neu.amBoden && !neu.popGenommen && neu.vx > 2
      ? neu.gelaende.absprung.find((a) => a > neu.x - 0.1 && a - neu.x <= neu.vx * POP_FENSTER)
      : undefined;
    const offen = marke !== undefined;
    if (offen !== popOffenRef.current && hintenKnopfRef.current) {
      popOffenRef.current = offen;
      const k = hintenKnopfRef.current;
      k.style.boxShadow = offen
        ? '0 0 0 3px rgba(255,226,120,0.95), 0 0 26px rgba(255,200,60,0.85)'
        : '0 6px 14px rgba(0,0,0,0.3)';
      k.style.transform = offen ? 'scale(1.07)' : '';
    }

    // Boost: Das Tempofeld bekommt einen türkisen Schein, solange er wirkt.
    const boost = neu.boost > 0;
    if (boost !== boostAktivRef.current && tempoKapselRef.current) {
      boostAktivRef.current = boost;
      tempoKapselRef.current.style.boxShadow = boost
        ? '0 0 0 1.5px rgba(124,241,255,0.8), 0 0 20px rgba(80,225,255,0.55)'
        : '';
    }

    // Aufgaben: Text und Fortschritt je Zeile. Der Text wird nur geschrieben,
    // wenn er sich ändert — bei sechzig Bildern je Sekunde sonst ein
    // sinnloser DOM-Zugriff.
    for (let i = 0; i < ANZAHL_MISSIONEN; i++) {
      const m = neu.missionen[i];
      const name = missionNameRef.current[i];
      const balken = missionBalkenRef.current[i];
      if (!m || !name || !balken) continue;
      const text = MISSION_NAMEN[m.art](m.ziel);
      if (name.dataset['t'] !== text) {
        name.dataset['t'] = text;
        name.textContent = text;
      }
      const anteil = Math.max(0, Math.min(1, missionFortschritt(neu, m) / m.ziel));
      balken.style.width = `${(anteil * 100).toFixed(0)}%`;
    }
    // Eine geschaffte Aufgabe meldet sich kurz oben in der Mitte.
    if (neu.missionZahl > vorher.missionZahl && meldungRef.current) {
      meldungRef.current.textContent = `Aufgabe geschafft  +${missionsLohn(neu.missionZahl - 1)}`;
      meldungBisZeitRef.current = neu.zeit + 2.4;
    }
    if (meldungRef.current) {
      const sichtbar = neu.zeit < meldungBisZeitRef.current;
      meldungRef.current.style.opacity = sichtbar ? '1' : '0';
      meldungRef.current.style.transform = sichtbar ? 'translateY(0)' : 'translateY(-8px)';
    }

    /*
     * Trick-Anzeige: nur beim Wechsel auf eine gestandene Landung mit
     * mindestens einer vollen Drehung neu einblenden, dann `zeit`-
     * gesteuert wieder ausblenden — direkt aus der Laufzeit, weil kein
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
  }, []);

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
    anzeigen(holeLauf(), holeLauf());

    return () => {
      window.removeEventListener('resize', messen);
      zeichnerRef.current = null;
    };
  }, [gestartet, holeLauf, anzeigen]);

  // --- Tastatur ----------------------------------------------------
  useEffect(() => {
    if (!gestartet) return;

    const setzen = (code: string, an: boolean) => {
      const e = eingabeRef.current;
      switch (code) {
        case 'ArrowDown':
        case 'KeyS':
          e.bremse = an;
          return true;
        case 'ArrowRight':
        case 'KeyD':
          lehnenZielRef.current = an ? 1 : 0;
          return true;
        case 'ArrowLeft':
        case 'KeyA':
          lehnenZielRef.current = an ? -1 : 0;
          if (an) hintenMerkerRef.current = true;
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
  useGameLoop(
    (dt) => {
      /*
       * `lehnen` der Rampe entlang ans Ziel heranführen, bevor die Physik
       * es sieht — siehe `lehnenZielRef` oben. `RAMPZEIT` ist die Zeit für
       * die volle Auslenkung (0 → 1); von −1 auf 1 dauert es entsprechend
       * doppelt so lang. `takt()` bekommt dadurch nie einen Sprung,
       * sondern eine Zahl, die sich stetig bewegt — dieselbe Eingabeform,
       * die der Fairness-Bot in `logik.test.ts` schon immer nutzt.
       */
      const RAMPZEIT = 0.1;
      const e = eingabeRef.current;
      const ziel = lehnenZielRef.current;
      const differenz = ziel - e.lehnen;
      const maxSchritt = (dt / RAMPZEIT) || 0;
      e.lehnen =
        Math.abs(differenz) <= maxSchritt ? ziel : e.lehnen + Math.sign(differenz) * maxSchritt;

      // Der rohe Druck für den Pop: gedrückt oder seit dem letzten Bild angetippt.
      e.hinten = ziel < 0 || hintenMerkerRef.current;
      hintenMerkerRef.current = false;

      const vorher = holeLauf();
      const neu = takt(vorher, dt, eingabeRef.current);
      laufRef.current = neu;

      /*
       * Rückmeldung bei jeder Landung — einmal, beim Wechsel, genau wie
       * beim Sturz. Ronni wollte ausdrücklich keine Töne im Spiel („macht
       * die Sounds weg"); Haptik bleibt, das ist keine Tonausgabe und auf
       * Florians Geräten (iOS) ohnehin stumm, siehe `core/haptik.ts`.
       * `perfekt`/`gut`/`hart` sind dort bewusst als eigene, kurze
       * Anlässe angelegt — landungsstark genug für ein spürbares
       * Feedback, aber kurz genug, dass eine Kicker-Kette mit mehreren
       * Landungen hintereinander nicht wie ein Alarm wirkt.
       */
      if (neu.letzteLandung !== vorher.letzteLandung && neu.letzteLandung !== null) {
        haptik(neu.letzteLandung === 'sturz' ? 'ende' : neu.letzteLandung);
      }

      zeichnerRef.current?.zeichnen(neu, dt);

      anzeigen(neu, vorher);

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
        // Hinter dem Rundenende-Dialog muss nichts mehr gezeichnet werden.
        window.setTimeout(() => setAusgelaufen(true), 3500);
      }
    },
    {
      fps: 60,
      // `halt` ist nur für Bildschirmfotos: Die Szene bleibt nach dem ersten Bild stehen.
      running:
        gestartet &&
        !ausgelaufen &&
        !(globalThis as { __mtbStart?: { halt?: boolean } }).__mtbStart?.halt,
    },
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
        untertitel="Du fährst automatisch los. Springen, sauber landen, in der Luft das Rad gerade halten."
        bestScore={bestScore}
        verlauf="linear-gradient(165deg, #0f2b40 0%, #1d4d5c 45%, #0b1a24 100%)"
        deko={DEKO}
        Symbol={HeldenSymbol}
        knopfFarbe="#0f2b40"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const hinweisWeg = () => setZeigeHinweis(false);

  /** Eine Glasfläche für die Anzeigen — dieselbe Machart überall, sonst wirkt es zusammengestückelt. */
  const glas = 'rounded-2xl border border-white/15 bg-black/35 shadow-lg backdrop-blur-md';

  return (
    <div ref={buehneRef} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden">
      <canvas ref={leinwandRef} className="block size-full" />

      {/* Oben links: Tempo, Münzen und die drei laufenden Aufgaben. */}
      <div className="pointer-events-none absolute top-0 left-0 flex flex-col items-start gap-1.5 p-3">
        <div ref={tempoKapselRef} className={`${glas} px-3 py-1.5 transition-shadow duration-300`}>
          <span ref={tempoRef} className="text-2xl leading-none font-black text-white tabular-nums">
            0
          </span>
          <span className="ml-1 text-xs font-bold text-white/70">km/h</span>
        </div>
        <div ref={muenzKapselRef} className={`${glas} flex items-center gap-1.5 px-2.5 py-1`}>
          <svg viewBox="0 0 40 40" className="size-5" aria-hidden="true">
            <circle cx="20" cy="20" r="17" fill="#ffc933" stroke="#8a5206" strokeWidth="3" />
            <circle cx="20" cy="20" r="11.5" fill="none" stroke="#fff3b0" strokeWidth="2" opacity="0.8" />
          </svg>
          <span ref={muenzRef} className="text-base leading-none font-black text-amber-200 tabular-nums">
            0
          </span>
          <span className="sr-only">Münzen</span>
        </div>
        {/*
         * Die drei Aufgaben. Klein und blass, solange sie nicht dran sind —
         * sie sind ein Ziel neben dem Fahren, kein zweites Spiel. Eine
         * geschaffte Aufgabe wird sofort durch eine neue ersetzt; der Balken
         * zeigt, wie weit man ist.
         */}
        <ul className="mt-0.5 flex w-44 flex-col gap-1" aria-label="Aufgaben">
          {Array.from({ length: ANZAHL_MISSIONEN }, (_, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1 backdrop-blur-sm">
              <span
                ref={(el) => {
                  missionNameRef.current[i] = el;
                }}
                className="block truncate text-[11px] leading-tight font-semibold text-white/90"
              />
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  ref={(el) => {
                    missionBalkenRef.current[i] = el;
                  }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400"
                  style={{ width: '0%' }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Oben rechts: Zeit, Flow, Trick. */}
      <div className="pointer-events-none absolute top-0 right-0 flex flex-col items-end gap-1.5 p-3">
        <div className={`${glas} px-3 py-1.5 text-sm font-bold text-white tabular-nums`}>
          <span ref={zeitRef}>0.0</span>s
        </div>
        {/* Die einzige laufende Rückmeldung zur Landungsqualität, seit die
            Text-Einblendungen „PERFEKT!" usw. ausdrücklich raus sind. */}
        <div
          ref={flowRef}
          className="rounded-full border border-teal-300/50 bg-teal-400/35 px-3 py-1 text-sm font-black text-teal-100 shadow-lg backdrop-blur-md transition-opacity duration-200"
          style={{ opacity: 0 }}
        >
          FLOW ×1
        </div>
        {/* Eigene Farbe (Pink), damit sie sich von der Flow-Anzeige direkt
            darüber klar unterscheidet. */}
        <div
          ref={trickRef}
          className="rounded-full border border-pink-300/40 bg-pink-400/30 px-2.5 py-1 text-xs font-black text-pink-100 backdrop-blur-md transition-opacity duration-200"
          style={{ opacity: 0 }}
        >
          360° +200
        </div>
      </div>

      {/* Oben in der Mitte: eine geschaffte Aufgabe, kurz. */}
      <div className="pointer-events-none absolute inset-x-0 top-14 grid place-items-center px-6">
        <div
          ref={meldungRef}
          role="status"
          className="rounded-full border border-amber-200/60 bg-amber-400/90 px-4 py-1.5 text-sm font-black text-amber-950 shadow-xl transition-[opacity,transform] duration-300"
          style={{ opacity: 0, transform: 'translateY(-8px)' }}
        />
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

      {/*
       * Steuerung: links Gewicht, rechts Bremse. **Kein Gas-Knopf** — Fahren
       * ist der Grundzustand, siehe `eingabeRef` oben. Während der Fahrt
       * gleichzeitig gebraucht wird nur noch Lehnen, und das braucht einen
       * Finger. Die Bremse bleibt rechts: Man bremst nie **und** lehnt im
       * selben Moment absichtlich.
       *
       * Die Farben tragen eine Bedeutung: Bernstein (Hinten) ist dieselbe
       * Farbe wie die Absprungmarken auf der Strecke — dort wird es gebraucht,
       * für den Pop. Türkis (Vorne) ist die Farbe des Fahrers, Rot die Bremse.
       */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex items-end justify-between px-4">
        <div className="flex gap-2">
          <Knopf
            label="Hinten"
            zeichen="↺"
            farbe="bernstein"
            knopfRef={hintenKnopfRef}
            setzen={(an) => (lehnenZielRef.current = an ? -1 : 0)}
            beiDruck={() => {
              hintenMerkerRef.current = true;
              hinweisWeg();
            }}
          />
          <Knopf
            label="Vorne"
            zeichen="↻"
            farbe="tuerkis"
            setzen={(an) => (lehnenZielRef.current = an ? 1 : 0)}
            beiDruck={hinweisWeg}
          />
        </div>
        <Knopf
          label="Bremse"
          zeichen="⊘"
          farbe="rot"
          setzen={(an) => (eingabeRef.current.bremse = an)}
          beiDruck={hinweisWeg}
        />
      </div>

      {/* Die Anleitung verschwindet mit der ersten Eingabe. */}
      {zeigeHinweis && (
        <div className="pointer-events-none absolute inset-x-0 top-[37%] grid place-items-center px-6">
          <div className="flex max-w-xs flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/55 px-4 py-3 backdrop-blur-md">
            <p className="text-center text-base font-black text-white">So geht&apos;s</p>
            <HinweisZeile
              zeichen={
                <span className="text-lg font-black text-white">
                  ↺<span className="text-teal-300">↻</span>
                </span>
              }
            >
              In der Luft das Rad gerade halten, beide Räder zugleich landen.
            </HinweisZeile>
            <HinweisZeile zeichen={<span className="text-lg font-black text-amber-300">›››</span>}>
              Gelbes Band vor der Kante: <b>Hinten</b> antippen = Pop. Ohne Pop kommst du über keine Lücke.
            </HinweisZeile>
            <HinweisZeile zeichen={<span className="block size-4 rounded-full bg-amber-300 ring-2 ring-amber-700" />}>
              Münzen sammeln, türkise Streifen = Schub.
            </HinweisZeile>
            <p className="text-center text-xs text-white/60">
              {settings.reducedMotion ? 'Pfeiltasten gehen auch' : 'Pfeiltasten oder WASD gehen auch'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export { STRECKE_LAENGE };
