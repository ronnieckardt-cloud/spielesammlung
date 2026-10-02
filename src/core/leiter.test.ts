import { describe, it, expect } from 'vitest';
import {
  ANRUF_TREFFER,
  JOKER_ARTEN,
  PREISE,
  PUBLIKUM_TREFFER,
  SICHERE_STUFEN,
  STUFEN,
  anrufUrteil,
  antwortenMischen,
  aufhoeren,
  aufloesen,
  darfAufhoeren,
  einloggen,
  fragenAusPool,
  fragenSchluessel,
  gewinnNach,
  halbWeg,
  jokerFrei,
  jokerNutzen,
  markieren,
  neueRunde,
  pruefeFrage,
  publikumsUrteil,
  punkte,
  schwereAnStufe,
  sichererGewinn,
  sicherJetzt,
  weiter,
} from './leiter';
import type { LeiterFrage, Zustand } from './leiter';

/** Eine Frage, deren richtige Antwort am Text „richtig" zu erkennen ist — das macht die Tests lesbar. */
function frage(nr: number, schwere: 1 | 2 | 3 | 4 | 5, richtig: 0 | 1 | 2 | 3 = 0): LeiterFrage {
  const antworten = [`falsch a ${nr}`, `falsch b ${nr}`, `falsch c ${nr}`, `falsch d ${nr}`] as unknown as LeiterFrage['antworten'];
  (antworten as unknown as string[])[richtig] = `richtig ${nr}`;
  return { kategorie: 'Test', frage: `Frage ${nr}?`, antworten, richtig, erklaerung: 'Eine kurze, aber ausreichende Erklärung.', schwere };
}

function pool(jeSchwere: number): LeiterFrage[] {
  const liste: LeiterFrage[] = [];
  let nr = 0;
  for (const s of [1, 2, 3, 4, 5] as const) for (let i = 0; i < jeSchwere; i++) liste.push(frage(nr++, s, (nr % 4) as 0 | 1 | 2 | 3));
  return liste;
}

function fuenfzehn(): LeiterFrage[] {
  return Array.from({ length: STUFEN }, (_, i) => frage(i, schwereAnStufe(i), (i % 4) as 0 | 1 | 2 | 3));
}

/** Eine Runde mit lauter Fragen, deren erste Antwort richtig ist — vor dem Mischen. */
function runde(level = 1): Zustand {
  return neueRunde(level, 'test', fuenfzehn());
}

/** Gibt auf die aktuelle Frage eine Antwort und löst auf. */
function antworten(z: Zustand, richtig: boolean): Zustand {
  const f = z.fragen[z.stufe]!;
  const index = richtig ? f.richtig : ([0, 1, 2, 3].find((i) => i !== f.richtig && !z.weg.includes(i)) as number);
  return aufloesen(einloggen(markieren(z, index)));
}

describe('Preise und Stufen', () => {
  it('hat fünfzehn Stufen, die Preise steigen streng', () => {
    expect(PREISE).toHaveLength(STUFEN);
    for (let i = 1; i < PREISE.length; i++) expect(PREISE[i]!).toBeGreaterThan(PREISE[i - 1]!);
  });

  it('der höchste Preis passt unter die Obergrenze des Servers (100.000 in spiel_katalog, 1.000.000 im Duell)', () => {
    expect(PREISE[PREISE.length - 1]).toBeLessThanOrEqual(100_000);
  });

  it('kein Preis springt um mehr als das Doppelte — sonst fliegt jede Bestleistung als verdächtig raus', () => {
    // Der Server markiert ein Ergebnis über dem Dreifachen der bisherigen Bestleistung.
    for (let i = 1; i < PREISE.length; i++) expect(PREISE[i]! / PREISE[i - 1]!).toBeLessThanOrEqual(2);
  });

  it('je drei Fragen eine Schwere, die fünf Schweren decken alle fünfzehn Stufen', () => {
    expect(Array.from({ length: STUFEN }, (_, i) => schwereAnStufe(i))).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  });

  it('der Gewinn nach n richtigen Antworten ist der Preis der n-ten Stufe', () => {
    expect(gewinnNach(0)).toBe(0);
    expect(gewinnNach(1)).toBe(PREISE[0]);
    expect(gewinnNach(15)).toBe(PREISE[14]);
    expect(gewinnNach(99)).toBe(PREISE[14]);
  });

  it('eine falsche Antwort wirft auf die letzte erreichte Sicherheitsstufe zurück', () => {
    expect(SICHERE_STUFEN).toEqual([5, 10]);
    expect(sichererGewinn(0)).toBe(0);
    expect(sichererGewinn(4)).toBe(0);
    expect(sichererGewinn(5)).toBe(PREISE[4]);
    expect(sichererGewinn(9)).toBe(PREISE[4]);
    expect(sichererGewinn(10)).toBe(PREISE[9]);
    expect(sichererGewinn(14)).toBe(PREISE[9]);
  });
});

