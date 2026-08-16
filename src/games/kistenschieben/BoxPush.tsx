import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useInput } from '../../core/useInput';
import { levelstand } from '../../core/levelstand';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { haptik } from '../../core/haptik';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import {
  LEVEL_ANZAHL,
  alsPunkt,
  gehen,
  neuesLevel,
  neustart,
  punkteFuerZuege,
  stufe,
  zurueck,
} from './logik';
import type { Richtung, Zustand } from './logik';
import { FERTIG, FERTIG_RAND, HOLZ, HOLZ_BAND, HOLZ_RAND, ZIELRING } from './farben';
import { KistenIcon } from './Icon';

/**
 * Box Push — Kisten auf ihre Zielfelder schieben.
 *
 * Das erste Spiel der Sammlung, in dem man einen Zug wirklich **verbauen**
 * kann: Eine Kiste lässt sich nur schieben, nie ziehen. Steht sie in der
 * Ecke, bleibt sie dort. Deshalb sind Zurück und Neustart hier keine
 * Bequemlichkeit, sondern Teil der Regeln.
 *
 * Gerechnet wird in `logik.ts`, die Level stehen als Textraster in
 * `level.ts` — beides ohne Browser geprüft, samt Suchlauf, der jedes Level
 * wirklich löst.
 */

/** Kantenlänge eines Feldes im Zeichensystem. */
const FELD = 10;

/**
 * Wie lange eine Kiste (und der Schieber) von Feld zu Feld **fährt**.
 *
 * Vorher sprangen beide ohne jede Bewegung um — der Schub, das Kernstück
 * des Spiels, war optisch überhaupt nicht zu sehen; die zweite Tonspur war
 * die einzige Rückmeldung. 130 ms sind lang genug, dass man die Richtung
 * sieht, und kurz genug, dass sich schnelles Spielen nicht zäh anfühlt.
 */
const SCHUB_MS = 130;

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 16, winkel: -10, verzoegerung: 0, inhalt: <DekoKiste /> },
  { x: 86, y: 12, winkel: 14, verzoegerung: 0.6, inhalt: <DekoKiste /> },
  { x: 88, y: 72, winkel: -6, verzoegerung: 1.2, inhalt: <DekoKiste /> },
  { x: 5, y: 74, winkel: 18, verzoegerung: 0.4, inhalt: <DekoKiste /> },
];

function DekoKiste() {
  return (
    <svg viewBox="0 0 20 20" className="size-11">
      <Kiste x={0} y={0} groesse={20} aufZiel={false} />
    </svg>
  );
}

/**
 * Fährt ein Spielteil an seinen Platz, statt es dorthin springen zu lassen.
 *
 * Bewusst als CSS-`transform` und nicht als `transform`-Attribut: Nur die
 * CSS-Eigenschaft lässt sich mit `transition` überblenden. Denselben Griff
 * benutzt Even Cut für seine Formhälften.
 *
 * Bei „weniger Bewegung" fällt der Übergang weg, das Teil steht dann sofort
 * am Ziel — es verschwindet nichts, es dauert nur nicht.
 */
function fahrt(x: number, y: number, ruhig: boolean): CSSProperties {
  return {
    transform: `translate(${x}px, ${y}px)`,
    transition: ruhig ? undefined : `transform ${SCHUB_MS}ms ease-out`,
  };
}

/**
 * Eine Kiste. Helles Holz mit Diagonalbändern — dieselbe Machart wie der
 * Glanzstein in Block Burst: Schatten unten, Lichtkante oben, damit sie
 * nicht flach wirkt.
 *
 * Die Farben stehen in `farben.ts`, nicht hier: Dieselbe Kiste wird an drei
 * Stellen gezeichnet (Spiel, Startbildschirm-Deko, App-Symbol), und genau
 * daran ist es schon einmal auseinandergelaufen.
 *
 * Eine Kiste auf ihrem Zielfeld wird nicht nur golden, sie bekommt statt der
 * Bänder einen **Haken**. Farbe darf nie das einzige Merkmal sein.
 */
