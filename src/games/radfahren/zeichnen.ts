import { ANLAUF, bodenHoehe } from './logik';
import type { Lauf } from './logik';

/**
 * Flow MTB — die Darstellung. **Enthält keine einzige Spielregel.**
 *
 * Sie bekommt einen `Lauf` gereicht und zeichnet ihn. Alles Rechnende
 * steht in `logik.ts` und ist ohne Browser geprüft — dieselbe Trennung wie
 * bei Dash City (`szene.ts`), und aus demselben Grund: Läge die Physik im
 * Zeichencode, wäre sie der Prüfung entzogen.
 *
 * **Warum Canvas und nicht SVG.** Alle anderen Spiele hier zeichnen SVG,
 * und für Raster und Karten ist das richtig. Ein durchgehendes Gelände ist
 * es nicht: Der Geländeumriss allein sind mehrere hundert Punkte, die sich
 * in **jedem** Bild ändern. Als SVG hieße das, sechzigmal je Sekunde einen
 * mehrere Kilobyte langen Pfad-String zu bauen und den DOM-Knoten
 * auszutauschen. `CLAUDE.md` sieht für Spiele mit fortlaufender Bewegung
 * ohnehin Canvas vor — dies ist das erste, das es wirklich braucht.
 *
 * Was hier eigenen Zustand hat und **nicht** in `logik.ts` gehört: die
 * Federung, die Raddrehung, der Staub und die Kamera. Das ist alles reine
 * Optik — es beeinflusst nichts, was über Sieg oder Niederlage entscheidet,
 * und hätte in der geprüften Logik nichts zu suchen.
 */

export type Zeichner = {
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
};

/*
 * Die Farben.
 *
 * Das Bike war zuerst schwarz — Rückmeldung: „Das Fahrrad ist ein
 * kompletter Reinfall, das ist ein Fahrrad mit drei Strichen … Macht das
 * Fahrrad rot." Rot ist dabei nicht nur Geschmack: Ein schwarzer Rahmen
 * vor dunklem Waldhintergrund verschwindet, und alles, was man dann noch
 * sieht, sind die Umrisse — genau der „drei Striche"-Eindruck. Rot trennt
 * das Rad vom Hintergrund, und erst dadurch werden die Einzelteile
 * überhaupt als Fahrrad lesbar.
 */
const FARBEN = {
  himmelOben: '#1b3a5c',
  himmelUnten: '#7fb2d4',
  bergFern: '#2f4a63',
  bergNah: '#28405a',
  huegel: '#1f3a2c',
  bodenOben: '#4a7c3f',
  bodenTief: '#2a1f16',
  bodenKante: '#6ea653',
  baum: '#14301f',
  /** Rahmen in drei Tönen — Grundfläche, Lichtkante, Schattenkante. */
  rahmen: '#d92d20',
  rahmenHell: '#ff6b5e',
  rahmenDunkel: '#8c1710',
  /** Federelemente: helles Standrohr, dunkles Tauchrohr. */
  federHell: '#c9ced6',
  federDunkel: '#3d434d',
  reifen: '#16161a',
  profil: '#26262c',
  felge: '#8d939e',
  nabe: '#c3c8d0',
  helm: '#f4f6f8',
  helmSchatten: '#c9ced6',
  visier: '#1e2a33',
  /*
   * Das Trikot war zuerst fast schwarz (#1b1b22) — vor dem dunklen
   * Waldhintergrund verschmolz der Fahrer damit zu einem Klumpen, an dem
   * nur der Helm zu erkennen war. Ronni hatte die schwarze Kleidung zwar
   * ursprünglich gewünscht, aber später ausdrücklich freigegeben („ist mir
   * egal, ob das jetzt schwarz sein soll"). Jetzt ein helles Blaugrau: Es
   * hebt sich vom Hintergrund ab, ohne dem roten Rahmen die Aufmerksamkeit
   * zu nehmen.
   */
  kleidung: '#4a5566',
  hose: '#232830',
  haut: '#e8b48a',
  akzent: '#38d9a9',
};

/**
 * Wie viele Meter quer ins Bild passen — bei Tempo etwas mehr.
 *
 * **Deutlich weniger als beim ersten Versuch (15 m).** Rückmeldung: „Das
 * ist alles viel zu klein … der Hintergrund so riesig und die Person so
 * klein. Guck dir Hill Climb Racing an." Genau das ist der Unterschied:
 * Dort füllt das Fahrzeug einen guten Teil des Bildes, hier war es ein
 * Fleck vor viel Landschaft. Bei 9 m Sichtweite nimmt das Rad rund ein
 * Achtel der Bildbreite ein statt einem Zwanzigstel.
 */
const SICHT_RUHIG = 9;
const SICHT_SCHNELL = 11.5;

/**
 * Eine feste Streuung von 0 bis 1 zu einer Weltposition — für Bäume und
 * Steine, die immer an derselben Stelle stehen müssen.
 *
 * **Der Rest-Operator allein reicht dafür nicht.** In JavaScript hat
 * `%` das Vorzeichen des linken Werts: `(-7) % 100` ist `-7`, nicht `93`.
 * Am Streckenanfang liegt der linke Bildrand aber bei negativem `x` — die
 * Streuung wurde dort negativ, und aus `0,1 + streu * 0,16` wurde ein
 * **negativer Radius**. Canvas wirft darauf hart (`IndexSizeError`), und
 * das Bild blieb schwarz. Genau deshalb steht die Umrechnung hier einmal
 * an einer Stelle statt zweimal ausgeschrieben.
 */
function streuung(x: number): number {
  const r = (x * 6151) % 1000;
  return ((r + 1000) % 1000) / 1000;
}

/**
 * Mischt zwei Farben — gebraucht für die Verlaufsstopps der Rohre.
 *
 * Nimmt nur `#rrggbb` entgegen, weil hier nur die eigenen Konstanten
 * hineingehen; ein voller Farbparser wäre für vier Aufrufe unangemessen.
 */
function mischen(a: string, b: string, anteil: number): string {
  const zahl = (s: string) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = zahl(a);
  const [r2, g2, b2] = zahl(b);
  const misch = (x: number, y: number) => Math.round(x + (y - x) * anteil);
  return `rgb(${misch(r1!, r2!)},${misch(g1!, g2!)},${misch(b1!, b2!)})`;
}

/**
 * Maße des Rades in Metern.
 *
 * **Bewusst keine echten Maße.** Ein 29-Zoll-Laufrad hat 0,37 m Radius bei
 * 1,20 m Radstand — genau das sah aus wie „ein normales Rennrad", so
 * Ronnis Urteil zur ersten Fassung. Spiele wie Hill Climb Racing
 * übertreiben die Räder deutlich; erst dadurch liest sich ein Fahrzeug
 * auf den ersten Blick als geländegängig. Hier: Raddurchmesser 0,92 m bei
 * 1,12 m Radstand, also fast so groß wie der Abstand zwischen ihnen.
 */
const RAD_R = 0.46;
const RADSTAND = 1.12;

