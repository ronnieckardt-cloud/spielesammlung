import { describe, it, expect } from 'vitest';
import { labyrinthParsen } from './labyrinth';
import type { Labyrinth } from './labyrinth';
import {
  STARTLEBEN,
  angstDauerFuerLevel,
  geistRichtungWaehlen,
  gueltigeRichtungen,
  jagdZiel,
  modusDauer,
  neuesSpiel,
  richtungEingeben,
  spielerIntervall,
  streuFaktorFuerLevel,
  streuZiel,
  zeitFortschritt,
  zielFuerGeist,
} from './logik';
import type { Geist, Richtung, Spieler, Zustand } from './logik';

/** Kleines, offenes Testlabyrinth ohne Wände in der Mitte — leicht zu berechnen. */
function offenesLabyrinth(): Labyrinth {
  return labyrinthParsen([
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.....GGGG....#',
    '#.............#',
    '#......P......#',
    '#.............#',
    '#.............#',
    '###############',
  ]);
}

function geist(id: 0 | 1 | 2 | 3, x: number, y: number, teil: Partial<Geist> = {}): Geist {
  return { id, position: { x, y }, richtung: 'up', modus: 'streuen', angstZeitRest: 0, bewegungRest: 1, ...teil };
}

function spieler(x: number, y: number, teil: Partial<Spieler> = {}): Spieler {
  return { position: { x, y }, richtung: 'left', gepuffert: null, bewegungRest: 1, ...teil };
}

describe('gueltigeRichtungen', () => {
  const labyrinth = offenesLabyrinth();

  it('erlaubt alle vier Richtungen mitten im offenen Feld', () => {
    expect(gueltigeRichtungen(labyrinth, { x: 7, y: 5 }, null)).toHaveLength(4);
  });

  it('schließt eine Wand aus', () => {
    // (1,1) hat oben und links eine Wand.
    const richtungen = gueltigeRichtungen(labyrinth, { x: 1, y: 1 }, null);
    expect(richtungen).not.toContain('up');
    expect(richtungen).not.toContain('left');
    expect(richtungen).toContain('down');
    expect(richtungen).toContain('right');
  });

  it('schließt zusätzlich die ausgeschlossene Richtung aus', () => {
    const richtungen = gueltigeRichtungen(labyrinth, { x: 7, y: 5 }, 'up');
    expect(richtungen).not.toContain('up');
    expect(richtungen).toHaveLength(3);
  });
});

describe('streuZiel', () => {
  const labyrinth = offenesLabyrinth();

  it('jeder der vier Geister hat eine andere Ecke', () => {
    const ziele = [0, 1, 2, 3].map((id) => streuZiel(geist(id as 0 | 1 | 2 | 3, 0, 0), labyrinth));
    const schluessel = ziele.map((z) => `${z.x},${z.y}`);
    expect(new Set(schluessel).size).toBe(4);
  });
});

describe('jagdZiel — vier unterschiedliche Taktiken', () => {
  const labyrinth = offenesLabyrinth();
  const s = spieler(7, 5, { richtung: 'right' });

  it('Geist 0 verfolgt die Spielerposition direkt', () => {
    const g0 = geist(0, 1, 1);
    expect(jagdZiel(g0, [g0], s, labyrinth)).toEqual(s.position);
  });

  it('Geist 1 zielt vier Felder vor den Spieler, in dessen Richtung', () => {
    const g1 = geist(1, 1, 1);
    const ziel = jagdZiel(g1, [geist(0, 1, 1), g1], s, labyrinth);
    expect(ziel).toEqual({ x: s.position.x + 4, y: s.position.y });
  });

  it('Geist 1 folgt der Blickrichtung, nicht immer nach rechts', () => {
    const sUp = spieler(7, 5, { richtung: 'up' });
    const g1 = geist(1, 1, 1);
    const ziel = jagdZiel(g1, [geist(0, 1, 1), g1], sUp, labyrinth);
    expect(ziel).toEqual({ x: sUp.position.x, y: sUp.position.y - 4 });
  });

  it('Geist 2 hängt von der Position des ersten Geists ab', () => {
    const g2 = geist(2, 1, 1);
    const geist0Nah = geist(0, 6, 5); // nah am "vor dem Spieler"-Punkt
    const geist0Fern = geist(0, 0, 0); // weit weg
    const zielNah = jagdZiel(g2, [geist0Nah, geist(1, 0, 0), g2], s, labyrinth);
    const zielFern = jagdZiel(g2, [geist0Fern, geist(1, 0, 0), g2], s, labyrinth);
    expect(zielNah).not.toEqual(zielFern);
  });

  it('zieht sich zurück, wenn er nah dran ist, und verfolgt erst aus der Ferne', () => {
    // Klassisches Clyde-Verhalten: aus der Nähe zurückziehen (nicht bedrängen),
    // aus der Ferne direkt verfolgen (Abstand aufholen).
    const nah = geist(3, 8, 5); // ein Feld entfernt
    const fern = geist(3, 0, 0); // weit weg
    expect(jagdZiel(nah, [nah], s, labyrinth)).toEqual(streuZiel(nah, labyrinth));
    expect(jagdZiel(fern, [fern], s, labyrinth)).toEqual(s.position);
  });
});

