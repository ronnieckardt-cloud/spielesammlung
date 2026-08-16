import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { schwerpunkt } from './geometrie';
import type { Form, Punkt } from './geometrie';
import {
  FORMEN_PRO_LEVEL,
  TASTE_GRAD,
  TASTE_GRAD_FEIN,
  TASTE_SCHUB,
  TASTE_SCHUB_FEIN,
  bewertung,
  geradeAus,
  istZuKurz,
  naechsteForm,
  neuesLevel,
  schneidenAn,
} from './logik';
import type { Zustand } from './logik';
import { HalbierenIcon } from './Icon';

/**
 * Even Cut — eine Form mit einem Wisch in zwei gleich große Hälften teilen.
 *
 * Der Name ist bewusst ein eigener: Das Vorbild heißt anders, und hier gilt
 * die Projektregel — das Prinzip ist frei, der Name nicht.
 *
 * Diese Datei zeigt an und nimmt den Wisch entgegen. Gerechnet wird in
 * `geometrie.ts` (Fläche, Zerteilen) und `logik.ts` (Runde, Punkte), beides
 * ohne Browser geprüft.
 */

/** Halbe Kantenlänge des Spielfelds in Form-Einheiten. */
const FELD = 52;

/** Wie weit die beiden Stücke auseinanderrutschen. */
const AUSEINANDER = 9;

/** Wie lange das Ergebnis stehen bleibt, bevor die nächste Form kommt. */
const SCHAU_MS = 1250;

/** So lange steht ein Hinweis wie „zu kurz", danach kommt die Grundanleitung zurück. */
const HINWEIS_MS = 2600;

/**
 * Welches Level als Nächstes drankommt — als Modul-Variable, nicht als
 * React-State.
 *
 * „Nochmal" lässt die Hülle das Spiel per neuem `key` komplett neu mounten
 * (siehe `Spielrahmen.tsx`); ein `useState` landete also jedes Mal wieder
 * bei seinem Anfangswert und man spielte ewig Level 1. Genauso macht es
 * Color Pour.
 *
 * Zurück ins Menü und neu hinein setzt bewusst nicht zurück — wer bei
 * Level 9 aufgehört hat, will dort weitermachen.
 */
let naechstesLevel = 1;

const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 15, winkel: -12, verzoegerung: 0, inhalt: <DekoForm ecken={3} /> },
  { x: 86, y: 12, winkel: 20, verzoegerung: 0.6, inhalt: <DekoForm ecken={6} /> },
  { x: 88, y: 70, winkel: -8, verzoegerung: 1.2, inhalt: <DekoForm ecken={4} /> },
  { x: 5, y: 72, winkel: 26, verzoegerung: 0.35, inhalt: <DekoForm ecken={5} /> },
];

