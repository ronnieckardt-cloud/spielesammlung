import type { TeilForm } from './logik';

/** Breite und Höhe der kleinsten Box, die die Form umschließt. */
export function formGroesse(form: TeilForm): { breite: number; hoehe: number } {
  let breite = 0;
  let hoehe = 0;
  for (const { dx, dy } of form) {
    breite = Math.max(breite, dx + 1);
    hoehe = Math.max(hoehe, dy + 1);
  }
  return { breite, hoehe };
}

/**
 * Rundet eine kommagenaue Rasterposition (z.B. unter dem Finger) auf den
 * Anker, sodass das Teil um diese Stelle herum zentriert erscheint — nicht
 * mit der oberen linken Ecke an der Fingerposition, das fühlt sich beim
 * Ziehen falsch an.
 */
export function ankerZentriertAuf(
  form: TeilForm,
  rasterX: number,
  rasterY: number,
): { ankerX: number; ankerY: number } {
  const { breite, hoehe } = formGroesse(form);
  return {
    ankerX: Math.round(rasterX - breite / 2),
    ankerY: Math.round(rasterY - hoehe / 2),
  };
}

function klemmen(wert: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, wert));
}

/**
 * Der Zielanker für eine Position auf dem Brett — dasselbe Zentrieren wie
 * oben, aber mit zwei Korrekturen, ohne die das Spiel am Rand nicht
 * bedienbar ist:
 *
 * 1. **Der Anker wird ins Brett geschoben.** Wird das Teil auf die
 *    angetippte Zelle zentriert, liegt seine linke obere Ecke bei größeren
 *    Teilen außerhalb: Ein 3×3-Teil auf Feld (0,0) ergibt Anker (−1,−1),
 *    und der passt nie. Der komplette Außenrand war dadurch beim Antippen
 *    unerreichbar. Beim Ziehen fiel es weniger auf, weil man den Finger
 *    einfach weiter zur Mitte schiebt — beim Antippen gibt es dieses
 *    Ausweichen nicht.
 * 2. **Zu weit daneben heißt „nicht gemeint".** `toleranz` ist der Rand in
 *    Zellen, der noch als Ziel zählt; darüber hinaus kommt `null` und der
 *    Zug verfällt, statt am Brettrand kleben zu bleiben. Bewusst klein
 *    gehalten: Wer das Teil zurück aufs Tablett zieht, will es dort
 *    ablegen und nicht in der untersten Reihe.
 *
 * Rein und getestet, weil Vorschau und wirkliches Legen hier dasselbe
 * rechnen müssen — sonst landet das Teil woanders, als es angezeigt wurde.
 */
export function ankerAufBrett(
  form: TeilForm,
  rasterX: number,
  rasterY: number,
  brettBreite: number,
  brettHoehe: number,
  toleranz = 0,
): { ankerX: number; ankerY: number } | null {
  if (rasterX < -toleranz || rasterX > brettBreite + toleranz) return null;
  if (rasterY < -toleranz || rasterY > brettHoehe + toleranz) return null;

  const { breite, hoehe } = formGroesse(form);
  const roh = ankerZentriertAuf(form, rasterX, rasterY);
  return {
    ankerX: klemmen(roh.ankerX, 0, brettBreite - breite),
    ankerY: klemmen(roh.ankerY, 0, brettHoehe - hoehe),
  };
}

/**
 * Zielanker für eine angetippte oder mit den Pfeiltasten angesteuerte
 * Zelle. Gerechnet wird mit der **Zellenmitte** (`+ 0.5`), damit Antippen
 * und Ziehen dieselbe Rechnung benutzen — beim Ziehen ist die Position
 * unter dem Finger ja auch kommagenau.
 */
export function ankerFuerZelle(
  form: TeilForm,
  x: number,
  y: number,
  brettBreite: number,
  brettHoehe: number,
): { ankerX: number; ankerY: number } | null {
  return ankerAufBrett(form, x + 0.5, y + 0.5, brettBreite, brettHoehe);
}
