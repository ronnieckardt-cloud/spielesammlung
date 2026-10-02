import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ZeigerEreignis } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { Komboherz } from '../../core/Komboherz';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import {
  ETAPPEN_BONUS,
  ETAPPE_LAENGE,
  SICHT_HOCH,
  SICHT_RUNTER,
  etappeVon,
  etappenNeuheit,
  neuesSpielAb,
  serieFaktor,
  springen,
  takt,
} from './logik';
import type { Zustand } from './logik';
import { FARBEN, farbe } from './farben';
import { Farbwechsel, Hindernis, Kugel } from './figuren';
import { FarbringeIcon } from './Icon';

/**
 * Ring Rise — die Kugel steigt durch drehende Farbringe.
 *
 * Nicht „Color Switch": Das ist der Name eines bekannten Vorbilds, und hier
 * gilt die Projektregel — das Prinzip ist frei, der Name nicht.
 *
 * Diese Datei zeigt nur an und nimmt Eingaben entgegen. Alles Rechnende
 * steht in `logik.ts` und ist ohne Browser geprüft.
 */

/**
 * Die Größe des Ausschnitts in Welteinheiten.
 *
 * `SICHT_HOCH` und `SICHT_RUNTER` stehen in `logik.ts`, weil die Fallgrenze
 * daran hängt: Die Runde soll genau dann enden, wenn die Kugel unten an der
 * Bildkante ankommt.
 */
const BREITE = 100;
const HOEHE = SICHT_HOCH + SICHT_RUNTER;

/** Wie lange die Etappen-Meldung steht (ms). */
const MELDUNG_MS = 2200;

type Meldung = { id: number; etappe: number; bonus: number; neu: string | null };

/** Deko für den Startbildschirm: vier Ringe in den vier Farben. */
const DEKO: readonly DekoTeil[] = FARBEN.map((f, i) => ({
  x: [8, 88, 90, 6][i]!,
  y: [16, 12, 68, 72][i]!,
  verzoegerung: i * 0.45,
  inhalt: (
    <svg viewBox="-20 -20 40 40" className="size-14">
      <circle
        r={15}
        fill="none"
        stroke={f.hex}
        strokeWidth={5}
        strokeDasharray={f.muster}
        opacity={0.85}
      />
    </svg>
  ),
}));

/**
 * Prüfhaken nur für Bildschirmfotos (auf einem echten Gerät nie gesetzt):
 * `globalThis.__ringStart = { geschafft, halt }` beginnt nach so vielen
 * Hindernissen und hält die Uhr an, damit man das Bild in Ruhe ansehen kann.
 * Solange er gesetzt ist, liefert `globalThis.__ringStand()` den laufenden
 * Zustand — damit lässt sich das Spiel von außen mit echten Touch-Ereignissen spielen.
 */
function pruefhaken(): { geschafft?: number; halt?: boolean } | undefined {
  return (globalThis as { __ringStart?: { geschafft?: number; halt?: boolean } }).__ringStart;
}

