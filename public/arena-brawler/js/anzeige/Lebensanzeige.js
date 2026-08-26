/**
 * Lebensanzeige oben rechts.
 *
 * Die Herzen sind **gezeichnet**, nicht als Schriftzeichen (♥) gesetzt. Ein
 * Glyph hängt an der Schrift des Geräts: Auf iOS rendert Safari ♥ je nach
 * Kontext als schwarzes Symbol oder als buntes Emoji, mit unterschiedlicher
 * Breite. Eine Anzeige, deren Breite sich je nach Gerät ändert, verschiebt
 * sich am rechten Rand sichtbar.
 *
 * Ein verbrauchtes Herz verschwindet nicht, es bleibt als leerer Umriss
 * stehen. Nur so sieht man, wie viel man **hatte** — und Farbe ist damit
 * nicht das einzige Unterscheidungsmerkmal, gefüllt gegen offen reicht auch
 * ohne Farbsehen.
 */
class Lebensanzeige {
  constructor(scene, maximum) {
    this.scene = scene;
    this.maximum = maximum;

    this.groesse = 26;
    this.abstand = 6;
    this.randRechts = 16;
    this.oben = 18;

    this.herzen = [];
    for (let i = 0; i < maximum; i += 1) this.herzHinzufuegen();

    this.setzen(maximum);
  }

  /**
   * Hängt ein Herz an. Die Reihe wächst nach **links**, damit das erste Herz
   * außen am Rand stehen bleibt — eine Reihe, die bei „+1 Leben" komplett
   * verrutscht, liest sich als Fehler statt als Gewinn.
   */
  herzHinzufuegen() {
    const i = this.herzen.length;
    const x = this.scene.scale.width - this.randRechts - this.groesse / 2
      - i * (this.groesse + this.abstand);
    const y = this.oben + this.groesse / 2;

    const leer = this.scene.add.image(x, y, Lebensanzeige.erzeugeTextur(this.scene, false));
    const voll = this.scene.add.image(x, y, Lebensanzeige.erzeugeTextur(this.scene, true));

    [leer, voll].forEach((teil) => {
      teil.setDisplaySize(this.groesse, this.groesse);
      teil.setScrollFactor(0);
      teil.setDepth(1900);
    });

    this.herzen.push({ voll, leer });
    return this.herzen[i];
  }

  /** Nach „+1 Leben": ein Herz mehr, das kurz aufploppt. */
  maximumSetzen(neuesMaximum, lebenspunkte) {
    while (this.herzen.length < neuesMaximum) {
      const frisch = this.herzHinzufuegen();

      this.scene.tweens.add({
        targets: [frisch.voll, frisch.leer],
        scale: { from: 0, to: frisch.voll.scale },
        duration: 340,
        ease: 'Back.easeOut',
      });
    }

    this.maximum = neuesMaximum;
    this.setzen(lebenspunkte);
  }

  /**
   * Punkte der klassischen Herzkurve, auf eine quadratische Kachel normiert.
   *
   * Von Hand gesetzte Bezier-Kontrollpunkte waren der erste Versuch und
   * ergaben eine Pfeilspitze — bei einer Kurve, die man nicht im Kopf
   * ausrechnet, ist eine Formel verlässlicher als geratene Stützstellen. Die
   * Normierung auf die tatsächlich abgetasteten Extremwerte macht die Größe
   * unabhängig davon, wie die Formel skaliert.
   */
  static herzPunkte(kante, rand) {
    const roh = [];
    const schritte = 72;

    for (let i = 0; i < schritte; i += 1) {
      const t = (i / schritte) * Math.PI * 2;
      roh.push({
        x: 16 * Math.sin(t) ** 3,
        y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
      });
    }

    const xs = roh.map((p) => p.x);
    const ys = roh.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanneX = Math.max(...xs) - minX;
    const spanneY = Math.max(...ys) - minY;

    const nutzbar = kante - rand * 2;
    const massstab = Math.min(nutzbar / spanneX, nutzbar / spanneY);
    const versatzX = (kante - spanneX * massstab) / 2;
    const versatzY = (kante - spanneY * massstab) / 2;

    // y der Formel zeigt nach oben, auf dem Bildschirm nach unten — deshalb
    // gespiegelt, sonst steht das Herz auf dem Kopf.
    return roh.map((p) => ({
      x: versatzX + (p.x - minX) * massstab,
      y: versatzY + (spanneY - (p.y - minY)) * massstab,
    }));
  }

  static erzeugeTextur(scene, gefuellt) {
    const schluessel = gefuellt ? 'herz-voll' : 'herz-leer';
    if (scene.textures.exists(schluessel)) return schluessel;

    const kante = 64;
    const grafik = scene.add.graphics();
    const punkte = Lebensanzeige.herzPunkte(kante, 5);

    const pfadZiehen = () => {
      grafik.beginPath();
      grafik.moveTo(punkte[0].x, punkte[0].y);
      punkte.slice(1).forEach((p) => grafik.lineTo(p.x, p.y));
      grafik.closePath();
    };

    if (gefuellt) {
      grafik.fillStyle(0xe8455f, 1);
      pfadZiehen();
      grafik.fillPath();
      grafik.lineStyle(3, 0x7d1226, 1);
    } else {
      // Verbraucht: nur der Umriss. Gefüllt gegen offen ist ein Unterschied in
      // der Form, nicht bloß in der Farbe — das liest sich auch ohne Farbsehen.
      grafik.lineStyle(3, 0xffffff, 0.4);
    }

    pfadZiehen();
    grafik.strokePath();

    grafik.generateTexture(schluessel, kante, kante);
    grafik.destroy();

    return schluessel;
  }

  setzen(lebenspunkte) {
    this.herzen.forEach((herz, i) => {
      herz.voll.setVisible(i < lebenspunkte);
    });
  }

  /**
   * Ein verlorenes Herz zuckt einmal, bevor es erlischt — ein Herz, das
   * lautlos verschwindet, übersieht man mitten im Getümmel.
   *
   * Der Zustand wird **sofort** gesetzt und nicht erst am Ende der Animation.
   * Sonst zeigt die Anzeige bei schnell aufeinanderfolgenden Treffern zu viele
   * Herzen, und ein abgebrochener Tween (Neustart der Szene mitten im Lauf)
   * ließe sie dauerhaft falsch stehen. Das Zucken läuft deshalb auf einer
   * eigenen, kurzlebigen Kopie an derselben Stelle.
   */
  verlieren(lebenspunkte) {
    const erloschen = this.herzen[lebenspunkte];
    const warSichtbar = Boolean(erloschen && erloschen.voll.visible);

    this.setzen(lebenspunkte);

    if (!warSichtbar) return;

    const geist = this.scene.add.image(erloschen.voll.x, erloschen.voll.y, 'herz-voll');
    geist.setDisplaySize(this.groesse, this.groesse);
    geist.setScrollFactor(0);
    geist.setDepth(1901);

    this.scene.tweens.add({
      targets: geist,
      scale: geist.scale * 1.6,
      alpha: 0,
      duration: 260,
      onComplete: () => geist.destroy(),
    });
  }
}