describe('zielFuerGeist', () => {
  const labyrinth = offenesLabyrinth();
  const s = spieler(7, 5);

  it('im Augen-Modus geht es Richtung Käfigmitte, egal was sonst gilt', () => {
    const g = geist(0, 1, 1, { modus: 'augen' });
    const ziel = zielFuerGeist(g, [g], s, labyrinth);
    // Käfigmitte liegt zwischen den vier G-Startpunkten (5..8, Reihe 4).
    expect(ziel.y).toBe(4);
  });
});

describe('geistRichtungWaehlen', () => {
  it('kehrt an einer Kreuzung nicht um, wenn es eine Alternative gibt', () => {
    const labyrinth = offenesLabyrinth();
    const g = geist(0, 7, 5, { richtung: 'right' });
    // Ziel weit links — ohne die Regel wäre "links" (=Umkehren) die gierige Wahl.
    let umkehrungGesehen = false;
    for (let saat = 0; saat < 50; saat++) {
      const { richtung } = geistRichtungWaehlen(g, labyrinth, { x: 0, y: 5 }, saat);
      if (richtung === 'left') umkehrungGesehen = true;
    }
    expect(umkehrungGesehen).toBe(false);
  });

  it('erlaubt Umkehren in einer echten Sackgasse', () => {
    // (3,3) ist eine Einer-Zelle-Tasche: einziger Nachbar ist (3,4), von wo
    // der Geist gerade hergekommen ist (richtung 'up' = kam von unten).
    const labyrinth = labyrinthParsen([
      '#######',
      '#P....#',
      '#.###.#',
      '#.#G#.#',
      '#.....#',
      '#GGG..#',
      '#######',
    ]);
    const g = geist(0, 3, 3, { richtung: 'up' });
    const { richtung } = geistRichtungWaehlen(g, labyrinth, { x: 0, y: 0 }, 1);
    expect(richtung).toBe('down'); // einzige Option: umkehren
  });

  it('wählt im Angst-Modus zufällig unter den gültigen Richtungen', () => {
    const labyrinth = offenesLabyrinth();
    const g = geist(0, 7, 5, { richtung: 'right', modus: 'angst' });
    const gesehen = new Set<Richtung>();
    let saat = 1;
    for (let i = 0; i < 100; i++) {
      const ergebnis = geistRichtungWaehlen(g, labyrinth, { x: 7, y: 5 }, saat);
      saat = ergebnis.saat;
      gesehen.add(ergebnis.richtung);
    }
    expect(gesehen.size).toBeGreaterThan(1);
  });

  it('wählt sonst gierig die Richtung mit dem kürzesten Abstand zum Ziel', () => {
    const labyrinth = offenesLabyrinth();
    const g = geist(0, 7, 5, { richtung: 'down' }); // kam von oben, darf nicht wieder hoch
    const { richtung } = geistRichtungWaehlen(g, labyrinth, { x: 12, y: 5 }, 1);
    expect(richtung).toBe('right');
  });
});

describe('richtungEingeben', () => {
  it('merkt sich die gewünschte Richtung', () => {
    const z = neuesSpiel(1);
    const nach = richtungEingeben(z, 'up');
    expect(nach.spieler.gepuffert).toBe('up');
  });

  it('tut nichts, wenn das Spiel vorbei ist', () => {
    const z: Zustand = { ...neuesSpiel(1), vorbei: true };
    expect(richtungEingeben(z, 'up')).toBe(z);
  });
});

describe('neuesSpiel', () => {
  it('ist bei gleicher Saat reproduzierbar', () => {
    expect(neuesSpiel(5)).toEqual(neuesSpiel(5));
  });

  it('startet mit vollen Leben, Level 1, nicht vorbei', () => {
    const z = neuesSpiel(1);
    expect(z.leben).toBe(STARTLEBEN);
    expect(z.level).toBe(1);
    expect(z.vorbei).toBe(false);
    expect(z.geister).toHaveLength(4);
  });

  it('Punkte und Kraftpillen entsprechen dem Labyrinth', () => {
    const z = neuesSpiel(1);
    expect(z.punkte.size).toBe(z.labyrinth.punkteStart.size);
    expect(z.kraftpillen.size).toBe(z.labyrinth.kraftpillenStart.size);
  });
});

