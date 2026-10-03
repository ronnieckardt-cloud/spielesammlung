import { describe, expect, it } from 'vitest';
import { rng, saatAus } from '../../core/rng';
import { levelAufbauen, neuesSpiel, normalisieren, werfen, zeitFortschritt } from './logik';
import type { Zustand } from './logik';
import { botSpielen, groessteLueckenMitte, zeitBisLuecke } from './bot';

/**
 * Der Bot ist der Maßstab für die Schwierigkeit — wie der Schütze bei Bubble Pop
 * oder der Gedächtnis-Spieler bei Pair Up. Er zielt auf die Mitte der größten
 * Lücke und wirft mit einer **Ungenauigkeit** in Sekunden: so ungenau tippt auch
 * ein Mensch, der genau weiß, wann er tippen will.
 *
 * Gemessen (30 Saaten, Start in Level 1, höchstens 300 s):
 *
 * | Ungenauigkeit | Level im Median | tot |
 * |---|---|---|
 * | 0 ms | 28 (nur die Zeit ist um) | 0 von 30 |
 * | 40 ms | 29 | 1 von 30 |
 * | 80 ms | 21 | 26 von 30 |
 * | 120 ms | 13 | 30 von 30 |
 * | 160 ms | 12 | 30 von 30 |
 *
 * Mit dem alten Drehmuster (gleich lange Abschnitte in beide Richtungen) starb selbst der
 * **perfekte** Bot in Level 5 bis 30, im Median in Level 10: Der Stamm pendelte nur hin und her,
 * und manche Lücke kam nie an den Einschlagpunkt. Ab da entschied nicht Können, sondern Zufall.
 */
const SAATEN = [1, 2, 3, 4, 5, 6].map((n) => saatAus('messerwurf', n));

describe('Der perfekte Bot', () => {
  it('stirbt von Level 1 an nie und kommt in 150 Sekunden weit', () => {
    for (const [i, saat] of SAATEN.entries()) {
      const l = botSpielen(neuesSpiel(saat), { ungenauigkeit: 0 }, 150, i + 1);
      expect(l.zustand.vorbei).toBe(false);
      // Weit heißt: ein Level dauert rund zwölf Sekunden, in 150 Sekunden sind das zehn und mehr.
      expect(l.zustand.level).toBeGreaterThanOrEqual(9);
    }
  });

  it('schafft auch die Level mit den engsten Lücken, Boss-Stämme eingeschlossen', () => {
    // Das ist der Beweis, dass die späten Level **zu schaffen** sind: Beim perfekten Bot
    // darf es dort keinen Tod geben. Vorher starb er hier.
    for (const start of [12, 15, 20, 25, 30, 40, 60]) {
      for (const [i, saat] of SAATEN.entries()) {
        const l = botSpielen(levelAufbauen(start, 0, saat), { ungenauigkeit: 0 }, 30, i + 1);
        expect(l.zustand.vorbei, `Level ${start}, Saat ${i + 1}`).toBe(false);
        expect(l.zustand.level, `Level ${start}, Saat ${i + 1}`).toBeGreaterThan(start);
      }
    }
  });

  it('spielt bei gleicher Saat immer dasselbe', () => {
    const a = botSpielen(neuesSpiel(SAATEN[0]!), { ungenauigkeit: 0.05 }, 30, 7);
    const b = botSpielen(neuesSpiel(SAATEN[0]!), { ungenauigkeit: 0.05 }, 30, 7);
    expect(b.zustand.punkte).toBe(a.zustand.punkte);
    expect(b.zustand.level).toBe(a.zustand.level);
  });
});

