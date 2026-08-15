import { describe, it, expect } from 'vitest';
import {
  ANKUNFT,
  APFEL_PUNKTE,
  FLUG_S,
  MESSER_PUNKTE,
  MIN_ABSTAND,
  PAUSE_S,
  levelAufbauen,
  messerFuerLevel,
  musterFuerLevel,
  neuesSpiel,
  normalisieren,
  vorgestecktFuerLevel,
  werfen,
  winkelAbstand,
  zeitFortschritt,
} from './logik';
import type { Zustand } from './logik';
import { rng } from '../../core/rng';

/** Wirft ein Messer und lässt es bis zum Einschlag fliegen. */
function wurfDurchziehen(z: Zustand): Zustand {
  let nach = werfen(z);
  // Zwei Schritte: einer kurz vor dem Einschlag, einer darüber hinaus.
  nach = zeitFortschritt(nach, FLUG_S * 0.5);
  return zeitFortschritt(nach, FLUG_S * 0.6);
}

/** Hält den Stamm still, damit ein Test die Winkel selbst bestimmen kann. */
function stillstehend(z: Zustand, winkel = 0): Zustand {
  return {
    ...z,
    winkel,
    muster: [{ dauer: Number.POSITIVE_INFINITY, tempo: 0 }],
    phaseIndex: 0,
    phaseRest: Number.POSITIVE_INFINITY,
  };
}

