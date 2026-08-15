import { describe, expect, it } from 'vitest';
import { flaeche } from './geometrie';
import {
  FORMEN_PRO_LEVEL,
  MAX_PRO_FORM,
  bewertung,
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

describe('bewertung', () => {
  it('lobt nur den wirklich genauen Schnitt', () => {
    expect(bewertung(100)).toBe('Perfekt!');
    expect(bewertung(98)).toBe('Fast perfekt');
    expect(bewertung(85)).toBe('Geht so');
    expect(bewertung(0)).toBe('Vorbeigeschnitten');
  });
});
