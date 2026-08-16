import { describe, expect, it } from 'vitest';
import { flaeche, genauigkeit, schneiden } from './geometrie';
import {
  FORMEN_PRO_LEVEL,
  MAX_PRO_FORM,
  MINDEST_WISCH,
  TASTE_GRAD_FEIN,
  TASTE_SCHUB_FEIN,
  bewertung,
  geradeAus,
  istZuKurz,
  naechsteForm,
  neuesLevel,
  schneidenAn,
} from './logik';

const WEIT_LINKS = { x: -80, y: 0 };
const WEIT_RECHTS = { x: 80, y: 0 };

describe('neuesLevel', () => {
  it('fängt bei der ersten Form ohne Punkte an', () => {
    const z = neuesLevel(1);
    expect(z.index).toBe(0);
    expect(z.punkte).toBe(0);
    expect(z.schnitt).toBeNull();
    expect(z.vorbei).toBe(false);
    expect(flaeche(z.form)).toBeGreaterThan(0);
  });

  it('ergibt bei gleicher Levelnummer dieselben Formen', () => {
    // Grundlage fürs spätere Duell: gleiche Nummer, gleiche Aufgabe.
    const a = neuesLevel(9);
    const b = neuesLevel(9);
    expect(a.form).toEqual(b.form);
    expect(naechsteForm(schneidenAn(a, WEIT_LINKS, WEIT_RECHTS)).form).toEqual(
      naechsteForm(schneidenAn(b, WEIT_LINKS, WEIT_RECHTS)).form,
    );
  });

  it('gibt verschiedenen Levels verschiedene Formen', () => {
    expect(neuesLevel(1).form).not.toEqual(neuesLevel(2).form);
  });
});

