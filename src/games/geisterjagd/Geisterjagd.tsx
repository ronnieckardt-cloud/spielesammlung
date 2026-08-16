import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { useInput } from '../../core/useInput';
import { Steuerkreuz } from '../../core/Steuerkreuz';
import { Punktegewinn, usePunktegewinn } from '../../core/Punktegewinn';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { GeisterjagdIcon } from './Icon';
import { istWand, schluessel } from './labyrinth';
import { STARTLEBEN, neuesSpiel, richtungEingeben, zeitFortschritt } from './logik';
import type { Richtung, Zustand } from './logik';
import { GEIST_FARBEN, PILLE_FARBE, PUNKT_FARBE, WAND_FARBE } from './farben';
import { Geist, GeistTeile, KRAFTPILLE_PFAD, Spieler } from './figuren';

/** Größte Kachelgröße. Auf schmalen Handys wird kleiner gerechnet, siehe
 *  unten — vorher stand hier eine feste Größe, und 21 Spalten mal 18 Pixel
 *  passten auf einem 375er-Handy nicht mehr in die Breite. */
const MAX_ZELLE_PX = 18;

/**
 * Meldet, welche Figuren seit dem letzten Bild um mehr als eine Kachel
 * gesprungen sind. Das passiert nur im Tunnel, wo sie von einer Seite auf
 * die andere wechseln. Für diesen einen Schritt muss die weiche Bewegung
 * aus sein — sonst flitzt die Figur sichtbar quer über das ganze Feld
 * zurück, statt drüben aufzutauchen.
 */
function useSpruenge(figuren: readonly { id: string; x: number; y: number }[]): ReadonlySet<string> {
  const vorher = useRef(new Map<string, { x: number; y: number }>());
  const spruenge = new Set<string>();
  for (const f of figuren) {
    const alt = vorher.current.get(f.id);
    if (alt && (Math.abs(f.x - alt.x) > 1 || Math.abs(f.y - alt.y) > 1)) spruenge.add(f.id);
    vorher.current.set(f.id, { x: f.x, y: f.y });
  }
  return spruenge;
}

/** So lange nach dem letzten Kachelwechsel gilt die Figur noch als laufend. */
const LAUF_NACHLAUF_MS = 280;

/**
 * Meldet, ob der Spieler gerade läuft — also ob er seit kurzem die Kachel
 * gewechselt hat. Ein Schritt dauert je nach Level 110 bis 160 ms, der
 * Nachlauf ist absichtlich etwas länger: Sonst flackerte die Laufanimation
 * zwischen zwei Schritten kurz aus.
 *
 * Steht die Figur an einer Wand, bleibt die Kachel gleich, und nach dem
 * Nachlauf hört sie von selbst auf zu strampeln.
 */
function useLaeuft(x: number, y: number): boolean {
  const letzterWechsel = useRef({ x, y, zeit: Number.NEGATIVE_INFINITY });
  const jetzt = performance.now();
  if (letzterWechsel.current.x !== x || letzterWechsel.current.y !== y) {
    letzterWechsel.current = { x, y, zeit: jetzt };
  }
  return jetzt - letzterWechsel.current.zeit < LAUF_NACHLAUF_MS;
}

/** Geister und Sterne als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 12, winkel: -10, verzoegerung: 0, inhalt: <DekoGeist farbe={GEIST_FARBEN[0]!} groesse={40} /> },
  { x: 85, y: 9, winkel: 12, verzoegerung: 0.65, inhalt: <DekoStern groesse={22} /> },
  { x: 87, y: 70, winkel: -6, verzoegerung: 1.25, inhalt: <DekoGeist farbe={GEIST_FARBEN[2]!} groesse={34} /> },
  { x: 4, y: 73, winkel: 8, verzoegerung: 0.4, inhalt: <DekoStern groesse={18} /> },
  { x: 92, y: 41, winkel: 18, verzoegerung: 1.7, inhalt: <DekoStern groesse={14} /> },
  { x: 3, y: 43, winkel: -18, verzoegerung: 0.95, inhalt: <DekoGeist farbe={GEIST_FARBEN[1]!} groesse={28} /> },
];

/** Derselbe Geist wie auf dem Spielfeld — der Startbildschirm hatte ihn
 *  vorher noch einmal von Hand nachgezeichnet, ohne Saum und Wölbung. */
