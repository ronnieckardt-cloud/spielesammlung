import { describe, it, expect } from 'vitest';
import { MAX_SCHRITTE, MAX_VERGANGEN, takt } from './useGameLoop';

const SCHRITT_60 = 1000 / 60;

describe('takt — Rechenkern der Spieluhr', () => {
  it('macht bei einem normalen Bild einen Schritt', () => {
    const e = takt(16.7, 0, SCHRITT_60);
    expect(e.schritte).toBe(1);
    expect(e.rest).toBeLessThan(SCHRITT_60);
  });

  it('sammelt zu kurze Bilder auf, statt sie zu verlieren', () => {
    const a = takt(9, 0, SCHRITT_60); // 9 ms sind noch kein voller Schritt
    expect(a.schritte).toBe(0);
    expect(a.rest).toBe(9);
    const b = takt(9, a.rest, SCHRITT_60); // zusammen 18 ms — jetzt reicht es
    expect(b.schritte).toBe(1);
  });

  it('verliert über viele Bilder keine Zeit', () => {
    // 120-Hz-Bildschirm, 1 Sekunde lang: es müssen 60 Schritte herauskommen.
    let rest = 0;
    let gesamt = 0;
    for (let i = 0; i < 120; i++) {
      const e = takt(1000 / 120, rest, SCHRITT_60);
      rest = e.rest;
      gesamt += e.schritte;
    }
    expect(gesamt).toBe(60);
  });

  it('macht bei einem langsamen Bild mehrere Schritte', () => {
    expect(takt(35, 0, SCHRITT_60).schritte).toBe(2); // 35 ms = zwei volle Schritte
    expect(takt(50, 0, SCHRITT_60).schritte).toBe(3);
  });

  it('holt lange Pausen nicht auf', () => {
    // Zehn Sekunden im Hintergrund: höchstens die erlaubten Schritte.
    const e = takt(10_000, 0, SCHRITT_60);
    expect(e.schritte).toBe(MAX_SCHRITTE);
    expect(e.rest).toBe(0);
  });

  it('schneidet schon vor der Schrittgrenze ab', () => {
    // Selbst bei sehr grobem Zeitschritt wird nie mehr als MAX_VERGANGEN gezählt.
    const grob = 1000; // 1 Schritt pro Sekunde
    expect(takt(60_000, 0, grob).schritte).toBe(Math.floor(MAX_VERGANGEN / grob));
  });

  it('kommt mit Null und mit rückwärts laufender Zeit klar', () => {
    expect(takt(0, 0, SCHRITT_60)).toEqual({ schritte: 0, rest: 0 });
    expect(takt(-500, 0, SCHRITT_60).schritte).toBe(0);
  });
});
