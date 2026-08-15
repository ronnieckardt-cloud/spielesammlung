import { useCallback, useEffect, useRef, useState } from 'react';
import { useInput } from '../../core/useInput';
import { Startbildschirm } from '../../core/Startbildschirm';
import type { DekoTeil } from '../../core/Startbildschirm';
import { sfx } from '../../core/sfx';
import { saatAus } from '../../core/rng';
import type { GameProps } from '../../core/types';
import { neuesSpiel, punkte, rutschen, spurWechseln, springen, takt, tempoBei } from './logik';
import type { Lauf } from './logik';
import type { Szene } from './szene';
import { LaufenIcon } from './Icon';

/**
 * Dash City — der Endlosläufer in echtem 3-D.
 *
 * **Warum three.js hier ausnahmsweise dabei ist:** Ronni wollte ausdrücklich
 * ein richtiges 3-D-Spiel, keine Perspektiv-Täuschung („keine halben
 * Sachen"). Der Preis — rund 133 kB gepackt — trifft aber **nur dieses
 * Spiel**: `szene.ts` wird unten per `await import(...)` nachgeladen und
 * landet dadurch in einem eigenen Brocken. Wer Snake Rush spielt, lädt
 * three.js nie.
 *
 * Damit das auch offline hält, nimmt der Service Worker seit dieser Fassung
 * **alle** gebauten Dateien in den Vorrat auf (siehe `public/sw.js` und die
 * Dateiliste aus `vite.config.ts`) — sonst wäre genau dieses Spiel das
 * einzige, das ohne Netz fehlt.
 *
 * Die Spielregeln stehen unverändert in `logik.ts` und sind ohne Browser
 * geprüft. Diese Datei verbindet nur Eingabe, Schleife und Anzeige.
 */

const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 18, winkel: 0, verzoegerung: 0, inhalt: <DekoHaus hoehe={44} /> },
  { x: 87, y: 14, winkel: 0, verzoegerung: 0.7, inhalt: <DekoHaus hoehe={58} /> },
  { x: 90, y: 66, winkel: 0, verzoegerung: 1.3, inhalt: <DekoHaus hoehe={36} /> },
  { x: 5, y: 70, winkel: 0, verzoegerung: 0.4, inhalt: <DekoHaus hoehe={50} /> },
];

function DekoHaus({ hoehe }: { hoehe: number }) {
  return (
    <svg viewBox="0 0 30 70" className="w-8" style={{ height: hoehe }}>
      <rect x={2} y={70 - hoehe} width={26} height={hoehe} rx={2} fill="#334155" opacity={0.9} />
      {Array.from({ length: Math.floor(hoehe / 10) }, (_, r) =>
        [6, 13, 20].map((x) => (
          <rect
            key={`${r}-${x}`}
            x={x}
            y={70 - hoehe + 6 + r * 10}
            width={4}
            height={5}
            fill="#fbbf24"
            opacity={(r + x) % 3 === 0 ? 0.25 : 0.75}
          />
        )),
      )}
    </svg>
  );
}

