import { describe, expect, it } from 'vitest';
import { saatAus } from '../../core/rng';
import {
  ABSCHNITT_LAENGE,
  HOEHE_RUTSCHEND,
  SERIE_ABSTAND,
  SPUREN,
  SPUR_BREITE,
  TEMPO_MAX,
  TEMPO_START,
  abschnittErzeugen,
  istPassierbar,
  kollision,
  kopfhoehe,
  mindestAbstand,
  neuesSpiel,
  punkte,
  rutschen,
  spurWechseln,
  spurX,
  springen,
  takt,
  tempoBei,
} from './logik';
import type { Hindernis, Lauf, Muenze } from './logik';

const SAAT = saatAus('laufen', 1);

/** Lässt die Zeit in Bildschritten laufen. */
function laufen(l: Lauf, sekunden: number, beiSchritt?: (l: Lauf) => Lauf, dt = 1 / 60): Lauf {
  for (let t = 0; t < sekunden && !l.vorbei; t += dt) {
    if (beiSchritt) l = beiSchritt(l);
    l = takt(l, dt);
  }
  return l;
}

/**
 * Eine aufgeräumte Teststrecke: nur das, was der Test hineinlegt.
 *
 * `erzeugtBis` steht bewusst weit voraus. Sonst schiebt `takt` bei einer
 * Startstrecke von ein paar tausend Metern erst einmal hunderte Abschnitte
 * nach — samt eigener Hindernisse, und dann prüft der Test nicht mehr das,
 * was er prüfen soll.
 */
function teststrecke(strecke: number, teile: Partial<Lauf> = {}): Lauf {
  return {
    ...neuesSpiel(SAAT),
    strecke,
    hindernisse: [],
    muenzen: [],
    erzeugtBis: Math.ceil(strecke / ABSCHNITT_LAENGE) + 500,
    ...teile,
  };
}

describe('tempoBei', () => {
  it('fängt beim Anfangstempo an und nähert sich dem Höchstwert', () => {
    expect(tempoBei(0)).toBeCloseTo(TEMPO_START, 6);
    expect(tempoBei(100)).toBeGreaterThan(TEMPO_START);
    expect(tempoBei(100000)).toBeLessThanOrEqual(TEMPO_MAX);
  });

  it('steigt streng, überschreitet den Höchstwert aber nie', () => {
    let vorher = 0;
    for (let s = 0; s <= 20000; s += 50) {
      const jetzt = tempoBei(s);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      expect(jetzt).toBeLessThanOrEqual(TEMPO_MAX);
      vorher = jetzt;
    }
  });
});

describe('Spurwechsel', () => {
  it('wechselt nach links und rechts', () => {
    const l = neuesSpiel(SAAT);
    expect(spurWechseln(l, -1).zielSpur).toBe(0);
    expect(spurWechseln(l, 1).zielSpur).toBe(2);
  });

  it('bleibt am Rand stehen', () => {
    const links = { ...neuesSpiel(SAAT), zielSpur: 0 };
    expect(spurWechseln(links, -1)).toBe(links);
    const rechts = { ...neuesSpiel(SAAT), zielSpur: SPUREN - 1 };
    expect(spurWechseln(rechts, 1)).toBe(rechts);
  });

  it('kommt in der vorgesehenen Zeit an und überschwingt nie', () => {
    let l = spurWechseln(neuesSpiel(SAAT), 1);
    const ziel = spurX(2);
    for (let i = 0; i < 60; i++) {
      l = takt(l, 1 / 60);
      // Nie über das Ziel hinaus — ein Überschwingen sähe aus wie ein Fehler.
      expect(Math.abs(l.x)).toBeLessThanOrEqual(Math.abs(ziel) + 1e-9);
    }
    expect(l.x).toBeCloseTo(ziel, 6);
  });
});

describe('Springen und Rutschen', () => {
  it('hebt beim Sprung ab und landet wieder', () => {
    let l = springen(neuesSpiel(SAAT));
    l = takt(l, 0.2);
    expect(l.y).toBeGreaterThan(0.5);
    l = laufen(l, 2);
    expect(l.y).toBe(0);
  });

  it('lässt keinen zweiten Sprung in der Luft zu', () => {
    let l = springen(neuesSpiel(SAAT));
    l = takt(l, 0.2);
    const inDerLuft = l;
    expect(springen(inDerLuft)).toBe(inDerLuft);
  });

  it('senkt beim Rutschen den Kopf', () => {
    const l = rutschen(neuesSpiel(SAAT));
    expect(kopfhoehe(l)).toBe(HOEHE_RUTSCHEND);
    // Und nach der Rutschzeit steht die Figur wieder.
    expect(kopfhoehe(laufen(l, 1))).toBeGreaterThan(HOEHE_RUTSCHEND);
  });

  it('bricht mit dem Rutschen einen Sprung ab', () => {
    // Sonst hängt man über einem Balken hilflos in der Luft.
    let l = springen(neuesSpiel(SAAT));
    l = takt(l, 0.2);
    const hoch = l.y;
    l = rutschen(l);
    l = takt(l, 0.1);
    expect(l.y).toBeLessThan(hoch);
  });
});

