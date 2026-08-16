import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { levelstand } from '../../core/levelstand';
import { haptik } from '../../core/haptik';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import {
  KAPAZITAET,
  extraRoehrchenHinzufuegen,
  neuesLevel,
  punkteFuerLoesung,
  roehrchenAntippen,
  roehrchenFertig,
  zurueck,
} from './logik';
import type { Zustand } from './logik';
import {
  ROEHRCHEN_BREITE,
  ROEHRCHEN_HOEHE,
  ausgusskante,
  fliegendePosition,
  flugLuft,
  giessFortschritt,
  rasterBreite,
  rasterHoehe,
  roehrchenPosition,
  schichthoehe,
} from './geometrie';
import { FarbMusterDefs } from './FarbMusterDefs';
import { Roehrchen } from './Roehrchen';
import { Konfetti } from './Konfetti';
import { farbpaletteFuerLevel } from './farben';
import type { FarbEintrag } from './farben';
import { FarbsortiererIcon } from './Icon';

/** Feste Dauer der Gieß-Animation — läuft immer, kein Knopf zum An-/Abstellen. */
const GIESS_DAUER_MS = 950;

/** So lange fliegt das Konfetti über einem fertigen Röhrchen. */
const KONFETTI_DAUER_MS = 1350;

/**
 * So lange wackelt ein Röhrchen, wenn ein Antippen nichts bewirkt.
 *
 * Kurz genug, dass man weiterspielen kann, während es noch ausschwingt —
 * es soll antworten, nicht bremsen.
 */
const FEHLANZEIGE_DAUER_MS = 320;

/** Wie weit das Röhrchen dabei ausschlägt (in Rasterkoordinaten). */
const FEHLANZEIGE_AUSSCHLAG = 7;

const SCHICHTHOEHE = schichthoehe(KAPAZITAET);

/** Bei diesem Winkel zeigt die Öffnung ganz nach unten (siehe geometrie.ts). */
const VOLLE_KIPPUNG_GRAD = 128;

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

type Guss = {
  von: number;
  nach: number;
  nachherVon: readonly number[];
  vorherNach: readonly number[];
  farbe: number;
  anzahl: number;
  anzahlRoehrchen: number;
  t: number;
  dauerMs: number;
};

/** Beschreibt ein Röhrchen für Screenreader — Farbe ist nie das einzige Merkmal. */
function beschreibung(
  index: number,
  inhalt: readonly number[],
  palette: readonly FarbEintrag[],
): string {
  const basis = `Röhrchen ${index + 1}`;
  if (inhalt.length === 0) return `${basis}, leer`;
  return `${basis}, von unten nach oben: ${inhalt.map((f) => palette[f]?.name ?? '').join(', ')}`;
}

/**
 * Schwebende Farbtropfen im Hintergrund des Startbildschirms — feste Liste,
 * rein dekorativ, siehe Blockblitz-Startbildschirm für dasselbe Muster.
 */
const DEKO_TROPFEN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 10, y: 14, groesse: 26, farbe: '#fb923c', verzoegerung: 0 },
  { x: 88, y: 10, groesse: 20, farbe: '#facc15', verzoegerung: 0.6 },
  { x: 82, y: 80, groesse: 32, farbe: '#2dd4bf', verzoegerung: 1.1 },
  { x: 8, y: 78, groesse: 22, farbe: '#f472b6', verzoegerung: 0.3 },
  { x: 92, y: 44, groesse: 16, farbe: '#facc15', verzoegerung: 1.6 },
  { x: 4, y: 46, groesse: 18, farbe: '#fb923c', verzoegerung: 0.9 },
];

/**
 * Farbenfrohes Titelbild, angelehnt an typische Wassersortier-Puzzles im
 * App Store — helle Verläufe, schwebende Tropfen, kein dunkler Hintergrund.
 * Eigene Gestaltung, siehe Blockblitz-Startbildschirm für die Vorlage.
 */
