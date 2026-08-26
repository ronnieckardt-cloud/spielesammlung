/**
 * Die drei Startcharaktere — reine Daten, keine Grafik.
 *
 * Alles, was den Spieler ausmacht, steht hier an einer Stelle: Der Spieler
 * liest seine Startwerte vollständig aus `werte`, nichts davon ist im
 * Spielercode noch einmal fest verdrahtet. Sonst gälte für einen Wert der
 * Charakter und für den nächsten die alte Zahl, und das fiele erst beim
 * Spielen auf.
 *
 * Die Aufwertungen aus `aufwertungen.js` rechnen auf diese Werte **auf**,
 * ersetzen sie also nicht — „Mehr Tempo" macht den Schnellen schneller als
 * den Tank, und das soll auch so bleiben.
 */
const Charaktere = {
  LISTE: [
    {
      id: 'ausgewogen',
      name: 'Ausgewogen',
      staerke: 'Kann alles ein bisschen — gut zum Anfangen',
      farbe: 0x4a90e2,
      zweitfarbe: 0xf2f6ff,
      hosenfarbe: 0x2f4f7d,
      dunkel: 0x14243d,
      gestalt: {
        kopf: { y: 22, r: 11 },
        schulterY: 34,
        schulterHalb: 17,
        taillenY: 57,
        taillenHalb: 12,
        armBreite: 7,
        beinBreite: 10,
        beinAbstand: 8,
        beinBis: 87,
        neigung: 0,
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
      // Bewusst ein gelbstichiges Orange, kein rötliches: Die Gegner sind rot
      // (0xe74c3c), und bei Tempo 275 quer über die Arena entscheidet der
      // Farbabstand mit darüber, ob man sich selbst noch findet.
      farbe: 0xff9f1c,
      zweitfarbe: 0x1a1a22,
      hosenfarbe: 0x1a1a22,
      dunkel: 0x3d2200,
      gestalt: {
        kopf: { y: 24, r: 10 },
        schulterY: 35,
        schulterHalb: 13,
        taillenY: 56,
        taillenHalb: 9,
        armBreite: 6,
        beinBreite: 8,
        beinAbstand: 11,
        beinBis: 87,
        // Nach vorn geneigt — das ist bei 32 Pixeln das einzige Merkmal
        // „Bewegung", das noch ankommt.
        neigung: 0.2,
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
      farbe: 0x4caf50,
      zweitfarbe: 0x39404a,
      hosenfarbe: 0x39404a,
      dunkel: 0x11301a,
      gestalt: {
        kopf: { y: 26, r: 10 },
        schulterY: 36,
        // Doppelt so breit wie beim Schnellen — der Unterschied muss allein
        // über den Umriss ankommen, Details sind bei 32 Pixeln längst Matsch.
        schulterHalb: 25,
        taillenY: 62,
        taillenHalb: 16,
        armBreite: 9,
        beinBreite: 13,
        beinAbstand: 10,
        beinBis: 88,
        neigung: 0,
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
   * sagt einem Kind nichts, „sehr schnell" schon — und die Zahl steht ohnehin
   * nirgends im Spiel, mit der man sie vergleichen könnte.
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

  /**
   * Zeichnet die Figur **einmal** in eine 96er-Textur; Spielfeld und Karte
   * benutzen dieselbe, nur in unterschiedlicher Größe.
   *
   * Groß zeichnen und klein anzeigen ist hier keine Bequemlichkeit: Im Spiel
   * ist die Figur 32 Pixel breit, auf einem iPhone im Querformat noch rund 20
   * physische. Direkt in 32 Pixel gezeichnet würde jede Kante ausfransen; aus
   * einer 96er-Textur heruntergerechnet bleibt sie sauber.
   *
   * Und deshalb steht auch alles Erkennbare im **Umriss**: Breite, Stand,
   * Neigung. Bei zwanzig Pixeln kommt kein Detail mehr an — dieselbe Lehre wie
   * beim Männchen in Ghost Chase, wo mehr Realismus die Figur schlechter
   * erkennbar gemacht hätte.
   */
  erzeugeTextur(scene, charakter) {
    const schluessel = `figur-${charakter.id}`;
    if (scene.textures.exists(schluessel)) return schluessel;

    const kante = Charaktere.TEXTUR_KANTE;
    const mitte = kante / 2;
    const f = charakter.gestalt;
    const g = scene.add.graphics();

    // Um den Bauchnabel kippen, nicht um die Bildmitte — sonst hebt eine
    // geneigte Figur die Füße vom Boden.
    const drehpunkt = { x: mitte, y: f.taillenY };
    const dreh = (p) => {
      if (!f.neigung) return p;
      const sin = Math.sin(f.neigung);
      const cos = Math.cos(f.neigung);
      const dx = p.x - drehpunkt.x;
      const dy = p.y - drehpunkt.y;
      return { x: drehpunkt.x + dx * cos - dy * sin, y: drehpunkt.y + dx * sin + dy * cos };
    };

    // Jede Fläche zuerst dunkel und etwas größer, dann farbig darüber. Das gibt
    // eine Kontur, ohne jede Form zweimal beschreiben zu müssen — und die
    // Kontur ist bei dieser Größe das, was die Figur vom Hintergrund trennt.
    const kontur = 5;
    const flaeche = (zeichnen) => {
      g.lineStyle(kontur, charakter.dunkel, 1);
      g.fillStyle(charakter.dunkel, 1);
      zeichnen(true);
      g.lineStyle(0, 0, 0);
      zeichnen(false);
    };

    const balken = (x, y, breite, hoehe, radius, farbe) => {
      const eck = dreh({ x, y });
      flaeche((istKontur) => {
        g.fillStyle(istKontur ? charakter.dunkel : farbe, 1);
        if (istKontur) {
          g.strokeRoundedRect(eck.x, eck.y, breite, hoehe, radius);
          g.fillRoundedRect(eck.x, eck.y, breite, hoehe, radius);
        } else {
          g.fillRoundedRect(eck.x, eck.y, breite, hoehe, radius);
        }
      });
    };

    const vieleck = (punkte, farbe) => {
      const gedreht = punkte.map(dreh);
      flaeche((istKontur) => {
        g.fillStyle(istKontur ? charakter.dunkel : farbe, 1);
        if (istKontur) g.strokePoints(gedreht, true, true);
        g.fillPoints(gedreht, true);
      });
    };

    // --- Beine (zuerst, damit der Rumpf darüber liegt) ---
    [-1, 1].forEach((seite) => {
      balken(
        mitte + seite * f.beinAbstand - f.beinBreite / 2,
        f.taillenY - 4,
        f.beinBreite,
        f.beinBis - f.taillenY + 4,
        f.beinBreite / 2,
        charakter.hosenfarbe,
      );
    });

    // --- Arme ---
    [-1, 1].forEach((seite) => {
      balken(
        mitte + seite * (f.schulterHalb - 1) - f.armBreite / 2,
        f.schulterY,
        f.armBreite,
        f.taillenY - f.schulterY + 6,
        f.armBreite / 2,
        charakter.farbe,
      );
    });

    // --- Rumpf: breite Schultern, schmalere Taille ---
    vieleck([
      { x: mitte - f.schulterHalb, y: f.schulterY },
      { x: mitte + f.schulterHalb, y: f.schulterY },
      { x: mitte + f.taillenHalb, y: f.taillenY },
      { x: mitte - f.taillenHalb, y: f.taillenY },
    ], charakter.farbe);

    // --- Kopf ---
    const kopf = dreh({ x: mitte, y: f.kopf.y });
    flaeche((istKontur) => {
      g.fillStyle(istKontur ? charakter.dunkel : charakter.farbe, 1);
      if (istKontur) g.strokeCircle(kopf.x, kopf.y, f.kopf.r);
      g.fillCircle(kopf.x, kopf.y, f.kopf.r);
    });

    Charaktere.merkmalZeichnen(g, charakter, { mitte, f, dreh, kopf });

    g.generateTexture(schluessel, kante, kante);
    g.destroy();

    return schluessel;
  },

  /**
   * Das eine Merkmal je Charakter, das über den Umriss hinausgeht. Bewusst nur
   * eines und großflächig: Zwei kleine Details heben sich bei 32 Pixeln
   * gegenseitig auf.
   */
  merkmalZeichnen(g, charakter, { mitte, f, dreh, kopf }) {
    if (charakter.id === 'ausgewogen') {
      // Weißer Brustkeil — hell auf Blau, der stärkste Kontrast im Bild
      const punkte = [
        { x: mitte - 7, y: f.schulterY + 4 },
        { x: mitte + 7, y: f.schulterY + 4 },
        { x: mitte + 4, y: f.taillenY - 4 },
        { x: mitte - 4, y: f.taillenY - 4 },
      ].map(dreh);
      g.fillStyle(charakter.zweitfarbe, 1);
      g.fillPoints(punkte, true);
    } else if (charakter.id === 'schnell') {
      // Schwarzes Visier quer über den Kopf
      const links = dreh({ x: mitte - f.kopf.r, y: f.kopf.y - 1 });
      const rechts = dreh({ x: mitte + f.kopf.r, y: f.kopf.y - 1 });
      g.lineStyle(7, charakter.zweitfarbe, 1);
      g.beginPath();
      g.moveTo(links.x, links.y);
      g.lineTo(rechts.x, rechts.y);
      g.strokePath();
      g.lineStyle(0, 0, 0);
    } else {
      // Zwei dunkle Schulterplatten — sie machen den Tank oben noch breiter
      [-1, 1].forEach((seite) => {
        const p = dreh({ x: mitte + seite * (f.schulterHalb - 4), y: f.schulterY + 4 });
        g.fillStyle(charakter.zweitfarbe, 1);
        g.fillCircle(p.x, p.y, 9);
        g.lineStyle(4, charakter.dunkel, 1);
        g.strokeCircle(p.x, p.y, 9);
        g.lineStyle(0, 0, 0);
      });
    }
  },

  /** Die Figur als Bild für die Auswahlkarte — dieselbe Textur, nur größer. */
  zeichen(scene, charakter, y) {
    const bild = scene.add.image(0, y + 8, Charaktere.erzeugeTextur(scene, charakter));
    bild.setDisplaySize(84, 84);
    return bild;
  },
};
