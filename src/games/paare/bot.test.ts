import { describe, it, expect } from 'vitest';
import { neuesSpiel } from './logik';
import { spielen } from './bot';

/**
 * Der Spieler mit Gedächtnis (`bot.ts`) ist der Beleg für die Spielbarkeit: Er vergisst nur durch den
 * Wirbel. Gemessen (Wirbel alle 6 / 5): Auf 15 Paaren braucht er ohne Blick im Mittel 34 Züge (ohne Wirbel
 * 27), mit Blick 23 — und kommt in 15 von 16 Levels (13 bis 28) innerhalb der Zuggrenze durch.
 */

const paarLevels = (von: number, bis: number) => Array.from({ length: bis - von + 1 }, (_, i) => von + i);
const ohneGrenze = (level: number) => ({ ...neuesSpiel(level), zugGrenze: null });

describe('der Spieler mit Gedächtnis', () => {
  it('schafft jedes Level von 5 bis 12 ohne Blick und ohne große Umwege', () => {
    for (const level of paarLevels(5, 12)) {
      const l = spielen(ohneGrenze(level), false);
      const paare = l.z.karten.length / 2;
      expect(l.z.gewonnen, `Level ${level}`).toBe(true);
      expect(l.z.zuege, `Level ${level}`).toBeLessThanOrEqual(Math.ceil(paare * 2.6));
    }
  });

  it('muss wegen des Wirbels messbar mehr Züge machen als auf demselben Feld ohne', () => {
    let mit = 0;
    let ohne = 0;
    for (const level of paarLevels(13, 20)) {
      const feld = ohneGrenze(level);
      mit += spielen(feld, false).z.zuege;
      // Dasselbe Feld, aber als Level 8 gezählt: dort wird nie gewirbelt.
      ohne += spielen({ ...feld, level: 8 }, false).z.zuege;
    }
    expect(mit).toBeGreaterThan(ohne * 1.15);
  });

  it('kommt mit dem Blick spürbar weiter als ohne', () => {
    let mit = 0;
    let ohne = 0;
    for (const level of paarLevels(9, 20)) {
      mit += spielen(ohneGrenze(level), true).z.zuege;
      ohne += spielen(ohneGrenze(level), false).z.zuege;
    }
    expect(mit).toBeLessThan(ohne * 0.85);
  });

  it('schafft die tiefen Level mit Blick fast immer innerhalb der Zuggrenze', () => {
    let geschafft = 0;
    const levels = paarLevels(13, 28);
    for (const level of levels) if (spielen(neuesSpiel(level), true).z.gewonnen) geschafft++;
    // Die letzten Level sind knapp (30 Züge für 15 Paare) — das ist gewollt, aber nie unmöglich.
    expect(geschafft).toBeGreaterThanOrEqual(levels.length - 3);
  });
});