describe('Fragenauswahl', () => {
  const alle = pool(40);

  it('gibt genau so viele Fragen der gewünschten Schwere zurück', () => {
    const gezogen = fragenAusPool(alle, 'test', 1, 3, 3);
    expect(gezogen).toHaveLength(3);
    for (const f of gezogen) expect(f.schwere).toBe(3);
  });

  it('gleiches Level ergibt dieselben Fragen, ein anderes Level andere', () => {
    expect(fragenAusPool(alle, 'test', 7, 2, 3)).toEqual(fragenAusPool(alle, 'test', 7, 2, 3));
    expect(fragenAusPool(alle, 'test', 7, 2, 3)).not.toEqual(fragenAusPool(alle, 'test', 8, 2, 3));
  });

  it('die Reihenfolge der Fragen im Pool ist ohne Einfluss', () => {
    const umgekehrt = [...alle].reverse();
    expect(fragenAusPool(umgekehrt, 'test', 5, 4, 3)).toEqual(fragenAusPool(alle, 'test', 5, 4, 3));
  });

  it('die Level eines Durchgangs wiederholen keine Frage', () => {
    // 40 Fragen je Schwere, drei je Level: 13 Level ohne Wiederholung.
    const gesehen = new Set<string>();
    for (let level = 1; level <= 13; level++) {
      for (const f of fragenAusPool(alle, 'test', level, 5, 3)) {
        expect(gesehen.has(f.frage), `Level ${level}: „${f.frage}" schon vorgekommen`).toBe(false);
        gesehen.add(f.frage);
      }
    }
  });

  it('danach fängt ein neuer Durchgang an — mit anderer Mischung', () => {
    expect(fragenAusPool(alle, 'test', 14, 5, 3)).not.toEqual(fragenAusPool(alle, 'test', 1, 5, 3));
  });

  it('ein zu kleiner Pool stürzt nicht ab, sondern füllt von vorn auf', () => {
    const klein = pool(2);
    expect(fragenAusPool(klein, 'test', 1, 1, 3)).toHaveLength(3);
    expect(fragenAusPool([], 'test', 1, 1, 3)).toEqual([]);
  });

  it('Fragen lassen sich von der Auswahl ausnehmen', () => {
    const erste = fragenAusPool(alle, 'test', 1, 1, 3);
    const ohne = fragenAusPool(alle, 'test', 1, 1, 3, new Set(erste.map(fragenSchluessel)));
    for (const f of ohne) expect(erste.map((e) => e.frage)).not.toContain(f.frage);
  });

  it('Fragen mit gleichem Text, aber anderen Antworten sind verschiedene Fragen (Word Play stellt neunzig Mal dieselbe Frage)', () => {
    const gleicherText = Array.from({ length: 30 }, (_, i) => ({ ...frage(i, 2), frage: 'Welches Wort ist richtig geschrieben?', antworten: [`a${i}`, `b${i}`, `c${i}`, `d${i}`] as unknown as LeiterFrage['antworten'] }));
    const erste = fragenAusPool(gleicherText, 'test', 1, 2, 3);
    // Ein Ausschluss über den Text allein würde hier **alle** Fragen sperren.
    const weitere = fragenAusPool(gleicherText, 'test', 1, 2, 3, new Set(erste.map(fragenSchluessel)));
    expect(weitere).toHaveLength(3);
    for (const f of weitere) expect(erste.map(fragenSchluessel)).not.toContain(fragenSchluessel(f));
  });

  it('die Reihenfolge im Pool ist auch bei gleichem Fragetext ohne Einfluss', () => {
    const gleicherText = Array.from({ length: 30 }, (_, i) => ({ ...frage(i, 2), frage: 'Dieselbe Frage?', antworten: [`a${i}`, `b${i}`, `c${i}`, `d${i}`] as unknown as LeiterFrage['antworten'] }));
    expect(fragenAusPool([...gleicherText].reverse(), 'test', 3, 2, 3)).toEqual(fragenAusPool(gleicherText, 'test', 3, 2, 3));
  });
});

