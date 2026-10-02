import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { haptik } from '../../core/haptik';
import { Komboherz } from '../../core/Komboherz';
import { levelstand } from '../../core/levelstand';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import {
  BLICK_KOSTEN,
  aufdecken,
  blickEnde,
  blickMoeglich,
  blickNutzen,
  fehlerBisWirbel,
  gefundenePaare,
  neuesSpiel,
  schliessen,
  zeileBlickbar,
} from './logik';
import type { Zustand } from './logik';
import { MOTIVE, MotivBild } from './motive';
import { PaarUpIcon } from './Icon';

/** Wie lange ein Fehlgriff offen liegen bleibt, bevor er zugedeckt wird. */
const ZUDECKEN_MS = 900;

/** Wie lange eine Zeile im Blick aufgedeckt bleibt. Länger als ein Fehlgriff: Es sind mehr Karten zu merken. */
const BLICK_MS = 2000;

/** Wie lange die Karten nach einem Wirbel durcheinanderwackeln, und wie lange die Meldung steht. */
const WIRBEL_MS = 800;
const MELDUNG_MS = 1600;

/** Ein Schild über dem Brett. */
type Meldung = { id: number; text: string };

/** Ein Auge — für den Blick-Knopf. Pfad statt Emoji, wie bei allen Symbolen hier. */
function AugenSymbol() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

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
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(festesLevel ?? levelStand.anfang(startLevel)));
  // `true`, solange man den Blick-Knopf angetippt hat und eine Zeile wählen soll — dann deckt ein Antippen
  // nicht eine Karte auf, sondern schaut in ihre Zeile (derselbe Modus wie der Hammer in Merge Up).
  const [blickWahl, setBlickWahl] = useState(false);
  const [wirbelt, setWirbelt] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const meldungIdRef = useRef(0);
  const melden = useCallback((text: string) => {
    meldungIdRef.current += 1;
    setMeldung({ id: meldungIdRef.current, text });
  }, []);

  const beiKarte = useCallback(
    (position: number) => {
      if (blickWahl) {
        const zeile = Math.floor(position / z.spalten);
        const neu = blickNutzen(z, zeile);
        if (neu === z) {
          sfx('schlecht');
          return;
        }
        setBlickWahl(false);
        setZ(neu);
        sfx('klick', 6);
        return;
      }
      setZ((alt) => aufdecken(alt, position));
    },
    [blickWahl, z],
  );

  // Merker für den Ton-Effekt weiter unten. Sie stehen hier oben, weil der
  // Levelwechsel sie mit zurücksetzen muss.
  const vorZuegenRef = useRef(z.zuege);
  const vorPaarenRef = useRef(0);
  const vorBlickRef = useRef(z.blick);
  const vorWirbelRef = useRef(z.wirbel);

  const beiLevelWechsel = useCallback(
    (level: number) => {
      // Im Duell steht das Level fest — sonst könnte man sich das
      // leichteste aussuchen und der Vergleich wäre wertlos.
      if (festesLevel !== undefined) return;
      const ziel = Math.max(1, level);
      meldeLevel(ziel);
      // Beide Merker müssen mit auf null: Das neue Feld fängt bei null Zügen
      // und null Paaren an. Ohne das sah der Ton-Effekt einen veränderten
      // Zugzähler und kein neues Paar — und spielte den Fehlerton, als hätte
      // man sich vertippt, obwohl man nur weitergeblättert hat.
      vorZuegenRef.current = 0;
      vorPaarenRef.current = 0;
      const neu = neuesSpiel(ziel);
      // Auch die Merker für Blick und Wirbel: Sonst sähe der Effekt unten im neuen Feld einen „verdienten" Blick.
      vorBlickRef.current = neu.blick;
      vorWirbelRef.current = neu.wirbel;
      setBlickWahl(false);
      setMeldung(null);
      setZ(neu);
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

  // Der Blick endet nach seiner Wartezeit von selbst — die Logik kennt keine Uhr, sie merkt sich nur, welche
  // Zeile gerade aufgedeckt ist.
  useEffect(() => {
    if (z.blickZeile === null) return;
    const uhr = window.setTimeout(() => setZ(blickEnde), BLICK_MS);
    return () => window.clearTimeout(uhr);
  }, [z.blickZeile]);

  // Einen Blick verdient, einen Wirbel erlebt: Beides ist ein Ereignis, das man bemerken muss.
  useEffect(() => {
    if (z.blick > vorBlickRef.current) {
      melden('Blick verdient!');
      sfx('stufe');
    }
    vorBlickRef.current = z.blick;
  }, [z.blick, melden]);

  useEffect(() => {
    if (z.wirbel > vorWirbelRef.current) {
      setWirbelt(true);
      melden('Wirbel! Alle verdeckten Karten haben getauscht.');
      sfx('schlecht');
      haptik('fehler');
    }
    vorWirbelRef.current = z.wirbel;
  }, [z.wirbel, melden]);

  useEffect(() => {
    if (!wirbelt) return;
    const uhr = window.setTimeout(() => setWirbelt(false), WIRBEL_MS);
    return () => window.clearTimeout(uhr);
  }, [wirbelt]);

  useEffect(() => {
    if (!meldung) return;
    const uhr = window.setTimeout(() => setMeldung((alt) => (alt?.id === meldung.id ? null : alt)), MELDUNG_MS);
    return () => window.clearTimeout(uhr);
  }, [meldung]);

  // Nach dem Ende oder wenn kein Blick mehr geht, ist der Wahlmodus sinnlos.
  useEffect(() => {
    if (blickWahl && (z.vorbei || z.blick <= 0 || z.fehlgriff)) setBlickWahl(false);
  }, [blickWahl, z.vorbei, z.blick, z.fehlgriff]);

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
    if (festesLevel === undefined && z.gewonnen) meldeLevel(z.level + 1);
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
      <div className="relative flex w-full max-w-md items-center justify-center">
        <output
          aria-live="off"
          key={z.punkte}
          className="punkte-bumsen text-4xl font-black tabular-nums text-text sm:text-5xl"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {z.punkte}
        </output>
        {/* Das Herz wächst mit der Serie. Es liegt neben der Zahl und kostet keine Höhe. */}
        <Komboherz
          kombo={z.serie}
          ruhig={settings.reducedMotion}
          beschriftung="Serie"
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2"
        />
      </div>

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
            const imBlick = z.blickZeile !== null && Math.floor(i / z.spalten) === z.blickZeile && !karte.gefunden;
            const offen = karte.gefunden || z.offen.includes(i) || imBlick;
            // Beim Wählen der Blick-Zeile: Nur wo er sich lohnt, bekommt die Karte den gestrichelten Rahmen.
            const zielbar = blickWahl && !karte.gefunden && zeileBlickbar(z, Math.floor(i / z.spalten));
            // Nur die beiden Karten, die gerade nicht zusammenpassen.
            const falsch = z.fehlgriff && z.offen.includes(i);
            const motiv = MOTIVE[karte.motiv]!;
            return (
              <button
                key={i}
                type="button"
                onClick={() => beiKarte(i)}
                disabled={(offen && !imBlick) || z.offen.length >= 2 || z.blickZeile !== null}
                aria-label={
                  offen
                    ? `${motiv.name}${karte.gefunden ? ', gefunden' : falsch ? ', passt nicht' : imBlick ? ', im Blick' : ''}`
                    : blickWahl
                      ? `Verdeckte Karte, Zeile ${Math.floor(i / z.spalten) + 1} ansehen`
                      : 'Verdeckte Karte'
                }
                className={`karte-huelle aspect-3/4 min-h-0 w-full ${
                  karte.gefunden ? 'karte-erledigt' : ''
                } ${falsch ? 'karte-falsch' : ''} ${imBlick ? 'karte-blick' : ''} ${zielbar ? 'karte-zielbar' : ''} ${
                  wirbelt && !karte.gefunden && !settings.reducedMotion ? 'karte-wirbel' : ''
                }`}
                style={wirbelt ? ({ '--wirbel-versatz': `${(i % 7) * 40}ms` } as CSSProperties) : undefined}
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

          {/* Ein Schild oben im Brett — es nimmt keine Berührung an, der Finger spielt weiter. Beim Wählen der
              Blick-Zeile bleibt es stehen und sagt, was zu tun ist; sonst zeigt es kurz ein Ereignis. */}
          {(blickWahl || meldung) && (
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-center" role="status">
              <p
                key={blickWahl ? 'wahl' : meldung?.id}
                className={`${settings.reducedMotion ? '' : 'bubble-meldung '}max-w-full rounded-full border border-white/30 bg-black/75 px-4 py-1.5 text-center text-sm font-bold text-white shadow-xl backdrop-blur-sm`}
              >
                {blickWahl ? 'Tippe eine Karte — ihre Zeile wird aufgedeckt.' : meldung?.text}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Unter dem Brett: der Blick (Symbol, Wort und Vorrat) und der Wirbel-Zähler, wo es einen gibt. Beides
          erscheint erst, wo es etwas bedeutet — auf den kleinen Feldern gäbe es nichts zu merken. */}
      {(z.blick > 0 || z.blicke > 0 || fehlerBisWirbel(z) !== null) && (
        <div className="flex w-full max-w-md items-stretch justify-between gap-2 text-gedaempft md:max-w-xl">
          <button
            type="button"
            onClick={() => setBlickWahl((an) => !an)}
            disabled={!blickWahl && !blickMoeglich(z)}
            aria-pressed={blickWahl}
            aria-label={
              z.blick <= 0
                ? 'Kein Blick im Vorrat. Man verdient einen mit drei Paaren in Folge.'
                : blickWahl
                  ? 'Blick abbrechen'
                  : `Blick nehmen: Eine Zeile deiner Wahl wird kurz aufgedeckt. Kostet ${BLICK_KOSTEN} Punkte. ${z.blick} im Vorrat.`
            }
            className="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-bold transition-[transform,opacity] duration-100 enabled:active:scale-95 disabled:opacity-35"
            style={
              blickWahl
                ? { borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.28)', color: '#fff' }
                : z.blick > 0
                  ? { borderColor: '#fbbf24', backgroundColor: 'var(--color-flaeche)', color: 'var(--color-text)' }
                  : { borderColor: 'var(--color-rand)', backgroundColor: 'var(--color-flaeche)', color: 'var(--color-text)' }
            }
          >
            <AugenSymbol />
            <span>{blickWahl ? 'Abbrechen' : 'Blick'}</span>
            {!blickWahl && (
              <span aria-hidden="true" className="rounded-full bg-black/35 px-1.5 text-xs tabular-nums">
                ×{z.blick}
              </span>
            )}
          </button>

          {fehlerBisWirbel(z) !== null && (
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1">
              {/* Die Punkte sind die Fehlgriffe bis zum Wirbel: gefüllt gegen leer ist ein Formunterschied. */}
              <span className={`text-[11px] leading-none font-semibold ${fehlerBisWirbel(z) === 1 ? 'font-bold text-warnung' : ''}`}>
                {fehlerBisWirbel(z) === 1 ? 'Gleich Wirbel!' : 'Wirbel'}
              </span>
              <span
                role="img"
                aria-label={`Noch ${fehlerBisWirbel(z)} Fehlgriffe bis zum Wirbel.`}
                className="flex items-center gap-1"
              >
                {Array.from({ length: z.fehlerSeitWirbel + (fehlerBisWirbel(z) ?? 0) }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      i < z.fehlerSeitWirbel
                        ? fehlerBisWirbel(z) === 1
                          ? 'bg-warnung'
                          : 'bg-gedaempft'
                        : 'border border-gedaempft/70'
                    }`}
                  />
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Tippe zwei Karten an. Passen sie zusammen, bleiben sie liegen — und mehrere Paare in Folge bringen
        Zuschlag. Der Blick deckt eine Zeile kurz auf (kostet {BLICK_KOSTEN} Punkte). Ab Level 9 mischt jeder
        sechste Fehlgriff die verdeckten Karten neu.
        {z.zugGrenze !== null && ` Auf diesem Level hast du höchstens ${z.zugGrenze} Züge.`}
      </p>

      {/* Die verbleibenden Züge kommen erst dazu, wenn es knapp wird. Sonst
          läse ein Screenreader nach **jedem** Zug den ganzen Satz vor,
          obwohl bei fünfzig freien Zügen nichts zu entscheiden ist. */}
      <p className="sr-only" aria-live="polite">
        {geschafft} von {paare} Paaren gefunden.
        {z.serie >= 2 && ` Serie von ${z.serie}.`}
        {knapp && ` Noch ${uebrig} ${uebrig === 1 ? 'Zug' : 'Züge'} übrig.`}
        {meldung && ` ${meldung.text}`}
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