function Startbildschirm({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: 'linear-gradient(160deg, #14b8a6 0%, #0ea5e9 45%, #a855f7 78%, #ec4899 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DEKO_TROPFEN.map((t, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-80"
            style={
              {
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: t.groesse,
                height: t.groesse,
                backgroundColor: t.farbe,
                animationDelay: `${t.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <FarbsortiererIcon className="relative size-32 rounded-[2rem] shadow-2xl" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.18), 0 10px 24px rgba(0,0,0,0.3)' }}
        >
          Color Pour
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/85">
          {bestScore > 0 ? `🏆 Beste Punktzahl: ${bestScore}` : 'Bereit, die Farben zu sortieren?'}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold text-teal-600 shadow-2xl transition-transform active:scale-95"
      >
        Spielen
      </button>
    </div>
  );
}

export function Farbsortierer({
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
  // Nach „Nochmal" (= nächstes Level) direkt weiterspielen statt wieder
  // über den Startbildschirm zu gehen — der gehört nur ans Betreten.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(festesLevel ?? levelStand.anfang(startLevel)));
  const [guss, setGuss] = useState<Guss | null>(null);
  /** Läuft, wenn ein Antippen ins Leere ging — das Röhrchen wackelt kurz. */
  const [fehlanzeige, setFehlanzeige] = useState<{ index: number; t: number } | null>(null);

  /**
   * Breite geteilt durch Höhe der Bühne, sobald sie gemessen ist.
   *
   * Das Raster braucht diesen Wert, um zu entscheiden, ob die Röhrchen in
   * eine Reihe passen oder ob zwei kurze Reihen größere Röhrchen ergeben
   * (siehe `spaltenFuerAnzahl`). Gemessen statt geraten, weil die Bühne je
   * nach Gerät, Ausrichtung und Browserleiste sehr unterschiedlich hoch ist.
   */
  const buehneRef = useRef<HTMLDivElement | null>(null);
  const [buehnenVerhaeltnis, setBuehnenVerhaeltnis] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const buehne = buehneRef.current;
    if (!buehne) return;

    const messen = () => {
      const breite = buehne.clientWidth;
      const hoehe = buehne.clientHeight;
      // React verwirft ein setState mit demselben Wert von allein — die
      // Beobachtung kann also ruhig bei jeder Größenmeldung rechnen.
      if (breite > 0 && hoehe > 0) setBuehnenVerhaeltnis(breite / hoehe);
    };

    messen();
    if (typeof ResizeObserver === 'undefined') return;
    // Kein Endlos-Kreisel: Die Bühne bekommt ihre Größe vom Flex-Eltern-
    // element, nicht vom Brett darin. Ein anderes Raster ändert sie nicht.
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(buehne);
    return () => beobachter.disconnect();
  }, [gestartet]);

  // Welche Farben dieses Level zeigt — aus der Levelnummer gemischt, damit
  // nicht immer dieselbe Reihenfolge der Palette drankommt.
  const palette = useMemo(
    () => farbpaletteFuerLevel(z.level, z.farbenAnzahl),
    [z.level, z.farbenAnzahl],
  );

  const beiAntippen = useCallback(
    (index: number) => {
      if (guss || z.geloest) return;

      const quelleVorher = z.ausgewaehlt;
      const nachher = roehrchenAntippen(z, index);
      if (nachher === z) {
        // Ein leeres Röhrchen anzutippen, ohne etwas ausgewählt zu haben,
        // ändert nichts. Ohne Antwort wirkt die App in dem Moment kaputt
        // statt „geht nicht" — also ein kurzer Ton, ein Stups und ein
        // Wackeln. Bei „weniger Bewegung" bleibt es bei Ton und Stups.
        sfx('schlecht');
        haptik('fehler');
        if (!settings.reducedMotion) setFehlanzeige({ index, t: 0 });
        return;
      }

      const wurdeGegossen = nachher.zuege > z.zuege;
      if (!wurdeGegossen || quelleVorher === null) {
        setZ(nachher);
        sfx('klick');
        return;
      }

      const vorherVon = z.roehrchen[quelleVorher]!;
      const nachherVon = nachher.roehrchen[quelleVorher]!;
      const vorherNach = z.roehrchen[index]!;
      const nachherNach = nachher.roehrchen[index]!;

      setZ(nachher);
      sfx('gut');

      setGuss({
        von: quelleVorher,
        nach: index,
        nachherVon,
        vorherNach,
        farbe: vorherVon[vorherVon.length - 1]!,
        anzahl: nachherNach.length - vorherNach.length,
        anzahlRoehrchen: z.roehrchen.length,
        t: 0,
        dauerMs: GIESS_DAUER_MS,
      });
    },
    [z, guss, settings.reducedMotion],
  );

  useGameLoop(
    (dt) => {
      setGuss((g) => {
        if (!g) return g;
        const naechstesT = g.t + (dt * 1000) / g.dauerMs;
        return naechstesT >= 1 ? null : { ...g, t: naechstesT };
      });
      setFehlanzeige((f) => {
        if (!f) return f;
        const naechstesT = f.t + (dt * 1000) / FEHLANZEIGE_DAUER_MS;
        return naechstesT >= 1 ? null : { ...f, t: naechstesT };
      });
    },
    // Dieselbe Uhr für beides — zwei Schleifen nebeneinander wären zwei
    // Bildanforderungen für dieselbe Bewegung.
    { fps: 60, running: guss !== null || fehlanzeige !== null },
  );

  useEffect(() => {
    // Erst ab dem Startbildschirm: Vorher stand in der Kopfzeile schon ein
    // Punktestand, obwohl noch gar nicht gespielt wurde.
    //
    // Der Wert ist das, was bei dieser Zugzahl noch zu holen ist, und zählt
    // deshalb abwärts — was in der Kopfzeile allein nach Punkteverlust
    // aussieht. Erklärt wird er im Spiel selbst: der Zugzähler in der
    // Leiste und der Satz im Hilfetext gehören zu dieser Zeile dazu.
    if (!gestartet) return;
    onScore(punkteFuerLoesung(z.zuege, z.farbenAnzahl));
  }, [gestartet, z.zuege, z.farbenAnzahl, onScore]);

  useEffect(() => {
    if (z.geloest && !guss) {
      sfx('ende');
      // "Nochmal" im Vorbei-Bildschirm der Hülle startet damit automatisch
      // das nächste Level, nicht wieder dasselbe.
      if (festesLevel === undefined) meldeLevel(z.level + 1);
      onGameOver(punkteFuerLoesung(z.zuege, z.farbenAnzahl));
    }
    // Absichtlich nur an geloest/guss gebunden — onGameOver darf nur einmal kommen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.geloest, !!guss]);

  // Welche Röhrchen sind fertig? Wird beim Rendern frisch bestimmt — die
  // Prüfung ist billig und so kann nichts veralten.
  const fertige = z.roehrchen.map((inhalt) => roehrchenFertig(inhalt));

  // Konfetti nur beim *Übergang* auf fertig, nicht dauerhaft. Der Vergleich
  // läuft über eine Ref, damit ein erneutes Rendern ohne Änderung nichts
  // auslöst.
  const [feiern, setFeiern] = useState<readonly number[]>([]);
  const fertigeVorherRef = useRef<readonly boolean[]>(fertige);

  useEffect(() => {
    // Während des Gießens noch nicht feiern: Der Zustand meldet das
    // Röhrchen sofort als fertig, zu sehen ist es aber erst, wenn die
    // Flüssigkeit angekommen ist. Solange `guss` läuft, bleibt auch der
    // Vergleichswert stehen — sonst wäre der Übergang danach verpasst.
    if (guss) return;

    const vorher = fertigeVorherRef.current;
    const neuFertig = fertige
      .map((ist, i) => (ist && !vorher[i] ? i : -1))
      .filter((i) => i >= 0);
    fertigeVorherRef.current = fertige;
    if (neuFertig.length === 0) return;

    setFeiern(neuFertig);
    sfx('stufe');
    const uhr = window.setTimeout(() => setFeiern([]), KONFETTI_DAUER_MS);
    return () => window.clearTimeout(uhr);
    // Absichtlich an der Zeichenkette hängend: ein neues Array bei gleichem
    // Inhalt soll den Effekt nicht erneut auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertige.join(','), !!guss]);

  const beiZurueck = useCallback(() => {
    if (!guss) setZ((alt) => zurueck(alt));
  }, [guss]);

  const beiExtraRoehrchen = useCallback(() => {
    if (!guss) setZ((alt) => extraRoehrchenHinzufuegen(alt));
  }, [guss]);

  // Freie Levelwahl — "gleiche Levelnummer, gleiches Rätsel" soll man auch
  // gezielt ansteuern können, nicht nur der Reihe nach durchspielen.
  const beiLevelWechsel = useCallback(
    (neu: number) => {
    // Im Duell steht das Level fest — sonst könnte man sich das
    // leichteste aussuchen und der Vergleich wäre wertlos.
    if (festesLevel !== undefined) return;
      if (guss) return;
      const geklemmt = Math.max(1, neu);
      meldeLevel(geklemmt);
      setZ(neuesLevel(geklemmt));
    },
    [guss],
  );

  const breite = rasterBreite(z.roehrchen.length, buehnenVerhaeltnis);
  // Über der obersten Reihe bleibt Platz für das fliegende Röhrchen: Beim
  // Kippen ragt es weit nach oben, und sobald das Brett die Bühne wirklich
  // ausfüllt, läge dieser Teil sonst über Leiste und Kopfzeile.
  const flugLuftOben = flugLuft(z.roehrchen.length, buehnenVerhaeltnis);
  const hoehe = rasterHoehe(z.roehrchen.length, buehnenVerhaeltnis) + flugLuftOben;

  const posVon = guss
    ? roehrchenPosition(guss.von, guss.anzahlRoehrchen, buehnenVerhaeltnis)
    : null;
  const posNach = guss
    ? roehrchenPosition(guss.nach, guss.anzahlRoehrchen, buehnenVerhaeltnis)
    : null;
  const flug = guss && posVon && posNach ? fliegendePosition(guss.t, posVon, posNach) : null;
  const giessAnteil = guss ? giessFortschritt(guss.t) : 0;

  const kante = guss && flug ? ausgusskante(flug.position, flug.winkelGrad) : null;
  const zielMitteX = posNach ? posNach.x + ROEHRCHEN_BREITE / 2 : 0;
  const zielFuellHoehe = guss ? (guss.vorherNach.length + giessAnteil * guss.anzahl) * SCHICHTHOEHE : 0;
  const zielOberflaeche = posNach ? posNach.y + ROEHRCHEN_HOEHE - zielFuellHoehe : 0;
  const strahlSichtbar =
    !!guss && !!flug && !!kante && Math.abs(flug.winkelGrad) > 85 && giessAnteil < 1;
  const wackeln = guss ? Math.sin(guss.t * 46) * 2 : 0;

  /**
   * Seitlicher Ausschlag der Fehlanzeige: drei Schwünge, die zum Ende hin
   * kleiner werden. Als Rechnung im Anzeigecode und nicht als CSS-Klasse,
   * weil die Klasse in die gemeinsame `index.css` müsste — die gehört allen
   * Spielen, und hier reicht die Uhr, die für den Guss ohnehin schon läuft.
   */
  const ruettelVersatz = (index: number): number => {
    if (!fehlanzeige || fehlanzeige.index !== index) return 0;
    return (
      Math.sin(fehlanzeige.t * Math.PI * 6) * FEHLANZEIGE_AUSSCHLAG * (1 - fehlanzeige.t)
    );
  };

  if (!gestartet) {
    return (
      <Startbildschirm bestScore={bestScore} onStart={() => setGestartet(true)} />
    );
  }

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3">
      <FarbMusterDefs />

      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            // Im Duell steht das Level fest — dann muss auch dieser Pfeil
            // gesperrt aussehen und nicht nur wirkungslos klicken.
            disabled={z.level <= 1 || !!guss || festesLevel !== undefined}
            aria-label="Voriges Level"
            className="spielknopf text-base leading-none transition-transform active:scale-95"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            disabled={!!guss || festesLevel !== undefined}
            aria-label="Nächstes Level"
            className="spielknopf text-base leading-none transition-transform active:scale-95"
          >
            ›
          </button>
          {/* Der Zugzähler erklärt die Kopfzeile: Dort zählen die Punkte
              mit jedem Zug herunter, und ohne diese Zahl daneben sieht das
              aus wie Punkteverlust ohne Grund. */}
          <span className="ml-1 w-16 text-center tabular-nums">
            {z.zuege} {z.zuege === 1 ? 'Zug' : 'Züge'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={beiZurueck}
            disabled={z.verlauf.length === 0 || !!guss}
            className="spielknopf"
          >
            <span aria-hidden="true">↩</span> Zurück
          </button>
          <button
            type="button"
            onClick={beiExtraRoehrchen}
            disabled={z.extraRoehrchenUebrig === 0 || !!guss}
            className="spielknopf"
          >
            + Röhrchen
          </button>
        </div>
      </div>

      <div className="spielbuehne" ref={buehneRef}>
      <svg
        viewBox={`0 ${-flugLuftOben} ${breite} ${hoehe}`}
        role="group"
        aria-label={`Farbsortierer, Level ${z.level}. ${z.zuege} ${z.zuege === 1 ? 'Zug' : 'Züge'}, noch ${punkteFuerLoesung(z.zuege, z.farbenAnzahl)} Punkte zu holen. ${z.roehrchen.map((r, i) => beschreibung(i, r, palette)).join('. ')}.`}
        className="spielbrett"
        // `overflow: visible`, weil Deckel und Konfetti über den Rand des
        // Kastens hinausragen dürfen.
        style={{ '--vz': breite / hoehe, overflow: 'visible' } as CSSProperties}
      >
        {z.roehrchen.map((inhalt, i) => {
          const istVon = guss?.von === i;
          const istNach = guss?.nach === i;
          const pos = roehrchenPosition(i, z.roehrchen.length, buehnenVerhaeltnis);

          return (
            <g
              key={i}
              transform={`translate(${pos.x + ruettelVersatz(i)} ${pos.y})`}
              role="button"
              tabIndex={istVon ? -1 : 0}
              aria-label={beschreibung(i, inhalt, palette)}
              aria-disabled={!!guss}
              onClick={() => beiAntippen(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  beiAntippen(i);
                }
              }}
              style={{ cursor: guss ? 'default' : 'pointer' }}
            >
              <Roehrchen
                farben={istVon ? [] : istNach ? guss!.vorherNach : inhalt}
                kapazitaet={KAPAZITAET}
                palette={palette}
                ausgewaehlt={z.ausgewaehlt === i}
                fertig={fertige[i] === true && !istVon && !istNach}
                ruhig={settings.reducedMotion}
                teilschicht={
                  istNach
                    ? { farbe: guss!.farbe, hoehe: giessAnteil * guss!.anzahl * SCHICHTHOEHE }
                    : undefined
                }
              />
              {feiern.includes(i) && <Konfetti ruhig={settings.reducedMotion} />}
            </g>
          );
        })}

        {/* Das fliegende Röhrchen — dreht sich um denselben Drehpunkt, den
            ausgusskante() zur Berechnung benutzt, deshalb landet der Strahl
            exakt an der gezeichneten Öffnung. */}
        {guss && flug && (
          <g
            transform={`translate(${flug.position.x} ${flug.position.y}) rotate(${flug.winkelGrad} ${ROEHRCHEN_BREITE / 2} ${ROEHRCHEN_HOEHE * 0.32})`}
          >
            <Roehrchen
              farben={guss.nachherVon}
              kapazitaet={KAPAZITAET}
              palette={palette}
              teilschicht={{ farbe: guss.farbe, hoehe: (1 - giessAnteil) * guss.anzahl * SCHICHTHOEHE }}
              // Je schräger, desto weiter rutscht die Flüssigkeit zur
              // Öffnung — bei voller Kippung liegt sie ganz an der Ausguss-
              // kante, dort wo der Strahl herauskommt.
              zumRandGeneigt={Math.abs(flug.winkelGrad) / VOLLE_KIPPUNG_GRAD}
            />
          </g>
        )}

        {strahlSichtbar && kante && (
          <g aria-hidden="true">
            <path
              d={`M ${kante.x - 2.5},${kante.y}
                  Q ${(kante.x + zielMitteX) / 2 + wackeln},${(kante.y + zielOberflaeche) / 2} ${zielMitteX - 1.5},${zielOberflaeche}
                  L ${zielMitteX + 1.5},${zielOberflaeche}
                  Q ${(kante.x + zielMitteX) / 2 + wackeln + 5},${(kante.y + zielOberflaeche) / 2} ${kante.x + 2.5},${kante.y}
                  Z`}
              fill={`url(#fluessigkeit-${palette[guss.farbe]?.id})`}
              opacity={0.9}
            />
            <ellipse cx={zielMitteX} cy={zielOberflaeche} rx={9} ry={2.5} fill="white" opacity={0.3} />
          </g>
        )}
      </svg>
      </div>

      <p className="nur-bei-platz max-w-md text-center text-xs text-gedaempft">
        Antippen wählt ein Röhrchen, nochmal Antippen gießt hinein. Je weniger
        Züge du brauchst, desto mehr Punkte gibt es — oben steht, wie viele
        gerade noch zu holen sind.
        <br />
        Gelöst? „Nochmal" im nächsten Bildschirm startet automatisch das
        nächste Level — mit den Pfeilen oben lässt sich auch direkt ein
        bestimmtes Level ansteuern.
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
