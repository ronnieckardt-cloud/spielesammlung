import { describe, it, expect } from 'vitest';
import {
  ANKUNFT,
  APFEL_ABSTAND,
  APFEL_PUNKTE,
  APFEL_UNTEREINANDER,
  BOSS_ALLE,
  FENSTER_ANTEIL,
  FLUG_S,
  GOLD_PUNKTE,
  KETTE_MAX,
  MESSER_PUNKTE,
  MIN_ABSTAND,
  PAUSE_S,
  WECHSEL_AB_LEVEL,
  ZERTEILT_S,
  bestesFenster,
  bossBonus,
  bossNummer,
  fensterZiel,
  gesamtFuerLevel,
  gleichmaessigesFenster,
  istBoss,
  ketteFaktor,
  levelAufbauen,
  messerFuerLevel,
  musterFuerLevel,
  neuesSpiel,
  normalisieren,
  spitzentempoFuerLevel,
  stossPartner,
  tempoFuerLevel,
  umlaufZeit,
  vorgestecktFuerLevel,
  werfen,
  winkelAbstand,
  zeitFortschritt,
  zerteiltFortschritt,
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
  it('lässt die Zahl der Messer im Stamm wachsen und bei zehn stehen bleiben — der Boss hat eines mehr', () => {
    expect(gesamtFuerLevel(1)).toBe(3);
    let vorher = 0;
    for (let level = 1; level <= 60; level++) {
      if (istBoss(level)) continue;
      const jetzt = gesamtFuerLevel(level);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      expect(jetzt).toBeLessThanOrEqual(10);
      vorher = jetzt;
    }
    // Der Boss steckt gegenüber einem gewöhnlichen Level derselben Stufe eines mehr.
    expect(gesamtFuerLevel(40)).toBe(gesamtFuerLevel(39) + 1);
  });

  it('wirft in jedem Level mindestens drei Messer', () => {
    // Sonst wäre ein Level nach zwei Tipps vorbei und kein Level mehr.
    for (let level = 1; level <= 60; level++) {
      expect(messerFuerLevel(level)).toBeGreaterThanOrEqual(3);
      expect(messerFuerLevel(level) + vorgestecktFuerLevel(level)).toBe(gesamtFuerLevel(level));
    }
  });

  it('steckt erst ab Level 4 Messer vor und deckelt bei drei', () => {
    expect(vorgestecktFuerLevel(1)).toBe(0);
    expect(vorgestecktFuerLevel(3)).toBe(0);
    expect(vorgestecktFuerLevel(4)).toBe(1);
    for (let level = 1; level <= 60; level++) {
      expect(vorgestecktFuerLevel(level)).toBeLessThanOrEqual(3);
    }
  });

  it('lässt immer genug Platz für alle Messer eines Levels', () => {
    // Sonst wäre ein Level rechnerisch unlösbar: Jedes Messer belegt
    // MIN_ABSTAND nach beiden Seiten.
    for (let level = 1; level <= 60; level++) {
      expect(gesamtFuerLevel(level) * MIN_ABSTAND * 2).toBeLessThan(Math.PI * 2);
    }
  });

  it('dreht bis Level 5 gleichmäßig und wechselt ab Level 6 die Richtung', () => {
    const gleich = musterFuerLevel(3, rng(1));
    expect(gleich).toHaveLength(1);
    expect(musterFuerLevel(WECHSEL_AB_LEVEL - 1, rng(1))).toHaveLength(1);

    const wechselnd = musterFuerLevel(9, rng(1));
    expect(wechselnd.length).toBeGreaterThan(1);
    const vorzeichen = wechselnd.map((p) => Math.sign(p.tempo));
    expect(new Set(vorzeichen).size).toBe(2);
    for (const p of wechselnd) expect(p.dauer).toBeGreaterThan(0);
  });

  it('dreht in höheren Leveln schneller — bis zum Deckel', () => {
    expect(tempoFuerLevel(12)).toBeGreaterThan(tempoFuerLevel(1));
    // 301 und 302 sind keine Boss-Level; der Boss dreht absichtlich langsamer.
    expect(tempoFuerLevel(301)).toBe(tempoFuerLevel(302));
    // Das Spitzentempo steht über dem Grundtempo, sobald der Stamm wechselt.
    expect(spitzentempoFuerLevel(12)).toBeGreaterThan(tempoFuerLevel(12));
    expect(spitzentempoFuerLevel(3)).toBe(tempoFuerLevel(3));
  });
});