describe('Kollision', () => {
  const bei = (art: Hindernis['art'], spur = 1): Hindernis => ({ art, spur, z: 0 });

  it('trifft eine Mauer auf derselben Spur immer', () => {
    const l = neuesSpiel(SAAT);
    expect(kollision(l, bei('mauer'))).toBe(true);
  });

  it('lässt eine Mauer auf einer anderen Spur durch', () => {
    const l = { ...neuesSpiel(SAAT), x: spurX(0), zielSpur: 0, vonSpur: 0 };
    expect(kollision(l, bei('mauer', 2))).toBe(false);
  });

  it('lässt über eine Hürde springen, aber nicht darunter durch', () => {
    const stehend = neuesSpiel(SAAT);
    expect(kollision(stehend, bei('huerde'))).toBe(true);
    const oben = { ...stehend, y: 1.2 };
    expect(kollision(oben, bei('huerde'))).toBe(false);
    // Rutschen hilft bei einer Hürde ausdrücklich nicht.
    expect(kollision(rutschen(stehend), bei('huerde'))).toBe(true);
  });

  it('lässt unter einem Balken durchrutschen, aber nicht darüber springen', () => {
    const stehend = neuesSpiel(SAAT);
    expect(kollision(stehend, bei('balken'))).toBe(true);
    expect(kollision(rutschen(stehend), bei('balken'))).toBe(false);
    // Springen macht es schlimmer — der Kopf geht ja nach oben.
    const oben = { ...stehend, y: 1.0 };
    expect(kollision(oben, bei('balken'))).toBe(true);
  });

  it('greift nur im richtigen Tiefenbereich', () => {
    const l = neuesSpiel(SAAT);
    expect(kollision(l, { art: 'mauer', spur: 1, z: 40 })).toBe(false);
    expect(kollision(l, { art: 'mauer', spur: 1, z: -40 })).toBe(false);
  });

  /**
   * Der Fehler, der am teuersten war: Bei niedriger Bildrate lief die Figur
   * ab etwa 2500 Metern durch Hindernisse hindurch.
   *
   * Der Zeitschritt ist auf 50 ms gedeckelt, das Tempo läuft gegen 22 m/s —
   * ein Schritt wird dadurch länger als das alte Prüffenster breit war. Das
   * Hindernis lag zwischen zwei Prüfungen und wurde nie gesehen.
   */
  it('sieht ein Hindernis auch dann, wenn ein Zeitschritt darüber hinwegspringt', () => {
    const start = 3000;
    const dt = 0.05; // der Deckel aus `DashCity.tsx`
    const weite = tempoBei(start) * dt;
    expect(weite, 'sonst gibt es die Lücke gar nicht').toBeGreaterThan(1);

    // Genau in die Mitte zwischen altem und neuem Prüffenster.
    const h: Hindernis = { art: 'mauer', spur: 1, z: start + weite / 2 };

    // Der Beleg, dass der Momentanabstand allein es nicht fände:
    expect(kollision(teststrecke(start + weite), h)).toBe(false);
    expect(kollision(teststrecke(start), h)).toBe(false);

    // Über den zurückgelegten Abschnitt gesehen ist es ein Treffer.
    expect(takt(teststrecke(start, { hindernisse: [h] }), dt).vorbei).toBe(true);
  });

  it('trifft dieselbe Mauer bei jeder Bildrate', () => {
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
      const l = laufen(
        teststrecke(3000, { hindernisse: [{ art: 'mauer', spur: 1, z: 3020 }] }),
        3,
        undefined,
        dt,
      );
      expect(l.vorbei, `Bildschritt ${dt}`).toBe(true);
    }
  });

  it('zählt beim Wechseln die echte Position, nicht die Zielspur', () => {
    // Mitten im Wechsel ist man noch nicht drüben — sonst könnte man sich
    // aus einer Mauer heraus„denken", ohne sie verlassen zu haben.
    let l = spurWechseln(neuesSpiel(SAAT), 1);
    l = takt(l, 0.02);
    expect(l.zielSpur).toBe(2);
    expect(Math.abs(l.x - spurX(2))).toBeGreaterThan(SPUR_BREITE / 2);
    expect(kollision(l, bei('mauer', 1))).toBe(true);
  });
});

