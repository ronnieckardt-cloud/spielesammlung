import { describe, it, expect } from 'vitest';
import { bewegen, neuesSpiel, START_ZEIT, ZEIT_BONUS, zeitLaufen } from './logik';
import type { Richtung, Zustand } from './logik';

/** Führt den Spieler Feld für Feld zum Ziel und gibt den Zustand danach zurück. */
function zumZiel(z: Zustand): Zustand {
  let aktuell = z;
  for (let i = 0; i < 20 && aktuell.punkte === z.punkte; i++) {
    const dx = aktuell.ziel.x - aktuell.spieler.x;
    const dy = aktuell.ziel.y - aktuell.spieler.y;
    const richtung: Richtung =
      dx !== 0 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    aktuell = bewegen(aktuell, richtung);
  }
  return aktuell;
}

describe('Platzhalter-Logik', () => {
  it('startet bei gleicher Saat immer gleich', () => {
    expect(neuesSpiel(42)).toEqual(neuesSpiel(42));
  });

  it('legt das Ziel nie auf den Spieler', () => {
    for (let saat = 0; saat < 200; saat++) {
      const z = neuesSpiel(saat);
      expect(z.ziel).not.toEqual(z.spieler);
      expect(z.ziel.x).toBeGreaterThanOrEqual(0);
      expect(z.ziel.x).toBeLessThan(z.breite);
      expect(z.ziel.y).toBeGreaterThanOrEqual(0);
      expect(z.ziel.y).toBeLessThan(z.hoehe);
    }
  });

  it('läuft nicht durch die Wand', () => {
    let z = neuesSpiel(1);
    for (let i = 0; i < 10; i++) z = bewegen(z, 'left');
    expect(z.spieler.x).toBe(0);

    const amRand = z;
    expect(bewegen(amRand, 'left')).toBe(amRand); // unverändert, gleiches Objekt
  });

  it('gibt Punkt und Zeit, wenn das Ziel erreicht wird', () => {
    const start = { ...neuesSpiel(7), restZeit: 5 };
    const nachher = zumZiel(start);
    expect(nachher.punkte).toBe(1);
    expect(nachher.restZeit).toBeCloseTo(5 + ZEIT_BONUS);
    expect(nachher.ziel).not.toEqual(nachher.spieler);
  });

  it('lässt die Zeit nie über den Startwert steigen', () => {
    const nachher = zumZiel(neuesSpiel(3));
    expect(nachher.restZeit).toBe(START_ZEIT);
  });

  it('beendet das Spiel, wenn die Zeit abgelaufen ist', () => {
    let z = { ...neuesSpiel(9), restZeit: 1 };
    z = zeitLaufen(z, 0.5);
    expect(z.vorbei).toBe(false);
    z = zeitLaufen(z, 0.6);
    expect(z.vorbei).toBe(true);
    expect(z.restZeit).toBe(0);
  });

  it('reagiert nach dem Spielende auf nichts mehr', () => {
    const vorbei = { ...neuesSpiel(11), vorbei: true };
    expect(bewegen(vorbei, 'right')).toBe(vorbei);
    expect(zeitLaufen(vorbei, 10)).toBe(vorbei);
  });

  it('ergibt bei gleicher Saat denselben Spielverlauf', () => {
    const lauf = (saat: number) => {
      let z = neuesSpiel(saat);
      for (let i = 0; i < 5; i++) z = zumZiel(z);
      return z;
    };
    expect(lauf(123)).toEqual(lauf(123));
    expect(lauf(123)).not.toEqual(lauf(124));
  });
});