describe('Boss-Stamm', () => {
  it('ist jeder fünfte Level und wird beim Namen genannt', () => {
    expect(istBoss(BOSS_ALLE)).toBe(true);
    expect(istBoss(2 * BOSS_ALLE)).toBe(true);
    expect(istBoss(1)).toBe(false);
    expect(istBoss(BOSS_ALLE + 1)).toBe(false);
    expect(bossNummer(5)).toBe(1);
    expect(bossNummer(15)).toBe(3);
    expect(bossBonus(10)).toBe(2 * bossBonus(5));
  });

  it('dreht langsamer als der Level davor und trägt ein Messer mehr', () => {
    for (const boss of [5, 10, 15, 20, 25]) {
      expect(tempoFuerLevel(boss)).toBeLessThan(tempoFuerLevel(boss - 1));
      expect(gesamtFuerLevel(boss)).toBeGreaterThan(gesamtFuerLevel(boss - 1) - 1);
    }
  });

  it('hat einen goldenen Apfel — im ersten Boss den einzigen, später einen neben einem gewöhnlichen', () => {
    const erster = levelAufbauen(5, 0, 7);
    expect(erster.aepfel.filter((a) => a.gold)).toHaveLength(1);
    expect(erster.aepfel).toHaveLength(1);
    const zweiter = levelAufbauen(10, 0, 7);
    expect(zweiter.aepfel.filter((a) => a.gold)).toHaveLength(1);
    expect(zweiter.aepfel.filter((a) => !a.gold)).toHaveLength(1);
    // Und kein gewöhnliches Level hat einen goldenen.
    for (let level = 1; level <= 40; level++) {
      if (istBoss(level)) continue;
      expect(levelAufbauen(level, 0, 7).aepfel.some((a) => a.gold)).toBe(false);
    }
  });

  it('zahlt den Bonus beim letzten Messer — nicht erst beim Levelwechsel', () => {
    const grund = stillstehend(levelAufbauen(5, 0, 7), 0);
    // Das letzte Messer: Apfel weit weg, damit nur der Bonus zählt.
    const z: Zustand = { ...grund, aepfel: [], messer: [], uebrig: 1 };
    const nach = wurfDurchziehen(z);
    expect(nach.pauseRest).toBeCloseTo(PAUSE_S);
    expect(nach.punkte).toBe(MESSER_PUNKTE + bossBonus(5));
  });

  it('gibt für einen gewöhnlichen Level keinen Bonus', () => {
    const grund = stillstehend(levelAufbauen(4, 0, 7), 0);
    const nach = wurfDurchziehen({ ...grund, aepfel: [], messer: [], uebrig: 1 });
    expect(nach.punkte).toBe(MESSER_PUNKTE);
  });
});

