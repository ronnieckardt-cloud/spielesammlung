import { describe, it, expect } from 'vitest';
import {
  KAPAZITAET,
  MAX_FARBEN,
  MIN_FARBEN,
  anzahlUebertragbar,
  extraRoehrchenHinzufuegen,
  farbenFuerLevel,
  giessen,
  istGeloest,
  kannGiessen,
  loesbar,
  neuesLevel,
  punkteFuerLoesung,
  roehrchenAntippen,
  zurueck,
  roehrchenFertig,
} from './logik';
import type { Brett, Zustand } from './logik';

describe('kannGiessen / anzahlUebertragbar', () => {
  it('erlaubt Gießen auf ein leeres Röhrchen', () => {
    expect(kannGiessen([0, 0], [])).toBe(true);
  });

  it('erlaubt Gießen, wenn oben dieselbe Farbe liegt und Platz ist', () => {
    expect(kannGiessen([1, 0], [0])).toBe(true);
  });

  it('verbietet Gießen bei unterschiedlicher Farbe oben', () => {
    expect(kannGiessen([1, 0], [1])).toBe(false);
  });

  it('verbietet Gießen aus einem leeren Röhrchen', () => {
    expect(kannGiessen([], [0])).toBe(false);
  });

  it('verbietet Gießen in ein volles Röhrchen', () => {
    expect(kannGiessen([0], [0, 0, 0, 0])).toBe(false);
  });

  it('überträgt nur die oberste Farbe in Serie', () => {
    expect(anzahlUebertragbar([0, 1, 1, 1], [])).toBe(3);
    expect(anzahlUebertragbar([1, 1, 1, 1], [])).toBe(4);
  });

  it('begrenzt die Übertragung durch den Platz im Ziel', () => {
    expect(anzahlUebertragbar([0, 1, 1, 1], [1, 1, 1])).toBe(1); // nur 1 Platz frei
  });

  it('gibt 0, wenn gar nicht gegossen werden kann', () => {
    expect(anzahlUebertragbar([1], [0])).toBe(0);
  });
});

describe('giessen', () => {
  it('verschiebt die Schichten korrekt', () => {
    const brett: Brett = [[0, 1, 1], [], [2, 2, 2, 2]];
    const neu = giessen(brett, 0, 1);
    expect(neu[0]).toEqual([0]);
    expect(neu[1]).toEqual([1, 1]);
    expect(neu[2]).toEqual([2, 2, 2, 2]); // unbeteiligt, unverändert
  });

  it('lässt das Original unverändert (keine Mutation)', () => {
    const brett: Brett = [[0, 1], []];
    giessen(brett, 0, 1);
    expect(brett[0]).toEqual([0, 1]);
    expect(brett[1]).toEqual([]);
  });

  it('gibt dasselbe Brett zurück, wenn der Zug ungültig ist', () => {
    const brett: Brett = [[1], [0]];
    expect(giessen(brett, 0, 1)).toBe(brett);
  });
});

