/**
 * Die Wischerkennung für den Absprung — rein, ohne Browser, damit sie sich
 * prüfen lässt.
 *
 * Rückmeldung zur Version 3: „Vielleicht sollte man einfach nur swipen nach
 * oben, dass er abspringt." Der Pop hing bis dahin am Knopf „Hinten" unten
 * links. Der liegt weit weg von dem, was man gerade ansieht (die Kante in der
 * Bildmitte), und der Daumen muss ihn im Fenster von knapp einer Drittelsekunde
 * treffen. Ein Wisch nach oben irgendwo im Bild ist dafür das natürlichere
 * Zeichen: Das Rad geht hoch, der Finger geht hoch.
 *
 * **Er löst während der Bewegung aus, nicht beim Loslassen** — dieselbe Regel
 * wie beim Wischen in `core/useInput.ts`. Ein Kind wischt 150 bis 400 ms; wer
 * erst beim Abheben des Fingers reagiert, hat die Kante da längst verpasst.
 */

/** Wie weit der Finger nach oben wandern muss (CSS-Pixel). Kleiner als beim Raster-Wischen (24), weil hier jede Verzögerung zählt. */
export const WISCH_SCHWELLE = 18;

/**
 * Wie viel steiler als quer der Wisch sein muss. Ein Daumen, der beim
 * Aufsetzen leicht zur Seite rutscht, soll keinen Absprung auslösen, ein
 * schräger Wisch nach oben-rechts aber schon: 1,1 heißt gut 42 Grad aus der
 * Waagerechten.
 */
export const WISCH_STEILHEIT = 1.1;

/** Ob der Finger seit dem Aufsetzen weit genug und steil genug nach oben gewandert ist. */
export function wischNachOben(startX: number, startY: number, x: number, y: number): boolean {
  // Bildschirm-y wächst nach unten: „oben" ist ein kleineres y.
  const hoch = startY - y;
  const quer = Math.abs(x - startX);
  return hoch >= WISCH_SCHWELLE && hoch >= quer * WISCH_STEILHEIT;
}

/** Ein Finger, der gerade auf der Bühne liegt. */
export type Finger = { x: number; y: number; ausgeloest: boolean };

/**
 * Bewegt einen Finger und meldet, ob dabei der Absprung ausgelöst hat.
 * **Ein Wisch löst genau einmal aus** (`ausgeloest` sperrt den Finger bis zum
 * Loslassen) — sonst machte ein langer Wisch bei jeder weiteren Bewegung noch
 * einen Absprung und der nächste Wisch käme nie als frischer an.
 */
export function fingerBewegen(f: Finger, x: number, y: number): boolean {
  if (f.ausgeloest) return false;
  if (!wischNachOben(f.x, f.y, x, y)) return false;
  f.ausgeloest = true;
  return true;
}