export function DashCity({ onScore, onGameOver, bestScore, istErsteRunde }: GameProps) {
  const [gestartet, setGestartet] = useState(!istErsteRunde);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [anzeige, setAnzeige] = useState({ punkte: 0, muenzen: 0, tempo: 0 });

  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const laufRef = useRef<Lauf>(neuesSpiel(saatAus('laufen', Date.now())));
  const szeneRef = useRef<Szene | null>(null);
  const gemeldet = useRef(false);

  /**
   * Eingaben gehen über eine Ref, nicht über den React-Zustand.
   *
   * Der Lauf wird sechzigmal je Sekunde fortgeschrieben; würde daraus jedes
   * Mal ein `setState`, rechnete React sechzigmal je Sekunde einen
   * kompletten Baum durch, während three.js daneben zeichnet. Der sichtbare
   * Zustand wird deshalb nur viermal je Sekunde nach außen gemeldet.
   */
  const beiEingabe = useCallback((was: 'links' | 'rechts' | 'hoch' | 'runter') => {
    const l = laufRef.current;
    if (l.vorbei) return;
    if (was === 'links') laufRef.current = spurWechseln(l, -1);
    else if (was === 'rechts') laufRef.current = spurWechseln(l, 1);
    else if (was === 'hoch') {
      const neu = springen(l);
      if (neu !== l) sfx('klick', 5);
      laufRef.current = neu;
    } else {
      laufRef.current = rutschen(l);
      sfx('klick');
    }
  }, []);

  useInput(
    (aktion) => {
      if (aktion === 'left') beiEingabe('links');
      else if (aktion === 'right') beiEingabe('rechts');
      else if (aktion === 'up') beiEingabe('hoch');
      else if (aktion === 'down') beiEingabe('runter');
    },
    { aktiv: gestartet && !fehler },
  );

  // Szene aufbauen, sobald gestartet wird — und erst dann three.js laden.
  useEffect(() => {
    if (!gestartet) return;
    let abgebrochen = false;
    let bild = 0;
    let letzte = performance.now();
    let seitMeldung = 0;

    setLaedt(true);

    void (async () => {
      try {
        const { szeneBauen } = await import('./szene');
        if (abgebrochen || !leinwandRef.current) return;

        const szene = szeneBauen(leinwandRef.current);
        szeneRef.current = szene;
        const messen = () => {
          const eltern = leinwandRef.current?.parentElement;
          if (eltern) szene.groesseAendern(eltern.clientWidth, eltern.clientHeight);
        };
        messen();
        window.addEventListener('resize', messen);
        setLaedt(false);

        const schleife = (jetzt: number) => {
          if (abgebrochen) return;
          // Zeitschritt deckeln: Nach einem Wechsel in eine andere App wäre
          // `dt` sonst mehrere Sekunden groß, und die Figur führe blind
          // durch ein Dutzend Hindernisse.
          const dt = Math.min(0.05, (jetzt - letzte) / 1000);
          letzte = jetzt;

          const vorher = laufRef.current;
          const neu = takt(vorher, dt);
          laufRef.current = neu;

          if (neu.muenzenZahl > vorher.muenzenZahl) sfx('gut', Math.min(12, neu.muenzenZahl));

          szene.zeichnen(neu, dt);

          seitMeldung += dt;
          if (seitMeldung > 0.25) {
            seitMeldung = 0;
            setAnzeige({
              punkte: punkte(neu),
              muenzen: neu.muenzenZahl,
              tempo: tempoBei(neu.strecke),
            });
          }

          if (neu.vorbei) {
            if (!gemeldet.current) {
              gemeldet.current = true;
              sfx('ende');
              setAnzeige({ punkte: punkte(neu), muenzen: neu.muenzenZahl, tempo: 0 });
              // Kurz stehen lassen — man will den Aufprall noch sehen.
              window.setTimeout(() => onGameOver(punkte(neu)), 700);
            }
            return;
          }
          bild = requestAnimationFrame(schleife);
        };
        bild = requestAnimationFrame(schleife);

        return () => window.removeEventListener('resize', messen);
      } catch {
        if (!abgebrochen) {
          setLaedt(false);
          setFehler('Der 3-D-Teil lässt sich hier nicht starten.');
        }
      }
    })();

    return () => {
      abgebrochen = true;
      cancelAnimationFrame(bild);
      szeneRef.current?.aufraeumen();
      szeneRef.current = null;
    };
  }, [gestartet, onGameOver]);

  useEffect(() => {
    onScore(anzeige.punkte);
  }, [anzeige.punkte, onScore]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Dash City"
        untertitel="Wisch zur Seite, nach oben zum Springen, nach unten zum Rutschen."
        bestScore={bestScore}
        verlauf="linear-gradient(170deg, #1e1b4b 0%, #312e81 40%, #0f172a 100%)"
        deko={DEKO}
        Symbol={LaufenIcon}
        knopfFarbe="#312e81"
        onStart={() => setGestartet(true)}
      />
    );
  }

  if (fehler) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center">
        <p className="text-sm text-gedaempft">{fehler}</p>
        <p className="text-xs text-gedaempft">
          Das kann an einem sehr alten Browser liegen. Alle anderen Spiele laufen weiter.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Die Leinwand füllt alles. Die Anzeigen liegen darüber — bei einem
          3-D-Spiel gehört der Blick nach vorn, nicht auf eine Kopfzeile. */}
      <div className="relative min-h-0 flex-1 touch-none">
        <canvas ref={leinwandRef} className="size-full" />

        {laedt && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
            Stadt wird gebaut …
          </p>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span
            className="text-4xl leading-none font-black tabular-nums text-white"
            style={{ textShadow: '0 2px 0 rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.6)' }}
          >
            {anzeige.punkte}
          </span>
          <span
            className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm font-bold text-amber-300 tabular-nums backdrop-blur-sm"
            aria-label={`${anzeige.muenzen} Münzen`}
          >
            <svg viewBox="-10 -10 20 20" className="size-4" aria-hidden="true">
              <circle r={8} fill="#facc15" stroke="#a16207" strokeWidth={2} />
            </svg>
            {anzeige.muenzen}
          </span>
        </div>

        {/* Tempoanzeige unten — sie erklärt ohne Worte, warum es schwerer
            wird. Ein Balken statt einer Zahl: Beim Laufen liest niemand. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-rose-400"
              style={{ width: `${Math.min(100, (anzeige.tempo / 22) * 100).toFixed(0)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