describe('Genauigkeit entscheidet in den späten Leveln', () => {
  /** Wie viele von zwölf Läufen in Level 20 innerhalb von 40 Sekunden tödlich enden. */
  function tote(ungenauigkeit: number): number {
    let tot = 0;
    for (let n = 1; n <= 12; n++) {
      const l = botSpielen(levelAufbauen(20, 0, saatAus('messerwurf', n)), { ungenauigkeit }, 40, n);
      if (l.zustand.vorbei) tot++;
    }
    return tot;
  }

  it('lässt einen genauen Spieler fast nie, einen ungenauen oft scheitern', () => {
    const genau = tote(0.04);
    const ungenau = tote(0.1);
    // Gemessen (30 Saaten): 3 von 30 gegen 21 von 30.
    expect(genau).toBeLessThanOrEqual(4);
    expect(ungenau).toBeGreaterThanOrEqual(genau + 4);
  });

  it('lässt einen sehr ungenauen Spieler schon in den mittleren Leveln scheitern', () => {
    let tot = 0;
    for (let n = 1; n <= 12; n++) {
      const l = botSpielen(neuesSpiel(saatAus('messerwurf', n)), { ungenauigkeit: 0.16 }, 200, n);
      if (l.zustand.vorbei) tot++;
      // Er kommt weit weniger weit als der genaue.
      expect(l.zustand.level).toBeLessThan(22);
    }
    expect(tot).toBe(12);
  });
});

describe('Wer nicht zielt, kommt nicht weit', () => {
  it('stirbt beim wahllosen Werfen in den ersten Leveln', () => {
    // Gemessen (40 Saaten): Level 4 bis 11, im Median 6. Früh sind die Lücken noch groß genug, dass auch Zufall
    // eine Weile gutgeht — aber nicht weiter.
    const level: number[] = [];
    for (let n = 1; n <= 12; n++) {
      const zufall = rng(n);
      let z: Zustand = neuesSpiel(saatAus('messerwurf', n));
      for (let i = 0; i < 60 * 200 && !z.vorbei; i++) {
        // Wirft in zufälligen Abständen, ohne auf die Lücken zu achten.
        if (zufall.zahl() < 0.05) z = werfen(z);
        z = zeitFortschritt(z, 1 / 60);
      }
      expect(z.vorbei).toBe(true);
      level.push(z.level);
    }
    level.sort((a, b) => a - b);
    expect(level[Math.floor(level.length / 2)]!).toBeLessThanOrEqual(8);
    expect(level[level.length - 1]!).toBeLessThan(14);
  });
});

describe('Hilfsfunktionen des Bots', () => {
  it('findet die Mitte der größten Lücke, auch über die Naht bei 2π', () => {
    // Messer bei 0,5 und bei 5,8: Die größte Lücke liegt dazwischen, bei 0,5 → 5,8 (nach oben gerechnet).
    const mitte = groessteLueckenMitte([0.5, 5.8]);
    expect(mitte).toBeCloseTo((0.5 + 5.8) / 2, 6);
    // Die Naht liegt in der anderen Lücke und ist die kleinere (0,98 gegen 5,3).
    expect(groessteLueckenMitte([1, 2, 3, 4, 5])).toBeCloseTo(normalisieren((5 + (1 + 2 * Math.PI)) / 2), 6);
  });

  it('rechnet die Zeit bis zur Lücke mit der echten Drehung — mit Richtungswechsel', () => {
    // Ein Wurf zu dieser Zeit muss im Spiel wirklich in der Lücke landen (Genauigkeit gut 0,05).
    const z = levelAufbauen(12, 0, 3);
    const zeit = zeitBisLuecke(z);
    let s: Zustand = z;
    const ziel = groessteLueckenMitte(z.messer);
    const dt = 1 / 240;
    for (let t = 0; t < zeit; t += dt) s = zeitFortschritt(s, dt);
    s = werfen(s);
    for (let i = 0; i < 80 && s.fliegend !== null; i++) s = zeitFortschritt(s, 1 / 60);
    const gesteckt = s.messer[s.messer.length - 1]!;
    const abstand = Math.abs(((gesteckt - ziel + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    expect(abstand).toBeLessThan(0.15);
  });
});
