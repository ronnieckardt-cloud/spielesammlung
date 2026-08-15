import * as THREE from 'three';

/**
 * Texturen — **im Code gezeichnet, keine Bilddateien.**
 *
 * Das ist keine Sparsamkeit um ihrer selbst willen: Die App muss offline
 * laufen und ohne fremde Dateien auskommen, und jede zusätzliche Datei
 * müsste in den Service-Worker-Vorrat, könnte fehlschlagen und würde die
 * erste Ladezeit verlängern. Ein paar hundert Zeilen Zeichenbefehle wiegen
 * dagegen nichts.
 *
 * Texturen sind der größte Einzelsprung in der Bildqualität. Eine einfarbige
 * Hauswand sieht nach Klotz aus; dieselbe Wand mit Fenstern sieht nach Stadt
 * aus — und kostet an Rechenzeit praktisch nichts, weil das Bild einmal
 * gezeichnet und dann nur noch wiederholt wird.
 */

/** Legt eine Zeichenfläche an und gibt Fläche und Werkzeug zurück. */
function flaeche(breite: number, hoehe: number) {
  const leinwand = document.createElement('canvas');
  leinwand.width = breite;
  leinwand.height = hoehe;
  const stift = leinwand.getContext('2d')!;
  return { leinwand, stift };
}

function alsTextur(leinwand: HTMLCanvasElement, wiederholenX = 1, wiederholenY = 1): THREE.Texture {
  const t = new THREE.CanvasTexture(leinwand);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(wiederholenX, wiederholenY);
  t.colorSpace = THREE.SRGBColorSpace;
  // Etwas Schärfe schräg zur Blickrichtung — ohne das verwaschen Fenster
  // und Fahrbahnmarkierung in der Ferne zu Grau.
  t.anisotropy = 4;
  return t;
}

/**
 * Eine Hauswand mit Fenstern.
 *
 * Die Fenster sind unterschiedlich hell — manche beleuchtet, manche dunkel.
 * Das ist der Unterschied zwischen „Klotz mit Rastermuster" und „Haus, in
 * dem jemand wohnt". Die Verteilung kommt aus einer festen Rechnung, nicht
 * aus Zufall: Sonst sähe jede Wand bei jedem Laden anders aus.
 */
export function hauswandTextur(grundfarbe: string, fensterfarbe: string): THREE.Texture {
  const { leinwand, stift } = flaeche(128, 256);

  stift.fillStyle = grundfarbe;
  stift.fillRect(0, 0, 128, 256);

  // Leichte senkrechte Streifen — Betonplatten.
  stift.fillStyle = 'rgba(0,0,0,0.05)';
  for (let x = 0; x < 128; x += 32) stift.fillRect(x, 0, 1, 256);

  const spalten = 4;
  const zeilen = 8;
  const breite = 18;
  const hoehe = 22;
  for (let z = 0; z < zeilen; z++) {
    for (let s = 0; s < spalten; s++) {
      const x = 12 + s * 28;
      const y = 8 + z * 30;
      // Feste Streuung: dieselbe Wand sieht immer gleich aus.
      const wert = (s * 7 + z * 13 + s * z * 3) % 10;
      stift.fillStyle = wert < 3 ? fensterfarbe : wert < 6 ? 'rgba(20,28,40,0.75)' : 'rgba(90,110,130,0.5)';
      stift.fillRect(x, y, breite, hoehe);
      // Fensterbrett — gibt der Fläche Tiefe.
      stift.fillStyle = 'rgba(255,255,255,0.16)';
      stift.fillRect(x - 1, y + hoehe, breite + 2, 2);
    }
  }

  return alsTextur(leinwand, 1, 1);
}

/**
 * Der Straßenbelag samt Mittelstreifen.
 *
 * **Der eigentliche Gewinn ist nicht die Optik, sondern die Rechenzeit.**
 * Vorher waren die Fahrbahnstreifen zweiundfünfzig einzelne Körper, die
 * jedes Bild einzeln umgesetzt wurden. Jetzt sind sie Teil der Textur, und
 * das Vorbeiziehen entsteht dadurch, dass die Textur verschoben wird —
 * eine einzige Zahl je Bild statt zweiundfünfzig Positionen.
 *
 * `spuren` legt fest, wo die Trennlinien liegen (Anteil der Breite).
 */
