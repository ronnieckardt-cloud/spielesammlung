import { describe, expect, it } from 'vitest';
import { saatAus } from '../../core/rng';
import {
  hamiltonweg,
  massFuerLevel,
  nachbarn,
  raetselErzeugen,
  sindNachbarn,
  zerschneiden,
  zuXY,
  zuZelle,
} from './erzeuger';

describe('Gitter-Rechnerei', () => {
  it('rechnet Zelle und Koordinaten ineinander um', () => {
    expect(zuXY(zuZelle(3, 2, 5), 5)).toEqual({ x: 3, y: 2 });
  });

  it('gibt in der Ecke zwei und in der Mitte vier Nachbarn', () => {
    expect(nachbarn(zuZelle(0, 0, 5), 5, 5)).toHaveLength(2);
    expect(nachbarn(zuZelle(2, 2, 5), 5, 5)).toHaveLength(4);
    expect(nachbarn(zuZelle(4, 4, 5), 5, 5)).toHaveLength(2);
  });

  it('erkennt Nachbarn und Nicht-Nachbarn', () => {
    expect(sindNachbarn(zuZelle(1, 1, 5), zuZelle(1, 2, 5), 5, 5)).toBe(true);
    // Über den Rand hinweg ist **kein** Nachbar, auch wenn die Zahlen
    // benachbart sind: 4 und 5 liegen im 5er-Gitter in verschiedenen Zeilen.
    expect(sindNachbarn(zuZelle(4, 0, 5), zuZelle(0, 1, 5), 5, 5)).toBe(false);
    expect(sindNachbarn(zuZelle(1, 1, 5), zuZelle(2, 2, 5), 5, 5)).toBe(false);
  });
});

describe('hamiltonweg', () => {
  /** Prüft die beiden Eigenschaften, auf denen alles aufbaut. */
  function pruefen(weg: number[], breite: number, hoehe: number) {
    // 1. Jedes Feld genau einmal.
    expect(weg).toHaveLength(breite * hoehe);
    expect(new Set(weg).size).toBe(breite * hoehe);
    // 2. Aufeinanderfolgende Felder sind Nachbarn.
    for (let i = 1; i < weg.length; i++) {
      expect(sindNachbarn(weg[i - 1]!, weg[i]!, breite, hoehe)).toBe(true);
    }
  }

  it('ist auch ohne Mischen ein gültiger Weg', () => {
    pruefen(hamiltonweg(5, 5, saatAus('a'), 0), 5, 5);
  });

  /**
   * Der wichtigste Test des ganzen Spiels: Der Rückbiss darf den Weg
   * **niemals** kaputtmachen. Geht das schief, entstünde ein Rätsel, das
   * gar nicht lösbar ist — und das würde ein Kind sich selbst zuschreiben.
   */
  it('bleibt über tausende Rückbisse hinweg gültig', () => {
    for (const kante of [4, 5, 6, 7]) {
      for (let s = 0; s < 6; s++) {
        const weg = hamiltonweg(kante, kante, saatAus('mischen', kante, s), kante * kante * 20);
        pruefen(weg, kante, kante);
      }
    }
  });

  it('mischt wirklich — der Schlangenweg bleibt nicht stehen', () => {
    const ohne = hamiltonweg(6, 6, saatAus('b'), 0);
    const mit = hamiltonweg(6, 6, saatAus('b'), 500);
    expect(mit).not.toEqual(ohne);
  });

  it('ergibt bei gleicher Saat denselben Weg', () => {
    expect(hamiltonweg(6, 6, saatAus('c'), 400)).toEqual(hamiltonweg(6, 6, saatAus('c'), 400));
  });
});

describe('zerschneiden', () => {
  it('teilt vollständig und ohne Überschneidung auf', () => {
    const weg = hamiltonweg(6, 6, saatAus('d'), 300);
    const stuecke = zerschneiden(weg, 5, saatAus('e'));
    expect(stuecke).toHaveLength(5);
    expect(stuecke.flat()).toEqual(weg);
  });

  it('gibt jedem Stück mindestens zwei Felder', () => {
    // Bei nur einem Feld lägen beide Punkte eines Paares aufeinander.
    for (let s = 0; s < 30; s++) {
      const weg = hamiltonweg(5, 5, saatAus('f', s), 200);
      for (const stueck of zerschneiden(weg, 6, saatAus('g', s))) {
        expect(stueck.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('massFuerLevel', () => {
  it('wächst mit dem Level und ist gedeckelt', () => {
    expect(massFuerLevel(1).breite).toBe(5);
    expect(massFuerLevel(1).farben).toBe(3);
    expect(massFuerLevel(20).breite).toBe(7);
    expect(massFuerLevel(999).breite).toBe(7);
    expect(massFuerLevel(999).farben).toBe(6);
  });

  it('hat nie mehr Farben als Felderpaare hergeben', () => {
    for (let level = 1; level <= 60; level++) {
      const { breite, hoehe, farben } = massFuerLevel(level);
      expect(farben * 2).toBeLessThanOrEqual(breite * hoehe);
    }
  });
});

describe('raetselErzeugen', () => {
  it('liefert für Level 1 bis 60 ein sauberes, lösbares Rätsel', () => {
    for (let level = 1; level <= 60; level++) {
      const r = raetselErzeugen(saatAus('verbinden', level), level);
      const felder = r.breite * r.hoehe;

      expect(r.paare).toHaveLength(massFuerLevel(level).farben);

      // Die mitgelieferte Lösung füllt das Feld lückenlos und doppelt nichts.
      const alle = r.loesung.flat();
      expect(alle).toHaveLength(felder);
      expect(new Set(alle).size).toBe(felder);

      for (let i = 0; i < r.paare.length; i++) {
        const paar = r.paare[i]!;
        const weg = r.loesung[i]!;
        // Die Punkte sitzen wirklich an den Enden ihres Lösungswegs …
        expect(weg[0]).toBe(paar.a);
        expect(weg[weg.length - 1]).toBe(paar.b);
        // … und liegen nie aufeinander.
        expect(paar.a).not.toBe(paar.b);
        // … und der Weg dazwischen läuft Feld für Feld.
        for (let k = 1; k < weg.length; k++) {
          expect(sindNachbarn(weg[k - 1]!, weg[k]!, r.breite, r.hoehe)).toBe(true);
        }
      }
    }
  });

  it('setzt nie zwei Punkte auf dasselbe Feld', () => {
    for (let level = 1; level <= 40; level++) {
      const r = raetselErzeugen(saatAus('verbinden', level), level);
      const punkte = r.paare.flatMap((p) => [p.a, p.b]);
      expect(new Set(punkte).size).toBe(punkte.length);
    }
  });

  it('ergibt bei gleicher Levelnummer dasselbe Rätsel', () => {
    // Grundlage fürs spätere Duell.
    const a = raetselErzeugen(saatAus('verbinden', 12), 12);
    const b = raetselErzeugen(saatAus('verbinden', 12), 12);
    expect(a.paare).toEqual(b.paare);
  });

  it('gibt verschiedenen Levels verschiedene Rätsel', () => {
    const a = raetselErzeugen(saatAus('verbinden', 3), 3);
    const b = raetselErzeugen(saatAus('verbinden', 4), 4);
    expect(a.paare).not.toEqual(b.paare);
  });
});
