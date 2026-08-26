/**
 * Die drei Startcharaktere — Werte und Gestalt an einer Stelle.
 *
 * Alles, was den Spieler ausmacht, steht hier: Der Spieler liest seine
 * Startwerte vollständig aus `werte`, nichts davon ist im Spielercode noch
 * einmal fest verdrahtet. Sonst gälte für einen Wert der Charakter und für den
 * nächsten die alte Zahl, und das fiele erst beim Spielen auf.
 *
 * Die Aufwertungen aus `aufwertungen.js` rechnen auf diese Werte **auf**,
 * ersetzen sie also nicht — „Mehr Tempo" macht den Schnellen schneller als
 * den Tank, und das soll auch so bleiben.
 *
 * ## Zur Zeichnung
 *
 * Alles ist **eckig**: Vielecke mit geraden Kanten, keine Kreise und keine
 * abgerundeten Balken. Das ist nicht Geschmack, sondern eine Folge der Größe.
 * Im Spiel ist die Figur 48 Pixel groß, auf einem iPhone im Querformat noch
 * rund 30 physische. Eine Rundung braucht mehrere Pixel, um als Rundung zu
 * lesen — bei dieser Größe wird sie zu Matsch. Eine Kante bleibt eine Kante.
 *
 * Deshalb auch: wenige große Flächen mit hohem Kontrast, statt vieler kleiner
 * Teile. Erkennbar ist am Ende nur der **Umriss** — Breite, Stand, Neigung —
 * plus zwei, drei große Farbflächen darin. Dieselbe Lehre wie beim Männchen in
 * Ghost Chase, wo mehr Realismus die Figur schlechter erkennbar gemacht hätte.
 */
