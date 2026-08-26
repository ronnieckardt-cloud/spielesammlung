class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.geschwindigkeit = 200;
    this.schussVerzoegerungMs = 250;
    this.naechsterSchussAb = 0;
    this.blickrichtung = { x: 1, y: 0 };

    this.sprite = scene.physics.add.sprite(x, y, Player.erzeugeTextur(scene));
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setData('instanz', this);

    this.bullets = scene.physics.add.group();

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      hoch: Phaser.Input.Keyboard.KeyCodes.W,
      runter: Phaser.Input.Keyboard.KeyCodes.S,
      links: Phaser.Input.Keyboard.KeyCodes.A,
      rechts: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.leertaste = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  // Erzeugt einmalig ein blaues Rechteck als Platzhalter-Textur für den Spieler
  static erzeugeTextur(scene) {
    const schluessel = 'spieler-textur';
    if (!scene.textures.exists(schluessel)) {
      const grafik = scene.add.graphics();
      grafik.fillStyle(0x2e86de, 1);
      grafik.fillRect(0, 0, 32, 32);
      grafik.generateTexture(schluessel, 32, 32);
      grafik.destroy();
    }
    return schluessel;
  }

  // Erzeugt einmalig einen gelben Kreis als Platzhalter-Textur für Geschosse
  static erzeugeKugelTextur(scene) {
    const schluessel = 'kugel-textur';
    if (!scene.textures.exists(schluessel)) {
      const grafik = scene.add.graphics();
      grafik.fillStyle(0xf1c40f, 1);
      grafik.fillCircle(4, 4, 4);
      grafik.generateTexture(schluessel, 8, 8);
      grafik.destroy();
    }
    return schluessel;
  }

  update() {
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.links.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.rechts.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.hoch.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.runter.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      const laenge = Math.hypot(vx, vy);
      vx /= laenge;
      vy /= laenge;
      this.blickrichtung = { x: vx, y: vy };
    }

    this.sprite.body.setVelocity(vx * this.geschwindigkeit, vy * this.geschwindigkeit);

    if (Phaser.Input.Keyboard.JustDown(this.leertaste)) {
      this.schiessen();
    }
  }

  schiessen() {
    const jetzt = this.scene.time.now;
    if (jetzt < this.naechsterSchussAb) return;
    this.naechsterSchussAb = jetzt + this.schussVerzoegerungMs;

    const tempo = 400;
    const lebenszeitMs = 1500;

    const kugel = this.bullets.create(this.sprite.x, this.sprite.y, Player.erzeugeKugelTextur(this.scene));
    kugel.body.setAllowGravity(false);
    kugel.setVelocity(this.blickrichtung.x * tempo, this.blickrichtung.y * tempo);

    // Geschoss nach kurzer Flugzeit selbst aufräumen, statt endlos weiterzufliegen
    this.scene.time.delayedCall(lebenszeitMs, () => {
      if (kugel.active) kugel.destroy();
    });
  }

  // Platzhalter: Lebenspunkte/Game-Over folgen in einer späteren Ausbaustufe.
  // Bis dahin nur eine kurze rote Rückmeldung, damit ein Treffer sichtbar ist.
  takeDamage() {
    this.sprite.setTintFill(0xff0000);
    this.scene.time.delayedCall(120, () => this.sprite.clearTint());
  }
}
