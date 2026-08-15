import { describe, expect, it } from 'vitest';
import { saatAus, schritt } from '../../core/rng';
import {
  FORM_GROESSE,
  flaeche,
  formErzeugen,
  genauigkeit,
  istKonvex,
  punkteFuerSchnitt,
  schneiden,
  schwerpunkt,
  seite,
} from './geometrie';
import type { Form, Punkt } from './geometrie';

const QUADRAT: Form = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

describe('flaeche', () => {
  it('rechnet das Quadrat richtig aus', () => {
    expect(flaeche(QUADRAT)).toBeCloseTo(400, 6);
  });

  it('ist unabhängig vom Umlaufsinn', () => {
    expect(flaeche([...QUADRAT].reverse())).toBeCloseTo(400, 6);
  });

  it('gibt für eine Linie null zurück', () => {
    expect(
      flaeche([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ]),
    ).toBeCloseTo(0, 6);
  });
});

describe('seite', () => {
  it('unterscheidet links, rechts und genau darauf', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(seite({ x: 5, y: 3 }, a, b)).toBeGreaterThan(0);
    expect(seite({ x: 5, y: -3 }, a, b)).toBeLessThan(0);
    expect(seite({ x: 5, y: 0 }, a, b)).toBe(0);
  });
});

describe('schneiden', () => {
  it('halbiert das Quadrat waagerecht genau', () => {
    const { links, rechts } = schneiden(QUADRAT, { x: -50, y: 0 }, { x: 50, y: 0 });
    expect(flaeche(links)).toBeCloseTo(200, 6);
    expect(flaeche(rechts)).toBeCloseTo(200, 6);
  });

  it('halbiert das Quadrat auch über die Diagonale', () => {
    const { links, rechts } = schneiden(QUADRAT, { x: -20, y: -20 }, { x: 20, y: 20 });
    expect(flaeche(links)).toBeCloseTo(200, 6);
    expect(flaeche(rechts)).toBeCloseTo(200, 6);
  });

  it('lässt bei einem Schnitt außerhalb ein Stück leer', () => {
    const { links, rechts } = schneiden(QUADRAT, { x: -50, y: 30 }, { x: 50, y: 30 });
    expect(flaeche(links)).toBeCloseTo(0, 6);
    expect(flaeche(rechts)).toBeCloseTo(400, 6);
  });

  it('kommt mit einem Schnitt genau durch zwei Ecken klar', () => {
    // Genau durch die Ecken (-10,-10) und (10,10): Punkte auf der Geraden
    // gehören zu beiden Seiten, sonst klafft eine Lücke.
    const { links, rechts } = schneiden(QUADRAT, { x: -10, y: -10 }, { x: 10, y: 10 });
    expect(flaeche(links) + flaeche(rechts)).toBeCloseTo(400, 6);
  });

  /**
   * Der eigentliche Prüfstein: **Nichts darf verloren gehen.**
   *
   * Ein Fehler in der Klipp-Schleife fällt bei einem einzelnen sauberen
   * Schnitt oft gar nicht auf, aber über hunderte schiefer Schnitte durch
   * unregelmäßige Formen sofort. Deshalb hier viele Formen mal viele
   * Geraden — und jedes Mal muss die Summe der beiden Stücke wieder die
   * ganze Form ergeben.
   */
  it('verliert bei hunderten Schnitten nie Fläche', () => {
    let saat = saatAus('halbieren-pruefung');
    for (let f = 0; f < 40; f++) {
      const form = formErzeugen(saatAus('form', f), 1 + (f % 12));
      const ganz = flaeche(form);
      for (let s = 0; s < 12; s++) {
        const w1 = schritt(saat);
        const w2 = schritt(w1.saat);
        const w3 = schritt(w2.saat);
        const w4 = schritt(w3.saat);
        saat = w4.saat;
        // Zwei zufällige Punkte weit außerhalb — die Gerade dazwischen
        // trifft die Form mal, mal nicht. Beides muss stimmen.
        const a: Punkt = { x: (w1.wert - 0.5) * 200, y: (w2.wert - 0.5) * 200 };
        const b: Punkt = { x: (w3.wert - 0.5) * 200, y: (w4.wert - 0.5) * 200 };
        if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue;
        const { links, rechts } = schneiden(form, a, b);
        expect(flaeche(links) + flaeche(rechts)).toBeCloseTo(ganz, 4);
      }
    }
  });

  it('liefert bei einem Treffer zwei Stücke mit mindestens drei Ecken', () => {
    const { links, rechts } = schneiden(QUADRAT, { x: -50, y: 2 }, { x: 50, y: 2 });
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(rechts.length).toBeGreaterThanOrEqual(3);
  });
});

