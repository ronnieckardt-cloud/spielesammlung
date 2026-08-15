import { describe, it, expect } from 'vitest';
import {
  extraRoehrchenFuerLevel,
  farbenFuerLevel,
  istGeloest,
  leereRoehrchenFuerLevel,
  loesbar,
  neuesLevel,
} from './logik';

/**
 * Die Schwierigkeit muss über Level 5 hinaus weiter steigen. Vorher war die
 * Farbzahl ab Level 5 gedeckelt und danach änderte sich nichts mehr.
 */
describe('Schwierigkeitsverlauf', () => {
  it('gibt ab Level 8 nur noch ein leeres Röhrchen', () => {
    expect(leereRoehrchenFuerLevel(1)).toBe(2);
    expect(leereRoehrchenFuerLevel(7)).toBe(2);
    expect(leereRoehrchenFuerLevel(8)).toBe(1);
    expect(leereRoehrchenFuerLevel(30)).toBe(1);
  });

  it('nimmt ab Level 15 die Notbremse weg', () => {
    expect(extraRoehrchenFuerLevel(1)).toBe(1);
    expect(extraRoehrchenFuerLevel(14)).toBe(1);
    expect(extraRoehrchenFuerLevel(15)).toBe(0);
  });

  it('wird zwischen Level 1 und 30 nie leichter', () => {
    let vorigeFarben = 0;
    let vorigeLeere = Infinity;
    for (let level = 1; level <= 30; level++) {
      const farben = farbenFuerLevel(level);
      const leere = leereRoehrchenFuerLevel(level);
      expect(farben).toBeGreaterThanOrEqual(vorigeFarben);
      expect(leere).toBeLessThanOrEqual(vorigeLeere);
      vorigeFarben = farben;
      vorigeLeere = leere;
    }
  });

  it('ändert sich zwischen Level 5 und 20 spürbar', () => {
    const bei = (l: number) =>
      `${farbenFuerLevel(l)}/${leereRoehrchenFuerLevel(l)}/${extraRoehrchenFuerLevel(l)}`;
    expect(bei(5)).not.toBe(bei(20));
  });

  it('erzeugt für Level 1 bis 30 lösbare Bretter mit der richtigen Röhrchenzahl', () => {
    for (let level = 1; level <= 30; level++) {
      const z = neuesLevel(level);
      expect(z.roehrchen).toHaveLength(farbenFuerLevel(level) + leereRoehrchenFuerLevel(level));
      expect(istGeloest(z.roehrchen)).toBe(false);
      expect(loesbar(z.roehrchen), `Level ${level} ist nicht lösbar`).toBe(true);
    }
  }, 60000);

  it('gleiche Levelnummer ergibt weiterhin dasselbe Rätsel', () => {
    expect(neuesLevel(9)).toEqual(neuesLevel(9));
    expect(neuesLevel(20)).toEqual(neuesLevel(20));
  });
});