const Charaktere = {
  LISTE: [
    {
      id: 'ausgewogen',
      name: 'Ausgewogen',
      staerke: 'Kann alles ein bisschen — gut zum Anfangen',
      // `farbe` ist die Kennfarbe für die Oberfläche (Kartenrand, Farbband).
      // Sie ist nicht zwingend die Anzugfarbe: Beim Schnellen ist der Anzug
      // schwarz, und ein schwarzer Kartenrand wäre unsichtbar.
      farbe: 0x3d8bf2,
      anzug: 0x2f6fd0,
      akzent: 0xf4f8ff,
      bein: 0x24558f,
      stiefel: 0x16375e,
      dunkel: 0x0e1c33,
      gestalt: {
        neigung: 0,
        kopfHalb: 10,
        kopfOben: 12,
        kopfUnten: 31,
        kinnHalb: 7,
        schulterHalb: 21,
        schulterY: 34,
        taillenHalb: 12,
        taillenY: 58,
        armDicke: 8,
        armBis: 60,
        beinHalb: 6,
        beinAbstand: 9,
        beinBis: 82,
        fussHalb: 8,
        fussY: 82,
        fussBis: 90,
      },
      werte: {
        leben: 5,
        tempo: 200,
        schussVerzoegerungMs: 250,
        reichweite: 460,
        unverwundbarMs: 900,
        schaden: 1,
      },
    },
    {
      id: 'schnell',
      name: 'Schnell',
      staerke: 'Läuft allen davon, hält aber wenig aus',
      // Gelbstichiges Orange, kein rötliches: Die Gegner sind rot (0xe74c3c),
      // und bei Tempo 275 quer über die Arena entscheidet der Farbabstand mit
      // darüber, ob man sich selbst noch wiederfindet.
      farbe: 0xff8a00,
      anzug: 0x2b2b35,
      akzent: 0xff8a00,
      bein: 0x22222b,
      stiefel: 0xff8a00,
      dunkel: 0x0a0a10,
      gestalt: {
        // Nach vorn geneigt — bei 48 Pixeln das einzige Merkmal „Bewegung",
        // das noch ankommt.
        neigung: 0.22,
        kopfHalb: 9,
        kopfOben: 14,
        kopfUnten: 31,
        kinnHalb: 5,
        schulterHalb: 14,
        schulterY: 35,
        taillenHalb: 8,
        taillenY: 57,
        armDicke: 6,
        armBis: 59,
        beinHalb: 4,
        beinAbstand: 10,
        beinBis: 82,
        fussHalb: 7,
        fussY: 82,
        fussBis: 89,
      },
      werte: {
        leben: 4,
        tempo: 275,
        schussVerzoegerungMs: 215,
        reichweite: 380,
        unverwundbarMs: 900,
        schaden: 1,
      },
    },
    {
      id: 'tank',
      name: 'Tank',
      staerke: 'Steckt viel ein, ist dafür schwerfällig',
      farbe: 0x74a03c,
      anzug: 0x6b9438,
      akzent: 0x333941,
      bein: 0x4d6b2a,
      stiefel: 0x333941,
      dunkel: 0x14200c,
      gestalt: {
        neigung: 0,
        kopfHalb: 10,
        kopfOben: 18,
        kopfUnten: 35,
        kinnHalb: 9,
        // Fast doppelt so breit wie beim Schnellen. Der Unterschied muss
        // allein über den Umriss ankommen — Details sind bei dieser Größe
        // längst Matsch.
        schulterHalb: 27,
        schulterY: 38,
        taillenHalb: 18,
        taillenY: 63,
        armDicke: 10,
        armBis: 66,
        beinHalb: 9,
        beinAbstand: 11,
        beinBis: 82,
        fussHalb: 12,
        fussY: 82,
        fussBis: 91,
      },
      werte: {
        leben: 7,
        tempo: 165,
        schussVerzoegerungMs: 300,
        reichweite: 460,
        // Längere Unverwundbarkeit statt kürzerer: Eine kürzere wäre für einen
        // Tank ein Nachteil, und genau das Gegenteil seiner Rolle. Wer viel
        // einsteckt, soll nach einem Treffer auch länger Zeit haben, sich aus
        // dem Getümmel zu lösen.
        unverwundbarMs: 1300,
        schaden: 1,
      },
    },
  ],

  STANDARD_ID: 'ausgewogen',

  nachId(id) {
    return Charaktere.LISTE.find((c) => c.id === id) || null;
  },

  standard() {
    return Charaktere.nachId(Charaktere.STANDARD_ID);
  },

  /**
   * Kurze Werte-Zeile für die Karte. Bewusst in Worten statt in Zahlen: „275"
   * sagt einem Kind nichts, „flink" schon — und die Zahl steht ohnehin nirgends
   * im Spiel, mit der man sie vergleichen könnte.
   */
  werteZeile(charakter) {
    const w = charakter.werte;
    const standard = Charaktere.standard().werte;

    const stufe = (wert, bezug, hoeherIstBesser = true) => {
      const verhaeltnis = wert / bezug;
      const stark = hoeherIstBesser ? verhaeltnis > 1.15 : verhaeltnis < 0.87;
      const schwach = hoeherIstBesser ? verhaeltnis < 0.87 : verhaeltnis > 1.15;
      if (stark) return 'schnell';
      if (schwach) return 'langsam';
      return 'normal';
    };

    const tempo = stufe(w.tempo, standard.tempo);
    const schuss = stufe(w.schussVerzoegerungMs, standard.schussVerzoegerungMs, false);

    // Kurze Wörter, und höchstens drei Angaben: Die Zeile steht auf einer
    // 240 Pixel breiten Karte und bricht sonst über die halbe Karte um.
    const tempoWort = { schnell: 'flink', normal: 'normal', langsam: 'gemächlich' }[tempo];
    const schussWort = { schnell: 'schnelle Schüsse', normal: 'normale Schüsse', langsam: 'ruhige Schüsse' }[schuss];

    return `${w.leben} Leben · ${tempoWort} · ${schussWort}`;
  },

  /** Kantenlänge der erzeugten Figur-Textur. */
  TEXTUR_KANTE: 96,

  /** Präfix der aus `assets/images/` geladenen Bilder. */
  BILD_PRAEFIX: 'bild-',

  /**
   * Welche Textur die Figur benutzt: das echte Bild aus `assets/images/`, wenn
   * es geladen werden konnte — sonst die gezeichnete Fassung.
   *
   * Der Rückfall ist kein Beiwerk. Der Prototyp lief lange ganz ohne
   * Bilddateien, und er soll das weiter tun: Wer ihn frisch auscheckt, ohne
   * dass die PNGs beiliegen, bekommt sonst drei unsichtbare Sprites und ein
   * Spiel, das aussieht wie kaputt. Beide Wege liefern denselben Schlüssel
   * für Karte und Spielfeld, die beiden können also nicht auseinanderlaufen.
   */
  bildSchluessel(scene, charakter) {
    const ausDatei = Charaktere.BILD_PRAEFIX + charakter.id;
    if (scene.textures.exists(ausDatei)) return ausDatei;
    return Charaktere.erzeugeTextur(scene, charakter);
  },

  /** Liegt für diesen Charakter ein echtes Bild vor? */
  hatBild(scene, charakter) {
    return scene.textures.exists(Charaktere.BILD_PRAEFIX + charakter.id);
  },

  /**
   * Ein Bild in ein Quadrat der Kantenlänge `kante` einpassen, ohne es zu
   * verzerren: Es zählt die **längere** Seite, die kürzere bleibt anteilig.
   *
   * Die gezeichneten Figuren sind quadratisch, ein geliefertes PNG muss das
   * nicht sein. Ein glattes `setDisplaySize(kante, kante)` würde ein
   * hochformatiges Bild in die Breite ziehen — und das sieht man erst am
   * fertigen Bild, nicht im Code.
   */
  einpassen(bild, kante) {
    const quelle = bild.texture.getSourceImage();
    const breite = quelle.width || kante;
    const hoehe = quelle.height || kante;
    const massstab = kante / Math.max(breite, hoehe);

    bild.setDisplaySize(breite * massstab, hoehe * massstab);
    return bild;
  },

  /**
   * Zeichnet die Figur **einmal** in eine 96er-Textur; Spielfeld und Karte
   * benutzen dieselbe, nur in unterschiedlicher Größe.
   *
   * Groß zeichnen und klein anzeigen ist keine Bequemlichkeit: Direkt in
   * Spielgröße gezeichnet franst jede Kante aus; aus einer 96er-Textur
   * heruntergerechnet bleibt sie sauber.
   */
  erzeugeTextur(scene, charakter) {
    const schluessel = `figur-${charakter.id}`;
    if (scene.textures.exists(schluessel)) return schluessel;

    const kante = Charaktere.TEXTUR_KANTE;
    const mitte = kante / 2;
    const f = charakter.gestalt;
    const g = scene.add.graphics();

    // Um die Taille kippen, nicht um die Bildmitte — sonst hebt eine geneigte
    // Figur die Füße vom Boden.
    const drehpunkt = { x: mitte, y: f.taillenY };
    const dreh = (p) => {
      if (!f.neigung) return p;
      const sin = Math.sin(f.neigung);
      const cos = Math.cos(f.neigung);
      const dx = p.x - drehpunkt.x;
      const dy = p.y - drehpunkt.y;
      return { x: drehpunkt.x + dx * cos - dy * sin, y: drehpunkt.y + dx * sin + dy * cos };
    };

    /**
     * Eine Fläche: erst als dicke dunkle Kontur, dann farbig gefüllt. Die
     * Kontur ist bei dieser Größe das, was die Figur überhaupt vom Hintergrund
     * trennt — ohne sie verschwimmt ein dunkelgrüner Tank im dunklen Feld.
     */
    const flaeche = (punkte, farbe) => {
      const p = punkte.map(dreh);
      g.lineStyle(3, charakter.dunkel, 1);
      g.fillStyle(charakter.dunkel, 1);
      g.strokePoints(p, true, true);
      g.fillPoints(p, true);
      g.lineStyle(0, 0, 0);
      g.fillStyle(farbe, 1);
      g.fillPoints(p, true);
    };

    const teile = Charaktere.teile(charakter, mitte);
    teile.forEach(({ punkte, farbe }) => flaeche(punkte, farbe));

    g.generateTexture(schluessel, kante, kante);
    g.destroy();

    return schluessel;
  },

  /**
   * Die Figur als Liste von Vielecken, von hinten nach vorn. Getrennt vom
   * Zeichnen, damit sich die Gestalt lesen lässt, ohne durch Grafikaufrufe zu
   * waten — und damit ein Test die Umrisse nachrechnen kann.
   */
  teile(charakter, mitte) {
    const f = charakter.gestalt;
    const x = (versatz) => mitte + versatz;
    const teile = [];

    // --- Beine: nach unten schmaler, damit der Stand fest wirkt ---
    [-1, 1].forEach((seite) => {
      teile.push({
        farbe: charakter.bein,
        punkte: [
          { x: x(seite * (f.beinAbstand - f.beinHalb)), y: f.taillenY - 2 },
          { x: x(seite * (f.beinAbstand + f.beinHalb)), y: f.taillenY - 2 },
          { x: x(seite * (f.beinAbstand + f.beinHalb * 0.8)), y: f.fussY },
          { x: x(seite * (f.beinAbstand - f.beinHalb * 0.8)), y: f.fussY },
        ],
      });
    });

    // --- Stiefel: breiter als das Bein, das erdet die Figur ---
    [-1, 1].forEach((seite) => {
      teile.push({
        farbe: charakter.stiefel,
        punkte: [
          { x: x(seite * (f.beinAbstand - f.beinHalb)), y: f.fussY - 2 },
          { x: x(seite * (f.beinAbstand + f.beinHalb)), y: f.fussY - 2 },
          { x: x(seite * (f.beinAbstand + f.fussHalb)), y: f.fussBis },
          { x: x(seite * (f.beinAbstand - f.fussHalb)), y: f.fussBis },
        ],
      });
    });

    // --- Arme: keilförmig, oben breit an der Schulter ---
    [-1, 1].forEach((seite) => {
      const aussen = f.schulterHalb;
      const innen = f.schulterHalb - f.armDicke;
      teile.push({
        farbe: charakter.anzug,
        punkte: [
          { x: x(seite * innen), y: f.schulterY },
          { x: x(seite * aussen), y: f.schulterY },
          { x: x(seite * (aussen + 1)), y: f.armBis },
          { x: x(seite * (innen + 1.5)), y: f.armBis },
        ],
      });
    });

    // --- Rumpf: abgeschrägte Schultern, zur Taille verjüngt ---
    teile.push({
      farbe: charakter.anzug,
      punkte: [
        { x: x(-f.schulterHalb * 0.7), y: f.schulterY - 5 },
        { x: x(f.schulterHalb * 0.7), y: f.schulterY - 5 },
        { x: x(f.schulterHalb), y: f.schulterY + 3 },
        { x: x(f.taillenHalb), y: f.taillenY },
        { x: x(-f.taillenHalb), y: f.taillenY },
        { x: x(-f.schulterHalb), y: f.schulterY + 3 },
      ],
    });

    // --- Kopf: facettierter Helm statt Kreis ---
    teile.push({
      farbe: charakter.anzug,
      punkte: [
        { x: x(-f.kopfHalb * 0.55), y: f.kopfOben },
        { x: x(f.kopfHalb * 0.55), y: f.kopfOben },
        { x: x(f.kopfHalb), y: f.kopfOben + 6 },
        { x: x(f.kinnHalb), y: f.kopfUnten },
        { x: x(-f.kinnHalb), y: f.kopfUnten },
        { x: x(-f.kopfHalb), y: f.kopfOben + 6 },
      ],
    });

    Charaktere.plattenAnhaengen(teile, charakter, mitte);
    return teile;
  },

  /**
   * Die Panzerung — die zwei bis drei großen Flächen, die den Charakter
   * ausmachen. Bewusst wenige und groß: Zwei kleine Details heben sich bei 48
   * Pixeln gegenseitig auf, eine große Fläche bleibt eine große Fläche.
   */
  plattenAnhaengen(teile, charakter, mitte) {
    const f = charakter.gestalt;
    const x = (versatz) => mitte + versatz;

    if (charakter.id === 'ausgewogen') {
      // Zwei weiße Schulterplatten, eckig und deutlich abgesetzt
      [-1, 1].forEach((seite) => {
        teile.push({
          farbe: charakter.akzent,
          punkte: [
            { x: x(seite * f.schulterHalb * 0.42), y: f.schulterY - 4 },
            { x: x(seite * (f.schulterHalb + 1)), y: f.schulterY + 2 },
            { x: x(seite * (f.schulterHalb + 1)), y: f.schulterY + 12 },
            { x: x(seite * f.schulterHalb * 0.42), y: f.schulterY + 9 },
          ],
        });
      });

      // Weiße Brustplatte als breiter Keil — die größte helle Fläche im Bild
      teile.push({
        farbe: charakter.akzent,
        punkte: [
          { x: x(-9), y: f.schulterY + 5 },
          { x: x(9), y: f.schulterY + 5 },
          { x: x(6), y: f.taillenY - 8 },
          { x: x(0), y: f.taillenY - 3 },
          { x: x(-6), y: f.taillenY - 8 },
        ],
      });

      // Kurzes dunkles Haar als Kappe über der Stirn
      teile.push({
        farbe: charakter.dunkel,
        punkte: [
          { x: x(-f.kopfHalb * 0.6), y: f.kopfOben - 1 },
          { x: x(f.kopfHalb * 0.6), y: f.kopfOben - 1 },
          { x: x(f.kopfHalb + 1), y: f.kopfOben + 5 },
          { x: x(f.kopfHalb - 1), y: f.kopfOben + 6 },
          { x: x(-f.kopfHalb + 1), y: f.kopfOben + 6 },
          { x: x(-f.kopfHalb - 1), y: f.kopfOben + 5 },
        ],
      });
    } else if (charakter.id === 'schnell') {
      // Orangefarbener Schrägstreifen über die Brust — eine einzige, klar
      // gerichtete Fläche. Die Schräge deutet Bewegung an, ohne dass es dafür
      // Striche braucht, die bei dieser Größe verschwinden.
      teile.push({
        farbe: charakter.akzent,
        punkte: [
          { x: x(-f.schulterHalb + 2), y: f.schulterY + 2 },
          { x: x(f.schulterHalb - 3), y: f.schulterY + 9 },
          { x: x(f.taillenHalb - 1), y: f.taillenY - 2 },
          { x: x(-f.schulterHalb + 3), y: f.schulterY + 11 },
        ],
      });

      // Orangefarbene Unterarme. Zusammen mit Schrägstreifen, Helmkamm und
      // Stiefeln ergibt das genug helle Fläche, um die Figur auf dem dunklen
      // Boden überhaupt zu finden — eine dunkle Kontur trennt auf dunklem Grund
      // nichts, das leisten nur die hellen Teile.
      [-1, 1].forEach((seite) => {
        const aussen = f.schulterHalb;
        const innen = f.schulterHalb - f.armDicke;
        teile.push({
          farbe: charakter.akzent,
          punkte: [
            { x: x(seite * (innen + 0.8)), y: f.schulterY + 12 },
            { x: x(seite * (aussen + 0.5)), y: f.schulterY + 12 },
            { x: x(seite * (aussen + 1)), y: f.armBis },
            { x: x(seite * (innen + 1.5)), y: f.armBis },
          ],
        });
      });

      // Orangefarbener Helmkamm — spitz nach hinten, in Fahrtrichtung gelesen
      teile.push({
        farbe: charakter.akzent,
        punkte: [
          { x: x(-f.kopfHalb * 0.55), y: f.kopfOben },
          { x: x(f.kopfHalb * 0.55), y: f.kopfOben },
          { x: x(f.kopfHalb), y: f.kopfOben + 6 },
          { x: x(f.kopfHalb - 4), y: f.kopfOben + 8 },
          { x: x(-f.kopfHalb), y: f.kopfOben + 7 },
        ],
      });
    } else {
      // Zwei schwere, eckige Schulterpanzer — sie machen den Umriss oben
      // deutlich breiter als alles andere im Spiel und sind das Merkmal, an
      // dem man den Tank auch aus dem Augenwinkel erkennt.
      [-1, 1].forEach((seite) => {
        teile.push({
          farbe: charakter.akzent,
          punkte: [
            { x: x(seite * f.schulterHalb * 0.5), y: f.schulterY - 6 },
            { x: x(seite * (f.schulterHalb + 3)), y: f.schulterY - 2 },
            { x: x(seite * (f.schulterHalb + 3)), y: f.schulterY + 14 },
            { x: x(seite * f.schulterHalb * 0.5), y: f.schulterY + 12 },
          ],
        });
      });

      // Ein schmales dunkles Brustband, nicht der ganze Rumpf: Grün ist die
      // Kennfarbe des Tanks, eine graue Platte über die volle Höhe deckt sie zu
      // und macht ihn auf dem dunklen Boden zum Schatten.
      teile.push({
        farbe: charakter.akzent,
        punkte: [
          { x: x(-f.schulterHalb * 0.46), y: f.schulterY + 2 },
          { x: x(f.schulterHalb * 0.46), y: f.schulterY + 2 },
          { x: x(f.schulterHalb * 0.4), y: f.schulterY + 13 },
          { x: x(-f.schulterHalb * 0.4), y: f.schulterY + 13 },
        ],
      });
    }
  },

  /** Die Figur als Bild für die Auswahlkarte — dieselbe Textur, nur größer. */
  zeichen(scene, charakter, y) {
    // Groß und weit oben: Die Karte ist 300 Pixel hoch, zwischen Farbband und
    // Titel liegen rund 110 davon — die gehören der Figur. Der Versatz nach
    // oben ist nötig, weil sie sonst unten an den Titel stößt.
    const bild = scene.add.image(0, y - 2, Charaktere.bildSchluessel(scene, charakter));

    // Ins Quadrat einpassen statt hart auf 96 x 96 zu zwingen: Ein Bild mit
    // anderem Seitenverhältnis würde sonst verzerrt. Beim Verkleinern zählt
    // die längere Kante, damit nichts über den Rahmen hinausragt.
    Charaktere.einpassen(bild, 96);
    return bild;
  },
};
