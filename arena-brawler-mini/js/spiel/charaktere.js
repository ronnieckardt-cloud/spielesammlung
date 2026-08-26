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
      farbe: 0x5b9dff,
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
      farbe: 0x7ee081,
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
      farbe: 0xff8c42,
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

  /** Einfaches Zeichen je Charakter — Form, nicht nur Farbe. */
  zeichen(scene, charakter, y) {
    const g = scene.add.graphics();
    const kante = 26;

    if (charakter.id === 'schnell') {
      // Schmaler Körper mit Fahrtwind-Strichen dahinter
      g.fillStyle(charakter.farbe, 1);
      g.fillRoundedRect(-6, y - kante / 2, kante - 6, kante, 4);
      g.lineStyle(3, charakter.farbe, 0.55);
      [-8, 0, 8].forEach((dy, i) => {
        g.beginPath();
        g.moveTo(-14 - i * 4, y + dy);
        g.lineTo(-30 - i * 6, y + dy);
        g.strokePath();
      });
    } else if (charakter.id === 'tank') {
      // Breiter Körper mit Panzerung ringsum
      g.lineStyle(4, charakter.farbe, 0.5);
      g.strokeRoundedRect(-kante / 2 - 9, y - kante / 2 - 9, kante + 18, kante + 18, 8);
      g.fillStyle(charakter.farbe, 1);
      g.fillRoundedRect(-kante / 2 - 3, y - kante / 2, kante + 6, kante, 5);
    } else {
      g.fillStyle(charakter.farbe, 1);
      g.fillRoundedRect(-kante / 2, y - kante / 2, kante, kante, 5);
    }

    return g;
  },
};
