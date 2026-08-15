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
 *
 * **Was eine Textur räumlich macht, ist nicht das Muster, sondern die
 * eingebackene Beleuchtung.** Ein Fensterraster aus gleichmäßigen Rechtecken
 * bleibt flach. Erst ein heller Rand links, ein dunkler rechts und ein Sims
 * mit Schattenkante darunter lassen dieselbe Fläche gegliedert aussehen. Alle
 * Funktionen hier arbeiten deshalb mit Licht von **oben links** — dieselbe
 * Richtung wie die Sonne in `szene.ts`. Wer die dreht, muss hier mitdrehen.
 */

/** Legt eine Zeichenfläche an und gibt Fläche und Werkzeug zurück. */
function flaeche(breite: number, hoehe: number) {
  const leinwand = document.createElement('canvas');
  leinwand.width = breite;
  leinwand.height = hoehe;
  const stift = leinwand.getContext('2d')!;
  return { leinwand, stift };
}

/**
 * Fester Zufall aus einer Startzahl.
 *
 * `Math.random` ist im Projekt tabu — sonst sähe jede Wand bei jedem Laden
 * anders aus. Der frühere Griff (`(i * 97) % 256`) sah zwar zufällig aus, war
 * es aber nicht: Beide Achsen wiederholen sich nach 256 Schritten, es kamen
 * also aus 2600 Durchläufen nur 256 verschiedene Punkte heraus — der Asphalt
 * hatte in Wahrheit ein sichtbares Gitter statt einer Körnung.
 */
function wuerfel(saat: number) {
  let z = saat >>> 0;
  return () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
}

function alsTextur(leinwand: HTMLCanvasElement, wiederholenX = 1, wiederholenY = 1): THREE.Texture {
  const t = new THREE.CanvasTexture(leinwand);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(wiederholenX, wiederholenY);
  t.colorSpace = THREE.SRGBColorSpace;
  // Etwas Schärfe schräg zur Blickrichtung — ohne das verwaschen Fenster
  // und Fahrbahnmarkierung in der Ferne zu Grau.
  t.anisotropy = 8;
  return t;
}

/**
 * Eine Hauswand mit Fenstern.
 *
 * Drei Griffe machen aus dem früheren Rastermuster eine Fassade:
 *
 * 1. **Senkrechte Pfeiler.** Über jede Fensterachse liegt ein Verlauf von
 *    hell nach dunkel. Dadurch hat die Wand Vor- und Rücksprünge, ohne dass
 *    ein einziger zusätzlicher Körper gebaut werden muss.
 * 2. **Glas spiegelt.** Ein dunkles Fenster ist kein grauer Fleck, sondern
 *    ein Verlauf mit einem hellen Schrägstrich darin — so, wie sich der
 *    Himmel in einer Scheibe bricht.
 * 3. **Jedes Fenster hat einen Sims** mit heller Oberkante und dunklem
 *    Schatten darunter. Das ist die billigste Tiefe, die es gibt.
 */