function Kiste({
  x,
  y,
  groesse,
  aufZiel,
  ruhig = true,
}: {
  x: number;
  y: number;
  groesse: number;
  aufZiel: boolean;
  ruhig?: boolean;
}) {
  const rand = groesse * 0.09;
  return (
    <g style={fahrt(x, y, ruhig)}>
      <rect
        x={rand}
        y={rand}
        width={groesse - rand * 2}
        height={groesse - rand * 2}
        rx={groesse * 0.12}
        fill={aufZiel ? FERTIG : HOLZ}
        stroke={aufZiel ? FERTIG_RAND : HOLZ_RAND}
        strokeWidth={groesse * 0.07}
      />
      {aufZiel ? (
        /* Der Haken: „diese hier sitzt". */
        <path
          d={`M ${groesse * 0.29} ${groesse * 0.5}
              L ${groesse * 0.44} ${groesse * 0.66}
              L ${groesse * 0.72} ${groesse * 0.34}`}
          fill="none"
          stroke={FERTIG_RAND}
          strokeWidth={groesse * 0.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        /* Die beiden Bänder über Eck — daran erkennt man eine Kiste sofort. */
        <path
          d={`M ${rand} ${rand} L ${groesse - rand} ${groesse - rand}
              M ${groesse - rand} ${rand} L ${rand} ${groesse - rand}`}
          fill="none"
          stroke={HOLZ_BAND}
          strokeWidth={groesse * 0.06}
          opacity={0.9}
        />
      )}
      {/* Lichtkante oben. */}
      <path
        d={`M ${rand * 1.6} ${rand * 1.8} H ${groesse - rand * 1.6}`}
        stroke="#ffffff"
        strokeWidth={groesse * 0.05}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
}

/** Der Schieber. Bewusst schlicht — die Kisten sind der Star. */
function Schieber({
  x,
  y,
  groesse,
  ruhig,
}: {
  x: number;
  y: number;
  groesse: number;
  ruhig: boolean;
}) {
  const m = groesse / 2;
  return (
    <g style={fahrt(x, y, ruhig)}>
      <ellipse cx={m} cy={groesse * 0.86} rx={groesse * 0.3} ry={groesse * 0.09} opacity={0.28} />
      <circle cx={m} cy={groesse * 0.34} r={groesse * 0.2} fill="#38bdf8" />
      <circle cx={m - groesse * 0.06} cy={groesse * 0.3} r={groesse * 0.05} fill="#ffffff" opacity={0.8} />
      <rect
        x={m - groesse * 0.19}
        y={groesse * 0.5}
        width={groesse * 0.38}
        height={groesse * 0.32}
        rx={groesse * 0.12}
        fill="#2563eb"
      />
    </g>
  );
}

export function BoxPush({
  onScore,
  onGameOver,
  settings,
  bestScore,
  istErsteRunde,
  level: festesLevel,
  startLevel,
  onLevel,
}: GameProps) {
  /*
   * Setzt den Sitzungsstand **und** meldet ihn der Hülle, die ihn ablegt.
   * Vorher stand hier nur die Zuweisung an eine Modul-Variable — die war
   * beim Schließen der App weg, und Florian fing jedes Mal bei Level 1 an.
   *
   * Im Duell (`festesLevel` gesetzt) ruft die Hülle nichts auf: Ein
   * vorgegebenes Level ist kein Fortschritt und darf den echten Stand
   * nicht überschreiben.
   */
  const meldeLevel = (n: number) => {
    levelStand.setzen(n);
    onLevel?.(n);
  };
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(festesLevel ?? levelStand.anfang(startLevel)));
  // Die Regel im Bild nur beim Betreten des Spiels, nicht nach jedem
  // „Nochmal": Wer gerade eben gelesen hat, braucht sie nicht wieder.
  const [zeigeHinweis, setZeigeHinweis] = useState(istErsteRunde);
  const gemeldet = useRef(false);
  const { breite, hoehe, wand, ziel } = z.brett;
  const ruhig = settings.reducedMotion;

  const beiRichtung = useCallback((richtung: Richtung) => {
    // Die Regel im Bild hat ihren Zweck erfüllt, sobald der erste Zug sitzt.
    setZeigeHinweis(false);

    /*
     * **Ton und Stups stehen außerhalb der Updater-Funktion.**
     *
     * React darf einen Updater mehrfach aufrufen, und unter `<StrictMode>`
     * (siehe `main.tsx`) tut es das in der Entwicklung grundsätzlich —
     * ein `haptik()` darin brummt dann zweimal. Der Updater rechnet jetzt
     * nur noch und merkt sich das Ergebnis; gemeldet wird es danach,
     * genau einmal je Zug. Ein doppelter Aufruf überschreibt dabei
     * denselben Wert, das Ergebnis bleibt also richtig.
     */
    let ausgang: 'gesperrt' | 'schritt' | 'schub' | 'eingerastet' | null = null;

    setZ((alt) => {
      const neu = gehen(alt, richtung);
      if (neu === alt) {
        ausgang = 'gesperrt';
        return alt;
      }
      const daheim = (s: Zustand) => s.kisten.filter((k) => s.brett.ziel[k]).length;
      ausgang =
        neu.kisten === alt.kisten
          ? 'schritt'
          : daheim(neu) > daheim(alt)
            ? 'eingerastet'
            : 'schub';
      return neu;
    });

    // Vorher passierte bei einem Zug gegen die Wand schlicht gar nichts —
    // für ein Kind sieht das aus, als hätte die App die Eingabe verpasst.
    if (ausgang === 'gesperrt') haptik('fehler');
    // Ein Schub klingt anders als ein Schritt — daran hört man, dass man
    // gerade etwas bewegt hat, ohne hinzusehen. Rastet eine Kiste dabei auf
    // ihrem Zielfeld ein, klettert der Ton eine Quinte höher: Das ist der
    // Augenblick, auf den man hinspielt, und er soll sich abheben.
    else if (ausgang === 'schritt') sfx('klick');
    else if (ausgang === 'schub') sfx('gut', 0);
    else if (ausgang === 'eingerastet') sfx('gut', 7);
  }, []);

  useInput(
    (aktion) => {
      if (aktion === 'up') beiRichtung('oben');
      // Ein schneller oder weiter Wisch nach unten kommt hier als `down`
      // an, weil die Optionen unten `wurf: 'down'` setzen. Vorher wurde
      // stattdessen `drop` mit umgedeutet — und damit auch die
      // **Leertaste**, die in `useInput` auf `drop` liegt. In einem
      // Schiebe-Rätsel kostet jeder Zug Punkte; ein versehentlicher Druck
      // kostete vier.
      else if (aktion === 'down') beiRichtung('unten');
      else if (aktion === 'left') beiRichtung('links');
      else if (aktion === 'right') beiRichtung('rechts');
    },
    {
      aktiv: gestartet && !z.geloest,
      // **Kein Wiederholen bei gehaltener Taste.** In einem Schiebe-Rätsel
      // kostet jeder Zug Punkte, und ein einziger Zug zu viel schiebt eine
      // Kiste in die Ecke, aus der sie nie wieder herauskommt. Alle 45 ms
      // einen weiteren Zug auszulösen (die Vorgabe) ist hier also kein
      // Komfort, sondern eine Falle. Merge Up macht es aus demselben Grund so.
      wiederholen: [],
      // Vier gleichwertige Richtungen, kein „fallen lassen" — siehe oben.
      wurf: 'down',
    },
  );

  /**
   * Ein Zug je Antippen — auch am Steuerkreuz.
   *
   * Das Steuerkreuz bringt seine eigene Wiederholung mit (170 ms, dann alle
   * 45 ms) und kennt keinen Schalter dafür; es ist ein gemeinsamer Baustein,
   * an dem hängen alle Spiele. Also wird hier gesperrt statt dort abgeschaltet:
   * Nach einem angenommenen Zug ist Schluss, bis der Finger wieder hochgeht.
   * Ein `pointerup` am Fenster ist dafür der verlässliche Auslöser — dasselbe
   * Ereignis, mit dem das Steuerkreuz auch selbst aufhört zu wiederholen.
   */
  const bereitRef = useRef(true);

  useEffect(() => {
    const freigeben = () => {
      bereitRef.current = true;
    };
    window.addEventListener('pointerup', freigeben);
    window.addEventListener('pointercancel', freigeben);
    return () => {
      window.removeEventListener('pointerup', freigeben);
      window.removeEventListener('pointercancel', freigeben);
    };
  }, []);

  const beiKreuz = useCallback(
    (richtung: Richtung) => {
      /*
       * **Nur `bereitRef`, keine Zeitsperre mehr.**
       *
       * Hier stand zusätzlich „mindestens 110 ms seit dem letzten Zug",
       * begründet als Auffangnetz für ein ausbleibendes `pointerup`. Das
       * konnte es nie sein: Bleibt das `pointerup` aus, steht `bereitRef`
       * ohnehin dauerhaft auf `false` und **kein** Zug kommt mehr durch —
       * die Zeit rettet daran nichts. Übrig blieb allein die Nebenwirkung,
       * dass ab etwa neun Tipps je Sekunde jeder zweite lautlos verfiel:
       * kein Ton, kein Stups, keine Bewegung. Genau das Verschlucken, das
       * dieses Spiel an anderer Stelle ausdrücklich abstellt.
       *
       * Ein Zug je Fingerdruck sichert `bereitRef` allein zu, und es wird
       * am **Fenster** freigegeben — ein Loslassen geht dort nicht
       * verloren, auch nicht neben dem Knopf.
       */
      if (!bereitRef.current) return;
      bereitRef.current = false;
      beiRichtung(richtung);
    },
    [beiRichtung],
  );

  // Die Regel blendet sich auch von allein aus — wer erst liest und dann
  // spielt, soll sie nicht wegtippen müssen.
  useEffect(() => {
    if (!gestartet || !zeigeHinweis) return;
    const uhr = window.setTimeout(() => setZeigeHinweis(false), 6000);
    return () => window.clearTimeout(uhr);
  }, [gestartet, zeigeHinweis]);

  useEffect(() => {
    // **Laufend**, nicht erst beim Lösen. Vorher stand die ganze Runde über
    // „Punkte 0" in der Kopfzeile und sprang im Augenblick des Lösens auf den
    // Endwert — damit war nirgends zu sehen, dass jeder unnötige Zug etwas
    // kostet. Der Wert ist das, was gerade noch zu holen ist.
    if (!gestartet) return;
    onScore(punkteFuerZuege(z.level, z.zuege));
  }, [gestartet, z.level, z.zuege, onScore]);

  useEffect(() => {
    if (!z.geloest || gemeldet.current) return;
    gemeldet.current = true;
    sfx('stufe');
    if (festesLevel === undefined) meldeLevel(z.level + 1);
    // Kurz stehen lassen: Der Augenblick, in dem die letzte Kiste einrastet,
    // ist das, worauf man hingearbeitet hat.
    const uhr = window.setTimeout(() => onGameOver(punkteFuerZuege(z.level, z.zuege), true), 800);
    return () => window.clearTimeout(uhr);
  }, [z.geloest, z.level, z.zuege, onGameOver]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Box Push"
        untertitel="Schieb jede Kiste auf ein Zielfeld. Ziehen geht nicht — überleg vorher."
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #b45309 0%, #78350f 45%, #1c1917 100%)"
        deko={DEKO}
        Symbol={KistenIcon}
        knopfFarbe="#78350f"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const geschafft = z.kisten.filter((k) => ziel[k]).length;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 px-3 pt-2">
      <div className="flex w-full max-w-md items-baseline justify-between text-sm">
        <span className="font-semibold text-gedaempft">
          Level {stufe(z.level)} von {LEVEL_ANZAHL}
        </span>
        <span className="text-gedaempft tabular-nums">
          {geschafft}/{z.kisten.length} Kisten · {z.zuege} Züge
        </span>
      </div>

      {/* Das Brett bekommt einen eigenen Rahmen um das SVG. Der ist nötig,
          weil in ein SVG kein HTML hineinpasst und die Einblendung unten
          trotzdem **am Brett** hängen soll und nicht an der ganzen Bühne —
          dieselbe Bauweise wie das Punkte-Popup in Ghost Chase. */}
      <div className="spielbuehne">
        <div className="spielbrett relative" style={{ '--vz': breite / hoehe } as CSSProperties}>
          <svg
            viewBox={`0 0 ${breite * FELD} ${hoehe * FELD}`}
            className="spielbrett-rahmen block size-full select-none"
            role="img"
            aria-label={`Box Push, Level ${stufe(z.level)}. ${geschafft} von ${z.kisten.length} Kisten auf dem Ziel, ${z.zuege} Züge, noch ${punkteFuerZuege(z.level, z.zuege)} Punkte zu holen.`}
          >
            {/* Boden und Wände */}
            {Array.from({ length: breite * hoehe }, (_, f) => {
              const { x, y } = alsPunkt(f, breite);
              if (wand[f]) {
                return (
                  <g key={f}>
                    <rect x={x * FELD} y={y * FELD} width={FELD} height={FELD} fill="#3f3f46" />
                    <rect
                      x={x * FELD + 0.6}
                      y={y * FELD + 0.6}
                      width={FELD - 1.2}
                      height={FELD - 1.2}
                      rx={1}
                      fill="#52525b"
                    />
                  </g>
                );
              }
              return (
                <rect
                  key={f}
                  x={x * FELD}
                  y={y * FELD}
                  width={FELD}
                  height={FELD}
                  fill={y % 2 === x % 2 ? '#1c1917' : '#231f1c'}
                />
              );
            })}

            {/* Zielfelder — als Ring, damit eine daraufstehende Kiste sie nicht
                verdeckt und man immer sieht, wie viele noch frei sind. */}
            {ziel.map((istZiel, f) => {
              if (!istZiel) return null;
              const { x, y } = alsPunkt(f, breite);
              return (
                <circle
                  key={`z${f}`}
                  cx={x * FELD + FELD / 2}
                  cy={y * FELD + FELD / 2}
                  r={FELD * 0.22}
                  fill="none"
                  stroke={ZIELRING}
                  strokeWidth={FELD * 0.09}
                  opacity={0.8}
                />
              );
            })}

            {/* **Der Schlüssel ist der Platz in der Liste, nicht das Feld.**
                Mit der Feldnummer als Schlüssel war eine geschobene Kiste für
                React ein anderes Element: Das alte wurde ausgehängt, ein neues
                eingehängt — und ein Übergang auf `transform` kann daran nicht
                greifen, die Kiste sprang. `logik.ts` hält die Liste deshalb
                eigens in fester Reihenfolge. */}
            {z.kisten.map((f, i) => {
              const { x, y } = alsPunkt(f, breite);
              return (
                <Kiste
                  key={i}
                  x={x * FELD}
                  y={y * FELD}
                  groesse={FELD}
                  aufZiel={!!ziel[f]}
                  ruhig={ruhig}
                />
              );
            })}

            <Schieber
              x={z.spieler.x * FELD}
              y={z.spieler.y * FELD}
              groesse={FELD}
              ruhig={ruhig}
            />
          </svg>

          {/* Die Kernregel im Bild statt unter dem Brett.
              Unter dem Brett stand sie in `.nur-bei-platz` — und genau die
              Klasse blendet sie auf jedem Bildschirm unter 720 Pixeln Höhe
              aus, also auf dem iPhone. Zusammen damit, dass der
              Startbildschirm früher nur entweder Regel oder Bestwert zeigte,
              stand die Regel nach der ersten Runde nirgends mehr. Jetzt liegt
              sie im Bild und verschwindet mit dem ersten Zug. Dash City macht
              es genauso. */}
          {zeigeHinweis && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 grid place-items-center px-2">
              <div className="max-w-xs rounded-2xl bg-black/65 px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-sm font-black text-white">Kisten kann man nur schieben</p>
                <p className="mt-1 text-xs text-white/85">
                  Nie ziehen — eine Kiste in der Ecke bleibt dort. Verfahren? Auf „Zurück" tippen,
                  so oft du willst.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Zurück ist hier kein Komfort, sondern Teil der Regeln: Ohne ihn
            müsste ein Kind bei jeder verschobenen Kiste von vorn anfangen. */}
        <button
          type="button"
          onClick={() => {
            setZ((alt) => {
              const neu = zurueck(alt);
              if (neu !== alt) sfx('klick');
              return neu;
            });
          }}
          disabled={z.verlauf.length === 0 || z.geloest}
          className="spielknopf text-sm font-medium"
        >
          <span aria-hidden="true">↶</span> Zurück
        </button>

        {/* Das Steuerkreuz spricht die vier englischen Richtungen der
            Bausteine; die Spiellogik hier die deutschen. Übersetzt wird an
            genau dieser einen Stelle. */}
        <Steuerkreuz
          onRichtung={(r) =>
            beiKreuz(
              r === 'up' ? 'oben' : r === 'down' ? 'unten' : r === 'left' ? 'links' : 'rechts',
            )
          }
          aktiv={!z.geloest}
          kompakt
        />

        <button
          type="button"
          onClick={() => setZ((alt) => neustart(alt))}
          disabled={z.geloest}
          className="spielknopf text-sm font-medium"
        >
          <span aria-hidden="true">⟳</span> Neu
        </button>
      </div>

      {/* **Die Kernregel steht hier wieder mit drin.**

          Sie war herausgenommen worden, weil sie jetzt beim Betreten groß
          im Bild steht. Die Einblendung kommt aber nur bei `istErsteRunde`
          — nach „Nochmal" wird der Startbildschirm übersprungen und die
          Einblendung unterdrückt. „Nur schieben, nie ziehen" stand dann an
          keiner einzigen Stelle mehr, und genau das ist die eine Regel,
          ohne die man das Spiel nicht versteht.

          Auf einem kurzen Bildschirm weicht der Satz (`.nur-bei-platz`) —
          dort greift dafür die Einblendung beim Betreten. */}
      <p className="nur-bei-platz max-w-md text-center text-xs text-gedaempft">
        Kisten kann man nur schieben, nie ziehen. Wischen oder die Pfeile benutzen; jeder Zug
        kostet ein paar Punkte — auch „Zurück".
      </p>
    </div>
  );
}
