/**
 * Auswahlbildschirm mit antippbaren Karten — benutzt für die Charakterwahl vor
 * der Runde und für die Aufwertungen nach jeder Welle.
 *
 * Bewusst **ein** Baustein für beides: Die beiden Bildschirme unterscheiden
 * sich nur in Überschrift, Zeichen und Fußzeile. Zwei fast gleiche Klassen
 * nebeneinander driften auseinander, sobald jemand nur eine davon anfasst —
 * und dann sitzt die Trefffläche auf dem einen Bildschirm anders als auf dem
 * anderen.
 *
 * Die Karten sind groß (240 × 270 auf 960 × 540). Auf einem iPad ist eine
 * Trefffläche unter etwa 44 Punkten für einen Kinderdaumen zu klein, und hier
 * hängt an einem Fehltipp die ganze restliche Runde.
 */
class Auswahl {
  /**
   * @param {object} plan
   *   ueberschrift  Text über den Karten
   *   karten        [{ id, titel, wirkung, farbe }]
   *   zeichen       (scene, karte, y) => GameObject — das Symbol der Karte
   *   fusszeile     (karte) => string
   *   hervorgehoben id der Karte, die zusätzlich markiert wird (optional)
   *   marke         Text für diese Markierung (optional)
   *   beiWahl       (karte) => void
   */
  constructor(scene, plan) {
    this.scene = scene;
    this.plan = plan;
    this.beiWahl = plan.beiWahl;
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

    const ueberschrift = scene.add.text(breite / 2, 74, plan.ueberschrift, {
      fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
    });
    ueberschrift.setOrigin(0.5).setDepth(1801);
    this.teile.push(ueberschrift);

    const kartenBreite = 240;
    // Zweimal gewachsen, beide Male wegen umbrechender Texte: erst 250 → 270,
    // weil „Schnellere Schüsse" zweizeilig an die Beschreibung stieß, dann
    // 270 → 300, weil die Werte-Zeile der Charaktere unten aus der Karte lief.
    const kartenHoehe = 300;
    const abstand = 28;
    const gesamt = plan.karten.length * kartenBreite + (plan.karten.length - 1) * abstand;
    const startX = (breite - gesamt) / 2 + kartenBreite / 2;

    plan.karten.forEach((karte, i) => {
      const x = startX + i * (kartenBreite + abstand);
      this.karteBauen(karte, x, hoehe / 2 + 16, kartenBreite, kartenHoehe);
    });

    // Einblenden mit leichtem Versatz: Die Karten kommen nacheinander, nicht
    // alle auf einmal — das führt den Blick von links nach rechts.
    this.teile.forEach((teil) => teil.setAlpha(0));
    this.teile.forEach((teil, i) => {
      scene.tweens.add({ targets: teil, alpha: teil === schleier ? 0.82 : 1, duration: 220, delay: i * 60 });
    });
  }

  karteBauen(karte, x, y, breite, hoehe) {
    const scene = this.scene;
    const hervor = this.plan.hervorgehoben === karte.id;
    const behaelter = scene.add.container(x, y);
    behaelter.setDepth(1801);

    const grafik = scene.add.graphics();
    grafik.fillStyle(0x1b2340, 1);
    grafik.fillRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 18);
    grafik.lineStyle(hervor ? 5 : 3, karte.farbe, 1);
    grafik.strokeRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 18);
    behaelter.add(grafik);

    // Farbiges Band oben: Die Farbe wiederholt sich im Rand und im Zeichen,
    // damit die Karte als ein Stück gelesen wird.
    const band = scene.add.graphics();
    band.fillStyle(karte.farbe, 1);
    band.fillRoundedRect(-breite / 2 + 18, -hoehe / 2 + 14, breite - 36, 6, 3);
    behaelter.add(band);

    behaelter.add(this.plan.zeichen(scene, karte, -hoehe / 2 + 72));

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

    // Platz für bis zu drei Zeilen: „Zuletzt gespielt · 7 Leben · gemächlich"
    // bricht auf einem schmalen Gerät mehrfach um, und was unten aus der Karte
    // läuft, liest sich als kaputtes Layout.
    const fusszeile = scene.add.text(0, hoehe / 2 - 64, this.plan.fusszeile(karte), {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: hervor ? '#c8d0f0' : '#6b76a3',
      align: 'center',
      wordWrap: { width: breite - 24 },
    });
    fusszeile.setOrigin(0.5, 0);
    behaelter.add(fusszeile);

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
