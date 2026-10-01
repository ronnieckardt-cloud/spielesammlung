import { describe, expect, it } from 'vitest';
import {
  ANLAUF,
  BOOST_UEBER_TEMPO,
  KEINE_EINGABE,
  LANDUNG_GUT,
  LANDUNG_HART,
  LANDUNG_PERFEKT,
  MISSION_NAMEN,
  MUENZ_PUNKTE,
  PAD_PUNKTE,
  POP_FENSTER,
  POP_PUNKTE,
  POP_SCHUB,
  SCHWERKRAFT,
  TEMPO_MAX,
  TRICK_PUNKTE_JE_DREHUNG,
  biomVon,
  bodenHoehe,
  bodenKruemmung,
  bodenSteigung,
  bodenWinkel,
  gelaendeBauen,
  landungBewerten,
  missionFortschritt,
  missionsLohn,
  neueMission,
  neuesSpiel,
  punkte,
  streckenSaat,
  takt,
  winkelKuerzen,
} from './logik';
import type { Eingabe, Lauf } from './logik';

const SAAT = streckenSaat(1);

/** Spielt eine Weile mit fester Eingabe. */
function fahren(l: Lauf, sekunden: number, e?: Eingabe | ((l: Lauf) => Eingabe), dt = 1 / 60): Lauf {
  for (let t = 0; t < sekunden && !l.vorbei; t += dt) {
    const eingabe = typeof e === 'function' ? e(l) : e;
    l = takt(l, dt, eingabe);
  }
  return l;
}

const GAS: Eingabe = { gas: true, bremse: false, lehnen: 0 };

describe('Gelände', () => {
  it('ergibt bei gleicher Saat exakt dasselbe Gelände', () => {
    expect(gelaendeBauen(SAAT)).toEqual(gelaendeBauen(SAAT));
  });

  it('ergibt bei anderer Saat ein anderes Gelände', () => {
    expect(gelaendeBauen(streckenSaat(1))).not.toEqual(gelaendeBauen(streckenSaat(2)));
  });

  it('ist am Anfang flach, damit man erst ankommt', () => {
    const g = gelaendeBauen(SAAT);
    for (let x = 0; x <= ANLAUF; x += 2) {
      expect(bodenHoehe(g, x)).toBe(0);
      expect(bodenSteigung(g, x)).toBe(0);
    }
  });

  it('hat keine Sprünge in der Höhe — der Boden ist überall stetig', () => {
    // Eine Stufe im Boden wäre eine unsichtbare Wand: Das Rad stünde
    // schlagartig woanders, und die Landungsbewertung liefe Amok.
    const g = gelaendeBauen(SAAT);
    let vorher = bodenHoehe(g, 0);
    for (let x = 0.1; x < g.laenge; x += 0.1) {
      const jetzt = bodenHoehe(g, x);
      expect(Math.abs(jetzt - vorher), `Stufe bei x=${x.toFixed(1)}`).toBeLessThan(0.5);
      vorher = jetzt;
    }
  });

  /**
   * Der wichtigste Geländetest: Die von Hand hergeleitete Ableitung muss
   * mit der numerischen übereinstimmen.
   *
   * An `bodenSteigung` hängt der Absprungwinkel und damit die gesamte
   * Landungsbewertung. Ein Vorzeichen- oder Kettenregelfehler fiele im
   * Bild nie eindeutig auf — man würde nur „die Sprünge fühlen sich
   * komisch an" sagen und ewig an den falschen Stellschrauben drehen.
   */
  it('liefert eine Steigung, die zur Höhenfunktion passt', () => {
    const g = gelaendeBauen(SAAT);
    const eps = 0.001;
    for (let x = ANLAUF + 20; x < g.laenge - 10; x += 0.7) {
      const numerisch = (bodenHoehe(g, x + eps) - bodenHoehe(g, x - eps)) / (2 * eps);
      expect(bodenSteigung(g, x), `Steigung bei x=${x.toFixed(1)}`).toBeCloseTo(numerisch, 3);
    }
  });

  it('liefert eine Krümmung, die zur Steigung passt', () => {
    // An ihr hängt, ob und wann das Rad abhebt — dieselbe Vorsicht wie
    // bei der ersten Ableitung.
    const g = gelaendeBauen(SAAT);
    const eps = 0.002;
    for (let x = ANLAUF + 20; x < g.laenge - 10; x += 1.3) {
      const numerisch = (bodenSteigung(g, x + eps) - bodenSteigung(g, x - eps)) / (2 * eps);
      expect(bodenKruemmung(g, x), `Krümmung bei x=${x.toFixed(1)}`).toBeCloseTo(numerisch, 1);
    }
  });

  it('ist auf jeder Kicker-Kuppe nach unten gekrümmt', () => {
    // Nur eine konvexe Kuppe lässt das Rad abheben. Wäre ein Kicker dort
    // nach oben gekrümmt, wäre er eine Mulde und nie ein Sprung.
    const g = gelaendeBauen(SAAT);
    for (const k of g.kicker) {
      expect(bodenKruemmung(g, k.x), `Kicker bei ${k.x}`).toBeLessThan(0);
    }
  });

  it('setzt Sprungschanzen erst nach dem Anlauf und vor dem Ziel', () => {
    for (let n = 1; n <= 20; n++) {
      const g = gelaendeBauen(streckenSaat(n));
      for (const k of g.kicker) {
        expect(k.x, `Strecke ${n}`).toBeGreaterThan(ANLAUF);
        expect(k.x, `Strecke ${n}`).toBeLessThan(g.laenge);
        // Zu schmale Glocken wären Stufen statt Rampen — siehe die 2,4-m-
        // Untergrenze in `gelaendeBauen`.
        expect(k.breite, `Strecke ${n}`).toBeGreaterThan(2.4);
      }
    }
  });

  it('macht die Sprünge über die Strecke hinweg größer', () => {
    // Ronni: „Die Schwierigkeit soll langsam steigen." Das muss auch
    // innerhalb einer Strecke gelten, nicht nur zwischen Strecken.
    const g = gelaendeBauen(SAAT);
    const ersten = g.kicker.slice(0, 3);
    const letzten = g.kicker.slice(-3);
    const schnitt = (l: typeof ersten) => l.reduce((s, k) => s + k.hoehe, 0) / l.length;
    expect(schnitt(letzten)).toBeGreaterThan(schnitt(ersten));
  });
});

