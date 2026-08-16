import { describe, it, expect } from 'vitest';
import {
  BREITE,
  GOLD_JE_FUTTER,
  HOEHE,
  PUNKTE_GOLD,
  PUNKTE_JE_FUTTER,
  START_LAENGE,
  TAKT_MIN_S,
  TAKT_START_S,
  bildGeaendert,
  feldWechseln,
  freiesFeld,
  neuesSpiel,
  richtungWaehlen,
  zeitFortschritt,
} from './logik';
import type { Punkt, Zustand } from './logik';

/** Baut einen Zustand mit gesetzter Schlange und weit entferntem Futter. */
function stand(teile: Partial<Zustand> = {}): Zustand {
  const basis = neuesSpiel(1);
  return { ...basis, futter: { x: BREITE - 1, y: HOEHE - 1 }, gold: null, ...teile };
}

/**
 * Alle Kacheln in Schlangenlinien — Zeile für Zeile, jede zweite rückwärts.
 * Zwei aufeinanderfolgende Einträge sind dadurch immer Nachbarn, die Liste
 * ist also ein gültiger Schlangenkörper über das ganze Brett.
 */
function alleKachelnAlsWeg(): Punkt[] {
  const weg: Punkt[] = [];
  for (let y = 0; y < HOEHE; y++) {
    for (let i = 0; i < BREITE; i++) {
      const x = y % 2 === 0 ? i : BREITE - 1 - i;
      weg.push({ x, y });
    }
  }
  return weg;
}

describe('neuesSpiel', () => {
  it('legt eine Schlange der Startlänge an', () => {
    const z = neuesSpiel(1);
    expect(z.schlange).toHaveLength(START_LAENGE);
    expect(z.vorbei).toBe(false);
    expect(z.punkte).toBe(0);
    expect(z.taktS).toBe(TAKT_START_S);
  });

  it('legt das Futter nicht auf die Schlange', () => {
    for (let saat = 0; saat < 30; saat++) {
      const z = neuesSpiel(saat);
      expect(z.schlange.some((p) => p.x === z.futter.x && p.y === z.futter.y)).toBe(false);
    }
  });

  it('gleiche Saat ergibt denselben Anfang', () => {
    expect(neuesSpiel(77)).toEqual(neuesSpiel(77));
  });
});

describe('freiesFeld', () => {
  it('meidet belegte Felder', () => {
    const belegt: Punkt[] = [];
    for (let y = 0; y < HOEHE; y++) {
      for (let x = 0; x < BREITE; x++) {
        if (!(x === 4 && y === 6)) belegt.push({ x, y });
      }
    }
    expect(freiesFeld(belegt, 5).feld).toEqual({ x: 4, y: 6 });
  });

  it('gibt null zurück, wenn das Feld voll ist', () => {
    const belegt: Punkt[] = [];
    for (let y = 0; y < HOEHE; y++) for (let x = 0; x < BREITE; x++) belegt.push({ x, y });
    expect(freiesFeld(belegt, 5).feld).toBeNull();
  });
});

describe('richtungWaehlen', () => {
  it('merkt eine Richtung quer zur aktuellen vor', () => {
    const z = richtungWaehlen(stand(), 'hoch');
    expect(z.gepuffert).toBe('hoch');
  });

  it('verwirft die Gegenrichtung — sonst führe man in den eigenen Hals', () => {
    const z = stand({ richtung: 'rechts' });
    expect(richtungWaehlen(z, 'links')).toBe(z);
  });

  it('ändert nichts, wenn die Runde vorbei ist', () => {
    const z = stand({ vorbei: true });
    expect(richtungWaehlen(z, 'hoch')).toBe(z);
  });
});