describe('Antworten mischen', () => {
  it('bewahrt, welche Antwort richtig ist', () => {
    const gemischt = antwortenMischen(fuenfzehn(), 12345);
    gemischt.forEach((f, i) => {
      expect(f.antworten[f.richtig]).toBe(`richtig ${i}`);
      expect(new Set(f.antworten).size).toBe(4);
    });
  });

  it('ist bei gleicher Saat gleich, bei anderer verschieden', () => {
    expect(antwortenMischen(fuenfzehn(), 1)).toEqual(antwortenMischen(fuenfzehn(), 1));
    expect(antwortenMischen(fuenfzehn(), 1)).not.toEqual(antwortenMischen(fuenfzehn(), 2));
  });

  it('verteilt die richtige Antwort über alle vier Plätze', () => {
    const plaetze = [0, 0, 0, 0];
    for (let saat = 1; saat <= 40; saat++) for (const f of antwortenMischen(fuenfzehn(), saat)) plaetze[f.richtig]!++;
    for (const n of plaetze) expect(n).toBeGreaterThan(100);
  });

  it('verändert die übergebenen Fragen nicht', () => {
    const original = fuenfzehn();
    const kopie = JSON.stringify(original);
    antwortenMischen(original, 99);
    expect(JSON.stringify(original)).toBe(kopie);
  });
});

