import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../core/sfx';
import type { Einstellungen } from '../core/types';
import { abenteuerLesen, abenteuerSchreiben, fortschrittLesen, fortschrittSchreiben } from '../shell/speicher';
import {
  KEINE_EINGABE,
  eingesammelt,
  naechsterNpc,
  spielerAmStart,
  takt,
  type Eingabe,
  type Spieler,
} from './logik';
import {
  LEERE_MISSION,
  NAMEN,
  WERKZEUGE,
  ansprechen,
  marker,
  missionBereinigen,
  teilGefunden,
  teilSichtbar,
  zielText,
  type Dialog,
  type Missionsstand,
} from './mission';
import { WOHNVIERTEL, hindernisse } from './welt';
import type { Szene } from './szene';

/**
 * Florianville — der spielbare Teil.
 *
 * Diese Datei kennt **keine** Spielregeln und **kein** three.js. Sie hält
 * die Schleife am Laufen, sammelt Eingaben ein und zeigt an. Gerechnet wird
 * in `logik.ts` und `mission.ts` (beide geprüft, ohne Browser), gezeichnet
 * in `szene.ts` (nachgeladen).
 *
 * **Der Spielzustand liegt in Refs, nicht im React-Zustand.** Sechzig Bilder
 * je Sekunde als `setState` hieße sechzigmal je Sekunde den Baum
 * durchrechnen, während three.js daneben zeichnet. React rendert hier nur,
 * wenn sich wirklich etwas an der Oberfläche ändert: Missionsphase, offener
 * Dialog, Ladezustand.
 */

const STICK_TOT = 0.16;
const STICK_RADIUS = 58;

/** Was gespeichert wird. */
type Weltstand = { sterne: string[]; mission: Missionsstand };

