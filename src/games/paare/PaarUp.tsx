import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { aufdecken, gefundenePaare, neuesSpiel, schliessen } from './logik';
import type { Zustand } from './logik';
import { MOTIVE, MotivBild } from './motive';
import { PaarUpIcon } from './Icon';

/** Wie lange ein Fehlgriff offen liegen bleibt, bevor er zugedeckt wird. */
const ZUDECKEN_MS = 900;

/**
 * Welches Level als Nächstes drankommt — wie beim Quiz und beim
 * Farbsortierer eine Modul-Variable, weil „Nochmal" die Komponente
 * komplett neu mountet und ein `useState` dabei zurückgesetzt würde.
 *
 * Anders als beim Farbsortierer geht es hier nach einem Sieg ins **nächste**
 * Level, nicht noch einmal ins selbe: Dasselbe Feld ein zweites Mal zu
 * spielen ist bei einem Merkspiel sinnlos, man weiß ja noch, wo alles liegt.
 */
let naechsteLevelNummer = 1;

/** Schwebende Karten im Hintergrund des Startbildschirms, feste Liste. */
const DEKO_KARTEN: readonly {
  x: number;
  y: number;
  groesse: number;
  winkel: number;
  motiv: number;
  verzoegerung: number;
}[] = [
  { x: 8, y: 12, groesse: 54, winkel: -12, motiv: 0, verzoegerung: 0 },
  { x: 84, y: 10, groesse: 44, winkel: 14, motiv: 1, verzoegerung: 0.7 },
  { x: 88, y: 68, groesse: 58, winkel: -8, motiv: 4, verzoegerung: 1.3 },
  { x: 5, y: 72, groesse: 48, winkel: 10, motiv: 10, verzoegerung: 0.4 },
  { x: 90, y: 40, groesse: 36, winkel: 22, motiv: 8, verzoegerung: 1.7 },
  { x: 3, y: 42, groesse: 38, winkel: -20, motiv: 3, verzoegerung: 1.0 },
];