export function hauswandTextur(grundfarbe: string, fensterfarbe: string): THREE.Texture {
  const B = 256;
  const H = 256;
  const ACHSEN = 4;
  const GESCHOSSE = 8;
  const { leinwand, stift } = flaeche(B, H);

  stift.fillStyle = grundfarbe;
  stift.fillRect(0, 0, B, H);

  // Feine Betonkörnung, damit die Fläche zwischen den Fenstern nicht tot ist.
  const w = wuerfel(0x5eed);
  for (let i = 0; i < 4200; i++) {
    stift.fillStyle = w() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    stift.fillRect(Math.floor(w() * B), Math.floor(w() * H), 2, 2);
  }

  const bahn = B / ACHSEN;
  for (let s = 0; s < ACHSEN; s++) {
    const x = s * bahn;
    const v = stift.createLinearGradient(x, 0, x + bahn, 0);
    v.addColorStop(0, 'rgba(255,255,255,0.14)');
    v.addColorStop(0.3, 'rgba(255,255,255,0.02)');
    v.addColorStop(0.72, 'rgba(0,0,0,0.06)');
    v.addColorStop(1, 'rgba(0,0,0,0.22)');
    stift.fillStyle = v;
    stift.fillRect(x, 0, bahn, H);
  }

  const geschoss = H / GESCHOSSE;
  for (let z = 0; z < GESCHOSSE; z++) {
    const y = z * geschoss;
    stift.fillStyle = 'rgba(0,0,0,0.20)';
    stift.fillRect(0, y, B, 2);
    stift.fillStyle = 'rgba(255,255,255,0.12)';
    stift.fillRect(0, y + 2, B, 2);
  }

  const fb = 36;
  const fh = 19;
  for (let z = 0; z < GESCHOSSE; z++) {
    for (let s = 0; s < ACHSEN; s++) {
      const x = s * bahn + (bahn - fb) / 2;
      const y = z * geschoss + (geschoss - fh) / 2 + 1;
      // Feste Streuung: dieselbe Wand sieht immer gleich aus.
      const wert = (s * 7 + z * 13 + s * z * 3) % 10;

      // Laibung — der dunkle Rahmen setzt das Fenster in die Wand hinein.
      stift.fillStyle = 'rgba(10,14,20,0.85)';
      stift.fillRect(x - 2, y - 2, fb + 4, fh + 4);

      if (wert < 3) {
        // Beleuchtet: warm, oben heller (Deckenlampe).
        const g = stift.createLinearGradient(x, y, x, y + fh);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, fensterfarbe);
        g.addColorStop(1, fensterfarbe);
        stift.fillStyle = g;
        stift.fillRect(x, y, fb, fh);
      } else {
        const dunkel = wert < 6;
        const g = stift.createLinearGradient(x, y, x, y + fh);
        g.addColorStop(0, dunkel ? '#1b2836' : '#31536f');
        g.addColorStop(0.5, dunkel ? '#2c4258' : '#5f8bab');
        g.addColorStop(1, dunkel ? '#121b26' : '#22384c');
        stift.fillStyle = g;
        stift.fillRect(x, y, fb, fh);
        // Der Schrägstrich ist die Spiegelung. Ohne ihn ist ein Fenster ein Loch.
        stift.save();
        stift.beginPath();
        stift.rect(x, y, fb, fh);
        stift.clip();
        stift.fillStyle = 'rgba(255,255,255,0.17)';
        stift.beginPath();
        stift.moveTo(x - 2, y + fh);
        stift.lineTo(x + fb * 0.45, y - 2);
        stift.lineTo(x + fb * 0.7, y - 2);
        stift.lineTo(x + fb * 0.2, y + fh);
        stift.closePath();
        stift.fill();
        stift.restore();
      }

      // Mittelsprosse
      stift.fillStyle = 'rgba(10,14,20,0.55)';
      stift.fillRect(x + fb / 2 - 1, y, 2, fh);

      // Sims: helle Oberkante, dunkler Schatten darunter.
      stift.fillStyle = 'rgba(255,255,255,0.30)';
      stift.fillRect(x - 3, y + fh + 2, fb + 6, 3);
      stift.fillStyle = 'rgba(0,0,0,0.28)';
      stift.fillRect(x - 3, y + fh + 5, fb + 6, 3);
    }
  }

  return alsTextur(leinwand, 1, 1);
}

/**
 * Das Erdgeschoss: Schaufenster, Markisen, Türen.
 *
 * Ein Hochhaus, das bis auf den Gehweg dasselbe Fensterraster hat, sieht aus
 * wie ein Klotz, der im Boden steckt. Der Sockel ist die Stelle, an der ein
 * Haus die Straße berührt — und die Stelle, die beim Vorbeilaufen am
 * nächsten an der Kamera ist.
 */
