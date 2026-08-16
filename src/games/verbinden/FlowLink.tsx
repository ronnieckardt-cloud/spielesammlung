import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { Startbildschirm } from '../../core/Startbildschirm';
import { levelstand } from '../../core/levelstand';
import type { DekoTeil } from '../../core/Startbildschirm';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import { zuXY, zuZelle } from './erzeuger';
import type { Zelle } from './erzeuger';
import {
  fertig,
  neuesLevel,
  punkteFuerZuege,
  ziehenBeenden,
  ziehenBis,
  ziehenStarten,
} from './logik';
import type { Zustand } from './logik';
import { FARBEN, wegfarbe } from './farben';
import { VerbindenIcon } from './Icon';

/**
 * Flow Link — gleichfarbige Punkte verbinden, ohne sich zu kreuzen, bis
 * jedes Feld belegt ist.
 *
 * Eigener Name, wie überall: Das Vorbild heißt anders.
 *
 * Diese Datei zeigt an und nimmt den Finger entgegen. Die Regeln stehen in
 * `logik.ts`, das Erzeugen der Rätsel in `erzeuger.ts` — beides ohne Browser
 * geprüft.
 */

/** Kantenlänge eines Feldes im Zeichensystem. */
const FELD = 10;

/**
 * Wie lange das gelöste Bild stehen bleibt, bevor die Runde endet.
 * Ohne diese Pause verschwindet das fertige Muster im selben Augenblick,
 * in dem der letzte Weg zumacht — und genau darauf hat man hingearbeitet.
 */
const FEIER_MS = 900;

/**
 * Welche Levelnummer als Nächstes drankommt.
 *
 * Der Baustein hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * **und** überträgt ihn beim ersten Betreten aus dem Speicher der Hülle.
 * Vorher war das eine nackte Modul-Variable — die überlebte kein Schließen
 * der App, und man fing jedes Mal bei Level 1 an.
 */
const levelStand = levelstand();

const DEKO: readonly DekoTeil[] = FARBEN.slice(0, 4).map((f, i) => ({
  x: [7, 87, 89, 6][i]!,
  y: [14, 11, 70, 73][i]!,
  verzoegerung: i * 0.4,
  inhalt: (
    <svg viewBox="-16 -16 32 32" className="size-11">
      <path d="M-12,0 H12" stroke={f.hex} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
      <circle cx={-12} cy={0} r={5} fill={f.hex} />
      <circle cx={12} cy={0} r={5} fill={f.hex} />
    </svg>
  ),
}));

