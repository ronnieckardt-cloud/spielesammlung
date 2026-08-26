/**
 * Regeln der Wellen — reine Funktionen, ohne Phaser und ohne Zustand.
 *
 * Bewusst hier und nicht in der Szene: Ob Welle 7 fair ist, entscheidet sich
 * an diesen Zahlen, und die will man nachrechnen können, ohne das Spiel zu
 * starten und siebenmal zu sterben.
 */
const Wellen = {
  START_GEGNER: 3,
  MAX_GEGNER: 10,
  GRUNDTEMPO: 60,
  MAX_TEMPO: 100,

  /**
   * 3, 4, 6, 7, 9, 10, dann gedeckelt — abwechselnd ein und zwei Gegner mehr.
   * Der Deckel ist keine Willkür: Ab etwa zehn Verfolgern auf 960 × 540 ist
   * kein Ausweichen mehr möglich, und die Runde entscheidet der Zufall statt
   * das Können.
   */
  gegnerZahl(welle) {
    const zahl = Wellen.START_GEGNER + Math.floor((welle - 1) * 1.5);
    return Math.min(Wellen.MAX_GEGNER, zahl);
  },

  /**
   * Sehr moderate Steigerung: vier Einheiten je Welle. Der Spieler läuft 200 —
   * bliebe der Abstand nicht deutlich, könnte man sich irgendwann gar nicht
   * mehr lösen, und das Auto-Feuer allein rettet einen dann nicht.
   */
  tempo(welle) {
    return Math.min(Wellen.MAX_TEMPO, Wellen.GRUNDTEMPO + (welle - 1) * 4);
  },

  /**
   * Ein Punkt auf dem Rand der Arena, `anteil` läuft einmal im Uhrzeigersinn
   * herum (0 = links oben). Ein Rechteck-Umfang statt eines Kreises, damit die
   * Gegner wirklich am Rand stehen und nicht in den Ecken fehlen.
   */
  randPunkt(anteil, breite, hoehe, rand) {
    const b = breite - rand * 2;
    const h = hoehe - rand * 2;
    const umfang = (b + h) * 2;
    let weg = ((anteil % 1) + 1) % 1 * umfang;

    if (weg < b) return { x: rand + weg, y: rand };
    weg -= b;
    if (weg < h) return { x: breite - rand, y: rand + weg };
    weg -= h;
    if (weg < b) return { x: breite - rand - weg, y: hoehe - rand };
    weg -= b;
    return { x: rand, y: hoehe - rand - weg };
  },

  /**
   * Startplätze einer Welle: gleichmäßig über den Rand verteilt, je Welle
   * verdreht, damit nicht jede Welle an denselben Stellen beginnt.
   *
   * Wer zu dicht am Spieler landet, wird auf die gegenüberliegende Seite
   * geschoben. Ohne diese Prüfung erscheint irgendwann einer direkt neben ihm
   * und nimmt ihm ein Leben, bevor er überhaupt reagieren kann — das liest
   * sich als kaputtes Spiel, nicht als Schwierigkeit.
   */
  startPlaetze(welle, anzahl, breite, hoehe, spieler, mindestabstand = 220, rand = 40) {
    const versatz = (welle * 0.37) % 1;
    const plaetze = [];

    for (let i = 0; i < anzahl; i += 1) {
      const anteil = versatz + i / anzahl;
      let punkt = Wellen.randPunkt(anteil, breite, hoehe, rand);

      if (Math.hypot(punkt.x - spieler.x, punkt.y - spieler.y) < mindestabstand) {
        punkt = Wellen.randPunkt(anteil + 0.5, breite, hoehe, rand);
      }

      plaetze.push(punkt);
    }

    return plaetze;
  },
};