describe('Fairness', () => {
  it('erkennt eine unpassierbare Reihe aus drei Mauern', () => {
    expect(
      istPassierbar([
        { art: 'mauer', spur: 0, z: 0 },
        { art: 'mauer', spur: 1, z: 0 },
        { art: 'mauer', spur: 2, z: 0 },
      ]),
    ).toBe(false);
  });

  it('erkennt Hürde und Balken auf derselben Spur als unmöglich', () => {
    // Springen und rutschen zugleich geht nicht.
    expect(
      istPassierbar([
        { art: 'huerde', spur: 1, z: 0 },
        { art: 'balken', spur: 1, z: 0 },
      ]),
    ).toBe(false);
  });

  it('lässt zwei Mauern durchgehen — eine Spur bleibt frei', () => {
    expect(
      istPassierbar([
        { art: 'mauer', spur: 0, z: 0 },
        { art: 'mauer', spur: 2, z: 0 },
      ]),
    ).toBe(true);
  });

  /**
   * Der wichtigste Test des ganzen Spiels.
   *
   * Ein Endlosläufer wird schneller, bis er unspielbar ist. Erzeugt er dabei
   * ein Muster, das gar nicht mehr zu schaffen ist, stirbt man nicht durch
   * eigenen Fehler, sondern durch Zufall — und die Bestenliste sagt nichts
   * mehr aus. Deshalb: **jeder** Abschnitt über eine sehr lange Strecke.
   */
  it('erzeugt über 5000 Abschnitte hinweg nur passierbare Muster', () => {
    for (let grund = 1; grund <= 3; grund++) {
      for (let i = 0; i < 5000; i++) {
        const { hindernisse } = abschnittErzeugen(saatAus('laufen', grund), i);
        expect(istPassierbar(hindernisse), `Saat ${grund}, Abschnitt ${i}`).toBe(true);
      }
    }
  });

  it('belegt nie alle drei Spuren gleichzeitig', () => {
    for (let i = 0; i < 3000; i++) {
      const { hindernisse } = abschnittErzeugen(SAAT, i);
      expect(new Set(hindernisse.map((h) => h.spur)).size).toBeLessThan(SPUREN);
    }
  });

  it('lässt selbst beim Höchsttempo genug Strecke zum Reagieren', () => {
    // Der Abstand zwischen zwei Abschnitten muss länger sein als der Weg,
    // den man zum Erkennen und Ausweichen braucht.
    expect(ABSCHNITT_LAENGE).toBeGreaterThan(mindestAbstand(TEMPO_MAX));
  });
});

describe('Erzeugung', () => {
  it('ergibt bei gleicher Nummer immer dasselbe Muster', () => {
    expect(abschnittErzeugen(SAAT, 42)).toEqual(abschnittErzeugen(SAAT, 42));
  });

  it('lässt den Anfang frei, damit man ankommt', () => {
    for (let i = 0; i < 3; i++) {
      expect(abschnittErzeugen(SAAT, i).hindernisse).toHaveLength(0);
    }
  });

  it('schiebt beim Laufen immer neue Abschnitte nach', () => {
    const l = laufen(neuesSpiel(SAAT), 3);
    expect(l.erzeugtBis).toBeGreaterThan(neuesSpiel(SAAT).erzeugtBis);
  });
});