export function sockelTextur(): THREE.Texture {
  const B = 256;
  const H = 128;
  const { leinwand, stift } = flaeche(B, H);

  stift.fillStyle = '#4c5561';
  stift.fillRect(0, 0, B, H);

  const laeden = ['#b4453f', '#2f6f70', '#8a5a2b', '#3d5a8a'];
  const breite = B / 4;
  for (let i = 0; i < 4; i++) {
    const x = i * breite;

    // Schaufenster
    const g = stift.createLinearGradient(x, 24, x, H - 10);
    g.addColorStop(0, '#0e161f');
    g.addColorStop(0.45, '#33556e');
    g.addColorStop(1, '#0b1119');
    stift.fillStyle = g;
    stift.fillRect(x + 8, 26, breite - 16, H - 36);

    // Warmes Licht im Laden
    stift.fillStyle = 'rgba(255,214,140,0.5)';
    stift.fillRect(x + 14, 34, breite - 28, 16);

    // Rahmen
    stift.strokeStyle = 'rgba(12,16,22,0.9)';
    stift.lineWidth = 4;
    stift.strokeRect(x + 8, 26, breite - 16, H - 36);

    // Markise über dem Laden
    stift.fillStyle = laeden[i]!;
    stift.fillRect(x + 4, 8, breite - 8, 18);
    stift.fillStyle = 'rgba(0,0,0,0.28)';
    for (let s = 0; s < breite - 8; s += 14) stift.fillRect(x + 4 + s, 8, 7, 18);
    // Schatten unter der Markise — das ist, was sie vorspringen lässt.
    stift.fillStyle = 'rgba(0,0,0,0.45)';
    stift.fillRect(x + 4, 26, breite - 8, 7);
  }

  // Sockelband unten (Naturstein)
  stift.fillStyle = '#39414c';
  stift.fillRect(0, H - 12, B, 12);
  stift.fillStyle = 'rgba(255,255,255,0.10)';
  stift.fillRect(0, H - 12, B, 2);

  return alsTextur(leinwand, 1, 1);
}

/**
 * Der Asphalt — nur Belag, **ohne** Fahrbahnmarkierung.
 *
 * Getrennt, weil beides eine völlig andere Wiederholrate braucht: Die Körnung
 * muss alle paar Meter neu anfangen, damit sie überhaupt als Körnung zu
 * erkennen ist; ein gestrichelter Mittelstreifen alle paar Meter wäre dagegen
 * ein Flimmerteppich. Vorher steckte beides in einer Textur, und weil die
 * Streifen den Takt vorgaben, war ein Kachelbild 25 Meter lang — die Körnung
 * darin zu riesigen Flecken auseinandergezogen.
 */
