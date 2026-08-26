class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
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

    this.enemies = [
      new Enemy(this, 700, 150),
      new Enemy(this, 820, 400),
      new Enemy(this, 760, 270),
    ];

    // Ein Physics-Group bündelt die Gegner-Sprites für Kollision und Treffer-Abfrage
    this.enemyGroup = this.physics.add.group();
    this.enemies.forEach((gegner) => this.enemyGroup.add(gegner.sprite));

    // Spieler-Geschosse treffen Gegner
    this.physics.add.overlap(this.player.bullets, this.enemyGroup, (kugel, gegnerSprite) => {
      kugel.destroy();
      const gegner = gegnerSprite.getData('instanz');
      if (gegner) {
        gegner.takeDamage();
      }
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
  }

  update(time, delta) {
    this.player.update();

    this.enemies.forEach((gegner) => {
      if (gegner.sprite.active) {
        gegner.update(this.player);
      }
    });
  }
}
