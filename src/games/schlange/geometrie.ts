/**
 * Snake Rush — Geometrie für die Anzeige.
 *
 * Die Schlange wird nicht mehr Kachel für Kachel gezeichnet, sondern als
 * durchgehender Linienzug. Dafür muss die Anzeige wissen, wo die Kette
 * zusammenhängt und wo sie über den Rand springt — genau das steht hier,
 * als reine Funktionen mit Tests. Der Umschlag am Rand ist die Stelle, an
 * der man sich leicht vertut: Ein Sprung von x = 16 auf x = 0 ist *ein*
 * Schritt, kein Sprung über sechzehn Felder.
 */

import { BREITE, HOEHE } from './logik';
import type { Punkt } from './logik';

/** Mittelpunkt einer Kachel, im Koordinatensystem „eine Einheit = eine Kachel". */
export function kachelMitte(p: Punkt): { x: number; y: number } {
  return { x: p.x + 0.5, y: p.y + 0.5 };
}

/**
 * Schritt von `a` nach `b`. Ein Sprung über den Rand zählt als ein Feld —
 * aus 16 → 0 wird also +1 und nicht −16.
 */
export function versatz(a: Punkt, b: Punkt): { dx: number; dy: number } {
  const kuerzen = (d: number, n: number) => (d > 1 ? d - n : d < -1 ? d + n : d);
  return { dx: kuerzen(b.x - a.x, BREITE), dy: kuerzen(b.y - a.y, HOEHE) };
}

/** Ob zwei Kacheln direkt nebeneinander liegen — ohne Rand-Umschlag. */
export function direktBenachbart(a: Punkt, b: Punkt): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/**
 * Die Gliederkette in zusammenhängende Läufe zerlegen. Ohne das würde ein
 * einziger Linienzug beim Rand-Umschlag quer über das ganze Feld gemalt.
 * Kopf zuerst, wie im Zustand.
 */
export function laeufe(schlange: readonly Punkt[]): Punkt[][] {
  if (schlange.length === 0) return [];
  const teile: Punkt[][] = [[schlange[0]!]];
  for (let i = 1; i < schlange.length; i++) {
    const vorher = schlange[i - 1]!;
    const jetzt = schlange[i]!;
    if (direktBenachbart(vorher, jetzt)) teile[teile.length - 1]!.push(jetzt);
    else teile.push([jetzt]);
  }
  return teile;
}

export type GliedArt = 'kopf' | 'gerade' | 'kurve' | 'schwanz';

/**
 * Was für ein Glied an Position `i` sitzt. Gebraucht wird das nur für die
 * Querringe: Auf Kurven bleiben sie weg, dort lägen sie schief quer zum
 * Körper.
 */
export function gliedArt(schlange: readonly Punkt[], i: number): GliedArt {
  if (i === 0) return 'kopf';
  if (i === schlange.length - 1) return 'schwanz';
  const hin = versatz(schlange[i]!, schlange[i - 1]!);
  const her = versatz(schlange[i + 1]!, schlange[i]!);
  return hin.dx === her.dx && hin.dy === her.dy ? 'gerade' : 'kurve';
}

/**
 * Richtung eines geraden Glieds, für die Ausrichtung des Querrings:
 * `true` = der Körper läuft hier senkrecht, der Ring liegt also waagerecht.
 */
export function laeuftSenkrecht(schlange: readonly Punkt[], i: number): boolean {
  return versatz(schlange[i]!, schlange[i - 1]!).dx === 0;
}

/** Aus einer Punktfolge einen SVG-Pfad durch die Kachelmittelpunkte machen. */
export function pfadDurch(glieder: readonly Punkt[]): string {
  return glieder
    .map((p, i) => {
      const m = kachelMitte(p);
      return `${i === 0 ? 'M' : 'L'}${m.x} ${m.y}`;
    })
    .join(' ');
}
