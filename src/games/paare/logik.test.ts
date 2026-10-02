import { describe, it, expect } from 'vitest';
import {
  BLICK_ALLE_SERIE,
  BLICK_KOSTEN,
  DECKEL_LEVEL,
  MAX_BLICK,
  MOTIV_ANZAHL,
  START_BLICK,
  WIRBEL_AB_LEVEL,
  aufdecken,
  blickEnde,
  blickMoeglich,
  blickNutzen,
  fehlerBisWirbel,
  gefundenePaare,
  karteInZeile,
  neuesSpiel,
  punkteFuerZuege,
  schliessen,
  serieBonus,
  stufeFuerLevel,
  wirbelAlle,
  zeileBlickbar,
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
    // Die 100 je Paar plus die Zuschläge der Serie, die ein fehlerfreies Spiel von selbst aufbaut.
    expect(z.punkte).toBe(paare * 100 + z.bonus);
    expect(z.bonus).toBeGreaterThan(0);
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
      expect(z.punkte).toBe(punkteFuerZuege(z.karten.length / 2, z.zuege) + z.bonus);
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

/* ====== Serie, Blick, Wirbel ================================================================ */

/** Deckt `a` und eine fremde Karte auf (ein Fehlgriff), deckt dann zu. Gibt Zustand nach dem Zudecken zurück. */
function fehlgriffMachen(z: Zustand): Zustand {
  const a = z.karten.findIndex((k) => !k.gefunden);
  const b = fremdeKarteZu(z, a);
  return schliessen(aufdecken(aufdecken(z, a), b));
}

/** Findet ein Paar (zwei Positionen) unter den noch verdeckten Karten. */
function paarFinden(z: Zustand): [number, number] {
  const a = z.karten.findIndex((k) => !k.gefunden);
  return [a, partnerVon(z, a)];
}

function treffer(z: Zustand): Zustand {
  const [a, b] = paarFinden(z);
  return aufdecken(aufdecken(z, a), b);
}

describe('Serie', () => {
  it('serieBonus: 0, 0, 15, 30, danach 45', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(serieBonus)).toEqual([0, 0, 15, 30, 45, 45, 45]);
  });

  it('jedes Paar in Folge bringt mehr — ein Fehlgriff reißt die Serie ab', () => {
    let z = neuesSpiel(5);
    z = treffer(z);
    expect(z.serie).toBe(1);
    expect(z.bonus).toBe(0);
    z = treffer(z);
    expect(z.serie).toBe(2);
    expect(z.bonus).toBe(15);
    z = fehlgriffMachen(z);
    expect(z.serie).toBe(0);
    expect(z.bonus).toBe(15); // Der bisherige Zuschlag bleibt, nur die Serie ist weg.
    z = treffer(z);
    expect(z.serie).toBe(1);
    expect(z.bonus).toBe(15);
  });

  it('die Punkte enthalten die Zuschläge schon während der Runde', () => {
    let z = neuesSpiel(5);
    z = treffer(z);
    z = treffer(z);
    expect(z.punkte).toBe(punkteFuerZuege(2, 2) + 15);
  });

  it('ein fehlerfreies Spiel baut den vollen Zuschlag auf', () => {
    const z = perfektDurchspielen(neuesSpiel(7)); // acht Paare
    // 0 + 15 + 30 + 45 · 5
    expect(z.bonus).toBe(15 + 30 + 45 * 5);
  });
});