function weltstandLesen(): Weltstand {
  const roh = (abenteuerLesen() ?? {}) as Partial<Weltstand>;
  const bekannt = new Set(WOHNVIERTEL.sammelstuecke.map((s) => s.id));
  return {
    sterne: Array.isArray(roh.sterne)
      ? [...new Set(roh.sterne.filter((s) => typeof s === 'string' && bekannt.has(s)))]
      : [],
    mission: missionBereinigen(roh.mission),
  };
}

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
  const nahRef = useRef<HTMLDivElement>(null);

  const gespeichert = useRef(weltstandLesen()).current;

  const spielerRef = useRef<Spieler>(spielerAmStart(WOHNVIERTEL));
  const eingabeRef = useRef<Eingabe>({ ...KEINE_EINGABE });
  const gesammeltRef = useRef<Set<string>>(new Set(gespeichert.sterne));
  const kaestenRef = useRef(hindernisse(WOHNVIERTEL));
  /** Wer gerade in Reichweite steht — für den Reden-Knopf. */
  const nahesterRef = useRef<string | null>(null);

  const [mission, setMission] = useState<Missionsstand>(gespeichert.mission);
  const missionRef = useRef(mission);
  missionRef.current = mission;

  const [dialog, setDialog] = useState<{ dialog: Dialog; zeile: number } | null>(null);
  const dialogOffenRef = useRef(false);
  dialogOffenRef.current = dialog !== null;

  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);

  /** Speichert Sterne und Mission. */
  const sichern = useCallback((m: Missionsstand) => {
    abenteuerSchreiben({ sterne: [...gesammeltRef.current], mission: m });
  }, []);

  /** Schreibt Erfahrung in denselben Fortschritt wie der Rest von Flow Games. */
  const xpGeben = useCallback((xp: number) => {
    if (xp <= 0) return;
    const f = fortschrittLesen();
    fortschrittSchreiben({ ...f, xp: f.xp + xp });
  }, []);

  // ------------------------------------------------------------------
  // Tastatur
  // ------------------------------------------------------------------
  useEffect(() => {
    const gedrueckt = new Set<string>();

    const auswerten = () => {
      const e = eingabeRef.current;
      e.x = (gedrueckt.has('rechts') ? 1 : 0) - (gedrueckt.has('links') ? 1 : 0);
      // Bildschirm-„oben" ist in der Welt −z: Die Kamera steht im Süden.
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
      if (!runter) return;
      if (k === ' ' || k === 'spacebar') {
        ev.preventDefault();
        // Im Gespräch blättert die Leertaste weiter, statt zu springen.
        if (dialogOffenRef.current) weiterRef.current?.();
        else eingabeRef.current.springen = true;
      }
      if (k === 'e' || k === 'enter') {
        ev.preventDefault();
        if (dialogOffenRef.current) weiterRef.current?.();
        else redenRef.current?.();
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
  // Reden
  // ------------------------------------------------------------------
  const redenRef = useRef<(() => void) | null>(null);
  const weiterRef = useRef<(() => void) | null>(null);

  const reden = useCallback(() => {
    const id = nahesterRef.current;
    if (!id || dialogOffenRef.current) return;
    const g = ansprechen(missionRef.current, id);
    // Beim Reden steht die Figur still — sonst läuft sie mit offenem
    // Dialogfenster weiter, weil der Stick noch ausgelenkt liegt.
    const e = eingabeRef.current;
    e.x = 0;
    e.z = 0;
    e.rennen = false;

    if (g.nachher !== missionRef.current) {
      setMission(g.nachher);
      sichern(g.nachher);
    }
    xpGeben(g.xp);
    if (einstellungen.sound) sfx(g.abgeschlossen ? 'stufe' : 'klick');
    setDialog({ dialog: g.dialog, zeile: 0 });
  }, [einstellungen.sound, sichern, xpGeben]);
  redenRef.current = reden;

  const weiter = useCallback(() => {
    setDialog((alt) => {
      if (!alt) return null;
      const naechste = alt.zeile + 1;
      // Am Ende der Zeilen: Gibt es Antworten, bleibt das Fenster offen und
      // zeigt sie; sonst ist das Gespräch vorbei.
      if (naechste < alt.dialog.zeilen.length) return { ...alt, zeile: naechste };
      if (alt.dialog.antworten && alt.zeile < alt.dialog.zeilen.length) {
        return { ...alt, zeile: alt.dialog.zeilen.length };
      }
      return null;
    });
  }, []);
  weiterRef.current = weiter;

  const antworten = useCallback((index: number) => {
    setDialog((alt) => {
      if (!alt?.dialog.antworten) return null;
      const a = alt.dialog.antworten[index];
      if (!a) return null;
      // Die Erwiderung wird als letzte Zeile angehängt — danach ist Schluss.
      return {
        dialog: { zeilen: [...alt.dialog.zeilen, a.erwiderung] },
        zeile: alt.dialog.zeilen.length,
      };
    });
  }, []);

  // ------------------------------------------------------------------
  // Die Schleife
  // ------------------------------------------------------------------
  useEffect(() => {
    let abgebrochen = false;
    let bild = 0;
    let szene: Szene | null = null;
    let letzte = performance.now();
    let messenAb: (() => void) | null = null;

    const start = async () => {
      try {
        const { szeneBauen } = await import('./szene');
        if (abgebrochen || !leinwandRef.current) return;
        szene = szeneBauen(leinwandRef.current, WOHNVIERTEL);
        setLaedt(false);
      } catch {
        // Kein technischer Fehlertext für ein Kind — ein Satz und ein Knopf.
        if (!abgebrochen) setFehler(true);
        return;
      }

      const messen = () => {
        const kasten = buehneRef.current?.getBoundingClientRect();
        if (kasten && kasten.width > 0) szene?.groesseAendern(kasten.width, kasten.height);
      };
      messen();
      window.addEventListener('resize', messen);
      messenAb = () => window.removeEventListener('resize', messen);

      const schritt = (jetzt: number) => {
        if (abgebrochen) return;
        const dt = Math.min(0.05, (jetzt - letzte) / 1000);
        letzte = jetzt;

        const imGespraech = dialogOffenRef.current;
        const eingabe = imGespraech ? KEINE_EINGABE : eingabeRef.current;
        spielerRef.current = takt(
          spielerRef.current,
          eingabe,
          WOHNVIERTEL,
          dt,
          kaestenRef.current,
        );
        if (!imGespraech) eingabeRef.current.springen = false;

        const m = missionRef.current;

        // --- Sterne ---
        const neueSterne = eingesammelt(
          spielerRef.current,
          WOHNVIERTEL.sammelstuecke,
          gesammeltRef.current,
        );
        if (neueSterne.length > 0) {
          for (const id of neueSterne) gesammeltRef.current.add(id);
          if (einstellungen.sound) sfx('gut', Math.min(12, gesammeltRef.current.size));
          if (sternRef.current) sternRef.current.textContent = String(gesammeltRef.current.size);
          sichern(m);
        }

        // --- Werkzeug ---
        const offeneWerkzeuge = WOHNVIERTEL.werkzeuge.filter((w) => teilSichtbar(m, w.id));
        const aufgehoben = eingesammelt(spielerRef.current, offeneWerkzeuge, new Set());
        if (aufgehoben.length > 0) {
          let neu = m;
          for (const id of aufgehoben) neu = teilGefunden(neu, id);
          if (neu !== m) {
            if (einstellungen.sound) sfx('stufe');
            setMission(neu);
            sichern(neu);
          }
        }

        // --- Wer ist in Reichweite? ---
        const npc = naechsterNpc(spielerRef.current, WOHNVIERTEL.npcs);
        nahesterRef.current = npc?.id ?? null;
        if (nahRef.current) {
          nahRef.current.style.opacity = npc && !imGespraech ? '1' : '0';
          nahRef.current.style.pointerEvents = npc && !imGespraech ? 'auto' : 'none';
          if (npc) {
            const beschriftung = nahRef.current.querySelector('[data-name]');
            if (beschriftung) beschriftung.textContent = NAMEN[npc.id] ?? 'Reden';
          }
        }

        const zeichen: Record<string, string | null> = {};
        for (const n of WOHNVIERTEL.npcs) zeichen[n.id] = marker(m, n.id);

        szene?.zeichnen(
          spielerRef.current,
          dt,
          gesammeltRef.current,
          new Set(offeneWerkzeuge.map((w) => w.id)),
          zeichen,
        );
        bild = requestAnimationFrame(schritt);
      };
      bild = requestAnimationFrame(schritt);
    };

    void start();

    return () => {
      abgebrochen = true;
      cancelAnimationFrame(bild);
      messenAb?.();
      szene?.aufraeumen();
    };
  }, [einstellungen.sound, sichern]);

  // ------------------------------------------------------------------
  // Stick
  // ------------------------------------------------------------------
  const knopfRef = useRef<HTMLDivElement>(null);
  const zeigerRef = useRef<number | null>(null);

  const stickSetzen = useCallback((dx: number, dy: number) => {
    const laenge = Math.hypot(dx, dy);
    const begrenzt = laenge > STICK_RADIUS ? STICK_RADIUS / laenge : 1;
    const kx = dx * begrenzt;
    const ky = dy * begrenzt;
    if (knopfRef.current) knopfRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
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
    // Weit ausgelenkt heißt rennen — kein zweiter Knopf. Auf einem Handy ist
    // jeder zusätzliche Knopf ein Finger weniger für alles andere.
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

  const ziel = zielText(mission);
  const gezeigt = dialog
    ? dialog.dialog.zeilen[Math.min(dialog.zeile, dialog.dialog.zeilen.length - 1)]!
    : null;
  const amEnde = dialog !== null && dialog.zeile >= dialog.dialog.zeilen.length;
  const zeigeAntworten = amEnde && !!dialog?.dialog.antworten;

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
            {gesammeltRef.current.size}
          </span>
          <span className="text-white/55">/ {WOHNVIERTEL.sammelstuecke.length}</span>
        </span>
      </header>

      {/* Das aktuelle Ziel. Steht dicht unter der Kopfzeile und ist die
          einzige dauerhafte Textzeile im Bild — mehr würde vom Spiel
          ablenken, weniger ließe einen ratlos herumlaufen. */}
      {ziel && (
        <div className="pointer-events-none z-10 -mt-1 shrink-0 px-3 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            <span aria-hidden="true">🎯</span> {ziel}
          </span>
        </div>
      )}

      <div ref={buehneRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={leinwandRef} className="absolute inset-0 size-full touch-none" />

        {laedt && !fehler && (
          <div className="absolute inset-0 grid place-items-center bg-grund">
            <p className="text-sm font-bold text-gedaempft">Florianville wird geladen …</p>
          </div>
        )}

        {fehler && (
          <div className="absolute inset-0 grid place-items-center gap-3 bg-grund p-6 text-center">
            <p className="text-4xl" aria-hidden="true">🎮</p>
            <p className="text-sm font-bold">Da ist etwas schiefgelaufen.</p>
            <button type="button" onClick={() => window.location.reload()} className="spielknopf">
              Nochmal versuchen
            </button>
          </div>
        )}

        {/* --- Reden-Knopf --- */}
        <div
          ref={nahRef}
          className="absolute inset-x-0 bottom-32 flex justify-center opacity-0"
          style={{ transition: 'opacity var(--zeit-kurz) var(--kurve)', pointerEvents: 'none' }}
        >
          <button
            type="button"
            onClick={reden}
            className="druckbar flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-black text-indigo-900"
          >
            <span aria-hidden="true">💬</span>
            <span data-name>Reden</span>
          </button>
        </div>

        {/* --- Dialog --- */}
        {dialog && gezeigt && (
          <div
            className="absolute inset-0 z-20 flex flex-col justify-end p-3"
            style={{ background: 'linear-gradient(0deg, rgb(8 10 24 / 0.7), transparent 55%)' }}
            onClick={() => {
              if (!zeigeAntworten) weiter();
            }}
          >
            <div
              className="dialog-auf rounded-2xl border-2 border-white/25 p-4"
              style={{
                background: 'linear-gradient(160deg, #2b2352, #171436)',
                boxShadow: 'var(--schatten-4)',
              }}
            >
              <p className="text-[11px] font-black tracking-[0.18em] text-amber-300 uppercase">
                {gezeigt.wer}
              </p>
              <p className="mt-1.5 text-base leading-snug font-bold text-white">{gezeigt.text}</p>

              {zeigeAntworten ? (
                <div className="mt-3 flex flex-col gap-2">
                  {dialog.dialog.antworten!.map((a, i) => (
                    <button
                      key={a.text}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        antworten(i);
                      }}
                      className="druckbar rounded-xl border border-white/25 bg-white/12 px-3.5 py-2.5 text-left text-sm font-bold text-white"
                    >
                      {a.text}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-right text-xs font-bold text-white/50">
                  Tippen für weiter ▸
                </p>
              )}
            </div>
          </div>
        )}

        {/* --- Touch-Steuerung --- */}
        <div
          className="absolute bottom-6 left-6 touch-none select-none"
          style={{ width: STICK_RADIUS * 2, height: STICK_RADIUS * 2 }}
          onPointerDown={(ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            zeigerRef.current = ev.pointerId;
            const k = ev.currentTarget.getBoundingClientRect();
            stickSetzen(ev.clientX - (k.left + k.width / 2), ev.clientY - (k.top + k.height / 2));
          }}
          onPointerMove={(ev) => {
            if (zeigerRef.current !== ev.pointerId) return;
            const k = ev.currentTarget.getBoundingClientRect();
            stickSetzen(ev.clientX - (k.left + k.width / 2), ev.clientY - (k.top + k.height / 2));
          }}
          onPointerUp={stickAus}
          onPointerCancel={stickAus}
        >
          <div className="absolute inset-0 rounded-full border-2 border-white/25 bg-black/25 backdrop-blur-sm" />
          <div
            ref={knopfRef}
            className="absolute top-1/2 left-1/2 size-14 rounded-full border-2 border-white/50 bg-white/35"
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

/** Für die Anzeige der gefundenen Teile im Ziel — hier nur re-exportiert. */
export { WERKZEUGE, LEERE_MISSION };
