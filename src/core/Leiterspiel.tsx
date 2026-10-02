import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FC, ReactNode } from 'react';
import { haptik } from './haptik';
import { JOKER_ARTEN, PREISE, SICHERE_STUFEN, STUFEN, aufhoeren, aufloesen, darfAufhoeren, einloggen, jokerFrei, jokerNutzen, markieren, neueRunde, punkte, schwereAnStufe, sicherJetzt, weiter } from './leiter';
import type { AnrufUrteil, JokerArt, LeiterFrage, Zustand } from './leiter';
import type { Levelstand } from './levelstand';
import { Punktegewinn, usePunktegewinn } from './Punktegewinn';
import { sfx } from './sfx';
import { Startbildschirm } from './Startbildschirm';
import type { DekoTeil } from './Startbildschirm';
import type { GameProps } from './types';

/**
 * Die Oberfläche der Gewinnleiter — der Umschlag, den Quiz Time und Word Play gemeinsam benutzen.
 *
 * Die Regeln stehen in `leiter.ts` (rein, ohne Uhr). Hier steht nur, was man sieht und tippt:
 *
 * - **Antworten werden erst markiert, dann bestätigt.** Auf einem Touchscreen trifft man leicht
 *   daneben, und bei einem Spiel, in dem ein Fehler Punkte kostet, wäre jede Fehlberührung endgültig.
 *   Der zweite Schritt ist außerdem der Moment, auf den die Sendung ihre Spannung baut.
 * - **Die Auflösung wartet einen Augenblick** (`AUFLOESEN_MS`). Die Wartezeit ist ein Zeitgeber der
 *   Anzeige; die Logik kennt keine Uhr.
 * - **Meldungen stehen über dem Spielfeld oder in der Mitte, nie auf den Antworten.** Dieselbe
 *   Lehre wie bei Merge Up: Ein Schild über den Antworten verdeckt genau das, worüber man gerade
 *   nachdenkt.
 */

/** Wie lange die gegebene Antwort leuchtet, bevor das Ergebnis erscheint. */
const AUFLOESEN_MS = 1500;
const AUFLOESEN_RUHIG_MS = 500;

export type LeiterStil = {
  /** Hintergrund der Spielseite, als fertiger CSS-Wert. */
  buehne: string;
  /** Die Hervorhebungsfarbe: markierte Antwort, Rahmen, Knöpfe. */
  akzent: string;
  /** Eine dunkle Fassung davon für Flächen. */
  akzentDunkel: string;
  /** Fläche von Frage und Antworten. */
  flaeche: string;
};

const ZAHL = new Intl.NumberFormat('de-DE');
const zahl = (n: number) => ZAHL.format(n);

const BUCHSTABEN = ['A', 'B', 'C', 'D'] as const;

const RICHTIG = '#16a34a';
const FALSCH = '#dc2626';

export type LeiterspielProps = GameProps & {
  /** Die id des Spiels — daraus wird die Saat der Runde. */
  spiel: string;
  titel: string;
  untertitel: string;
  Symbol: FC<{ className?: string }>;
  deko: readonly DekoTeil[];
  /** Hintergrundverlauf des Startbildschirms. */
  verlauf: string;
  knopfFarbe: string;
  stil: LeiterStil;
  /** Die fünfzehn Fragen eines Levels. Gleiches Level muss überall dieselben ergeben (Duell). */
  fragenFuerLevel: (level: number) => readonly LeiterFrage[];
  /** Hält die Levelnummer für die Sitzung, siehe `core/levelstand.ts`. */
  levelStand: Levelstand;
};

/* --- kleine Bausteine ---------------------------------------------------------------------------- */