describe('Blick', () => {
  it('ab Level 3 liegt einer im Vorrat, darunter keiner', () => {
    expect(neuesSpiel(2).blick).toBe(0);
    expect(neuesSpiel(3).blick).toBe(START_BLICK);
  });

  it('jede dritte Serie schenkt einen — nie über den Vorrat hinaus', () => {
    let z = neuesSpiel(7);
    z = { ...z, blick: 0 };
    z = treffer(z);
    z = treffer(z);
    expect(z.blick).toBe(0);
    z = treffer(z);
    expect(z.serie).toBe(BLICK_ALLE_SERIE);
    expect(z.blick).toBe(1);
    // Mit vollem Vorrat bleibt es dabei.
    const voll = { ...neuesSpiel(7), blick: MAX_BLICK, serie: 2 };
    expect(treffer(voll).blick).toBe(MAX_BLICK);
    // Unter Level 3 gibt es keinen, auch nicht durch eine Serie.
    let klein = neuesSpiel(1);
    klein = { ...klein, serie: 2 };
    expect(treffer(klein).blick).toBe(0);
  });

  it('kostet einen Blick aus dem Vorrat und Punkte, ändert aber die Serie nicht', () => {
    let z = neuesSpiel(7);
    z = treffer(z);
    const vorher = z.punkte;
    const mit = blickNutzen(z, 0);
    expect(mit.blickZeile).toBe(0);
    expect(mit.blick).toBe(z.blick - 1);
    expect(mit.blicke).toBe(1);
    expect(mit.punkte).toBe(vorher - BLICK_KOSTEN);
    expect(mit.serie).toBe(z.serie);
    expect(mit.zuege).toBe(z.zuege); // kein Zug
  });

  it('solange er läuft, nimmt das Feld keine Karte an', () => {
    const z = blickNutzen(neuesSpiel(7), 0);
    expect(aufdecken(z, 5)).toBe(z);
    const danach = blickEnde(z);
    expect(danach.blickZeile).toBeNull();
    expect(aufdecken(danach, 5)).not.toBe(danach);
    expect(blickEnde(danach)).toBe(danach);
  });

  it('geht nicht ohne Vorrat, mit offenen Karten, nach dem Ende oder bei einem letzten Paar', () => {
    const ohne = { ...neuesSpiel(7), blick: 0 };
    expect(blickMoeglich(ohne)).toBe(false);
    expect(blickNutzen(ohne, 0)).toBe(ohne);

    const eine = aufdecken(neuesSpiel(7), 0);
    expect(blickMoeglich(eine)).toBe(false);

    let nachFehl = neuesSpiel(7);
    const a = 0;
    nachFehl = aufdecken(aufdecken(nachFehl, a), fremdeKarteZu(nachFehl, a));
    expect(nachFehl.fehlgriff).toBe(true);
    expect(blickMoeglich(nachFehl)).toBe(false);

    expect(blickMoeglich({ ...neuesSpiel(7), vorbei: true })).toBe(false);

    // Bei drei Paaren (Level 1) gibt es keinen; bei vier (Level 3), wenn nur noch ein Paar liegt, auch nicht.
    let z = neuesSpiel(3);
    z = treffer(z);
    z = treffer(z);
    z = treffer(z);
    expect(z.karten.length / 2 - gefundenePaare(z)).toBe(1);
    expect(blickMoeglich(z)).toBe(false);
  });

  it('eine Zeile ohne mindestens zwei verdeckte Karten lohnt nicht und wird abgelehnt', () => {
    const z = neuesSpiel(7);
    const alleGefunden = {
      ...z,
      karten: z.karten.map((k, i) => (i < z.spalten ? { ...k, gefunden: true } : k)),
    };
    expect(zeileBlickbar(alleGefunden, 0)).toBe(false);
    expect(blickNutzen(alleGefunden, 0)).toBe(alleGefunden);
    expect(zeileBlickbar(alleGefunden, 1)).toBe(true);
  });

  it('karteInZeile liefert genau eine Zeile', () => {
    const z = neuesSpiel(7); // 4 Spalten
    expect(karteInZeile(z, 0)).toEqual([0, 1, 2, 3]);
    expect(karteInZeile(z, 3)).toEqual([12, 13, 14, 15]);
  });

  it('die Punkte fallen nie unter den Sockel, auch mit Blicken', () => {
    expect(punkteFuerZuege(6, 500, 4)).toBe(120);
    expect(punkteFuerZuege(6, 6, 2)).toBe(600 - 2 * BLICK_KOSTEN);
  });
});

