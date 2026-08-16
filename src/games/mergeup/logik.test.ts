import { describe, it, expect } from 'vitest';
import {
  GROESSE,
  ZIEL_STUFE,
  hoechsteStufe,
  kachelSetzen,
  leeresRaster,
  neuesSpiel,
  reiheSchieben,
  schieben,
  wertVonStufe,
  ziehen,
  zugMoeglich,
} from './logik';
import type { Feld, Zustand } from './logik';
import { kachelFarbe, kachelTextFarbe, kontrast } from './farben';

/** Kurzschreibweise: aus Zeilen von Stufen ein Raster bauen (0 = leer). */
function r(...zeilen: number[][]): Feld[][] {
  return zeilen.map((zeile) => zeile.map((v) => (v === 0 ? null : v)));
}

function stand(raster: Feld[][], rest: Partial<Zustand> = {}): Zustand {
  return {
    raster,
    punkte: 0,
    hoechsteStufe: hoechsteStufe(raster),
    gewonnen: false,
    vorbei: false,
    saat: 1,
    zug: 0,
    bild: null,
    ...rest,
  };
}

/**
 * Die Zahl auf der Kachel muss lesbar sein — und zwar auf **jeder** Stufe.
 *
 * Vorher entschied eine Handliste, welche Kachel als hell gilt; sie nannte nur
 * 32 und 64, tatsächlich ist aber die ganze Reihe hell. Auf neun von elf
 * Kacheln stand deshalb weiße Schrift mit 1,7:1 bis 4,0:1. Der Test hängt an
 * der Farbliste und nicht an der Rechnung: Er schlägt an, sobald jemand eine
 * Kachelfarbe ändert, mit der keine der beiden Schriftfarben mehr auskommt.
 */