describe('feldWechseln', () => {
  it('rückt den Kopf ein Feld weiter und lässt die Länge gleich', () => {
    const z = stand({
      schlange: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      richtung: 'rechts',
    });
    const nach = feldWechseln(z);
    expect(nach.schlange[0]).toEqual({ x: 6, y: 5 });
    expect(nach.schlange).toHaveLength(3);
  });

  it('übernimmt die gepufferte Richtung und leert den Puffer', () => {
    const z = richtungWaehlen(stand({ richtung: 'rechts' }), 'hoch');
    const nach = feldWechseln(z);
    expect(nach.richtung).toBe('hoch');
    expect(nach.gepuffert).toBeNull();
  });

  it('läuft am Rand auf der anderen Seite weiter', () => {
    const z = stand({
      schlange: [
        { x: BREITE - 1, y: 5 },
        { x: BREITE - 2, y: 5 },
      ],
      richtung: 'rechts',
    });
    expect(feldWechseln(z).schlange[0]).toEqual({ x: 0, y: 5 });
  });

  it('wächst beim Futter, gibt Punkte und wird schneller', () => {
    const z = stand({
      schlange: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      richtung: 'rechts',
      futter: { x: 6, y: 5 },
    });
    const nach = feldWechseln(z);
    expect(nach.schlange).toHaveLength(3);
    expect(nach.punkte).toBe(PUNKTE_JE_FUTTER);
    expect(nach.taktS).toBeLessThan(z.taktS);
    // Das neue Futter darf nicht unter der Schlange liegen.
    expect(nach.schlange.some((p) => p.x === nach.futter.x && p.y === nach.futter.y)).toBe(false);
  });

  it('beschleunigt nie über das Tempolimit hinaus', () => {
    let z = stand({ taktS: TAKT_MIN_S });
    for (let i = 0; i < 5; i++) {
      z = { ...z, futter: { ...z.schlange[0]!, x: z.schlange[0]!.x + 1 } };
      z = feldWechseln(z);
    }
    expect(z.taktS).toBe(TAKT_MIN_S);
  });

  it('ist vorbei, wenn die Schlange sich selbst berührt', () => {
    // Ring aus vier Feldern, Kopf läuft in den eigenen Körper.
    const z = stand({
      schlange: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      richtung: 'rechts',
    });
    expect(feldWechseln(z).vorbei).toBe(true);
  });

  it('darf auf das Feld ziehen, das der Schwanz gerade freigibt', () => {
    // Kopf läuft genau dorthin, wo das letzte Glied stand — das rückt im
    // selben Schritt weg, ist also kein Zusammenstoß.
    const z = stand({
      schlange: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
      ],
      richtung: 'rechts',
    });
    expect(feldWechseln(z).vorbei).toBe(false);
  });

  it('ändert nichts mehr, wenn die Runde vorbei ist', () => {
    const z = stand({ vorbei: true });
    expect(feldWechseln(z)).toBe(z);
  });
});

describe('volles Brett', () => {
  it('ist gewonnen, wenn die Schlange die letzte Kachel füllt', () => {
    const weg = alleKachelnAlsWeg();
    const frei = weg[weg.length - 1]!;
    // Kopf zuerst: der Körper läuft rückwärts durch alle Kacheln bis auf
    // die eine, auf der das letzte Futter liegt.
    const schlange = weg.slice(0, -1).reverse();
    const z = stand({ schlange, richtung: 'rechts', futter: frei, gold: null });
    expect(schlange[0]).toEqual({ x: frei.x - 1, y: frei.y });

    const nach = feldWechseln(z);
    expect(nach.schlange).toHaveLength(BREITE * HOEHE);
    expect(nach.vorbei).toBe(true);
    expect(nach.gewonnen).toBe(true);
    expect(nach.punkte).toBe(PUNKTE_JE_FUTTER);
  });

  it('gibt danach keine Punkte mehr — vorher lag das Futter unter dem Kopf', () => {
    const weg = alleKachelnAlsWeg();
    const z = stand({
      schlange: weg.slice(0, -1).reverse(),
      richtung: 'rechts',
      futter: weg[weg.length - 1]!,
      gold: null,
      taktS: 0.1,
    });
    const gewonnen = feldWechseln(z);
    // Zehn volle Sekunden weiterlaufen lassen: Der Punktestand darf sich
    // nicht mehr rühren, sonst sammelt man dieselbe Kachel endlos ein.
    expect(zeitFortschritt(gewonnen, 10)).toBe(gewonnen);
  });

  it('lässt das Goldstück dem letzten Apfel den Platz', () => {
    const weg = alleKachelnAlsWeg();
    const goldFeld = weg[weg.length - 1]!;
    const futterFeld = weg[weg.length - 2]!;
    const z = stand({
      schlange: weg.slice(0, -2).reverse(),
      richtung: 'rechts',
      futter: futterFeld,
      gold: goldFeld,
      goldRest: 20,
    });

    const nach = feldWechseln(z);
    expect(nach.gewonnen).toBe(false);
    expect(nach.futter).toEqual(goldFeld);
    expect(nach.gold).toBeNull();
    // Das Futter darf auf keinen Fall unter der Schlange liegen.
    expect(nach.schlange.some((p) => p.x === nach.futter.x && p.y === nach.futter.y)).toBe(false);
  });
});