export function zeichnerBauen(leinwand: HTMLCanvasElement): Zeichner {
  const ctx = leinwand.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar');

  let breite = leinwand.width;
  let hoehe = leinwand.height;
  let pixelDichte = 1;

  /*
   * Der eigene Darstellungszustand. Alles hier ist gedämpft und läuft der
   * Physik hinterher — genau das erzeugt den Eindruck von Masse.
   */
  /** Kameraposition in Weltkoordinaten, folgt dem Rad weich. */
  let kameraX = 0;
  let kameraY = 0;
  /**
   * Beim allerersten Bild springt die Kamera auf ihre Zielposition, statt
   * hinzugleiten.
   *
   * Ohne das stand sie bei null, während das Rad schon bei x = 4 losfährt
   * — im ersten Bild ragte das Rad dadurch halb aus dem rechten Bildrand
   * heraus und glitt erst danach sichtbar in die Bildmitte. Ein weiches
   * Nachziehen ist im Lauf richtig, beim Bildaufbau ist es ein Fehler.
   */
  let kameraGesetzt = false;
  /** Einfederung 0 bis 1, vorne und hinten getrennt. */
  let federVorn = 0;
  let federHinten = 0;
  /** Gesamtdrehung der Laufräder in Radiant. */
  let radDrehung = 0;
  /** Staubwolken: Weltposition, Alter, Größe. */
  const staub: { x: number; y: number; alter: number; groesse: number }[] = [];
  /** Für die Federung: die senkrechte Geschwindigkeit des letzten Bildes. */
  let vyVorher = 0;
  /** Wolken am Himmel, fest gestreut — kein Zufall je Bild. */
  const wolken = Array.from({ length: 7 }, (_, i) => ({
    x: i * 47 + (i % 3) * 13,
    y: 0.12 + ((i * 37) % 100) / 420,
    groesse: 0.6 + ((i * 53) % 100) / 130,
  }));

  const groesseAendern = (b: number, h: number) => {
    // Bildpunktzahl deckeln — dieselbe Vorsicht wie bei Dash City, ein
    // altes iPad zeichnet sonst viermal so viele Punkte wie nötig.
    pixelDichte = Math.min(window.devicePixelRatio || 1, 2);
    breite = b;
    hoehe = h;
    leinwand.width = Math.round(b * pixelDichte);
    leinwand.height = Math.round(h * pixelDichte);
    leinwand.style.width = `${b}px`;
    leinwand.style.height = `${h}px`;
  };

  const zeichnen = (lauf: Lauf, dt: number) => {
    const g = lauf.gelaende;

    // --- Kamera ---------------------------------------------------
    /*
     * Bei Tempo etwas weiter weg. Das ist nicht nur Optik: Wer schnell
     * fährt, braucht mehr Vorwarnung, sonst ist der nächste Kicker nicht
     * mehr rechtzeitig zu sehen. Ronni: „Bei hoher Geschwindigkeit leichte
     * Zoom-Anpassung."
     */
    const tempoAnteil = Math.min(1, Math.max(0, lauf.vx / 16));
    const sicht = SICHT_RUHIG + (SICHT_SCHNELL - SICHT_RUHIG) * tempoAnteil;
    const proMeter = breite / sicht;

    /*
     * Das Rad steht bei 34 % von links, nicht in der Mitte: Nach vorn
     * braucht man Sicht, nach hinten nicht. Die Kamera folgt gedämpft —
     * hart mitzuziehen wirkt hektisch.
     */
    const zielX = lauf.x + sicht * 0.16;
    const zielY = lauf.y + 1.1;
    if (!kameraGesetzt) {
      kameraX = zielX;
      kameraY = zielY;
      kameraGesetzt = true;
    } else {
      const folgen = Math.min(1, dt * 7);
      kameraX += (zielX - kameraX) * folgen;
      kameraY += (zielY - kameraY) * folgen;
    }

    /**
     * Weltkoordinaten → Bildpunkte. `y` wird dabei umgedreht.
     *
     * Der Bezugspunkt liegt bei 74 % der Bildhöhe, nicht bei 62 %: Unter
     * dem Rad braucht man nur so viel Boden, dass er nicht abgeschnitten
     * wirkt — darüber dagegen die ganze Flugbahn. Bei 62 % blieb im
     * Hochformat ein Viertel des Bildes leere grüne Fläche.
     */
    const bx = (x: number) => (x - kameraX) * proMeter + breite * 0.5;
    const by = (y: number) => hoehe * 0.74 - (y - kameraY) * proMeter;

    ctx.setTransform(pixelDichte, 0, 0, pixelDichte, 0, 0);
    ctx.clearRect(0, 0, breite, hoehe);

    // --- Himmel ---------------------------------------------------
    const himmel = ctx.createLinearGradient(0, 0, 0, hoehe);
    himmel.addColorStop(0, FARBEN.himmelOben);
    himmel.addColorStop(1, FARBEN.himmelUnten);
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, breite, hoehe);

    // Wolken: die langsamste Ebene, nur ein Zehntel der Kamerabewegung.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (const w of wolken) {
      const wx = ((w.x - kameraX * 0.1) % 140) * proMeter * 0.5;
      const px = ((wx % (breite + 200)) + breite + 200) % (breite + 200) - 100;
      const py = hoehe * w.y;
      const r = 26 * w.groesse;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.arc(px + r * 0.8, py + r * 0.15, r * 0.75, 0, Math.PI * 2);
      ctx.arc(px - r * 0.8, py + r * 0.2, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    /*
     * --- Parallax-Ebenen ------------------------------------------
     *
     * Drei Schichten, die sich unterschiedlich schnell bewegen. Das ist
     * der billigste Tiefeneindruck, den es gibt, und der Grund, warum eine
     * flache 2-D-Strecke räumlich wirkt.
     *
     * **In Bildschirmanteilen gerechnet, nicht in Weltmetern.** Der erste
     * Versuch legte die Berge auf eine Welthöhe und rechnete sie über
     * `by()` um — dabei drückte die Kamerahöhe sie zu flachen Streifen
     * zusammen, und im Hochformat blieb ein leerer Himmel übrig. Berge
     * sind aber weit genug weg, dass die Kamerahöhe sie gar nicht
     * verschieben würde; sie gehören an einen festen Anteil der Bildhöhe.
     * Nur seitlich wandern sie mit — genau das ist Parallax.
     */
    /**
     * `periode` ist die Breite eines Bergs **in Metern**.
     *
     * Der erste Versuch hatte hier einen festen Faktor 0,06 stehen — das
     * ergab eine Wellenlänge von über hundert Metern. Solange die Kamera
     * 15 m zeigte, fiel das kaum auf; seit sie nur noch 9 m zeigt, sah man
     * von jedem „Berg" nur ein Zwölftel, und die Kette wurde zu waagerechten
     * Streifen. Die Bergbreite muss im Verhältnis zur **Sichtweite**
     * stehen, nicht zu einer festen Zahl.
     */
    const schicht = (
      tempo: number,
      grundAnteil: number,
      hoch: number,
      periode: number,
      farbe: string,
    ) => {
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.moveTo(0, hoehe);
      const versatz = kameraX * tempo;
      const grund = hoehe * grundAnteil;
      const k = (Math.PI * 2) / periode;
      for (let px = 0; px <= breite; px += 5) {
        const wx = (versatz + px / proMeter) * k;
        /*
         * Drei Wellen mit unpassenden Verhältnissen, damit sich die Kette
         * über die Strecke praktisch nie wiederholt. Das Ergebnis wird mit
         * einer Potenz zugespitzt: Reine Sinuskurven ergeben sanfte
         * Hügel — Berge brauchen erkennbare Gipfel.
         */
        const roh =
          Math.sin(wx) * 0.55 + Math.sin(wx * 0.43 + 1.7) * 0.31 + Math.sin(wx * 2.7 + 0.6) * 0.14;
        const form = Math.sign(roh) * Math.pow(Math.abs(roh), 0.72);
        ctx.lineTo(px, grund - form * hoch);
      }
      ctx.lineTo(breite, hoehe);
      ctx.closePath();
      ctx.fill();
    };
    // Ferne Berge sind breit, nahe Hügel schmal — das verstärkt die Tiefe
    // zusätzlich zur unterschiedlichen Geschwindigkeit.
    schicht(0.18, 0.6, hoehe * 0.2, sicht * 1.9, FARBEN.bergFern);
    schicht(0.34, 0.68, hoehe * 0.13, sicht * 1.15, FARBEN.bergNah);
    schicht(0.55, 0.75, hoehe * 0.085, sicht * 0.75, FARBEN.huegel);

    // --- Das Gelände ----------------------------------------------
    /*
     * Der Umriss wird alle vier Bildpunkte abgetastet, nicht je Meter:
     * So ist die Linie immer glatt, egal wie weit die Kamera weg ist,
     * und die Zahl der Punkte hängt an der Bildbreite statt an der
     * Sichtweite.
     */
    const bodenGradient = ctx.createLinearGradient(0, by(6), 0, hoehe);
    bodenGradient.addColorStop(0, FARBEN.bodenOben);
    bodenGradient.addColorStop(1, FARBEN.bodenTief);

    const umriss: [number, number][] = [];
    for (let px = -12; px <= breite + 12; px += 4) {
      const wx = kameraX + (px - breite * 0.5) / proMeter;
      umriss.push([px, by(bodenHoehe(g, wx))]);
    }

    ctx.fillStyle = bodenGradient;
    ctx.beginPath();
    ctx.moveTo(umriss[0]![0], umriss[0]![1]);
    for (const [px, py] of umriss) ctx.lineTo(px, py);
    ctx.lineTo(breite + 12, hoehe);
    ctx.lineTo(-12, hoehe);
    ctx.closePath();
    ctx.fill();

    /*
     * Eine dunklere Erdschicht knapp unter der Oberfläche. Ohne sie ist
     * die untere Bildhälfte im Hochformat eine einzige leere Fläche — mit
     * ihr liest sie sich als angeschnittener Hang. Sie folgt demselben
     * Umriss, nur um gut einen Meter versetzt, deshalb kostet sie keine
     * zweite Abtastung des Geländes.
     */
    const erdVersatz = 1.15 * proMeter;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.moveTo(umriss[0]![0], umriss[0]![1] + erdVersatz);
    for (const [px, py] of umriss) ctx.lineTo(px, py + erdVersatz);
    ctx.lineTo(breite + 12, hoehe);
    ctx.lineTo(-12, hoehe);
    ctx.closePath();
    ctx.fill();

    // Die helle Grasnarbe obendrauf — ohne sie sieht der Boden aus wie
    // ein Loch im Bild, nicht wie eine Oberfläche.
    ctx.strokeStyle = FARBEN.bodenKante;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(umriss[0]![0], umriss[0]![1]);
    for (const [px, py] of umriss) ctx.lineTo(px, py);
    ctx.stroke();

    /*
     * Steine im Hang, an festen Weltpositionen. Sie sind der einzige
     * Anhaltspunkt dafür, wie schnell man wirklich fährt, sobald das
     * Gelände flach wird — ohne sie klebt der Blick am gleichförmigen
     * Grün und das Tempo ist nicht mehr zu spüren.
     */
    const ersterStein = Math.floor((kameraX - sicht) / 3.5) * 3.5;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let sx = ersterStein; sx < kameraX + sicht; sx += 3.5) {
      const streu = streuung(sx);
      const wx = sx + streu * 2.4;
      const tiefe = 0.5 + streu * 2.6;
      const r = (0.1 + streu * 0.16) * proMeter;
      ctx.beginPath();
      ctx.ellipse(bx(wx), by(bodenHoehe(g, wx) - tiefe), r, r * 0.68, streu * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Bäume am Wegrand -----------------------------------------
    /*
     * Sie stehen an festen Weltpositionen (alle 9 m, versetzt), nicht an
     * zufälligen: Ein Baum, der bei jedem Bild woanders steht, flackert.
     * Gezeichnet werden nur die, die gerade im Bild sind.
     */
    const ersterBaum = Math.floor((kameraX - sicht) / 9) * 9;
    for (let bxm = ersterBaum; bxm < kameraX + sicht; bxm += 9) {
      if (bxm < ANLAUF - 6) continue;
      const versatz = streuung(bxm + 0.5);
      const wx = bxm + versatz * 4;
      const wy = bodenHoehe(g, wx);
      const groesse = (1.6 + versatz * 1.4) * proMeter;
      const px = bx(wx);
      const py = by(wy);
      ctx.fillStyle = FARBEN.baum;
      ctx.beginPath();
      ctx.moveTo(px, py - groesse);
      ctx.lineTo(px - groesse * 0.34, py + 2);
      ctx.lineTo(px + groesse * 0.34, py + 2);
      ctx.closePath();
      ctx.fill();
    }

    // --- Ziellinie -------------------------------------------------
    if (kameraX + sicht > g.laenge - 4) {
      const zx = bx(g.laenge);
      const zy = by(bodenHoehe(g, g.laenge));
      const hoch = 3.4 * proMeter;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(zx - 3, zy - hoch, 6, hoch);
      // Karomuster als Querbalken oben.
      const feld = Math.max(6, proMeter * 0.28);
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? '#f8fafc' : '#111827';
          ctx.fillRect(zx - 3 + i * feld, zy - hoch + j * feld, feld, feld);
        }
      }
    }

    // --- Federung, Räder, Staub ------------------------------------
    /*
     * Die Federung reagiert auf den **Wechsel** der senkrechten
     * Geschwindigkeit, nicht auf ihren Wert: Wer mit −8 m/s aufschlägt und
     * sofort steht, hat einen harten Schlag — genau diese Differenz ist es,
     * die eine Federung einfedern lässt.
     */
    const stoss = Math.max(0, vyVorher - lauf.vy);
    vyVorher = lauf.vy;
    if (lauf.amBoden && stoss > 1) {
      const kraft = Math.min(1, stoss / 14);
      federVorn = Math.min(1, federVorn + kraft);
      federHinten = Math.min(1, federHinten + kraft * 1.15);
      // Bei hartem Aufschlag Staub aufwirbeln.
      if (kraft > 0.25) {
        for (let i = 0; i < 5; i++) {
          staub.push({
            x: lauf.x - 0.4 + i * 0.2,
            y: lauf.y + 0.1,
            alter: 0,
            groesse: 0.3 + kraft * 0.6,
          });
        }
      }
    }
    // Zurückfedern.
    federVorn = Math.max(0, federVorn - dt * 3.4);
    federHinten = Math.max(0, federHinten - dt * 3.1);

    // Räder drehen sich mit dem Tempo — Umfang 2πr.
    radDrehung += (lauf.vx / RAD_R) * dt;

    // Staub beim Beschleunigen am Boden.
    if (lauf.amBoden && lauf.vx > 4 && Math.random() < dt * 26) {
      staub.push({ x: lauf.x - 0.5, y: lauf.y + 0.08, alter: 0, groesse: 0.22 });
    }

    ctx.save();
    for (let i = staub.length - 1; i >= 0; i--) {
      const p = staub[i]!;
      p.alter += dt;
      if (p.alter > 0.85) {
        staub.splice(i, 1);
        continue;
      }
      const rest = 1 - p.alter / 0.85;
      ctx.fillStyle = `rgba(214,203,180,${(rest * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(
        bx(p.x - p.alter * 1.5),
        by(p.y + p.alter * 0.7),
        (p.groesse + p.alter * 0.9) * proMeter,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();

    // --- Fahrrad und Fahrer ----------------------------------------
    radFahrerZeichnen(ctx, lauf, {
      px: bx(lauf.x),
      py: by(lauf.y),
      proMeter,
      federVorn,
      federHinten,
      radDrehung,
    });
  };

  return { zeichnen, groesseAendern };
}

/**
 * Zeichnet Rad und Fahrer.
 *
 * Ronnis Prioritäten, wörtlich: „1. Fahrrad, 2. Fahrer, 3. Animation."
 *
 * **Die erste Fassung war ein Strichfahrrad — und genau so sah sie aus.**
 * Rückmeldung: „Das ist ein Fahrrad mit drei Strichen. Das ist nicht gut."
 * Der Fehler war, alles mit `stroke` zu zeichnen: Eine Linie hat überall
 * dieselbe Breite und kein Volumen, egal wie dick man sie macht. Jetzt ist
 * jedes Teil eine **gefüllte Fläche** mit eigener Licht- und Schattenkante
 * — Rohre verjüngen sich, Reifen haben Profil, die Federelemente bestehen
 * aus zwei ineinander laufenden Rohren.
 *
 * Die Federung ist dabei kein Beiwerk: „Das Fahrrad soll eine Federung
 * richtig haben, vorne und hinten." Vorn taucht das Standrohr sichtbar ins
 * Tauchrohr ein, hinten schwingt der ganze Hinterbau um das Tretlager und
 * staucht dabei den Dämpfer. Beides bewegt sich bei jeder Landung.
 */
function radFahrerZeichnen(
  ctx: CanvasRenderingContext2D,
  lauf: Lauf,
  o: {
    px: number;
    py: number;
    proMeter: number;
    federVorn: number;
    federHinten: number;
    radDrehung: number;
  },
) {
  const { px, py, proMeter, federVorn, federHinten, radDrehung } = o;
  const m = proMeter;

  ctx.save();
  ctx.translate(px, py);
  const sturzDreh = lauf.vorbei && !lauf.gewonnen ? Math.min(1.5, lauf.sturzZeit * 3.4) : 0;
  // Bildschirm-y zeigt nach unten, Physik-y nach oben — deshalb das Minus.
  ctx.rotate(-lauf.winkel + sturzDreh);

  const radR = RAD_R * m;
  const hintenX = -RADSTAND * 0.52 * m;
  const vornX = RADSTAND * 0.48 * m;
  const nabeY = -radR;

  /** Federweg vorn: das Standrohr taucht ein, das Vorderrad rückt hoch. */
  const wegVorn = federVorn * 0.11 * m;
  /** Federweg hinten: der Rahmen sinkt, der Hinterbau schwingt. */
  const wegHinten = federHinten * 0.1 * m;

  /**
   * Ein Rohr — mit **Querverlauf**, und genau daran hängt alles.
   *
   * Die erste Fassung füllte einfarbig und setzte eine helle Linie an die
   * Oberkante. Eine einfarbige Fläche ist aber ein Band, kein Rohr, egal
   * wie gut die Geometrie stimmt — das war der eigentliche Grund für den
   * „drei Striche"-Eindruck.
   *
   * Zwei Dinge machen daraus ein rundes Rohr:
   *
   * 1. **Der Verlauf läuft quer zur Rohrachse**, nicht längs. Die
   *    Normale `(−dy, dx)/L` steht senkrecht auf der Achse; entlang dieser
   *    Achse ändert sich der Verlaufswert nicht, quer dazu voll.
   * 2. **Das Glanzband sitzt bei 18 %, nicht am Rand.** Ein Zylinder hat
   *    seinen hellsten Streifen nicht an der Silhouette — dort fällt das
   *    Licht schon wieder ab. Genau diese Asymmetrie liest das Auge als
   *    Wölbung; ein gleichmäßiger Verlauf von hell nach dunkel wirkt
   *    weiter flach, nur schräg beleuchtet.
   *
   * Dazu eine dunkle Kontur: erst den Pfad dick dunkel stricheln, dann
   * die Füllung darüber. Der Strich ragt zur Hälfte nach außen, innen
   * deckt ihn die Füllung ab — das ergibt eine gleichmäßige Umrandung
   * statt zweier sichtbarer Bänder.
   */
  const rohr = (
    ax: number,
    ay: number,
    bx2: number,
    by2: number,
    dickeA: number,
    dickeB: number,
    grund: string,
    kontur = true,
  ) => {
    const dx = bx2 - ax;
    const dy = by2 - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const pfad = () => {
      ctx.beginPath();
      ctx.moveTo(ax + nx * dickeA, ay + ny * dickeA);
      ctx.lineTo(bx2 + nx * dickeB, by2 + ny * dickeB);
      ctx.lineTo(bx2 - nx * dickeB, by2 - ny * dickeB);
      ctx.lineTo(ax - nx * dickeA, ay - ny * dickeA);
      ctx.closePath();
    };

    if (kontur) {
      pfad();
      ctx.strokeStyle = '#0b0d11';
      ctx.lineWidth = Math.max(1.5, dickeA * 0.42);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    /*
     * Die Verlaufsachse wird an der **festen Lichtrichtung** (oben links)
     * ausgerichtet: `seite` ist das Skalarprodukt aus Normale und Licht.
     * Ohne das glänzt jedes Rohr für sich, und das Rad zerfällt in lauter
     * einzeln beleuchtete Teile — dieselbe Regel wie bei den App-Symbolen
     * in `core/AppSymbol.tsx`.
     */
    const seite = nx * -0.55 + ny * -0.84 >= 0 ? 1 : -1;
    const mx = (ax + bx2) / 2;
    const my = (ay + by2) / 2;
    const dM = ((dickeA + dickeB) / 2) * seite;
    const g2 = ctx.createLinearGradient(mx + nx * dM, my + ny * dM, mx - nx * dM, my - ny * dM);
    g2.addColorStop(0, mischen(grund, '#ffffff', 0.1));
    g2.addColorStop(0.18, mischen(grund, '#ffffff', 0.5));
    g2.addColorStop(0.45, grund);
    g2.addColorStop(0.82, mischen(grund, '#000000', 0.42));
    g2.addColorStop(1, mischen(grund, '#000000', 0.6));

    pfad();
    ctx.fillStyle = g2;
    ctx.fill();
  };

  // ---------------------------------------------------------------
  // Laufräder
  // ---------------------------------------------------------------
  const laufrad = (rx: number, ry: number) => {
    // Reifen mit Stollenprofil: kurze Zacken rundherum, die sich
    // mitdrehen. Sie sind das, was einen MTB-Reifen ausmacht.
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(radDrehung);
    ctx.fillStyle = FARBEN.profil;
    const stollen = 16;
    for (let i = 0; i < stollen; i++) {
      const w = (i / stollen) * Math.PI * 2;
      const sx = Math.cos(w) * radR;
      const sy = Math.sin(w) * radR;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(w);
      ctx.fillRect(-radR * 0.05, -radR * 0.09, radR * 0.16, radR * 0.18);
      ctx.restore();
    }
    ctx.restore();

    // Der Reifen selbst.
    ctx.strokeStyle = FARBEN.reifen;
    ctx.lineWidth = radR * 0.26;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    // Felge.
    ctx.strokeStyle = FARBEN.felge;
    ctx.lineWidth = radR * 0.09;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.74, 0, Math.PI * 2);
    ctx.stroke();

    /*
     * Speichen — **versetzt angesetzt, nicht durch die Mitte.**
     *
     * Der erste Versuch zog sechs Linien als volle Durchmesser durch die
     * Nabe. Das liest sich als Stern, nicht als Laufrad, und beim Drehen
     * passiert optisch fast nichts, weil ein Stern aus Durchmessern
     * punktsymmetrisch ist. Eine echte Speiche läuft **schräg** von der
     * Nabe zur Felge; zehn davon, jede um denselben Winkel versetzt,
     * ergeben das typische Muster.
     */
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(radDrehung);
    ctx.strokeStyle = 'rgba(226,231,238,0.8)';
    ctx.lineWidth = Math.max(0.8, radR * 0.035);
    const speichen = 10;
    ctx.beginPath();
    for (let i = 0; i < speichen; i++) {
      const w = (i / speichen) * Math.PI * 2;
      // Der Versatz von 0,3 Radiant an der Nabe ist die Schrägstellung.
      ctx.moveTo(Math.cos(w + 0.3) * radR * 0.14, Math.sin(w + 0.3) * radR * 0.14);
      ctx.lineTo(Math.cos(w) * radR * 0.72, Math.sin(w) * radR * 0.72);
    }
    ctx.stroke();
    // Bremsscheibe.
    ctx.strokeStyle = '#9aa0aa';
    ctx.lineWidth = Math.max(1, radR * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, radR * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Nabe.
    ctx.fillStyle = FARBEN.nabe;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.13, 0, Math.PI * 2);
    ctx.fill();
  };

  const nabeHinten = nabeY + wegHinten * 0.35;
  const nabeVorn = nabeY + wegVorn;
  laufrad(hintenX, nabeHinten);
  laufrad(vornX, nabeVorn);

  // ---------------------------------------------------------------
  // Rahmengeometrie
  // ---------------------------------------------------------------
  /** Das Tretlager — der Punkt, um den der Hinterbau schwingt. */
  const tretlager = { x: -0.08 * m, y: nabeY - 0.05 * m + wegHinten };
  /** Oben am Sattelrohr. */
  const sattel = { x: -0.44 * m, y: tretlager.y - 0.54 * m };
  /** Steuerkopf — hier sitzt die Gabel. */
  const steuerkopf = { x: vornX - 0.1 * m, y: tretlager.y - 0.5 * m };
  /** Oberes Ende der Gabel, knapp unter dem Steuerkopf. */
  const gabelOben = { x: steuerkopf.x + 0.02 * m, y: steuerkopf.y + 0.06 * m };

  /*
   * --- Doppelbrücken-Federgabel ---
   *
   * Ronnis ausdrücklicher Wunsch: „Das Fahrrad soll eine Doppelfedergabel
   * haben." Das ist die Downhill-Bauart: Die Standrohre laufen **oben am
   * Steuerkopf vorbei** und sind dort von *zwei* Brücken gehalten — einer
   * unter und einer über dem Steuerrohr. Genau diese zweite Brücke über
   * dem Steuerkopf unterscheidet sie von jeder normalen Gabel und macht
   * sie auf den ersten Blick erkennbar.
   *
   * Der Aufbau von unten nach oben: dickes Tauchrohr am Rad, darin das
   * dünnere Standrohr, das beim Einfedern darin verschwindet. Der
   * sichtbare Rest des Standrohrs **ist** der Federweg.
   */
  /*
   * Der sichtbare Federweg. Deutlich länger als beim ersten Versuch
   * (0,34 m) — Rückmeldung: „Das Fahrrad soll eine viel größere
   * Federgabel vorne haben." Eine echte Downhill-Gabel hat rund 200 mm
   * Federweg und entsprechend lange Rohre; das ist das Bauteil, an dem
   * man ein Downhill-Rad überhaupt erkennt.
   */
  const gabelOffen = 0.52 * m - wegVorn;
  /** Wo das Standrohr aus dem Tauchrohr kommt. */
  const tauchOben = {
    x: vornX + (gabelOben.x - vornX) * 0.46,
    y: nabeVorn + (gabelOben.y - nabeVorn) * 0.46,
  };
  /** Das obere Ende der Standrohre, über dem Steuerkopf. */
  const standOben = { x: gabelOben.x + 0.02 * m, y: gabelOben.y - gabelOffen * 0.45 };

  // Tauchrohr (unten, dick, dunkel).
  rohr(
    vornX,
    nabeVorn,
    tauchOben.x,
    tauchOben.y,
    0.075 * m,
    0.08 * m,
    FARBEN.federDunkel,
  );
  // Standrohr (oben, dünner, glänzend hell) — läuft bis über den Steuerkopf.
  rohr(
    tauchOben.x,
    tauchOben.y,
    standOben.x,
    standOben.y,
    0.056 * m,
    0.056 * m,
    FARBEN.federHell,
  );
  // Untere Brücke, direkt unter dem Steuerrohr.
  rohr(
    gabelOben.x - 0.085 * m,
    gabelOben.y + 0.02 * m,
    gabelOben.x + 0.085 * m,
    gabelOben.y + 0.005 * m,
    0.05 * m,
    0.05 * m,
    FARBEN.rahmenDunkel,
  );
  // **Obere Brücke** — das Erkennungsmerkmal der Doppelbrückengabel.
  rohr(
    standOben.x - 0.085 * m,
    standOben.y + 0.015 * m,
    standOben.x + 0.085 * m,
    standOben.y,
    0.045 * m,
    0.045 * m,
    FARBEN.rahmenDunkel,
  );

  // --- Hinterbau: Kettenstrebe und Sitzstrebe ---
  rohr(
    tretlager.x,
    tretlager.y,
    hintenX,
    nabeHinten,
    0.055 * m,
    0.035 * m,
    FARBEN.rahmenDunkel,
  );
  const sitzstrebeOben = { x: sattel.x + 0.1 * m, y: sattel.y + 0.2 * m };
  rohr(
    hintenX,
    nabeHinten,
    sitzstrebeOben.x,
    sitzstrebeOben.y,
    0.032 * m,
    0.042 * m,
    FARBEN.rahmenDunkel,
  );

  // --- Der Dämpfer, sichtbar gestaucht ---
  /*
   * Er sitzt schräg im Hauptdreieck und wird beim Einfedern kürzer. Weil
   * `sitzstrebeOben` am Hinterbau hängt und der mit `wegHinten` schwingt,
   * ergibt sich die Stauchung von selbst — sie muss nicht extra gerechnet
   * werden.
   */
  const daempferA = { x: tretlager.x - 0.04 * m, y: tretlager.y - 0.14 * m };
  const daempferB = { x: sattel.x + 0.16 * m, y: sattel.y + 0.3 * m };
  // Der Dämpferkörper selbst wird **zwischen** den beiden Federhälften
  // gezeichnet, siehe unten — nicht hier davor.
  /*
   * --- Die Schraubenfeder um den Dämpfer ---
   *
   * Ronni: „hinten eine Spirale." Sie ist als echte Wendel gezeichnet,
   * nicht als Zickzack: Jede Windung ist ein halber Bogen, dessen Breite
   * quer zum Dämpfer steht. Dadurch sieht man beim Einfedern, wie die
   * Windungen **enger zusammenrücken** — genau das macht eine Feder
   * sichtbar, ein Zickzack tut das nicht.
   */
  const fedDx = daempferB.x - daempferA.x;
  const fedDy = daempferB.y - daempferA.y;
  const fedLen = Math.hypot(fedDx, fedDy) || 1;
  const ux = fedDx / fedLen;
  const uy = fedDy / fedLen;
  // Einheitsvektor quer zur Federachse.
  const qx = -uy;
  const qy = ux;
  const fedRadius = 0.1 * m;
  /**
   * **Die Windungszahl ist fest — nur der Abstand ändert sich.**
   *
   * Das ist der ganze Unterschied zwischen „Feder" und „Gummiband". Beim
   * Einfedern rücken die Windungen zusammen, es werden nie weniger. Die
   * erste Fassung interpolierte stattdessen die Punkte über die
   * Dämpferlänge — dabei wurde die Feder beim Einfedern nur kürzer, und
   * genau die Bewegung, die man sehen will, fehlte.
   */
  const windungen = 6;
  const federPunkte: { x: number; y: number; tiefe: number }[] = [];
  const schritte = windungen * 14;
  for (let i = 0; i <= schritte; i++) {
    const t = i / schritte;
    const winkel = t * windungen * Math.PI * 2;
    federPunkte.push({
      x: daempferA.x + ux * (t * fedLen) + qx * Math.cos(winkel) * fedRadius,
      y: daempferA.y + uy * (t * fedLen) + qy * Math.cos(winkel) * fedRadius,
      // Größer null heißt: diese Windung läuft gerade vor dem Dämpfer
      // vorbei, kleiner null dahinter.
      tiefe: Math.sin(winkel),
    });
  }

  /*
   * In drei Lagen zeichnen: hintere Windungshälften, dann der
   * Dämpferkörper, dann die vorderen. Erst dadurch wickelt sich die Feder
   * sichtbar **um** den Dämpfer, statt daneben zu liegen.
   */
  const federTeil = (vorne: boolean, farbe: string, dicke: number) => {
    ctx.strokeStyle = farbe;
    ctx.lineWidth = dicke;
    ctx.lineCap = 'round';
    let offen = false;
    ctx.beginPath();
    for (const p of federPunkte) {
      const dran = vorne ? p.tiefe >= 0 : p.tiefe < 0;
      if (!dran) {
        // Am Vorzeichenwechsel den Strich absetzen, sonst zieht eine
        // Linie quer durch den Dämpfer.
        if (offen) {
          ctx.stroke();
          ctx.beginPath();
          offen = false;
        }
        continue;
      }
      if (!offen) {
        ctx.moveTo(p.x, p.y);
        offen = true;
      } else ctx.lineTo(p.x, p.y);
    }
    if (offen) ctx.stroke();
  };

  const federDicke = Math.max(1.8, 0.03 * m);
  federTeil(false, mischen(FARBEN.akzent, '#000000', 0.45), federDicke);
  rohr(daempferA.x, daempferA.y, daempferB.x, daempferB.y, 0.05 * m, 0.05 * m, FARBEN.federDunkel);
  federTeil(true, FARBEN.akzent, federDicke * 1.15);

  // Federteller oben und unten — ohne sie schwebt die Wendel frei.
  ctx.fillStyle = '#8d939e';
  for (const p of [daempferA, daempferB]) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, fedRadius * 1.2, 0.03 * m, Math.atan2(fedDy, fedDx), 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Hauptrahmen: Unterrohr, Oberrohr, Sattelrohr ---
  rohr(
    tretlager.x,
    tretlager.y,
    steuerkopf.x,
    steuerkopf.y + 0.14 * m,
    0.07 * m,
    0.055 * m,
    FARBEN.rahmen,
  );
  rohr(
    sattel.x,
    sattel.y,
    steuerkopf.x,
    steuerkopf.y,
    0.055 * m,
    0.05 * m,
    FARBEN.rahmen,
  );
  rohr(
    tretlager.x,
    tretlager.y,
    sattel.x,
    sattel.y,
    0.05 * m,
    0.042 * m,
    FARBEN.rahmen,
  );
  // Steuerrohr.
  rohr(
    steuerkopf.x,
    steuerkopf.y - 0.02 * m,
    gabelOben.x,
    gabelOben.y,
    0.055 * m,
    0.05 * m,
    FARBEN.rahmen,
  );

  // --- Sattel ---
  ctx.fillStyle = '#1a1a20';
  ctx.beginPath();
  ctx.ellipse(sattel.x - 0.02 * m, sattel.y - 0.04 * m, 0.15 * m, 0.045 * m, -0.12, 0, Math.PI * 2);
  ctx.fill();

  // --- Lenker und Vorbau ---
  // Der Vorbau sitzt auf der **oberen** Brücke, nicht am Steuerkopf —
  // bei einer Doppelbrückengabel ist das der einzige Platz dafür.
  const lenker = { x: standOben.x + 0.06 * m, y: standOben.y - 0.16 * m };
  rohr(
    standOben.x,
    standOben.y - 0.01 * m,
    lenker.x,
    lenker.y,
    0.038 * m,
    0.032 * m,
    FARBEN.federDunkel,
  );
  ctx.fillStyle = '#101014';
  ctx.beginPath();
  ctx.arc(lenker.x, lenker.y, 0.055 * m, 0, Math.PI * 2);
  ctx.fill();

  // --- Antrieb: Kettenblatt, Kurbel, Pedal, Kette ---
  ctx.fillStyle = '#7a8089';
  ctx.beginPath();
  ctx.arc(tretlager.x, tretlager.y, 0.11 * m, 0, Math.PI * 2);
  ctx.fill();
  // Kassette am Hinterrad.
  ctx.fillStyle = '#7a8089';
  ctx.beginPath();
  ctx.arc(hintenX, nabeHinten, 0.07 * m, 0, Math.PI * 2);
  ctx.fill();
  // Die Kette als zwei Trume zwischen beiden.
  ctx.strokeStyle = '#4c525b';
  ctx.lineWidth = Math.max(1, 0.022 * m);
  ctx.beginPath();
  ctx.moveTo(tretlager.x, tretlager.y - 0.1 * m);
  ctx.lineTo(hintenX, nabeHinten - 0.065 * m);
  ctx.moveTo(tretlager.x, tretlager.y + 0.1 * m);
  ctx.lineTo(hintenX, nabeHinten + 0.065 * m);
  ctx.stroke();

  // Die Kurbel dreht sich mit dem Tempo.
  const pedalWinkel = radDrehung * 0.55;
  const pedalX = tretlager.x + Math.cos(pedalWinkel) * 0.17 * m;
  const pedalY = tretlager.y + Math.sin(pedalWinkel) * 0.17 * m;
  rohr(
    tretlager.x,
    tretlager.y,
    pedalX,
    pedalY,
    0.028 * m,
    0.025 * m,
    '#3a3f47',
  );
  ctx.fillStyle = '#22252a';
  ctx.fillRect(pedalX - 0.055 * m, pedalY - 0.018 * m, 0.11 * m, 0.036 * m);

  // ---------------------------------------------------------------
  // Der Fahrer
  // ---------------------------------------------------------------
  /*
   * Die Haltung folgt dem, was passiert: In der Luft und bei harter
   * Landung geht der Fahrer tief, sonst steht er über dem Sattel. `hocke`
   * ist das eine Maß dafür.
   */
  /*
   * **Der Fahrer ist aus Körperformen gebaut, nicht aus Rohren.**
   *
   * Rückmeldung: „Ich will, dass der Mensch deutlich menschlicher
   * aussieht." Vorher liefen Rumpf, Arme und Beine durch dieselbe
   * `rohr()`-Funktion wie der Rahmen — mit demselben Metallglanz und
   * derselben harten Kontur. Ein Körper hat aber keine Rohre: Der Rumpf
   * ist an den Schultern breit und an der Taille schmal, Gliedmaßen sind
   * am Ansatz dicker als am Gelenk, und alle Übergänge sind rund.
   *
   * Deshalb bekommt der Fahrer eine eigene `glied()`-Funktion mit runden
   * Enden und einen Rumpf als geschlossenen Umriss.
   */
  const hocke = Math.min(1, (federVorn + federHinten) * 0.5 + (lauf.amBoden ? 0 : 0.4));
  const huefte = { x: sattel.x + 0.1 * m, y: sattel.y - 0.14 * m + hocke * 0.13 * m };
  const schulter = { x: huefte.x + 0.36 * m, y: huefte.y - 0.5 * m + hocke * 0.17 * m };
  const kopf = { x: schulter.x + 0.15 * m, y: schulter.y - 0.25 * m };

  /** Ein Körperglied: weiche Kapsel mit runden Enden, kein Metallrohr. */
  const glied = (
    ax: number,
    ay: number,
    bx2: number,
    by2: number,
    dickeA: number,
    dickeB: number,
    farbe: string,
  ) => {
    const dx = bx2 - ax;
    const dy = by2 - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const winkel = Math.atan2(dy, dx);
    ctx.beginPath();
    // Halbkreis am Ansatz, gerade Seiten, Halbkreis am Gelenk — das ist
    // der Unterschied zwischen Arm und Rohr.
    ctx.arc(ax, ay, dickeA, winkel + Math.PI / 2, winkel - Math.PI / 2);
    ctx.lineTo(bx2 + nx * -dickeB, by2 + ny * -dickeB);
    ctx.arc(bx2, by2, dickeB, winkel - Math.PI / 2, winkel + Math.PI / 2);
    ctx.closePath();
    ctx.strokeStyle = '#12141a';
    ctx.lineWidth = Math.max(1.2, dickeA * 0.3);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Weicher Verlauf quer zum Glied — heller oben, dunkler unten.
    const gg = ctx.createLinearGradient(
      (ax + bx2) / 2 + nx * dickeA,
      (ay + by2) / 2 + ny * dickeA,
      (ax + bx2) / 2 - nx * dickeA,
      (ay + by2) / 2 - ny * dickeA,
    );
    gg.addColorStop(0, mischen(farbe, '#ffffff', 0.28));
    gg.addColorStop(0.55, farbe);
    gg.addColorStop(1, mischen(farbe, '#000000', 0.35));
    ctx.fillStyle = gg;
    ctx.fill();
  };

  // --- Bein: Hüfte → Knie → Pedal ---
  const knie = { x: huefte.x + 0.24 * m, y: huefte.y + 0.3 * m + hocke * 0.04 * m };
  glied(huefte.x, huefte.y, knie.x, knie.y, 0.085 * m, 0.062 * m, FARBEN.hose);
  glied(knie.x, knie.y, pedalX, pedalY - 0.04 * m, 0.06 * m, 0.045 * m, FARBEN.hose);
  // Schuh: Sohle und Spann getrennt, damit er nicht wie ein Klumpen wirkt.
  ctx.fillStyle = '#15161b';
  ctx.beginPath();
  ctx.ellipse(pedalX + 0.02 * m, pedalY - 0.045 * m, 0.085 * m, 0.05 * m, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(pedalX - 0.06 * m, pedalY - 0.015 * m, 0.16 * m, 0.028 * m);

  /*
   * --- Der Rumpf als geschlossener Umriss ---
   *
   * Vier Punkte, mit Kurven verbunden: breite Schulter, eingezogene
   * Taille auf der Bauchseite, gewölbter Rücken. Eine gerade Kapsel von
   * Hüfte zu Schulter — wie vorher — liest sich als Rohr; erst die
   * unterschiedliche Wölbung von Vorder- und Rückseite macht daraus
   * einen Oberkörper.
   */
  const rDx = schulter.x - huefte.x;
  const rDy = schulter.y - huefte.y;
  const rLen = Math.hypot(rDx, rDy) || 1;
  const rNx = -rDy / rLen;
  const rNy = rDx / rLen;
  const breitSchulter = 0.15 * m;
  const breitHuefte = 0.115 * m;
  ctx.beginPath();
  ctx.moveTo(huefte.x + rNx * breitHuefte, huefte.y + rNy * breitHuefte);
  // Rückenseite: nach außen gewölbt.
  ctx.quadraticCurveTo(
    (huefte.x + schulter.x) / 2 + rNx * breitSchulter * 1.35,
    (huefte.y + schulter.y) / 2 + rNy * breitSchulter * 1.35,
    schulter.x + rNx * breitSchulter,
    schulter.y + rNy * breitSchulter,
  );
  ctx.arc(
    schulter.x,
    schulter.y,
    breitSchulter,
    Math.atan2(rNy, rNx),
    Math.atan2(-rNy, -rNx),
    false,
  );
  // Bauchseite: leicht eingezogen.
  ctx.quadraticCurveTo(
    (huefte.x + schulter.x) / 2 - rNx * breitHuefte * 0.75,
    (huefte.y + schulter.y) / 2 - rNy * breitHuefte * 0.75,
    huefte.x - rNx * breitHuefte,
    huefte.y - rNy * breitHuefte,
  );
  ctx.closePath();
  ctx.strokeStyle = '#12141a';
  ctx.lineWidth = Math.max(1.5, 0.032 * m);
  ctx.lineJoin = 'round';
  ctx.stroke();
  const rumpfG = ctx.createLinearGradient(
    (huefte.x + schulter.x) / 2 + rNx * breitSchulter,
    (huefte.y + schulter.y) / 2 + rNy * breitSchulter,
    (huefte.x + schulter.x) / 2 - rNx * breitSchulter,
    (huefte.y + schulter.y) / 2 - rNy * breitSchulter,
  );
  rumpfG.addColorStop(0, mischen(FARBEN.kleidung, '#ffffff', 0.3));
  rumpfG.addColorStop(0.5, FARBEN.kleidung);
  rumpfG.addColorStop(1, mischen(FARBEN.kleidung, '#000000', 0.4));
  ctx.fillStyle = rumpfG;
  ctx.fill();

  // Rückenprotektor, als aufgesetzte Platte auf dem Rücken.
  ctx.fillStyle = 'rgba(20,22,28,0.55)';
  ctx.beginPath();
  ctx.ellipse(
    (huefte.x + schulter.x) / 2 + rNx * 0.06 * m,
    (huefte.y + schulter.y) / 2 + rNy * 0.06 * m,
    0.17 * m,
    0.085 * m,
    Math.atan2(rDy, rDx),
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // --- Arm: Schulter → Ellbogen → Lenker ---
  const ellbogen = { x: schulter.x + 0.16 * m, y: schulter.y + 0.22 * m + hocke * 0.1 * m };
  glied(schulter.x, schulter.y, ellbogen.x, ellbogen.y, 0.07 * m, 0.052 * m, FARBEN.kleidung);
  glied(ellbogen.x, ellbogen.y, lenker.x, lenker.y, 0.05 * m, 0.04 * m, FARBEN.kleidung);
  // Handschuh am Lenker.
  ctx.fillStyle = '#2a2d36';
  ctx.strokeStyle = '#12141a';
  ctx.lineWidth = Math.max(1, 0.02 * m);
  ctx.beginPath();
  ctx.arc(lenker.x, lenker.y, 0.055 * m, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hals — ohne ihn sitzt der Helm direkt auf den Schultern.
  glied(
    schulter.x + 0.03 * m,
    schulter.y - 0.02 * m,
    kopf.x - 0.03 * m,
    kopf.y + 0.1 * m,
    0.055 * m,
    0.05 * m,
    FARBEN.haut,
  );

  /*
   * --- Der Fullface-Helm ---
   *
   * Rückmeldung: „Der Typ soll einen besseren Helm anhaben." Vorher war es
   * ein Kreis mit einem Fleck davor. Ein Fullface hat drei Merkmale, an
   * denen man ihn erkennt, und alle drei sind hier einzeln gebaut: die
   * Schale mit Nackenschutz hinten, der **Kinnbügel**, der weit nach vorn
   * ragt, und der Schirm oben. Ohne den Kinnbügel ist es ein Halbschalen-
   * helm, ohne den Schirm ein Motorradhelm.
   */
  const hr = 0.2 * m;
  ctx.save();
  ctx.translate(kopf.x, kopf.y);
  // Der Kopf ist leicht nach vorn geneigt — der Fahrer schaut die Strecke
  // hinunter, nicht geradeaus.
  ctx.rotate(0.22);

  // Schale samt Nackenschutz.
  ctx.fillStyle = FARBEN.helm;
  ctx.beginPath();
  ctx.moveTo(-hr * 0.95, hr * 0.2);
  ctx.quadraticCurveTo(-hr * 1.1, -hr * 0.95, 0, -hr * 1.02);
  ctx.quadraticCurveTo(hr * 1.05, -hr * 0.95, hr * 1.0, hr * 0.05);
  ctx.quadraticCurveTo(hr * 0.95, hr * 0.5, hr * 0.5, hr * 0.62);
  ctx.lineTo(-hr * 0.5, hr * 0.72);
  ctx.quadraticCurveTo(-hr * 1.0, hr * 0.7, -hr * 0.95, hr * 0.2);
  ctx.closePath();
  ctx.fill();

  // Der Kinnbügel — das Erkennungsmerkmal.
  ctx.fillStyle = FARBEN.helm;
  ctx.beginPath();
  ctx.moveTo(hr * 0.45, hr * 0.15);
  ctx.quadraticCurveTo(hr * 1.35, hr * 0.3, hr * 1.2, hr * 0.72);
  ctx.quadraticCurveTo(hr * 0.9, hr * 0.9, hr * 0.35, hr * 0.7);
  ctx.closePath();
  ctx.fill();

  // Schattenkante unten, damit die Schale rund wirkt.
  ctx.strokeStyle = FARBEN.helmSchatten;
  ctx.lineWidth = Math.max(1.2, hr * 0.1);
  ctx.beginPath();
  ctx.moveTo(-hr * 0.85, hr * 0.35);
  ctx.quadraticCurveTo(-hr * 0.2, hr * 0.85, hr * 0.5, hr * 0.66);
  ctx.stroke();

  // Visieröffnung.
  ctx.fillStyle = FARBEN.visier;
  ctx.beginPath();
  ctx.moveTo(hr * 0.2, -hr * 0.3);
  ctx.quadraticCurveTo(hr * 1.0, -hr * 0.22, hr * 0.95, hr * 0.18);
  ctx.quadraticCurveTo(hr * 0.5, hr * 0.24, hr * 0.15, hr * 0.12);
  ctx.closePath();
  ctx.fill();

  // Der Schirm oben.
  ctx.fillStyle = FARBEN.rahmen;
  ctx.beginPath();
  ctx.moveTo(hr * 0.05, -hr * 0.82);
  ctx.quadraticCurveTo(hr * 1.15, -hr * 1.0, hr * 1.32, -hr * 0.52);
  ctx.quadraticCurveTo(hr * 0.9, -hr * 0.62, hr * 0.2, -hr * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}