describe('schwerpunkt', () => {
  it('liegt beim Quadrat in der Mitte', () => {
    const s = schwerpunkt(QUADRAT);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(0, 6);
  });

  it('rutscht mit der Form mit', () => {
    const verschoben = QUADRAT.map((p) => ({ x: p.x + 7, y: p.y - 3 }));
    const s = schwerpunkt(verschoben);
    expect(s.x).toBeCloseTo(7, 6);
    expect(s.y).toBeCloseTo(-3, 6);
  });
});

describe('Wertung', () => {
  it('gibt für den perfekten Schnitt volle Punkte', () => {
    const { links, rechts } = schneiden(QUADRAT, { x: -50, y: 0 }, { x: 50, y: 0 });
    expect(genauigkeit(links, rechts)).toBeCloseTo(100, 6);
    expect(punkteFuerSchnitt(genauigkeit(links, rechts))).toBe(100);
  });

  it('gibt für einen Schnitt daneben nichts', () => {
    const { links, rechts } = schneiden(QUADRAT, { x: -50, y: 30 }, { x: 50, y: 30 });
    expect(punkteFuerSchnitt(genauigkeit(links, rechts))).toBe(0);
  });

  it('wird mit wachsender Abweichung weniger', () => {
    const a = punkteFuerSchnitt(99);
    const b = punkteFuerSchnitt(95);
    const c = punkteFuerSchnitt(88);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBe(0);
  });

  it('bleibt nie negativ', () => {
    expect(punkteFuerSchnitt(0)).toBe(0);
  });
});

describe('formErzeugen', () => {
  it('liefert immer konvexe Formen mit Fläche', () => {
    for (let level = 1; level <= 40; level++) {
      for (let i = 0; i < 5; i++) {
        const form = formErzeugen(saatAus('halbieren', level, i), level);
        expect(form.length).toBeGreaterThanOrEqual(3);
        expect(istKonvex(form)).toBe(true);
        expect(flaeche(form)).toBeGreaterThan(50);
      }
    }
  });

  it('bleibt im vorgesehenen Rahmen', () => {
    for (let level = 1; level <= 40; level++) {
      for (const p of formErzeugen(saatAus('halbieren', level, 0), level)) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(FORM_GROESSE + 0.001);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(FORM_GROESSE + 0.001);
      }
    }
  });

  it('ergibt bei gleicher Saat dieselbe Form', () => {
    expect(formErzeugen(saatAus('halbieren', 7, 2), 7)).toEqual(
      formErzeugen(saatAus('halbieren', 7, 2), 7),
    );
  });

  it('wird mit dem Level schmaler, aber nicht platt', () => {
    // Die Streckung ist gedeckelt — eine hauchdünne Form wäre kein Rätsel
    // mehr, sondern Millimeterarbeit.
    const hoch = formErzeugen(saatAus('halbieren', 99, 0), 99);
    expect(flaeche(hoch)).toBeGreaterThan(500);
  });
});

describe('Jede Form lässt sich halbieren', () => {
  /**
   * Das ist die Zusicherung, ohne die das ganze Spiel unfair wäre: Zu jeder
   * erzeugten Form muss es eine Gerade geben, die sie wirklich halbiert.
   *
   * Gesucht wird sie durch Einschachteln — für eine feste Richtung wird die
   * Gerade so lange verschoben, bis beide Stücke gleich groß sind. Weil die
   * Fläche der einen Seite beim Verschieben stetig und streng wächst, findet
   * das Verfahren immer eine Lösung.
   */
  function bestesErgebnis(form: Form, winkel: number): number {
    const richtung = { x: Math.cos(winkel), y: Math.sin(winkel) };
    const normale = { x: -richtung.y, y: richtung.x };
    let tief = -FORM_GROESSE * 2;
    let hoch = FORM_GROESSE * 2;
    for (let i = 0; i < 60; i++) {
      const mitte = (tief + hoch) / 2;
      const p = { x: normale.x * mitte, y: normale.y * mitte };
      const { links, rechts } = schneiden(
        form,
        p,
        { x: p.x + richtung.x, y: p.y + richtung.y },
      );
      // Ist das linke Stück zu groß, muss die Gerade weiter nach links —
      // also der Versatz größer werden. Andersherum lief die Einschachtelung
      // sofort an den Rand und lieferte ein leeres Stück.
      if (flaeche(links) > flaeche(rechts)) tief = mitte;
      else hoch = mitte;
    }
    const mitte = (tief + hoch) / 2;
    const p = { x: normale.x * mitte, y: normale.y * mitte };
    const { links, rechts } = schneiden(form, p, { x: p.x + richtung.x, y: p.y + richtung.y });
    return genauigkeit(links, rechts);
  }

  it('findet für jede Form eine praktisch perfekte Gerade', () => {
    for (let level = 1; level <= 30; level++) {
      const form = formErzeugen(saatAus('halbieren', level, 3), level);
      expect(bestesErgebnis(form, 0.7)).toBeGreaterThan(99.99);
    }
  });
});