function JokerSymbol({ art }: { art: JokerArt }) {
  const gemeinsam = { viewBox: '0 0 24 24', className: 'size-6', 'aria-hidden': true } as const;
  if (art === 'halb') {
    return (
      <svg {...gemeinsam}>
        <text x="12" y="9.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="currentColor">50</text>
        <path d="M5 12.2h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <text x="12" y="20.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="currentColor">50</text>
      </svg>
    );
  }
  if (art === 'publikum') {
    return (
      <svg {...gemeinsam} fill="currentColor">
        <circle cx="12" cy="8" r="3" />
        <path d="M6.5 19c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5z" />
        <circle cx="5.2" cy="10.2" r="2" opacity="0.75" />
        <circle cx="18.8" cy="10.2" r="2" opacity="0.75" />
        <path d="M1.5 18c0-2.3 1.5-4 3.7-4 .8 0 1.5.2 2.1.6-1 1-1.5 2.1-1.7 3.4z" opacity="0.75" />
        <path d="M22.5 18c0-2.3-1.5-4-3.7-4-.8 0-1.5.2-2.1.6 1 1 1.5 2.1 1.7 3.4z" opacity="0.75" />
      </svg>
    );
  }
  return (
    <svg {...gemeinsam} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4.5h3l1.5 4-2 1.4a10 10 0 0 0 4.6 4.6l1.4-2 4 1.5v3a2 2 0 0 1-2 2A13.5 13.5 0 0 1 3.5 6.5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

const JOKER_NAME: Record<JokerArt, string> = { halb: '50:50', publikum: 'Publikum', anruf: 'Anruf' };

function Knopf({
  beschriftung,
  symbol,
  onClick,
  deaktiviert,
  durchgestrichen = false,
  akzent,
  hinweis,
}: {
  beschriftung: string;
  symbol: ReactNode;
  onClick: () => void;
  deaktiviert: boolean;
  durchgestrichen?: boolean;
  akzent: string;
  hinweis?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deaktiviert}
      aria-label={hinweis ?? beschriftung}
      // `touch-none`: Ein verrutschender Daumen soll nichts markieren oder scrollen.
      className="flex min-h-14 min-w-0 flex-1 touch-none flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-1 text-[11px] leading-none font-bold transition-[opacity,transform] duration-100 select-none enabled:active:scale-95 disabled:cursor-default"
      style={{
        borderColor: deaktiviert ? 'rgba(255,255,255,0.12)' : akzent,
        color: deaktiviert ? 'rgba(255,255,255,0.4)' : akzent,
        backgroundColor: 'rgba(255,255,255,0.05)',
        opacity: deaktiviert ? 0.55 : 1,
      }}
    >
      <span className="relative">
        {symbol}
        {/* Ein Kreuz **und** die blasse Farbe: Ein verbrauchter Joker soll nicht allein am Farbton zu erkennen sein. */}
        {durchgestrichen && (
          <svg viewBox="0 0 24 24" className="absolute inset-0 size-6" aria-hidden="true">
            <path d="M3 3l18 18" stroke={FALSCH} strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className={durchgestrichen ? 'line-through' : ''}>{beschriftung}</span>
    </button>
  );
}

/** Die fünfzehn Stufen als Leiste: Sicherheitsstufen sind Rauten, erreichte sind gefüllt, die aktuelle trägt einen Rahmen. */
function Stufenleiste({ z, akzent }: { z: Zustand; akzent: string }) {
  return (
    <div
      className="flex w-full items-center gap-[3px]"
      role="progressbar"
      aria-label={`Stufe ${Math.min(z.stufe + 1, STUFEN)} von ${STUFEN}`}
      aria-valuemin={0}
      aria-valuemax={STUFEN}
      aria-valuenow={z.erreicht}
    >
      {PREISE.map((_, i) => {
        const sicher = SICHERE_STUFEN.includes(i + 1);
        const erreicht = i < z.erreicht;
        const aktuell = i === z.stufe && !z.vorbei;
        return (
          <span
            key={i}
            className={`h-2 flex-1 ${sicher ? 'rotate-45 scale-75 rounded-[2px]' : 'rounded-sm'}`}
            style={{
              backgroundColor: erreicht ? akzent : 'rgba(255,255,255,0.14)',
              outline: aktuell ? '2px solid #fff' : undefined,
              outlineOffset: 1,
            }}
          />
        );
      })}
    </div>
  );
}

/** Die ganze Leiter als Liste, die oberste Stufe oben. */
function Leiterliste({ z, akzent }: { z: Zustand; akzent: string }) {
  const stufen = Array.from({ length: STUFEN }, (_, i) => STUFEN - 1 - i);
  return (
    <ol className="flex w-full flex-col gap-0.5 text-sm" aria-label="Gewinnleiter">
      {stufen.map((i) => {
        const sicher = SICHERE_STUFEN.includes(i + 1);
        const erreicht = i < z.erreicht;
        const aktuell = i === z.stufe && !z.vorbei;
        return (
          <li
            key={i}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1 tabular-nums [@media(max-height:640px)]:py-0.5 [@media(max-height:640px)]:text-[13px]"
            style={{
              backgroundColor: aktuell ? akzent : 'rgba(255,255,255,0.05)',
              color: aktuell ? '#0b1020' : erreicht ? akzent : 'rgba(255,255,255,0.85)',
              fontWeight: aktuell || sicher ? 800 : 500,
              border: sicher && !aktuell ? `1px solid ${akzent}66` : '1px solid transparent',
            }}
          >
            <span className="w-5 text-right opacity-70">{i + 1}</span>
            <span className="flex-1 text-right">{zahl(PREISE[i]!)}</span>
            <span className="w-4 text-center" aria-hidden="true">
              {erreicht ? '✓' : sicher ? '◆' : ''}
            </span>
            {sicher && <span className="sr-only">Sicherheitsstufe</span>}
          </li>
        );
      })}
    </ol>
  );
}

function freundText(urteil: AnrufUrteil, antwort: string): string {
  const buchstabe = BUCHSTABEN[urteil.tipp]!;
  if (urteil.sicher === 'sehr') return `„Das weiß ich! Es ist ${buchstabe}: ${antwort}.“`;
  if (urteil.sicher === 'eher') return `„Ich glaube, es ist ${buchstabe}, ${antwort}. Ziemlich sicher bin ich mir.“`;
  return `„Puh … ich tippe auf ${buchstabe}, ${antwort}. Aber verlass dich nicht darauf.“`;
}

/* --- das Spiel ----------------------------------------------------------------------------------- */

export function Leiterspiel({
  onScore,
  onGameOver,
  settings,
  bestScore,
  istErsteRunde,
  level: festesLevel,
  startLevel,
  onLevel,
  spiel,
  titel,
  untertitel,
  Symbol,
  deko,
  verlauf,
  knopfFarbe,
  stil,
  fragenFuerLevel,
  levelStand,
}: LeiterspielProps) {
  const ruhig = settings.reducedMotion;

  const meldeLevel = (n: number) => {
    levelStand.setzen(n);
    onLevel?.(n);
  };

  // Nach „Nochmal" direkt weiterspielen statt über den Startbildschirm — der gehört nur ans Betreten.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => {
    const level = festesLevel ?? levelStand.anfang(startLevel);
    return neueRunde(level, spiel, fragenFuerLevel(level));
  });
  // Der Zustand zusätzlich als Ref: Mehrere Eingaben dicht hintereinander sollen nicht alle vom selben,
  // noch nicht gezeichneten Stand ausgehen.
  const zRef = useRef(z);
  const mitteRef = useRef<HTMLDivElement>(null);
  zRef.current = z;

  const [leiterOffen, setLeiterOffen] = useState(false);
  const [fragtAufhoeren, setFragtAufhoeren] = useState(false);

  const aendern = useCallback((f: (alt: Zustand) => Zustand): Zustand => {
    const alt = zRef.current;
    const neu = f(alt);
    if (neu !== alt) {
      zRef.current = neu;
      setZ(neu);
    }
    return neu;
  }, []);

  const gewinn = punkte(z);
  const gewinnZeichen = usePunktegewinn(gewinn, 1);

  useEffect(() => {
    onScore(gewinn);
  }, [gewinn, onScore]);

  // Die Auflösung kommt nach einer Wartezeit — das ist der Zeitgeber der Anzeige, die Logik kennt keine Uhr.
  useEffect(() => {
    if (!z.eingeloggt || z.aufgeloest) return;
    const uhr = window.setTimeout(() => {
      const vorher = zRef.current;
      const nach = aendern(aufloesen);
      if (nach === vorher) return;
      if (nach.ausgang === 'richtig') {
        const sicher = SICHERE_STUFEN.includes(nach.erreicht);
        // Der Ton steigt mit der Stufe: Man hört, wie weit man schon oben ist.
        sfx(sicher || nach.gewonnen ? 'stufe' : 'gut', Math.min(12, nach.erreicht));
        if (sicher || nach.gewonnen) haptik('jubel');
      } else {
        sfx('schlecht');
        haptik('fehler');
      }
    }, ruhig ? AUFLOESEN_RUHIG_MS : AUFLOESEN_MS);
    return () => window.clearTimeout(uhr);
  }, [z.eingeloggt, z.aufgeloest, ruhig, aendern]);

  // Nach dem Auflösen nimmt die Rückmeldung unten Platz weg. Auf dem kleinsten Handy (375 × 560) rutschte dadurch die
  // zweite Antwortreihe hinter sie — und mit ihr oft genau die richtige. Also ans Ende scrollen: Die Frage darf oben
  // halb hinausragen, die Antworten mit ✓ und ✗ müssen zu sehen sein.
  useEffect(() => {
    if (!z.aufgeloest) return;
    const mitte = mitteRef.current;
    if (!mitte) return;
    mitte.scrollTo({ top: mitte.scrollHeight, behavior: ruhig ? 'auto' : 'smooth' });
  }, [z.aufgeloest, ruhig]);

  useEffect(() => {
    if (!z.vorbei) return;
    sfx(z.gewonnen ? 'stufe' : 'ende');
    haptik(z.gewonnen ? 'jubel' : 'ende');
    if (festesLevel === undefined) meldeLevel(z.level + 1);
    onGameOver(punkte(z), z.gewonnen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const begonnen = z.stufe > 0 || z.markiert !== null || z.eingeloggt || z.aufgeloest || !JOKER_ARTEN.every((a) => z.joker[a]);

  const beiLevelWechsel = (neu: number) => {
    // Im Duell steht das Level fest, und mitten in einer Runde würde ein Tipp auf den Pfeil die Leiter zurücksetzen.
    if (festesLevel !== undefined || begonnen) return;
    const geklemmt = Math.max(1, neu);
    meldeLevel(geklemmt);
    const frisch = neueRunde(geklemmt, spiel, fragenFuerLevel(geklemmt));
    zRef.current = frisch;
    setZ(frisch);
  };

  // Töne gehören **nach** die Zustandsänderung und nie in den Aktualisierer: React ruft Aktualisierer im
  // StrictMode doppelt auf, der Ton klänge zweimal.
  const beiAntwort = (i: number) => {
    const vorher = zRef.current;
    if (aendern((alt) => markieren(alt, i)) !== vorher) sfx('klick');
  };

  const beiBestaetigen = () => {
    const vorher = zRef.current;
    if (aendern(einloggen) !== vorher) sfx('klick');
  };

  const beiJoker = (art: JokerArt) => {
    const vorher = zRef.current;
    if (aendern((alt) => jokerNutzen(alt, art)) !== vorher) sfx('stufe', 3);
  };

  const beiAufhoerenBestaetigt = () => {
    setFragtAufhoeren(false);
    aendern(aufhoeren);
  };

  if (!gestartet) {
    return (
      <Startbildschirm
        titel={titel}
        untertitel={untertitel}
        bestScore={bestScore}
        verlauf={verlauf}
        deko={deko}
        Symbol={Symbol}
        knopfFarbe={knopfFarbe}
        onStart={() => setGestartet(true)}
      />
    );
  }

  const frage = z.fragen[z.stufe];
  if (!frage) return null;

  const schwere = schwereAnStufe(z.stufe);
  const sicher = sicherJetzt(z);
  const wartet = z.eingeloggt && !z.aufgeloest;
  const letzte = z.stufe === STUFEN - 1;

  const farben = {
    '--l-akzent': stil.akzent,
    '--l-akzent-dunkel': stil.akzentDunkel,
    '--l-flaeche': stil.flaeche,
  } as CSSProperties;

  /** Stand und Farbe jeder Antwort. */
  const antwortStil = (i: number): { kopf: CSSProperties; zusatz: string } => {
    const weg = z.weg.includes(i);
    const istRichtig = i === frage.richtig;
    const istMarkiert = z.markiert === i;
    if (weg) {
      return { kopf: { opacity: 0.22, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'transparent' }, zusatz: '' };
    }
    if (z.aufgeloest) {
      if (istRichtig) return { kopf: { backgroundColor: RICHTIG, borderColor: '#bbf7d0', color: '#fff' }, zusatz: 'antwort-richtig' };
      if (istMarkiert) return { kopf: { backgroundColor: FALSCH, borderColor: '#fecaca', color: '#fff' }, zusatz: 'antwort-falsch' };
      return { kopf: { opacity: 0.45 }, zusatz: '' };
    }
    if (istMarkiert) {
      return {
        kopf: { backgroundColor: stil.akzent, borderColor: '#fff', color: '#0b1020' },
        zusatz: wartet && !ruhig ? 'leiter-warten' : '',
      };
    }
    return { kopf: {}, zusatz: '' };
  };

  const ergebnisText = (() => {
    if (!z.aufgeloest) return null;
    if (z.ausgang === 'richtig') {
      const gesichert = SICHERE_STUFEN.includes(z.erreicht);
      if (z.gewonnen) return `Geschafft! Alle fünfzehn richtig: ${zahl(gewinn)} Punkte!`;
      return `Richtig! ${zahl(gewinn)} Punkte${gesichert ? ' — Sicherheitsstufe, die nimmt dir keiner mehr.' : '.'}`;
    }
    if (z.ausgang === 'falsch') {
      return gewinn > 0 ? `Leider falsch — zurück auf ${zahl(gewinn)} Punkte.` : 'Leider falsch. Diesmal bleibt nichts übrig.';
    }
    return `Du nimmst ${zahl(gewinn)} Punkte mit.`;
  })();

  const weiterText = z.aufgeloest ? (z.ausgang === 'richtig' && !letzte ? 'Weiter' : 'Zur Auswertung') : wartet ? 'Deine Antwort zählt …' : z.markiert !== null ? 'Das ist meine Antwort' : 'Wähle eine Antwort';
  const knopfAn = z.aufgeloest || (z.markiert !== null && !wartet);

  return (
    <div
      className="spielseite relative flex min-h-0 flex-1 overflow-hidden text-white md:gap-3 md:p-3"
      style={{ ...farben, background: stil.buehne }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-1.5 p-3 md:gap-3 md:p-0 md:pt-[7vh]">
        {/* Kopfzeile: Level links, Gewinn und Leiter rechts. */}
        <div className="flex w-full max-w-md md:max-w-xl items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-1 font-semibold text-white/70">
            <button
              type="button"
              onClick={() => beiLevelWechsel(z.level - 1)}
              disabled={z.level <= 1 || festesLevel !== undefined || begonnen}
              aria-label="Voriges Level"
              className="spielknopf text-base leading-none"
            >
              ‹
            </button>
            <span className="w-16 text-center tabular-nums">Level {z.level}</span>
            <button
              type="button"
              onClick={() => beiLevelWechsel(z.level + 1)}
              disabled={festesLevel !== undefined || begonnen}
              aria-label="Nächstes Level"
              className="spielknopf text-base leading-none"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLeiterOffen(true)}
            aria-label={`Frage ${z.stufe + 1} von ${STUFEN}, Gewinn ${zahl(gewinn)} Punkte. Leiter öffnen.`}
            className="relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold tabular-nums md:pointer-events-none"
            style={{ borderColor: stil.akzent, color: stil.akzent, backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <span className="text-white/70">{z.stufe + 1}/{STUFEN}</span>
            <span key={gewinn} className="punkte-bumsen inline-block">{zahl(gewinn)}</span>
            <span aria-hidden="true" className="md:hidden">▾</span>
          </button>
        </div>

        <div className="w-full max-w-md md:max-w-xl">
          <Stufenleiste z={z} akzent={stil.akzent} />
        </div>

        {/* Nur dieser Teil scrollt, wenn eine Frage lang ist — die Knöpfe darunter bleiben erreichbar. */}
        <div ref={mitteRef} className="flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 overflow-y-auto md:max-w-xl md:flex-none md:overflow-visible">
          <div
            className="rounded-2xl border px-4 py-3"
            style={{ borderColor: stil.akzent, backgroundColor: 'rgba(5, 10, 40, 0.6)', boxShadow: `0 0 18px -6px ${stil.akzent}` }}
          >
            <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: stil.akzent }}>
              {frage.kategorie}
            </span>
            <p className="mt-0.5 text-[17px] leading-snug font-semibold md:text-2xl">{frage.frage}</p>
          </div>

          {z.anruf && (
            <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm" role="status">
              <span className="font-bold" style={{ color: stil.akzent }}>Dein Freund am Telefon: </span>
              {freundText(z.anruf, frage.antworten[z.anruf.tipp]!)}
            </div>
          )}

          {/* `relative`, damit das „+N" als Aufsatz über den Antworten liegt und keine Höhe kostet. */}
          <div className="relative grid grid-cols-2 gap-2" role="group" aria-label="Antworten">
            <Punktegewinn gewinn={gewinnZeichen} />
            {frage.antworten.map((antwort, i) => {
              const { kopf, zusatz } = antwortStil(i);
              const weg = z.weg.includes(i);
              const prozent = z.publikum?.[i];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => beiAntwort(i)}
                  disabled={z.eingeloggt || z.aufgeloest || weg}
                  aria-pressed={z.markiert === i}
                  aria-label={weg ? `${BUCHSTABEN[i]}: ausgeblendet` : `${BUCHSTABEN[i]}: ${antwort}`}
                  className={`relative flex min-h-14 touch-manipulation items-center gap-2 overflow-hidden rounded-2xl border px-2.5 py-2 text-left text-[15px] md:min-h-16 md:text-lg leading-tight font-semibold transition-[background-color,border-color,opacity,color] duration-150 enabled:active:scale-[0.97] disabled:cursor-default ${zusatz}`}
                  style={{ borderColor: `${stil.akzent}88`, backgroundColor: stil.flaeche, ...kopf }}
                >
                  {/* Der Balken des Publikums liegt hinter dem Text. */}
                  {prozent !== undefined && !weg && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 bg-white/20"
                      style={{ width: `${prozent}%`, transition: ruhig ? undefined : 'width 600ms ease-out' }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="relative grid size-6 shrink-0 place-items-center rounded-full text-xs font-black"
                    style={{ backgroundColor: z.markiert === i || z.aufgeloest ? 'rgba(255,255,255,0.9)' : stil.akzent, color: '#0b1020' }}
                  >
                    {BUCHSTABEN[i]}
                  </span>
                  <span className="relative min-w-0 flex-1 break-words">{weg ? '—' : antwort}</span>
                  {prozent !== undefined && !weg && (
                    <span className="relative shrink-0 text-xs font-black tabular-nums" aria-label={`${prozent} Prozent`}>
                      {prozent} %
                    </span>
                  )}
                  {z.aufgeloest && i === frage.richtig && <span aria-hidden="true" className="relative shrink-0">✓</span>}
                  {z.aufgeloest && z.markiert === i && i !== frage.richtig && <span aria-hidden="true" className="relative shrink-0">✗</span>}
                </button>
              );
            })}
          </div>

        </div>

        {/* Vor der Auflösung: Joker und Aufhören. Danach nimmt die Rückmeldung ihren Platz ein — die Joker wären
            ohnehin gesperrt, und die Erklärung ist das, worauf es im Spiel ankommt. Unter der Antwortliste war dafür
            auf dem kleinsten Handy kein Platz mehr: Sie lag unsichtbar im Scrollbereich. */}
        {!z.aufgeloest ? (
        <div className="flex w-full max-w-md md:max-w-xl items-stretch gap-1.5">
          {JOKER_ARTEN.map((art) => (
            <Knopf
              key={art}
              beschriftung={JOKER_NAME[art]}
              hinweis={`${JOKER_NAME[art]}${z.joker[art] ? '' : ' (schon benutzt)'}`}
              symbol={<JokerSymbol art={art} />}
              onClick={() => beiJoker(art)}
              deaktiviert={!jokerFrei(z, art)}
              durchgestrichen={!z.joker[art]}
              akzent={stil.akzent}
            />
          ))}
          <Knopf
            beschriftung="Aufhören"
            hinweis={darfAufhoeren(z) ? `Aufhören und ${zahl(gewinn)} Punkte mitnehmen` : 'Aufhören (erst nach der ersten richtigen Antwort)'}
            symbol={
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6" />
              </svg>
            }
            onClick={() => setFragtAufhoeren(true)}
            deaktiviert={!darfAufhoeren(z)}
            akzent="#e2e8f0"
          />
        </div>
        ) : (
          <div className="flex max-h-[34dvh] w-full max-w-md md:max-w-xl shrink-0 flex-col gap-1.5 overflow-y-auto" aria-live="polite">
            <div
              className="rounded-2xl px-3 py-1.5 text-sm font-bold"
              style={{
                backgroundColor: z.ausgang === 'falsch' ? `${FALSCH}33` : z.ausgang === 'richtig' ? `${RICHTIG}33` : 'rgba(255,255,255,0.12)',
                border: `1px solid ${z.ausgang === 'falsch' ? FALSCH : z.ausgang === 'richtig' ? RICHTIG : 'rgba(255,255,255,0.3)'}`,
              }}
            >
              {ergebnisText}
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] leading-snug md:text-base">
              <span aria-hidden="true">💡</span> {frage.erklaerung}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={z.aufgeloest ? () => aendern(weiter) : beiBestaetigen}
          disabled={!knopfAn}
          autoFocus={z.aufgeloest}
          className="min-h-12 w-full max-w-md md:max-w-xl rounded-2xl px-4 text-base font-extrabold transition-[opacity,transform] duration-100 enabled:active:scale-[0.98] disabled:cursor-default"
          style={{
            backgroundColor: knopfAn ? stil.akzent : 'rgba(255,255,255,0.08)',
            color: knopfAn ? '#0b1020' : 'rgba(255,255,255,0.45)',
          }}
        >
          {weiterText}
        </button>

        {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
        <p className="sr-only" aria-live="polite">
          {`Frage ${z.stufe + 1} von ${STUFEN}, Schwere ${schwere}. Sicherer Gewinn ${zahl(sicher)} Punkte.`}
        </p>
      </div>

      {/* Auf breiten Bildschirmen steht die Leiter immer daneben. */}
      <aside className="hidden w-56 shrink-0 flex-col justify-center gap-2 md:flex" aria-label="Gewinnleiter">
        <Leiterliste z={z} akzent={stil.akzent} />
      </aside>

      {/* Auf dem Handy öffnet sie sich über dem Spielfeld. */}
      {leiterOffen && (
        // Außen scrollt, innen zentriert `min-h-full`: Ist genug Platz, steht die Leiter mittig, ist keiner, beginnt sie
        // oben und lässt sich scrollen. Ein einfaches `justify-center` schnitt auf dem kleinen Handy die obersten
        // Stufen oben ab — man sah nie, dass es bis 100.000 geht.
        <div
          className="absolute inset-0 z-30 overflow-y-auto bg-black/70 backdrop-blur-sm md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Gewinnleiter"
          onClick={() => setLeiterOffen(false)}
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-3 p-4">
            <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
              <Leiterliste z={z} akzent={stil.akzent} />
            </div>
            <button type="button" onClick={() => setLeiterOffen(false)} autoFocus className="spielknopf spielknopf-gross" style={{ backgroundColor: stil.akzent, color: '#0b1020' }}>
              Schließen
            </button>
          </div>
        </div>
      )}

      {fragtAufhoeren && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Aufhören?">
          <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl border p-4 text-center" style={{ borderColor: stil.akzent, backgroundColor: '#0a1040' }}>
            <p className="text-lg font-extrabold">Aufhören?</p>
            <p className="text-sm text-white/80">
              Du nimmst <b style={{ color: stil.akzent }}>{zahl(gewinn)} Punkte</b> mit. Die Runde ist dann vorbei.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFragtAufhoeren(false)} autoFocus className="spielknopf spielknopf-gross flex-1" style={{ backgroundColor: stil.akzent, color: '#0b1020' }}>
                Weiterspielen
              </button>
              <button type="button" onClick={beiAufhoerenBestaetigt} className="spielknopf spielknopf-gross flex-1 border-white/30 bg-white/10 text-white">
                Aufhören
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
