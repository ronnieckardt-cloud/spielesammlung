class Player {
  // Groesser als die alten 32: Die Figur ist schmaler als ein voller Block, der
  // Umriss braucht Flaeche, um bei rund 20 physischen Pixeln noch zu lesen.
  static ANZEIGE_GROESSE = 48;

  /**
   * Sämtliche Startwerte kommen aus dem Charakter (`charaktere.js`), keiner
   * ist hier noch einmal fest verdrahtet. Sonst gälte für einen Wert der
   * gewählte Charakter und für den nächsten weiter die alte Zahl — und das
   * fiele erst beim Spielen auf, nicht beim Lesen.
   */
  constructor(scene, x, y, charakter = Charaktere.standard()) {
    this.scene = scene;
    this.charakter = charakter;

    const werte = charakter.werte;

    this.geschwindigkeit = werte.tempo;
    this.schussVerzoegerungMs = werte.schussVerzoegerungMs;
    this.naechsterSchussAb = 0;
    this.blickrichtung = { x: 1, y: 0 };

    this.maxLebenspunkte = werte.leben;
    this.lebenspunkte = this.maxLebenspunkte;

    // Schaden je Geschoss. Wird über die Aufwertung „Stärkere Kugeln" erhöht;
    // ein Gegner hält zwei Treffer aus.
    this.schaden = werte.schaden;

    // Kurze Unverwundbarkeit nach einem Treffer. Ohne sie liegt der Spieler
    // nach einer Berührung noch im Gegner und verliert bei 60 Bildern je
    // Sekunde alle Leben, bevor er den Finger bewegen kann.
    this.unverwundbarMs = werte.unverwundbarMs;
    this.unverwundbarBis = 0;

    // Reichweite des Auto-Feuers. Ohne Grenze schießt der Spieler quer über
    // die ganze Arena und trifft Gegner, die er noch gar nicht gesehen hat.
    this.feuerReichweite = werte.reichweite;

    this.sprite = scene.physics.add.sprite(x, y, Player.erzeugeTextur(scene, charakter));

    // Die Figur wird größer angezeigt als ihre Trefferfläche: Der Umriss
    // braucht Luft, damit man ihn erkennt. Der Körper bleibt aber bei 32 x 32
    // wie vorher — die Wellen, der Mindestabstand beim Erscheinen und das
    // Ausweichgefühl hängen daran, und die sollen sich nicht mit ändern.
    //
    // Eingepasst statt hart gesetzt: Ein geliefertes PNG muss nicht quadratisch
    // sein, und ein glattes `setDisplaySize(48, 48)` würde es verzerren.
    Charaktere.einpassen(this.sprite, Player.ANZEIGE_GROESSE);

    // `body.setSize` rechnet in TEXTURpixeln und wird danach mit der
    // Sprite-Skalierung multipliziert. Ein glattes `setSize(32, 32)` ergäbe
    // bei einer 96er-Textur auf 48 Pixel Anzeige also 16 x 16 — der Spieler
    // wäre plötzlich kaum noch zu treffen, ohne dass eine Regel geändert wurde.
    // Deshalb gegenrechnen, und zwar je Achse: Bei einem nicht-quadratischen
    // Bild sind scaleX und scaleY verschieden.
    this.sprite.body.setSize(32 / this.sprite.scaleX, 32 / this.sprite.scaleY, true);

    this.sprite.setCollideWorldBounds(true);
    this.sprite.setData('instanz', this);

    this.bullets = scene.physics.add.group();

    // Touch ist die Pflicht (Zielgerät ist iPhone/iPad), die Tastatur nur die
    // Zugabe für die Entwicklung am Rechner — siehe CLAUDE.md, Abschnitt Technik.
    this.stick = new Stick(scene);

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      hoch: Phaser.Input.Keyboard.KeyCodes.W,
      runter: Phaser.Input.Keyboard.KeyCodes.S,
      links: Phaser.Input.Keyboard.KeyCodes.A,
      rechts: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.leertaste = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  /**
   * Die Figur kommt aus `charaktere.js` — Karte und Spielfeld greifen auf
   * dieselbe Weiche zu und können dadurch nicht auseinanderlaufen: Liegt ein
   * Bild in `assets/images/` vor, nehmen beide das Bild, sonst beide die
   * gezeichnete Figur.
   */
  static erzeugeTextur(scene, charakter = Charaktere.standard()) {
    return Charaktere.bildSchluessel(scene, charakter);
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

  update(gegnerListe) {
    this.bewegen();

    // Auto-Feuer: Am Stick hängt der eine Daumen, der zum Steuern gebraucht
    // wird — es bleibt keine Hand zum Zielen. Geschossen wird deshalb von
    // selbst auf den nächsten Gegner in Reichweite.
    const ziel = this.naechstesZiel(gegnerListe);
    if (ziel) {
      const dx = ziel.sprite.x - this.sprite.x;
      const dy = ziel.sprite.y - this.sprite.y;
      const laenge = Math.hypot(dx, dy) || 1;
      this.blickrichtung = { x: dx / laenge, y: dy / laenge };
      this.schiessen();
    }

    // Die Leertaste bleibt als manueller Schuss erhalten, damit sich das Spiel
    // am Rechner ohne Maus testen lässt.
    if (Phaser.Input.Keyboard.JustDown(this.leertaste)) {
      this.schiessen();
    }
  }

  bewegen() {
    let vx = 0;
    let vy = 0;

    if (this.stick.istAktiv) {
      vx = this.stick.richtung.x;
      vy = this.stick.richtung.y;
    } else {
      if (this.cursors.left.isDown || this.wasd.links.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.wasd.rechts.isDown) vx += 1;
      if (this.cursors.up.isDown || this.wasd.hoch.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.wasd.runter.isDown) vy += 1;

      // Diagonale auf Länge 1 bringen, sonst läuft man schräg schneller.
      // Beim Stick ist das nicht nötig — der liefert die Länge schon passend
      // und ein Kürzen würde die Feinabstufung wieder wegnehmen.
      const laenge = Math.hypot(vx, vy);
      if (laenge > 0) {
        vx /= laenge;
        vy /= laenge;
      }
    }

    if (vx !== 0 || vy !== 0) {
      const laenge = Math.hypot(vx, vy);
      this.blickrichtung = { x: vx / laenge, y: vy / laenge };
    }

    this.sprite.body.setVelocity(vx * this.geschwindigkeit, vy * this.geschwindigkeit);
  }

  naechstesZiel(gegnerListe) {
    if (!gegnerListe) return null;

    let bester = null;
    let besteEntfernung = this.feuerReichweite;

    gegnerListe.forEach((gegner) => {
      if (gegner.tot || gegner.erscheint || !gegner.sprite.active) return;
      const entfernung = Math.hypot(
        gegner.sprite.x - this.sprite.x,
        gegner.sprite.y - this.sprite.y,
      );
      if (entfernung < besteEntfernung) {
        besteEntfernung = entfernung;
        bester = gegner;
      }
    });

    return bester;
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

  get istUnverwundbar() {
    return this.scene.time.now < this.unverwundbarBis;
  }

  takeDamage() {
    if (this.istUnverwundbar || this.lebenspunkte <= 0) return;

    this.lebenspunkte -= 1;
    this.unverwundbarBis = this.scene.time.now + this.unverwundbarMs;

    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(110, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });

    this.blinken();
    this.scene.spielerWurdeGetroffen(this.lebenspunkte);
  }

  /**
   * Blinken während der Unverwundbarkeit — über die Deckkraft in einem engen
   * Band (1 bis 0,45), nicht über An/Aus. Zwei Durchgänge in 900 ms sind rund
   * 2,2 Hz; das ist ein kurzes Ereignis, kein Dauerpuls, und betrifft nur eine
   * 32-Pixel-Figur statt einer ganzen Fläche.
   */
  blinken() {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.45 },
      duration: this.unverwundbarMs / 4,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        if (this.sprite.active) this.sprite.setAlpha(1);
      },
    });
  }
}
