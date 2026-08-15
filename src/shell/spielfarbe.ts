import type { CSSProperties } from 'react';

/**
 * Die Spielfarbe in die Oberfläche tragen.
 *
 * Rückmeldung war: „Die Spiele werden schön farbig angezeigt auf der
 * Startseite, aber die Spiele selber sind eher im dunklen Grau." Der Bruch
 * liegt aber nicht an den Grundtönen — die sind gar kein Neutralgrau,
 * sondern liegen schon leicht im Blau. Es fehlt die **Zuordnung**: Der
 * bunte Startbildschirm sagt „Snake Rush", das Spielfeld danach sagt nichts.
 *
 * Deshalb werden hier nur die vier vorhandenen Farbtokens leicht
 * eingefärbt, statt neue Farben einzuführen. Das wirkt sofort in jedem
 * Element, das die Tokens benutzt — Zellen, Karten, Knöpfe, Ränder — und
 * **kein einziges Spiel muss angefasst werden**.
 *
 * Die Leitplanke dahinter: Farbe gehört hinter, neben und über das Brett,
 * nie auf die Brettfläche. Ein bunter Verlauf hinter einem fallenden
 * Vierling macht die Steine schlechter lesbar; bei Block Burst
 * unterscheiden sich vier Zustände einer Zelle fast nur über die
 * Helligkeit, und die leere Zelle muss der dunkelste Punkt im Bild bleiben.
 */

/**
 * Beimischung in Prozent. Bei 8 % ändert sich fast nur der Farbton, die
 * Helligkeit bleibt. Ab etwa 15 % kippt der Kontrast — bei Line Fall
 * (Akzent ist ein kräftiges Rot) würde ein rötlicher Grund den roten
 * Vierling schlucken.
 */
const ANTEIL = 8;

/**
 * Spiele, deren `accent` als Tönung schiefgeht, mit einer Ersatzfarbe.
 *
 * Das ist kein Schönheitsproblem, sondern ein handfestes: Die Akzentfarbe
 * ist an drei Stellen schon anderweitig belegt.
 */
const ERSATZFARBE: Record<string, string> = {
  // Akzent ist exakt das Grün, das im Quiz „richtige Antwort" bedeutet.
  // Ein grüner Grund würde dieses Signal verwässern.
  quiz: '#6366f1',
  // Akzent ist exakt die Farbe des Tastaturfokus (`--color-fokus`). Eine
  // Tönung daraus macht den Fokusrahmen schlechter erkennbar.
  platzhalter: '#818cf8',
  // Weder Blau (Spielerfarbe) noch Rot (Geister) sind frei — Violett ist
  // die einzige unbelegte Richtung.
  geisterjagd: '#a78bfa',
  // Teilt sich sein Grün mit Quiz Time; hier bleibt es beim Grün, weil im
  // Spiel selbst kein Grün eine Bedeutung trägt.
};

/** Die Farbe, mit der ein Spiel seine Oberfläche einfärbt. */
export function toenung(spielId: string, accent: string): string {
  return ERSATZFARBE[spielId] ?? accent;
}

/**
 * Die Stilangaben für den Rahmen eines Spiels: getönte Tokens plus die
 * Variable, aus der der Schein hinter dem Brett seine Farbe nimmt
 * (`.spielbuehne::before` in `index.css`).
 */
export function spielfarbenStil(spielId: string, accent: string): CSSProperties {
  const farbe = toenung(spielId, accent);
  const misch = (token: string) => `color-mix(in srgb, ${farbe} ${ANTEIL}%, var(${token}))`;

  return {
    // Die Tokens werden lokal überschrieben. Weil `--color-grund` usw. hier
    // neu gesetzt werden, muss die Beimischung gegen den **globalen** Wert
    // rechnen — deshalb die eigenen Namen `--grundton-*` als Zwischenschritt.
    '--grundton-grund': misch('--basis-grund'),
    '--color-grund': misch('--basis-grund'),
    '--color-flaeche': misch('--basis-flaeche'),
    '--color-flaeche-hoch': misch('--basis-flaeche-hoch'),
    '--color-rand': misch('--basis-rand'),
    '--spielfarbe': farbe,
    backgroundColor: misch('--basis-grund'),
  } as CSSProperties;
}
