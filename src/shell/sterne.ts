/**
 * Wie viele Sterne eine Runde bekommt.
 *
 * **Das Problem: Die Punkteskalen der zwanzig Spiele sind unvergleichbar.**
 * Quiz Time geht von 0 bis 10, Block Burst in die Tausende. Eine feste Grenze
 * („ab 500 Punkte drei Sterne") wäre für das eine Spiel unerreichbar und für
 * das andere geschenkt. Dieselbe Überlegung, aus der es hier bewusst **keine
 * Gesamtpunktzahl** gibt.
 *
 * Deshalb wird gegen die **eigene bisherige Bestleistung** gemessen. Das ist
 * die einzige Zahl, die in jedem Spiel dieselbe Bedeutung hat: „So gut warst
 * du schon mal." Damit sagt ein Stern etwas Wahres aus, statt eine Note zu
 * erfinden.
 *
 * Die Kehrseite ist gewollt: Wer besser wird, muss für drei Sterne mehr
 * leisten. Genau das macht sie zu einer Auszeichnung statt zu Dekoration.
 */

export type Sternzahl = 1 | 2 | 3;

/** Ab diesem Anteil der eigenen Bestleistung gibt es drei bzw. zwei Sterne. */
const DREI_AB = 0.9;
const ZWEI_AB = 0.5;

export function sterne(
  punkte: number,
  bisherigeBestleistung: number,
  gewonnen = false,
): Sternzahl {
  /*
   * Ein echter Sieg ist immer drei Sterne — unabhängig von der Punktzahl.
   * Bei Box Push oder Flow Link *ist* das Lösen die Leistung; dass jemand
   * dafür mehr Züge gebraucht hat als beim letzten Mal, macht die gelöste
   * Aufgabe nicht zu einer halben Sache.
   */
  if (gewonnen) return 3;

  // Null Punkte sind nie mehr als ein Stern, auch wenn es die erste Runde
  // ist. Sonst bekäme man fürs Sofort-Verlieren die Höchstwertung.
  if (punkte <= 0) return 1;

  /*
   * Erste Runde mit Punkten: drei Sterne. Es gibt noch nichts, wogegen man
   * messen könnte — und der erste Versuch ist der schlechteste Moment für
   * eine magere Bewertung.
   */
  if (bisherigeBestleistung <= 0) return 3;

  const anteil = punkte / bisherigeBestleistung;
  if (anteil >= DREI_AB) return 3;
  if (anteil >= ZWEI_AB) return 2;
  return 1;
}

/**
 * Der Satz zur Sternzahl.
 *
 * **Farbe und Form sind nie das einzige Merkmal** — dieselbe Regel wie
 * überall im Projekt. Drei gelbe gegen zwei gelbe Sterne unterscheidet ein
 * farbfehlsichtiges Kind schlechter als zwei verschiedene Wörter.
 */
export function sternText(anzahl: Sternzahl): string {
  if (anzahl === 3) return 'Stark gespielt!';
  if (anzahl === 2) return 'Gut gemacht!';
  return 'Weiter so!';
}
