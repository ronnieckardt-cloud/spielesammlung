import { describe, it, expect } from 'vitest';
import {
  bewegen,
  MIN_ABSTAND,
  neuesSpiel,
  START_ZEIT,
  stufeFuer,
  zeitBonusFuer,
  zeitLaufen,
} from './logik';
import type { Richtung, Zustand } from './logik';

/** Manhattan-Abstand — dasselbe Maß, mit dem `zielSetzen` rechnet. */
const abstand = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

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

  it('legt das Ziel nie in die Nachbarschaft des Spielers', () => {
    for (let saat = 0; saat < 200; saat++) {
      let z = neuesSpiel(saat);
      expect(abstand(z.ziel, z.spieler)).toBeGreaterThanOrEqual(MIN_ABSTAND);
      // Auch nach jedem Fang, nicht nur beim ersten Ziel.
      for (let i = 0; i < 5; i++) {
        z = zumZiel(z);
        expect(abstand(z.ziel, z.spieler)).toBeGreaterThanOrEqual(MIN_ABSTAND);
      }
    }
  });

  it('gibt Punkt und Zeit, wenn das Ziel erreicht wird', () => {
    const start = { ...neuesSpiel(7), restZeit: 5 };
    const nachher = zumZiel(start);
    expect(nachher.punkte).toBe(1);
    expect(nachher.restZeit).toBeCloseTo(5 + zeitBonusFuer(1));
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

  it('wird mit steigender Punktzahl schwerer und nie wieder leichter', () => {
    let vorher = zeitBonusFuer(0);
    for (let punkte = 1; punkte <= 60; punkte++) {
      const jetzt = zeitBonusFuer(punkte);
      expect(jetzt).toBeLessThanOrEqual(vorher);
      expect(jetzt).toBeGreaterThan(0);
      vorher = jetzt;
    }
    // Am Ende deutlich knapper als am Anfang, sonst wäre die Kurve wirkungslos.
    expect(zeitBonusFuer(60)).toBeLessThan(zeitBonusFuer(0) * 0.7);
  });

  it('zählt die Stufe hoch, ohne je zurückzuspringen', () => {
    expect(stufeFuer(0)).toBe(1);
    let vorher = stufeFuer(0);
    for (let punkte = 1; punkte <= 60; punkte++) {
      const jetzt = stufeFuer(punkte);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
    expect(stufeFuer(60)).toBeGreaterThan(1);
  });

  it('schreibt die Zeit nach der Stufe gut, in der man gerade ist', () => {
    // Ein Stern auf einer hohen Stufe bringt weniger als einer am Anfang.
    const frueh = { ...neuesSpiel(21), restZeit: 5, punkte: 0 };
    const spaet = { ...neuesSpiel(21), restZeit: 5, punkte: 30 };
    expect(zumZiel(frueh).restZeit - 5).toBeCloseTo(zeitBonusFuer(1));
    expect(zumZiel(spaet).restZeit - 5).toBeCloseTo(zeitBonusFuer(31));
    expect(zumZiel(spaet).restZeit).toBeLessThan(zumZiel(frueh).restZeit);
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