describe('Apfelkette', () => {
  /** Ein Apfel genau dort, wo ein Wurf bei Stammwinkel `winkel` einschlägt. */
  const apfelBeiWurf = (gold = false, winkel = 0) => ({ steck: normalisieren(ANKUNFT - winkel), gold });

  it('zählt den ersten Apfel einfach und jeden weiteren in Folge mehr, bis zum Deckel', () => {
    expect(ketteFaktor(0)).toBe(1);
    expect(ketteFaktor(1)).toBe(1);
    expect(ketteFaktor(3)).toBe(3);
    expect(ketteFaktor(99)).toBe(KETTE_MAX);

    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const eins = wurfDurchziehen({ ...grund, aepfel: [apfelBeiWurf()], messer: [], kette: 0 });
    expect(eins.punkte).toBe(MESSER_PUNKTE + APFEL_PUNKTE);
    expect(eins.kette).toBe(1);

    const zwei = wurfDurchziehen({ ...stillstehend(eins, 2.5), aepfel: [apfelBeiWurf(false, 2.5)] });
    expect(zwei.punkte - eins.punkte).toBe(MESSER_PUNKTE + 2 * APFEL_PUNKTE);
    expect(zwei.kette).toBe(2);
  });

  it('zahlt für den goldenen Apfel das Vierfache — und die Kette zählt mit', () => {
    expect(GOLD_PUNKTE).toBe(4 * APFEL_PUNKTE);
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const nach = wurfDurchziehen({ ...grund, aepfel: [apfelBeiWurf(true)], messer: [], kette: 2 });
    expect(nach.punkte).toBe(MESSER_PUNKTE + GOLD_PUNKTE * 3);
    expect(nach.kette).toBe(3);
    // Der zerteilte Apfel weiß, dass er golden war — die Anzeige malt ihn so.
    expect(nach.zerteilt!.gold).toBe(true);
  });

  it('reißt, wenn am Ende eines Levels ein Apfel stehen bleibt', () => {
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    // Letztes Messer, der Apfel liegt woanders: nicht getroffen.
    const nach = wurfDurchziehen({
      ...grund,
      aepfel: [{ steck: normalisieren(ANKUNFT + 2), gold: false }],
      messer: [],
      uebrig: 1,
      kette: 3,
    });
    expect(nach.kette).toBe(0);
  });

  it('bleibt bestehen, wenn kein Apfel übrig ist — auch über den Levelwechsel', () => {
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const nach = wurfDurchziehen({ ...grund, aepfel: [apfelBeiWurf()], messer: [], uebrig: 1, kette: 1 });
    expect(nach.kette).toBe(2);
    const naechstes = zeitFortschritt(nach, PAUSE_S + 0.01);
    expect(naechstes.level).toBe(3);
    expect(naechstes.kette).toBe(2);
  });

  it('läuft nicht weg, wenn man einen Apfel verfehlt, ohne dass das Level zu Ende ist', () => {
    // Ein Apfel darf liegen bleiben, solange noch Messer da sind: Man kann ihn später treffen.
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const nach = wurfDurchziehen({
      ...grund,
      aepfel: [{ steck: normalisieren(ANKUNFT + 2), gold: false }],
      messer: [],
      uebrig: 3,
      kette: 2,
    });
    expect(nach.kette).toBe(2);
  });
});