describe('Ablauf einer Runde', () => {
  it('beginnt bei Stufe 0 mit allen drei Jokern und null Punkten', () => {
    const z = runde();
    expect(z.stufe).toBe(0);
    expect(z.joker).toEqual({ halb: true, publikum: true, anruf: true });
    expect(punkte(z)).toBe(0);
    expect(z.vorbei).toBe(false);
  });

  it('eine Antwort wird erst markiert, dann eingeloggt, dann aufgelöst', () => {
    let z = runde();
    const f = z.fragen[0]!;
    z = markieren(z, f.richtig);
    expect(z.markiert).toBe(f.richtig);
    expect(z.eingeloggt).toBe(false);
    z = einloggen(z);
    expect(z.eingeloggt).toBe(true);
    expect(z.aufgeloest).toBe(false);
    z = aufloesen(z);
    expect(z.aufgeloest).toBe(true);
    expect(z.ausgang).toBe('richtig');
    expect(z.erreicht).toBe(1);
  });

  it('ohne Markierung gibt es nichts einzuloggen, und die Markierung lässt sich ändern', () => {
    let z = runde();
    expect(einloggen(z)).toBe(z);
    z = markieren(z, 1);
    z = markieren(z, 2);
    expect(z.markiert).toBe(2);
  });

  it('nach dem Einloggen ist die Antwort endgültig', () => {
    let z = markieren(runde(), 1);
    z = einloggen(z);
    expect(markieren(z, 2)).toBe(z);
    expect(einloggen(z)).toBe(z);
  });

  it('aufgelöst wird nur, was eingeloggt ist, und nur einmal', () => {
    const z = runde();
    expect(aufloesen(z)).toBe(z);
    const fertig = antworten(z, true);
    expect(aufloesen(fertig)).toBe(fertig);
    expect(fertig.erreicht).toBe(1);
  });

  it('weiter geht erst nach der Auflösung und setzt alles für die nächste Frage zurück', () => {
    let z = runde();
    expect(weiter(z)).toBe(z);
    z = jokerNutzen(z, 'halb');
    z = jokerNutzen(z, 'publikum');
    z = jokerNutzen(z, 'anruf');
    z = weiter(antworten(z, true));
    expect(z.stufe).toBe(1);
    expect(z.markiert).toBeNull();
    expect(z.eingeloggt).toBe(false);
    expect(z.aufgeloest).toBe(false);
    expect(z.weg).toEqual([]);
    expect(z.publikum).toBeNull();
    expect(z.anruf).toBeNull();
    // Die Joker bleiben verbraucht.
    expect(z.joker).toEqual({ halb: false, publikum: false, anruf: false });
  });

  it('der Gewinn wächst mit jeder richtigen Antwort', () => {
    let z = runde();
    for (let i = 1; i <= 7; i++) {
      z = antworten(z, true);
      expect(punkte(z)).toBe(PREISE[i - 1]);
      z = weiter(z);
    }
  });

  it('eine falsche Antwort beendet die Runde nach „Weiter" und wirft auf die Sicherheitsstufe zurück', () => {
    let z = runde();
    for (let i = 0; i < 7; i++) z = weiter(antworten(z, true));
    expect(punkte(z)).toBe(PREISE[6]);
    z = antworten(z, false);
    expect(z.ausgang).toBe('falsch');
    expect(punkte(z)).toBe(PREISE[4]);
    expect(z.vorbei).toBe(false);
    z = weiter(z);
    expect(z.vorbei).toBe(true);
    expect(punkte(z)).toBe(PREISE[4]);
  });

  it('vor der ersten Sicherheitsstufe bleibt bei einer falschen Antwort nichts', () => {
    let z = runde();
    for (let i = 0; i < 3; i++) z = weiter(antworten(z, true));
    z = weiter(antworten(z, false));
    expect(z.vorbei).toBe(true);
    expect(punkte(z)).toBe(0);
  });

  it('sicherJetzt nennt, was eine falsche Antwort kosten würde', () => {
    let z = runde();
    expect(sicherJetzt(z)).toBe(0);
    for (let i = 0; i < 5; i++) z = weiter(antworten(z, true));
    expect(sicherJetzt(z)).toBe(PREISE[4]);
  });

  it('alle fünfzehn richtig gewinnt und gibt den höchsten Preis', () => {
    let z = runde();
    for (let i = 0; i < STUFEN; i++) {
      expect(z.vorbei).toBe(false);
      z = weiter(antworten(z, true));
    }
    expect(z.vorbei).toBe(true);
    expect(z.gewonnen).toBe(true);
    expect(punkte(z)).toBe(PREISE[STUFEN - 1]);
  });

  it('„gewonnen" wird erst bei der fünfzehnten richtigen Antwort gesetzt', () => {
    let z = runde();
    for (let i = 0; i < STUFEN - 1; i++) {
      z = weiter(antworten(z, true));
      expect(z.gewonnen).toBe(false);
    }
    z = antworten(z, true);
    expect(z.gewonnen).toBe(true);
  });

  it('nach dem Ende tut nichts mehr etwas', () => {
    const z = weiter(antworten(runde(), false));
    expect(z.vorbei).toBe(true);
    expect(markieren(z, 0)).toBe(z);
    expect(einloggen(z)).toBe(z);
    expect(jokerNutzen(z, 'halb')).toBe(z);
    expect(aufhoeren(z)).toBe(z);
    expect(weiter(z)).toBe(z);
  });
});

describe('Aufhören', () => {
  it('geht erst, wenn schon etwas zu behalten ist', () => {
    const z = runde();
    expect(darfAufhoeren(z)).toBe(false);
    expect(aufhoeren(z)).toBe(z);
    expect(darfAufhoeren(weiter(antworten(z, true)))).toBe(true);
  });

  it('behält den Gewinn und zeigt die Auflösung, danach ist die Runde vorbei', () => {
    let z = runde();
    for (let i = 0; i < 7; i++) z = weiter(antworten(z, true));
    z = aufhoeren(z);
    expect(z.aufgeloest).toBe(true);
    expect(z.ausgang).toBe('aufgehoert');
    expect(z.vorbei).toBe(false);
    // Aufhören fällt nicht auf die Sicherheitsstufe zurück — das ist der Sinn davon.
    expect(punkte(z)).toBe(PREISE[6]);
    z = weiter(z);
    expect(z.vorbei).toBe(true);
    expect(punkte(z)).toBe(PREISE[6]);
    expect(z.gewonnen).toBe(false);
  });

  it('geht nicht mehr, wenn die Antwort schon eingeloggt ist', () => {
    let z = weiter(antworten(runde(), true));
    z = einloggen(markieren(z, 0));
    expect(darfAufhoeren(z)).toBe(false);
    expect(aufhoeren(z)).toBe(z);
  });

  it('eine Markierung vor dem Aufhören schadet nicht', () => {
    let z = weiter(antworten(runde(), true));
    z = aufhoeren(markieren(z, 1));
    expect(z.ausgang).toBe('aufgehoert');
  });
});

