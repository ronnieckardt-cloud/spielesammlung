/**
 * Punktestand oben links, Wellennummer unter den Herzen.
 *
 * Die Punktzahl zählt sichtbar hoch, statt zu springen — dieselbe Überlegung
 * wie in der Spielesammlung: Eine Zahl, die von 300 auf 400 springt, nimmt man
 * mitten im Getümmel gar nicht wahr; eine, die läuft, zieht den Blick.
 */
class Kopfanzeige {
  constructor(scene) {
    this.scene = scene;

    this.punkte = 0;
    this.gezeigt = 0;

    this.punkteText = scene.add.text(16, 44, '0', {
      fontFamily: 'sans-serif',
      fontSize: '34px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.punkteText.setDepth(1900).setScrollFactor(0);

    this.punkteLabel = scene.add.text(16, 82, 'PUNKTE', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#9aa4cc',
    });
    this.punkteLabel.setLetterSpacing(2).setDepth(1900).setScrollFactor(0);

    this.welleText = scene.add.text(scene.scale.width - 16, 52, 'Welle 1', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#9aa4cc',
    });
    this.welleText.setOrigin(1, 0).setDepth(1900).setScrollFactor(0);
  }

  punkteGeben(betrag) {
    this.punkte += betrag;
  }

  /**
   * Sofort auf den echten Stand springen, ohne den Rest hochzuzählen.
   *
   * Gebraucht beim Game Over: Dort steigt `update()` aus, die Zahl hört also
   * mitten im Lauf auf. Ohne dieses Nachziehen steht in der Kopfzeile
   * dauerhaft eine andere Zahl als im Ergebnis daneben — und der Spieler
   * glaubt eher der kleineren.
   */
  sofortZeigen() {
    this.gezeigt = this.punkte;
    this.punkteText.setText(String(this.gezeigt));
  }

  welleSetzen(welle) {
    this.welleText.setText(`Welle ${welle}`);

    // Kurzer Stups, damit der Wechsel auch auffällt, wenn man gerade auf die
    // andere Bildschirmseite schaut.
    this.scene.tweens.add({
      targets: this.welleText,
      scale: { from: 1.35, to: 1 },
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Wird aus der Szenen-Schleife aufgerufen. Die gezeigte Zahl holt die echte
   * ein, aber nie mehr als nötig — und nur nach oben: eine rückwärts laufende
   * Zahl sähe aus wie ein Fehler.
   */
  aktualisieren() {
    if (this.gezeigt === this.punkte) return;

    const rest = this.punkte - this.gezeigt;
    const schritt = Math.max(1, Math.ceil(Math.abs(rest) / 8));
    this.gezeigt += Math.sign(rest) * Math.min(schritt, Math.abs(rest));

    this.punkteText.setText(String(this.gezeigt));
  }
}
