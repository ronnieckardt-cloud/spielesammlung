import { describe, expect, it } from 'vitest';
import { eigenePunkte, fremdePunkte, gegnerName, offen, sortieren, standFuer } from './duell';
import type { Duell } from './konto';

const ICH = 'mich-11111111';
const DU = 'dich-22222222';

function duell(teil: Partial<Duell> = {}): Duell {
  return {
    id: 'd1',
    spiel: 'quiz',
    level: 4,
    herausforderer: ICH,
    herausfordererName: 'Florian',
    gegner: DU,
    gegnerName: 'Mia',
    punkteHerausforderer: null,
    punkteGegner: null,
    erstelltAm: '2026-08-15T10:00:00Z',
    ...teil,
  };
}

describe('standFuer', () => {
  it('sagt beiden „du bist dran", solange keiner gespielt hat', () => {
    expect(standFuer(duell(), ICH).art).toBe('du-bist-dran');
    expect(standFuer(duell(), DU).art).toBe('du-bist-dran');
  });

  /**
   * Der Fall, in dem sich so ein Ding erfahrungsgemäß verrechnet: dieselbe
   * Zeile bedeutet für beide Seiten etwas **anderes**.
   */
  it('sieht dieselbe Zeile aus beiden Richtungen richtig', () => {
    const d = duell({ punkteHerausforderer: 90, punkteGegner: null });
    expect(standFuer(d, ICH).art).toBe('warten-auf-gegner');
    expect(standFuer(d, DU).art).toBe('du-bist-dran');
  });

  it('verteilt Sieg und Niederlage seitenrichtig', () => {
    const d = duell({ punkteHerausforderer: 90, punkteGegner: 40 });
    expect(standFuer(d, ICH).art).toBe('gewonnen');
    expect(standFuer(d, DU).art).toBe('verloren');
  });

  it('erkennt ein Unentschieden für beide', () => {
    const d = duell({ punkteHerausforderer: 70, punkteGegner: 70 });
    expect(standFuer(d, ICH).art).toBe('unentschieden');
    expect(standFuer(d, DU).art).toBe('unentschieden');
  });

  it('zählt auch null Punkte als gespielt', () => {
    // Wer eine Runde vergeigt, hat trotzdem gespielt — sonst stünde er
    // ewig auf „du bist dran".
    const d = duell({ punkteHerausforderer: 0, punkteGegner: null });
    expect(standFuer(d, ICH).art).toBe('warten-auf-gegner');
  });
});

describe('Sicht auf die Punkte', () => {
  it('gibt jedem seine eigenen', () => {
    const d = duell({ punkteHerausforderer: 90, punkteGegner: 40 });
    expect(eigenePunkte(d, ICH)).toBe(90);
    expect(eigenePunkte(d, DU)).toBe(40);
    expect(fremdePunkte(d, ICH)).toBe(40);
    expect(fremdePunkte(d, DU)).toBe(90);
  });

  it('nennt jedem den richtigen Gegner', () => {
    expect(gegnerName(duell(), ICH)).toBe('Mia');
    expect(gegnerName(duell(), DU)).toBe('Florian');
  });
});

describe('sortieren', () => {
  it('stellt nach oben, was ich spielen muss', () => {
    const fertig = duell({ id: 'a', punkteHerausforderer: 5, punkteGegner: 3 });
    const wartet = duell({ id: 'b', punkteHerausforderer: 5 });
    const dran = duell({ id: 'c' });
    const sortiert = sortieren([fertig, wartet, dran], ICH).map((d) => d.id);
    expect(sortiert).toEqual(['c', 'b', 'a']);
  });

  it('zeigt innerhalb einer Gruppe das Neueste zuerst', () => {
    const alt = duell({ id: 'alt', erstelltAm: '2026-08-01T10:00:00Z' });
    const neu = duell({ id: 'neu', erstelltAm: '2026-08-14T10:00:00Z' });
    expect(sortieren([alt, neu], ICH).map((d) => d.id)).toEqual(['neu', 'alt']);
  });

  it('lässt die übergebene Liste unangetastet', () => {
    const liste = [duell({ id: 'a', punkteHerausforderer: 1, punkteGegner: 2 }), duell({ id: 'b' })];
    sortieren(liste, ICH);
    expect(liste.map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('offen', () => {
  it('ist nur wahr, solange ich selbst noch nicht gespielt habe', () => {
    expect(offen(duell(), ICH)).toBe(true);
    expect(offen(duell({ punkteHerausforderer: 10 }), ICH)).toBe(false);
  });
});
