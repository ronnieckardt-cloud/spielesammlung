class Enemy {
  /**
   * Die Physics-Group gehört in den Konstruktor, nicht an den Aufrufer:
   * `Arcade.Group.add()` schaltet den Körper des Kindes wieder **ein**. Wer
   * erst einblendet und dann hinzufügt, hebt die Sperre während des
   * Erscheinens damit stillschweigend wieder auf — genau das war hier der
   * Fall, und im Code sieht man es der Zeile nicht an.
   */
  constructor(scene, x, y, geschwindigkeit = 60, gruppe = null) {
    this.scene = scene;
    this.geschwindigkeit = geschwindigkeit;
    this.lebenspunkte = 2;

    // Getrennt von `sprite.active`: Beim Sterben läuft noch eine kurze
    // Animation, in der das Sprite technisch weiter aktiv ist. Ohne dieses
    // Merkmal schießt der Spieler weiter auf einen Gegner, der schon erledigt
    // ist, und verschwendet damit seine Schussfolge.
    this.tot = false;

    this.sprite = scene.physics.add.sprite(x, y, Enemy.erzeugeTextur(scene));
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setData('instanz', this);

    if (gruppe) gruppe.add(this.sprite);

    this.einblenden();
  }

  /**
   * Kurzes Auftauchen aus dem Nichts. Der Körper bleibt währenddessen
   * abgeschaltet — ein Gegner, der im selben Augenblick erscheint und trifft,
   * kostet ein Leben ohne jede Vorwarnung.
   */
  einblenden() {
    const dauer = 320;

    this.erscheint = true;
    this.sprite.body.enable = false;
    this.sprite.setAlpha(0).setScale(0.2).setAngle(-90);

    // Ein Ring, der von außen zusammenläuft — er zeigt die Stelle schon an,
    // bevor der Gegner selbst zu sehen ist.
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, 34);
    ring.setStrokeStyle(3, 0xe74c3c, 0.9);
    ring.setDepth(5);

    this.scene.tweens.add({
      targets: ring,
      scale: 0.3,
      alpha: 0,
      duration: dauer,
      onComplete: () => ring.destroy(),
    });

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      scale: 1,
      angle: 0,
      duration: dauer,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.erscheint = false;
        if (this.sprite.active && !this.tot) this.sprite.body.enable = true;
      },
    });
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

  takeDamage(schaden = 1) {
    if (this.tot) return;

    this.lebenspunkte -= schaden;

    if (this.lebenspunkte > 0) {
      this.trefferZeigen();
      return;
    }

    this.sterben();
  }

  /**
   * Treffer, der noch nicht tötet: kurz hell aufblitzen und ein Stück
   * zurückweichen. Ohne den Rückstoß sieht ein Treffer bei einem Gegner, der
   * unbeirrt weiterläuft, aus wie ein Fehlschuss.
   */
  trefferZeigen() {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });

    const weg = new Phaser.Math.Vector2(
      this.sprite.x - this.scene.player.sprite.x,
      this.sprite.y - this.scene.player.sprite.y,
    );
    if (weg.length() > 0) {
      weg.normalize();
      this.sprite.body.setVelocity(weg.x * 220, weg.y * 220);
    }
  }

  /**
   * Der Körper wird sofort abgeschaltet, die Animation läuft nur noch als
   * Bild. Sonst schiebt ein sterbender Gegner den Spieler noch weg oder kostet
   * ihn im letzten Moment einen Lebenspunkt.
   */
  sterben() {
    this.tot = true;
    this.sprite.body.enable = false;
    this.scene.gegnerBesiegt(this);

    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1.6,
      alpha: 0,
      angle: 90,
      duration: 220,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