describe('istGeloest', () => {
  it('ist gelöst, wenn jedes Röhrchen leer oder einfarbig voll ist', () => {
    expect(istGeloest([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
  });

  it('ist nicht gelöst, wenn ein Röhrchen gemischt ist', () => {
    expect(istGeloest([[0, 0, 0, 1]])).toBe(false);
  });

  it('ist nicht gelöst, wenn ein Röhrchen einfarbig, aber nicht voll ist', () => {
    expect(istGeloest([[0, 0]])).toBe(false);
  });
});

describe('loesbar', () => {
  it('erkennt ein bereits gelöstes Brett', () => {
    expect(loesbar([[0, 0], []], 2)).toBe(true);
  });

  it('erkennt ein einfaches lösbares Brett', () => {
    // Ein Zug: die 0 von Röhrchen 1 auf Röhrchen 0 gießen, fertig.
    expect(loesbar([[0], [0], []], 2)).toBe(true);
  });

  it('erkennt ein unlösbares Brett', () => {
    // Zwei Farben, komplett verriegelt: kein Zug möglich UND nicht gelöst.
    expect(loesbar([[0, 1], [1, 0]], 2)).toBe(false);
  });

  it('findet auch einen Weg über mehrere Züge', () => {
    // Klassisches 3-Farben-Beispiel, klar lösbar mit einem zusätzlichen leeren Röhrchen.
    const brett: Brett = [
      [0, 1, 2, 0],
      [1, 2, 0, 1],
      [2, 0, 1, 2],
      [],
    ];
    expect(loesbar(brett, 4)).toBe(true);
  });
});

describe('farbenFuerLevel', () => {
  it('startet bei der Mindestfarbenzahl', () => {
    expect(farbenFuerLevel(1)).toBe(MIN_FARBEN);
    expect(farbenFuerLevel(2)).toBe(MIN_FARBEN);
  });

  it('steigt alle zwei Level um eins', () => {
    expect(farbenFuerLevel(3)).toBe(MIN_FARBEN + 1);
    expect(farbenFuerLevel(5)).toBe(MIN_FARBEN + 2);
  });

  it('deckelt bei der Höchstfarbenzahl', () => {
    expect(farbenFuerLevel(999)).toBe(MAX_FARBEN);
  });
});

describe('neuesLevel', () => {
  it('ist bei gleicher Levelnummer immer dasselbe Brett', () => {
    expect(neuesLevel(7)).toEqual(neuesLevel(7));
  });

  it('unterscheidet sich zwischen zwei Levelnummern', () => {
    expect(neuesLevel(1).roehrchen).not.toEqual(neuesLevel(2).roehrchen);
  });

  it('erzeugt immer ein lösbares Brett', () => {
    for (let level = 1; level <= 10; level++) {
      const z = neuesLevel(level);
      expect(loesbar(z.roehrchen, KAPAZITAET)).toBe(true);
    }
  });

  it('erzeugt genau zwei leere Röhrchen zu Beginn', () => {
    const z = neuesLevel(4);
    expect(z.roehrchen.filter((r) => r.length === 0)).toHaveLength(2);
  });

  it('jedes Röhrchen enthält gültige Farbindizes und jede Farbe genau kapazitaet-mal', () => {
    const z = neuesLevel(5);
    const alle = z.roehrchen.flat();
    const zaehlung = new Map<number, number>();
    for (const f of alle) zaehlung.set(f, (zaehlung.get(f) ?? 0) + 1);
    expect(zaehlung.size).toBe(z.farbenAnzahl);
    for (const anzahl of zaehlung.values()) expect(anzahl).toBe(KAPAZITAET);
  });
});

describe('roehrchenAntippen', () => {
  it('wählt ein nicht leeres Röhrchen aus', () => {
    const z = neuesLevel(1);
    const nichtLeer = z.roehrchen.findIndex((r) => r.length > 0);
    const nach = roehrchenAntippen(z, nichtLeer);
    expect(nach.ausgewaehlt).toBe(nichtLeer);
  });

  it('wählt kein leeres Röhrchen aus', () => {
    const z = neuesLevel(1);
    const leer = z.roehrchen.findIndex((r) => r.length === 0);
    const nach = roehrchenAntippen(z, leer);
    expect(nach.ausgewaehlt).toBeNull();
  });

  it('wählt bei erneutem Antippen desselben Röhrchens ab', () => {
    const z = neuesLevel(1);
    const quelle = z.roehrchen.findIndex((r) => r.length > 0);
    const ausgewaehlt = roehrchenAntippen(z, quelle);
    expect(roehrchenAntippen(ausgewaehlt, quelle).ausgewaehlt).toBeNull();
  });

  it('gießt bei gültigem zweitem Antippen und zählt den Zug', () => {
    const z0 = { ...neuesLevel(1), roehrchen: [[0, 0], [1]], ausgewaehlt: null } as const;
    const z1 = roehrchenAntippen(z0, 0);
    const z2 = roehrchenAntippen(z1, 1);
    expect(z2.roehrchen[1]).toEqual([1]); // Ziel passt nicht (1 ≠ 0) → kein Guss
    expect(z2.ausgewaehlt).toBe(1); // stattdessen umgewählt

    const passendesZiel = { ...neuesLevel(1), roehrchen: [[1, 0], []], ausgewaehlt: 0 } as const;
    const gegossen = roehrchenAntippen(passendesZiel, 1);
    expect(gegossen.roehrchen[0]).toEqual([1]);
    expect(gegossen.roehrchen[1]).toEqual([0]);
    expect(gegossen.zuege).toBe(1);
    expect(gegossen.verlauf).toHaveLength(1);
  });

  it('markiert geloest, sobald das Brett fertig sortiert ist', () => {
    const z = { ...neuesLevel(1), roehrchen: [[0], [0, 0, 0]], ausgewaehlt: 0 } as const;
    const nach = roehrchenAntippen(z, 1);
    expect(nach.geloest).toBe(true);
  });

  it('reagiert nach der Lösung auf nichts mehr', () => {
    const geloest = { ...neuesLevel(1), roehrchen: [[0, 0], []], geloest: true } as const;
    expect(roehrchenAntippen(geloest, 1)).toBe(geloest);
  });
});

describe('zurueck', () => {
  it('stellt exakt den vorherigen Zustand wieder her', () => {
    let z: Zustand = { ...neuesLevel(1), roehrchen: [[0, 0], []], ausgewaehlt: 0 };
    const vorher = z;
    z = roehrchenAntippen(z, 1);
    expect(z.roehrchen).not.toEqual(vorher.roehrchen);
    const zurueckgesetzt = zurueck(z);
    expect(zurueckgesetzt.roehrchen).toEqual(vorher.roehrchen);
    expect(zurueckgesetzt.zuege).toBe(vorher.zuege);
  });

  it('geht mehrere Schritte zurück, einen nach dem anderen', () => {
    let z: Zustand = { ...neuesLevel(1), roehrchen: [[1, 0], [], []], ausgewaehlt: null };
    const start = z;
    z = roehrchenAntippen(z, 0);
    z = roehrchenAntippen(z, 1);
    expect(z.roehrchen[1]).toEqual([0]);
    z = zurueck(z);
    expect(z.roehrchen).toEqual(start.roehrchen);
  });

  it('tut nichts, wenn der Verlauf leer ist', () => {
    const z = neuesLevel(1);
    expect(zurueck(z)).toBe(z);
  });

  it('verlässt einen gelösten Zustand wieder', () => {
    const z = { ...neuesLevel(1), roehrchen: [[0], [0, 0, 0]], ausgewaehlt: 0 } as const;
    const geloest = roehrchenAntippen(z, 1);
    expect(geloest.geloest).toBe(true);
    expect(zurueck(geloest).geloest).toBe(false);
  });
});

describe('extraRoehrchenHinzufuegen', () => {
  it('fügt genau einmal ein leeres Röhrchen hinzu', () => {
    const z = neuesLevel(1);
    const anzahlVorher = z.roehrchen.length;
    const einmal = extraRoehrchenHinzufuegen(z);
    expect(einmal.roehrchen).toHaveLength(anzahlVorher + 1);
    expect(einmal.roehrchen.at(-1)).toEqual([]);
    expect(einmal.extraRoehrchenUebrig).toBe(0);

    const zweimal = extraRoehrchenHinzufuegen(einmal);
    expect(zweimal).toBe(einmal); // kein zweites Mal in diesem Level
  });

  it('lässt sich rückgängig machen', () => {
    const z = neuesLevel(1);
    const mitExtra = extraRoehrchenHinzufuegen(z);
    expect(zurueck(mitExtra).roehrchen).toEqual(z.roehrchen);
  });
});

describe('punkteFuerLoesung', () => {
  it('gibt mehr Punkte für weniger Züge', () => {
    expect(punkteFuerLoesung(5, MIN_FARBEN)).toBeGreaterThan(punkteFuerLoesung(20, MIN_FARBEN));
  });

  it('gibt mehr Punkte für mehr Farben bei gleichen Zügen', () => {
    expect(punkteFuerLoesung(10, MAX_FARBEN)).toBeGreaterThan(punkteFuerLoesung(10, MIN_FARBEN));
  });

  it('fällt nie unter die Mindestpunktzahl', () => {
    expect(punkteFuerLoesung(9999, MIN_FARBEN)).toBeGreaterThanOrEqual(100);
  });
});

describe('roehrchenFertig', () => {
  it('ist wahr bei vollem, einfarbigem Röhrchen', () => {
    expect(roehrchenFertig([2, 2, 2, 2], 4)).toBe(true);
  });

  it('ist falsch, wenn es nicht voll ist', () => {
    expect(roehrchenFertig([2, 2, 2], 4)).toBe(false);
  });

  it('ist falsch bei gemischten Farben', () => {
    expect(roehrchenFertig([2, 2, 3, 2], 4)).toBe(false);
  });

  it('ist falsch beim leeren Röhrchen — da gibt es nichts zu feiern', () => {
    expect(roehrchenFertig([], 4)).toBe(false);
  });
});