describe('Joker', () => {
  it('jeder Joker ist nur einmal zu haben', () => {
    for (const art of JOKER_ARTEN) {
      let z = runde();
      expect(jokerFrei(z, art)).toBe(true);
      z = jokerNutzen(z, art);
      expect(z.joker[art]).toBe(false);
      expect(jokerFrei(z, art)).toBe(false);
      expect(jokerNutzen(z, art)).toBe(z);
    }
  });

  it('kein Joker nach dem Einloggen oder nach der Auflösung', () => {
    let z = einloggen(markieren(runde(), 0));
    for (const art of JOKER_ARTEN) expect(jokerNutzen(z, art)).toBe(z);
    z = aufloesen(z);
    for (const art of JOKER_ARTEN) expect(jokerNutzen(z, art)).toBe(z);
  });

  describe('50:50', () => {
    it('lässt die richtige und genau eine falsche Antwort stehen', () => {
      for (let level = 1; level <= 50; level++) {
        const z = jokerNutzen(neueRunde(level, 'test', fuenfzehn()), 'halb');
        const f = z.fragen[0]!;
        expect(z.weg).toHaveLength(2);
        expect(z.weg).not.toContain(f.richtig);
        expect(new Set(z.weg).size).toBe(2);
      }
    });

    it('ist bei gleichem Level gleich (sonst hätte das Duell zwei verschiedene Hilfen)', () => {
      const a = jokerNutzen(runde(5), 'halb');
      const b = jokerNutzen(runde(5), 'halb');
      expect(a.weg).toEqual(b.weg);
    });

    it('lässt ausgeblendete Antworten nicht mehr markieren und löscht eine schon gesetzte Markierung dort', () => {
      let z = runde();
      const f = z.fragen[0]!;
      const falsch = [0, 1, 2, 3].filter((i) => i !== f.richtig);
      // Wir markieren eine falsche und schalten so lange durch Level, bis 50:50 genau sie entfernt.
      for (let level = 1; level < 200; level++) {
        const kandidat = markieren(runde(level), falsch[0]!);
        const nach = jokerNutzen(kandidat, 'halb');
        if (nach.weg.includes(falsch[0]!)) {
          z = nach;
          break;
        }
      }
      if (z.weg.length) {
        expect(z.markiert).toBeNull();
        expect(markieren(z, z.weg[0]!)).toBe(z);
      }
    });

    it('wirkt nur auf die aktuelle Frage', () => {
      let z = jokerNutzen(runde(), 'halb');
      z = weiter(antworten(z, true));
      expect(z.weg).toEqual([]);
    });

    it('halbWeg ist rein: gleiche Eingabe, gleiche Antwort', () => {
      const f = frage(1, 3, 2);
      expect(halbWeg(f, 77)).toEqual(halbWeg(f, 77));
    });
  });

  describe('Publikum', () => {
    const f = frage(1, 3, 1);

    it('ergibt immer genau 100 Prozent und eine eindeutige Mehrheit', () => {
      for (const schwere of [1, 2, 3, 4, 5] as const) {
        for (let saat = 1; saat <= 300; saat++) {
          const p = publikumsUrteil(f, schwere, [], saat);
          expect(p.reduce((a, b) => a + b, 0), `Schwere ${schwere}, Saat ${saat}: ${p}`).toBe(100);
          const spitze = Math.max(...p);
          expect(p.filter((x) => x === spitze), `Schwere ${schwere}, Saat ${saat}: ${p}`).toHaveLength(1);
          for (const x of p) expect(x).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('ausgeblendete Antworten bekommen null Stimmen, der Rest ergibt 100', () => {
      for (let saat = 1; saat <= 300; saat++) {
        const weg = halbWeg(f, saat);
        const p = publikumsUrteil(f, 4, weg, saat);
        for (const i of weg) expect(p[i]).toBe(0);
        expect(p.reduce((a, b) => a + b, 0)).toBe(100);
      }
    });

    it('liegt bei leichten Fragen fast immer richtig, bei schweren deutlich öfter daneben', () => {
      const anteil = (schwere: 1 | 2 | 3 | 4 | 5) => {
        let richtig = 0;
        const n = 1000;
        for (let saat = 1; saat <= n; saat++) {
          const p = publikumsUrteil(f, schwere, [], saat);
          if (p.indexOf(Math.max(...p)) === f.richtig) richtig++;
        }
        return richtig / n;
      };
      for (const schwere of [1, 2, 3, 4, 5] as const) {
        expect(anteil(schwere)).toBeGreaterThan(PUBLIKUM_TREFFER[schwere - 1]! - 0.06);
        expect(anteil(schwere)).toBeLessThan(PUBLIKUM_TREFFER[schwere - 1]! + 0.06);
      }
      expect(anteil(1)).toBeGreaterThan(anteil(5) + 0.4);
    });

    it('nach 50:50 liegt das Publikum öfter richtig als vorher', () => {
      let vorher = 0;
      let nachher = 0;
      for (let saat = 1; saat <= 1000; saat++) {
        const p = publikumsUrteil(f, 5, [], saat);
        if (p.indexOf(Math.max(...p)) === f.richtig) vorher++;
        const q = publikumsUrteil(f, 5, halbWeg(f, saat), saat);
        if (q.indexOf(Math.max(...q)) === f.richtig) nachher++;
      }
      expect(nachher).toBeGreaterThan(vorher + 100);
    });

    it('wird über den Joker in den Zustand geschrieben', () => {
      const z = jokerNutzen(runde(), 'publikum');
      expect(z.publikum).toHaveLength(4);
      expect(z.publikum!.reduce((a, b) => a + b, 0)).toBe(100);
    });
  });

  describe('Anruf', () => {
    const f = frage(1, 3, 2);

    it('der Tipp ist immer eine der noch stehenden Antworten', () => {
      for (let saat = 1; saat <= 300; saat++) {
        const weg = halbWeg(f, saat);
        const u = anrufUrteil(f, 5, weg, saat);
        expect(weg).not.toContain(u.tipp);
        expect([0, 1, 2, 3]).toContain(u.tipp);
        expect(['sehr', 'eher', 'kaum']).toContain(u.sicher);
      }
    });

    it('trifft bei leichten Fragen fast immer, bei schweren nur etwa jedes zweite Mal', () => {
      const anteil = (schwere: 1 | 2 | 3 | 4 | 5) => {
        let richtig = 0;
        const n = 1000;
        for (let saat = 1; saat <= n; saat++) if (anrufUrteil(f, schwere, [], saat).tipp === f.richtig) richtig++;
        return richtig / n;
      };
      for (const schwere of [1, 2, 3, 4, 5] as const) {
        expect(anteil(schwere)).toBeGreaterThan(ANRUF_TREFFER[schwere - 1]! - 0.06);
        expect(anteil(schwere)).toBeLessThan(ANRUF_TREFFER[schwere - 1]! + 0.06);
      }
    });

    it('klingt bei leichten Fragen öfter sicher als bei schweren — sagt aber nichts darüber, ob er recht hat', () => {
      const sehr = (schwere: 1 | 2 | 3 | 4 | 5) => {
        let n = 0;
        for (let saat = 1; saat <= 1000; saat++) if (anrufUrteil(f, schwere, [], saat).sicher === 'sehr') n++;
        return n;
      };
      expect(sehr(1)).toBeGreaterThan(sehr(5));
      // Es gibt sie also: den selbstsicheren Freund, der trotzdem danebenliegt.
      let falschUndSicher = 0;
      for (let saat = 1; saat <= 1000; saat++) {
        const u = anrufUrteil(f, 5, [], saat);
        if (u.tipp !== f.richtig && u.sicher === 'sehr') falschUndSicher++;
      }
      expect(falschUndSicher).toBeGreaterThan(0);
    });

    it('wird über den Joker in den Zustand geschrieben', () => {
      expect(jokerNutzen(runde(), 'anruf').anruf).not.toBeNull();
    });
  });
});

describe('ganze Spiele', () => {
  it('ein Spieler, der immer richtig antwortet, gewinnt in jedem Level', () => {
    for (let level = 1; level <= 30; level++) {
      let z = runde(level);
      for (let i = 0; i < STUFEN; i++) z = weiter(antworten(z, true));
      expect(z.gewonnen).toBe(true);
      expect(punkte(z)).toBe(100_000);
    }
  });

  it('die Punkte sind nach jedem Schritt eine der erlaubten Zahlen und nie kleiner als die letzte Sicherheitsstufe', () => {
    const erlaubt = new Set([0, ...PREISE]);
    for (let level = 1; level <= 40; level++) {
      let z = runde(level);
      for (let i = 0; i < 400 && !z.vorbei; i++) {
        const w = (i * 7 + level * 3) % 11;
        if (z.aufgeloest) z = weiter(z);
        else if (w === 0 && z.erreicht > 0) z = aufhoeren(z);
        else if (w === 1) z = jokerNutzen(z, JOKER_ARTEN[i % 3]!);
        else z = antworten(z, w > 3);
        expect(erlaubt.has(punkte(z))).toBe(true);
        expect(punkte(z)).toBeGreaterThanOrEqual(sichererGewinn(z.erreicht));
        if (z.ausgang === 'falsch') expect(punkte(z)).toBe(sichererGewinn(z.erreicht));
      }
      expect(z.vorbei).toBe(true);
    }
  });
});

describe('Formprüfung einer Frage', () => {
  const gut = frage(1, 3, 1);

  it('lässt eine gute Frage durch', () => {
    expect(pruefeFrage(gut)).toEqual([]);
  });

  it('meldet doppelte, leere und zu lange Antworten', () => {
    expect(pruefeFrage({ ...gut, antworten: ['a', 'A', 'c', 'd'] })).toContain('Zwei Antworten sind gleich');
    expect(pruefeFrage({ ...gut, antworten: ['a', '', 'c', 'd'] })).toContain('Eine Antwort ist leer');
    expect(pruefeFrage({ ...gut, antworten: ['a', 'b', 'c', 'x'.repeat(41)] }).join()).toContain('Antwort zu lang');
  });

  it('meldet Antworten, die auf andere Antworten verweisen', () => {
    expect(pruefeFrage({ ...gut, antworten: ['a', 'b', 'c', 'Alle Antworten sind richtig'] }).join()).toContain('verweist');
    expect(pruefeFrage({ ...gut, antworten: ['a', 'b', 'c', 'Keine davon'] }).join()).toContain('verweist');
    // Ein normales Wort, das nur zufällig mit „all" anfängt, ist kein Verweis.
    expect(pruefeFrage({ ...gut, antworten: ['Allee', 'b', 'c', 'd'] })).toEqual([]);
  });

  it('meldet eine Frage, die ihre Antwort verrät', () => {
    expect(
      pruefeFrage({ ...gut, frage: 'Ist der Elefant das größte Landtier?', antworten: ['Katze', 'Elefant', 'Hund', 'Maus'], richtig: 1 }).join(),
    ).toContain('enthält ihre eigene Antwort');
  });

  it('meldet fehlende Erklärung, ungültige Schwere und einen ungültigen Index', () => {
    expect(pruefeFrage({ ...gut, erklaerung: 'kurz' })).toContain('Erklärung fehlt oder ist zu kurz');
    expect(pruefeFrage({ ...gut, schwere: 6 as never })).toContain('Schwere muss 1 bis 5 sein');
    expect(pruefeFrage({ ...gut, richtig: 4 as never })).toContain('Index der richtigen Antwort ungültig');
  });
});
