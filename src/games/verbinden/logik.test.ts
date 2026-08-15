import { describe, expect, it } from 'vitest';
import {
  fertig,
  istGeloest,
  neuesLevel,
  punkteFuerZuege,
  punktFarbe,
  wegFarbe,
  ziehenBeenden,
  ziehenNach,
  ziehenStarten,
} from './logik';
import type { Zustand } from './logik';

/** Zieht einen kompletten Lösungsweg für eine Farbe nach. */
function loesungZiehen(z: Zustand, farbe: number): Zustand {
  const weg = z.raetsel.loesung[farbe]!;
  let neu = ziehenStarten(z, weg[0]!);
  for (let i = 1; i < weg.length; i++) neu = ziehenNach(neu, weg[i]!);
  return ziehenBeenden(neu);
}

/** Löst das ganze Rätsel über die mitgelieferte Lösung. */
function allesLoesen(z: Zustand): Zustand {
  let neu = z;
  for (let f = 0; f < z.raetsel.paare.length; f++) neu = loesungZiehen(neu, f);
  return neu;
}

describe('neuesLevel', () => {
  it('fängt leer an', () => {
    const z = neuesLevel(1);
    expect(z.wege.every((w) => w.length === 0)).toBe(true);
    expect(z.zuege).toBe(0);
    expect(z.geloest).toBe(false);
    expect(z.zieht).toBeNull();
  });
});

describe('Felder erkennen', () => {
  it('findet die Farbe eines Punktes', () => {
    const z = neuesLevel(1);
    const paar = z.raetsel.paare[0]!;
    expect(punktFarbe(z, paar.a)).toBe(0);
    expect(punktFarbe(z, paar.b)).toBe(0);
  });

  it('meldet für ein freies Feld keinen Weg', () => {
    const z = neuesLevel(1);
    expect(wegFarbe(z, z.raetsel.loesung[0]![1]!)).toBeNull();
  });
});

describe('Ziehen', () => {
  it('startet nur an einem Punkt', () => {
    const z = neuesLevel(1);
    // Ein Feld mitten im Lösungsweg ist kein Punkt.
    const mitte = z.raetsel.loesung[0]![1]!;
    expect(punktFarbe(z, mitte)).toBeNull();
    expect(ziehenStarten(z, mitte)).toBe(z);
  });

  it('zählt jeden Ansatz als Zug', () => {
    const z = neuesLevel(1);
    const a = ziehenStarten(z, z.raetsel.paare[0]!.a);
    expect(a.zuege).toBe(1);
    expect(ziehenStarten(a, z.raetsel.paare[1]!.a).zuege).toBe(2);
  });

  it('verwirft beim erneuten Ansetzen den alten Weg', () => {
    // Das ist gleichzeitig das Radiergummi.
    let z = loesungZiehen(neuesLevel(1), 0);
    expect(fertig(z, 0)).toBe(true);
    z = ziehenStarten(z, z.raetsel.paare[0]!.a);
    expect(z.wege[0]).toHaveLength(1);
    expect(fertig(z, 0)).toBe(false);
  });

  it('geht nur auf Nachbarfelder', () => {
    const z = neuesLevel(1);
    const gestartet = ziehenStarten(z, z.raetsel.paare[0]!.a);
    // Ein Feld weit weg im Lösungsweg ist kein Nachbar des Starts.
    const weit = z.raetsel.loesung[0]![z.raetsel.loesung[0]!.length - 1]!;
    if (weit !== z.raetsel.loesung[0]![1]) {
      expect(ziehenNach(gestartet, weit)).toBe(gestartet);
    }
  });

  it('geht ohne Ansetzen gar nicht', () => {
    const z = neuesLevel(1);
    expect(ziehenNach(z, z.raetsel.loesung[0]![1]!)).toBe(z);
  });

  it('kürzt den eigenen Weg beim Zurückziehen', () => {
    const z = neuesLevel(1);
    const weg = z.raetsel.loesung[0]!;
    let s = ziehenStarten(z, weg[0]!);
    s = ziehenNach(s, weg[1]!);
    s = ziehenNach(s, weg[2]!);
    expect(s.wege[0]).toHaveLength(3);
    // Zurück auf das vorletzte Feld — der Weg wird wieder kürzer.
    s = ziehenNach(s, weg[1]!);
    expect(s.wege[0]).toHaveLength(2);
  });

  it('läuft nicht auf einen fremden Punkt', () => {
    const z = neuesLevel(1);
    // Ein Paar suchen, dessen Punkt neben dem Start eines anderen liegt.
    for (const paar of z.raetsel.paare) {
      const start = ziehenStarten(z, paar.a);
      for (const anderes of z.raetsel.paare) {
        if (anderes.farbe === paar.farbe) continue;
        for (const ziel of [anderes.a, anderes.b]) {
          const versuch = ziehenNach(start, ziel);
          // Entweder kein Nachbar (unverändert) oder abgelehnt — nie belegt.
          expect(versuch.wege[paar.farbe]).toHaveLength(1);
        }
      }
    }
  });

  it('kappt einen fremden Weg, der im Weg liegt', () => {
    let z = loesungZiehen(neuesLevel(1), 0);
    const langerWeg = z.wege[0]!;
    expect(langerWeg.length).toBeGreaterThan(2);

    // Eine andere Farbe suchen, die von ihrem Punkt aus auf den ersten
    // Weg treffen kann.
    const opfer = langerWeg[1]!;
    for (let f = 1; f < z.raetsel.paare.length; f++) {
      const paar = z.raetsel.paare[f]!;
      for (const start of [paar.a, paar.b]) {
        const s = ziehenNach(ziehenStarten(z, start), opfer);
        if (s.wege[f]!.length === 2) {
          // Getroffen: Der fremde Weg muss jetzt kürzer sein.
          expect(s.wege[0]!.length).toBeLessThan(langerWeg.length);
          expect(s.wege[0]).not.toContain(opfer);
          return;
        }
      }
    }
    // Kein passender Nachbar in diesem Rätsel — dann prüft der Fall unten.
    z = ziehenBeenden(z);
    expect(fertig(z, 0)).toBe(true);
  });
});