describe('zeitFortschritt — Spielerbewegung und Fressen', () => {
  it('bewegt den Spieler erst, wenn die Zeit reif ist', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 6, { richtung: 'up', gepuffert: null, bewegungRest: 1 }),
      geister: [0, 1, 2, 3].map((id) => geist(id as 0 | 1 | 2 | 3, 6, 4, { bewegungRest: 1 })),
      punkte: new Set(),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.01);
    expect(nach.spieler.position).toEqual({ x: 7, y: 6 }); // noch nicht bewegt
  });

  it('frisst einen Punkt und zählt ihn zum Score', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 6, { richtung: 'up', bewegungRest: 0.01 }),
      geister: [0, 1, 2, 3].map((id) => geist(id as 0 | 1 | 2 | 3, 0, 0, { bewegungRest: 999 })),
      // Noch ein zweiter Punkt übrig — sonst wäre das Level mit diesem
      // einen Punkt sofort geschafft, und der Spieler würde direkt wieder
      // auf die Startposition zurückgesetzt (siehe eigener Test dafür).
      punkte: new Set(['7,5', '1,1']),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.02);
    expect(nach.spieler.position).toEqual({ x: 7, y: 5 });
    expect(nach.punkte.has('7,5')).toBe(false);
    expect(nach.score).toBe(10);
  });

  it('eine Kraftpille versetzt alle Geister in Angst (außer Augen)', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 6, { richtung: 'up', bewegungRest: 0.01 }),
      geister: [
        geist(0, 0, 0, { modus: 'jagen', bewegungRest: 999 }),
        geist(1, 0, 0, { modus: 'streuen', bewegungRest: 999 }),
        geist(2, 0, 0, { modus: 'augen', bewegungRest: 999 }),
        geist(3, 0, 0, { modus: 'jagen', bewegungRest: 999 }),
      ],
      // Noch ein Punkt übrig, sonst wäre mit der letzten Kraftpille auch
      // gleich das Level fertig, und alles würde zurückgesetzt.
      punkte: new Set(['1,1']),
      kraftpillen: new Set(['7,5']),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.02);
    expect(nach.score).toBe(50);
    expect(nach.geister[0]!.modus).toBe('angst');
    expect(nach.geister[1]!.modus).toBe('angst');
    expect(nach.geister[2]!.modus).toBe('augen'); // Augen bleiben Augen
    expect(nach.geister[3]!.modus).toBe('angst');
  });
});

