/**
 * Box Push — die Farben der Kisten, an **einer** Stelle.
 *
 * Warum eigens eine Datei: Die Kiste wird an drei Orten gezeichnet — im
 * Spiel, als schwebende Deko auf dem Startbildschirm und im App-Symbol. Vor
 * dieser Datei hatte jeder Ort seine eigenen Farbwerte, und genau daran ist
 * es schiefgegangen: Die Kistenfüllung war `#b45309` — und exakt dieselbe
 * Farbe stand als mittlerer Stopp im Verlauf des App-Symbols **und** im
 * Verlauf des Startbildschirms. In der Kachelmitte lag der Kontrast damit bei
 * 1,00:1, sichtbar blieb nur der 1,6 Einheiten dünne Umriss. Auf einem
 * 64-Pixel-Symbol ist das nichts.
 *
 * Deshalb ist das Holz jetzt **hell**: Ein helles Brett auf braunem Grund
 * geht immer, ein braunes auf braunem nie. Gegen den mittleren Verlaufsstopp
 * (`#b45309`) kommt `HOLZ` auf gut 3:1 — die Schwelle, die die
 * Barrierefreiheits-Richtlinie für grafische Elemente nennt. Auf dem fast
 * schwarzen Spielbrett sind es über 10:1.
 */

/** Die Kistenfläche. Hell genug, um auf jedem Braun zu stehen. */
export const HOLZ = '#f2c185';
/** Der dunkle Rand ringsum — gibt der Kiste ihre Kante. */
export const HOLZ_RAND = '#6b3410';
/** Die beiden Bänder über Eck. Daran erkennt man eine Kiste sofort. */
export const HOLZ_BAND = '#a9682c';

/**
 * Eine Kiste, die auf ihrem Zielfeld steht.
 *
 * Sie wird nicht nur **golden**, sie bekommt auch ein anderes Zeichen: statt
 * der Bänder über Eck einen Haken. Farbe darf nie das einzige Merkmal sein,
 * und hell-gold gegen hell-holz unterscheidet sich fast nur im Farbton.
 */
export const FERTIG = '#fde68a';
export const FERTIG_RAND = '#a16207';

/** Der Ring, der ein freies Zielfeld markiert. */
export const ZIELRING = '#facc15';
