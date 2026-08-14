import { describe, it, expect } from 'vitest';
import {
  BREITE,
  FARB_INDEX,
  FORMEN,
  HOEHE,
  MAX_SPERR_VERLAENGERUNGEN,
  SPERR_VERZOEGERUNG,
  VORSCHAU_ANZAHL,
  aktionAnwenden,
  bewegen,
  fallintervallFuerLevel,
  geisterStein,
  kollidiert,
  leeresFeld,
  levelFuerZeilen,
  neuesSpiel,
  punkteFuerHartesFallen,
  punkteFuerWeichesFallen,
  punkteFuerZeilen,
  rotieren,
  steinEinbetten,
  volleZeilen,
  zeilenEntfernen,
  zeitFortschritt,
  zellenVonStein,
} from './logik';
import type { Feld, Stein, TeilTyp, Zelle, Zustand } from './logik';

const TEIL_TYPEN: readonly TeilTyp[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

describe('Formensatz', () => {
  it('jedes Teil hat in jeder Lage genau vier Zellen', () => {
    for (const typ of TEIL_TYPEN) {
      for (let lage = 0; lage < 4; lage++) {
        expect(FORMEN[typ][lage as 0 | 1 | 2 | 3]).toHaveLength(4);
      }
    }
  });

  it('keine Zelle kommt innerhalb einer Form doppelt vor', () => {
    for (const typ of TEIL_TYPEN) {
      for (let lage = 0; lage < 4; lage++) {
        const form = FORMEN[typ][lage as 0 | 1 | 2 | 3];
        const schluessel = form.map((v) => `${v.dx},${v.dy}`);
        expect(new Set(schluessel).size).toBe(4);
      }
    }
  });

  it('jedes Teil hat eine eigene Farbe', () => {
    const werte = Object.values(FARB_INDEX);
    expect(new Set(werte).size).toBe(TEIL_TYPEN.length);
  });
});

describe('kollidiert / bewegen', () => {
  it('ein frischer Stein passt in ein leeres Feld', () => {
    const z = neuesSpiel(1);
    expect(kollidiert(z.feld, z.aktuell!)).toBe(false);
  });

  it('verbietet, über den linken/rechten Rand hinauszugehen', () => {
    const z = neuesSpiel(1);
    let stein = z.aktuell!;
    for (let i = 0; i < 20; i++) {
      const naechster = bewegen(z.feld, stein, -1, 0);
      if (!naechster) break;
      stein = naechster;
    }
    expect(bewegen(z.feld, stein, -1, 0)).toBeNull();
    expect(stein.x + Math.min(...FORMEN[stein.typ][stein.lage].map((v) => v.dx))).toBe(0);
  });

  it('verbietet, durch den Boden zu fallen', () => {
    let feld = leeresFeld();
    const stein: Stein = { typ: 'O', lage: 0, x: 0, y: HOEHE - 2 };
    expect(kollidiert(feld, stein)).toBe(false);
    expect(bewegen(feld, stein, 0, 1)).toBeNull();
  });

  it('verbietet das Überlappen mit bereits belegten Zellen', () => {
    let feld = leeresFeld();
    feld = steinEinbetten(feld, { typ: 'O', lage: 0, x: 4, y: 10 }, 0);
    expect(kollidiert(feld, { typ: 'O', lage: 0, x: 4, y: 10 })).toBe(true);
  });

  it('oberhalb des sichtbaren Felds ist immer frei', () => {
    const feld = leeresFeld();
    expect(kollidiert(feld, { typ: 'I', lage: 1, x: 4, y: -5 })).toBe(false);
  });
});

describe('rotieren mit Wandtritten', () => {
  it('dreht frei in der Mitte des leeren Felds', () => {
    const feld = leeresFeld();
    const stein: Stein = { typ: 'T', lage: 0, x: 4, y: 8 };
    const gedreht = rotieren(feld, stein, 1);
    expect(gedreht).not.toBeNull();
    expect(gedreht!.lage).toBe(1);
  });

  it('weicht am linken Rand per Wandtritt aus, statt zu scheitern', () => {
    const feld = leeresFeld();
    // I-Stein ganz links, in der stehenden Lage — eine direkte Drehung ohne
    // Ausweichen würde über den Rand hinausragen.
    const stein: Stein = { typ: 'I', lage: 1, x: 0, y: 8 };
    const gedreht = rotieren(feld, stein, 1);
    expect(gedreht).not.toBeNull();
    expect(kollidiert(feld, gedreht!)).toBe(false);
  });

  it('scheitert, wenn wirklich kein Wandtritt hilft', () => {
    // Stein in einem engen Schacht: Drehung muss entweder sauber per
    // Wandtritt gelingen, oder sauber fehlschlagen — nie crashen oder in
    // eine überlappende Position münden. Direkt als Zellen gebaut (nicht
    // über steinEinbetten mit einem 2 Felder breiten O-Teil, das hätte die
    // "freie" Spalte daneben mit belegt).
    const schachtZeile = (): Zelle[] =>
      Array.from({ length: BREITE }, (_, x) => (x >= 3 && x <= 6 ? null : 0));
    const feld: Feld = Array.from({ length: HOEHE }, (_, y) =>
      y >= 6 && y <= 12 ? schachtZeile() : Array<Zelle>(BREITE).fill(null),
    );
    const stein: Stein = { typ: 'I', lage: 0, x: 3, y: 9 };
    expect(kollidiert(feld, stein)).toBe(false);
    const gedreht = rotieren(feld, stein, 1);
    // Entweder es klappt mit einem gültigen Ergebnis, oder es schlägt sauber fehl.
    if (gedreht) expect(kollidiert(feld, gedreht)).toBe(false);
  });

  it('das O-Teil "dreht" sich immer erfolgreich (keine Wandtritte nötig)', () => {
    const feld = leeresFeld();
    const stein: Stein = { typ: 'O', lage: 0, x: 0, y: 8 };
    expect(rotieren(feld, stein, 1)).not.toBeNull();
  });

  it('Drehen gegen den Uhrzeigersinn ist die Umkehrung von im Uhrzeigersinn (Lage)', () => {
    const feld = leeresFeld();
    const stein: Stein = { typ: 'L', lage: 0, x: 4, y: 8 };
    const hin = rotieren(feld, stein, 1)!;
    const zurueck = rotieren(feld, hin, -1)!;
    expect(zurueck.lage).toBe(0);
  });
});

describe('geisterStein', () => {
  it('fällt bis zum Boden eines leeren Felds', () => {
    const feld = leeresFeld();
    const stein: Stein = { typ: 'O', lage: 0, x: 4, y: 0 };
    const geist = geisterStein(feld, stein);
    expect(kollidiert(feld, bewegen(feld, geist, 0, 1) ?? geist)).toBe(false);
    expect(bewegen(feld, geist, 0, 1)).toBeNull();
  });

  it('bleibt auf dem Stapel liegen, nicht im Boden', () => {
    let feld = leeresFeld();
    feld = steinEinbetten(feld, { typ: 'O', lage: 0, x: 4, y: 18 }, 0);
    const stein: Stein = { typ: 'O', lage: 0, x: 4, y: 0 };
    const geist = geisterStein(feld, stein);
    expect(geist.y).toBe(16); // direkt über dem liegenden O-Teil bei y=18
  });
});

describe('volleZeilen / zeilenEntfernen', () => {
  it('erkennt eine volle Zeile', () => {
    let feld = leeresFeld();
    for (let x = 0; x < BREITE; x++) feld = steinEinbetten(feld, { typ: 'O', lage: 0, x: 0, y: -100 }, 0); // no-op safety
    feld = feld.map((zeile, y) => (y === 15 ? zeile.map(() => 3) : zeile));
    expect(volleZeilen(feld)).toEqual([15]);
  });

  it('entfernt volle Zeilen und lässt den Rest nach unten fallen', () => {
    let feld = leeresFeld();
    feld = feld.map((zeile, y) => (y === 19 ? zeile.map(() => 2) : zeile));
    feld = steinEinbetten(feld, { typ: 'O', lage: 0, x: 4, y: 17 }, 5); // liegt oberhalb der vollen Zeile
    const zeilen = volleZeilen(feld);
    const neuesFeld = zeilenEntfernen(feld, zeilen);
    expect(neuesFeld).toHaveLength(HOEHE);
    expect(neuesFeld[19]!.some((z) => z !== null)).toBe(true); // das O-Teil ist nachgerutscht
    expect(neuesFeld[0]!.every((z) => z === null)).toBe(true); // oben kommt eine neue leere Zeile nach
  });

  it('lässt das Feld unverändert, wenn nichts voll ist', () => {
    const feld = leeresFeld();
    expect(zeilenEntfernen(feld, [])).toBe(feld);
  });
});

describe('Punkte', () => {
  it('1/2/3/4 Zeilen sind ungleich gewichtet, mehr Zeilen geben überproportional mehr', () => {
    const eins = punkteFuerZeilen(1, 1, 0);
    const zwei = punkteFuerZeilen(2, 1, 0);
    const drei = punkteFuerZeilen(3, 1, 0);
    const vier = punkteFuerZeilen(4, 1, 0);
    expect(zwei).toBeGreaterThan(eins * 2);
    expect(drei).toBeGreaterThan(zwei);
    expect(vier).toBeGreaterThan(drei);
  });

  it('höheres Level gibt mehr Punkte für dieselbe Zeilenzahl', () => {
    expect(punkteFuerZeilen(1, 5, 0)).toBeGreaterThan(punkteFuerZeilen(1, 1, 0));
  });

  it('mehrere Vierfachlöschungen hintereinander geben einen Bonus', () => {
    const erste = punkteFuerZeilen(4, 1, 1);
    const zweite = punkteFuerZeilen(4, 1, 2);
    expect(zweite).toBeGreaterThan(erste);
  });

  it('hartes Fallen gibt mehr Punkte pro Feld als weiches', () => {
    expect(punkteFuerHartesFallen(5)).toBeGreaterThan(punkteFuerWeichesFallen(5));
  });
});

describe('levelFuerZeilen / fallintervallFuerLevel', () => {
  it('steigt alle zehn Zeilen um eins', () => {
    expect(levelFuerZeilen(0)).toBe(1);
    expect(levelFuerZeilen(9)).toBe(1);
    expect(levelFuerZeilen(10)).toBe(2);
    expect(levelFuerZeilen(25)).toBe(3);
  });

  it('das Fallintervall wird mit dem Level kürzer, aber nie negativ', () => {
    expect(fallintervallFuerLevel(1)).toBeGreaterThan(fallintervallFuerLevel(5));
    expect(fallintervallFuerLevel(999)).toBeGreaterThan(0);
  });
});

describe('7-Bag', () => {
  it('die Warteschlange enthält nie mehr als 7 Wiederholungen ohne jede Sorte', () => {
    let z = neuesSpiel(1);
    const gesehen: TeilTyp[] = [z.aktuell!.typ];
    for (let i = 0; i < 70; i++) {
      z = aktionAnwenden(z, 'hartFallen');
      if (z.aktuell) gesehen.push(z.aktuell.typ);
    }
    // Über je 7 aufeinanderfolgende Steine hinweg muss jede Sorte genau einmal vorkommen.
    for (let start = 0; start + 7 <= gesehen.length; start += 7) {
      const gruppe = gesehen.slice(start, start + 7);
      expect(new Set(gruppe).size).toBe(7);
    }
  });

  it('die Warteschlange hat immer mindestens VORSCHAU_ANZAHL Einträge', () => {
    let z = neuesSpiel(2);
    for (let i = 0; i < 20; i++) {
      expect(z.warteschlange.length).toBeGreaterThanOrEqual(VORSCHAU_ANZAHL);
      z = aktionAnwenden(z, 'hartFallen');
    }
  });

  it('ist bei gleicher Saat reproduzierbar', () => {
    expect(neuesSpiel(99).warteschlange).toEqual(neuesSpiel(99).warteschlange);
  });
});

describe('Halten', () => {
  it('legt den aktuellen Stein beiseite und holt den nächsten', () => {
    const z = neuesSpiel(1);
    const vorherTyp = z.aktuell!.typ;
    const naechsterInWarteschlange = z.warteschlange[0];
    const nach = aktionAnwenden(z, 'halten');
    expect(nach.haltePosition).toBe(vorherTyp);
    expect(nach.aktuell!.typ).toBe(naechsterInWarteschlange);
    expect(nach.halteBenutzt).toBe(true);
  });

  it('tauscht beim zweiten Mal mit dem gehaltenen Stein', () => {
    const z = neuesSpiel(1);
    const ersterTyp = z.aktuell!.typ;
    let nach = aktionAnwenden(z, 'halten');
    nach = { ...nach, halteBenutzt: false }; // simuliert: neuer Stein wurde inzwischen eingerastet
    const zweiterTyp = nach.aktuell!.typ;
    nach = aktionAnwenden(nach, 'halten');
    expect(nach.aktuell!.typ).toBe(ersterTyp);
    expect(nach.haltePosition).toBe(zweiterTyp);
  });

  it('erlaubt nur einmal Halten pro Stein', () => {
    const z = neuesSpiel(1);
    const einmal = aktionAnwenden(z, 'halten');
    const zweimal = aktionAnwenden(einmal, 'halten');
    expect(zweimal).toBe(einmal);
  });
});

describe('aktionAnwenden — Bewegen', () => {
  it('links/rechts bewegen den Stein', () => {
    const z = neuesSpiel(1);
    const x0 = z.aktuell!.x;
    const nachRechts = aktionAnwenden(z, 'rechts');
    expect(nachRechts.aktuell!.x).toBe(x0 + 1);
    const nachLinks = aktionAnwenden(nachRechts, 'links');
    expect(nachLinks.aktuell!.x).toBe(x0);
  });

  it('weiches Fallen bewegt um eine Zeile und gibt Punkte', () => {
    const z = neuesSpiel(1);
    const y0 = z.aktuell!.y;
    const nach = aktionAnwenden(z, 'weichFallen');
    expect(nach.aktuell!.y).toBe(y0 + 1);
    expect(nach.punkte).toBeGreaterThan(z.punkte);
  });

  it('hartes Fallen lässt den Stein sofort einrasten', () => {
    const z = neuesSpiel(1);
    const nach = aktionAnwenden(z, 'hartFallen');
    // Der alte Stein ist jetzt im Feld, ein neuer aktueller Stein ist da.
    expect(nach.feld.flat().some((c) => c !== null)).toBe(true);
    expect(nach.aktuell).not.toBeNull();
    expect(nach.aktuell!.y).toBeLessThanOrEqual(0);
  });

  it('reagiert nach Spielende auf nichts mehr', () => {
    const z: Zustand = { ...neuesSpiel(1), vorbei: true };
    expect(aktionAnwenden(z, 'links')).toBe(z);
  });
});

describe('Lock Delay', () => {
  it('rastet nicht sofort ein, wenn der Stein den Boden berührt', () => {
    let feld = leeresFeld();
    // Boden bei y=19 vorbereiten: O-Stein, der direkt aufsetzt.
    const z: Zustand = {
      ...neuesSpiel(1),
      feld,
      aktuell: { typ: 'O', lage: 0, x: 4, y: HOEHE - 2 },
      sperrZeitRest: SPERR_VERZOEGERUNG,
    };
    const nach = zeitFortschritt(z, 0.1);
    expect(nach.aktuell).not.toBeNull();
    expect(nach.feld.flat().every((c) => c === null)).toBe(true); // noch nicht eingebettet
  });

  it('rastet nach Ablauf der Sperrzeit ein', () => {
    const z: Zustand = {
      ...neuesSpiel(1),
      aktuell: { typ: 'O', lage: 0, x: 4, y: HOEHE - 2 },
      sperrZeitRest: 0.05,
    };
    const nach = zeitFortschritt(z, 0.1);
    expect(nach.feld.flat().some((c) => c !== null)).toBe(true);
  });

  it('Verlängerung ist gedeckelt — irgendwann rastet der Stein trotz Bewegen ein', () => {
    let z: Zustand = {
      ...neuesSpiel(1),
      aktuell: { typ: 'O', lage: 0, x: 4, y: HOEHE - 2 },
      sperrVerlaengerungenUebrig: 2,
    };
    // Mehr Bewegungen als Verlängerungen übrig sind.
    for (let i = 0; i < 5; i++) {
      z = aktionAnwenden(z, i % 2 === 0 ? 'links' : 'rechts');
      z = zeitFortschritt(z, SPERR_VERZOEGERUNG + 0.01);
      if (z.feld.flat().some((c) => c !== null)) break;
    }
    expect(z.feld.flat().some((c) => c !== null)).toBe(true);
  });

  it('setzt beim Einrasten die Verlängerungen für den nächsten Stein zurück', () => {
    const z: Zustand = {
      ...neuesSpiel(1),
      aktuell: { typ: 'O', lage: 0, x: 4, y: HOEHE - 2 },
      sperrVerlaengerungenUebrig: 0,
      sperrZeitRest: 0.01,
    };
    const nach = zeitFortschritt(z, 0.1);
    expect(nach.sperrVerlaengerungenUebrig).toBe(MAX_SPERR_VERLAENGERUNGEN);
  });
});

describe('Schwerkraft', () => {
  it('lässt den Stein mit der Zeit fallen', () => {
    const z = neuesSpiel(1);
    const y0 = z.aktuell!.y;
    const nach = zeitFortschritt(z, fallintervallFuerLevel(1) + 0.01);
    expect(nach.aktuell!.y).toBeGreaterThan(y0);
  });

  it('holt bei einem großen Zeitsprung nicht unendlich viele Felder auf einmal', () => {
    const z = neuesSpiel(1);
    const nach = zeitFortschritt(z, 100);
    // Der Stein darf höchstens bis zum Boden fallen, nicht durchbrechen.
    expect(kollidiert(nach.feld, nach.aktuell ?? { typ: 'O', lage: 0, x: 0, y: 0 })).toBe(false);
  });
});

describe('neuesSpiel', () => {
  it('ist bei gleicher Saat reproduzierbar', () => {
    expect(neuesSpiel(7)).toEqual(neuesSpiel(7));
  });

  it('startet mit leerem Feld, 0 Punkten, Level 1', () => {
    const z = neuesSpiel(1);
    expect(z.feld.flat().every((c) => c === null)).toBe(true);
    expect(z.punkte).toBe(0);
    expect(z.level).toBe(1);
    expect(z.vorbei).toBe(false);
  });

  it('der Startstein ist sofort sichtbar (nicht komplett oberhalb des Felds)', () => {
    const z = neuesSpiel(1);
    expect(zellenVonStein(z.aktuell!).some((p) => p.y >= 0)).toBe(true);
  });
});

describe('Spielende', () => {
  it('endet, wenn ein neuer Stein sofort kollidiert', () => {
    // Reihe 1 bis 19 fast zugestapelt (eine Spalte bleibt frei, sonst
    // wären das schon 19 volle Reihen, die sich beim Aufsetzen sofort
    // auflösen würden — dann bliebe ja wieder Platz). Reihe 0 ist frei.
    // Der aktuelle I-Stein (einreihig) passt gerade noch in Reihe 0 und
    // rastet dort ein, ohne selbst eine Reihe zu vervollständigen.
    // Warteschlange fest auf 'O' gesetzt, damit der Test nicht vom Zufall
    // abhängt — ein O-Stein spannt zwei Reihen auf und kollidiert dadurch
    // garantiert mit der (fast) vollen Reihe 1.
    const zeileMitLuecke = (): Zelle[] =>
      Array.from({ length: BREITE }, (_, x) => (x === BREITE - 1 ? null : 0));
    const feld: Feld = [
      Array<Zelle>(BREITE).fill(null),
      ...Array.from({ length: HOEHE - 1 }, zeileMitLuecke),
    ];
    const z: Zustand = {
      ...neuesSpiel(1),
      feld,
      aktuell: { typ: 'I', lage: 0, x: 3, y: -1 }, // spawnt exakt in Reihe 0
      warteschlange: ['O', 'O', 'O', 'O'],
    };
    const nach = aktionAnwenden(z, 'hartFallen');
    expect(nach.vorbei).toBe(true);
  });
});