describe('Zeitfenster', () => {
  it('rechnet für gleichmäßig verteilte Messer die Lücke durch die Drehzahl', () => {
    // Vier Messer im Abstand π/2, Tempo 2: Beim fünften Wurf bleibt zwischen
    // zwei Messern π/2 − 2·MIN_ABSTAND, und so lange braucht der Stamm dafür.
    const messer = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    expect(bestesFenster(messer, 1, 2)).toBeCloseTo((Math.PI / 2 - 2 * MIN_ABSTAND) / 2, 6);
  });

  it('nimmt für jedes weitere Messer die jeweils größte Lücke und gibt den Engpass zurück', () => {
    // Ohne Messer und mit drei Würfen: Der erste und zweite sehen noch einen ganzen Umfang
    // (ein einzelnes Messer lässt rundherum Platz), erst der dritte steht zwischen zwei
    // gegenüberliegenden Messern, die Lücke ist dann ein halber Umfang — der Engpass.
    expect(bestesFenster([], 3, 1)).toBeCloseTo(Math.PI - 2 * MIN_ABSTAND, 6);
  });

  it('meldet null, wenn keine Lücke mehr für ein Messer reicht', () => {
    // 21 gleichmäßig verteilte Messer: Zwischen zwei liegen 0,299 — weniger als 2·MIN_ABSTAND.
    const voll = Array.from({ length: 21 }, (_, i) => (i / 21) * Math.PI * 2);
    expect(bestesFenster(voll, 1, 1)).toBe(0);
  });

  it('lässt in **jedem** Level bei bestem Spiel ein Fenster, das ein Mensch trifft', () => {
    // Das ist der wichtigste Test dieser Datei. Vorher fiel das Fenster beim
    // besten Spiel in Level 8 auf 107 ms, in Level 15 auf 41 ms — kürzer, als
    // irgendjemand zuverlässig tippt. Dort entschied nicht Können, sondern Zufall.
    for (let level = 1; level <= 60; level++) {
      for (let saat = 1; saat <= 25; saat++) {
        const z = levelAufbauen(level, 0, saat);
        const fenster = bestesFenster(z.messer, z.uebrig, spitzentempoFuerLevel(level));
        expect(fenster, `Level ${level}, Saat ${saat}`).toBeGreaterThanOrEqual(fensterZiel(level) - 1e-9);
        // Und das Ziel selbst bleibt über dem, was ein sehr guter Spieler noch schafft.
        expect(fenster).toBeGreaterThan(0.09);
      }
    }
  });

  it('lässt das gleichmäßige Fenster über alle Level nie unter 115 Millisekunden fallen', () => {
    // Der engste Punkt liegt ab Level 21 (zehn Messer bei Höchsttempo): rund 120 ms.
    for (let level = 1; level <= 200; level++) {
      expect(gleichmaessigesFenster(level)).toBeGreaterThan(0.115);
    }
  });

  it('verlangt vom Zufall nur einen Teil des gleichmäßigen Fensters', () => {
    expect(FENSTER_ANTEIL).toBeGreaterThan(0);
    expect(FENSTER_ANTEIL).toBeLessThan(1);
    expect(fensterZiel(12)).toBeCloseTo(FENSTER_ANTEIL * gleichmaessigesFenster(12), 9);
  });

  it('steckt mit den vorgesteckten Messern nie mehr, als die Fenster erlauben', () => {
    for (let level = 1; level <= 60; level++) {
      const z = levelAufbauen(level, 0, 11);
      expect(z.messer.length).toBeLessThanOrEqual(vorgestecktFuerLevel(level));
      // Was nicht vorgesteckt wird, wirft man selbst: Die Gesamtzahl bleibt gleich.
      expect(z.uebrig + z.messer.length).toBe(gesamtFuerLevel(level));
    }
  });
});