/** Eine geteilte Deko-Form für den Startbildschirm. */
function DekoForm({ ecken }: { ecken: number }) {
  const punkte = Array.from({ length: ecken }, (_, i) => {
    const w = (i / ecken) * 2 * Math.PI - Math.PI / 2;
    return `${(Math.cos(w) * 16).toFixed(1)},${(Math.sin(w) * 16).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="-20 -20 40 40" className="size-12">
      <polygon points={punkte} fill="#fbbf24" opacity={0.85} />
      <line x1={-19} y1={0} x2={19} y2={0} stroke="#ffffff" strokeWidth={1.6} opacity={0.9} />
    </svg>
  );
}

/** Ein Vieleck als SVG-Punkteliste. */
function alsPunkte(form: Form): string {
  return form.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/**
 * In welche Richtung rutscht ein Stück weg?
 *
 * Senkrecht zur Schnittlinie, und zwar von ihr weg. Über den Schwerpunkt
 * bestimmt: Er liegt immer auf der eigenen Seite, seine Richtung stimmt also
 * ohne Fallunterscheidung — auch bei einem winzigen Schnipsel.
 */
function wegrichtung(stueck: Form, a: Punkt, b: Punkt): Punkt {
  const laenge = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const normale = { x: -(b.y - a.y) / laenge, y: (b.x - a.x) / laenge };
  const s = schwerpunkt(stueck);
  const seiteVon = (s.x - a.x) * normale.x + (s.y - a.y) * normale.y;
  const vorzeichen = seiteVon >= 0 ? 1 : -1;
  return { x: normale.x * vorzeichen, y: normale.y * vorzeichen };
}

export function EvenCut({
  onScore,
  onGameOver,
  settings,
  bestScore,
  istErsteRunde,
  level: festesLevel,
}: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [z, setZ] = useState<Zustand>(() => neuesLevel(festesLevel ?? naechstesLevel));
  /** Der Wisch, während er noch läuft. */
  const [zug, setZug] = useState<{ von: Punkt; bis: Punkt } | null>(null);
  /** Eine Bildfolge später auf true — erst dann rutschen die Stücke weg. */
  const [getrennt, setGetrennt] = useState(false);
  /**
   * Die Schnittgerade der Tastatur: Drehung in Grad, Verschiebung aus der
   * Mitte. `null` heißt „gerade kein Tastaturweg im Bild" — sie taucht erst
   * auf, wenn wirklich eine Taste gedrückt wurde, und verschwindet wieder,
   * sobald jemand den Finger benutzt.
   */
  const [tastenlinie, setTastenlinie] = useState<{ winkel: number; schub: number } | null>(null);
  /** Kurze Zusatzmeldung unter dem Brett, etwa nach einem zu kurzen Wisch. */
  const [hinweis, setHinweis] = useState<string | null>(null);
  const brettRef = useRef<SVGSVGElement>(null);
  const gemeldet = useRef(false);

  /** Bildschirmpunkt in Form-Koordinaten umrechnen. */
  const alsFeld = useCallback((e: { clientX: number; clientY: number }): Punkt | null => {
    const kasten = brettRef.current?.getBoundingClientRect();
    if (!kasten || kasten.width === 0) return null;
    return {
      x: ((e.clientX - kasten.left) / kasten.width) * (FELD * 2) - FELD,
      y: ((e.clientY - kasten.top) / kasten.height) * (FELD * 2) - FELD,
    };
  }, []);

  /** Schneidet an einer fertigen Geraden — von der Wischgeste wie von der Tastatur. */
  const schneiden = useCallback((a: Punkt, b: Punkt) => {
    setZ((alt) => {
      const neu = schneidenAn(alt, a, b);
      if (neu === alt) return alt;
      sfx(neu.schnitt!.punkte > 0 ? 'stufe' : 'schlecht');
      return neu;
    });
  }, []);

  const beiZiehStart = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (z.schnitt || z.vorbei) return;
    const p = alsFeld(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Finger schlägt Tastatur: Zwei Schnittlinien gleichzeitig im Bild wären
    // nicht zu unterscheiden.
    setTastenlinie(null);
    setHinweis(null);
    setZug({ von: p, bis: p });
  };

  const beiZiehen = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!zug) return;
    const p = alsFeld(e);
    if (p) setZug((alt) => alt && { ...alt, bis: p });
  };

  const beiZiehEnde = () => {
    if (!zug) return;
    const { von, bis } = zug;
    setZug(null);
    // Zu kurz war früher ein stummes Nichts: kein Ton, kein Text, nicht
    // einmal eine Linie. Wer daneben tippt, soll erfahren, warum.
    if (istZuKurz(von, bis)) {
      sfx('klick');
      setHinweis('Zu kurz — zieh in einem Zug quer über die Form.');
      return;
    }
    schneiden(von, bis);
  };

  /**
   * Tastaturweg: Pfeile legen eine Schnittgerade an, Leertaste schneidet.
   *
   * Eigener Listener am Fenster statt `useInput` — genau wie bei Ring Rise
   * und Blade Toss: `useInput` kennt nur sieben grobe Aktionen und meldet
   * ein Antippen erst beim Loslassen, hier braucht es aber Tastenwieder-
   * holung beim Halten und einen feinen Schritt mit Umschalt.
   */
  useEffect(() => {
    if (!gestartet || z.schnitt || z.vorbei) return;
    const beiTaste = (e: KeyboardEvent) => {
      // Die Hülle hat eigene Knöpfe (Zurück, Level) — dort gehören die
      // Tasten dem Knopf, nicht dem Spielfeld.
      if (e.target instanceof Element && e.target.closest('button, a[href], input, select')) return;
      const grad = e.shiftKey ? TASTE_GRAD_FEIN : TASTE_GRAD;
      const schub = e.shiftKey ? TASTE_SCHUB_FEIN : TASTE_SCHUB;
      const start = { winkel: 0, schub: 0 };
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const richtung = e.key === 'ArrowLeft' ? -1 : 1;
          setHinweis(null);
          setTastenlinie((alt) =>
            // Die Drehung läuft im Kreis: Nach 180 Grad liegt dieselbe
            // Gerade wieder da, ein Anschlag wäre nur lästig.
            alt ? { ...alt, winkel: (alt.winkel + richtung * grad + 180) % 180 } : start,
          );
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const richtung = e.key === 'ArrowUp' ? -1 : 1;
          setHinweis(null);
          setTastenlinie((alt) =>
            alt
              ? // Am Feldrand ist Schluss — weiter draußen trifft die Gerade
                // die Form ohnehin nicht mehr.
                { ...alt, schub: Math.max(-FELD, Math.min(FELD, alt.schub + richtung * schub)) }
              : start,
          );
          break;
        }
        case ' ':
        case 'Enter': {
          e.preventDefault();
          if (e.repeat) return;
          if (!tastenlinie) {
            // Erst zeigen, dann schneiden: Blind auslösen, ohne die Gerade
            // je gesehen zu haben, wäre nur geraten.
            setTastenlinie(start);
            setHinweis('Mit den Pfeiltasten drehen und schieben, dann Leertaste.');
            return;
          }
          const { a, b } = geradeAus(tastenlinie.winkel, tastenlinie.schub);
          schneiden(a, b);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [gestartet, z.schnitt, z.vorbei, tastenlinie, schneiden]);

  // Ein Hinweis verschwindet von selbst wieder, sonst steht „zu kurz" noch
  // da, wenn längst geschnitten wurde.
  useEffect(() => {
    if (!hinweis) return;
    const uhr = window.setTimeout(() => setHinweis(null), HINWEIS_MS);
    return () => window.clearTimeout(uhr);
  }, [hinweis]);

  // Erst im nächsten Bild trennen, damit der Übergang wirklich läuft —
  // setzt man beides im selben Bild, springt es ohne Bewegung.
  useEffect(() => {
    if (!z.schnitt) {
      setGetrennt(false);
      return;
    }
    // Die Tastaturgerade hat ihren Zweck erfüllt — über den auseinander-
    // rutschenden Stücken wäre sie nur noch ein Strich im Bild.
    setTastenlinie(null);
    setHinweis(null);
    const bild = requestAnimationFrame(() => setGetrennt(true));
    const uhr = window.setTimeout(() => setZ((alt) => naechsteForm(alt)), SCHAU_MS);
    return () => {
      cancelAnimationFrame(bild);
      window.clearTimeout(uhr);
    };
  }, [z.schnitt]);

  useEffect(() => {
    onScore(z.punkte);
  }, [z.punkte, onScore]);

  useEffect(() => {
    if (!z.vorbei || gemeldet.current) return;
    gemeldet.current = true;
    // „Nochmal" spielt das nächste Level, nicht dasselbe noch einmal —
    // dieselben fünf Formen ein zweites Mal zu schneiden wäre langweilig.
    if (festesLevel === undefined) naechstesLevel = z.level + 1;
    sfx('ende');
    onGameOver(z.punkte);
  }, [z.vorbei, z.punkte, z.level, onGameOver]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Even Cut"
        untertitel="Ein Wisch, zwei gleich große Hälften. Je genauer, desto mehr Punkte."
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #0f766e 0%, #115e59 45%, #422006 100%)"
        deko={DEKO}
        Symbol={HalbierenIcon}
        knopfFarbe="#134e4a"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const schnitt = z.schnitt;
  // Bei „weniger Bewegung" rutschen die Stücke sofort auseinander, statt zu
  // gleiten — das Ergebnis ist dasselbe, nur ohne Weg dorthin.
  const versatz = getrennt || settings.reducedMotion ? AUSEINANDER : 0;
  const tastenGerade = tastenlinie ? geradeAus(tastenlinie.winkel, tastenlinie.schub) : null;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 px-3 pt-2">
      <div className="flex w-full max-w-md items-baseline justify-between text-sm">
        <span className="font-semibold text-gedaempft">
          Level {z.level} · Form {z.index + 1} von {FORMEN_PRO_LEVEL}
        </span>
        <span className="text-lg font-black tabular-nums">{z.punkte}</span>
      </div>

      <div className="spielbuehne">
        <svg
          ref={brettRef}
          viewBox={`${-FELD} ${-FELD} ${FELD * 2} ${FELD * 2}`}
          className="spielbrett spielbrett-rahmen touch-none select-none"
          style={{ '--vz': 1 } as CSSProperties}
          onPointerDown={beiZiehStart}
          onPointerMove={beiZiehen}
          onPointerUp={beiZiehEnde}
          onPointerCancel={() => setZug(null)}
          // Anfassbar mit der Tastatur: Ohne `tabIndex` war das Brett nicht
          // einmal erreichbar, und die Ansage darin nirgends zu hören.
          tabIndex={0}
          role="img"
          aria-label={
            schnitt
              ? `${bewertung(schnitt.genau)} — ${schnitt.punkte} Punkte.`
              : `Form ${z.index + 1} von ${FORMEN_PRO_LEVEL}. Wische quer darüber, um sie zu halbieren. Mit der Tastatur: Pfeiltasten drehen und verschieben die Schnittlinie, Umschalt dazu für feine Schritte, Leertaste schneidet.`
          }
        >
          <defs>
            <linearGradient id="evencut-form" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#fcd34d" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Hilfslinien durch die Mitte: Sie sagen nicht, wo der richtige
              Schnitt liegt — die Formen sind ja gedreht —, geben dem Auge
              aber einen Bezugspunkt. Ohne sie wirkt die Fläche leer. */}
          <g stroke="currentColor" strokeWidth={0.4} opacity={0.12}>
            <line x1={-FELD} y1={0} x2={FELD} y2={0} />
            <line x1={0} y1={-FELD} x2={0} y2={FELD} />
          </g>

          {!schnitt && (
            <polygon points={alsPunkte(z.form)} fill="url(#evencut-form)" stroke="#78350f" strokeWidth={1} />
          )}

          {schnitt &&
            (
              [
                { teil: schnitt.links, id: 'links' },
                { teil: schnitt.rechts, id: 'rechts' },
              ] as const
            ).map(({ teil, id }) => {
              if (teil.length < 3) return null;
              const richtung = wegrichtung(teil, schnitt.a, schnitt.b);
              return (
                <polygon
                  key={id}
                  points={alsPunkte(teil)}
                  fill="url(#evencut-form)"
                  stroke="#78350f"
                  strokeWidth={1}
                  style={{
                    transform: `translate(${(richtung.x * versatz).toFixed(2)}px, ${(richtung.y * versatz).toFixed(2)}px)`,
                    transition: settings.reducedMotion ? undefined : 'transform 0.45s ease-out',
                  }}
                />
              );
            })}

          {/* Die Schnittlinie beim Ziehen — über die ganze Fläche verlängert,
              damit man sieht, wo sie wirklich durchgeht. Nur das Stück
              zwischen den Fingern zu zeigen wäre irreführend: Geschnitten
              wird entlang der ganzen Geraden. */}
          {zug && (
            <ZiehLinie von={zug.von} bis={zug.bis} />
          )}

          {/* Dieselbe Gerade, nur mit den Pfeiltasten gelegt. Kein Punkt am
              Ende: Bei der Tastatur gibt es keine Fingerspitze, die man
              markieren könnte. */}
          {!zug && tastenGerade && (
            <ZiehLinie von={tastenGerade.a} bis={tastenGerade.b} mitPunkt={false} />
          )}
        </svg>
      </div>

      {/* Fester Platz, auch wenn nichts drinsteht — sonst hüpft das Brett
          bei jeder Rückmeldung eine Zeile hoch und runter.

          Vor dem ersten Schnitt steht hier die Anleitung: Auf einem kurzen
          Handy-Bildschirm ist der Hilfetext unten ausgeblendet und der
          Startbildschirm nach „Nochmal" übersprungen — ohne diese Zeile
          stünde dort dann gar keine Erklärung mehr im Bild. */}
      <div className="flex h-12 flex-col items-center justify-center">
        {schnitt ? (
          <>
            <p
              className="antwort-richtig text-lg font-black"
              style={{ color: schnitt.punkte > 0 ? '#fbbf24' : '#f87171' }}
            >
              {bewertung(schnitt.genau)} +{schnitt.punkte}
            </p>
            <p className="text-xs text-gedaempft tabular-nums">
              {schnitt.genau.toFixed(1)} % gleich geteilt
            </p>
          </>
        ) : hinweis ? (
          <p className="text-center text-xs font-semibold text-amber-300">{hinweis}</p>
        ) : (
          <p className="text-center text-xs text-gedaempft">
            {tastenlinie
              ? 'Pfeiltasten drehen und schieben · Leertaste schneidet'
              : 'Wische quer über die Form.'}
          </p>
        )}
      </div>

      <p className="nur-bei-platz max-w-md text-center text-xs text-gedaempft">
        Wische quer über die Form. Geschnitten wird entlang der ganzen Linie — je gleicher die
        beiden Hälften werden, desto mehr Punkte. Mit der Tastatur geht es auch: Pfeiltasten legen
        die Linie, Umschalt macht die Schritte fein, Leertaste schneidet. Nach fünf Formen ist die
        Runde vorbei; „Nochmal" startet das nächste Level.
      </p>

    </div>
  );
}

/** Die gestrichelte Schnittgerade, über das ganze Feld verlängert. */
function ZiehLinie({ von, bis, mitPunkt = true }: { von: Punkt; bis: Punkt; mitPunkt?: boolean }) {
  const dx = bis.x - von.x;
  const dy = bis.y - von.y;
  const laenge = Math.hypot(dx, dy);
  if (laenge < 0.5) return null;
  // Weit über den Rand hinaus verlängern — die Gerade schneidet ja unendlich.
  const streckung = (FELD * 3) / laenge;
  return (
    <g>
      <line
        x1={von.x - dx * streckung}
        y1={von.y - dy * streckung}
        x2={bis.x + dx * streckung}
        y2={bis.y + dy * streckung}
        stroke="#ffffff"
        strokeWidth={1.2}
        strokeDasharray="4 3"
        opacity={0.9}
      />
      {mitPunkt && <circle cx={bis.x} cy={bis.y} r={2.2} fill="#ffffff" opacity={0.9} />}
    </g>
  );
}