/** Titelbild — eigene Gestaltung, Vorlage ist der Blockblitz-Startbildschirm. */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(155deg, #0e7490 0%, #6366f1 45%, #a21caf 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_KARTEN.map((k, i) => (
          <span
            key={i}
            className="block-schweben absolute grid place-items-center rounded-xl bg-white/90 shadow-xl"
            style={
              {
                left: `${k.x}%`,
                top: `${k.y}%`,
                width: k.groesse,
                height: k.groesse * 1.3,
                animationDelay: `${k.verzoegerung}s`,
                '--grundwinkel': `${k.winkel}deg`,
              } as CSSProperties
            }
          >
            <MotivBild motiv={MOTIVE[k.motiv]!} groesse={k.groesse * 0.62} />
          </span>
        ))}
      </div>

      <PaarUpIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h2
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Pair Up
        </h2>
        <p className="mt-3 text-sm font-semibold text-white/80">
          {bestScore > 0 ? `Beste Punktzahl: ${bestScore}` : 'Finde alle Paare!'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-fuchsia-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function PaarUp({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(naechsteLevelNummer));

  const beiKarte = useCallback((position: number) => {
    setZ((alt) => aufdecken(alt, position));
  }, []);

  const beiLevelWechsel = useCallback((level: number) => {
    const ziel = Math.max(1, level);
    naechsteLevelNummer = ziel;
    setZ(neuesSpiel(ziel));
  }, []);

  // Ein Fehlgriff bleibt kurz liegen, damit man ihn sich merken kann, und
  // deckt sich dann selbst wieder zu. Die Logik kennt keine Uhr — sie merkt
  // sich nur, *dass* ein Fehlgriff offen ist.
  useEffect(() => {
    if (!z.fehlgriff) return;
    const uhr = window.setTimeout(() => setZ(schliessen), ZUDECKEN_MS);
    return () => window.clearTimeout(uhr);
  }, [z.fehlgriff, z.zuege]);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  // Ton bei Treffer und Fehlgriff. Hängt an `zuege`, nicht an `fehlgriff` —
  // sonst käme bei zwei Fehlgriffen hintereinander nur einmal ein Ton.
  const vorZuegenRef = useRef(z.zuege);
  const vorPaarenRef = useRef(0);
  useEffect(() => {
    if (z.zuege === vorZuegenRef.current) return;
    vorZuegenRef.current = z.zuege;
    const paare = gefundenePaare(z);
    // Je weiter die Runde, desto höher der Treffer-Ton.
    if (paare > vorPaarenRef.current) sfx('gut', (paare - 1) * 2);
    else sfx('schlecht');
    vorPaarenRef.current = paare;
  }, [z]);

  useEffect(() => {
    if (!z.vorbei) return;
    sfx('stufe');
    // Nach einem geschafften Level geht „Nochmal" ins nächste.
    naechsteLevelNummer = z.level + 1;
    onGameOver(z.punkte, true);
    // onGameOver darf nur einmal kommen — deshalb hängt das nur an "vorbei".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const paare = z.karten.length / 2;
  const geschafft = gefundenePaare(z);

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden p-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1}
            aria-label="Voriges Level"
            className="spielknopf text-base leading-none"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            aria-label="Nächstes Level"
            className="spielknopf text-base leading-none"
          >
            ›
          </button>
        </div>
        <span className="tabular-nums text-gedaempft">
          {geschafft}/{paare} Paare · {z.zuege} {z.zuege === 1 ? 'Zug' : 'Züge'}
        </span>
      </div>

      <div className="spielbuehne">
        <div
          className="spielbrett spielbrett-rahmen grid gap-2 p-2"
          style={
            {
              gridTemplateColumns: `repeat(${z.spalten}, minmax(0, 1fr))`,
              // Karten sind hochkant (Verhältnis 3:4), deshalb rechnet sich
              // das Seitenverhältnis des Bretts aus Spalten mal 3 zu Zeilen
              // mal 4 — sonst quetscht `.spielbrett` sie zu Quadraten.
              '--vz': (z.spalten * 3) / ((z.karten.length / z.spalten) * 4),
            } as CSSProperties
          }
        >
          {z.karten.map((karte, i) => {
            const offen = karte.gefunden || z.offen.includes(i);
            // Nur die beiden Karten, die gerade nicht zusammenpassen.
            const falsch = z.fehlgriff && z.offen.includes(i);
            const motiv = MOTIVE[karte.motiv]!;
            return (
              <button
                key={i}
                type="button"
                onClick={() => beiKarte(i)}
                disabled={offen || z.offen.length >= 2}
                aria-label={
                  offen
                    ? `${motiv.name}${karte.gefunden ? ', gefunden' : falsch ? ', passt nicht' : ''}`
                    : 'Verdeckte Karte'
                }
                className={`karte-huelle aspect-3/4 min-h-0 w-full ${
                  karte.gefunden ? 'karte-erledigt' : ''
                } ${falsch ? 'karte-falsch' : ''}`}
              >
                <span className={`karte-dreher ${offen ? 'karte-offen' : ''}`}>
                  {/* Rückseite: das, was man sieht, solange die Karte liegt. */}
                  <span className="karte-seite karte-rueckseite">
                    <span aria-hidden="true" className="text-2xl opacity-70">
                      ?
                    </span>
                  </span>
                  {/* Vorderseite, um 180° gedreht — beim Umschlagen kommt sie
                      nach vorn. */}
                  <span className="karte-seite karte-vorderseite">
                    <MotivBild motiv={motiv} groesse="72%" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Tippe zwei Karten an. Passen sie zusammen, bleiben sie liegen. Je
        weniger Züge du brauchst, desto mehr Punkte gibt es.
      </p>

      <p className="sr-only" aria-live="polite">
        {geschafft} von {paare} Paaren gefunden.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