describe('Lösung', () => {
  it('erkennt ein vollständig gelöstes Rätsel', () => {
    for (let level = 1; level <= 25; level++) {
      const z = allesLoesen(neuesLevel(level));
      expect(istGeloest(z)).toBe(true);
      expect(z.geloest).toBe(true);
    }
  });

  it('gilt nicht als gelöst, solange ein Feld frei ist', () => {
    const z = neuesLevel(1);
    // Nur die erste Farbe ziehen — der Rest bleibt frei.
    const teilweise = loesungZiehen(z, 0);
    expect(fertig(teilweise, 0)).toBe(true);
    expect(istGeloest(teilweise)).toBe(false);
  });

  it('gilt nicht als gelöst, wenn ein Weg nur bis zur Hälfte geht', () => {
    const start = neuesLevel(2);
    const letzte = start.raetsel.paare.length - 1;
    // Alle Farben bis auf die letzte ganz ziehen …
    let z = start;
    for (let f = 0; f < letzte; f++) z = loesungZiehen(z, f);
    // … und die letzte nur bis zur Mitte.
    const weg = z.raetsel.loesung[letzte]!;
    z = ziehenStarten(z, weg[0]!);
    for (let i = 1; i < weg.length - 1; i++) z = ziehenNach(z, weg[i]!);
    z = ziehenBeenden(z);

    expect(fertig(z, letzte)).toBe(false);
    expect(istGeloest(z)).toBe(false);
  });

  it('lässt ein gelöstes Rätsel in Ruhe', () => {
    // Wer fertig ist, soll sich sein Bild nicht aus Versehen zerstören —
    // die Runde ist an dieser Stelle ohnehin vorbei.
    const z = allesLoesen(neuesLevel(1));
    expect(ziehenStarten(z, z.raetsel.paare[0]!.a)).toBe(z);
  });
});

describe('punkteFuerZuege', () => {
  it('belohnt den Weg ohne Umwege am meisten', () => {
    expect(punkteFuerZuege(1, 3, 3)).toBeGreaterThan(punkteFuerZuege(1, 3, 8));
  });

  it('gibt in höheren Levels mehr', () => {
    expect(punkteFuerZuege(10, 4, 4)).toBeGreaterThan(punkteFuerZuege(1, 4, 4));
  });

  it('fällt nie unter den Mindestwert', () => {
    expect(punkteFuerZuege(1, 3, 500)).toBe(50);
  });
});