describe('Winkelrechnung', () => {
  it('normalisiert in den Bereich 0 bis 2π', () => {
    expect(normalisieren(0)).toBeCloseTo(0);
    expect(normalisieren(-0.5)).toBeCloseTo(Math.PI * 2 - 0.5);
    expect(normalisieren(Math.PI * 4 + 1)).toBeCloseTo(1);
  });

  it('misst den kürzeren Weg um den Kreis', () => {
    expect(winkelAbstand(0, 0.3)).toBeCloseTo(0.3);
    // Über die Naht hinweg: 0,1 und 2π−0,1 sind 0,2 auseinander, nicht 6,08.
    expect(winkelAbstand(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
    expect(winkelAbstand(0, Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('Schwierigkeit je Level', () => {
  it('verlangt mehr Messer, aber nie mehr als neun', () => {
    expect(messerFuerLevel(1)).toBe(3);
    expect(messerFuerLevel(2)).toBe(4);
    let vorher = 0;
    for (let level = 1; level <= 40; level++) {
      const jetzt = messerFuerLevel(level);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      expect(jetzt).toBeLessThanOrEqual(9);
      vorher = jetzt;
    }
  });

  it('steckt erst ab Level 3 Messer vor und deckelt bei vier', () => {
    expect(vorgestecktFuerLevel(1)).toBe(0);
    expect(vorgestecktFuerLevel(2)).toBe(0);
    expect(vorgestecktFuerLevel(3)).toBe(1);
    for (let level = 1; level <= 40; level++) {
      expect(vorgestecktFuerLevel(level)).toBeLessThanOrEqual(4);
    }
  });

  it('lässt immer genug Platz für alle Messer eines Levels', () => {
    // Sonst wäre ein Level rechnerisch unlösbar: Jedes Messer belegt
    // MIN_ABSTAND nach beiden Seiten.
    for (let level = 1; level <= 40; level++) {
      const gesamt = messerFuerLevel(level) + vorgestecktFuerLevel(level);
      expect(gesamt * MIN_ABSTAND * 2).toBeLessThan(Math.PI * 2);
    }
  });

  it('dreht bis Level 4 gleichmäßig und wechselt ab Level 5 die Richtung', () => {
    const gleich = musterFuerLevel(3, rng(1));
    expect(gleich).toHaveLength(1);

    const wechselnd = musterFuerLevel(9, rng(1));
    expect(wechselnd.length).toBeGreaterThan(1);
    const vorzeichen = wechselnd.map((p) => Math.sign(p.tempo));
    expect(new Set(vorzeichen).size).toBe(2);
    for (const p of wechselnd) expect(p.dauer).toBeGreaterThan(0);
  });

  it('dreht in höheren Leveln schneller', () => {
    const langsam = Math.abs(musterFuerLevel(1, rng(5))[0]!.tempo);
    const schnell = Math.abs(musterFuerLevel(12, rng(5))[0]!.tempo);
    expect(schnell).toBeGreaterThan(langsam);
  });
});

describe('levelAufbauen', () => {
  it('ergibt bei gleicher Levelnummer und Saat dasselbe Level', () => {
    const a = levelAufbauen(7, 0, 42);
    const b = levelAufbauen(7, 0, 42);
    expect(a.messer).toEqual(b.messer);
    expect(a.aepfel).toEqual(b.aepfel);
    expect(a.muster).toEqual(b.muster);
  });

  it('hält die vorgesteckten Messer weit genug auseinander', () => {
    for (let level = 3; level <= 30; level++) {
      const z = levelAufbauen(level, 0, 99);
      for (let i = 0; i < z.messer.length; i++) {
        for (let j = i + 1; j < z.messer.length; j++) {
          expect(winkelAbstand(z.messer[i]!, z.messer[j]!)).toBeGreaterThanOrEqual(MIN_ABSTAND * 2);
        }
      }
    }
  });

  it('legt keinen Apfel unter ein Messer', () => {
    for (let level = 2; level <= 30; level++) {
      const z = levelAufbauen(level, 0, 99);
      for (const apfel of z.aepfel) {
        for (const messer of z.messer) {
          expect(winkelAbstand(apfel, messer)).toBeGreaterThanOrEqual(MIN_ABSTAND * 2.2);
        }
      }
    }
  });

  it('gibt es ab Level 2 einen und ab Level 6 zwei Äpfel', () => {
    expect(levelAufbauen(1, 0, 3).aepfel).toHaveLength(0);
    expect(levelAufbauen(2, 0, 3).aepfel).toHaveLength(1);
    expect(levelAufbauen(6, 0, 3).aepfel).toHaveLength(2);
  });
});

describe('Werfen und Einschlag', () => {
  it('steckt das Messer dort, wo der Stamm beim Einschlag steht', () => {
    const z = stillstehend(neuesSpiel(1), 1.0);
    const nach = wurfDurchziehen(z);
    expect(nach.messer).toHaveLength(1);
    // Steckwinkel ist ANKUNFT minus Stammwinkel — siehe Kopfkommentar.
    expect(nach.messer[0]!).toBeCloseTo(normalisieren(ANKUNFT - 1.0));
    expect(nach.punkte).toBe(MESSER_PUNKTE);
    expect(nach.uebrig).toBe(messerFuerLevel(1) - 1);
  });

  it('nimmt keinen zweiten Wurf an, solange eines fliegt', () => {
    const z = werfen(neuesSpiel(1));
    expect(z.fliegend).toBeCloseTo(FLUG_S);
    // Ohne die Sperre könnte man mit schnellem Tippen mehrere Messer
    // gleichzeitig loswerfen und die Kollisionsprüfung umgehen.
    expect(werfen(z)).toBe(z);
  });

  it('beendet die Runde beim Treffer auf ein eigenes Messer', () => {
    // Stamm steht still: Der zweite Wurf landet zwangsläufig da, wo der
    // erste schon steckt.
    let z = stillstehend(neuesSpiel(1), 0.4);
    z = wurfDurchziehen(z);
    expect(z.vorbei).toBe(false);
    z = wurfDurchziehen(z);
    expect(z.vorbei).toBe(true);
    expect(z.getroffen).toBe(true);
    // Das tödliche Messer wird nicht mitgezählt.
    expect(z.messer).toHaveLength(1);
  });

  it('nimmt nach dem Ende keine Würfe mehr an', () => {
    let z = stillstehend(neuesSpiel(1), 0);
    z = wurfDurchziehen(z);
    z = wurfDurchziehen(z);
    expect(z.vorbei).toBe(true);
    expect(werfen(z)).toBe(z);
    expect(zeitFortschritt(z, 1)).toBe(z);
  });

  it('zerteilt einen Apfel, das Messer steckt trotzdem', () => {
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    // Den Apfel genau dorthin legen, wo der Wurf ankommt.
    const z: Zustand = { ...grund, aepfel: [normalisieren(ANKUNFT)] };
    const nach = wurfDurchziehen(z);
    expect(nach.aepfel).toHaveLength(0);
    expect(nach.messer).toHaveLength(1);
    expect(nach.punkte).toBe(MESSER_PUNKTE + APFEL_PUNKTE);
  });

  it('schützt ein Apfel nicht vor dem Messer dahinter', () => {
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const treffpunkt = normalisieren(ANKUNFT);
    const z: Zustand = { ...grund, aepfel: [treffpunkt], messer: [treffpunkt] };
    const nach = wurfDurchziehen(z);
    expect(nach.vorbei).toBe(true);
    // Der Apfel zählt trotzdem — man hat ihn ja getroffen.
    expect(nach.punkte).toBe(APFEL_PUNKTE);
  });
});

describe('Drehung', () => {
  it('dreht mit dem Tempo der aktuellen Phase', () => {
    const z: Zustand = {
      ...neuesSpiel(1),
      winkel: 0,
      muster: [{ dauer: Number.POSITIVE_INFINITY, tempo: 2 }],
      phaseIndex: 0,
      phaseRest: Number.POSITIVE_INFINITY,
    };
    expect(zeitFortschritt(z, 0.5).winkel).toBeCloseTo(1);
  });

  it('holt mehrere fällige Phasenwechsel in einem Schritt nach', () => {
    // Sonst verschöbe sich das Muster dauerhaft, sobald es einmal ruckelt.
    const z: Zustand = {
      ...neuesSpiel(1),
      winkel: 0,
      muster: [
        { dauer: 0.1, tempo: 1 },
        { dauer: 0.1, tempo: -1 },
      ],
      phaseIndex: 0,
      phaseRest: 0.1,
    };
    const nach = zeitFortschritt(z, 0.4);
    // +0,1 −0,1 +0,1 −0,1 = 0, und wieder am Anfang der ersten Phase.
    expect(nach.winkel).toBeCloseTo(0);
    expect(nach.phaseIndex).toBe(0);
  });
});

describe('Levelwechsel', () => {
  it('legt nach dem letzten Messer eine Pause ein und startet dann das nächste Level', () => {
    let z = stillstehend(neuesSpiel(1), 0);
    // Drei Messer sauber verteilt setzen, indem der Stamm zwischendurch
    // von Hand weitergedreht wird.
    for (let i = 0; i < messerFuerLevel(1); i++) {
      z = wurfDurchziehen(stillstehend(z, i * 1.2));
    }
    expect(z.vorbei).toBe(false);
    expect(z.uebrig).toBe(0);
    expect(z.pauseRest).toBeCloseTo(PAUSE_S);

    // Während der Pause nimmt es keinen Wurf an.
    expect(werfen(z)).toBe(z);

    const nach = zeitFortschritt(z, PAUSE_S + 0.01);
    expect(nach.level).toBe(2);
    expect(nach.uebrig).toBe(messerFuerLevel(2));
    expect(nach.messer).toHaveLength(vorgestecktFuerLevel(2));
    // Punkte wandern mit und bekommen den Levelbonus dazu.
    expect(nach.punkte).toBeGreaterThan(z.punkte);
  });
});
