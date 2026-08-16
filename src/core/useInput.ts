import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Eingaben vereinheitlichen: Tastatur, Wischen und Antippen ergeben dieselben
 * sieben Aktionen. Ein Spiel muss nie wissen, ob gerade ein Finger oder eine
 * Taste im Spiel war.
 *
 * Tastenwiederholung machen wir selbst (Verzögerung, dann schnelle Folge) —
 * die des Betriebssystems ist zu langsam und je nach Rechner anders
 * eingestellt.
 */

export type Aktion = 'up' | 'down' | 'left' | 'right' | 'rotate' | 'drop' | 'select';

/** Taste (layoutunabhängig über event.code) → Aktion. */
const tasten: Record<string, Aktion> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyX: 'rotate',
  Space: 'drop',
  Enter: 'select',
};

type Optionen = {
  /** Element für Wischgesten. Ohne Angabe gilt das ganze Fenster.
   *  `Element` statt `HTMLElement`, weil Snake Rush sein Brett als SVG
   *  zeichnet — gebraucht wird hier ohnehin nur addEventListener. */
  bereich?: RefObject<Element | null>;
  /** Aktionen, die bei gehaltener Taste wiederholt werden. */
  wiederholen?: Aktion[];
  /** Wartezeit bis zur ersten Wiederholung, in Millisekunden. */
  verzoegerung?: number;
  /** Abstand der weiteren Wiederholungen, in Millisekunden. */
  takt?: number;
  /** Welche Aktion ein kurzes Antippen auslöst. */
  tippen?: Aktion;
  /**
   * Welche Aktion ein **weiter oder schneller Wisch nach unten** auslöst.
   * Standard `drop`.
   *
   * Gegenstück zu `tippen`: Nicht jedes Spiel kennt ein „fallen lassen".
   * Box Push und Merge Up haben vier gleichwertige Richtungen und deuteten
   * `drop` deshalb selbst als `down` um — und erbten damit stillschweigend
   * die **Leertaste**, die oben ebenfalls auf `drop` liegt. In Box Push
   * kostet jeder Zug Punkte, ein versehentlicher Druck also vier. Wer hier
   * `wurf: 'down'` setzt, bekommt die Geste und nicht die Taste.
   */
  wurf?: Aktion;
  /** Auf false setzen, wenn Eingaben gerade nichts bewirken sollen. */
  aktiv?: boolean;
};

const WISCH_SCHWELLE = 24; // Pixel, ab denen es ein Wischen ist
/** Kurz und schnell zählt auch als Wischen, obwohl die Strecke nicht reicht —
 *  auf einem kleinen Feld ist genau das die häufigste Geste. */
const SCHNIPSER_ZEIT = 90; // Millisekunden
/** Millisekunden, bis zu denen es ein Tippen ist. Großzügig: In Line Fall
 *  ist Tippen das Drehen, und ein Kind lässt den Finger gern etwas länger
 *  liegen. Bei 350 ms fiel das stillschweigend durch. */
const TIPP_ZEIT = 700;
const WURF_STRECKE = 90; // langes Wischen nach unten = 'drop'