function DekoGeist({ farbe, groesse }: { farbe: string; groesse: number }) {
  return (
    <svg viewBox="0 0 40 40" width={groesse} height={groesse} aria-hidden="true">
      <GeistTeile farbe={farbe} />
    </svg>
  );
}

function DekoStern({ groesse }: { groesse: number }) {
  return (
    <svg viewBox="0 0 24 24" width={groesse} height={groesse} fill={PILLE_FARBE} aria-hidden="true">
      <path d={KRAFTPILLE_PFAD} />
    </svg>
  );
}

const istRichtung = (wert: string): wert is Richtung =>
  wert === 'up' || wert === 'down' || wert === 'left' || wert === 'right';

export function Geisterjagd({ onScore, onGameOver, settings, bestScore, istErsteRunde }: GameProps) {
  // Nach „Nochmal" direkt weiterspielen statt wieder über den
  // Startbildschirm zu gehen — der gehört nur ans Betreten des Spiels.
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesSpiel(saatAus('geisterjagd', Date.now())));
  const bereich = useRef<HTMLDivElement>(null);

  const bewege = useCallback(
    (richtung: Richtung) => setZ((alt) => richtungEingeben(alt, richtung)),
    [],
  );

  useInput(
    (aktion) => {
      if (!istRichtung(aktion)) return;
      bewege(aktion);
    },
    { bereich, aktiv: gestartet && !z.vorbei },
  );

  useGameLoop((dt) => setZ((alt) => zeitFortschritt(alt, dt)), {
    fps: 60,
    running: gestartet && !z.vorbei,
  });

  useEffect(() => {
    onScore(z.score);
  }, [z.score, onScore]);

  const vorScoreRef = useRef(z.score);
  useEffect(() => {
    const differenz = z.score - vorScoreRef.current;
    vorScoreRef.current = z.score;
    if (differenz >= 200) sfx('stufe'); // Geist gefressen
    else if (differenz >= 50) sfx('gut'); // Kraftpille
  }, [z.score]);

  const vorLebenRef = useRef(z.leben);
  useEffect(() => {
    if (z.leben < vorLebenRef.current) sfx('schlecht');
    vorLebenRef.current = z.leben;
  }, [z.leben]);

  const vorLevelRef = useRef(z.level);
  useEffect(() => {
    if (z.level > vorLevelRef.current) sfx('stufe');
    vorLevelRef.current = z.level;
  }, [z.level]);

  useEffect(() => {
    if (z.vorbei) onGameOver(z.score, z.gewonnen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.vorbei]);

  const { breite, hoehe } = z.labyrinth;

  const spruenge = useSpruenge([
    { id: 'spieler', x: z.spieler.position.x, y: z.spieler.position.y },
    ...z.geister.map((g) => ({ id: `g${g.id}`, x: g.position.x, y: g.position.y })),
  ]);

  const laeuft = useLaeuft(z.spieler.position.x, z.spieler.position.y);

  // Erst ab 50 melden: Jeder eingesammelte Punkt gibt zehn Zähler, ein Popup
  // je Punkt wäre ein Dauerflimmern quer über das Labyrinth. Die Kraftpille
  // (50) und der gefressene Geist (200) sind es dagegen wert — vorher gab es
  // dafür nur einen Ton.
  const gewinn = usePunktegewinn(z.score, 50);

  /**
   * Das Labyrinth wird nur neu gezeichnet, wenn sich wirklich etwas darin
   * ändert — also wenn ein Punkt oder eine Kraftpille gefressen wurde.
   *
   * Ohne das war dies die mit Abstand teuerste Stelle im ganzen Projekt:
   * 21 × 22 = 462 Zellen, und weil die Spielschleife sechzigmal je Sekunde
   * einen frischen Zustand liefert, wurden sie alle sechzigmal je Sekunde
   * neu abgeglichen — rund 28 000 React-Elemente in der Sekunde für ein
   * Raster, das sich fast nie ändert. Auf einem iPad hieß das Ruckler und
   * warmer Akku.
   *
   * `z.labyrinth` ist über die ganze Runde dasselbe Objekt, `z.punkte` und
   * `z.kraftpillen` wechseln ihre Identität nur beim Fressen — die drei
   * Abhängigkeiten reichen also aus.
   */
  const raster = useMemo(
    () => (
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${breite}, 1fr)`,
          gridTemplateRows: `repeat(${hoehe}, 1fr)`,
        }}
      >
        {Array.from({ length: breite * hoehe }, (_, i) => {
          const x = i % breite;
          const y = Math.floor(i / breite);
          const wand = istWand(z.labyrinth, x, y);
          const schl = schluessel(x, y);
          const hatPunkt = z.punkte.has(schl);
          const hatPille = z.kraftpillen.has(schl);
          return (
            <div key={i} className="relative">
              {wand && (
                <div
                  className="absolute inset-[1px] rounded-[3px]"
                  style={{ backgroundColor: WAND_FARBE }}
                />
              )}
              {hatPunkt && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="size-[5px] rounded-full" style={{ backgroundColor: PUNKT_FARBE }} />
                </div>
              )}
              {hatPille && (
                <div className="pulsiert absolute inset-0 grid place-items-center">
                  <svg viewBox="0 0 24 24" className="size-3.5" fill={PILLE_FARBE} aria-hidden="true">
                    <path d={KRAFTPILLE_PFAD} />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    ),
    [z.labyrinth, z.punkte, z.kraftpillen, breite, hoehe],
  );

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Ghost Chase"
        untertitel="Sammle alles ein — und lauf den Geistern davon!"
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #1e1b4b 0%, #4338ca 45%, #a21caf 100%)"
        deko={DEKO}
        Symbol={GeisterjagdIcon}
        knopfFarbe="#4338ca"
        onStart={() => setGestartet(true)}
      />
    );
  }

  // Alles in Prozent statt in Pixeln: Eine Verschiebung um 100 % ist bei
  // einer kachelgroßen Figur genau eine Kachel — dadurch stimmt die
  // Anordnung bei jeder Feldgröße, ohne dass irgendwo gemessen werden muss.
  const zelleBreite = 100 / breite;
  const zelleHoehe = 100 / hoehe;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden p-3 spielseite">
      <div className="flex items-center justify-center gap-6 text-sm text-gedaempft">
        <span>Level {z.level}</span>
        <span aria-label={`${z.leben} von ${STARTLEBEN} Leben`}>
          {'♥'.repeat(z.leben)}
          <span className="opacity-30">{'♥'.repeat(Math.max(0, STARTLEBEN - z.leben))}</span>
        </span>
      </div>

      <div className="spielbuehne">
      <div
        ref={bereich}
        className="spielbrett spielbrett-rahmen relative touch-none"
        style={
          {
            maxWidth: breite * MAX_ZELLE_PX,
            '--vz': breite / hoehe,
          } as CSSProperties
        }
        role="img"
        aria-label={`Labyrinth, Level ${z.level}, ${z.leben} Leben, ${z.score} Punkte.${z.gewonnen ? ' Alle Geister gefressen, gewonnen!' : z.vorbei ? ' Spiel vorbei.' : ''}`}
      >
        {raster}
        <Punktegewinn gewinn={gewinn} />

        <div
          className="absolute ease-linear"
          style={{
            width: `${zelleBreite}%`,
            height: `${zelleHoehe}%`,
            transform: `translate(${z.spieler.position.x * 100}%, ${z.spieler.position.y * 100}%)`,
            transition: spruenge.has('spieler') ? 'none' : 'transform 100ms linear',
          }}
        >
          <Spieler
            richtung={z.spieler.richtung}
            laeuft={laeuft && !settings.reducedMotion && !z.vorbei}
          />
        </div>

        {z.geister.map((g) => (
          <div
            key={g.id}
            className="absolute ease-linear"
            style={{
              width: `${zelleBreite}%`,
              height: `${zelleHoehe}%`,
              transform: `translate(${g.position.x * 100}%, ${g.position.y * 100}%)`,
              transition: spruenge.has(`g${g.id}`) ? 'none' : 'transform 100ms linear',
            }}
          >
            <Geist
              modus={g.modus}
              farbe={GEIST_FARBEN[g.id]!}
              blinkt={g.modus === 'angst' && g.angstZeitRest < 2 && Math.floor(g.angstZeitRest * 5) % 2 === 0}
            />
          </div>
        ))}
      </div>

      </div>

      <Steuerkreuz onRichtung={bewege} aktiv={!z.vorbei} />

      <p className="nur-bei-platz max-w-sm text-center text-xs text-gedaempft">
        Pfeiltasten, Wischen oder die Pfeilknöpfe unten bewegen. Die großen Sterne
        machen die Geister kurz ängstlich — dann kannst du sie fangen. Frisst
        du alle vier auf einmal, ist die Runde sofort gewonnen!
      </p>

      {settings.reducedMotion && <span className="sr-only">Animationen sind reduziert.</span>}
    </div>
  );
}
