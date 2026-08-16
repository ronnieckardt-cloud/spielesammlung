import { useCallback, useEffect, useState } from 'react';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { levelstand } from '../../core/levelstand';
import { sfx } from '../../core/sfx';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { WortspielIcon } from './Icon';
import { antwortWaehlen, naechstesWort, neuesLevel } from './logik';
import type { Zustand } from './logik';

const RICHTIG_FARBE = '#22c55e';
const FALSCH_FARBE = '#ef4444';

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

/** Buchstabenplättchen als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 12, winkel: -12, verzoegerung: 0, inhalt: <Plaettchen buchstabe="W" groesse={40} /> },
  { x: 85, y: 10, winkel: 14, verzoegerung: 0.6, inhalt: <Plaettchen buchstabe="O" groesse={32} /> },
  { x: 87, y: 71, winkel: -8, verzoegerung: 1.2, inhalt: <Plaettchen buchstabe="R" groesse={44} /> },
  { x: 5, y: 74, winkel: 10, verzoegerung: 0.35, inhalt: <Plaettchen buchstabe="T" groesse={36} /> },
  { x: 92, y: 42, winkel: 20, verzoegerung: 1.65, inhalt: <Plaettchen buchstabe="ß" groesse={26} /> },
  { x: 3, y: 44, winkel: -20, verzoegerung: 0.9, inhalt: <Plaettchen buchstabe="Ä" groesse={30} /> },
];

function Plaettchen({ buchstabe, groesse }: { buchstabe: string; groesse: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-lg bg-white/90 font-black text-rose-700 shadow-lg"
      style={{ width: groesse, height: groesse, fontSize: groesse * 0.55 }}
    >
      {buchstabe}
    </span>
  );
}

export function Wortspiel({
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
  // Nach „Nochmal" (= nächstes Level) direkt weiterspielen — der
  // Startbildschirm gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(festesLevel ?? levelStand.anfang(startLevel)));
  const gewinn = usePunktegewinn(z.punkte);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx(z.richtigeAnzahl === z.woerter.length ? 'stufe' : 'ende');
      if (festesLevel === undefined) meldeLevel(z.level + 1);
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const beiAntwort = useCallback(
    (index: 0 | 1 | 2 | 3) => {
      // Der Ton gehört **vor** `setZ` und nicht hinein: React ruft den
      // Aktualisierer im StrictMode absichtlich zweimal auf, beide Male mit
      // demselben `alt` — die Wache „hat sich der Zustand geändert?" greift
      // dort also nicht, und der Ton klang doppelt. Beim Rendern liegt der
      // Zustand ohnehin schon vor; gefragt wird deshalb er, und der
      // Aktualisierer bleibt rein (wie bei Brain Blitz).
      const wort = z.woerter[z.index];
      if (!wort || z.ausgewaehlt !== null || z.vorbei) return;
      const richtig = index === wort.richtig;
      // Der Ton klettert mit der Serie eine Stufe höher — dasselbe Signal
      // wie die wachsende Punktzahl, nur hörbar. `z.serie` ist die Serie
      // **vor** dieser Antwort, die erste richtige bleibt der Grundton.
      if (richtig) sfx('gut', Math.min(12, z.serie * 2));
      else sfx('schlecht');
      setZ((alt) => antwortWaehlen(alt, index));
    },
    [z.woerter, z.index, z.ausgewaehlt, z.vorbei, z.serie],
  );

  const beiWeiter = useCallback(() => setZ((alt) => naechstesWort(alt)), []);

  const beiLevelWechsel = useCallback((neu: number) => {
    // Im Duell steht das Level fest — sonst könnte man sich das
    // leichteste aussuchen und der Vergleich wäre wertlos.
    if (festesLevel !== undefined) return;
    const geklemmt = Math.max(1, neu);
    meldeLevel(geklemmt);
    setZ(neuesLevel(geklemmt));
  }, []);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Word Play"
        untertitel="Welches Wort ist richtig geschrieben?"
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #be123c 0%, #9333ea 50%, #1d4ed8 100%)"
        deko={DEKO}
        Symbol={WortspielIcon}
        knopfFarbe="#be123c"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const wort = z.woerter[z.index];
  if (!wort) return null;

  const beantwortet = z.ausgewaehlt !== null;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <div className="flex w-full max-w-md items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1 || festesLevel !== undefined}
            aria-label="Voriges Level"
            className="spielknopf text-base leading-none"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            disabled={festesLevel !== undefined}
            aria-label="Nächstes Level"
            className="spielknopf text-base leading-none"
          >
            ›
          </button>
        </div>
        <span className="text-gedaempft">
          Wort {z.index + 1} / {z.woerter.length}
        </span>
      </div>

      <div
        className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-flaeche-hoch"
        role="progressbar"
        aria-label="Fortschritt in dieser Runde"
        aria-valuemin={0}
        aria-valuemax={z.woerter.length}
        aria-valuenow={z.index}
      >
        <div
          className="h-full rounded-full bg-fokus transition-[width] duration-200"
          style={{ width: `${(z.index / z.woerter.length) * 100}%` }}
        />
      </div>

      {/* Die Bühne wie in den anderen Spielen: Sie bringt den farbigen
          Schein hinter dem Inhalt (`.spielbuehne::before`) und den Auftritt
          beim Rundenstart (`buehne-rein`) mit — beides hängt in index.css an
          `.spielbuehne` selbst, dieses Spiel hatte die Klasse nie gesetzt
          und ging deshalb leer aus.

          Der Aufbau darin ist wichtig: Die Bühne ist ein Größen-Container
          (`container-type: size`) und holt ihre Höhe aus dem, was nach
          Kopfzeile, Weiter-Knopf und Fußzeile übrig bleibt — nicht aus
          ihrem Inhalt. Der Inhalt bekommt deshalb `max-h-full`, und das
          Scrollen liegt eine Ebene tiefer. So scrollt auf einem kurzen
          Bildschirm nur der Wortteil, der Weiter-Knopf bleibt erreichbar. */}
      <div className="spielbuehne">
        <div className="relative flex max-h-full w-full max-w-md flex-col items-center gap-2">
          {/* Das Popup gehört in diesen Kasten und nicht direkt in die Bühne
              — genau wie bei Ghost Chase. Hier hat es den passenden
              Bezugspunkt (`relative`) und liegt mittig über den Antworten. */}
          <Punktegewinn gewinn={gewinn} />

          {/* Nur dieser Teil scrollt, wenn der Inhalt lang wird. */}
          <div className="flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto">
            <div className="w-full rounded-karte border border-rand bg-flaeche p-5 text-center">
              <span className="text-xs font-medium tracking-wide text-gedaempft uppercase">
                {wort.kategorie}
              </span>
              <p className="mt-2 text-lg font-semibold">Welches Wort ist richtig geschrieben?</p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {wort.antworten.map((antwort, i) => {
                const istAusgewaehlt = z.ausgewaehlt === i;
                const istRichtigeAntwort = i === wort.richtig;

                let rahmenfarbe: string | undefined;
                let hintergrund: string | undefined;
                let deckkraft: number | undefined;
                // Siehe Quiz Time: Die richtige Schreibweise ploppt immer auf,
                // gewackelt wird nur bei der angetippten falschen.
                let bewegung = '';
                if (beantwortet && istRichtigeAntwort) {
                  rahmenfarbe = RICHTIG_FARBE;
                  hintergrund = `${RICHTIG_FARBE}26`;
                  bewegung = 'antwort-richtig';
                } else if (beantwortet && istAusgewaehlt) {
                  rahmenfarbe = FALSCH_FARBE;
                  hintergrund = `${FALSCH_FARBE}26`;
                  bewegung = 'antwort-falsch';
                } else if (beantwortet) {
                  deckkraft = 0.5;
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => beiAntwort(i as 0 | 1 | 2 | 3)}
                    disabled={beantwortet}
                    className={`rounded-xl border border-rand bg-flaeche p-4 text-center text-lg font-semibold transition-colors disabled:cursor-default ${bewegung}`}
                    style={{ borderColor: rahmenfarbe, backgroundColor: hintergrund, opacity: deckkraft }}
                  >
                    {antwort}
                    {beantwortet && istRichtigeAntwort && (
                      <span aria-hidden="true" className="ml-2">
                        ✓
                      </span>
                    )}
                    {beantwortet && istAusgewaehlt && !istRichtigeAntwort && (
                      <span aria-hidden="true" className="ml-2">
                        ✗
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {beantwortet && (
              <div className="w-full rounded-karte border border-rand bg-flaeche-hoch p-4 text-sm">
                <span aria-hidden="true">💡</span> {wort.regel}
              </div>
            )}
          </div>
        </div>
      </div>

      {beantwortet && !z.vorbei && (
        <button
          type="button"
          onClick={beiWeiter}
          autoFocus
          className="spielknopf spielknopf-gross text-grund"
          style={{ backgroundColor: 'var(--color-fokus)' }}
        >
          Weiter
        </button>
      )}

      <p className="flex items-center gap-3 text-sm text-gedaempft">
        <span>Richtig erkannt: {z.richtigeAnzahl}</span>
        {/* Die Serie steuert die Punkte je Antwort (`punkteFuerAntwort` in
            logik.ts), war aber nirgends zu sehen — man konnte nicht wissen,
            warum dieselbe richtige Antwort mal 10 und mal 24 Punkte gibt.
            Bewusst kein Komboherz, gleiche Überlegung wie bei Brain Blitz:
            Eine Runde hat acht Wörter, die Serie kommt also höchstens auf 8,
            und dafür ist ein 86 Pixel großer Aufsatz zu viel Gerät für zu
            wenig Aussage. Als Wort und Zahl, nicht als Farbe allein. */}
        {z.serie >= 2 && <span className="font-bold text-fokus tabular-nums">Serie ×{z.serie}</span>}
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
