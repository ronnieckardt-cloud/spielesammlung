// Startpunkt des Spiels: Phaser-Konfiguration zusammenstellen und die Game-Instanz starten.
const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [GameScene],
};

new Phaser.Game(config);