export function useInput(beiAktion: (aktion: Aktion) => void, optionen: Optionen = {}): void {
  const {
    bereich,
    wiederholen = ['left', 'right', 'down'],
    verzoegerung = 170,
    takt = 45,
    tippen = 'select',
    wurf = 'drop',
    aktiv = true,
  } = optionen;

  const aktionRef = useRef(beiAktion);
  aktionRef.current = beiAktion;

  const optionenRef = useRef({ wiederholen, verzoegerung, takt, tippen, wurf });
  optionenRef.current = { wiederholen, verzoegerung, takt, tippen, wurf };

  useEffect(() => {
    if (!aktiv) return;

    const laufende = new Map<string, { start: number; folge: number }>();

    const alleStoppen = () => {
      for (const uhren of laufende.values()) {
        clearTimeout(uhren.start);
        clearInterval(uhren.folge);
      }
      laufende.clear();
    };

    const schreibfeld = (ziel: EventTarget | null) =>
      ziel instanceof Element &&
      ziel.closest('input, textarea, select, [contenteditable="true"]') !== null;

    const knopf = (ziel: EventTarget | null) =>
      ziel instanceof Element && ziel.closest('button, a[href]') !== null;

    const beiTaste = (e: KeyboardEvent) => {
      const aktion = tasten[e.code];
      if (!aktion || e.metaKey || e.ctrlKey || e.altKey) return;
      if (schreibfeld(e.target)) return;
      // Enter und Leertaste gehören einem fokussierten Knopf, nicht dem Spiel.
      if (knopf(e.target) && (aktion === 'select' || aktion === 'drop')) return;

      e.preventDefault();
      if (e.repeat || laufende.has(e.code)) return; // wir wiederholen selbst

      aktionRef.current(aktion);

      const { wiederholen: liste, verzoegerung: warten, takt: abstand } = optionenRef.current;
      if (!liste.includes(aktion)) return;

      const start = window.setTimeout(() => {
        const folge = window.setInterval(() => aktionRef.current(aktion), abstand);
        laufende.set(e.code, { start: 0, folge });
      }, warten);
      laufende.set(e.code, { start, folge: 0 });
    };

    const beiTasteLos = (e: KeyboardEvent) => {
      const uhren = laufende.get(e.code);
      if (!uhren) return;
      clearTimeout(uhren.start);
      clearInterval(uhren.folge);
      laufende.delete(e.code);
    };

    window.addEventListener('keydown', beiTaste, { passive: false });
    window.addEventListener('keyup', beiTasteLos);
    window.addEventListener('blur', alleStoppen);
    document.addEventListener('visibilitychange', alleStoppen);

    // --- Finger ---
    const flaeche: EventTarget = bereich?.current ?? window;
    /** `ausgeloest` sperrt den Zeiger, nachdem die Geste erkannt wurde. */
    let zeiger: { id: number; x: number; y: number; zeit: number; ausgeloest: boolean } | null = null;

    const beiZeigerAb = (e: Event) => {
      const p = e as PointerEvent;
      if (p.pointerType === 'mouse') return; // Maus steuert über Tasten und Knöpfe
      if (schreibfeld(p.target) || knopf(p.target)) return;
      zeiger = { id: p.pointerId, x: p.clientX, y: p.clientY, zeit: p.timeStamp, ausgeloest: false };
    };

    /** Die Geste aus Strecke und Dauer in eine Aktion übersetzen. */
    const gesteAuswerten = (dx: number, dy: number, dauer: number) => {
      if (Math.abs(dx) > Math.abs(dy)) {
        aktionRef.current(dx > 0 ? 'right' : 'left');
      } else if (dy < 0) {
        aktionRef.current('up');
      } else {
        // Weit und schnell nach unten heißt "fallen lassen", kurz heißt "ein Feld".
        const schnell = dy / Math.max(dauer, 1) > 0.9;
        aktionRef.current(dy > WURF_STRECKE || schnell ? optionenRef.current.wurf : 'down');
      }
    };

    const beiZeigerBewegt = (e: Event) => {
      const p = e as PointerEvent;
      if (!zeiger || p.pointerId !== zeiger.id) return;
      // Verhindert, dass die Seite unter dem Finger wegscrollt.
      if (p.cancelable) p.preventDefault();
      if (zeiger.ausgeloest) return;

      const dx = p.clientX - zeiger.x;
      const dy = p.clientY - zeiger.y;
      const dauer = p.timeStamp - zeiger.zeit;

      // **Hier**, nicht erst beim Loslassen. Ein Kind wischt 150 bis 400
      // Millisekunden — vorher passierte genau so lange nichts, und das
      // fühlte sich bei jeder Richtungsänderung träge an.
      //
      // Zwei Wege zur Erkennung: die übliche Strecke, oder ein kurzer,
      // schneller Schnipser. Auf einem kleinen Feld ist der Schnipser die
      // häufigste Geste, und mit reiner Streckenmessung fiel er durch.
      const weit = Math.max(Math.abs(dx), Math.abs(dy));
      const schnipser = weit >= WISCH_SCHWELLE / 2 && dauer > 0 && dauer < SCHNIPSER_ZEIT;
      if (weit < WISCH_SCHWELLE && !schnipser) return;

      // Gesperrt bis zum Loslassen: Ein langer Wisch soll **einen** Zug
      // auslösen, nicht bei jeder weiteren Fingerbewegung noch einen.
      zeiger.ausgeloest = true;
      gesteAuswerten(dx, dy, dauer);
    };

    const beiZeigerAuf = (e: Event) => {
      const p = e as PointerEvent;
      if (!zeiger || p.pointerId !== zeiger.id) return;
      const dx = p.clientX - zeiger.x;
      const dy = p.clientY - zeiger.y;
      const dauer = p.timeStamp - zeiger.zeit;
      const schonAusgeloest = zeiger.ausgeloest;
      zeiger = null;

      // Beim Loslassen bleibt nur noch das Antippen zu behandeln — das
      // Wischen ist oben schon durch.
      if (schonAusgeloest) return;

      const weit = Math.max(Math.abs(dx), Math.abs(dy));
      if (weit < WISCH_SCHWELLE) {
        if (dauer <= TIPP_ZEIT) aktionRef.current(optionenRef.current.tippen);
        return;
      }
      // Fällt hierher nur, wenn zwischen Auflegen und Loslassen kein
      // einziges `pointermove` kam (kommt auf manchen Geräten vor).
      gesteAuswerten(dx, dy, dauer);
    };

    const beiZeigerWeg = () => {
      zeiger = null;
    };

    flaeche.addEventListener('pointerdown', beiZeigerAb, { passive: true });
    flaeche.addEventListener('pointermove', beiZeigerBewegt, { passive: false });
    flaeche.addEventListener('pointerup', beiZeigerAuf, { passive: true });
    flaeche.addEventListener('pointercancel', beiZeigerWeg, { passive: true });

    return () => {
      alleStoppen();
      window.removeEventListener('keydown', beiTaste);
      window.removeEventListener('keyup', beiTasteLos);
      window.removeEventListener('blur', alleStoppen);
      document.removeEventListener('visibilitychange', alleStoppen);
      flaeche.removeEventListener('pointerdown', beiZeigerAb);
      flaeche.removeEventListener('pointermove', beiZeigerBewegt);
      flaeche.removeEventListener('pointerup', beiZeigerAuf);
      flaeche.removeEventListener('pointercancel', beiZeigerWeg);
    };
  }, [aktiv, bereich]);
}
