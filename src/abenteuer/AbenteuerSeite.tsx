import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../core/sfx';
import type { Einstellungen } from '../core/types';
import {
  KEINE_EINGABE,
  eingesammelt,
  naechsterNpc,
  spielerAmStart,
  takt,
  type Eingabe,
  type Spieler,
} from './logik';
import { WOHNVIERTEL, hindernisse } from './welt';
import type { Szene } from './szene';

/**
 * Florianville — der spielbare Teil.
 *
 * ## Was hier steht und was nicht
 *
 * Diese Datei kennt **keine** Spielregeln und **kein** three.js. Sie hält
 * die Schleife am Laufen, sammelt Eingaben ein und schreibt die Anzeige.
 * Gerechnet wird in `logik.ts` (geprüft, ohne Browser), gezeichnet in
 * `szene.ts` (nachgeladen).
 *
 * ## Warum der Zustand in einer Ref liegt
 *
 * Sechzig Bilder je Sekunde als `setState` hieße sechzigmal je Sekunde den
 * ganzen Baum durchrechnen, während three.js daneben zeichnet — genau der
 * Fehler, der Dash City anfangs unrund gemacht hat. Der Spielerzustand
 * liegt deshalb in einer Ref, und die Anzeige (Sterne, Hinweis) wird direkt
 * ins DOM geschrieben. React rendert während des Laufens gar nicht.
 */

/** Ab dieser Auslenkung gilt der Stick als bewegt. */
const STICK_TOT = 0.16;
/** Radius des Stick-Feldes in Pixeln. */
const STICK_RADIUS = 58;