describe('zeitFortschritt — Kollisionen', () => {
  it('ein ängstlicher Geist wird gefressen und wird zu Augen', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [
        // angstZeitRest muss über die verstrichene Zeit hinausreichen, sonst
        // läuft die Angst noch in derselben Sekunde ab, bevor die Kollision
        // geprüft wird — genau das hatte dieser Test anfangs übersehen.
        geist(0, 7, 5, { modus: 'angst', angstZeitRest: 5, bewegungRest: 999 }),
        geist(1, 0, 0, { bewegungRest: 999 }),
        geist(2, 0, 0, { bewegungRest: 999 }),
        geist(3, 0, 0, { bewegungRest: 999 }),
      ],
      punkte: new Set(),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.001);
    expect(nach.geister[0]!.modus).toBe('augen');
    expect(nach.score).toBe(200);
    expect(nach.vorbei).toBe(false);
  });

  it('sind danach alle vier Geister im Augen-Modus, ist die Runde als Sieg vorbei', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [
        geist(0, 7, 5, { modus: 'angst', angstZeitRest: 5, bewegungRest: 999 }),
        geist(1, 0, 0, { modus: 'augen', bewegungRest: 999 }),
        geist(2, 0, 0, { modus: 'augen', bewegungRest: 999 }),
        geist(3, 0, 0, { modus: 'augen', bewegungRest: 999 }),
      ],
      punkte: new Set(['1,1']),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.001);
    expect(nach.geister[0]!.modus).toBe('augen');
    expect(nach.vorbei).toBe(true);
    expect(nach.gewonnen).toBe(true);
    expect(nach.score).toBe(200 + 1000);
  });

  it('bleiben nicht alle Geister gleichzeitig im Augen-Modus, geht die Runde normal weiter', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [
        geist(0, 7, 5, { modus: 'angst', angstZeitRest: 5, bewegungRest: 999 }),
        geist(1, 0, 0, { modus: 'streuen', bewegungRest: 999 }),
        geist(2, 0, 0, { modus: 'augen', bewegungRest: 999 }),
        geist(3, 0, 0, { modus: 'augen', bewegungRest: 999 }),
      ],
      punkte: new Set(['1,1']),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.001);
    expect(nach.vorbei).toBe(false);
    expect(nach.gewonnen).toBe(false);
  });

  it('ein jagender Geist kostet ein Leben und setzt Positionen zurück', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [
        geist(0, 7, 5, { modus: 'jagen', bewegungRest: 999 }),
        geist(1, 0, 0, { bewegungRest: 999 }),
        geist(2, 0, 0, { bewegungRest: 999 }),
        geist(3, 0, 0, { bewegungRest: 999 }),
      ],
      punkte: new Set(),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.001);
    expect(nach.leben).toBe(STARTLEBEN - 1);
    expect(nach.spieler.position).toEqual(labyrinth.spielerStart);
    expect(nach.vorbei).toBe(false);
  });

  it('das letzte Leben beendet das Spiel', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [
        geist(0, 7, 5, { modus: 'jagen', bewegungRest: 999 }),
        geist(1, 0, 0, { bewegungRest: 999 }),
        geist(2, 0, 0, { bewegungRest: 999 }),
        geist(3, 0, 0, { bewegungRest: 999 }),
      ],
      punkte: new Set(),
      kraftpillen: new Set(),
      score: 0,
      leben: 1,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.001);
    expect(nach.leben).toBe(0);
    expect(nach.vorbei).toBe(true);
  });

  it('frontal aneinander vorbei geht nicht — der Tausch der Felder ist ein Treffer', () => {
    // Der Fehler, den dieser Test festhält: Spieler und Geist liefen im
    // selben Takt aufeinander zu und tauschten die Felder. Danach stand
    // keiner mehr auf dem Feld des anderen — geprüft wurde aber nur die
    // Endstellung, also lief man mitten durch den Geist hindurch, ohne ein
    // Leben zu verlieren.
    const labyrinth = labyrinthParsen([
      '###########',
      '#P.......G#',
      '#.........#',
      '#GGG......#',
      '###########',
    ]);
    const z: Zustand = {
      labyrinth,
      // Beide sind im selben Takt dran und schauen sich an: Spieler (5,1)
      // nach rechts, Geist (6,1) jagend nach links.
      spieler: spieler(5, 1, { richtung: 'right', bewegungRest: 0.001 }),
      geister: [
        geist(0, 6, 1, { modus: 'jagen', richtung: 'left', bewegungRest: 0.001 }),
        geist(1, 1, 3, { bewegungRest: 999 }),
        geist(2, 2, 3, { bewegungRest: 999 }),
        geist(3, 3, 3, { bewegungRest: 999 }),
      ],
      punkte: new Set(labyrinth.punkteStart),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.002);
    expect(nach.leben).toBe(STARTLEBEN - 1);
    expect(nach.spieler.position).toEqual(labyrinth.spielerStart);
  });

  it('Augen tun dem Spieler nichts', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [
        geist(0, 7, 5, { modus: 'augen', bewegungRest: 999 }),
        geist(1, 0, 0, { bewegungRest: 999 }),
        geist(2, 0, 0, { bewegungRest: 999 }),
        geist(3, 0, 0, { bewegungRest: 999 }),
      ],
      punkte: new Set(),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.001);
    expect(nach.leben).toBe(STARTLEBEN);
  });
});

describe('zeitFortschritt — Modus-Zeittabelle', () => {
  it('wechselt nach Ablauf der Zeit von Streuen zu Jagen und lässt Geister umkehren', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 5, { bewegungRest: 999 }),
      geister: [geist(0, 1, 1, { modus: 'streuen', richtung: 'right', bewegungRest: 999 })],
      punkte: new Set(),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 0.01,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.02);
    expect(nach.modusPhase).toBe(1);
    expect(nach.geister[0]!.modus).toBe('jagen');
    expect(nach.geister[0]!.richtung).toBe('left'); // umgekehrt
  });
});

describe('zeitFortschritt — Level abgeschlossen', () => {
  it('bei leerem Labyrinth beginnt sofort das nächste Level', () => {
    const labyrinth = offenesLabyrinth();
    const z: Zustand = {
      labyrinth,
      spieler: spieler(7, 6, { richtung: 'up', bewegungRest: 0.01 }),
      geister: [0, 1, 2, 3].map((id) => geist(id as 0 | 1 | 2 | 3, 0, 0, { bewegungRest: 999 })),
      punkte: new Set(['7,5']), // letzter verbleibender Punkt
      kraftpillen: new Set(),
      score: 100,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 5,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.02);
    expect(nach.level).toBe(2);
    expect(nach.punkte.size).toBe(labyrinth.punkteStart.size); // neu befüllt
    expect(nach.score).toBe(110); // Punktestand bleibt erhalten
    expect(nach.modusPhase).toBe(0); // Modus-Zeittabelle beginnt von vorn
  });
});