export function RingRise({ onScore, onGameOver, bestScore, istErsteRunde, settings }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() =>
    neuesSpielAb(saatAus('farbringe', Date.now()), pruefhaken()?.geschafft ?? 0),
  );
  const gemeldet = useRef(false);
  const zRef = useRef(z);
  zRef.current = z;
  if (pruefhaken()) (globalThis as { __ringStand?: () => Zustand }).__ringStand = () => zRef.current;
  const gewinn = usePunktegewinn(z.punkte);

  useGameLoop((dt) => setZ((alt) => takt(alt, dt)), { fps: 60, running: gestartet && !z.vorbei && !pruefhaken()?.halt });

  // Töne und Meldungen hängen an der Änderung, nicht am Takt — sonst
  // klingelt es sechzigmal je Sekunde.
  const vorher = useRef({ punkte: 0, geschafft: 0, serie: 0 });
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  useEffect(() => {
    const v = vorher.current;
    if (z.punkte > v.punkte) onScore(z.punkte);
    if (z.geschafft > v.geschafft) {
      // Mitten durch: Die Tonhöhe klettert mit der Serie, gedeckelt wie überall.
      // Am Rand durch: nur ein schlichtes Klicken — geschafft, aber ohne Glanz.
      if (z.serie > v.serie) sfx('gut', Math.min(12, (z.serie - 1) * 2));
      else sfx('klick');
      if (z.geschafft % ETAPPE_LAENGE === 0) {
        const geschafft = etappeVon(z.geschafft - 1);
        sfx('stufe');
        setMeldung({
          id: z.geschafft,
          etappe: geschafft,
          bonus: ETAPPEN_BONUS * geschafft,
          neu: etappenNeuheit(geschafft + 1)?.text ?? null,
        });
      }
    }
    vorher.current = { punkte: z.punkte, geschafft: z.geschafft, serie: z.serie };
  }, [z.punkte, z.geschafft, z.serie, onScore]);

  useEffect(() => {
    if (!meldung) return;
    const uhr = window.setTimeout(() => setMeldung(null), MELDUNG_MS);
    return () => window.clearTimeout(uhr);
  }, [meldung]);

  useEffect(() => {
    if (!z.vorbei || gemeldet.current) return;
    gemeldet.current = true;
    sfx('ende');
    onGameOver(z.punkte);
  }, [z.vorbei, z.punkte, onGameOver]);

  const hopsen = useCallback(() => {
    if (z.vorbei) return;
    setZ((alt) => springen(alt));
    sfx('klick');
  }, [z.vorbei]);

  /**
   * Springen auf der **ganzen Seite**, nicht nur auf dem Brett.
   *
   * Vorher hing der Griff am Brett allein. Daneben — auf dem Punktestand,
   * der Zeile „Deine Farbe", dem Hilfetext oder den Rändern links und
   * rechts — passierte nichts, und die Kugel fiel weiter. Beim schnellen
   * Tippen trifft man aber genau dorthin, und ein Sprungspiel, das jeden
   * dritten Tipp verschluckt, fühlt sich kaputt an.
   *
   * Knöpfe und Verweise bleiben ausgenommen, dieselbe Prüfung wie im
   * Tastatur-Listener unten.
   */
  const antippen = useCallback(
    (e: ZeigerEreignis<HTMLDivElement>) => {
      if (e.target instanceof Element && e.target.closest('button, a[href]')) return;
      // Beim Berühren, nicht beim Loslassen: Alles andere fühlt sich bei
      // einem Sprungspiel träge an.
      e.preventDefault();
      hopsen();
    },
    [hopsen],
  );

  /**
   * Eigener Tastatur-Listener statt `useInput`.
   *
   * Genau wie bei Blade Toss: `useInput` meldet ein Antippen erst beim
   * Loslassen. Zusammen mit `antippen` oben käme jeder Tipp zweimal an —
   * und ein doppelter Sprung wirft die Kugel viel zu hoch.
   */
  useEffect(() => {
    if (!gestartet || z.vorbei) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'ArrowUp') return;
      if (e.target instanceof Element && e.target.closest('button, a[href]')) return;
      e.preventDefault();
      hopsen();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [gestartet, z.vorbei, hopsen]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Ring Rise"
        untertitel="Tippe, um zu steigen — durch darfst du nur bei deiner Farbe. Fliegst du mitten durch, wächst deine Serie."
        bestScore={bestScore}
        verlauf="linear-gradient(165deg, #4338ca 0%, #312e81 45%, #020617 100%)"
        deko={DEKO}
        Symbol={FarbringeIcon}
        knopfFarbe="#312e81"
        onStart={() => setGestartet(true)}
      />
    );
  }

  // Die Kamera folgt nur nach oben. Fällt die Kugel zurück, bleibt das Bild
  // stehen — daran sieht man sofort, dass man gerade Boden verliert.
  const kamera = z.hoehe;
  const bildY = (weltY: number) => kamera + SICHT_HOCH - weltY;
  /** Ist etwas nah genug am Bild, um gezeichnet zu werden? */
  const sichtbar = (weltY: number) => {
    const y = bildY(weltY);
    return y > -40 && y < HOEHE + 40;
  };

  const meine = farbe(z.farbe);
  const etappe = etappeVon(z.geschafft);
  const inEtappe = z.geschafft % ETAPPE_LAENGE;

  return (
    <div
      className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 px-3 pt-2"
      onPointerDown={antippen}
    >
      <div className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-end gap-2 px-1">
        <p className="text-left text-xs leading-tight font-bold text-gedaempft">
          Etappe <span className="text-base text-text">{etappe}</span>
        </p>
        <p
          key={z.punkte}
          className="punkte-bumsen text-5xl leading-none font-black tabular-nums"
          style={{ color: meine.hex, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}
        >
          {z.punkte}
        </p>
        {/* Die Hindernisse der Etappe als Punkte — gefüllt = geschafft. Form, nicht nur Farbe. */}
        <div
          className="flex justify-end gap-0.5 pb-1.5"
          role="img"
          aria-label={`${inEtappe} von ${ETAPPE_LAENGE} Hindernissen der Etappe geschafft`}
        >
          {Array.from({ length: ETAPPE_LAENGE }, (_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full border ${
                i < inEtappe ? 'border-white bg-white' : 'border-gedaempft bg-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="spielbuehne relative">
        {/* Das Herz hängt über der oberen rechten Ecke der Bühne, wie in Snake Rush: Es kostet
            keine Höhe, und die Serie ist am Rand des Blickfelds zu spüren. Es zeigt den
            **Faktor**, nicht die Länge der Serie — die hört bei ×5 auf zu zählen. */}
        <Komboherz
          kombo={serieFaktor(z.serie) >= 2 ? serieFaktor(z.serie) : 0}
          ruhig={settings.reducedMotion}
          className="absolute -top-2 right-0 z-10"
        />
        <div
          className="spielbrett spielbrett-rahmen relative overflow-hidden"
          style={{ '--vz': BREITE / HOEHE } as CSSProperties}
          role="button"
          tabIndex={0}
          aria-label={`Ring Rise. Deine Farbe: ${meine.name}. Punkte: ${z.punkte}. Etappe ${etappe}. Antippen springt.`}
        >
          <svg
            viewBox={`${-BREITE / 2} 0 ${BREITE} ${HOEHE}`}
            className="size-full touch-none select-none"
            aria-hidden="true"
          >
            {/* Ein ruhiger Nachthimmel — die Ringe sollen leuchten, nicht
                mit dem Hintergrund konkurrieren. */}
            <defs>
              <linearGradient id="ringrise-himmel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1e1b4b" />
                <stop offset="1" stopColor="#020617" />
              </linearGradient>
            </defs>
            <rect x={-BREITE / 2} y={0} width={BREITE} height={HOEHE} fill="url(#ringrise-himmel)" />

            {z.wechsler.map((w) =>
              sichtbar(w.y) ? (
                <g key={`w${w.y}`} transform={`translate(0 ${bildY(w.y).toFixed(2)})`}>
                  <Farbwechsel wechsler={w} />
                </g>
              ) : null,
            )}

            {z.ringe.map((r) =>
              sichtbar(r.y) ? (
                <g key={`r${r.id}`} transform={`translate(0 ${bildY(r.y).toFixed(2)})`}>
                  <Hindernis ring={r} />
                </g>
              ) : null,
            )}

            <g transform={`translate(0 ${bildY(z.kugelY).toFixed(2)})`}>
              <Kugel farbIndex={z.farbe} />
            </g>
          </svg>

          {/* Das „+N" gehört **ins Brett**, nicht in die Bühne — genau wie
              bei Ghost Chase. In der Bühne war es ein zweites Flex-Kind
              neben dem Brett und schob es bei jedem geschafften Ring eine
              knappe Sekunde lang zur Seite. */}
          <Punktegewinn gewinn={gewinn} />

          {/* Die Meldung liegt im unteren, meist leeren Teil: Oben sieht man den nächsten Ring,
              und den muss man auch während der Meldung sehen. */}
          {meldung && (
            <div
              key={meldung.id}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-2 bottom-2 z-10 grid justify-items-center rounded-xl border border-white/20 bg-black/65 px-2 py-1.5 text-center whitespace-nowrap backdrop-blur-sm"
            >
              <div className={`grid justify-items-center ${settings.reducedMotion ? '' : 'welle-schild'}`}>
                <p className="text-sm leading-tight font-extrabold text-white">Etappe {meldung.etappe} geschafft!</p>
                <p className="text-xs leading-tight font-bold" style={{ color: 'var(--color-erfolg)' }}>
                  +{meldung.bonus} Punkte
                </p>
                {meldung.neu && <p className="text-xs leading-tight font-semibold text-white/85">Neu: {meldung.neu}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {meldung ? `Etappe ${meldung.etappe} geschafft, plus ${meldung.bonus} Punkte.` : ''}
      </span>

      {/* Die eigene Farbe noch einmal groß und mit Namen — bei einer Kugel
          von fünf Einheiten Größe ist das auf einem Handy nicht immer auf
          einen Blick klar, und der Name hilft zusätzlich zum Muster. */}
      <p className="flex items-center gap-2 text-sm font-semibold">
        <svg viewBox="-10 -10 20 20" className="size-5" aria-hidden="true">
          <circle r={6} fill={meine.hex} />
          <circle r={8.5} fill="none" stroke={meine.hex} strokeWidth={1.6} strokeDasharray={meine.muster} />
        </svg>
        Deine Farbe: {meine.name}
      </p>

      <p className="nur-bei-platz max-w-md text-center text-xs text-gedaempft">
        Antippen lässt die Kugel steigen. Durch kommst du nur dort, wo Farbe
        <em> und</em> Strichmuster zu dir passen. Steht beim Durchflug die weiße Raute zwischen den
        beiden Strichen, wächst deine Serie. Die kleinen Sterne färben dich um.
      </p>
    </div>
  );
}
