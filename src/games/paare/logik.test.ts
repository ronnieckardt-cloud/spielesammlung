import { describe, it, expect } from 'vitest';
import {
  DECKEL_LEVEL,
  MOTIV_ANZAHL,
  aufdecken,
  gefundenePaare,
  neuesSpiel,
  punkteFuerZuege,
  schliessen,
  stufeFuerLevel,
  zugGrenzeFuerLevel,
} from './logik';
import type { Zustand } from './logik';

/** Die Position der zweiten Karte mit demselben Motiv wie `a`. */
function partnerVon(z: Zustand, a: number): number {
  const gesucht = z.karten[a]!.motiv;
  const partner = z.karten.findIndex((k, i) => i !== a && k.motiv === gesucht);
  expect(partner).toBeGreaterThanOrEqual(0);
  return partner;
}

/** Irgendeine noch liegende Karte mit einem anderen Motiv als `a`. */
function fremdeKarteZu(z: Zustand, a: number): number {
  // `gefunden` muss mitgeprüft werden: Eine längst gefundene Karte lässt
  // sich nicht mehr antippen, der „Fehlgriff" käme also gar nicht zustande.
  const fremd = z.karten.findIndex(
    (k, i) => i !== a && !k.gefunden && k.motiv !== z.karten[a]!.motiv,
  );
  expect(fremd).toBeGreaterThanOrEqual(0);
  return fremd;
}

/** Spielt eine Runde mit vollständigem Wissen durch — jedes Paar auf Anhieb. */
function perfektDurchspielen(start: Zustand): Zustand {
  let z = start;
  for (let i = 0; i < z.karten.length; i++) {
    if (z.karten[i]!.gefunden) continue;
    z = aufdecken(z, i);
    z = aufdecken(z, partnerVon(z, i));
  }
  return z;
}

/**
 * Spielt eine Runde ohne jedes Gedächtnis: Jeder Zug ist ein Fehlgriff.
 * Endet, sobald die Runde vorbei ist — oder bricht ab, damit ein Fehler in
 * der Abbruchbedingung nicht zu einer Endlosschleife wird.
 */
function nurDanebenGreifen(start: Zustand, hoechstensZuege = 500): Zustand {
  let z = start;
  while (!z.vorbei && z.zuege < hoechstensZuege) {
    const erste = z.karten.findIndex((k) => !k.gefunden);
    const zweite = z.karten.findIndex(
      (k, i) => i !== erste && !k.gefunden && k.motiv !== z.karten[erste]!.motiv,
    );
    // Liegt nur noch ein Paar, kann man gar nicht mehr danebengreifen.
    if (zweite < 0) break;
    z = aufdecken(z, erste);
    z = aufdecken(z, zweite);
    z = schliessen(z);
  }
  return z;
}

describe('stufeFuerLevel', () => {
  it('hat immer eine gerade Kartenzahl — sonst bliebe eine Karte übrig', () => {
    for (let level = 1; level <= 40; level++) {
      const { spalten, zeilen } = stufeFuerLevel(level);
      expect((spalten * zeilen) % 2).toBe(0);
    }
  });

  it('wird nie kleiner und ist gedeckelt', () => {
    let vorher = 0;
    let groesste = 0;
    for (let level = 1; level <= 40; level++) {
      const { spalten, zeilen } = stufeFuerLevel(level);
      const karten = spalten * zeilen;
      expect(karten).toBeGreaterThanOrEqual(vorher);
      vorher = karten;
      groesste = Math.max(groesste, karten);
    }
    expect(groesste).toBe(30); // 6 × 5, siehe STUFEN
  });

  it('braucht nie mehr Paare, als es Motive gibt', () => {
    for (let level = 1; level <= 40; level++) {
      const { spalten, zeilen } = stufeFuerLevel(level);
      expect((spalten * zeilen) / 2).toBeLessThanOrEqual(MOTIV_ANZAHL);
    }
  });
});

describe('zugGrenzeFuerLevel', () => {
  it('lässt die Level bis zur Deckelstufe ohne Grenze', () => {
    for (let level = 1; level < DECKEL_LEVEL; level++) {
      expect(zugGrenzeFuerLevel(level)).toBeNull();
    }
    expect(zugGrenzeFuerLevel(DECKEL_LEVEL)).not.toBeNull();
  });

  it('wird nie großzügiger, je höher das Level', () => {
    // Der eigentliche Befund: Ab der Deckelstufe wuchs das Feld nicht mehr,
    // und damit war jedes weitere Level exakt gleich schwer.
    let vorher = Number.POSITIVE_INFINITY;
    for (let level = DECKEL_LEVEL; level <= 40; level++) {
      const grenze = zugGrenzeFuerLevel(level)!;
      expect(grenze).toBeLessThanOrEqual(vorher);
      vorher = grenze;
    }
    expect(zugGrenzeFuerLevel(40)!).toBeLessThan(zugGrenzeFuerLevel(DECKEL_LEVEL)!);
  });

  it('bleibt auch ganz oben schaffbar', () => {
    for (let level = DECKEL_LEVEL; level <= 200; level++) {
      const { spalten, zeilen } = stufeFuerLevel(level);
      const paare = (spalten * zeilen) / 2;
      // Selbst mit lückenlosem Gedächtnis braucht man rund 1,6 Züge je Paar,
      // weil die erste Karte jedes unbekannten Motivs blind gezogen wird.
      expect(zugGrenzeFuerLevel(level)!).toBeGreaterThanOrEqual(paare * 2);
    }
  });
});