describe('kachelTextFarbe', () => {
  it('bleibt auf jeder Stufe über der Lesbarkeitsgrenze von 4,5:1', () => {
    for (let stufe = 1; stufe <= ZIEL_STUFE; stufe++) {
      const wert = kontrast(kachelFarbe(stufe), kachelTextFarbe(stufe));
      expect(wert, `Stufe ${stufe} (${wertVonStufe(stufe)})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('wählt immer die bessere der beiden Schriftfarben', () => {
    for (let stufe = 1; stufe <= ZIEL_STUFE; stufe++) {
      const gewaehlt = kachelTextFarbe(stufe);
      const andere = gewaehlt === '#ffffff' ? '#0b0f14' : '#ffffff';
      expect(kontrast(kachelFarbe(stufe), gewaehlt)).toBeGreaterThanOrEqual(
        kontrast(kachelFarbe(stufe), andere),
      );
    }
  });
});

describe('wertVonStufe', () => {
  it('rechnet Stufen in angezeigte Werte um', () => {
    expect(wertVonStufe(1)).toBe(2);
    expect(wertVonStufe(2)).toBe(4);
    expect(wertVonStufe(ZIEL_STUFE)).toBe(2048);
  });
});

describe('reiheSchieben', () => {
  it('schiebt Kacheln nach links zusammen', () => {
    expect(reiheSchieben([null, 1, null, 2]).reihe).toEqual([1, 2, null, null]);
  });

  it('verschmilzt zwei gleiche zur nächsten Stufe und gibt Punkte', () => {
    const e = reiheSchieben([1, 1, null, null]);
    expect(e.reihe).toEqual([2, null, null, null]);
    expect(e.punkte).toBe(wertVonStufe(2));
  });

  it('verschmilzt jede Kachel nur einmal pro Zug', () => {
    // 2,2,2,2 wird zu 4,4 — nicht zu 8.
    const e = reiheSchieben([1, 1, 1, 1]);
    expect(e.reihe).toEqual([2, 2, null, null]);
    expect(e.punkte).toBe(wertVonStufe(2) * 2);
  });

  it('verschmilzt das vordere Paar zuerst', () => {
    // 2,2,4 → 4,4 (nicht 2,8)
    expect(reiheSchieben([1, 1, 2, null]).reihe).toEqual([2, 2, null, null]);
  });

  it('lässt ungleiche Kacheln in Ruhe', () => {
    const e = reiheSchieben([1, 2, 3, 4]);
    expect(e.reihe).toEqual([1, 2, 3, 4]);
    expect(e.punkte).toBe(0);
  });

  it('sagt für jedes Ergebnisfeld, aus welchem Feld die Kachel kommt', () => {
    const e = reiheSchieben([null, 1, null, 2]);
    expect(e.reihe).toEqual([1, 2, null, null]);
    expect(e.herkunft).toEqual([1, 3, -1, -1]);
    expect(e.verschmolzen).toEqual([false, false, false, false]);
  });

  it('nennt beim Verschmelzen die hintere Kachel — die legt den Weg zurück', () => {
    // Ohne diese Wahl liefe in der Anzeige die vordere Kachel los und die
    // hintere verschwände an Ort und Stelle: genau andersherum als gedacht.
    const e = reiheSchieben([1, null, null, 1]);
    expect(e.herkunft[0]).toBe(3);
    expect(e.verschmolzen[0]).toBe(true);
  });
});

describe('schieben', () => {
  it('schiebt nach links', () => {
    const e = schieben(r([0, 0, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'links');
    expect(e.raster[0]).toEqual([2, null, null, null]);
    expect(e.bewegt).toBe(true);
  });

  it('schiebt nach rechts', () => {
    const e = schieben(r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'rechts');
    expect(e.raster[0]).toEqual([null, null, null, 2]);
  });

  it('schiebt nach oben', () => {
    const e = schieben(r([0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]), 'hoch');
    expect(e.raster.map((z) => z[0])).toEqual([2, null, null, null]);
  });

  it('schiebt nach unten', () => {
    const e = schieben(r([1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'runter');
    expect(e.raster.map((z) => z[0])).toEqual([null, null, null, 2]);
  });

  it('meldet bewegt=false, wenn sich nichts ändert', () => {
    const raster = r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]);
    const e = schieben(raster, 'links');
    expect(e.bewegt).toBe(false);
    expect(e.punkte).toBe(0);
  });

  it('lässt das übergebene Raster unverändert', () => {
    const raster = r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    const vorher = JSON.stringify(raster);
    schieben(raster, 'links');
    expect(JSON.stringify(raster)).toBe(vorher);
  });

  it('behandelt alle vier Richtungen gleich stark (gedrehtes Raster, gleiches Ergebnis)', () => {
    // Eine Reihe mit vier gleichen ergibt in jeder Richtung zwei Paare.
    for (const richtung of ['links', 'rechts', 'hoch', 'runter'] as const) {
      const e = schieben(r([1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), richtung);
      const werte = e.raster.flat().filter((f) => f !== null);
      if (richtung === 'links' || richtung === 'rechts') {
        expect(werte).toEqual([2, 2]);
      } else {
        // Senkrecht steht jede der vier Kacheln in einer eigenen Spalte,
        // es gibt also nichts zu verschmelzen.
        expect(werte).toEqual([1, 1, 1, 1]);
      }
    }
  });
});

/**
 * Das Zugbild ist die heikelste Stelle im ganzen Spiel: Die Herkunft wird in
 * einem zweiten Raster durch dieselben Drehungen mitgeführt wie die Kacheln.
 * Ein Vertauscher fällt beim Spielen kaum auf — die Kachel landet ja richtig,
 * sie kommt nur aus der falschen Ecke angerutscht. Genau derselbe Fehler
 * steckte schon einmal in `DREHUNGEN` und wurde erst von den Tests gefunden.
 */
describe('schieben — woher jede Kachel kommt', () => {
  it('nach links: die verschmolzene kommt von rechts', () => {
    const e = schieben(r([1, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'links');
    expect(e.bild[0]![0]).toEqual({ vonX: 3, vonY: 0, verschmolzen: true, neu: false });
  });

  it('nach rechts: die verschmolzene kommt von links', () => {
    const e = schieben(r([1, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'rechts');
    expect(e.bild[0]![3]).toEqual({ vonX: 0, vonY: 0, verschmolzen: true, neu: false });
  });

  it('nach oben: die verschmolzene kommt von unten', () => {
    const e = schieben(r([0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]), 'hoch');
    expect(e.bild[0]![0]).toEqual({ vonX: 0, vonY: 3, verschmolzen: true, neu: false });
  });

  it('nach unten: die verschmolzene kommt von oben', () => {
    const e = schieben(r([1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'runter');
    expect(e.bild[3]![0]).toEqual({ vonX: 0, vonY: 0, verschmolzen: true, neu: false });
  });

  it('meldet ein bloßes Nachrücken als nicht verschmolzen', () => {
    const e = schieben(r([0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), 'links');
    expect(e.bild[0]![0]).toEqual({ vonX: 3, vonY: 0, verschmolzen: false, neu: false });
  });

  it('hat genau dort ein Bild, wo auch eine Kachel liegt', () => {
    for (const richtung of ['links', 'rechts', 'hoch', 'runter'] as const) {
      const e = schieben(r([0, 1, 0, 2], [3, 0, 3, 0], [0, 0, 1, 1], [4, 0, 0, 4]), richtung);
      e.raster.forEach((reihe, y) =>
        reihe.forEach((f, x) => {
          expect(e.bild[y]![x] === null).toBe(f === null);
        }),
      );
    }
  });

  it('lässt jede Kachel von einem Feld kommen, auf dem vorher wirklich etwas lag', () => {
    // Sonst rutscht in der Anzeige eine Kachel aus einem leeren Feld heran.
    const vorher = r([0, 1, 0, 2], [3, 0, 3, 0], [0, 0, 1, 1], [4, 0, 0, 4]);
    for (const richtung of ['links', 'rechts', 'hoch', 'runter'] as const) {
      const e = schieben(vorher, richtung);
      e.bild.forEach((reihe) =>
        reihe.forEach((b) => {
          if (b) expect(vorher[b.vonY]![b.vonX]).not.toBeNull();
        }),
      );
    }
  });
});

describe('kachelSetzen', () => {
  it('legt genau eine Kachel auf ein freies Feld', () => {
    const e = kachelSetzen(leeresRaster(), 3);
    expect(e.raster.flat().filter((f) => f !== null)).toHaveLength(1);
  });

  it('legt nur Stufe 1 oder 2', () => {
    for (let saat = 0; saat < 40; saat++) {
      const e = kachelSetzen(leeresRaster(), saat);
      const neue = e.raster.flat().find((f) => f !== null);
      expect([1, 2]).toContain(neue);
    }
  });

  it('überschreibt keine belegte Kachel', () => {
    const fast = leeresRaster();
    for (let y = 0; y < GROESSE; y++) {
      for (let x = 0; x < GROESSE; x++) {
        if (!(x === 2 && y === 3)) fast[y]![x] = 5;
      }
    }
    const e = kachelSetzen(fast, 9);
    expect(e.raster[3]![2]).not.toBeNull();
    expect(e.raster.flat().filter((f) => f === 5)).toHaveLength(GROESSE * GROESSE - 1);
  });

  it('lässt ein volles Raster unverändert', () => {
    const voll = leeresRaster().map((z) => z.map(() => 4));
    const e = kachelSetzen(voll, 1);
    expect(e.raster).toEqual(voll);
  });
});

describe('zugMoeglich', () => {
  it('ist true, solange ein Feld frei ist', () => {
    expect(zugMoeglich(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 0]))).toBe(true);
  });

  it('ist true bei gleichen Nachbarn, auch wenn alles voll ist', () => {
    expect(zugMoeglich(r([1, 1, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]))).toBe(true);
  });

  it('ist false, wenn voll und keine zwei Nachbarn gleich sind', () => {
    expect(zugMoeglich(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]))).toBe(false);
  });
});

describe('neuesSpiel', () => {
  it('startet mit genau zwei Kacheln', () => {
    const z = neuesSpiel(5);
    expect(z.raster.flat().filter((f) => f !== null)).toHaveLength(2);
    expect(z.punkte).toBe(0);
    expect(z.vorbei).toBe(false);
  });

  it('gleiche Saat ergibt denselben Anfang', () => {
    expect(neuesSpiel(42)).toEqual(neuesSpiel(42));
  });
});

describe('ziehen', () => {
  it('legt nach einem gültigen Zug eine neue Kachel dazu', () => {
    const z = stand(r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
    const nach = ziehen(z, 'links');
    // Aus zwei Kacheln wird eine verschmolzene plus eine neue.
    expect(nach.raster.flat().filter((f) => f !== null)).toHaveLength(2);
    expect(nach.punkte).toBe(wertVonStufe(2));
  });

  it('ändert nichts bei einem Zug, der nichts bewegt', () => {
    const z = stand(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]));
    expect(ziehen(z, 'links')).toBe(z);
  });

  it('merkt sich die höchste Stufe', () => {
    const z = stand(r([3, 3, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
    expect(ziehen(z, 'links').hoechsteStufe).toBeGreaterThanOrEqual(4);
  });

  it('setzt gewonnen, sobald die Zielstufe erreicht ist', () => {
    const z = stand(
      r([ZIEL_STUFE - 1, ZIEL_STUFE - 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    const nach = ziehen(z, 'links');
    expect(nach.gewonnen).toBe(true);
    // Weiterspielen bleibt erlaubt.
    expect(nach.vorbei).toBe(false);
  });

  it('meldet vorbei genau dann, wenn danach wirklich kein Zug mehr geht', () => {
    // Fast volles Schachbrett mit einem freien Feld. Ob es danach weitergeht,
    // hängt davon ab, welche Kachel nachrückt — beides ist richtig, solange
    // `vorbei` dazu passt. Über mehrere Saaten kommen beide Fälle vor.
    for (let saat = 0; saat < 25; saat++) {
      const z = stand(r([1, 2, 1, 2], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 0]), { saat });
      const nach = ziehen(z, 'rechts');
      expect(nach.vorbei).toBe(!zugMoeglich(nach.raster));
    }
  });

  it('ändert nichts mehr, wenn die Runde vorbei ist', () => {
    const z = stand(leeresRaster(), { vorbei: true });
    expect(ziehen(z, 'links')).toBe(z);
  });

  it('zählt die Zugnummer nur bei einem Zug hoch, der wirklich etwas bewegt', () => {
    // Die Anzeige startet ihre Bewegung an dieser Nummer. Liefe sie bei einem
    // wirkungslosen Wisch mit, zuckte das Brett ohne Grund; bliebe sie bei
    // zwei gleichen Zügen stehen, liefe die zweite Bewegung gar nicht erst an.
    const beweglich = stand(r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
    expect(ziehen(beweglich, 'links').zug).toBe(1);

    const fest = stand(r([1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]));
    expect(ziehen(fest, 'links').zug).toBe(0);
  });

  it('markiert genau die dazugelegte Kachel als neu', () => {
    // Nur sie ploppt in der Anzeige auf; alle anderen rutschen.
    for (let saat = 0; saat < 20; saat++) {
      const z = stand(r([1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), { saat });
      const nach = ziehen(z, 'links');
      const neue = nach.bild!.flat().filter((b) => b?.neu);
      expect(neue).toHaveLength(1);
      // Die neue Kachel kommt von nirgendwo her: Sie zeigt auf ihr eigenes Feld.
      nach.bild!.forEach((reihe, y) =>
        reihe.forEach((b, x) => {
          if (b?.neu) {
            expect(b.vonX).toBe(x);
            expect(b.vonY).toBe(y);
          }
        }),
      );
    }
  });

  it('hat nach dem Zug für jede Kachel ein Bild und für jedes leere Feld keines', () => {
    for (let saat = 0; saat < 20; saat++) {
      const z = stand(r([0, 1, 0, 2], [3, 0, 3, 0], [0, 0, 1, 1], [4, 0, 0, 4]), { saat });
      const nach = ziehen(z, 'links');
      nach.raster.forEach((reihe, y) =>
        reihe.forEach((f, x) => {
          expect(nach.bild![y]![x] === null).toBe(f === null);
        }),
      );
    }
  });
});
