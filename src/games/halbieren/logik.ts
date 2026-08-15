import { saatAus } from '../../core/rng';
import { formErzeugen, genauigkeit, punkteFuerSchnitt, schneiden } from './geometrie';
import type { Form, Punkt } from './geometrie';

/**
 * Even Cut — der Rundenablauf.
 *
 * Ein Level ist eine Runde aus mehreren Formen. Wie beim Quiz gilt: gleiche
 * Levelnummer, gleiche Formen — auf jedem Gerät. Damit lässt sich später
 * ein Duell darauf aufsetzen, ohne hier irgendetwas zu ändern.
 *
 * Die eigentliche Rechenarbeit steht in `geometrie.ts`; diese Datei sagt nur,
 * welche Form wann drankommt und wie die Punkte zusammenkommen.
 */

/** So viele Formen gehören zu einer Runde. */
export const FORMEN_PRO_LEVEL = 5;

/** Volle Punktzahl je Form — 100, macht 500 je Runde. */
export const MAX_PRO_FORM = 100;

export type Schnitt = {
  a: Punkt;
  b: Punkt;
  links: readonly Punkt[];
  rechts: readonly Punkt[];
  /** 0 bis 100. */
  genau: number;
  punkte: number;
};

export type Zustand = {
  level: number;
  /** Welche Form der Runde gerade dran ist, 0-basiert. */
  index: number;
  form: Form;
  /** Erst nach dem Schnitt gesetzt; bis dahin darf man ziehen. */
  schnitt: Schnitt | null;
  punkte: number;
  vorbei: boolean;
};

function formFuer(level: number, index: number): Form {
  return formErzeugen(saatAus('halbieren', level, index), level);
}

export function neuesLevel(level: number): Zustand {
  return {
    level,
    index: 0,
    form: formFuer(level, 0),
    schnitt: null,
    punkte: 0,
    vorbei: false,
  };
}

/**
 * Führt den Schnitt aus.
 *
 * Ein zweiter Schnitt an derselben Form wird stillschweigend verworfen —
 * beim Wischen kommt auf einem Handy gern ein zweites `pointerup` an, und
 * ohne diese Sperre zählte der Nachzügler als neuer Versuch.
 */
export function schneidenAn(z: Zustand, a: Punkt, b: Punkt): Zustand {
  if (z.schnitt || z.vorbei) return z;

  // Zu kurzer Wisch: Das ist ein Antippen, keine Schnittgerade. Ohne diese
  // Prüfung stünden a und b praktisch aufeinander und die „Gerade" wäre
  // gar keine.
  if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return z;

  const { links, rechts } = schneiden(z.form, a, b);
  const genau = genauigkeit(links, rechts);
  const punkte = punkteFuerSchnitt(genau);

  return {
    ...z,
    schnitt: { a, b, links, rechts, genau, punkte },
    punkte: z.punkte + punkte,
  };
}

/** Weiter zur nächsten Form — oder Runde vorbei. */
export function naechsteForm(z: Zustand): Zustand {
  if (!z.schnitt) return z;
  const index = z.index + 1;
  if (index >= FORMEN_PRO_LEVEL) return { ...z, vorbei: true };
  return { ...z, index, form: formFuer(z.level, index), schnitt: null };
}

/** Wie gut war das? Für die kurze Rückmeldung nach jedem Schnitt. */
export function bewertung(genau: number): string {
  if (genau >= 99.5) return 'Perfekt!';
  if (genau >= 97) return 'Fast perfekt';
  if (genau >= 92) return 'Gut';
  if (genau >= 80) return 'Geht so';
  if (genau > 0) return 'Daneben';
  return 'Vorbeigeschnitten';
}
