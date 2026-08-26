/**
 * Auswahlbildschirm nach einer geschafften Welle: drei Karten zum Antippen.
 *
 * Die Karten sind bewusst groß (240 × 250 auf 960 × 540). Auf einem iPad ist
 * eine Trefffläche unter etwa 44 Punkten für einen Kinderdaumen zu klein, und
 * hier hängt an einem Fehltipp die ganze restliche Runde.
 */
class Auswahl {
  constructor(scene, karten, beiWahl) {
    this.scene = scene;
    this.beiWahl = beiWahl;
    this.gewaehlt = false;
    this.teile = [];

    const breite = scene.scale.width;
    const hoehe = scene.scale.height;

    // Tiefen im Spiel: Spielfeld < Auswahl-Schleier (1800) < Kopfzeile und
    // Herzen (1900) < Game-Over-Schleier (2000). Die Kopfzeile liegt bewusst
    // ÜBER diesem Schleier: „+1 Leben" ist eine Entscheidung, die vom
    // aktuellen Lebensstand abhängt — den muss man dabei ablesen können.
    const schleier = scene.add.rectangle(breite / 2, hoehe / 2, breite, hoehe, 0x05060f, 0.82);
    schleier.setDepth(1800);
    // Fängt Berührungen neben den Karten ab, damit nichts dahinter reagiert.
    schleier.setInteractive();
    this.teile.push(schleier);

    const ueberschrift = scene.add.text(breite / 2, 74, 'Wähle eine Aufwertung', {
      fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
    });
    ueberschrift.setOrigin(0.5).setDepth(1801);
    this.teile.push(ueberschrift);

    const kartenBreite = 240;
    // 270 statt 250: „Schnellere Schüsse" bricht zweizeilig um, und bei der
    // knapperen Höhe stieß die zweite Zeile fast an die Beschreibung darunter.
    const kartenHoehe = 270;
    const abstand = 28;
    const gesamt = karten.length * kartenBreite + (karten.length - 1) * abstand;
    const startX = (breite - gesamt) / 2 + kartenBreite / 2;

    karten.forEach((karte, i) => {
      const x = startX + i * (kartenBreite + abstand);
      this.karteBauen(karte, x, hoehe / 2 + 16, kartenBreite, kartenHoehe, i);
    });

    // Einblenden mit leichtem Versatz: Die Karten kommen nacheinander, nicht
    // alle auf einmal — das führt den Blick von links nach rechts.
    this.teile.forEach((teil) => teil.setAlpha(0));
    this.teile.forEach((teil, i) => {
      scene.tweens.add({ targets: teil, alpha: teil === schleier ? 0.82 : 1, duration: 220, delay: i * 60 });
    });
  }

  karteBauen(karte, x, y, breite, hoehe, index) {
    const scene = this.scene;
    const behaelter = scene.add.container(x, y);
    behaelter.setDepth(1801);

    const grafik = scene.add.graphics();
    grafik.fillStyle(0x1b2340, 1);
    grafik.fillRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 18);
    grafik.lineStyle(3, karte.farbe, 1);
    grafik.strokeRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 18);
    behaelter.add(grafik);

    // Farbiges Band oben: Die Farbe wiederholt sich im Rand und im Zeichen,
    // damit die Karte als ein Stück gelesen wird.
    const band = scene.add.graphics();
    band.fillStyle(karte.farbe, 1);
    band.fillRoundedRect(-breite / 2 + 18, -hoehe / 2 + 14, breite - 36, 6, 3);
    behaelter.add(band);

    behaelter.add(this.zeichenBauen(karte, -hoehe / 2 + 72));

    // Der Titel wächst um seine eigene Mitte (origin y = 0.5), nicht nach
    // unten: Sonst schiebt sich eine zweite Zeile in die Beschreibung darunter,
    // und das trifft ausgerechnet die längeren Namen.
    const titel = scene.add.text(0, -8, karte.titel, {
      fontFamily: 'sans-serif',
      fontSize: '23px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: breite - 34 },
    });
    titel.setOrigin(0.5, 0.5);
    behaelter.add(titel);

    const wirkung = scene.add.text(0, 38, karte.wirkung, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#9aa4cc',
      align: 'center',
      wordWrap: { width: breite - 34 },
    });
    wirkung.setOrigin(0.5, 0);
    behaelter.add(wirkung);

    const stufe = this.scene.stufen[karte.id] || 0;
    const stufeText = scene.add.text(0, hoehe / 2 - 30, `Stufe ${stufe + 1} von ${karte.maxStufe}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#6b76a3',
    });
    stufeText.setOrigin(0.5, 0);
    behaelter.add(stufeText);

    behaelter.setSize(breite, hoehe);
    behaelter.setInteractive(
      new Phaser.Geom.Rectangle(-breite / 2, -hoehe / 2, breite, hoehe),
      Phaser.Geom.Rectangle.Contains,
    );

    // Rückmeldung beim Auflegen des Fingers, nicht erst beim Loslassen: Auf
    // dem Tablet gibt es kein Schweben, das Drücken ist die einzige
    // Gelegenheit zu zeigen, dass die Karte reagiert.
    behaelter.on('pointerdown', () => {
      if (this.gewaehlt) return;
      this.gewaehlt = true;

      scene.tweens.add({
        targets: behaelter,
        scale: 1.08,
        duration: 130,
        yoyo: true,
        onComplete: () => this.schliessen(karte),
      });
    });

    this.teile.push(behaelter);
    return behaelter;
  }

  /** Ein einfaches Zeichen je Aufwertung — Form, nicht nur Farbe. */
  zeichenBauen(karte, y) {
    const scene = this.scene;

    if (karte.id === 'leben') {
      const bild = scene.add.image(0, y, Lebensanzeige.erzeugeTextur(scene, true));
      bild.setDisplaySize(46, 46);
      return bild;
    }

    const g = scene.add.graphics();
    g.fillStyle(karte.farbe, 1);
    g.lineStyle(4, karte.farbe, 1);

    if (karte.id === 'schuss') {
      // Drei Kugeln in einer Reihe = schnelle Folge
      [-22, 0, 22].forEach((dx) => g.fillCircle(dx, y, 7));
    } else if (karte.id === 'tempo') {
      // Doppelter Winkel nach rechts
      [-10, 10].forEach((dx) => {
        g.beginPath();
        g.moveTo(dx - 8, y - 14);
        g.lineTo(dx + 8, y);
        g.lineTo(dx - 8, y + 14);
        g.strokePath();
      });
    } else if (karte.id === 'schaden') {
      // Eine große Kugel neben einer kleinen = mehr Wumms
      g.fillCircle(-16, y, 6);
      g.fillCircle(12, y, 16);
    } else {
      // Reichweite: Ringe, die nach außen größer werden
      [9, 17, 25].forEach((r, i) => {
        g.lineStyle(3, karte.farbe, 1 - i * 0.28);
        g.strokeCircle(0, y, r);
      });
    }

    return g;
  }

  schliessen(karte) {
    this.scene.tweens.add({
      targets: this.teile,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.teile.forEach((teil) => teil.destroy());
        this.teile = [];
        this.beiWahl(karte);
      },
    });
  }
}