export function asphaltTextur(): THREE.Texture {
  const B = 256;
  const H = 256;
  const { leinwand, stift } = flaeche(B, H);

  stift.fillStyle = '#565c66';
  stift.fillRect(0, 0, B, H);

  const w = wuerfel(0xa5f0);

  // Große, weiche Tonwertflecken: unterschiedlich alter Belag.
  for (let i = 0; i < 26; i++) {
    const x = w() * B;
    const y = w() * H;
    const r = 18 + w() * 46;
    const g = stift.createRadialGradient(x, y, 0, x, y, r);
    const hell = w() < 0.5;
    g.addColorStop(0, hell ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    stift.fillStyle = g;
    stift.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Der eigentliche Grus.
  for (let i = 0; i < 9000; i++) {
    const t = w();
    stift.fillStyle =
      t < 0.18
        ? 'rgba(255,255,255,0.07)'
        : t < 0.34
          ? 'rgba(210,220,232,0.05)'
          : t < 0.7
            ? 'rgba(0,0,0,0.10)'
            : 'rgba(0,0,0,0.05)';
    const s = w() < 0.75 ? 1 : 2;
    stift.fillRect(Math.floor(w() * B), Math.floor(w() * H), s, s);
  }

  // Ein paar Risse. Sie laufen quer, damit sie beim Vorbeiziehen auffallen.
  stift.strokeStyle = 'rgba(0,0,0,0.22)';
  stift.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    let x = w() * B;
    let y = w() * H;
    stift.beginPath();
    stift.moveTo(x, y);
    for (let s = 0; s < 7; s++) {
      x += (w() - 0.5) * 40;
      y += (w() - 0.3) * 22;
      stift.lineTo(x, y);
    }
    stift.stroke();
  }

  return alsTextur(leinwand, 2, 1);
}

/**
 * Die Fahrbahnmarkierung — **durchsichtig**, liegt als eigene Ebene knapp
 * über dem Asphalt.
 *
 * `spuren` sind die Anteile der Straßenbreite, an denen eine gestrichelte
 * Trennlinie liegt. Eine Kachel entspricht genau einem Strich-Lücke-Takt.
 */
export function markierungTextur(spuren: readonly number[]): THREE.Texture {
  const B = 256;
  const H = 256;
  const { leinwand, stift } = flaeche(B, H);

  // Gestrichelte Trennlinien: Strich über die obere Hälfte, Lücke darunter.
  for (const anteil of spuren) {
    const x = anteil * B;
    const g = stift.createLinearGradient(0, 0, 0, H * 0.5);
    g.addColorStop(0, 'rgba(240,238,226,0.94)');
    g.addColorStop(1, 'rgba(240,238,226,0.94)');
    stift.fillStyle = g;
    stift.fillRect(x - 3.5, 0, 7, H * 0.5);
    // Abgefahrene Kante — eine gestochen scharfe Markierung wirkt aufgeklebt.
    stift.fillStyle = 'rgba(120,124,120,0.35)';
    stift.fillRect(x - 4.5, 0, 1.5, H * 0.5);
    stift.fillRect(x + 3, 0, 1.5, H * 0.5);
  }

  // Durchgezogene Randlinien.
  stift.fillStyle = 'rgba(238,236,224,0.88)';
  stift.fillRect(5, 0, 5, H);
  stift.fillRect(B - 10, 0, 5, H);

  const t = new THREE.CanvasTexture(leinwand);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Gehweg neben der Straße — Platten mit Fugen und leichter Tonwertstreuung. */
export function gehwegTextur(): THREE.Texture {
  const B = 128;
  const H = 128;
  const { leinwand, stift } = flaeche(B, H);
  stift.fillStyle = '#bdb9b0';
  stift.fillRect(0, 0, B, H);

  const w = wuerfel(0x31c7);
  const platte = B / 4;
  for (let zy = 0; zy < 4; zy++) {
    for (let zx = 0; zx < 4; zx++) {
      const t = w();
      stift.fillStyle =
        t < 0.33 ? 'rgba(255,255,255,0.10)' : t < 0.66 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.10)';
      stift.fillRect(zx * platte, zy * platte, platte, platte);
    }
  }

  // Körnung
  for (let i = 0; i < 3000; i++) {
    stift.fillStyle = w() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    stift.fillRect(Math.floor(w() * B), Math.floor(w() * H), 2, 2);
  }

  // Fugen: dunkler Schnitt mit heller Kante darunter — auch hier Licht von oben.
  for (let i = 0; i <= 4; i++) {
    const p = i * platte;
    stift.fillStyle = 'rgba(0,0,0,0.30)';
    stift.fillRect(0, p, B, 2);
    stift.fillRect(p, 0, 2, H);
    stift.fillStyle = 'rgba(255,255,255,0.22)';
    stift.fillRect(0, p + 2, B, 1);
    stift.fillRect(p + 2, 0, 1, H);
  }

  return alsTextur(leinwand, 1, 1);
}

/**
 * Ein Wellblech-Container (das Hindernis „Mauer").
 *
 * Die Rippen sind hier eingebacken statt aus vier zusätzlichen Körpern
 * gebaut — dieselbe Wirkung, ein Viertel der Zeichenlast, und die Kanten
 * flimmern nicht.
 */
export function containerTextur(farbe: string): THREE.Texture {
  const B = 128;
  const H = 128;
  const { leinwand, stift } = flaeche(B, H);

  stift.fillStyle = farbe;
  stift.fillRect(0, 0, B, H);

  /*
   * Wellblech: Licht auf der linken Flanke jeder Rippe, Schatten rechts.
   *
   * **Die Stärke ist hier entscheidend, nicht das Muster.** Der erste
   * Versuch ging bis 30 % Schwarz und 22 % Weiß je Rippe — bei einem warmen
   * Rotton ergibt das über die ganze Fläche gemittelt ein stumpfes Braun,
   * und das Hindernis sah aus wie eine Holzkiste statt wie ein Container.
   * Die halbe Stärke reicht für die Wölbung und lässt die Farbe stehen.
   */
  const rippe = 16;
  for (let x = 0; x < B; x += rippe) {
    const g = stift.createLinearGradient(x, 0, x + rippe, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.15)');
    g.addColorStop(0.24, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    stift.fillStyle = g;
    stift.fillRect(x, 0, rippe, H);
  }

  // Ober- und Unterholm
  for (const y of [0, H - 12]) {
    stift.fillStyle = 'rgba(24,28,36,0.42)';
    stift.fillRect(0, y, B, 12);
    stift.fillStyle = 'rgba(255,255,255,0.16)';
    stift.fillRect(0, y, B, 2);
  }

  // Ein paar Gebrauchsspuren — sparsam, sie sollen den Farbton nicht kippen.
  const w = wuerfel(0x7b21);
  for (let i = 0; i < 22; i++) {
    const x = w() * B;
    const y = 16 + w() * (H - 34);
    const r = 3 + w() * 8;
    const g = stift.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(48,26,12,0.2)');
    g.addColorStop(1, 'rgba(48,26,12,0)');
    stift.fillStyle = g;
    stift.fillRect(x - r, y - r, r * 2, r * 2);
  }

  return alsTextur(leinwand, 1, 1);
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
  verlauf.addColorStop(0, '#1f6fc6');
  verlauf.addColorStop(0.42, '#5cb0e8');
  verlauf.addColorStop(0.78, '#a9dcf4');
  verlauf.addColorStop(1, '#e6f5fb');
  stift.fillStyle = verlauf;
  stift.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Eine Wolke als weiche Ansammlung von Ballen.
 *
 * Wolken sind hier kein Zierrat: Zwischen den Häuserzeilen steht ein breiter
 * Streifen Himmel, und ein völlig leerer Streifen nimmt dem Bild oben die
 * Tiefe. Weil sie langsamer vorbeiziehen als die Häuser, entsteht nebenbei
 * eine zweite Bewegungsebene — der billigste Tiefeneindruck überhaupt.
 */
export function wolkeTextur(saat: number): THREE.Texture {
  const B = 256;
  const H = 128;
  const { leinwand, stift } = flaeche(B, H);
  const w = wuerfel(saat);

  for (let i = 0; i < 14; i++) {
    const x = 40 + w() * (B - 80);
    const y = 52 + (w() - 0.5) * 34;
    const r = 22 + w() * 32;
    const g = stift.createRadialGradient(x, y - r * 0.25, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(246,251,255,0.62)');
    g.addColorStop(1, 'rgba(226,241,250,0)');
    stift.fillStyle = g;
    stift.fillRect(x - r, y - r, r * 2, r * 2);
  }

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
  verlauf.addColorStop(0, 'rgba(0,0,0,0.62)');
  verlauf.addColorStop(0.5, 'rgba(0,0,0,0.32)');
  verlauf.addColorStop(1, 'rgba(0,0,0,0)');
  stift.fillStyle = verlauf;
  stift.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Der Schlagschatten der Häuserzeile auf die Fahrbahn.
 *
 * Ohne ihn schwebt die Straße zwischen den Gehwegen: Nichts verbindet die
 * Häuser mit dem Boden, auf dem sie stehen. Ein Verlauf von dunkel am
 * Bordstein nach durchsichtig zur Straßenmitte kostet zwei Flächen und
 * erdet das ganze Bild.
 */
export function randschattenTextur(): THREE.Texture {
  const { leinwand, stift } = flaeche(128, 4);
  // Beidseitig symmetrisch, damit **eine** Fläche über die ganze Straße
  // reicht statt zweier gespiegelter an den Rändern.
  const verlauf = stift.createLinearGradient(0, 0, 128, 0);
  verlauf.addColorStop(0, 'rgba(10,18,30,0.55)');
  verlauf.addColorStop(0.16, 'rgba(10,18,30,0.26)');
  verlauf.addColorStop(0.42, 'rgba(10,18,30,0)');
  verlauf.addColorStop(0.58, 'rgba(10,18,30,0)');
  verlauf.addColorStop(0.84, 'rgba(10,18,30,0.26)');
  verlauf.addColorStop(1, 'rgba(10,18,30,0.55)');
  stift.fillStyle = verlauf;
  stift.fillRect(0, 0, 128, 4);
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
  // Oben ein Lichtsaum, unten ein Schatten — auch ein Brett ist nicht flach.
  stift.fillStyle = 'rgba(255,255,255,0.25)';
  stift.fillRect(0, 0, 64, 3);
  stift.fillStyle = 'rgba(0,0,0,0.30)';
  stift.fillRect(0, 28, 64, 4);
  stift.restore();
  return alsTextur(leinwand, 2, 1);
}

/**
 * Die Stirnseite einer Münze.
 *
 * Eine Münze ist eine **Scheibe mit Prägung**, kein Donut. Der Ring aus
 * Torusgeometrie sah aus dieser Kameraperspektive genau danach aus.
 */
export function muenzTextur(): THREE.Texture {
  const S = 128;
  const { leinwand, stift } = flaeche(S, S);
  const m = S / 2;

  const g = stift.createRadialGradient(m - 18, m - 22, 4, m, m, m);
  g.addColorStop(0, '#fff6c9');
  g.addColorStop(0.42, '#fbcf3a');
  g.addColorStop(0.82, '#e0a213');
  g.addColorStop(1, '#a9720a');
  stift.fillStyle = g;
  stift.beginPath();
  stift.arc(m, m, m, 0, Math.PI * 2);
  stift.fill();

  // Vertiefter Innenkreis
  stift.strokeStyle = 'rgba(120,78,6,0.55)';
  stift.lineWidth = 5;
  stift.beginPath();
  stift.arc(m, m, m * 0.72, 0, Math.PI * 2);
  stift.stroke();
  stift.strokeStyle = 'rgba(255,247,205,0.6)';
  stift.lineWidth = 2;
  stift.beginPath();
  stift.arc(m, m, m * 0.72 + 3.5, 0, Math.PI * 2);
  stift.stroke();

  // Stern in der Mitte
  stift.fillStyle = 'rgba(122,80,8,0.6)';
  stift.beginPath();
  for (let i = 0; i < 10; i++) {
    const winkel = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? m * 0.44 : m * 0.19;
    const x = m + Math.cos(winkel) * r;
    const y = m + Math.sin(winkel) * r;
    if (i === 0) stift.moveTo(x, y);
    else stift.lineTo(x, y);
  }
  stift.closePath();
  stift.fill();

  // Glanzpunkt oben links — dieselbe Lichtrichtung wie überall.
  const glanz = stift.createRadialGradient(m - 26, m - 30, 0, m - 26, m - 30, 30);
  glanz.addColorStop(0, 'rgba(255,255,255,0.85)');
  glanz.addColorStop(1, 'rgba(255,255,255,0)');
  stift.fillStyle = glanz;
  stift.fillRect(0, 0, S, S);

  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
