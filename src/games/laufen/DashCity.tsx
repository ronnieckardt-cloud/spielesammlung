import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Sachen"). Der Preis — rund 130 kB gepackt — trifft aber **nur dieses
 * Spiel**: `szene.ts` wird unten per `await import(...)` nachgeladen und
 * landet dadurch in einem eigenen Brocken. Wer Snake Rush spielt, lädt
 * three.js nie.
 *
 * Die Spielregeln stehen in `logik.ts` und sind ohne Browser geprüft. Diese
 * Datei verbindet nur Eingabe, Schleife und Anzeige.
 */

/**
 * **Eigene Steuerung statt `useInput`** — und das ist kein Sonderweg aus
 * Bequemlichkeit, sondern nötig.
 *
 * `useInput` ist für Rasterspiele gebaut: Ein Wisch heißt dort „ein Feld
 * weiter". Zwei Dinge passen deshalb nicht:
 *
 * 1. Ein Wisch nach unten wird dort, wenn er weit oder schnell ist, zu
 *    `drop` statt zu `down` — beim Läufer ist ein schneller Wisch nach unten
 *    aber genau das Ducken. Es kam schlicht nie an.
 * 2. Ein Antippen bedeutet dort `select`. Bei einem Läufer erwartet jeder,
 *    dass Tippen springt — und ohne das findet man das Springen gar nicht.
 *
 * Blade Toss und Ring Rise haben aus verwandten Gründen ebenfalls eigene
 * Listener. Hier kommt dazu: Die Schwelle ist kleiner (18 statt 24 Pixel),
 * damit auch der hektische Daumen eines Kindes durchkommt.
 */