describe('schneidenAn', () => {
  it('merkt sich den Schnitt und rechnet die Punkte dazu', () => {
    const z = schneidenAn(neuesLevel(1), WEIT_LINKS, WEIT_RECHTS);
    expect(z.schnitt).not.toBeNull();
    expect(z.punkte).toBe(z.schnitt!.punkte);
    expect(z.schnitt!.punkte).toBeLessThanOrEqual(MAX_PRO_FORM);
  });

  it('verliert beim Schneiden keine Fläche', () => {
    const z = neuesLevel(4);
    const ganz = flaeche(z.form);
    const nachher = schneidenAn(z, { x: -80, y: -12 }, { x: 80, y: 15 });
    expect(flaeche(nachher.schnitt!.links) + flaeche(nachher.schnitt!.rechts)).toBeCloseTo(ganz, 4);
  });

  it('lässt einen zweiten Schnitt an derselben Form nicht zu', () => {
    // Auf dem Handy kommt beim Wischen gern ein zweites pointerup nach.
    const erst = schneidenAn(neuesLevel(1), WEIT_LINKS, WEIT_RECHTS);
    const nochmal = schneidenAn(erst, { x: -80, y: 30 }, { x: 80, y: 30 });
    expect(nochmal).toBe(erst);
  });

  it('wertet ein Antippen nicht als Schnitt', () => {
    const z = neuesLevel(1);
    expect(schneidenAn(z, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(z);
  });

  it('gibt für einen Schnitt weit daneben null Punkte', () => {
    const z = schneidenAn(neuesLevel(1), { x: -80, y: 70 }, { x: 80, y: 70 });
    expect(z.schnitt!.punkte).toBe(0);
    expect(z.punkte).toBe(0);
  });
});

describe('naechsteForm', () => {
  it('geht ohne Schnitt nicht weiter', () => {
    const z = neuesLevel(1);
    expect(naechsteForm(z)).toBe(z);
  });

  it('legt eine neue Form vor und löscht den alten Schnitt', () => {
    const z = naechsteForm(schneidenAn(neuesLevel(1), WEIT_LINKS, WEIT_RECHTS));
    expect(z.index).toBe(1);
    expect(z.schnitt).toBeNull();
  });

  it('beendet die Runde nach der letzten Form', () => {
    let z = neuesLevel(3);
    for (let i = 0; i < FORMEN_PRO_LEVEL; i++) {
      z = naechsteForm(schneidenAn(z, WEIT_LINKS, WEIT_RECHTS));
    }
    expect(z.vorbei).toBe(true);
    expect(z.index).toBe(FORMEN_PRO_LEVEL - 1);
  });

  it('sammelt die Punkte über die ganze Runde', () => {
    let z = neuesLevel(2);
    for (let i = 0; i < FORMEN_PRO_LEVEL; i++) {
      z = naechsteForm(schneidenAn(z, WEIT_LINKS, WEIT_RECHTS));
    }
    expect(z.punkte).toBeGreaterThanOrEqual(0);
    expect(z.punkte).toBeLessThanOrEqual(FORMEN_PRO_LEVEL * MAX_PRO_FORM);
  });
});

describe('istZuKurz', () => {
  // Dieselbe Regel, nach der `schneidenAn` den Zug verwirft — die Anzeige
  // fragt sie ab, um „zu kurz" sagen zu können statt stumm nichts zu tun.
  it('erkennt genau die Wische, die kein Schnitt werden', () => {
    const mitte = { x: 0, y: 0 };
    expect(istZuKurz(mitte, { x: MINDEST_WISCH - 0.1, y: 0 })).toBe(true);
    expect(istZuKurz(mitte, { x: MINDEST_WISCH + 0.1, y: 0 })).toBe(false);
  });

  it('sagt für jeden verworfenen Zug dasselbe wie schneidenAn', () => {
    const z = neuesLevel(1);
    for (const bis of [
      { x: 0.5, y: 0.5 },
      { x: 3, y: 0 },
      { x: 0, y: 12 },
      { x: -30, y: 20 },
    ]) {
      const von = { x: 0, y: 0 };
      expect(istZuKurz(von, bis)).toBe(schneidenAn(z, von, bis) === z);
    }
  });
});

describe('geradeAus', () => {
  // Der Tastaturweg: Pfeile legen die Gerade, Leertaste schneidet.
  it('legt die Gerade waagerecht durch die Mitte, wenn nichts verstellt ist', () => {
    const { a, b } = geradeAus(0, 0);
    expect(a.y).toBeCloseTo(0, 6);
    expect(b.y).toBeCloseTo(0, 6);
    expect(a.x).toBeLessThan(b.x);
  });

  it('dreht sich mit dem Winkel', () => {
    const { a, b } = geradeAus(90, 0);
    expect(a.x).toBeCloseTo(0, 6);
    expect(b.x).toBeCloseTo(0, 6);
  });

  it('schiebt die Gerade senkrecht zu sich selbst', () => {
    const { a, b } = geradeAus(0, 7);
    expect(a.y).toBeCloseTo(7, 6);
    expect(b.y).toBeCloseTo(7, 6);
  });

  it('ist lang genug, um jede Form zu durchtrennen', () => {
    // Sonst läge ein Ende mitten in der Form und die Wertung wäre Unsinn.
    const { a, b } = geradeAus(37, 0);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(100);
    expect(istZuKurz(a, b)).toBe(false);
  });

  it('erreicht auf dem Tastaturraster ein „Perfekt"', () => {
    /**
     * Die Zusicherung für den Tastaturweg — dasselbe Versprechen, das
     * `geometrie.test.ts` für die Wischgeste gibt: Zu jeder Form muss es
     * eine halbierende Gerade geben, **und sie muss auf dem Raster der
     * Tastenschritte liegen.** Ohne diese Prüfung wäre die Tastatur ein
     * Zugang zweiter Klasse: bedienbar, aber nie auf volle Punktzahl.
     *
     * Gesucht wird nur mit den feinen Schritten und nur auf zwei Winkeln —
     * mehr braucht es nicht, denn zu **jedem** Winkel gibt es eine
     * halbierende Verschiebung; die Frage ist allein, ob das Schub-Raster
     * fein genug ist, um sie zu treffen.
     */
    for (let level = 1; level <= 20; level++) {
      const form = neuesLevel(level).form;
      for (const winkelSchritte of [0, 37]) {
        const winkel = winkelSchritte * TASTE_GRAD_FEIN;
        let bestes = 0;
        for (let s = -500; s <= 500; s++) {
          const { a, b } = geradeAus(winkel, s * TASTE_SCHUB_FEIN);
          const teile = schneiden(form, a, b);
          bestes = Math.max(bestes, genauigkeit(teile.links, teile.rechts));
          if (bestes >= 99.5) break;
        }
        expect(bestes, `Level ${level}, Winkel ${winkel}`).toBeGreaterThanOrEqual(99.5);
      }
    }
  });
});

describe('bewertung', () => {
  it('lobt nur den wirklich genauen Schnitt', () => {
    expect(bewertung(100)).toBe('Perfekt!');
    expect(bewertung(98)).toBe('Fast perfekt');
    expect(bewertung(85)).toBe('Geht so');
    expect(bewertung(0)).toBe('Vorbeigeschnitten');
  });
});