export function FlowLink({
  onScore,
  onGameOver,
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
  const brettRef = useRef<SVGSVGElement>(null);
  const gemeldet = useRef(false);
  const { breite, hoehe } = z.raetsel;

  /** Bildschirmpunkt in ein Feld umrechnen — oder null, wenn daneben. */
  const feldUnter = useCallback(
    (e: { clientX: number; clientY: number }): Zelle | null => {
      const kasten = brettRef.current?.getBoundingClientRect();
      if (!kasten || kasten.width === 0) return null;
      const x = Math.floor(((e.clientX - kasten.left) / kasten.width) * breite);
      const y = Math.floor(((e.clientY - kasten.top) / kasten.height) * hoehe);
      if (x < 0 || y < 0 || x >= breite || y >= hoehe) return null;
      return zuZelle(x, y, breite);
    },
    [breite, hoehe],
  );

  const beiStart = (e: ReactPointerEvent<SVGSVGElement>) => {
    const feld = feldUnter(e);
    if (feld === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setZ((alt) => {
      const neu = ziehenStarten(alt, feld);
      if (neu !== alt) sfx('klick');
      return neu;
    });
  };

  const beiBewegen = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (z.zieht === null) return;
    const feld = feldUnter(e);
    if (feld === null) return;
    setZ((alt) => {
      // `ziehenBis` statt `ziehenNach`: Springt der Finger über ein Feld
      // hinweg oder über Eck, werden die Zwischenfelder nachgezogen, statt
      // den Sprung wegzuwerfen.
      const neu = ziehenBis(alt, feld);
      // Nur wenn wirklich ein Feld dazugekommen ist — sonst klackert es
      // bei jeder Fingerbewegung.
      if (neu !== alt && neu.wege[alt.zieht!]!.length > alt.wege[alt.zieht!]!.length) {
        sfx('klick');
      }
      return neu;
    });
  };

  const beiEnde = () => {
    setZ((alt) => {
      const neu = ziehenBeenden(alt);
      if (neu !== alt && alt.zieht !== null && fertig(neu, alt.zieht)) sfx('gut');
      return neu;
    });
  };

  /**
   * Freie Levelwahl — wie bei Color Pour.
   *
   * Ohne sie ist ein Rätsel, das man nicht lösen kann, eine Sackgasse: Die
   * Levelnummer stieg bisher **ausschließlich** beim Lösen, und weil dieselbe
   * Nummer immer dasselbe Rätsel ergibt, bekommt man beim erneuten Betreten
   * exakt dasselbe Brett wieder vorgesetzt.
   */
  const beiLevelWechsel = useCallback(
    (neu: number) => {
      // Im Duell steht das Level fest — sonst könnte man sich das leichteste
      // aussuchen und der Vergleich wäre wertlos.
      if (festesLevel !== undefined) return;
      const geklemmt = Math.max(1, neu);
      meldeLevel(geklemmt);
      setZ(neuesLevel(geklemmt));
      sfx('klick');
    },
    [festesLevel],
  );

  useEffect(() => {
    onScore(z.geloest ? punkteFuerZuege(z.level, z.raetsel.paare.length, z.zuege) : 0);
  }, [z.geloest, z.level, z.raetsel.paare.length, z.zuege, onScore]);

  useEffect(() => {
    if (!z.geloest || gemeldet.current) return;
    gemeldet.current = true;
    sfx('stufe');
    // „Nochmal" spielt das nächste Level — dasselbe Rätsel ein zweites Mal
    // zu lösen wäre sinnlos, man weiß ja noch, wie es geht.
    if (festesLevel === undefined) meldeLevel(z.level + 1);
    const uhr = window.setTimeout(
      () => onGameOver(punkteFuerZuege(z.level, z.raetsel.paare.length, z.zuege), true),
      FEIER_MS,
    );
    return () => window.clearTimeout(uhr);
  }, [z.geloest, z.level, z.raetsel.paare.length, z.zuege, onGameOver]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Flow Link"
        untertitel="Verbinde gleiche Punkte — und füll dabei jedes Feld."
        bestScore={bestScore}
        verlauf="linear-gradient(160deg, #1e3a8a 0%, #4c1d95 50%, #831843 100%)"
        deko={DEKO}
        Symbol={VerbindenIcon}
        knopfFarbe="#1e3a8a"
        onStart={() => setGestartet(true)}
      />
    );
  }

  const geschafft = z.raetsel.paare.filter((_, f) => fertig(z, f)).length;
  const belegt = new Set(z.wege.flat()).size;

  return (
    <div className="spielseite flex min-h-0 flex-1 flex-col items-center gap-2 px-3 pt-2">
      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1 || z.geloest || festesLevel !== undefined}
            aria-label="Voriges Level"
            className="spielknopf text-base leading-none transition-transform active:scale-95"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            // Während der Feier-Pause gesperrt: Ein Tipp dort würde den
            // Zeitgeber abräumen und die Runde käme nie in der Bestenliste an.
            disabled={z.geloest || festesLevel !== undefined}
            aria-label="Nächstes Level"
            className="spielknopf text-base leading-none transition-transform active:scale-95"
          >
            ›
          </button>
        </div>
        <span className="tabular-nums text-gedaempft">
          {geschafft}/{z.raetsel.paare.length} verbunden · {belegt}/{breite * hoehe} Felder
        </span>
      </div>

      <div className="spielbuehne">
        <svg
          ref={brettRef}
          viewBox={`0 0 ${breite * FELD} ${hoehe * FELD}`}
          className="spielbrett spielbrett-rahmen touch-none select-none"
          style={{ '--vz': breite / hoehe } as CSSProperties}
          onPointerDown={beiStart}
          onPointerMove={beiBewegen}
          onPointerUp={beiEnde}
          onPointerCancel={beiEnde}
          role="img"
          aria-label={`Flow Link, Level ${z.level}. ${geschafft} von ${z.raetsel.paare.length} Paaren verbunden, ${belegt} von ${breite * hoehe} Feldern belegt.`}
        >
          {/* Das Raster. Bewusst nur zarte Linien: Die Wege sind das Bild,
              das Gitter ist nur die Hilfslinie darunter. */}
          <g stroke="currentColor" strokeWidth={0.25} opacity={0.18}>
            {Array.from({ length: breite + 1 }, (_, i) => (
              <line key={`s${i}`} x1={i * FELD} y1={0} x2={i * FELD} y2={hoehe * FELD} />
            ))}
            {Array.from({ length: hoehe + 1 }, (_, i) => (
              <line key={`z${i}`} x1={0} y1={i * FELD} x2={breite * FELD} y2={i * FELD} />
            ))}
          </g>

          {/* Die Wege als ein durchgehender Linienzug je Farbe. Runde Ecken
              und Enden — dieselbe Machart wie die Schlange in Snake Rush;
              Einzelkacheln mit Fuge dazwischen sähen aus wie eine Perlenkette
              statt wie ein Kabel. */}
          {z.wege.map((weg, f) => {
            if (weg.length < 2) return null;
            const punkte = weg
              .map((zelle) => {
                const { x, y } = zuXY(zelle, breite);
                return `${x * FELD + FELD / 2},${y * FELD + FELD / 2}`;
              })
              .join(' ');
            return (
              <polyline
                key={f}
                points={punkte}
                fill="none"
                stroke={wegfarbe(f).hex}
                strokeWidth={FELD * 0.52}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            );
          })}

          {/* Die Punktepaare. Sie liegen über den Wegen, damit ein Weg, der
              auf seinem eigenen Punkt endet, das Zeichen nicht verdeckt. */}
          {z.raetsel.paare.map((paar) =>
            [paar.a, paar.b].map((zelle) => {
              const { x, y } = zuXY(zelle, breite);
              const f = wegfarbe(paar.farbe);
              const mx = x * FELD + FELD / 2;
              const my = y * FELD + FELD / 2;
              const zu = fertig(z, paar.farbe);
              return (
                <g key={`${paar.farbe}-${zelle}`} transform={`translate(${mx} ${my})`}>
                  <circle r={FELD * 0.36} fill={f.hex} stroke={f.rand} strokeWidth={0.6} />
                  {/* Das Zeichen macht das Paar auch ohne Farbe erkennbar. */}
                  <path d={f.zeichen} fill={f.rand} opacity={0.85} transform="scale(0.62)" />
                  {/* Ein heller Ring zeigt: dieses Paar ist durchverbunden. */}
                  {zu && (
                    <circle
                      r={FELD * 0.44}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={0.7}
                      opacity={0.8}
                    />
                  )}
                </g>
              );
            }),
          )}
        </svg>
      </div>

      <div className="flex h-8 items-center justify-center">
        {z.geloest ? (
          <p className="antwort-richtig text-lg font-black text-emerald-300">
            🎉 Geschafft in {z.zuege} Zügen!
          </p>
        ) : (
          <p className="text-xs text-gedaempft">
            {z.zieht !== null
              ? `${wegfarbe(z.zieht).name} — zieh zum zweiten Punkt.`
              : 'Halte einen Punkt und zieh zu seinem Zwilling.'}
          </p>
        )}
      </div>

      <p className="nur-bei-platz max-w-md text-center text-xs text-gedaempft">
        Verbinde jedes Punktepaar. Wege dürfen sich nicht kreuzen — und am Ende muss
        <em> jedes</em> Feld belegt sein. Läufst du über einen fremden Weg, wird der dort
        gekappt. Ein Punkt noch einmal angetippt löscht seinen Weg.
        {festesLevel === undefined && ' Zu schwer? Mit den Pfeilen oben wechselst du das Level.'}
      </p>
    </div>
  );
}
