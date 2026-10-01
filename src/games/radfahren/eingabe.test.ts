import { describe, expect, it } from 'vitest';
import { WISCH_SCHWELLE, fingerBewegen, wischNachOben } from './eingabe';
import type { Finger } from './eingabe';

describe('Wischerkennung', () => {
  it('erkennt einen Wisch senkrecht nach oben', () => {
    expect(wischNachOben(200, 500, 200, 500 - WISCH_SCHWELLE)).toBe(true);
    expect(wischNachOben(200, 500, 200, 400)).toBe(true);
  });

  it('löst erst ab der Schwelle aus, nicht schon bei Zittern', () => {
    expect(wischNachOben(200, 500, 200, 500 - (WISCH_SCHWELLE - 1))).toBe(false);
    expect(wischNachOben(200, 500, 203, 497)).toBe(false);
  });

  it('erkennt einen schrägen Wisch nach oben-rechts und oben-links', () => {
    expect(wischNachOben(200, 500, 220, 470)).toBe(true);
    expect(wischNachOben(200, 500, 180, 470)).toBe(true);
  });

  it('ignoriert einen Wisch, der mehr zur Seite als nach oben geht', () => {
    expect(wischNachOben(200, 500, 260, 480)).toBe(false);
    expect(wischNachOben(200, 500, 140, 480)).toBe(false);
  });

  it('ignoriert einen Wisch nach unten', () => {
    expect(wischNachOben(200, 500, 200, 560)).toBe(false);
  });

  it('löst während der Bewegung aus, nicht erst beim Loslassen', () => {
    const f: Finger = { x: 100, y: 600, ausgeloest: false };
    // Der Finger wandert in kleinen Schritten — beim Überschreiten der Schwelle meldet es sofort.
    const meldungen = [592, 585, 580, 575, 560].map((y) => fingerBewegen(f, 100, y));
    expect(meldungen).toEqual([false, false, true, false, false]);
  });

  it('löst je Finger genau einmal aus, auch bei einem sehr langen Wisch', () => {
    const f: Finger = { x: 100, y: 600, ausgeloest: false };
    let zahl = 0;
    for (let y = 600; y >= 100; y -= 5) if (fingerBewegen(f, 100, y)) zahl += 1;
    expect(zahl).toBe(1);
  });

  it('ein neuer Finger löst wieder aus', () => {
    const a: Finger = { x: 100, y: 600, ausgeloest: false };
    expect(fingerBewegen(a, 100, 540)).toBe(true);
    const b: Finger = { x: 100, y: 600, ausgeloest: false };
    expect(fingerBewegen(b, 100, 540)).toBe(true);
  });
});