describe('Goldstücke', () => {
  it('erscheinen nach genügend Futter', () => {
    let z = stand({
      schlange: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      richtung: 'rechts',
      seitGold: GOLD_JE_FUTTER - 1,
    });
    z = { ...z, futter: { x: 3, y: 2 } };
    const nach = feldWechseln(z);
    expect(nach.gold).not.toBeNull();
    expect(nach.seitGold).toBe(0);
  });

  it('geben beim Fressen Zusatzpunkte und verschwinden', () => {
    const z = stand({
      schlange: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      richtung: 'rechts',
      gold: { x: 6, y: 5 },
      goldRest: 10,
    });
    const nach = feldWechseln(z);
    expect(nach.punkte).toBe(PUNKTE_GOLD);
    expect(nach.gold).toBeNull();
  });

  it('verschwinden von selbst, wenn die Zeit abgelaufen ist', () => {
    // goldRest zählt die Schritte, die das Stück noch liegen bleibt: bei 2
    // ist es nach dem zweiten Schritt weg.
    const z = stand({
      schlange: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      richtung: 'rechts',
      gold: { x: 9, y: 9 },
      goldRest: 2,
    });
    const einSchritt = feldWechseln(z);
    expect(einSchritt.gold).not.toBeNull();
    expect(feldWechseln(einSchritt).gold).toBeNull();
  });
});

describe('zeitFortschritt', () => {
  it('rückt erst, wenn ein voller Takt zusammen ist', () => {
    const z = stand({ taktS: 0.2 });
    const kurz = zeitFortschritt(z, 0.1);
    expect(kurz.schlange[0]).toEqual(z.schlange[0]);
    expect(kurz.angesammelt).toBeCloseTo(0.1);

    const voll = zeitFortschritt(kurz, 0.15);
    expect(voll.schlange[0]).not.toEqual(z.schlange[0]);
  });

  it('holt mehrere fällige Takte in einem Aufruf nach', () => {
    const z = stand({
      schlange: [
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ],
      richtung: 'rechts',
      taktS: 0.1,
    });
    const nach = zeitFortschritt(z, 0.35);
    expect(nach.schlange[0]).toEqual({ x: 5, y: 5 });
  });

  it('ändert nichts mehr, wenn die Runde vorbei ist', () => {
    const z = stand({ vorbei: true });
    expect(zeitFortschritt(z, 1)).toBe(z);
  });
});

describe('bildGeaendert', () => {
  it('meldet nichts, solange nur Zeit angesammelt wird', () => {
    // Genau der Fall, der das Spiel 60-mal je Sekunde neu zeichnen ließ:
    // Es hat sich nur `angesammelt` bewegt, und daran hängt kein Pixel.
    const z = stand({ taktS: 0.2 });
    const kurz = zeitFortschritt(z, 0.05);
    expect(kurz).not.toBe(z);
    expect(bildGeaendert(z, kurz)).toBe(false);
  });

  it('meldet einen Feldwechsel', () => {
    const z = stand({ taktS: 0.1 });
    expect(bildGeaendert(z, zeitFortschritt(z, 0.2))).toBe(true);
  });

  it('meldet auch den Zusammenstoß, bei dem die Kette stehen bleibt', () => {
    const z = stand({
      schlange: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      richtung: 'rechts',
      taktS: 0.1,
    });
    const nach = zeitFortschritt(z, 0.2);
    expect(nach.vorbei).toBe(true);
    expect(nach.schlange).toBe(z.schlange);
    expect(bildGeaendert(z, nach)).toBe(true);
  });
});
