/**
 * Die Aufwertungen, die nach jeder Welle zur Wahl stehen.
 *
 * Wirkung und Beschriftung stehen bewusst in **derselben** Zeile: Stünde die
 * Zahl im Spielercode und der Text hier, würde eine Änderung irgendwann nur an
 * einer der beiden Stellen ankommen — und eine Karte, die etwas anderes tut,
 * als sie verspricht, ist schlimmer als gar keine Karte.
 *
 * Jede Aufwertung hat eine Obergrenze. Ohne sie stapelt man in Welle 20
 * fünfmal „Mehr Tempo" und läuft schneller, als die Anzeige mitkommt; und
 * ausgereizte Karten sollen aus der Auswahl verschwinden, statt einen Platz zu
 * belegen, an dem noch etwas Nützliches stehen könnte.
 */
const Aufwertungen = {
  LISTE: [
    {
      id: 'leben',
      titel: '+1 Leben',
      wirkung: 'Ein Herz mehr, sofort aufgefüllt',
      farbe: 0xe8455f,
      maxStufe: 3, // 5 → 8
      anwenden(spieler) {
        spieler.maxLebenspunkte += 1;
        spieler.lebenspunkte += 1;
      },
    },
    {
      id: 'schuss',
      titel: 'Schnellere Schüsse',
      wirkung: 'Kürzere Pause zwischen den Schüssen',
      farbe: 0xf1c40f,
      maxStufe: 4, // 250 → 110 ms
      anwenden(spieler) {
        spieler.schussVerzoegerungMs = Math.max(110, spieler.schussVerzoegerungMs - 35);
      },
    },
    {
      id: 'tempo',
      titel: 'Mehr Tempo',
      wirkung: 'Der Spieler läuft schneller',
      farbe: 0x5b9dff,
      maxStufe: 5, // 200 → 290
      anwenden(spieler) {
        spieler.geschwindigkeit = Math.min(290, spieler.geschwindigkeit + 18);
      },
    },
    {
      id: 'schaden',
      titel: 'Stärkere Kugeln',
      wirkung: 'Ein Treffer erledigt einen Gegner',
      farbe: 0xff8c42,
      // Nur eine Stufe: Ein Gegner hält zwei Treffer aus, mehr als zwei Schaden
      // wäre also wirkungslos — eine Karte, die nichts mehr tut, darf nicht in
      // der Auswahl stehen.
      maxStufe: 1,
      anwenden(spieler) {
        spieler.schaden += 1;
      },
    },
    {
      id: 'reichweite',
      titel: 'Größere Reichweite',
      wirkung: 'Das Auto-Feuer greift weiter',
      farbe: 0x7ee081,
      maxStufe: 4, // 460 → 820
      anwenden(spieler) {
        spieler.feuerReichweite = Math.min(820, spieler.feuerReichweite + 90);
      },
    },
  ],

  nachId(id) {
    return Aufwertungen.LISTE.find((a) => a.id === id) || null;
  },

  /**
   * Einfaches Zeichen je Aufwertung — Form, nicht nur Farbe.
   *
   * Steht hier und nicht in `Auswahl`: Der Auswahlbildschirm ist für Karten
   * jeder Art zuständig und soll nicht wissen, wie eine Aufwertung aussieht.
   */
  zeichen(scene, karte, y) {
    if (karte.id === 'leben') {
      const bild = scene.add.image(0, y, Lebensanzeige.erzeugeTextur(scene, true));
      bild.setDisplaySize(46, 46);
      return bild;
    }

    const g = scene.add.graphics();
    g.fillStyle(karte.farbe, 1);
    g.lineStyle(4, karte.farbe, 1);

    if (karte.id === 'schuss') {
      // Drei Kugeln in einer Reihe = schnelle Folge
      [-22, 0, 22].forEach((dx) => g.fillCircle(dx, y, 7));
    } else if (karte.id === 'tempo') {
      // Doppelter Winkel nach rechts
      [-10, 10].forEach((dx) => {
        g.beginPath();
        g.moveTo(dx - 8, y - 14);
        g.lineTo(dx + 8, y);
        g.lineTo(dx - 8, y + 14);
        g.strokePath();
      });
    } else if (karte.id === 'schaden') {
      // Eine große Kugel neben einer kleinen = mehr Wumms
      g.fillCircle(-16, y, 6);
      g.fillCircle(12, y, 16);
    } else {
      // Reichweite: Ringe, die nach außen größer werden
      [9, 17, 25].forEach((r, i) => {
        g.lineStyle(3, karte.farbe, 1 - i * 0.28);
        g.strokeCircle(0, y, r);
      });
    }

    return g;
  },

  /** Alles, was noch nicht ausgereizt ist. */
  verfuegbare(stufen) {
    return Aufwertungen.LISTE.filter((a) => (stufen[a.id] || 0) < a.maxStufe);
  },

  /**
   * Kongruenzgenerator mit fester Saat statt `Math.random`. Welche Karten
   * angeboten werden, ist eine Spielregel — dieselbe Runde soll sich
   * nachstellen lassen, sonst ist ein Fehlerbericht („in Welle 4 stand da eine
   * Karte, die nichts tat") nicht nachvollziehbar.
   */
  wuerfel(saat) {
    let s = (saat >>> 0) || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  },

  /**
   * Bis zu `anzahl` verschiedene Karten. Sind weniger übrig, kommen eben
   * weniger — und wenn gar nichts mehr offen ist, eine leere Liste. Die Szene
   * überspringt die Auswahl dann ganz, statt einen leeren Bildschirm zu
   * zeigen, auf dem nichts anzutippen ist.
   */
  auswahl(stufen, saat, anzahl = 3) {
    const offen = Aufwertungen.verfuegbare(stufen);
    const naechste = Aufwertungen.wuerfel(saat);
    const gezogen = [];

    // Fisher-Yates auf einer Kopie: zieht ohne Zurücklegen, also nie zweimal
    // dieselbe Karte in einer Auswahl.
    const topf = offen.slice();
    for (let i = topf.length - 1; i > 0; i -= 1) {
      const j = Math.floor(naechste() * (i + 1));
      [topf[i], topf[j]] = [topf[j], topf[i]];
    }

    for (let i = 0; i < Math.min(anzahl, topf.length); i += 1) gezogen.push(topf[i]);
    return gezogen;
  },
};