describe('Schwierigkeit über Level 6 hinaus', () => {
  it('das Tempo ist ab Level 6 am Anschlag — genau das war der Anlass', () => {
    expect(spielerIntervall(10)).toBe(spielerIntervall(6));
  });

  it('die Angst-Dauer sinkt mit dem Level und bleibt bei drei Sekunden stehen', () => {
    expect(angstDauerFuerLevel(1)).toBeCloseTo(8);
    expect(angstDauerFuerLevel(6)).toBeCloseTo(4.5);
    expect(angstDauerFuerLevel(9)).toBeCloseTo(3);
    expect(angstDauerFuerLevel(30)).toBeCloseTo(3); // Deckel, geht nicht tiefer
  });

  it('die Streuen-Phasen werden ab Level 5 kürzer, die Jagd-Phasen nicht', () => {
    expect(streuFaktorFuerLevel(4)).toBeCloseTo(1); // bis Level 4 unverändert
    expect(modusDauer(0, 1)).toBeCloseTo(7); // Phase 0 ist Streuen
    expect(modusDauer(0, 5)).toBeCloseTo(7 * 0.85);
    expect(modusDauer(0, 8)).toBeCloseTo(7 * 0.4); // Deckel
    expect(modusDauer(0, 30)).toBeCloseTo(7 * 0.4);

    expect(modusDauer(1, 1)).toBe(20); // Phase 1 ist Jagen …
    expect(modusDauer(1, 30)).toBe(20); // … und bleibt gleich lang
  });

  it('keine der beiden Stellschrauben geht je zurück', () => {
    for (let level = 2; level <= 30; level++) {
      expect(angstDauerFuerLevel(level)).toBeLessThanOrEqual(angstDauerFuerLevel(level - 1));
      expect(modusDauer(0, level)).toBeLessThanOrEqual(modusDauer(0, level - 1));
    }
  });

  it('zwischen Level 6 und Level 10 wird es tatsächlich noch schwerer', () => {
    expect(angstDauerFuerLevel(10)).toBeLessThan(angstDauerFuerLevel(6));
    expect(modusDauer(0, 10)).toBeLessThan(modusDauer(0, 6));
  });

  it('eine Kraftpille macht die Geister im höheren Level kürzer ängstlich', () => {
    const labyrinth = offenesLabyrinth();
    const basis: Zustand = {
      labyrinth,
      spieler: spieler(7, 6, { richtung: 'up', bewegungRest: 0.01 }),
      geister: [0, 1, 2, 3].map((id) => geist(id as 0 | 1 | 2 | 3, 0, 0, { modus: 'jagen', bewegungRest: 999 })),
      punkte: new Set(['1,1']), // damit das Level nicht sofort fertig ist
      kraftpillen: new Set(['7,5']),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const stufe1 = zeitFortschritt(basis, 0.02);
    const stufe10 = zeitFortschritt({ ...basis, level: 10 }, 0.02);
    expect(stufe10.geister[0]!.angstZeitRest).toBeLessThan(stufe1.geister[0]!.angstZeitRest);
  });
});

describe('Tunnel', () => {
  it('läuft am linken Rand nach rechts weiter und umgekehrt', () => {
    const labyrinth = labyrinthParsen(['#######', '.P...G.', '#GGG###', '#######']);
    const z: Zustand = {
      labyrinth,
      spieler: spieler(0, 1, { richtung: 'left', bewegungRest: 0.01 }),
      geister: [geist(0, 3, 1, { bewegungRest: 999 })],
      // Ein Punkt muss übrig bleiben, sonst gilt das Level als sofort
      // geschafft und alles wird zurückgesetzt, bevor der Tunnel zählt.
      punkte: new Set(['5,2']),
      kraftpillen: new Set(),
      score: 0,
      leben: STARTLEBEN,
      level: 1,
      modusPhase: 0,
      modusZeitRest: 999,
      vorbei: false,
      gewonnen: false,
      saat: 1,
    };
    const nach = zeitFortschritt(z, 0.02);
    expect(nach.spieler.position.x).toBe(6); // am rechten Rand wieder aufgetaucht (Breite 7)
  });
});