export function AbenteuerSeite({
  einstellungen,
  onZurueck,
}: {
  einstellungen: Einstellungen;
  onZurueck: () => void;
}) {
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const sternRef = useRef<HTMLSpanElement>(null);
  const hinweisRef = useRef<HTMLDivElement>(null);

  const spielerRef = useRef<Spieler>(spielerAmStart(WOHNVIERTEL));
  const eingabeRef = useRef<Eingabe>({ ...KEINE_EINGABE });
  const gesammeltRef = useRef<Set<string>>(new Set());
  const kaestenRef = useRef(hindernisse(WOHNVIERTEL));

  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);

  // ------------------------------------------------------------------
  // Tastatur
  // ------------------------------------------------------------------
  useEffect(() => {
    const gedrueckt = new Set<string>();

    const auswerten = () => {
      const e = eingabeRef.current;
      e.x = (gedrueckt.has('rechts') ? 1 : 0) - (gedrueckt.has('links') ? 1 : 0);
      // Bildschirm-„oben" ist in der Welt −z: Die Kamera steht im Süden und
      // blickt nach Norden.
      e.z = (gedrueckt.has('runter') ? 1 : 0) - (gedrueckt.has('hoch') ? 1 : 0);
      e.rennen = gedrueckt.has('rennen');
    };

    const taste = (ev: KeyboardEvent, runter: boolean) => {
      const k = ev.key.toLowerCase();
      const name =
        k === 'arrowleft' || k === 'a' ? 'links'
        : k === 'arrowright' || k === 'd' ? 'rechts'
        : k === 'arrowup' || k === 'w' ? 'hoch'
        : k === 'arrowdown' || k === 's' ? 'runter'
        : k === 'shift' ? 'rennen'
        : null;

      if (name) {
        ev.preventDefault();
        if (runter) gedrueckt.add(name);
        else gedrueckt.delete(name);
        auswerten();
        return;
      }
      // Springen ist ein Impuls, kein Zustand: Der Takt setzt ihn selbst
      // zurück. Sonst springt die Figur, solange die Taste liegt.
      if (runter && (k === ' ' || k === 'spacebar')) {
        ev.preventDefault();
        eingabeRef.current.springen = true;
      }
    };

    const runter = (ev: KeyboardEvent) => taste(ev, true);
    const hoch = (ev: KeyboardEvent) => taste(ev, false);
    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
    };
  }, []);

  // ------------------------------------------------------------------
  // Die Schleife
  // ------------------------------------------------------------------
  useEffect(() => {
    let abgebrochen = false;
    let bild = 0;
    let szene: Szene | null = null;
    let letzte = performance.now();

    const start = async () => {
      try {
        const { szeneBauen } = await import('./szene');
        if (abgebrochen || !leinwandRef.current) return;
        szene = szeneBauen(leinwandRef.current, WOHNVIERTEL);
        setLaedt(false);
      } catch {
        // Kein technischer Fehlertext für ein Kind — nur ein Satz und ein Knopf.
        if (!abgebrochen) setFehler(true);
        return;
      }

      const messen = () => {
        const kasten = buehneRef.current?.getBoundingClientRect();
        if (kasten && kasten.width > 0) szene?.groesseAendern(kasten.width, kasten.height);
      };
      messen();
      window.addEventListener('resize', messen);

      const schritt = (jetzt: number) => {
        if (abgebrochen) return;
        // Gedeckelt: Nach einem App-Wechsel wäre der Schritt sonst mehrere
        // Sekunden groß. `takt` deckelt zwar selbst, aber dann liefe die
        // Zeit im Spiel sichtbar nach.
        const dt = Math.min(0.05, (jetzt - letzte) / 1000);
        letzte = jetzt;

        const eingabe = eingabeRef.current;
        spielerRef.current = takt(
          spielerRef.current,
          eingabe,
          WOHNVIERTEL,
          dt,
          kaestenRef.current,
        );
        eingabe.springen = false;

        // Aufsammeln
        const neu = eingesammelt(
          spielerRef.current,
          WOHNVIERTEL.sammelstuecke,
          gesammeltRef.current,
        );
        if (neu.length > 0) {
          for (const id of neu) gesammeltRef.current.add(id);
          // Die Tonhöhe steigt mit jedem Stern — dieselbe Machart wie bei
          // den Serien in Block Burst und Pair Up.
          if (einstellungen.sound) sfx('gut', Math.min(12, gesammeltRef.current.size));
          if (sternRef.current) {
            sternRef.current.textContent = String(gesammeltRef.current.size);
          }
        }

        // Hinweis, wenn jemand in Reichweite steht
        const npc = naechsterNpc(spielerRef.current, WOHNVIERTEL.npcs);
        if (hinweisRef.current) {
          hinweisRef.current.style.opacity = npc ? '1' : '0';
        }

        szene?.zeichnen(spielerRef.current, dt, gesammeltRef.current);
        bild = requestAnimationFrame(schritt);
      };
      bild = requestAnimationFrame(schritt);

      return () => window.removeEventListener('resize', messen);
    };

    void start();

    return () => {
      abgebrochen = true;
      cancelAnimationFrame(bild);
      szene?.aufraeumen();
    };
  }, [einstellungen.sound]);

  // ------------------------------------------------------------------
  // Stick
  // ------------------------------------------------------------------
  const stickRef = useRef<HTMLDivElement>(null);
  const knopfRef = useRef<HTMLDivElement>(null);
  const zeigerRef = useRef<number | null>(null);

  const stickSetzen = useCallback((dx: number, dy: number) => {
    const laenge = Math.hypot(dx, dy);
    const begrenzt = laenge > STICK_RADIUS ? STICK_RADIUS / laenge : 1;
    const kx = dx * begrenzt;
    const ky = dy * begrenzt;
    if (knopfRef.current) {
      knopfRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
    }
    const anteil = Math.min(1, laenge / STICK_RADIUS);
    const e = eingabeRef.current;
    if (anteil < STICK_TOT) {
      e.x = 0;
      e.z = 0;
      e.rennen = false;
      return;
    }
    e.x = (kx / STICK_RADIUS) * 1.2;
    e.z = (ky / STICK_RADIUS) * 1.2;
    // Weit ausgelenkt heißt rennen — kein zweiter Knopf dafür. Auf einem
    // Handy ist jeder zusätzliche Knopf ein Finger weniger für alles andere.
    e.rennen = anteil > 0.82;
  }, []);

  const stickAus = useCallback(() => {
    zeigerRef.current = null;
    if (knopfRef.current) knopfRef.current.style.transform = 'translate(0px, 0px)';
    const e = eingabeRef.current;
    e.x = 0;
    e.z = 0;
    e.rennen = false;
  }, []);

  return (
    <div className="spielseite flex flex-1 flex-col">
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-2"
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
          background: 'linear-gradient(180deg, rgb(10 14 30 / 0.85), transparent)',
        }}
      >
        <button type="button" onClick={onZurueck} className="spielknopf text-sm font-medium">
          <span aria-hidden="true">←</span> Zurück
        </button>
        <span className="flex-1 truncate text-base font-black text-white drop-shadow">
          Ahornweg
        </span>
        <span
          className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-black text-white backdrop-blur"
          aria-live="polite"
        >
          <span aria-hidden="true">⭐</span>
          <span ref={sternRef} className="tabular-nums">
            0
          </span>
          <span className="text-white/55">/ {WOHNVIERTEL.sammelstuecke.length}</span>
        </span>
      </header>

      <div ref={buehneRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={leinwandRef} className="absolute inset-0 size-full touch-none" />

        {laedt && !fehler && (
          <div className="absolute inset-0 grid place-items-center bg-grund">
            <p className="text-sm font-bold text-gedaempft">Florianville wird geladen …</p>
          </div>
        )}

        {fehler && (
          <div className="absolute inset-0 grid place-items-center gap-3 bg-grund p-6 text-center">
            <p className="text-4xl" aria-hidden="true">
              🎮
            </p>
            <p className="text-sm font-bold">Da ist etwas schiefgelaufen.</p>
            <button type="button" onClick={() => window.location.reload()} className="spielknopf">
              Nochmal versuchen
            </button>
          </div>
        )}

        {/* Hinweis, wenn jemand in Ansprech-Reichweite steht. Wird direkt
            ins DOM geschrieben, nicht über React — siehe oben. */}
        <div
          ref={hinweisRef}
          className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center opacity-0"
          style={{ transition: 'opacity var(--zeit-kurz) var(--kurve)' }}
        >
          <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-bold text-white backdrop-blur">
            💬 Jemand möchte reden
          </span>
        </div>

        {/* --- Touch-Steuerung --- */}
        <div
          ref={stickRef}
          className="absolute bottom-6 left-6 touch-none select-none"
          style={{ width: STICK_RADIUS * 2, height: STICK_RADIUS * 2 }}
          onPointerDown={(ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            zeigerRef.current = ev.pointerId;
            const k = ev.currentTarget.getBoundingClientRect();
            stickSetzen(
              ev.clientX - (k.left + k.width / 2),
              ev.clientY - (k.top + k.height / 2),
            );
          }}
          onPointerMove={(ev) => {
            if (zeigerRef.current !== ev.pointerId) return;
            const k = ev.currentTarget.getBoundingClientRect();
            stickSetzen(
              ev.clientX - (k.left + k.width / 2),
              ev.clientY - (k.top + k.height / 2),
            );
          }}
          onPointerUp={stickAus}
          onPointerCancel={stickAus}
        >
          <div className="absolute inset-0 rounded-full border-2 border-white/25 bg-black/25 backdrop-blur-sm" />
          <div
            ref={knopfRef}
            className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 bg-white/35"
            style={{ marginLeft: -28, marginTop: -28, transition: 'none' }}
          />
        </div>

        <button
          type="button"
          aria-label="Springen"
          className="druckbar absolute right-6 bottom-8 grid size-20 touch-none place-items-center rounded-full border-2 border-white/45 bg-white/25 text-3xl backdrop-blur-sm"
          onPointerDown={(ev) => {
            ev.preventDefault();
            eingabeRef.current.springen = true;
          }}
        >
          <span aria-hidden="true">⬆</span>
        </button>
      </div>
    </div>
  );
}