describe('neuesSpiel', () => {
  it('legt jedes vorkommende Motiv genau zweimal aus', () => {
    for (const level of [1, 3, 7, 12, 25]) {
      const z = neuesSpiel(level);
      const zaehler = new Map<number, number>();
      for (const k of z.karten) zaehler.set(k.motiv, (zaehler.get(k.motiv) ?? 0) + 1);
      for (const anzahl of zaehler.values()) expect(anzahl).toBe(2);
      expect(zaehler.size).toBe(z.karten.length / 2);
    }
  });

  it('ergibt bei gleicher Levelnummer dasselbe Feld', () => {
    const a = neuesSpiel(9);
    const b = neuesSpiel(9);
    expect(a.karten).toEqual(b.karten);
  });

  it('ergibt bei verschiedenen Levelnummern verschiedene Felder', () => {
    // Gleiche Feldgröße (Level 5 und 6 liegen auf derselben Stufe), damit
    // wirklich die Mischung verglichen wird und nicht die Größe.
    const a = neuesSpiel(5);
    const b = neuesSpiel(6);
    expect(a.karten.length).toBe(b.karten.length);
    expect(a.karten).not.toEqual(b.karten);
  });

  it('startet verdeckt und ohne Züge', () => {
    const z = neuesSpiel(1);
    expect(z.offen).toEqual([]);
    expect(z.fehlgriff).toBe(false);
    expect(z.zuege).toBe(0);
    expect(z.vorbei).toBe(false);
    expect(z.karten.every((k) => !k.gefunden)).toBe(true);
  });
});

describe('aufdecken', () => {
  it('deckt die erste Karte auf, ohne einen Zug zu zählen', () => {
    const z = aufdecken(neuesSpiel(1), 0);
    expect(z.offen).toEqual([0]);
    expect(z.zuege).toBe(0);
  });

  it('lässt ein Paar liegen und zählt einen Zug', () => {
    let z = neuesSpiel(1);
    z = aufdecken(z, 0);
    z = aufdecken(z, partnerVon(z, 0));
    expect(z.zuege).toBe(1);
    expect(z.fehlgriff).toBe(false);
    expect(gefundenePaare(z)).toBe(1);
    // Gefundene Karten brauchen `offen` nicht mehr — sie bleiben ohnehin sichtbar.
    expect(z.offen).toEqual([]);
  });

  it('merkt einen Fehlgriff vor, statt sofort zuzudecken', () => {
    let z = neuesSpiel(1);
    const fremd = fremdeKarteZu(z, 0);
    z = aufdecken(z, 0);
    z = aufdecken(z, fremd);
    expect(z.zuege).toBe(1);
    expect(z.fehlgriff).toBe(true);
    expect(z.offen).toEqual([0, fremd]);
    expect(gefundenePaare(z)).toBe(0);
  });

  it('ignoriert weitere Tipps, solange zwei Karten offen liegen', () => {
    let z = neuesSpiel(1);
    z = aufdecken(z, 0);
    z = aufdecken(z, fremdeKarteZu(z, 0));
    // Ohne diese Sperre könnte man sich durch schnelles Tippen das ganze
    // Feld ansehen, ohne einen einzigen Zug zu verbrauchen.
    const nach = aufdecken(z, 5);
    expect(nach).toBe(z);
  });

  it('ignoriert dieselbe Karte zweimal und schon gefundene Karten', () => {
    let z = neuesSpiel(1);
    z = aufdecken(z, 0);
    expect(aufdecken(z, 0)).toBe(z);

    z = aufdecken(z, partnerVon(z, 0));
    expect(aufdecken(z, 0)).toBe(z);
  });

  it('ignoriert Positionen außerhalb des Feldes', () => {
    const z = neuesSpiel(1);
    expect(aufdecken(z, -1)).toBe(z);
    expect(aufdecken(z, z.karten.length)).toBe(z);
  });
});

