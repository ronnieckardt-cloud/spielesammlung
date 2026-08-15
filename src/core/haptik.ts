/**
 * Ein kurzer Stups im Gerät bei den wichtigen Momenten.
 *
 * ## Ehrlich vorweg: Auf Florians Geräten passiert damit nichts
 *
 * Die Vibrations-Schnittstelle des Browsers (`navigator.vibrate`) gibt es
 * in Safari **nicht** — weder auf dem iPhone noch auf dem iPad. Apple hat
 * sie nie eingebaut. Auf Android und in Chrome funktioniert sie.
 *
 * Warum es sie hier trotzdem gibt: Sie kostet zwanzig Zeilen, kann nichts
 * kaputt machen (ohne Unterstützung passiert schlicht gar nichts), und
 * sobald jemand die App auf einem Android-Gerät öffnet, fühlt sie sich
 * dort richtig an. Was sie **nicht** darf, ist so getan werden, als wäre
 * sie auf dem Hauptgerät wirksam — deshalb steht das hier so deutlich.
 *
 * ## Warum es hier keinen Schalter gibt
 *
 * Vibration ist auf jedem Gerät bereits systemweit abschaltbar, und der
 * Systemschalter gewinnt ohnehin. Ein zweiter Schalter in der App wäre die
 * Falle, die im Projekt schon einmal zugeschnappt ist (siehe „Wenn
 * Animationen einfach weg sind"): zwei Stellen, die dasselbe festlegen,
 * und niemand weiß mehr, welche gilt.
 */

/**
 * Die drei Anlässe — bewusst nicht mehr.
 *
 * Ein Stups bei **jedem** Antippen wäre auf einem Handy nach zwei Minuten
 * nur noch lästig; genau daran erkennt man Apps, die es übertreiben. Hier
 * gibt es ihn nur, wenn wirklich etwas passiert ist.
 */
type Anlass =
  /** Eine Runde ist vorbei. Ein einzelner kurzer Stups. */
  | 'ende'
  /** Neue Stufe oder Erfolg. Doppelschlag — hörbar anders als „ende". */
  | 'jubel'
  /** Etwas ging nicht (belegtes Feld, ungültiger Zug). Sehr kurz. */
  | 'fehler';

/** Millisekunden: Zahl = Stups, Liste = Wechsel aus Stups und Pause. */
const MUSTER: Record<Anlass, number | number[]> = {
  ende: 18,
  jubel: [16, 60, 26],
  fehler: 10,
};

export function haptik(anlass: Anlass): void {
  // `typeof` statt `in`: In manchen Umgebungen (Server-Rendern, Tests) gibt
  // es gar keinen `navigator`, und ein Zugriff darauf würde werfen.
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(MUSTER[anlass]);
  } catch {
    /* Manche Browser werfen, wenn die Seite gerade nicht im Vordergrund
       ist. Ein fehlgeschlagener Stups darf niemals eine Runde beenden. */
  }
}
