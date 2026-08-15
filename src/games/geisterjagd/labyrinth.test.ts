import { describe, it, expect } from 'vitest';
import { LABYRINTH, ROHES_LABYRINTH, istWand, labyrinthParsen, schluessel } from './labyrinth';

/** Alle begehbaren Felder per Breitensuche vom Spieler-Start aus finden. */
function erreichbareFelder(): Set<string> {
  const start = LABYRINTH.spielerStart;
  const gesehen = new Set([schluessel(start.x, start.y)]);
  const warteschlange: Array<{ x: number; y: number }> = [start];

  while (warteschlange.length > 0) {
    const aktuell = warteschlange.shift()!;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      // Spaltenindex mit Modulo — der Tunnel verbindet die Ränder.
      const x = ((aktuell.x + dx) % LABYRINTH.breite + LABYRINTH.breite) % LABYRINTH.breite;
      const y = aktuell.y + dy;
      if (y < 0 || y >= LABYRINTH.hoehe) continue;
      if (istWand(LABYRINTH, x, y)) continue;
      const s = schluessel(x, y);
      if (gesehen.has(s)) continue;
      gesehen.add(s);
      warteschlange.push({ x, y });
    }
  }
  return gesehen;
}

describe('Labyrinth-Raster', () => {
  it('alle Zeilen sind gleich lang', () => {
    const breite = ROHES_LABYRINTH[0]!.length;
    for (const zeile of ROHES_LABYRINTH) expect(zeile.length).toBe(breite);
  });

  it('hat einen Rand aus Wänden, außer in der Tunnel-Zeile', () => {
    ROHES_LABYRINTH.forEach((zeile, y) => {
      const istTunnelZeile = zeile[0] !== '#';
      if (y === 0 || y === ROHES_LABYRINTH.length - 1) {
        expect(zeile).toBe('#'.repeat(zeile.length));
      } else if (!istTunnelZeile) {
        expect(zeile[0]).toBe('#');
        expect(zeile[zeile.length - 1]).toBe('#');
      }
    });
  });

  it('hat genau eine Tunnel-Zeile (Ränder offen)', () => {
    const tunnelZeilen = ROHES_LABYRINTH.filter((z) => z[0] !== '#');
    expect(tunnelZeilen).toHaveLength(1);
  });
});

describe('labyrinthParsen', () => {
  it('findet Spieler-Start und genau vier Geister-Starts', () => {
    expect(LABYRINTH.spielerStart).toBeDefined();
    expect(LABYRINTH.geisterStarts).toHaveLength(4);
  });

  it('wirft einen Fehler ohne Spieler-Start', () => {
    expect(() => labyrinthParsen(['####', '#GGG', '#GG#', '####'])).toThrow();
  });

  it('wirft einen Fehler bei falscher Geister-Anzahl', () => {
    expect(() => labyrinthParsen(['#####', '#P.G#', '#####'])).toThrow();
  });

  it('zählt Punkte und Kraftpillen korrekt', () => {
    const labyrinth = labyrinthParsen(['######', '#P.oG#', '#GGG.#', '######']);
    expect(labyrinth.punkteStart.size).toBe(2);
    expect(labyrinth.kraftpillenStart.size).toBe(1);
  });
});

describe('Verbindungstest — kein Bereich unerreichbar', () => {
  it('jedes begehbare Feld ist vom Spieler-Start aus erreichbar', () => {
    const erreichbar = erreichbareFelder();
    for (let y = 0; y < LABYRINTH.hoehe; y++) {
      for (let x = 0; x < LABYRINTH.breite; x++) {
        if (!istWand(LABYRINTH, x, y)) {
          expect(erreichbar.has(schluessel(x, y))).toBe(true);
        }
      }
    }
  });

  it('alle vier Geister-Starts sind erreichbar', () => {
    const erreichbar = erreichbareFelder();
    for (const g of LABYRINTH.geisterStarts) {
      expect(erreichbar.has(schluessel(g.x, g.y))).toBe(true);
    }
  });

  it('jede Kraftpille ist erreichbar', () => {
    const erreichbar = erreichbareFelder();
    for (const p of LABYRINTH.kraftpillenStart) {
      expect(erreichbar.has(p)).toBe(true);
    }
  });

  it('der Tunnel verbindet wirklich beide Seiten', () => {
    const erreichbar = erreichbareFelder();
    expect(erreichbar.has(schluessel(0, 10))).toBe(true);
    expect(erreichbar.has(schluessel(LABYRINTH.breite - 1, 10))).toBe(true);
  });
});