describe('Der wechselnde Stamm kommt immer rundherum', () => {
  it('erkennt einen Stamm, der nur hin und her pendelt', () => {
    // So sah das Muster früher aus: gleich lange Abschnitte in beide Richtungen.
    const pendel = [
      { dauer: 1, tempo: 2 },
      { dauer: 1, tempo: -2 },
    ];
    expect(umlaufZeit(pendel)).toBe(Number.POSITIVE_INFINITY);
    // Gleichmäßig dreht er in 2π/Tempo einmal rundherum.
    expect(umlaufZeit([{ dauer: Number.POSITIVE_INFINITY, tempo: 2 }])).toBeCloseTo((Math.PI * 2) / 2, 1);
  });

  it('bringt in jedem Level jede Lücke binnen sechs Sekunden an den Einschlagpunkt', () => {
    // Gemessen vorher: Der beste Spieler wartete in Level 5 bis zu acht Sekunden auf eine Lücke,
    // die gerade nicht dran war — und bei kleinem Nettovorlauf hätte es noch länger dauern können.
    for (let level = 1; level <= 80; level++) {
      for (let saat = 1; saat <= 20; saat++) {
        const muster = levelAufbauen(level, 0, saat).muster;
        expect(umlaufZeit(muster), `Level ${level}, Saat ${saat}`).toBeLessThan(6);
      }
    }
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
          expect(winkelAbstand(apfel.steck, messer)).toBeGreaterThanOrEqual(APFEL_ABSTAND);
        }
      }
    }
  });

  it('legt zwei Äpfel nie übereinander', () => {
    // Ein Apfel ist fast so breit wie der Abstand zweier Messer; mit dem Mindestabstand für Messer lagen zwei
    // Äpfel sichtbar ineinander.
    for (let level = 6; level <= 60; level++) {
      for (let saat = 1; saat <= 20; saat++) {
        const [a, b] = levelAufbauen(level, 0, saat).aepfel;
        if (a && b) expect(winkelAbstand(a.steck, b.steck)).toBeGreaterThanOrEqual(APFEL_UNTEREINANDER);
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
    // Das tödliche Messer wird nicht mitgezählt.
    expect(z.messer).toHaveLength(1);
  });

  it('merkt sich, wo der Zusammenstoß war, und welche Klinge dran schuld ist', () => {
    // Ohne diese Angabe endete die Runde ohne jedes Bild: Das geworfene
    // Messer verschwand, die Stelle des Zusammenstoßes blieb ungenannt.
    let z = stillstehend(neuesSpiel(1), 0.4);
    expect(z.stoss).toBeNull();
    expect(stossPartner(z)).toBe(-1);

    z = wurfDurchziehen(z);
    z = wurfDurchziehen(z);
    expect(z.stoss).toBeCloseTo(normalisieren(ANKUNFT - 0.4));
    // Genau das eine steckende Messer ist gemeint, nicht irgendeines.
    expect(stossPartner(z)).toBe(0);
    expect(winkelAbstand(z.messer[stossPartner(z)]!, z.stoss!)).toBeLessThan(MIN_ABSTAND);
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
    const z: Zustand = { ...grund, aepfel: [{ steck: normalisieren(ANKUNFT), gold: false }] };
    const nach = wurfDurchziehen(z);
    expect(nach.aepfel).toHaveLength(0);
    expect(nach.messer).toHaveLength(1);
    expect(nach.punkte).toBe(MESSER_PUNKTE + APFEL_PUNKTE);
  });

  it('lässt einen zerteilten Apfel eine Weile auseinanderfliegen', () => {
    // Ohne diese Nachlaufzeit verschwand die größte Einzelbelohnung des
    // Spiels ohne jede sichtbare Reaktion: Der Apfel war im selben
    // Augenblick aus `aepfel` heraus, in dem er getroffen wurde.
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const apfel = normalisieren(ANKUNFT);
    const nach = wurfDurchziehen({ ...grund, aepfel: [{ steck: apfel, gold: false }] });

    expect(nach.zerteilt).not.toBeNull();
    // Die Hälften fliegen dort auseinander, wo der Apfel saß.
    expect(nach.zerteilt!.steck).toBeCloseTo(apfel);
    expect(zerteiltFortschritt(nach)).toBeLessThan(0.5);

    const spaeter = zeitFortschritt(nach, ZERTEILT_S * 0.5);
    expect(spaeter.zerteilt).not.toBeNull();
    expect(zerteiltFortschritt(spaeter)).toBeGreaterThan(zerteiltFortschritt(nach));

    // Danach ist er weg und die Anzeige zeichnet nichts mehr.
    const fertig = zeitFortschritt(spaeter, ZERTEILT_S);
    expect(fertig.zerteilt).toBeNull();
    expect(zerteiltFortschritt(fertig)).toBe(0);
  });

  it('lässt die Apfeluhr auch während der Levelpause weiterlaufen', () => {
    // Sonst bliebe ausgerechnet beim Apfeltreffer mit dem letzten Messer
    // eine halb auseinandergeflogene Frucht über dem Stamm stehen.
    let z = stillstehend(levelAufbauen(2, 0, 5), 0);
    for (let i = 0; i < messerFuerLevel(2) - 1; i++) {
      z = wurfDurchziehen(stillstehend(z, 1.2 + i * 1.2));
    }
    // Der letzte Wurf trifft zugleich den Apfel.
    z = wurfDurchziehen({ ...stillstehend(z, 0), aepfel: [{ steck: normalisieren(ANKUNFT), gold: false }] });
    expect(z.pauseRest).toBeCloseTo(PAUSE_S);
    expect(z.zerteilt).not.toBeNull();

    const spaeter = zeitFortschritt(z, ZERTEILT_S + 0.01);
    expect(spaeter.pauseRest).toBeGreaterThan(0);
    expect(spaeter.zerteilt).toBeNull();
  });

  it('schützt ein Apfel nicht vor dem Messer dahinter', () => {
    const grund = stillstehend(levelAufbauen(2, 0, 5), 0);
    const treffpunkt = normalisieren(ANKUNFT);
    const z: Zustand = { ...grund, aepfel: [{ steck: treffpunkt, gold: false }], messer: [treffpunkt] };
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
