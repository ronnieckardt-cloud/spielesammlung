import { useCallback, useEffect, useState } from 'react';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { levelstand } from '../../core/levelstand';
import { sfx } from '../../core/sfx';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { GehirnjoggingIcon } from './Icon';
import { KopfrechnenAnzeige } from './KopfrechnenAnzeige';
import { aufgabeAbschliessen, naechsteAufgabe, neuesLevel } from './logik';
import type { Zustand } from './logik';
import { MerkfolgenAnzeige } from './MerkfolgenAnzeige';
import { MusterAnzeige } from './MusterAnzeige';

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

const VARIANTEN_NAMEN: Record<Zustand['variante'], string> = {
  kopfrechnen: 'Kopfrechnen',
  merkfolgen: 'Merk-Folgen',
  muster: 'Muster erkennen',
};

/** Rechenzeichen als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 9, y: 12, winkel: -12, verzoegerung: 0, inhalt: <Zeichen text="+" groesse={34} /> },
  { x: 85, y: 10, winkel: 14, verzoegerung: 0.6, inhalt: <Zeichen text="×" groesse={28} /> },
  { x: 87, y: 71, winkel: -8, verzoegerung: 1.2, inhalt: <Zeichen text="−" groesse={38} /> },
  { x: 5, y: 74, winkel: 10, verzoegerung: 0.35, inhalt: <Zeichen text="÷" groesse={30} /> },
  { x: 92, y: 42, winkel: 20, verzoegerung: 1.65, inhalt: <Zeichen text="=" groesse={24} /> },
  { x: 3, y: 44, winkel: -20, verzoegerung: 0.9, inhalt: <Zeichen text="?" groesse={32} /> },
];

function Zeichen({ text, groesse }: { text: string; groesse: number }) {
  return (
    <span
      aria-hidden="true"
      className="block font-black text-white/45"
      style={{ fontSize: groesse, lineHeight: 1 }}
    >
      {text}
    </span>
  );
}

export function Gehirnjogging({
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
  // Nur für Kopfrechnen/Muster: welche der vier Zahlen wurde angeklickt.
  // Merk-Folgen führt seine Eingabe selbst, siehe MerkfolgenAnzeige.
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);
  // Das „+N" über dem Aufgabenbereich. Ohne das war die Serie nur an der
  // Zahl in der Kopfzeile abzulesen, die man beim Antworten nicht ansieht.
  const gewinn = usePunktegewinn(z.punkte);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (z.vorbei) {
      sfx(z.richtigeAnzahl === z.aufgaben.length ? 'stufe' : 'ende');
      if (festesLevel === undefined) meldeLevel(z.level + 1);
      onGameOver(z.punkte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  // Auswahl zurücksetzen, sobald eine neue Aufgabe drankommt — auch beim
  // Levelwechsel, der den Index wieder auf 0 setzen kann, ohne dass sich
  // der Index selbst ändert.
  useEffect(() => {
    setAusgewaehlt(null);
  }, [z.index, z.level]);

  const beiErgebnis = useCallback(
    (richtig: boolean) => {
      // Doppelte Meldungen zur selben Aufgabe verwerfen, bevor ein Ton
      // läuft: `aufgabeAbschliessen` ist danach ein No-op, der Ton wäre
      // aber trotzdem zu hören gewesen.
      if (z.ergebnis !== null || z.vorbei) return;
      // Der Ton klettert mit der Serie eine Stufe höher — dasselbe Signal
      // wie die wachsende Punktzahl, nur hörbar (zweites Argument von
      // `sfx`, wie bei Pair Up). `z.serie` ist die Serie **vor** dieser
      // Antwort, die erste richtige bleibt also der Grundton.
      if (richtig) sfx('gut', Math.min(12, z.serie * 2));
      else sfx('schlecht');
      setZ((alt) => aufgabeAbschliessen(alt, richtig));
    },
    [z.ergebnis, z.serie, z.vorbei],
  );

  const beiZahlAntwort = useCallback(
    (index: 0 | 1 | 2 | 3, richtigIndex: 0 | 1 | 2 | 3) => {
      setAusgewaehlt(index);
      beiErgebnis(index === richtigIndex);
    },
    [beiErgebnis],
  );

  const beiWeiter = useCallback(() => setZ((alt) => naechsteAufgabe(alt)), []);

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
        titel="Brain Blitz"
        untertitel="Rechnen, merken, Muster erkennen."
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #f59e0b 0%, #db2777 48%, #6d28d9 100%)"
        deko={DEKO}
        Symbol={GehirnjoggingIcon}
        knopfFarbe="#be185d"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const aufgabe = z.aufgaben[z.index];
  if (!aufgabe) return null;

  const beantwortet = z.ergebnis !== null;

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
          Aufgabe {z.index + 1} / {z.aufgaben.length}
        </span>
      </div>

      <div
        className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-flaeche-hoch"
        role="progressbar"
        aria-label="Fortschritt in dieser Runde"
        aria-valuemin={0}
        aria-valuemax={z.aufgaben.length}
        aria-valuenow={z.index}
      >
        <div
          className="h-full rounded-full bg-fokus transition-[width] duration-200"
          style={{ width: `${(z.index / z.aufgaben.length) * 100}%` }}
        />
      </div>

      {/* Die Bühne wie in den anderen Spielen: Sie bringt den farbigen
          Schein hinter dem Inhalt (`.spielbuehne::before`) und den Auftritt
          beim Rundenstart (`buehne-rein`) mit — beides hängt in index.css an
          `.spielbuehne` selbst, dieses Spiel hatte die Klasse als eines von
          fünf nie gesetzt und ging deshalb leer aus.

          Wichtig ist der Aufbau darin: Die Bühne ist ein Größen-Container
          (`container-type: size`) und holt ihre Höhe aus dem, was nach
          Kopfzeile, Weiter-Knopf und Fußzeile übrig bleibt — nicht aus
          ihrem Inhalt. Der Inhalt bekommt deshalb `max-h-full`, und das
          Scrollen liegt eine Ebene tiefer. Auf einem kurzen Bildschirm
          scrollt damit nur der Aufgabenteil, der Weiter-Knopf bleibt
          erreichbar. */}
      <div className="spielbuehne">
        <div className="relative flex max-h-full w-full max-w-md flex-col items-center gap-2">
          {/* Das Popup gehört in diesen Kasten und nicht direkt in die Bühne
              — genau wie bei Ghost Chase. Ein `absolute`-Kind der Bühne
              wird von der Regel `.spielbuehne > *:not(.absolute)` zwar
              verschont, aber hier hat es ohnehin den passenden Bezugspunkt. */}
          <Punktegewinn gewinn={gewinn} />

          <div className="flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto">
            <span className="text-xs font-medium tracking-wide text-gedaempft uppercase">
              {VARIANTEN_NAMEN[z.variante]}
            </span>

            {aufgabe.art === 'kopfrechnen' && (
              <KopfrechnenAnzeige
                aufgabe={aufgabe.daten}
                ausgewaehlt={ausgewaehlt}
                onWaehlen={(i) => beiZahlAntwort(i, aufgabe.daten.richtig)}
              />
            )}
            {aufgabe.art === 'muster' && (
              <MusterAnzeige
                aufgabe={aufgabe.daten}
                ausgewaehlt={ausgewaehlt}
                onWaehlen={(i) => beiZahlAntwort(i, aufgabe.daten.richtig)}
              />
            )}
            {aufgabe.art === 'merkfolgen' && (
              <MerkfolgenAnzeige
                key={`${z.level}-${z.index}`}
                aufgabe={aufgabe.daten}
                reducedMotion={settings.reducedMotion}
                onFertig={beiErgebnis}
              />
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
        <span>Richtig gelöst: {z.richtigeAnzahl}</span>
        {/* Die Serie steuert die Punkte je Antwort (`punkteFuerAntwort` in
            logik.ts), war aber nirgends zu sehen — der Spieler konnte nicht
            wissen, warum dieselbe richtige Antwort mal 10 und mal 18 Punkte
            gibt. Bewusst kein Komboherz: Eine Runde hat fünf Aufgaben, die
            Serie kommt also höchstens auf 5, und dafür ist ein 86 Pixel
            großer Aufsatz über dem Aufgabenbereich zu viel Gerät für zu
            wenig Aussage. Als Wort und Zahl, nicht als Farbe allein. */}
        {z.serie >= 2 && (
          <span className="font-bold text-fokus tabular-nums">Serie ×{z.serie}</span>
        )}
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
