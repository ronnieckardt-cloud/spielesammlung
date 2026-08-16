import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { haptik } from '../../core/haptik';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
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
        {/* `h1`, nicht `h2`: Der Spieltitel ist auf diesem Bildschirm die
            oberste Überschrift — mit `h2` fehlt Screenreadern die erste
            Ebene, und man springt beim Durchblättern der Überschriften ins
            Leere. Merge Up und Bubble Pop machen es genauso. */}
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          Pair Up
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/80">
          Finde alle Paare!
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
        // Wer mit der Tastatur kommt, soll sofort loslegen können — genau
        // wie in core/Startbildschirm.tsx, Merge Up und Bubble Pop. Hier
        // fehlte es als einzigem der drei Titelbilder.
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-fuchsia-700 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function PaarUp({
  onScore,
  onGameOver,
  settings,
  bestScore,
  istErsteRunde,
  level: festesLevel,
}: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(festesLevel ?? naechsteLevelNummer));

  const beiKarte = useCallback((position: number) => {
    setZ((alt) => aufdecken(alt, position));
  }, []);

  // Merker für den Ton-Effekt weiter unten. Sie stehen hier oben, weil der
  // Levelwechsel sie mit zurücksetzen muss.
  const vorZuegenRef = useRef(z.zuege);
  const vorPaarenRef = useRef(0);

  const beiLevelWechsel = useCallback(
    (level: number) => {
      // Im Duell steht das Level fest — sonst könnte man sich das
      // leichteste aussuchen und der Vergleich wäre wertlos.
      if (festesLevel !== undefined) return;
      const ziel = Math.max(1, level);
      naechsteLevelNummer = ziel;
      // Beide Merker müssen mit auf null: Das neue Feld fängt bei null Zügen
      // und null Paaren an. Ohne das sah der Ton-Effekt einen veränderten
      // Zugzähler und kein neues Paar — und spielte den Fehlerton, als hätte
      // man sich vertippt, obwohl man nur weitergeblättert hat.
      vorZuegenRef.current = 0;
      vorPaarenRef.current = 0;
      setZ(neuesSpiel(ziel));
    },
    [festesLevel],
  );

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

  // Das „+N" über dem Brett. Ein Treffer bringt immer glatte 100, ein
  // Fehlgriff kostet 12 — Abzüge zeigt der Baustein bewusst nicht an.
  const gewinn = usePunktegewinn(z.punkte);

  // Ton bei Treffer und Fehlgriff. Hängt an `zuege`, nicht an `fehlgriff` —
  // sonst käme bei zwei Fehlgriffen hintereinander nur einmal ein Ton.
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
    sfx(z.gewonnen ? 'stufe' : 'ende');
    haptik(z.gewonnen ? 'jubel' : 'ende');
    // Nach einem geschafften Level geht „Nochmal" ins nächste — dasselbe
    // Feld noch einmal wäre bei einem Merkspiel sinnlos, man weiß ja noch,
    // wo alles liegt. Nach einer aufgebrauchten Zuggrenze bleibt es beim
    // selben Level: Da ist das Wissen aus der verlorenen Runde genau das,
    // womit man den zweiten Versuch schafft.
    if (festesLevel === undefined && z.gewonnen) naechsteLevelNummer = z.level + 1;
    onGameOver(z.punkte, z.gewonnen);
    // onGameOver darf nur einmal kommen — deshalb hängt das nur an "vorbei".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  if (!gestartet) {
    return <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />;
  }

  const paare = z.karten.length / 2;
  const geschafft = gefundenePaare(z);
  const uebrig = z.zugGrenze === null ? null : z.zugGrenze - z.zuege;
  // Ab fünf verbleibenden Zügen wird die Zahl farbig. Die Zahl selbst steht
  // ohnehin da — die Farbe verstärkt nur, sie ist nie das einzige Merkmal.
  const knapp = uebrig !== null && uebrig <= 5;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden p-3">
      {/* Der Punktestand stand bisher nur klein in der Kopfzeile der Hülle —
          und dort die ganze Runde über auf 0, weil er erst am Schluss
          gerechnet wurde. Jetzt läuft er mit und steht groß über dem Feld,
          wie bei Merge Up und Bubble Pop. Eine Stufe kleiner als dort
          (4xl/5xl statt 5xl/6xl): Hier steht darunter noch die Zeile mit
          Level, Paaren und Zügen, und die Karten sind hochkant — der Platz
          über dem Brett ist knapper als in den beiden anderen Spielen. */}
      <output
        aria-live="off"
        key={z.punkte}
        className="punkte-bumsen text-4xl font-black tabular-nums text-text sm:text-5xl"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {z.punkte}
      </output>

      <div className="flex w-full max-w-md items-center justify-between text-sm">
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
        <span className="tabular-nums text-gedaempft">
          {geschafft}/{paare} Paare ·{' '}
          <span className={knapp ? 'font-bold text-warnung' : undefined}>
            {z.zugGrenze === null
              ? `${z.zuege} ${z.zuege === 1 ? 'Zug' : 'Züge'}`
              : `${z.zuege}/${z.zugGrenze} Züge`}
          </span>
        </span>
      </div>

      <div className="spielbuehne">
        <div
          className="spielbrett spielbrett-rahmen relative grid gap-2 p-2"
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

          {/* Gehört ins Brett, nicht in die Bühne: Die Bühne ist der ganze
              freie Platz, das „+N" soll aber über den Karten stehen. */}
          <Punktegewinn gewinn={gewinn} />
        </div>
      </div>

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Tippe zwei Karten an. Passen sie zusammen, bleiben sie liegen. Je
        weniger Züge du brauchst, desto mehr Punkte gibt es.
        {z.zugGrenze !== null && ` Auf diesem Level hast du höchstens ${z.zugGrenze} Züge.`}
      </p>

      {/* Die verbleibenden Züge kommen erst dazu, wenn es knapp wird. Sonst
          läse ein Screenreader nach **jedem** Zug den ganzen Satz vor,
          obwohl bei fünfzig freien Zügen nichts zu entscheiden ist. */}
      <p className="sr-only" aria-live="polite">
        {geschafft} von {paare} Paaren gefunden.
        {knapp && ` Noch ${uebrig} ${uebrig === 1 ? 'Zug' : 'Züge'} übrig.`}
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