describe('schliessen', () => {
  it('deckt nach einem Fehlgriff wieder zu', () => {
    let z = neuesSpiel(1);
    z = aufdecken(z, 0);
    z = aufdecken(z, fremdeKarteZu(z, 0));
    z = schliessen(z);
    expect(z.offen).toEqual([]);
    expect(z.fehlgriff).toBe(false);
    // Der Zug bleibt gezählt — der Fehlgriff wird nicht erlassen.
    expect(z.zuege).toBe(1);
  });

  it('lässt einen unveränderten Zustand unverändert', () => {
    const z = neuesSpiel(1);
    expect(schliessen(z)).toBe(z);
  });
});

describe('Rundenende und Punkte', () => {
  it('endet, wenn alle Paare liegen', () => {
    const z = perfektDurchspielen(neuesSpiel(1));
    expect(z.vorbei).toBe(true);
    expect(gefundenePaare(z)).toBe(z.karten.length / 2);
  });

  it('nimmt nach dem Ende keine Tipps mehr an', () => {
    const z = perfektDurchspielen(neuesSpiel(1));
    expect(aufdecken(z, 0)).toBe(z);
  });

  it('gibt bei fehlerfreiem Spiel die volle Punktzahl', () => {
    const z = perfektDurchspielen(neuesSpiel(3));
    const paare = z.karten.length / 2;
    expect(z.zuege).toBe(paare);
    expect(z.punkte).toBe(paare * 100);
  });

  it('zieht für jeden Zug zu viel ab, aber nie unter den Sockel', () => {
    expect(punkteFuerZuege(6, 6)).toBe(600);
    expect(punkteFuerZuege(6, 7)).toBe(588);
    expect(punkteFuerZuege(6, 10)).toBe(552);
    // Sockel: 6 × 20 = 120, auch bei sehr vielen Zügen.
    expect(punkteFuerZuege(6, 500)).toBe(120);
  });

  it('belohnt ein größeres Feld stärker als ein kleines', () => {
    // Sonst lohnte es sich, immer nur Level 1 zu spielen.
    expect(punkteFuerZuege(15, 15)).toBeGreaterThan(punkteFuerZuege(3, 3));
  });
});

describe('Punktestand während der Runde', () => {
  it('steigt bei jedem Treffer und sinkt bei jedem Fehlgriff', () => {
    // Vorher stand die ganze Runde über eine 0 in der Kopfzeile, und erst
    // das letzte Paar ließ sie auf den Endwert springen.
    let z = neuesSpiel(5);
    expect(z.punkte).toBe(0);

    z = aufdecken(z, 0);
    z = aufdecken(z, partnerVon(z, 0));
    expect(z.punkte).toBe(100);

    const naechste = z.karten.findIndex((k) => !k.gefunden);
    z = aufdecken(z, naechste);
    z = aufdecken(z, fremdeKarteZu(z, naechste));
    expect(z.punkte).toBe(88);
    z = schliessen(z);

    z = aufdecken(z, naechste);
    z = aufdecken(z, partnerVon(z, naechste));
    expect(z.punkte).toBe(188);
  });

  it('endet auf demselben Wert wie die Schlussrechnung', () => {
    for (const level of [1, 4, 9]) {
      const z = perfektDurchspielen(neuesSpiel(level));
      expect(z.punkte).toBe(punkteFuerZuege(z.karten.length / 2, z.zuege));
    }
  });
});

describe('Zuggrenze', () => {
  it('beendet die Runde als Niederlage, wenn die Züge alle sind', () => {
    const start = neuesSpiel(DECKEL_LEVEL);
    const grenze = start.zugGrenze!;
    const z = nurDanebenGreifen(start);
    expect(z.zuege).toBe(grenze);
    expect(z.vorbei).toBe(true);
    expect(z.gewonnen).toBe(false);
    expect(gefundenePaare(z)).toBe(0);
  });

  it('zählt einen Sieg mit dem allerletzten erlaubten Zug als Sieg', () => {
    const paare = neuesSpiel(DECKEL_LEVEL).karten.length / 2;
    // Genau so viele Züge erlaubt, wie perfektes Spiel braucht.
    const z = perfektDurchspielen({ ...neuesSpiel(DECKEL_LEVEL), zugGrenze: paare });
    expect(z.zuege).toBe(paare);
    expect(z.vorbei).toBe(true);
    expect(z.gewonnen).toBe(true);
  });

  it('lässt die frühen Level unbegrenzt weiterspielen', () => {
    const z = nurDanebenGreifen(neuesSpiel(1), 80);
    // Ohne Grenze läuft die Runde bis zum Anschlag der Testschleife weiter.
    expect(z.zugGrenze).toBeNull();
    expect(z.vorbei).toBe(false);
    expect(z.zuege).toBe(80);
  });
});