describe('winkelKuerzen', () => {
  it('lässt kleine Winkel unverändert', () => {
    expect(winkelKuerzen(0.3)).toBeCloseTo(0.3, 9);
    expect(winkelKuerzen(-0.3)).toBeCloseTo(-0.3, 9);
  });

  it('kürzt volle Umdrehungen weg', () => {
    // Der Grund: Nach zwei Saltos steht der Winkel bei rund −12,6 — ohne
    // Kürzung wäre jede Landung danach ein Sturz, obwohl das Rad richtig
    // herum liegt.
    expect(winkelKuerzen(Math.PI * 2 + 0.2)).toBeCloseTo(0.2, 9);
    expect(winkelKuerzen(-Math.PI * 4 + 0.2)).toBeCloseTo(0.2, 9);
  });

  it('bleibt immer zwischen −π und π', () => {
    for (let w = -30; w < 30; w += 0.37) {
      const r = winkelKuerzen(w);
      expect(r).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
      expect(r).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });
});

describe('landungBewerten', () => {
  it('staffelt von perfekt bis Sturz', () => {
    expect(landungBewerten(0)).toBe('perfekt');
    expect(landungBewerten(LANDUNG_PERFEKT - 0.01)).toBe('perfekt');
    expect(landungBewerten(LANDUNG_PERFEKT + 0.01)).toBe('gut');
    expect(landungBewerten(LANDUNG_GUT + 0.01)).toBe('hart');
    expect(landungBewerten(LANDUNG_HART + 0.01)).toBe('sturz');
  });

  it('bewertet nach beiden Seiten gleich', () => {
    // Vorderrad zu hoch und Vorderrad zu tief sind gleich schwer.
    for (const d of [0.1, 0.4, 0.8, 1.5]) {
      expect(landungBewerten(d)).toBe(landungBewerten(-d));
    }
  });

  it('wertet eine Landung nach vollem Salto nach dem echten Winkel', () => {
    expect(landungBewerten(Math.PI * 2)).toBe('perfekt');
    expect(landungBewerten(-Math.PI * 2 + 0.1)).toBe('perfekt');
  });
});

describe('Fahren', () => {
  it('steht am Anfang still und fährt erst auf Gas los', () => {
    const start = neuesSpiel(SAAT);
    expect(start.vx).toBe(0);
    const ohne = takt(start, 0.5);
    expect(ohne.x).toBe(start.x);
    const mit = takt(start, 0.5, GAS);
    expect(mit.vx).toBeGreaterThan(0);
    expect(mit.x).toBeGreaterThan(start.x);
  });

  it('überschreitet das Höchsttempo nie', () => {
    const l = fahren(neuesSpiel(SAAT), 60, GAS);
    expect(l.vx).toBeLessThanOrEqual(TEMPO_MAX + 1e-9);
  });

  it('bremst nie ins Rückwärtsfahren', () => {
    // Sonst liefe das Gelände rückwärts durch — ein Fehler, den man erst
    // im Bild sähe, und dann als „das Spiel spinnt".
    let l = fahren(neuesSpiel(SAAT), 2, GAS);
    l = fahren(l, 4, { gas: false, bremse: true, lehnen: 0 });
    expect(l.vx).toBeGreaterThanOrEqual(0);
    expect(l.x).toBeGreaterThanOrEqual(0);
  });

  it('wird bergab schneller, auch ohne Gas', () => {
    // Der Hangabtrieb ist der Grund, warum Anlauf nehmen funktioniert.
    const g = gelaendeBauen(SAAT);
    // Eine Stelle suchen, an der es deutlich bergab geht.
    let stelle = 0;
    for (let x = ANLAUF + 20; x < g.laenge - 50; x += 0.5) {
      if (bodenSteigung(g, x) < -0.25) {
        stelle = x;
        break;
      }
    }
    expect(stelle, 'es muss irgendwo bergab gehen').toBeGreaterThan(0);

    const start: Lauf = { ...neuesSpiel(SAAT), x: stelle, y: bodenHoehe(g, stelle), vx: 2 };
    const danach = takt(start, 0.2);
    expect(danach.vx).toBeGreaterThan(start.vx);
  });

  it('hebt bei Tempo ab, rollt langsam aber nur drüber', () => {
    const g = gelaendeBauen(SAAT);
    const kicker = g.kicker[0]!;
    const stelle = kicker.x - 12;

    const schnell = fahren(
      { ...neuesSpiel(SAAT), x: stelle, y: bodenHoehe(g, stelle), vx: TEMPO_MAX },
      3,
      GAS,
    );
    expect(schnell.luftGesamt, 'schnell muss abheben').toBeGreaterThan(0);

    const langsam = fahren(
      { ...neuesSpiel(SAAT), x: stelle, y: bodenHoehe(g, stelle), vx: 1.5 },
      6,
      { gas: false, bremse: false, lehnen: 0 },
    );
    expect(langsam.luftGesamt, 'langsam bleibt am Boden').toBe(0);
  });

  it('hebt an derselben Stelle ab, egal bei welcher Bildrate', () => {
    /*
     * Der erste Versuch verglich eine Höhendifferenz mit
     * `SCHWERKRAFT * dt * 6` — der Schwellwert wuchs also mit dem
     * Zeitschritt, und dieselbe Fahrt hob bei 30 Bildern je Sekunde
     * woanders ab als bei 60. Jetzt entscheidet die Fliehkraft
     * (Krümmung × Tempo²), und darin kommt kein `dt` vor.
     */
    const stellen = [1 / 120, 1 / 60, 1 / 30].map((dt) => {
      let l = neuesSpiel(SAAT);
      for (let t = 0; t < 30 && l.amBoden; t += dt) l = takt(l, dt, GAS);
      return l.x;
    });
    expect(stellen[0]).toBeGreaterThan(0);
    for (const s of stellen) {
      expect(Math.abs(s - stellen[0]!) / stellen[0]!).toBeLessThan(0.02);
    }
  });

  it('lässt schon in der ersten Runde springen, ohne dass man etwas können muss', () => {
    // Ronni: „Außerdem will ich, dass man endlich mal springt." Wer nur
    // Gas gibt, muss binnen weniger Sekunden in der Luft sein.
    for (let n = 1; n <= 6; n++) {
      const l = fahren(neuesSpiel(streckenSaat(n)), 9, GAS);
      expect(l.luftGesamt, `Strecke ${n} ließ nicht springen`).toBeGreaterThan(0.25);
    }
  });

  it('dreht das Rad in der Luft, wenn man lehnt', () => {
    const g = gelaendeBauen(SAAT);
    const inDerLuft: Lauf = {
      ...neuesSpiel(SAAT),
      x: 200,
      y: bodenHoehe(g, 200) + 6,
      vx: 10,
      vy: 2,
      amBoden: false,
    };
    // „Hinten" (lehnen −1) muss das Vorderrad anheben (winkel steigt,
    // siehe Lauf.winkel), „Vorne" (lehnen +1) muss es senken — Rückmeldung:
    // „wenn ich den Pfeil nach hinten drücke, geht das Körpergewicht nicht
    // nach hinten, sondern nach vorne." Das war genau umgekehrt.
    const hinten = fahren(inDerLuft, 0.4, { gas: false, bremse: false, lehnen: -1 });
    const vorne = fahren(inDerLuft, 0.4, { gas: false, bremse: false, lehnen: 1 });
    expect(hinten.winkel).toBeGreaterThan(inDerLuft.winkel);
    expect(vorne.winkel).toBeLessThan(inDerLuft.winkel);
  });

  it('hält den Absprungwinkel ohne Eingabe nicht von selbst — man muss gegenlenken', () => {
    /*
     * Rückmeldung: „Ich muss überhaupt gar nicht Gewicht nach vorne oder
     * hinten legen — wenn ich einfach die ganze Zeit auf Gas drücke,
     * kriege ich meine Punkte. Das ist nicht so cool." Vorher blieb
     * `winkel` in der Luft ohne `lehnen`-Eingabe exakt beim
     * Absprungwinkel stehen. Jetzt driftet die Nase über die Flugzeit von
     * selbst nach unten (`NATUR_NICKEN`) — wer nicht gegenlenkt, landet
     * nach einem längeren Sprung spürbar schräger, als er abgesprungen ist.
     */
    const g = gelaendeBauen(SAAT);
    // Bewusst hoch und mit wenig `vx` gestartet — die Landung soll erst
    // nach der vollen Sekunde kommen, nicht mittendrin, sonst übernimmt
    // die Boden-Anlege-Dämpfung den `winkel` schon vor der Messung.
    const abgesprungen: Lauf = {
      ...neuesSpiel(SAAT),
      x: 200,
      y: bodenHoehe(g, 200) + 20,
      vx: 6,
      vy: 0,
      winkel: 0,
      drehen: 0,
      amBoden: false,
    };
    const nachEinerSekunde = fahren(abgesprungen, 1, KEINE_EINGABE);
    expect(nachEinerSekunde.amBoden, 'wäre schon gelandet — Testaufbau prüfen').toBe(false);
    expect(nachEinerSekunde.winkel).toBeLessThan(abgesprungen.winkel - 0.15);
  });
});

describe('Landung und Flow', () => {
  /** Setzt die Figur mit gegebenem Radwinkel knapp über den Boden. */
  const kurzVorLandung = (winkel: number): Lauf => {
    const g = gelaendeBauen(SAAT);
    const x = 220;
    return {
      ...neuesSpiel(SAAT),
      x,
      y: bodenHoehe(g, x) + 0.05,
      vx: 10,
      vy: -4,
      winkel: bodenWinkel(g, x) + winkel,
      amBoden: false,
      // Ein richtiger Sprung, kein Hüpferchen auf der Anfahrt — siehe
      // `LANDUNG_MIN_LUFT`: Nur eine Landung nach echter Flugzeit wird gewertet.
      luftZeit: 0.4,
    };
  };

  it('zählt eine saubere Landung als perfekt und erhöht den Flow', () => {
    const l = takt(kurzVorLandung(0), 1 / 60);
    expect(l.letzteLandung).toBe('perfekt');
    expect(l.perfekte).toBe(1);
    expect(l.flow).toBe(2);
    expect(l.vorbei).toBe(false);
  });

  it('beendet den Lauf bei einer viel zu schrägen Landung', () => {
    const l = takt(kurzVorLandung(1.6), 1 / 60);
    expect(l.letzteLandung).toBe('sturz');
    expect(l.vorbei).toBe(true);
    expect(l.gewonnen).toBe(false);
  });

  it('lässt nach einem Sturz noch ein Stück ausrutschen, statt hart einzufrieren', () => {
    /*
     * Rückmeldung: „Falls man stürzt, soll es nicht im letzten Moment
     * abbrechen, sondern man soll sehen, wie der Typ stürzt." Ein Sturz
     * darf also nicht dieselbe reglose Stille sein wie ein Sieg.
     */
    const sturz = takt(kurzVorLandung(1.6), 1 / 60);
    expect(sturz.letzteLandung).toBe('sturz');
    expect(sturz.vx).not.toBe(0);

    const einSchritt = takt(sturz, 1 / 60);
    expect(einSchritt.x).not.toBe(sturz.x);

    // Nach genug Zeit ist der Rest des Schwungs aufgebraucht und bleibt es.
    // `fahren()` passt hier nicht — die bricht bei `vorbei` sofort ab,
    // genau der Zustand, den ein Sturz aber schon mitbringt.
    let ausgerollt = sturz;
    for (let t = 0; t < 3; t += 1 / 60) ausgerollt = takt(ausgerollt, 1 / 60, KEINE_EINGABE);
    expect(ausgerollt.vx).toBe(0);
    const nochEins = takt(ausgerollt, 1 / 60);
    expect(nochEins.x).toBe(ausgerollt.x);
  });

  it('kostet eine harte Landung spürbar Tempo, eine perfekte nicht', () => {
    // Das ist die eigentliche Belohnung fürs Können — nicht die Punkte.
    const perfekt = takt(kurzVorLandung(0), 1 / 60);
    const hart = takt(kurzVorLandung(0.8), 1 / 60);
    expect(hart.letzteLandung).toBe('hart');
    expect(hart.vx).toBeLessThan(perfekt.vx * 0.85);
  });

  it('setzt den Flow bei einer harten Landung zurück', () => {
    const mitFlow = { ...kurzVorLandung(0.8), flow: 5 };
    expect(takt(mitFlow, 1 / 60).flow).toBe(1);
  });

  it('deckelt den Flow, damit er nicht ins Unendliche läuft', () => {
    let l = { ...kurzVorLandung(0), flow: 9 };
    l = takt(l, 1 / 60);
    expect(l.flow).toBe(9);
  });

  it('zählt volle Drehungen als Trick, wenn die Landung steht', () => {
    // Zwei volle Umdrehungen plus ein sauberer Landewinkel — `winkel` ist
    // in der Luft unbeschränkt, `kurzVorLandung(offset)` addiert `offset`
    // direkt auf den Boden-Winkel drauf, zwei volle Kreise ändern den
    // tatsächlichen Landewinkel (nach `winkelKuerzen`) also nicht.
    const l = takt(kurzVorLandung(Math.PI * 2 * 2), 1 / 60);
    expect(l.letzteLandung).not.toBe('sturz');
    expect(l.letzterTrick).toBe(2);
    expect(l.trickPunkte).toBe(2 * TRICK_PUNKTE_JE_DREHUNG);
  });

  it('gibt keine Trick-Punkte, wenn die Landung ein Sturz ist', () => {
    // Dieselben zwei Umdrehungen, aber zusätzlich viel zu schräg gelandet.
    const l = takt(kurzVorLandung(Math.PI * 2 * 2 + 1.6), 1 / 60);
    expect(l.letzteLandung).toBe('sturz');
    expect(l.letzterTrick).toBe(0);
    expect(l.trickPunkte).toBe(0);
  });
});

describe('Ziel und Ende', () => {
  it('gewinnt beim Erreichen der Ziellinie', () => {
    const g = gelaendeBauen(SAAT);
    const kurzDavor: Lauf = {
      ...neuesSpiel(SAAT),
      x: g.laenge - 2,
      y: bodenHoehe(g, g.laenge - 2),
      vx: 12,
    };
    const l = fahren(kurzDavor, 2, GAS);
    expect(l.vorbei).toBe(true);
    expect(l.gewonnen).toBe(true);
    expect(l.x).toBe(g.laenge);
  });

  it('rührt einen beendeten Lauf nicht mehr an — außer der Sturzuhr', () => {
    const vorbei = { ...neuesSpiel(SAAT), vorbei: true };
    const danach = takt(vorbei, 0.1, GAS);
    expect(danach.x).toBe(vorbei.x);
    expect(danach.vx).toBe(vorbei.vx);
    expect(danach.sturzZeit).toBeGreaterThan(0);
  });
});

describe('Punkte', () => {
  it('wachsen mit der Strecke', () => {
    const kurz = fahren(neuesSpiel(SAAT), 3, GAS);
    const lang = fahren(kurz, 3, GAS);
    expect(punkte(lang)).toBeGreaterThan(punkte(kurz));
  });

  it('belohnen Flugzeit und perfekte Landungen', () => {
    const grund = neuesSpiel(SAAT);
    expect(punkte({ ...grund, luftGesamt: 3 })).toBeGreaterThan(punkte(grund));
    expect(punkte({ ...grund, perfekte: 4 })).toBeGreaterThan(punkte(grund));
  });

  it('gibt den Zeitbonus nur im Ziel, und für schnelle Fahrten mehr', () => {
    const g = neuesSpiel(SAAT);
    const verloren = { ...g, x: 700, zeit: 40 };
    const schnell = { ...g, x: 700, zeit: 40, vorbei: true, gewonnen: true };
    const langsam = { ...g, x: 700, zeit: 80, vorbei: true, gewonnen: true };
    expect(punkte(schnell)).toBeGreaterThan(punkte(verloren));
    expect(punkte(schnell)).toBeGreaterThan(punkte(langsam));
  });

  it('lässt den Zeitbonus nie negativ werden', () => {
    // Sonst würde eine sehr langsame Zielfahrt weniger zählen als ein
    // Sturz kurz davor — und das Ziel zu erreichen dürfte nie bestrafen.
    const g = neuesSpiel(SAAT);
    const sehrLangsam = { ...g, x: 700, zeit: 9999, vorbei: true, gewonnen: true };
    expect(punkte(sehrLangsam)).toBeGreaterThanOrEqual(700);
  });
});

describe('Fairness', () => {
  /**
   * Der wichtigste Test des ganzen Spiels: **Ist die Strecke überhaupt zu
   * schaffen?**
   *
   * Das Gelände entsteht aus Zufallszahlen. Eine Strecke, die niemand ins
   * Ziel bringen kann, wäre kein schweres Level, sondern ein kaputtes.
   * Deshalb spielt hier ein einfacher Bot mit: Gas geben, und in der Luft
   * grob zum Boden ausrichten — mehr kann ein Anfänger auch nicht.
   *
   * Wenn dieser Test rot wird, ist eine Fahrwert-Änderung schiefgegangen,
   * nicht der Test.
   */
  /**
   * Baut einen frischen Bot — mit **eigenem Gedächtnis**, siehe unten.
   * Muss je Strecke neu erzeugt werden, sonst liefe das Gedächtnis von
   * Strecke 3 in Strecke 4 weiter.
   */
  const machBot = () => {
    // Ob der Bot gerade bewusst zurückrollt, um neuen Anlauf zu holen.
    let rueckrollen = false;
    return (l: Lauf): Eingabe => {
      if (l.amBoden) {
        /*
         * Ein zu steiler Hang lässt sich mit Antrieb allein nicht
         * hochfahren — Antrieb und Hangabtrieb heben sich dort fast genau
         * auf (bei `ANTRIEB` = 11,5 und `SCHWERKRAFT` = 22 rund 31,5°).
         * Ein Bot, der stur weiter Gas gibt, bleibt an genau diesem Winkel
         * für immer hängen. Jeder wirkliche Fahrer würde hier loslassen
         * und zurückrollen, um neuen Anlauf zu holen.
         *
         * **Mit einer einzigen Schwelle wackelt das Gas bei jedem
         * Bildschritt um genau diesen Winkel herum** — Gas an, ein Stück
         * hochgekommen, Schwelle überschritten, Gas aus, ein Stück
         * zurückgerollt, Schwelle unterschritten, Gas an … ohne je
         * nennenswert Boden gutzumachen. Deshalb zwei Schwellen mit
         * Hysterese: Einmal zurückgerollt, bleibt der Bot dabei, bis der
         * Hang spürbar sanfter ist — erst dann holt er wirklich Anlauf,
         * statt am Fuß desselben steilen Stücks sofort wieder anzudrücken.
         */
        const hang = bodenWinkel(l.gelaende, l.x);
        if (!rueckrollen && hang > 0.55) rueckrollen = true;
        else if (rueckrollen && hang < 0.2) rueckrollen = false;
        if (rueckrollen) return { gas: false, bremse: false, lehnen: 0 };
        return GAS;
      }
      rueckrollen = false;
      /*
       * Zum erwarteten Landewinkel ausrichten: Soll `winkel` steigen
       * (Vorderrad höher), muss er nach hinten lehnen (negatives `lehnen`,
       * siehe die Vorzeichen-Korrektur oben bei „Gewichtsverlagerung").
       *
       * **Die Vorausschau kommt jetzt aus der echten Wurfparabel, nicht
       * mehr aus einer mit der Flugzeit hochskalierten Schätzung.** Die
       * alte Formel (`0.3 + luftZeit * 0.5`) war eine Krücke — sie wusste
       * nichts von der tatsächlichen Flughöhe oder -geschwindigkeit und
       * zielte bei langen Sprüngen (vor allem den seltenen Mega-Kickern)
       * regelmäßig daneben. `t = (vy + √(vy² + 2·g·y)) / g` ist die
       * exakte Lösung von „wann erreicht eine Wurfparabel wieder die
       * Höhe null" (die Herleitung steht in jedem Physik-Schulbuch als
       * Steig-/Falldauer) — dieselbe Idee wie bei der Abheben-Bedingung
       * in `takt`: eine echte Formel statt einer geschätzten Konstante.
       * Landehöhe ≠ 0 in Wahrheit, aber „ungefähr eben" ist für eine
       * Vorausschau nah genug dran; die Feinkorrektur macht ohnehin die
       * fortlaufende Neuberechnung jedes Bild.
       */
      const restFlugzeit = (l.vy + Math.sqrt(Math.max(0, l.vy * l.vy + 2 * SCHWERKRAFT * Math.max(0, l.y)))) / SCHWERKRAFT;
      const ziel = bodenWinkel(l.gelaende, l.x + l.vx * restFlugzeit);
      const unterschied = winkelKuerzen(ziel - l.winkel);
      /*
       * **Verhältnisgesteuert statt „immer volles Lehnen".** Mit voller
       * Auslenkung bei jeder noch so kleinen Abweichung fing der Bot an,
       * um das Ziel herum zu schwingen — bei einem Bild stand `winkel`
       * bei 0,43, ein halbes Bild später bei −1,15, weit über das Ziel
       * hinausgeschossen, und die nächste Landung war ein Sturz. Ein
       * echter Fahrer lässt bei einer kleinen Abweichung auch nur ein
       * bisschen nach, nicht den ganzen Lenker. `* 2.5` gibt ab rund
       * 0,4 Radiant Abweichung volle Auslenkung, darunter proportional
       * weniger — genug Kraft, um wirklich zu korrigieren, ohne am Ziel
       * vorbeizuschießen.
       *
       * **Zusätzlich gedämpft nach der eigenen Drehrate (`drehen`).** Die
       * reine Abweichungs-Regelung schoss bei besonders harten
       * Richtungswechseln (Landung mit hohem Winkel direkt in den
       * nächsten Sprung) trotzdem massiv übers Ziel hinaus — teils über
       * 100° daneben. Grund: `winkel` und `drehen` bilden eine Kette aus
       * zwei Integratoren (`lehnen` verändert `drehen`, `drehen`
       * verändert `winkel`), und ein reiner Proportionalregler auf
       * `winkel` allein bremst diese Kette nicht rechtzeitig ab — sie sieht
       * nur, *wie weit* daneben, nicht *wie schnell* sie sich gerade
       * dreht, und dreht munter weiter, selbst wenn `winkel` das Ziel
       * längst erreicht hat.
       *
       * **Das Vorzeichen des Dämpfungsterms braucht dabei die
       * Gegenprobe, nicht die Intuition.** Naheliegend wäre `- drehen *
       * kd` („bremse in Richtung der Abweichung ab"), aber `lehnen`
       * wirkt über `drehen -= lehnen * LUFT_DREHUNG * dt` — positives
       * `lehnen` macht `drehen` *kleiner* (negativer). Ist `drehen`
       * bereits negativ (die Nase dreht schon abwärts), addiert `-
       * drehen * kd` einen *positiven* Beitrag zu `lehnen` und
       * beschleunigt die Drehung damit weiter in dieselbe Richtung —
       * das Gegenteil von Bremsen. Mit diesem (falschen) Vorzeichen
       * verschlechterte jeder Versuch, den Dämpfungsanteil zu verstärken,
       * das Ergebnis messbar, was lange wie „Dämpfung hilft hier einfach
       * nicht" aussah. Richtig ist `+ drehen * kd`: Ist `drehen` negativ,
       * wird `lehnen` dadurch kleiner (bis ins Negative), was `drehen`
       * über denselben Term wieder anhebt — echtes Bremsen. Mit dem
       * korrigierten Vorzeichen schafft derselbe Bot zuverlässig alle 10
       * Strecken, wo vorher bei bestem Tuning nur 7 von 10 standen.
       */
      const lehnen = Math.max(-1, Math.min(1, -unterschied * 2 + l.drehen * 1.2));
      return { gas: true, bremse: false, lehnen };
    };
  };

  it('lässt einen einfachen Fahrer zehn verschiedene Strecken schaffen', () => {
    for (let n = 1; n <= 10; n++) {
      const l = fahren(neuesSpiel(streckenSaat(n)), 300, machBot());
      expect(l.vorbei, `Strecke ${n} endete nicht`).toBe(true);
      expect(l.gewonnen, `Strecke ${n} war nicht zu schaffen`).toBe(true);
    }
  });

  it('läuft bei jeder Bildrate praktisch gleich weit', () => {
    /*
     * Ronni ausdrücklich: „Die Physik darf nicht bei 30 FPS anders
     * reagieren als bei 60 FPS."
     *
     * **Der eigentliche Schutz ist die Uhr, nicht dieser Test.**
     * `useGameLoop` ruft `takt` immer mit demselben festen Zeitschritt
     * auf (1/60), egal wie schnell der Bildschirm ist — im Spiel kommt
     * also nie ein anderes `dt` vor. Was hier geprüft wird, ist die
     * Stufe darunter: dass die Integration selbst nicht auseinanderläuft.
     *
     * Eine winzige Abweichung ist dabei unvermeidbar und **kein Fehler**:
     * Schrittweise Integration rundet, und bei doppelt so großen Schritten
     * rundet sie anders. Gemessen sind rund 0,35 % auf 200 m. Ein echter
     * Fehler — ein vergessenes `dt`, ein falsches Vorzeichen — läge um
     * Größenordnungen darüber und reißt diese Grenze sofort.
     *
     * **Absichtlich mit dem aktiven Bot geprüft, nicht mehr mit reinem
     * Gas.** Seit `NATUR_NICKEN` (siehe unten bei „kommt mit reinem
     * Gasgeben nicht zuverlässig ins Ziel") lässt reines Gasgeben ohne
     * Gegenlenken die Fahrt irgendwann stürzen — genau das ist gewollt.
     * Aber ein Sturz ist eine Schwellwert-Entscheidung, die einmal je
     * Bild geprüft wird, und der erkannte Absprung- wie Sturzpunkt liegt
     * bei 30 und 60 Bildern je Sekunde immer ein kleines Stück
     * auseinander. Nach einem Sturz steht `x` (bis auf das kurze
     * Ausrutschen) still — ein winziger Zeitunterschied *wann* gestürzt
     * wird, wird danach zu einer großen Distanz-Differenz aufgeblasen,
     * weil die eine Fahrt schon länger stillsteht als die andere. Das
     * sagt nichts über die Physik aus, nur über den ohnehin gewollten
     * Sturz. Mit dem aktiven Bot, der zuverlässig durchkommt, bleibt der
     * eigentliche Framerate-Test aussagekräftig.
     */
    const dts = [1 / 120, 1 / 60, 1 / 30];
    /*
     * **Zwei Messungen, weil eine allein etwas Falsches verspricht.**
     *
     * Bis zum ersten Sprung (zwei Sekunden) ist die Fahrt reine Integration —
     * dort gilt die strenge Grenze von einem Prozent.
     *
     * Über zwölf Sekunden schaltet die Landungswertung dazwischen, und die ist
     * eine **Schwelle**: Liegt der Winkel einer Landung bei 30 Bildern je
     * Sekunde knapp unter 0,25 Radiant und bei 120 knapp darüber, heißt das
     * „perfekt" gegen „gut" — sechs Prozent Tempo, die den Rest der Fahrt
     * mittragen. Das ist kein Fehler der Integration, sondern die Landung.
     * Früher fiel das nicht auf: Jedes Hüpferchen auf der Anfahrt zählte als
     * perfekte Landung und schob das Tempo mit 1,04 an den Anschlag, ganz
     * gleich was sonst passierte (siehe `LANDUNG_MIN_LUFT`). Die Grenze steht
     * deshalb hier bei vier Prozent.
     */
    const kurz = dts.map((dt) => fahren(neuesSpiel(SAAT), 2, machBot(), dt).x);
    for (const w of kurz) {
      const abweichung = Math.abs(w - kurz[0]!) / kurz[0]!;
      expect(abweichung, `nach 2 s: ${w.toFixed(1)} gegen ${kurz[0]!.toFixed(1)}`).toBeLessThan(0.01);
    }
    const lang = dts.map((dt) => fahren(neuesSpiel(SAAT), 12, machBot(), dt).x);
    for (const w of lang) {
      const abweichung = Math.abs(w - lang[0]!) / lang[0]!;
      expect(abweichung, `nach 12 s: ${w.toFixed(1)} gegen ${lang[0]!.toFixed(1)}`).toBeLessThan(0.04);
    }
  });

  it('kommt mit reinem Gasgeben nicht zuverlässig ins Ziel — Gegenlenken muss nötig sein', () => {
    /*
     * Rückmeldung: „Man muss nichts machen — wenn ich nur Gas gebe,
     * komme ich auch ans Ziel, so sollte das nicht sein. Es sollte immer
     * notwendig sein, sich je nach Sprung richtig zu bewegen." Das ist
     * die direkte Umkehrung der Fairness-Garantie oben: Dort muss ein
     * **aktiver** einfacher Fahrer durchkommen, hier darf ein **passiver**
     * (Gas halten, nie lehnen) es nicht zuverlässig schaffen.
     *
     * **Die Schwelle ist bewusst „Mehrheit scheitert" (< 6 von 10), nicht
     * „fast immer" (< 3 von 10).** Ursprünglich stand hier < 3 — erreicht
     * mit `NATUR_NICKEN` als unbegrenzt wachsender Drehbeschleunigung.
     * Live getestet zeigte sich: Ein echter Spieler steuert nur binär
     * (`lehnen` ist −1, 0 oder 1, siehe `FlowMtb.tsx` — kein Analogwert
     * wie beim Fairness-Bot oben) und braucht eine echte, spürbare
     * Reaktionszeit. Gegen einen Bot, der das nachbildet (binäre
     * Entscheidung, nur alle paar Bilder neu bewertet — realistische
     * ~100 ms Reaktionszeit), schaffte bei < 3 selbst ein ordentlich
     * reagierender Spieler oft nur 3 von 10 Strecken: nicht „Steuern ist
     * nötig", sondern „Steuern ist unmöglich präzise genug". Seit
     * `NATUR_NICKEN_GRENZE` die Drift deckelt (siehe dort), schafft
     * derselbe realistische Spieler-Bot wieder 9–10 von 10 — aber die
     * Kehrseite des Deckels ist, dass ein rein passiver Lauf auf der
     * Hälfte der Strecken durchrutscht, weil die gedeckelte Abweichung
     * dort nie über eine „gute" Landung hinauskommt. Diese Schwelle ist
     * der ehrliche Mittelweg: reines Gasgeben verliert verlässlich seinen
     * Status als Gewinnstrategie (Mehrheit scheitert), ohne einem
     * realistischen Spieler eine Präzision abzuverlangen, die nur ein
     * Bot mit Analogsteuerung und Null-Latenz aufbringen kann.
     */
    let geschafft = 0;
    for (let n = 1; n <= 10; n++) {
      const l = fahren(neuesSpiel(streckenSaat(n)), 300, GAS);
      if (l.gewonnen) geschafft++;
    }
    expect(geschafft, `${geschafft} von 10 Strecken mit reinem Gasgeben geschafft`).toBeLessThan(6);
  });

  it('ergibt bei gleicher Saat und gleicher Eingabe dasselbe Ergebnis', () => {
    const spielen = () => {
      const l = fahren(neuesSpiel(SAAT), 20, (s) => ({
        gas: true,
        bremse: false,
        lehnen: Math.sin(s.zeit * 3),
      }));
      return { x: l.x, zeit: l.zeit, punkte: punkte(l) };
    };
    expect(spielen()).toEqual(spielen());
  });
});

describe('Münzen und Boost-Streifen', () => {
  it('liegen bei gleicher Saat an denselben Stellen', () => {
    const a = gelaendeBauen(SAAT);
    const b = gelaendeBauen(SAAT);
    expect(a.muenzen).toEqual(b.muenzen);
    expect(a.pads).toEqual(b.pads);
    expect(a.absprung).toEqual(b.absprung);
  });

  it('verändern das Gelände nicht: Kicker und Wellen sind unabhängig vom Inhalt', () => {
    // Die Münzen werden **nach** dem Bauen abgeleitet — sie dürfen keine
    // Zufallszahl ziehen. Sonst sähe jede Strecke nach dieser Änderung
    // anders aus als vorher, und alle Fairness-Prüfungen gälten nicht mehr.
    for (let n = 1; n <= 10; n++) {
      const g = gelaendeBauen(streckenSaat(n));
      const ohne = { ...g, muenzen: [], pads: [], absprung: [] };
      for (let x = 0; x < g.laenge; x += 3) {
        expect(bodenHoehe(g, x)).toBe(bodenHoehe(ohne, x));
      }
    }
  });

  it('liegen alle innerhalb der Strecke und über dem Boden', () => {
    for (let n = 1; n <= 10; n++) {
      const g = gelaendeBauen(streckenSaat(n));
      expect(g.muenzen.length, `Strecke ${n} hat keine Münzen`).toBeGreaterThan(10);
      for (const m of g.muenzen) {
        expect(m.x).toBeGreaterThan(ANLAUF);
        expect(m.x).toBeLessThan(g.laenge);
        // Eine Münze im Boden wäre unerreichbar.
        expect(m.y, `Münze bei ${m.x.toFixed(1)}`).toBeGreaterThan(bodenHoehe(g, m.x) + 0.3);
      }
    }
  });

  it('legt Boost-Streifen auf ebenes Stück — und nah vor einem Sprung nur vor großen Kickern', () => {
    let gesamt = 0;
    for (let n = 1; n <= 30; n++) {
      const g = gelaendeBauen(streckenSaat(n));
      for (const p of g.pads) {
        gesamt++;
        const danach = g.kicker.filter((k) => k.x - k.breite * 2.1 > p.x);
        const naechster = danach.sort((a, b) => a.x - b.x)[0]!;
        const abstand = naechster.x - naechster.breite * 2.1 - (p.x + p.laenge);
        // Entweder weit vor dem nächsten Sprung (der Schub ist dann abgeklungen) …
        // … oder unmittelbar davor, dann aber nur vor einem großen Kicker, dessen
        // Landezone auf mehr Tempo ausgelegt ist.
        if (abstand < 15) expect(naechster.breite).toBeGreaterThanOrEqual(8.5);
        expect(Math.abs(bodenHoehe(g, p.x + p.laenge) - bodenHoehe(g, p.x))).toBeLessThan(0.7);
      }
    }
    // Es gibt sie auch wirklich — sonst wäre das ein totes Merkmal.
    expect(gesamt).toBeGreaterThan(20);
  });

  it('lässt einen Fahrer, der die Strecke schafft, unterwegs Münzen mitnehmen', () => {
    // Der einfache Bot aus den Fairness-Tests: er fährt die Linie, auf der die
    // Münzen liegen — ohne dass er sie je gesucht hätte.
    let summe = 0;
    for (let n = 1; n <= 10; n++) {
      const l = fahren(neuesSpiel(streckenSaat(n)), 300, botMitPop(false));
      summe += l.muenzenZahl / l.gelaende.muenzen.length;
    }
    expect(summe / 10, 'Durchschnitt eingesammelter Münzen').toBeGreaterThan(0.25);
  });

  it('zählt jede Münze nur einmal und gibt Punkte dafür', () => {
    let l = neuesSpiel(SAAT);
    const m = l.gelaende.muenzen[0]!;
    // Das Rad steht direkt an der Münze.
    l = { ...l, x: m.x - 0.1, y: m.y - 0.75, vx: 0, amBoden: false, vy: 0 };
    const eins = takt(l, 1 / 60, KEINE_EINGABE);
    expect(eins.muenzenZahl).toBe(1);
    const zwei = takt({ ...eins, x: m.x - 0.1, y: m.y - 0.75, amBoden: false, vy: 0 }, 1 / 60, KEINE_EINGABE);
    expect(zwei.muenzenZahl).toBe(1);
    expect(punkte(zwei) - punkte({ ...zwei, muenzenZahl: 0 })).toBe(MUENZ_PUNKTE);
  });

  it('gibt am Boost-Streifen einen Schub, der über das Höchsttempo hinausreicht und abklingt', () => {
    let l: Lauf | null = null;
    for (let n = 1; n <= 30 && !l; n++) {
      const g = gelaendeBauen(streckenSaat(n));
      if (g.pads.length > 0) l = neuesSpiel(streckenSaat(n));
    }
    expect(l, 'keine Strecke mit Boost-Streifen gefunden').not.toBeNull();
    const pad = l!.gelaende.pads[0]!;
    let z: Lauf = { ...l!, x: pad.x - 0.2, y: bodenHoehe(l!.gelaende, pad.x - 0.2), vx: TEMPO_MAX };
    z = takt(z, 1 / 60, GAS);
    for (let i = 0; i < 20; i++) z = takt(z, 1 / 60, GAS);
    expect(z.vx).toBeGreaterThan(TEMPO_MAX);
    expect(z.vx).toBeLessThanOrEqual(TEMPO_MAX + BOOST_UEBER_TEMPO + 0.01);
    expect(z.boost).toBeGreaterThan(0);
    // Nach einigen Sekunden ist die Zusatzgeschwindigkeit wieder weg.
    const ruhig: Lauf = { ...z, x: 30, y: 0, padsGenommen: new Set(z.padsGenommen) };
    let k = ruhig;
    for (let i = 0; i < 60 * 4; i++) {
      k = takt({ ...k, x: Math.min(k.x, ANLAUF - 1), y: 0 }, 1 / 60, GAS);
    }
    expect(k.ueberTempo).toBeLessThan(0.1);
    expect(k.vx).toBeLessThanOrEqual(TEMPO_MAX + 0.1);
  });

  it('gibt für jeden mitgenommenen Boost-Streifen Punkte', () => {
    const l = neuesSpiel(SAAT);
    expect(punkte({ ...l, padsGenommen: new Set([0, 1]) }) - punkte(l)).toBe(2 * PAD_PUNKTE);
  });

  it('nimmt einen Boost-Streifen nur einmal mit', () => {
    let l: Lauf | null = null;
    for (let n = 1; n <= 30 && !l; n++) {
      const g = gelaendeBauen(streckenSaat(n));
      if (g.pads.length > 0) l = neuesSpiel(streckenSaat(n));
    }
    const pad = l!.gelaende.pads[0]!;
    let z: Lauf = { ...l!, x: pad.x + 0.5, y: bodenHoehe(l!.gelaende, pad.x + 0.5), vx: 10 };
    z = takt(z, 1 / 60, GAS);
    const nachErstem = z.vx;
    z = { ...z, x: pad.x + 1, y: bodenHoehe(l!.gelaende, pad.x + 1) };
    z = takt(z, 1 / 60, GAS);
    // Zweiter Kontakt: kein zweiter Schub (nur das normale Gas, das kleiner ist).
    expect(z.vx - nachErstem).toBeLessThan(0.5);
  });
});

/**
 * Ein Fahrer, der an jeder Kante poppt: Er tippt „Hinten" kurz vor der
 * Absprungmarke an. Ohne `mitPop` ist es der einfache Fairness-Bot.
 */
function botMitPop(mitPop: boolean) {
  let rueckrollen = false;
  return (l: Lauf): Eingabe => {
    if (l.amBoden) {
      const hang = bodenWinkel(l.gelaende, l.x);
      if (!rueckrollen && hang > 0.55) rueckrollen = true;
      else if (rueckrollen && hang < 0.2) rueckrollen = false;
      if (rueckrollen) return { gas: false, bremse: false, lehnen: 0 };
      if (mitPop) {
        const marke = l.gelaende.absprung.find((a) => a > l.x && a - l.x < l.vx * 0.12);
        if (marke !== undefined) return { gas: true, bremse: false, lehnen: -1 };
      }
      return GAS;
    }
    rueckrollen = false;
    const rest = (l.vy + Math.sqrt(Math.max(0, l.vy * l.vy + 2 * SCHWERKRAFT * Math.max(0, l.y)))) / SCHWERKRAFT;
    const ziel = bodenWinkel(l.gelaende, l.x + l.vx * rest);
    const unterschied = winkelKuerzen(ziel - l.winkel);
    const lehnen = Math.max(-1, Math.min(1, -unterschied * 2 + l.drehen * 1.2));
    return { gas: true, bremse: false, lehnen };
  };
}

describe('Der Pop an der Kante', () => {
  /** Ein Lauf kurz vor einer großen Kuppe, mit dem Tempo, bei dem man dort abhebt. */
  const vorKante = () => {
    const l = neuesSpiel(SAAT);
    const k = l.gelaende.kicker[0]!;
    const x0 = k.x - k.breite * 3;
    return { ...l, x: x0, y: bodenHoehe(l.gelaende, x0), vx: TEMPO_MAX };
  };
  /** Fährt bis zum Abheben und gibt den Lauf **im ersten Bild in der Luft** zurück. */
  const bisAbheben = (start: Lauf, druckErst: (l: Lauf) => boolean) => {
    let l = start;
    for (let i = 0; i < 600 && l.amBoden; i++) {
      l = takt(l, 1 / 60, { gas: true, bremse: false, lehnen: druckErst(l) ? -1 : 0 });
    }
    return l;
  };

  it('gibt zusätzlichen Schwung nach oben, wenn man kurz vor dem Abheben frisch antippt', () => {
    const ohne = bisAbheben(vorKante(), () => false);
    // Tippt an, sobald die Absprungmarke 0,15 s entfernt ist.
    const mit = bisAbheben(vorKante(), (l) => {
      const marke = l.gelaende.absprung.find((a) => a > l.x - 0.2);
      return marke !== undefined && marke - l.x < l.vx * 0.15;
    });
    expect(ohne.amBoden).toBe(false);
    expect(mit.amBoden).toBe(false);
    expect(mit.popZahl).toBe(1);
    expect(ohne.popZahl).toBe(0);
    expect(mit.vy - ohne.vy).toBeGreaterThan(POP_SCHUB * 0.7);
  });

  it('zählt nichts, wenn „Hinten" schon lange gedrückt war', () => {
    // Der Daumen liegt von Anfang an auf dem Knopf — kein frischer Druck, kein Pop.
    const l = bisAbheben(vorKante(), () => true);
    expect(l.amBoden).toBe(false);
    expect(l.popZahl).toBe(0);
  });

  it('wertet einen Pop höchstens einmal je Sprung', () => {
    let l = bisAbheben(vorKante(), (z) => {
      const marke = z.gelaende.absprung.find((a) => a > z.x - 0.2);
      return marke !== undefined && marke - z.x < z.vx * 0.15;
    });
    // In der Luft weiter „Hinten" halten, kurz loslassen, wieder drücken.
    for (let i = 0; i < 20 && !l.amBoden; i++) {
      l = takt(l, 1 / 60, { gas: true, bremse: false, lehnen: i % 6 < 3 ? -1 : 0 });
    }
    expect(l.popZahl).toBeLessThanOrEqual(1);
  });

  it('gibt Punkte für jeden gelungenen Pop', () => {
    const l = neuesSpiel(SAAT);
    expect(punkte({ ...l, popZahl: 3 }) - punkte(l)).toBe(3 * POP_PUNKTE);
  });

  it('lässt einen Fahrer, der an jeder Kante poppt, alle zehn Strecken schaffen', () => {
    // Der Pop ist freiwillig und kommt obendrauf. Wäre er so stark, dass
    // er Strecken unspielbar macht, wäre das Können bestraft statt belohnt.
    for (let n = 1; n <= 10; n++) {
      const l = fahren(neuesSpiel(streckenSaat(n)), 300, botMitPop(true));
      expect(l.gewonnen, `Strecke ${n} mit Pop nicht zu schaffen (x=${l.x.toFixed(0)})`).toBe(true);
    }
  });

  it('zeigt das Fenster als Zahl, nicht als Raten', () => {
    expect(POP_FENSTER).toBeGreaterThan(0.1);
    expect(POP_FENSTER).toBeLessThan(0.5);
  });
});

describe('Missionen', () => {
  it('beginnen mit drei verschiedenen Aufgaben', () => {
    for (let n = 1; n <= 20; n++) {
      const l = neuesSpiel(streckenSaat(n));
      expect(l.missionen).toHaveLength(3);
      expect(new Set(l.missionen.map((m) => m.art)).size).toBe(3);
    }
  });

  it('sind bei gleicher Saat dieselben', () => {
    expect(neuesSpiel(SAAT).missionen).toEqual(neuesSpiel(SAAT).missionen);
  });

  it('zählen nur, was nach ihrem Beginn passiert', () => {
    const l0 = neuesSpiel(SAAT);
    const l = { ...l0, muenzenZahl: 50 };
    const m = neueMission(l, 0, []);
    if (m.art === 'muenzen') expect(missionFortschritt(l, m)).toBe(0);
  });

  it('geben beim Schaffen Bonuspunkte und werden ersetzt', () => {
    const l0 = neuesSpiel(SAAT);
    const i = l0.missionen.findIndex((m) => m.art === 'muenzen' || m.art === 'perfekt' || m.art === 'salto');
    // Eine Aufgabe über die Zähler erfüllen.
    const m = l0.missionen[i === -1 ? 0 : i]!;
    let l: Lauf = { ...l0, amBoden: true };
    if (m.art === 'muenzen') l = { ...l, muenzenZahl: m.start + m.ziel };
    else if (m.art === 'perfekt') l = { ...l, perfekte: m.start + m.ziel };
    else if (m.art === 'salto') l = { ...l, saltos: m.start + m.ziel };
    else if (m.art === 'luft') l = { ...l, luftGesamt: m.start + m.ziel };
    else if (m.art === 'pop') l = { ...l, popZahl: m.start + m.ziel };
    else l = { ...l, tempoSpitze: m.ziel + 1 };
    const danach = takt(l, 1 / 60, GAS);
    expect(danach.missionZahl).toBe(1);
    expect(danach.missionPunkte).toBe(missionsLohn(0));
    expect(danach.missionen).toHaveLength(3);
    expect(danach.letzteMission).toEqual(m);
    // Die Ersatzaufgabe ist keine der beiden anderen.
    expect(new Set(danach.missionen.map((x) => x.art)).size).toBe(3);
  });

  it('haben für jede Art einen Namen', () => {
    for (const art of ['muenzen', 'perfekt', 'salto', 'tempo', 'luft', 'pop'] as const) {
      expect(MISSION_NAMEN[art](5).length).toBeGreaterThan(3);
    }
  });

  it('bieten keine Tempo-Aufgabe mehr an, wenn das Höchsttempo schon nah ist', () => {
    const l = { ...neuesSpiel(SAAT), tempoSpitze: TEMPO_MAX * 3.6 };
    for (let i = 0; i < 40; i++) {
      expect(neueMission({ ...l, missionZahl: i }, i % 3, []).art).not.toBe('tempo');
    }
  });

  it('steigern den Lohn langsam', () => {
    expect(missionsLohn(0)).toBeLessThan(missionsLohn(9));
    expect(missionsLohn(9)).toBeLessThan(missionsLohn(0) * 3);
  });
});

describe('Umgebung (Biom)', () => {
  it('hängt allein an der Saat und liegt zwischen 0 und 3', () => {
    const gesehen = new Set<number>();
    for (let n = 1; n <= 60; n++) {
      const b = biomVon(streckenSaat(n));
      expect(b).toBe(biomVon(streckenSaat(n)));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(3);
      gesehen.add(b);
    }
    // Alle vier kommen vor — sonst wäre eine Umgebung totes Gewicht.
    expect(gesehen.size).toBe(4);
  });
});
