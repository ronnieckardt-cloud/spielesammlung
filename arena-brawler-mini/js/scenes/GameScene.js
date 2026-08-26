class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Bei einem Neustart läuft create() erneut — alle Runden-Merkmale gehören
    // deshalb hierher und nicht in den Konstruktor.
    this.vorbei = false;
    this.welle = 0;
    this.wellePausiert = false;

    // Einfacher Arena-Hintergrund als dunkelgraues Rechteck über die volle Spielfläche
    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x2b2b3d,
    );

    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    this.player = new Player(this, 120, this.scale.height / 2);

    this.enemies = [];
    this.enemyGroup = this.physics.add.group();

    // Spieler-Geschosse treffen Gegner
    this.physics.add.overlap(this.player.bullets, this.enemyGroup, (kugel, gegnerSprite) => {
      const gegner = gegnerSprite.getData('instanz');
      if (!gegner || gegner.tot || gegner.erscheint) return;

      kugel.destroy();
      gegner.takeDamage();
    });

    // Spieler und Gegner blockieren sich gegenseitig und der Spieler nimmt Schaden
    this.physics.add.collider(this.player.sprite, this.enemyGroup, () => {
      this.player.takeDamage();
    });

    this.add.text(16, 16, 'Arena Brawler Mini – Prototype', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });

    this.kopfanzeige = new Kopfanzeige(this);
    this.lebensanzeige = new Lebensanzeige(this, this.player.maxLebenspunkte);

    this.hinweisAnzeigen();
    this.naechsteWelle();
  }

  /**
   * Kurzer Hinweis auf die Steuerung, der von selbst wieder verschwindet —
   * gleiche Machart wie in Dash City: Ohne ihn findet man den schwebenden
   * Stick nicht, mit ihm auf Dauer stört er.
   */
  hinweisAnzeigen() {
    const hinweis = this.add.text(
      this.scale.width / 2,
      this.scale.height - 48,
      'Finger aufs Feld legen und ziehen — geschossen wird von selbst',
      { fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffff' },
    );
    hinweis.setOrigin(0.5);
    hinweis.setAlpha(0.75);
    hinweis.setDepth(1001);

    const ausblenden = () => {
      if (!hinweis.active) return;
      this.tweens.add({ targets: hinweis, alpha: 0, duration: 300, onComplete: () => hinweis.destroy() });
    };

    this.input.once('pointerdown', ausblenden);
    this.time.delayedCall(4500, ausblenden);
  }

  naechsteWelle() {
    if (this.vorbei) return;

    this.welle += 1;
    this.wellePausiert = false;

    const anzahl = Wellen.gegnerZahl(this.welle);
    const tempo = Wellen.tempo(this.welle);
    const plaetze = Wellen.startPlaetze(
      this.welle, anzahl, this.scale.width, this.scale.height, this.player.sprite,
    );

    // Die Liste wird je Welle neu aufgebaut, nicht ergänzt — sonst wächst sie
    // über die Runde hinweg mit lauter erledigten Gegnern voll, und jede
    // Prüfung „ist die Welle geschafft?" läuft über immer mehr Leichen.
    this.enemies = plaetze.map(
      (platz) => new Enemy(this, platz.x, platz.y, tempo, this.enemyGroup),
    );

    this.kopfanzeige.welleSetzen(this.welle);
  }

  gegnerBesiegt() {
    this.kopfanzeige.punkteGeben(100);
  }

  welleGeschafft() {
    if (this.wellePausiert || this.vorbei) return;
    this.wellePausiert = true;

    const geschaffte = this.welle;

    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      `Welle ${geschaffte} geschafft`,
      { fontFamily: 'sans-serif', fontSize: '44px', color: '#7ee081', fontStyle: 'bold' },
    );
    text.setOrigin(0.5).setDepth(1500).setAlpha(0).setScale(0.7);

    this.tweens.add({
      targets: text,
      alpha: 1,
      scale: 1,
      duration: 320,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: text,
      alpha: 0,
      scale: 1.2,
      delay: 1050,
      duration: 380,
      onComplete: () => text.destroy(),
    });

    this.time.delayedCall(1700, () => this.naechsteWelle());
  }

  // Meldung vom Spieler: Der Rest der Runde hängt an der Szene, nicht an ihm.
  spielerWurdeGetroffen(lebenspunkte) {
    this.lebensanzeige.verlieren(lebenspunkte);
    this.cameras.main.shake(140, 0.006);

    if (lebenspunkte <= 0) {
      this.spielVorbei();
    }
  }

  spielVorbei() {
    if (this.vorbei) return;
    this.vorbei = true;

    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.enable = false;
    this.player.stick.abschalten();

    // Fliegende Geschosse anhalten. Ein Treffer, der nach dem Game Over noch
    // ankommt, gäbe Punkte auf einem Bildschirm, der die Endpunktzahl
    // bereits anzeigt.
    this.player.bullets.getChildren().forEach((kugel) => kugel.body.setVelocity(0, 0));

    this.enemies.forEach((gegner) => {
      if (gegner.sprite.active) gegner.sprite.body.setVelocity(0, 0);
    });

    const mitte = { x: this.scale.width / 2, y: this.scale.height / 2 };

    const schleier = this.add.rectangle(
      mitte.x, mitte.y, this.scale.width, this.scale.height, 0x05060f, 0.78,
    );
    schleier.setDepth(2000);

    const titel = this.add.text(mitte.x, mitte.y - 62, 'Game Over', {
      fontFamily: 'sans-serif', fontSize: '58px', color: '#ffffff',
    });
    titel.setOrigin(0.5).setDepth(2001);

    const ergebnis = this.add.text(
      mitte.x, mitte.y + 6,
      `${this.kopfanzeige.punkte} Punkte  ·  Welle ${this.welle}`,
      { fontFamily: 'sans-serif', fontSize: '26px', color: '#f1c40f' },
    );
    ergebnis.setOrigin(0.5).setDepth(2001);

    const anleitung = this.add.text(mitte.x, mitte.y + 62, 'Tippen zum Neustart', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#9aa4cc',
    });
    anleitung.setOrigin(0.5).setDepth(2001);

    [schleier, titel, ergebnis, anleitung].forEach((teil, i) => {
      const ziel = teil === schleier ? 0.78 : 1;
      teil.setAlpha(0);
      this.tweens.add({ targets: teil, alpha: ziel, duration: 260, delay: i * 70 });
    });

    // Kurze Sperre, bevor die Berührung zählt: Wer im Moment des Todes noch
    // den Finger am Stick hat, würde die Runde sonst sofort wieder neu starten
    // und den Bildschirm nie zu sehen bekommen.
    this.time.delayedCall(600, () => {
      this.input.once('pointerdown', () => this.scene.restart());
      this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    });
  }

  update(time, delta) {
    if (this.vorbei) return;

    this.kopfanzeige.aktualisieren();
    this.player.update(this.enemies);

    this.enemies.forEach((gegner) => {
      if (!gegner.tot && !gegner.erscheint && gegner.sprite.active) {
        gegner.update(this.player);
      }
    });

    if (!this.wellePausiert && this.enemies.length > 0 && this.enemies.every((g) => g.tot)) {
      this.welleGeschafft();
    }
  }
}