describe('Wirbel', () => {
  it('gibt es erst ab Level 9, danach alle sechs, ab Level 13 alle fünf Fehlgriffe', () => {
    for (let level = 1; level < WIRBEL_AB_LEVEL; level++) expect(wirbelAlle(level)).toBeNull();
    expect(wirbelAlle(9)).toBe(6);
    expect(wirbelAlle(12)).toBe(6);
    expect(wirbelAlle(13)).toBe(5);
    expect(wirbelAlle(40)).toBe(5);
    // Darunter wird nie gewirbelt, auch nicht nach vielen Fehlgriffen.
    let z = neuesSpiel(8);
    for (let i = 0; i < 12; i++) z = fehlgriffMachen(z);
    expect(z.wirbel).toBe(0);
  });

  it('der n-te Fehlgriff mischt beim Zudecken alle verdeckten Karten — und nur die', () => {
    const alle = wirbelAlle(9)!;
    let z = neuesSpiel(9);
    // Erst ein Treffer, damit es eine gefundene Karte gibt, die liegen bleiben muss.
    z = treffer(z);
    const gefundenVorher = z.karten.map((k, i) => (k.gefunden ? i : -1)).filter((i) => i >= 0);
    const motiveVorher = z.karten.map((k) => k.motiv);

    for (let i = 0; i < alle - 1; i++) {
      z = fehlgriffMachen(z);
      expect(z.wirbel).toBe(0);
    }
    expect(fehlerBisWirbel(z)).toBe(1);
    // Der entscheidende Fehlgriff: Vor dem Zudecken ist der Wirbel nur fällig …
    const a = z.karten.findIndex((k) => !k.gefunden);
    z = aufdecken(aufdecken(z, a), fremdeKarteZu(z, a));
    expect(z.wirbelFaellig).toBe(true);
    const unterVorher = z.karten.map((k) => k.motiv);
    // … und erst das Zudecken mischt.
    z = schliessen(z);
    expect(z.wirbel).toBe(1);
    expect(z.wirbelFaellig).toBe(false);
    expect(fehlerBisWirbel(z)).toBe(alle);

    const nachher = z.karten.map((k) => k.motiv);
    // Gefundene Paare liegen, wo sie lagen.
    for (const i of gefundenVorher) expect(nachher[i]).toBe(motiveVorher[i]);
    // Die verdeckten tauschen untereinander: dieselben Motive, mindestens eins woanders.
    const verdeckt = z.karten.map((k, i) => (k.gefunden ? -1 : i)).filter((i) => i >= 0);
    expect(verdeckt.map((i) => nachher[i]!).sort()).toEqual(verdeckt.map((i) => unterVorher[i]!).sort());
    expect(verdeckt.some((i) => nachher[i] !== unterVorher[i])).toBe(true);
  });

  it('ist aus der Saat bestimmt — und der zweite Wirbel mischt anders als der erste', () => {
    const lauf = () => {
      let z = neuesSpiel(10);
      const reihenfolgen: (readonly number[])[] = [];
      for (let w = 0; w < 2; w++) {
        for (let i = 0; i < wirbelAlle(10)!; i++) z = fehlgriffMachen(z);
        reihenfolgen.push(z.karten.map((k) => k.motiv));
      }
      return reihenfolgen;
    };
    expect(lauf()).toEqual(lauf());
    const [erste, zweite] = lauf();
    expect(erste).not.toEqual(zweite);
  });

  it('bei höchstens zwei verdeckten Karten gibt es nichts zu mischen', () => {
    const z = neuesSpiel(9);
    // Alles bis auf ein Paar gefunden.
    const [a, b] = paarFinden(z);
    const fast = { ...z, karten: z.karten.map((k, i) => (i === a || i === b ? k : { ...k, gefunden: true })) };
    const offen = { ...fast, offen: [a, b], fehlgriff: true, wirbelFaellig: true };
    const nachher = schliessen(offen);
    expect(nachher.karten).toEqual(offen.karten);
  });

  it('die Fehlgriffzahl läuft nach dem Wirbel von vorn', () => {
    let z = neuesSpiel(9);
    for (let i = 0; i < wirbelAlle(9)!; i++) z = fehlgriffMachen(z);
    expect(z.wirbel).toBe(1);
    expect(z.fehlerSeitWirbel).toBe(0);
    expect(fehlerBisWirbel(z)).toBe(wirbelAlle(9));
    expect(fehlerBisWirbel(neuesSpiel(2))).toBeNull();
  });
});
