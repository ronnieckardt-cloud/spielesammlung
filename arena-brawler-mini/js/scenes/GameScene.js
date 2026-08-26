class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  /**
   * Die Charakterbilder aus `assets/images/` laden — falls es sie gibt.
   *
   * Ein fehlendes Bild darf das Spiel **nicht** anhalten: Der Prototyp lief
   * bisher ganz ohne Dateien, und ein Ladefehler würde sonst aus drei
   * Charakteren drei unsichtbare Sprites machen. `loaderror` fängt das ab, und
   * `Charaktere.bildSchluessel` fällt danach auf die gezeichnete Figur zurück.
   *
   * `preload()` läuft bei `scene.restart()` nicht erneut — Phaser ruft es nur
   * beim ersten Start der Szene. Das ist hier richtig so: Die Bilder liegen
   * danach im Texturspeicher und müssen nicht je Runde neu geholt werden.
   */
  preload() {
    Charaktere.LISTE.forEach((c) => {
      this.load.image(Charaktere.BILD_PRAEFIX + c.id, `assets/images/char-${c.id}.png`);
    });

    // Merken statt melden: Welche Datei fehlt, entscheidet später die Abfrage
    // `textures.exists`. Der Zweig hier verhindert nur, dass Phaser den
    // Ladefehler als Ausnahme weiterreicht.
    this.load.on('loaderror', (datei) => {
      if (!this.fehlendeBilder) this.fehlendeBilder = [];
      this.fehlendeBilder.push(datei.key);
    });
  }

  create() {
    // Bei einem Neustart läuft create() erneut — alle Runden-Merkmale gehören
    // deshalb hierher und nicht in den Konstruktor.
    this.vorbei = false;
    this.welle = 0;
    this.wellePausiert = false;
    this.auswahlLaeuft = false;

    // Welche Aufwertung wie oft genommen wurde. Beim Neustart wieder leer —
    // die Boni gelten für die Runde, nicht für das Gerät.
    this.stufen = {};

    // Eine Saat je Runde: Die Kartenauswahl ist eine Spielregel und soll
    // nachstellbar sein, aber nicht in jeder Runde dieselbe Abfolge liefern.
    this.saat = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

    // Einfacher Arena-Hintergrund als dunkelgraues Rechteck über die volle Spielfläche
    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x2b2b3d,
    );

    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    this.player = null;
    this.enemies = [];
    this.enemyGroup = this.physics.add.group();

    this.add.text(16, 16, 'Arena Brawler Mini – Prototype', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });

    this.charakterWaehlen();
  }

  /**
   * Charakterwahl vor dem Start — auch nach jedem Game Over wieder.
   *
   * Die Alternative wäre, denselben Charakter direkt neu zu starten. Dagegen
   * spricht: Der Prototyp hat keinen Menüknopf, mit dem man zurück zur Wahl
   * käme. Wer einmal „Tank" getippt hat, bliebe für immer beim Tank — und
   * damit wäre der ganze Sinn dreier Charaktere weg. Der Weg kostet einen
   * Tipp auf einem Bildschirm, den man ohnehin gerade liest.
   *
   * Damit schnelles Weiterspielen trotzdem schnell bleibt, ist der zuletzt
   * gespielte Charakter markiert: Man sucht ihn nicht, man sieht ihn.
   */
  charakterWaehlen() {
    this.auswahlLaeuft = true;

    const zuletzt = this.registry.get('letzterCharakter') || null;
    const rekord = Rekord.lesen();

    this.auswahl = new Auswahl(this, {
      ueberschrift: 'Wer soll kämpfen?',
      unterschrift: Rekord.zeile(rekord) || 'Noch kein Lauf gewertet',
      karten: Charaktere.LISTE.map((c) => ({
        id: c.id, titel: c.name, wirkung: c.staerke, farbe: c.farbe, charakter: c,
      })),
      zeichen: (scene, karte, y) => Charaktere.zeichen(scene, karte.charakter, y),
      fusszeile: (karte) => (karte.id === zuletzt
        ? `Zuletzt gespielt · ${Charaktere.werteZeile(karte.charakter)}`
        : Charaktere.werteZeile(karte.charakter)),
      hervorgehoben: zuletzt,
      beiWahl: (karte) => this.rundeStarten(karte.charakter),
    });
  }

  rundeStarten(charakter) {
    this.charakter = charakter;
    this.registry.set('letzterCharakter', charakter.id);

    this.player = new Player(this, 120, this.scale.height / 2, charakter);

    // Spieler-Geschosse treffen Gegner
    this.physics.add.overlap(this.player.bullets, this.enemyGroup, (kugel, gegnerSprite) => {
      const gegner = gegnerSprite.getData('instanz');
      if (!gegner || gegner.tot || gegner.erscheint) return;

      kugel.destroy();
      gegner.takeDamage(this.player.schaden);
    });

    // Spieler und Gegner blockieren sich gegenseitig und der Spieler nimmt Schaden
    this.physics.add.collider(this.player.sprite, this.enemyGroup, () => {
      this.player.takeDamage();
    });

    this.kopfanzeige = new Kopfanzeige(this);
    this.lebensanzeige = new Lebensanzeige(this, this.player.maxLebenspunkte);

    this.auswahlLaeuft = false;
    this.auswahl = null;

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

    this.time.delayedCall(1700, () => this.auswahlZeigen());
  }

  /**
   * Drei Karten zur Wahl. Ist nichts mehr offen (alles ausgereizt), geht es
   * ohne Zwischenschritt weiter — ein leerer Auswahlbildschirm, auf dem nichts
   * anzutippen ist, wäre eine Sackgasse.
   */
  auswahlZeigen() {
    if (this.vorbei) return;

    const karten = Aufwertungen.auswahl(this.stufen, this.saat + this.welle * 7919);

    if (karten.length === 0) {
      this.naechsteWelle();
      return;
    }

    this.auswahlLaeuft = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.stick.abschalten();

    this.auswahl = new Auswahl(this, {
      ueberschrift: 'Wähle eine Aufwertung',
      karten,
      zeichen: (scene, karte, y) => Aufwertungen.zeichen(scene, karte, y),
      fusszeile: (karte) => `Stufe ${(this.stufen[karte.id] || 0) + 1} von ${karte.maxStufe}`,
      beiWahl: (karte) => {
        this.aufwertungNehmen(karte);

        this.auswahlLaeuft = false;
        this.auswahl = null;
        this.player.stick.anschalten();
        this.naechsteWelle();
      },
    });
  }

  aufwertungNehmen(karte) {
    this.stufen[karte.id] = (this.stufen[karte.id] || 0) + 1;
    karte.anwenden(this.player);

    // Die Herzenreihe muss der neuen Obergrenze folgen — sonst gewinnt man ein
    // Leben, das nirgends zu sehen ist.
    if (karte.id === 'leben') {
      this.lebensanzeige.maximumSetzen(this.player.maxLebenspunkte, this.player.lebenspunkte);
    }
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

    // Die hochzählende Punktzahl bleibt sonst auf ihrem Zwischenstand stehen,
    // weil `update()` ab jetzt aussteigt — in der Kopfzeile stünde dauerhaft
    // eine andere Zahl als im Ergebnis daneben.
    this.kopfanzeige.sofortZeigen();

    // Rekord melden, bevor der Bildschirm gebaut wird — er zeigt das Ergebnis
    // gleich mit an. `melden` schreibt nur, wenn es wirklich besser war.
    this.rekordErgebnis = Rekord.melden(this.kopfanzeige.punkte, this.welle);

    const mitte = { x: this.scale.width / 2, y: this.scale.height / 2 };

    const schleier = this.add.rectangle(
      mitte.x, mitte.y, this.scale.width, this.scale.height, 0x05060f, 0.78,
    );
    schleier.setDepth(2000);

    const titel = this.add.text(mitte.x, mitte.y - 92, 'Game Over', {
      fontFamily: 'sans-serif', fontSize: '54px', color: '#ffffff',
    });
    titel.setOrigin(0.5).setDepth(2001);

    const ergebnis = this.add.text(
      mitte.x, mitte.y - 30,
      `${this.kopfanzeige.punkte} Punkte  ·  Welle ${this.welle}`,
      { fontFamily: 'sans-serif', fontSize: '26px', color: '#f1c40f' },
    );
    ergebnis.setOrigin(0.5).setDepth(2001);

    // Bei einem Rekord ist der beste Lauf genau dieser — eine zusätzliche
    // Zeile „Bester: dasselbe nochmal" wäre nur Rauschen. Deshalb entweder
    // die Rekordmeldung oder der bisherige Bestwert, nie beides.
    const rekordZeile = this.rekordErgebnis.istRekord
      ? this.add.text(mitte.x, mitte.y + 20, 'Neuer Rekord!', {
        fontFamily: 'sans-serif', fontSize: '30px', color: '#7ee081', fontStyle: 'bold',
      })
      : this.add.text(mitte.x, mitte.y + 20, Rekord.zeile(this.rekordErgebnis.neu) || '', {
        fontFamily: 'sans-serif', fontSize: '17px', color: '#8a93bd',
      });
    rekordZeile.setOrigin(0.5).setDepth(2001);

    const anleitung = this.add.text(mitte.x, mitte.y + 74, 'Tippen zum Neustart', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#9aa4cc',
    });
    anleitung.setOrigin(0.5).setDepth(2001);

    [schleier, titel, ergebnis, rekordZeile, anleitung].forEach((teil, i) => {
      const ziel = teil === schleier ? 0.78 : 1;
      teil.setAlpha(0);
      this.tweens.add({ targets: teil, alpha: ziel, duration: 260, delay: i * 70 });
    });

    // Der Rekord bekommt einen eigenen kleinen Auftritt — er ist die
    // Belohnung, und ein Text, der genauso einblendet wie alles andere, geht
    // zwischen vier Zeilen unter.
    if (this.rekordErgebnis.istRekord) {
      this.tweens.add({
        targets: rekordZeile,
        scale: { from: 0.6, to: 1 },
        duration: 420,
        delay: 210,
        ease: 'Back.easeOut',
      });
    }

    // Kurze Sperre, bevor die Berührung zählt: Wer im Moment des Todes noch
    // den Finger am Stick hat, würde die Runde sonst sofort wieder neu starten
    // und den Bildschirm nie zu sehen bekommen.
    this.time.delayedCall(600, () => {
      this.input.once('pointerdown', () => this.scene.restart());
      this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    });
  }

  update(time, delta) {
    // Vor der Charakterwahl gibt es noch keinen Spieler und keine Kopfzeile.
    if (this.vorbei || !this.player) return;

    // Die Punktzahl darf weiterlaufen, während die Karten stehen — sie holt
    // nur den schon verdienten Stand ein, das ist keine Spielhandlung.
    this.kopfanzeige.aktualisieren();
    if (this.auswahlLaeuft) return;

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