describe('Münzserie', () => {
  /** Läuft, bis eine bestimmte Strecke erreicht ist. */
  const bisStrecke = (l: Lauf, ziel: number, dt = 1 / 60): Lauf => {
    while (l.strecke < ziel && !l.vorbei) l = takt(l, dt);
    return l;
  };

  /** Eine Reihe wie im Spiel: fünf Münzen im Abstand von 1,8 m. */
  const reihe = (ab: number): Muenze[] =>
    Array.from({ length: 5 }, (_, k) => ({ spur: 1, z: ab + k * 1.8, y: 1 }));

  it('zählt Münzen dicht hintereinander hoch', () => {
    const l = bisStrecke(teststrecke(0, { muenzen: reihe(5) }), 14);
    expect(l.muenzenZahl).toBe(5);
    expect(l.muenzSerie).toBe(5);
  });

  /**
   * Der Grund für die Serie: Der Münzton steigt mit ihr und ist bei zwölf
   * Halbtönen gedeckelt. Hinge er wie früher an der Gesamtzahl, wäre er nach
   * rund drei Reihen für den Rest des Laufs am Anschlag.
   */
  it('fängt nach einer Lücke wieder bei null an', () => {
    const letzte = 5 + 4 * 1.8;
    const l = bisStrecke(teststrecke(0, { muenzen: reihe(5) }), letzte + SERIE_ABSTAND + 2);
    expect(l.muenzenZahl).toBe(5);
    expect(l.muenzSerie).toBe(0);
  });

  it('misst die Lücke in Metern, nicht in Sekunden', () => {
    // Das Tempo wächst im Lauf von 9 auf 22 m/s. In Sekunden gemessen
    // bedeutete dieselbe Lücke im Bild am Ende etwas ganz anderes als am
    // Anfang — deshalb zählt die Strecke.
    for (const start of [0, 6000]) {
      const muenzen: Muenze[] = [start + 5, start + 6.8].map((z) => ({ spur: 1, z, y: 1 }));
      const kurz = bisStrecke(teststrecke(start, { muenzen }), start + 6.8 + SERIE_ABSTAND - 2);
      expect(kurz.muenzenZahl, `Start ${start}`).toBe(2);
      expect(kurz.muenzSerie, `Start ${start}, kurze Lücke`).toBe(2);

      const lang = bisStrecke(kurz, start + 6.8 + SERIE_ABSTAND + 2);
      expect(lang.muenzSerie, `Start ${start}, lange Lücke`).toBe(0);
    }
  });

  it('sammelt eine Münze auch beim größten erlaubten Zeitschritt ein', () => {
    // Der Abstand war knapp: 1,1 m Schritt gegen 1,2 m Fenster. Auch hier
    // zählt jetzt der zurückgelegte Abschnitt.
    const start = 3000;
    const dt = 0.05;
    const m: Muenze = { spur: 1, z: start + (tempoBei(start) * dt) / 2, y: 1 };
    expect(takt(teststrecke(start, { muenzen: [m] }), dt).muenzenZahl).toBe(1);
  });
});

describe('Der ganze Lauf', () => {
  it('läuft von allein los und legt Strecke zurück', () => {
    const l = laufen(neuesSpiel(SAAT), 1);
    expect(l.strecke).toBeGreaterThan(TEMPO_START * 0.9);
  });

  it('endet irgendwann, wenn man gar nichts tut', () => {
    const l = laufen(neuesSpiel(SAAT), 60);
    expect(l.vorbei).toBe(true);
  });

  it('rührt einen beendeten Lauf nicht mehr an', () => {
    const vorbei = laufen(neuesSpiel(SAAT), 60);
    expect(takt(vorbei, 0.1)).toBe(vorbei);
    expect(springen(vorbei)).toBe(vorbei);
    expect(spurWechseln(vorbei, 1)).toBe(vorbei);
  });

  /**
   * Der Beleg dafür, dass wirklich nichts von der Uhr abhängt: Zwei Läufe
   * mit derselben Saat und derselben Eingabefolge müssen aufs Komma
   * dasselbe ergeben. Ohne das wäre kein Duell und keine Wiederholung
   * möglich.
   */
  it('ergibt bei gleicher Saat und gleicher Eingabe dasselbe Ergebnis', () => {
    const spielen = () => {
      let l = neuesSpiel(SAAT);
      const dt = 1 / 60;
      for (let n = 0; n < 1200 && !l.vorbei; n++) {
        if (n % 37 === 0) l = spurWechseln(l, 1);
        if (n % 53 === 0) l = spurWechseln(l, -1);
        if (n % 41 === 0) l = springen(l);
        if (n % 67 === 0) l = rutschen(l);
        l = takt(l, dt);
      }
      return { strecke: l.strecke, muenzen: l.muenzenZahl, punkte: punkte(l) };
    };
    expect(spielen()).toEqual(spielen());
  });

  it('sammelt Münzen ein und zählt sie in die Punkte', () => {
    const start = neuesSpiel(SAAT);
    const reihe = start.muenzen[0];
    expect(reihe, 'es muss überhaupt Münzen geben').toBeDefined();

    // Direkt vor die erste Münzreihe setzen und auf ihre Spur stellen.
    // Von vorn loszulaufen hilft nicht: Bis dorthin sind es rund fünf
    // Sekunden, und unterwegs stehen schon Hindernisse.
    const l = laufen(
      {
        ...start,
        strecke: reihe!.z - 2,
        x: spurX(reihe!.spur),
        zielSpur: reihe!.spur,
        vonSpur: reihe!.spur,
      },
      1.5,
    );

    expect(l.muenzenZahl).toBeGreaterThan(0);
    expect(punkte(l)).toBe(Math.floor(l.strecke) + l.muenzenZahl * 10);
  });
});