const WISCH_SCHWELLE = 18;

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
  /**
   * Nur für den Startmoment. Er verschwindet mit der ersten Geste — und
   * spätestens nach ein paar Sekunden von selbst: Wer ihn liest, statt zu
   * spielen, soll nicht ausgerechnet deshalb ins erste Hindernis rennen.
   */
  const [zeigeHinweis, setZeigeHinweis] = useState(true);

  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const laufRef = useRef<Lauf>(neuesSpiel(saatAus('laufen', Date.now())));
  const szeneRef = useRef<Szene | null>(null);
  const gemeldet = useRef(false);

  /**
   * Die Anzeigen werden **direkt ins DOM** geschrieben, nicht über React.
   *
   * Der Lauf wird sechzigmal je Sekunde fortgeschrieben. Ginge davon auch
   * nur viermal je Sekunde ein `setState` aus, rechnete React mitten in die
   * Zeichenschleife hinein — und genau das war der Grund, warum es sich
   * nicht ganz flüssig anfühlte. Jetzt rendert React während des Laufens
   * **gar nicht** mehr.
   */
  const punkteRef = useRef<HTMLSpanElement>(null);
  const muenzenRef = useRef<HTMLSpanElement>(null);
  const tempoRef = useRef<HTMLDivElement>(null);

  const eingabe = useCallback((was: 'links' | 'rechts' | 'hoch' | 'runter') => {
    const l = laufRef.current;
    if (l.vorbei) return;
    setZeigeHinweis(false);
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

  // Der Hinweis blendet sich nach ein paar Sekunden selbst aus.
  useEffect(() => {
    if (!gestartet || !zeigeHinweis) return;
    const uhr = window.setTimeout(() => setZeigeHinweis(false), 4500);
    return () => window.clearTimeout(uhr);
  }, [gestartet, zeigeHinweis]);

  // --- Eingabe: Finger und Tastatur --------------------------------
  useEffect(() => {
    if (!gestartet || fehler) return;
    const buehne = buehneRef.current;
    if (!buehne) return;

    let zeiger: { id: number; x: number; y: number; zeit: number; fertig: boolean } | null = null;

    const ab = (e: PointerEvent) => {
      zeiger = { id: e.pointerId, x: e.clientX, y: e.clientY, zeit: e.timeStamp, fertig: false };
      buehne.setPointerCapture(e.pointerId);
    };

    const bewegt = (e: PointerEvent) => {
      if (!zeiger || e.pointerId !== zeiger.id || zeiger.fertig) return;
      if (e.cancelable) e.preventDefault();
      const dx = e.clientX - zeiger.x;
      const dy = e.clientY - zeiger.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < WISCH_SCHWELLE) return;
      // Gesperrt bis zum Loslassen: Ein langer Wisch ist **eine** Handlung.
      zeiger.fertig = true;
      if (Math.abs(dx) > Math.abs(dy)) eingabe(dx > 0 ? 'rechts' : 'links');
      else eingabe(dy < 0 ? 'hoch' : 'runter');
    };

    const auf = (e: PointerEvent) => {
      if (!zeiger || e.pointerId !== zeiger.id) return;
      const kurz = e.timeStamp - zeiger.zeit < 350;
      const klein =
        Math.max(Math.abs(e.clientX - zeiger.x), Math.abs(e.clientY - zeiger.y)) < WISCH_SCHWELLE;
      const schonGewischt = zeiger.fertig;
      zeiger = null;
      // Kurzes Antippen = springen. Ohne das findet man das Springen nicht,
      // und bei einem Läufer erwartet es ohnehin jeder.
      if (!schonGewischt && kurz && klein) eingabe('hoch');
    };

    const beiTaste = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('button, a[href], input')) return;
      const zuordnung: Record<string, 'links' | 'rechts' | 'hoch' | 'runter'> = {
        ArrowLeft: 'links',
        KeyA: 'links',
        ArrowRight: 'rechts',
        KeyD: 'rechts',
        ArrowUp: 'hoch',
        KeyW: 'hoch',
        Space: 'hoch',
        ArrowDown: 'runter',
        KeyS: 'runter',
      };
      const was = zuordnung[e.code];
      if (!was) return;
      e.preventDefault();
      eingabe(was);
    };

    buehne.addEventListener('pointerdown', ab, { passive: true });
    buehne.addEventListener('pointermove', bewegt, { passive: false });
    buehne.addEventListener('pointerup', auf, { passive: true });
    buehne.addEventListener('pointercancel', () => (zeiger = null), { passive: true });
    window.addEventListener('keydown', beiTaste, { passive: false });

    return () => {
      buehne.removeEventListener('pointerdown', ab);
      buehne.removeEventListener('pointermove', bewegt);
      buehne.removeEventListener('pointerup', auf);
      window.removeEventListener('keydown', beiTaste);
    };
  }, [gestartet, fehler, eingabe]);

  // --- Szene und Schleife ------------------------------------------
  useEffect(() => {
    if (!gestartet) return;
    let abgebrochen = false;
    let bild = 0;
    let letzte = performance.now();

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

        let letztePunkte = -1;
        let letzteMuenzen = -1;
        let seitMeldung = 0;

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

          // Anzeigen nur anfassen, wenn sich die Zahl wirklich geändert hat.
          const p = punkte(neu);
          if (p !== letztePunkte && punkteRef.current) {
            punkteRef.current.textContent = String(p);
            letztePunkte = p;
          }
          if (neu.muenzenZahl !== letzteMuenzen && muenzenRef.current) {
            muenzenRef.current.textContent = String(neu.muenzenZahl);
            letzteMuenzen = neu.muenzenZahl;
          }
          if (tempoRef.current) {
            tempoRef.current.style.width = `${Math.min(100, (tempoBei(neu.strecke) / 22) * 100).toFixed(0)}%`;
          }

          // Die Kopfzeile der Hülle braucht den Punktestand auch während des
          // Laufens — sonst steht sie die ganze Runde auf null und springt
          // erst am Ende. Zweimal je Sekunde reicht dafür und ist billig:
          // React zeichnet dabei nur ein paar Textknoten neu, die Leinwand
          // bleibt unangetastet.
          seitMeldung += dt;
          if (seitMeldung >= 0.5) {
            seitMeldung = 0;
            onScore(p);
          }

          if (neu.vorbei) {
            if (!gemeldet.current) {
              gemeldet.current = true;
              sfx('ende');
              onScore(p);
              // Kurz stehen lassen — man will den Aufprall noch sehen.
              window.setTimeout(() => onGameOver(p), 700);
            }
            return;
          }
          bild = requestAnimationFrame(schleife);
        };
        bild = requestAnimationFrame(schleife);
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
  }, [gestartet, onGameOver, onScore]);

  if (!gestartet) {
    return (
      <Startbildschirm
        titel="Dash City"
        untertitel="Tippen springt. Wisch zur Seite zum Ausweichen, nach unten zum Rutschen."
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
    <div ref={buehneRef} className="relative min-h-0 flex-1 touch-none select-none">
      <canvas ref={leinwandRef} className="size-full" />

      {laedt && (
        <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
          Stadt wird gebaut …
        </p>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span
          ref={punkteRef}
          className="text-4xl leading-none font-black tabular-nums text-white"
          style={{ textShadow: '0 2px 0 rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.6)' }}
        >
          0
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm font-bold text-amber-300 tabular-nums backdrop-blur-sm">
          <svg viewBox="-10 -10 20 20" className="size-4" aria-hidden="true">
            <circle r={8} fill="#facc15" stroke="#a16207" strokeWidth={2} />
          </svg>
          <span ref={muenzenRef}>0</span>
        </span>
      </div>

      {/* Tempoanzeige unten — sie erklärt ohne Worte, warum es schwerer wird.
          Ein Balken statt einer Zahl: Beim Laufen liest niemand. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
          <div
            ref={tempoRef}
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-rose-400"
            style={{ width: '41%' }}
          />
        </div>
      </div>

      {/* Der Steuerungshinweis. Er stand vorher nur als Satz unter dem
          Spielfeld — und ausgerechnet dort blendet ihn die Regel für kurze
          Bildschirme aus. Jetzt liegt er im Bild und verschwindet mit der
          ersten Geste. */}
      {zeigeHinweis && !laedt && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 grid place-items-center">
          <div className="rounded-2xl bg-black/55 px-5 py-4 text-center backdrop-blur-sm">
            <p className="text-base font-black text-white">So geht's</p>
            <ul className="mt-2 space-y-1 text-sm text-white/90">
              <li>
                <span aria-hidden="true">👆</span> Tippen — springen
              </li>
              <li>
                <span aria-hidden="true">↔</span> Wischen — Spur wechseln
              </li>
              <li>
                <span aria-hidden="true">↓</span> Runterwischen — rutschen
              </li>
            </ul>
            <p className="mt-2 text-xs text-white/60">(Pfeiltasten gehen auch)</p>
          </div>
        </div>
      )}
    </div>
  );
}