export function strassenTextur(spuren: readonly number[]): THREE.Texture {
  const B = 256;
  const H = 256;
  const { leinwand, stift } = flaeche(B, H);

  stift.fillStyle = '#5c6470';
  stift.fillRect(0, 0, B, H);

  // Feiner Asphaltgrus. Fest gerechnet, nicht gewürfelt.
  for (let i = 0; i < 2600; i++) {
    const x = (i * 97) % B;
    const y = (i * 61) % H;
    const hell = (i * 31) % 5 < 2;
    stift.fillStyle = hell ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    stift.fillRect(x, y, 2, 2);
  }

  // Die gestrichelten Trennlinien.
  stift.fillStyle = '#f4f1e4';
  for (const anteil of spuren) {
    const x = anteil * B;
    for (let y = 0; y < H; y += 64) stift.fillRect(x - 2.5, y, 5, 34);
  }

  // Durchgezogene Randlinien.
  stift.fillStyle = 'rgba(244,241,228,0.85)';
  stift.fillRect(4, 0, 4, H);
  stift.fillRect(B - 8, 0, 4, H);

  return alsTextur(leinwand, 1, 8);
}

/** Gehweg neben der Straße — Platten mit Fugen. */
export function gehwegTextur(): THREE.Texture {
  const { leinwand, stift } = flaeche(64, 64);
  stift.fillStyle = '#c9c6bd';
  stift.fillRect(0, 0, 64, 64);
  stift.strokeStyle = 'rgba(0,0,0,0.18)';
  stift.lineWidth = 2;
  for (let i = 0; i <= 64; i += 32) {
    stift.beginPath();
    stift.moveTo(0, i);
    stift.lineTo(64, i);
    stift.moveTo(i, 0);
    stift.lineTo(i, 64);
    stift.stroke();
  }
  return alsTextur(leinwand, 1, 20);
}

/**
 * Der Himmel als senkrechter Verlauf.
 *
 * Ein einfarbiger Hintergrund verrät sofort, dass die Welt aufhört. Ein
 * Verlauf von hellem Horizontblau nach oben ins kräftige Blau liest sich
 * als Tiefe — derselbe Griff wie der Nebel, nur für die obere Hälfte.
 */
export function himmelTextur(): THREE.Texture {
  const { leinwand, stift } = flaeche(4, 256);
  const verlauf = stift.createLinearGradient(0, 0, 0, 256);
  verlauf.addColorStop(0, '#2f7fd4');
  verlauf.addColorStop(0.55, '#79c4ef');
  verlauf.addColorStop(0.86, '#c9e9f8');
  verlauf.addColorStop(1, '#eaf6fc');
  stift.fillStyle = verlauf;
  stift.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Ein weicher Schattenfleck.
 *
 * Echte Schattenwürfe wären auf dem alten iPad die teuerste Einzelsache der
 * ganzen Szene. Ein Fleck mit weichem Rand liefert neunzig Prozent der
 * Wirkung — der harte Kreis davor sah dagegen aus wie ein aufgeklebter
 * Aufkleber.
 */
export function schattenTextur(): THREE.Texture {
  const { leinwand, stift } = flaeche(64, 64);
  const verlauf = stift.createRadialGradient(32, 32, 0, 32, 32, 32);
  verlauf.addColorStop(0, 'rgba(0,0,0,0.55)');
  verlauf.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  verlauf.addColorStop(1, 'rgba(0,0,0,0)');
  stift.fillStyle = verlauf;
  stift.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Warnstreifen für Absperrungen — schräge Balken, wie auf der Baustelle. */
export function warnTextur(farbe: string): THREE.Texture {
  const { leinwand, stift } = flaeche(64, 32);
  stift.fillStyle = farbe;
  stift.fillRect(0, 0, 64, 32);
  stift.fillStyle = 'rgba(255,255,255,0.92)';
  stift.save();
  stift.beginPath();
  stift.rect(0, 0, 64, 32);
  stift.clip();
  for (let x = -32; x < 96; x += 24) {
    stift.beginPath();
    stift.moveTo(x, 32);
    stift.lineTo(x + 12, 32);
    stift.lineTo(x + 12 + 20, 0);
    stift.lineTo(x + 20, 0);
    stift.closePath();
    stift.fill();
  }
  stift.restore();
  return alsTextur(leinwand, 2, 1);
}
