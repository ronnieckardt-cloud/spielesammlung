// Startpunkt des Spiels: Phaser-Konfiguration zusammenstellen und die Game-Instanz starten.
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',

  /**
   * Das Spielfeld bleibt intern immer 960 × 540 — sämtliche Positionen im Code
   * (Kartenraster, Herzenreihe, Startplätze der Gegner) rechnen mit diesen
   * Zahlen. `FIT` skaliert die Leinwand auf den verfügbaren Platz, ohne das
   * Seitenverhältnis anzutasten; `CENTER_BOTH` legt sie in die Mitte.
   *
   * Vorher stand hier gar kein Modus, also `NONE`: Die Leinwand war 960 × 540
   * CSS-Pixel groß, und nur das `max-width: 100%` im Stylesheet hat sie optisch
   * verkleinert. Phaser wusste davon nichts — `scale.displaySize` meldete
   * weiterhin 960, während die Leinwand auf dem iPhone tatsächlich 390 breit
   * war. Wer damit rechnet, zielt daneben.
   */
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [GameScene],
};

// Am Fenster hinterlegt, damit sich der laufende Stand von außen ansehen lässt:
// aus der Safari-Konsole beim Debuggen am iPad und aus dem Browser-Test heraus.
window.spiel = new Phaser.Game(config);

/**
 * Der Querformat-Hinweis verschwindet beim ersten Tipp und kommt in dieser
 * Sitzung nicht wieder. Beim Drehen blendet ihn die Medienabfrage im
 * Stylesheet von selbst aus — dafür braucht es kein JavaScript.
 */
(() => {
  const hinweis = document.getElementById('dreh-hinweis');
  if (!hinweis) return;

  const wegblenden = () => hinweis.classList.add('weg');

  // `once` reicht: Wer einmal getippt hat, weiß Bescheid.
  window.addEventListener('pointerdown', wegblenden, { once: true });
  window.addEventListener('touchstart', wegblenden, { once: true, passive: true });
})();
