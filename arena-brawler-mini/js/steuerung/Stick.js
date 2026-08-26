/**
 * Virtueller Stick für die Touch-Steuerung.
 *
 * Er erscheint dort, wo der Finger aufsetzt, statt an einem festen Platz zu
 * kleben. Einen festen Stick trifft man auf einem Tablet nur, wenn man
 * hinsieht — und hinsehen muss man aufs Spielfeld, nicht auf den Daumen.
 * Der Kreis im Bild ist deshalb nur ein Hinweis, kein Ziel, das man treffen
 * muss.
 */
class Stick {
  constructor(scene, { radius = 70, totzone = 10 } = {}) {
    this.scene = scene;
    this.radius = radius;
    this.totzone = totzone;

    this.zeigerId = null;
    this.abgeschaltet = false;
    this.richtung = { x: 0, y: 0 };

    // Sichtbarer Teil: äußerer Ring als Fassung, innerer Punkt als Griff.
    // scrollFactor 0 und eine hohe Tiefe halten ihn über allem und unabhängig
    // von einer späteren Kamerafahrt.
    this.fassung = scene.add.circle(0, 0, radius, 0xffffff, 0.08);
    this.fassung.setStrokeStyle(2, 0xffffff, 0.35);
    this.griff = scene.add.circle(0, 0, radius * 0.42, 0xffffff, 0.5);

    [this.fassung, this.griff].forEach((teil) => {
      teil.setScrollFactor(0);
      teil.setDepth(1000);
      teil.setVisible(false);
    });

    scene.input.on('pointerdown', this.beiAufsetzen, this);
    scene.input.on('pointermove', this.beiBewegung, this);
    scene.input.on('pointerup', this.beiAbheben, this);
    scene.input.on('pointerupoutside', this.beiAbheben, this);

    // Beim Szenenwechsel die Listener wieder abräumen, sonst zeigen sie nach
    // einem Neustart auf eine Szene, die es nicht mehr gibt.
    scene.events.once('shutdown', () => this.aufraeumen());
  }

  beiAufsetzen(zeiger) {
    if (this.abgeschaltet || this.zeigerId !== null) return;

    this.zeigerId = zeiger.id;
    this.fassung.setPosition(zeiger.x, zeiger.y);
    this.griff.setPosition(zeiger.x, zeiger.y);
    this.fassung.setVisible(true);
    this.griff.setVisible(true);
  }

  beiBewegung(zeiger) {
    if (zeiger.id !== this.zeigerId) return;

    const dx = zeiger.x - this.fassung.x;
    const dy = zeiger.y - this.fassung.y;
    const laenge = Math.hypot(dx, dy);

    if (laenge < this.totzone) {
      this.griff.setPosition(this.fassung.x, this.fassung.y);
      this.richtung = { x: 0, y: 0 };
      return;
    }

    const gekappt = Math.min(laenge, this.radius);
    this.griff.setPosition(
      this.fassung.x + (dx / laenge) * gekappt,
      this.fassung.y + (dy / laenge) * gekappt,
    );

    // Volles Tempo schon bei 70 % Ausschlag. Ein Kind zieht den Daumen selten
    // bis an den Rand, und halb so schnell zu laufen, ohne es zu merken, ist
    // die häufigste Enttäuschung an einem streng proportionalen Stick.
    const staerke = Math.min(1, gekappt / (this.radius * 0.7));
    this.richtung = { x: (dx / laenge) * staerke, y: (dy / laenge) * staerke };
  }

  beiAbheben(zeiger) {
    if (zeiger.id !== this.zeigerId) return;

    this.zeigerId = null;
    this.richtung = { x: 0, y: 0 };
    this.fassung.setVisible(false);
    this.griff.setVisible(false);
  }

  get istAktiv() {
    return !this.abgeschaltet && this.zeigerId !== null;
  }

  /**
   * Steuerung stilllegen, ohne die Listener abzuräumen — beim Game Over soll
   * die nächste Berührung den Neustart auslösen und nicht noch einen Stick
   * unter dem Overlay aufblenden lassen.
   */
  abschalten() {
    this.abgeschaltet = true;
    this.zeigerId = null;
    this.richtung = { x: 0, y: 0 };
    this.fassung.setVisible(false);
    this.griff.setVisible(false);
  }

  aufraeumen() {
    this.scene.input.off('pointerdown', this.beiAufsetzen, this);
    this.scene.input.off('pointermove', this.beiBewegung, this);
    this.scene.input.off('pointerup', this.beiAbheben, this);
    this.scene.input.off('pointerupoutside', this.beiAbheben, this);
  }
}
