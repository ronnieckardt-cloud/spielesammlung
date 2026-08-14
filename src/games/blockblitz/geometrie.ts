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
