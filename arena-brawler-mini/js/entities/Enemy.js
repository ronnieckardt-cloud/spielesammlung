class Enemy {
  constructor(scene, x, y) {
    this.scene = scene;
    this.geschwindigkeit = 60;

    this.sprite = scene.physics.add.sprite(x, y, Enemy.erzeugeTextur(scene));
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setData('instanz', this);
  }

  // Erzeugt einmalig ein rotes Rechteck als Platzhalter-Textur für Gegner
  static erzeugeTextur(scene) {
    const schluessel = 'gegner-textur';
    if (!scene.textures.exists(schluessel)) {
      const grafik = scene.add.graphics();
      grafik.fillStyle(0xe74c3c, 1);
      grafik.fillRect(0, 0, 32, 32);
      grafik.generateTexture(schluessel, 32, 32);
      grafik.destroy();
    }
    return schluessel;
  }

  // Einfache KI: langsam direkt auf den Spieler zubewegen
  update(player) {
    const ziel = player.sprite;
    const richtung = new Phaser.Math.Vector2(ziel.x - this.sprite.x, ziel.y - this.sprite.y);

    if (richtung.length() > 1) {
      richtung.normalize();
      this.sprite.body.setVelocity(richtung.x * this.geschwindigkeit, richtung.y * this.geschwindigkeit);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }
  }

  // Platzhalter: Lebenspunkte folgen in einer späteren Ausbaustufe.
  // Bis dahin verschwindet der Gegner sofort bei einem Treffer.
  takeDamage() {
    this.sprite.destroy();
  }
}
