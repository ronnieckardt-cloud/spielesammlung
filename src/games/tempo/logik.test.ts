import { describe, expect, it } from 'vitest';
import {
  DAUERN,
  TEMPO_FENSTER,
  bewertung,
  neuesSpiel,
  punkte,
  rest,
  stufeFuerTempo,
  takt,
  tempo,
  tippen,
} from './logik';
import type { Zustand } from './logik';

/** Tippt `proSekunde`-mal je Sekunde, `sekunden` lang. */
function tippenMit(z: Zustand, proSekunde: number, sekunden: number): Zustand {
  const dt = 1 / 60;
  let seitLetztem = 0;
  for (let t = 0; t < sekunden && !z.vorbei; t += dt) {
    seitLetztem += dt;
    if (seitLetztem >= 1 / proSekunde) {
      z = tippen(z);
      seitLetztem = 0;
    }
    z = takt(z, dt);
  }
  return z;
}

describe('neuesSpiel', () => {
  it('startet leer und ohne laufende Uhr', () => {
    const z = neuesSpiel(10);
    expect(z.tipps).toBe(0);
    expect(z.laeuft).toBe(false);
    expect(z.vorbei).toBe(false);
    expect(rest(z)).toBe(10);
  });
});

describe('Die Uhr', () => {
  /**
   * Der wichtigste Punkt am ganzen Ablauf: Wer das Spiel öffnet und sich
   * erst zurechtsetzt, darf keine Zeit verlieren. Bei fünf Sekunden wäre
   * das sonst die halbe Runde.
   */
  it('steht still, bis der erste Tipp kommt', () => {
    let z = neuesSpiel(5);
    for (let i = 0; i < 300; i++) z = takt(z, 1 / 60);
    expect(z.zeit).toBe(0);
    expect(rest(z)).toBe(5);
    expect(z.vorbei).toBe(false);
  });

  it('läuft ab dem ersten Tipp', () => {
    let z = tippen(neuesSpiel(5));
    z = takt(z, 1);
    expect(z.zeit).toBeCloseTo(1, 6);
    expect(rest(z)).toBeCloseTo(4, 6);
  });

  it('beendet die Runde nach der gewählten Zeit', () => {
    const z = tippenMit(neuesSpiel(2), 5, 4);
    expect(z.vorbei).toBe(true);
  });

  it('zeigt am Ende nie eine negative Restzeit', () => {
    let z = tippen(neuesSpiel(2));
    z = takt(z, 99);
    expect(rest(z)).toBe(0);
    expect(z.zeit).toBe(2);
  });

  it('nimmt nach dem Ende keine Tipps mehr an', () => {
    const vorbei = tippenMit(neuesSpiel(1), 8, 2);
    expect(vorbei.vorbei).toBe(true);
    expect(tippen(vorbei)).toBe(vorbei);
    expect(takt(vorbei, 1)).toBe(vorbei);
  });
});

describe('tempo', () => {
  it('ist ohne Tipps null', () => {
    expect(tempo(neuesSpiel(10))).toBe(0);
  });

  it('misst ungefähr das, was getippt wurde', () => {
    const z = tippenMit(neuesSpiel(10), 6, 4);
    expect(tempo(z)).toBeGreaterThan(4.5);
    expect(tempo(z)).toBeLessThan(7.5);
  });

  it('sinkt wieder, wenn man aufhört', () => {
    let z = tippenMit(neuesSpiel(30), 8, 3);
    expect(tempo(z)).toBeGreaterThan(5);
    // Zwei Sekunden nichts tun — das Fenster ist dann leer.
    for (let i = 0; i < 120; i++) z = takt(z, 1 / 60);
    expect(tempo(z)).toBe(0);
  });

  it('wirft alte Tipps aus dem Fenster', () => {
    let z = tippenMit(neuesSpiel(30), 10, 5);
    // Nie mehr Einträge, als ins Fenster passen — sonst wüchse die Liste
    // über eine Minute hinweg auf mehrere hundert Einträge.
    expect(z.letzte.length).toBeLessThanOrEqual(Math.ceil(10 * TEMPO_FENSTER) + 2);
    for (let i = 0; i < 120; i++) z = takt(z, 1 / 60);
    expect(z.letzte).toHaveLength(0);
  });

  it('übertreibt beim allerersten Tipp nicht', () => {
    // Ein einzelner Tipp nach einer Millisekunde darf kein Tempo von
    // tausend ergeben.
    let z = tippen(neuesSpiel(10));
    z = takt(z, 0.001);
    expect(tempo(z)).toBe(0);
  });
});

describe('stufeFuerTempo', () => {
  it('geht von Rot über Grün und Blau bis zum Regenbogen', () => {
    expect(stufeFuerTempo(0)).toBe('rot');
    expect(stufeFuerTempo(1.5)).toBe('rot');
    expect(stufeFuerTempo(3)).toBe('gruen');
    expect(stufeFuerTempo(5.5)).toBe('blau');
    expect(stufeFuerTempo(9)).toBe('regenbogen');
  });

  it('steigt lückenlos und springt nie zurück', () => {
    const reihenfolge = ['rot', 'gruen', 'blau', 'regenbogen'];
    let letzter = 0;
    for (let t = 0; t <= 12; t += 0.05) {
      const jetzt = reihenfolge.indexOf(stufeFuerTempo(t));
      expect(jetzt).toBeGreaterThanOrEqual(letzter);
      letzter = jetzt;
    }
    expect(letzter).toBe(3);
  });
});

describe('punkte', () => {
  /**
   * Ohne das Umrechnen gewönne in der Bestenliste immer, wer die Minute
   * gewählt hat — die Liste sagte dann nur aus, wer am längsten gespielt
   * hat, nicht wer am schnellsten ist.
   */
  it('macht alle vier Rundenlängen vergleichbar', () => {
    // Fünf Tipps je Sekunde, egal wie lange: immer dieselbe Punktzahl.
    for (const dauer of DAUERN) {
      expect(punkte(5 * dauer, dauer)).toBe(50);
    }
  });

  it('belohnt schnelleres Tippen', () => {
    expect(punkte(80, 10)).toBeGreaterThan(punkte(40, 10));
  });

  it('bleibt bei null Tipps null', () => {
    expect(punkte(0, 10)).toBe(0);
  });
});

describe('bewertung', () => {
  it('sagt zu jeder Stufe etwas anderes', () => {
    const texte = new Set(
      (['rot', 'gruen', 'blau', 'regenbogen'] as const).map((s) => bewertung(s)),
    );
    expect(texte.size).toBe(4);
  });
});
