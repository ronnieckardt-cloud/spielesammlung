import { describe, it, expect } from 'vitest';
import { labyrinthParsen } from './labyrinth';
import { STARTLEBEN, zeitFortschritt } from './logik';
import type { Geist, Spieler, Zustand } from './logik';

/** Ein einziger waagerechter Gang — dort gibt es nur links und rechts. */
function gang() {
  return labyrinthParsen(['###########', '#.GGGGP...#', '###########']);
}

function geist(id: 0 | 1 | 2 | 3, x: number, y: number, teil: Partial<Geist> = {}): Geist {
  return { id, position: { x, y }, richtung: 'up', modus: 'streuen', angstZeitRest: 0, bewegungRest: 1, ...teil };
}
function spieler(x: number, y: number, teil: Partial<Spieler> = {}): Spieler {
  return { position: { x, y }, richtung: 'left', gepuffert: null, bewegungRest: 1, ...teil };
}

describe('Durchtausch-Probe', () => {
  it('Spieler laeuft frontal durch einen jagenden Geist hindurch', () => {
    const labyrinth = gang();
    const z: Zustand = {
      labyrinth,
      // Spieler (7,1) laeuft nach links, Geist (6,1) jagt nach rechts.
      spieler: spieler(7, 1, { richtung: 'left', bewegungRest: 0.001 }),
      geister: [
        geist(0, 6, 1, { modus: 'jagen', richtung: 'right', bewegungRest: 0.001 }),
        geist(1, 2, 1, { bewegungRest: 999 }),
        geist(2, 2, 1, { bewegungRest: 999 }),
        geist(3, 2, 1, { bewegungRest: 999 }),
      ],
      punkte: new Set(['1,1']),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 1,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.002);
    // eslint-disable-next-line no-console
    console.log('ERGEBNIS Spieler', nach.spieler.position, 'Geist0', nach.geister[0]!.position, 'Leben', nach.leben);
    expect(nach.leben).toBe(STARTLEBEN);
  });
});
