import { describe, expect, it } from 'vitest';
import {
  AUFSAMMEL_ABSTAND,
  GEH_TEMPO,
  KEINE_EINGABE,
  RENN_TEMPO,
  SPRUNG_KRAFT,
  ausKastenSchieben,
  eingesammelt,
  kollisionLoesen,
  naechsterNpc,
  spielerAmStart,
  takt,
  type Eingabe,
  type Spieler,
} from './logik';
import { FIGUR_RADIUS, WOHNVIERTEL, bodenhoehe, hindernisse, type Kasten } from './welt';

const KAESTEN = hindernisse(WOHNVIERTEL);

/** Läuft `sekunden` lang mit fester Eingabe, in kleinen Schritten. */
function laufen(start: Spieler, eingabe: Partial<Eingabe>, sekunden: number): Spieler {
  let s = start;
  const dt = 1 / 60;
  for (let t = 0; t < sekunden; t += dt) {
    s = takt(s, { ...KEINE_EINGABE, ...eingabe }, WOHNVIERTEL, dt, KAESTEN);
  }
  return s;
}

describe('Aus einem Kasten schieben', () => {
  const k: Kasten = { x: 0, z: 0, breite: 4, tiefe: 4, hoehe: 3 };

  it('lässt in Ruhe, was weit genug weg ist', () => {
    expect(ausKastenSchieben(10, 0, 0.5, k)).toBeNull();
    // Genau auf Tuchfühlung, aber ohne Überschneidung.
    expect(ausKastenSchieben(2 + 0.51, 0, 0.5, k)).toBeNull();
  });

  /*
   * Genauigkeit 3 statt 5, und das ist Absicht: Das Herausschieben lässt
   * einen Zehntelmillimeter Luft, damit die Auflösungsschleife zur Ruhe
   * kommt (siehe `ausKastenSchieben`). Auf fünf Stellen genau zu prüfen
   * hieße, genau diesen gewollten Abstand als Fehler zu melden.
   */
  it('schiebt seitlich heraus, nicht diagonal', () => {
    const neu = ausKastenSchieben(2.2, 0, 0.5, k)!;
    expect(neu.x).toBeCloseTo(2.5, 3);
    expect(neu.z).toBeCloseTo(0, 5);
  });

  it('schiebt an einer Ecke diagonal heraus', () => {
    const neu = ausKastenSchieben(2.2, 2.2, 0.5, k)!;
    // Der Abstand zur Ecke muss danach dem Radius entsprechen.
    expect(Math.hypot(neu.x - 2, neu.z - 2)).toBeCloseTo(0.5, 3);
  });

  it('schiebt aus dem Inneren zur nächsten Seite, nicht quer hindurch', () => {
    // Dicht an der rechten Wand, aber innen.
    const neu = ausKastenSchieben(1.6, 0, 0.5, k)!;
    expect(neu.x).toBeCloseTo(2.5, 3);
    // Nicht auf die andere Seite gesprungen.
    expect(neu.x).toBeGreaterThan(0);
  });

  it('lässt nach dem Schieben wirklich keine Überschneidung übrig', () => {
    // Der eigentliche Zweck: Was einmal herausgeschoben wurde, darf beim
    // nächsten Durchgang nicht wieder als Treffer gelten — sonst dreht
    // sich die Auflösungsschleife ewig.
    for (const [px, pz] of [[2.2, 0], [2.2, 2.2], [1.6, 0], [0, 0]] as const) {
      const neu = ausKastenSchieben(px, pz, 0.5, k)!;
      expect(ausKastenSchieben(neu.x, neu.z, 0.5, k)).toBeNull();
    }
  });
});

describe('Kollision auflösen', () => {
  it('bringt eine Innenecke aus zwei Kästen in einem Rutsch in Ordnung', () => {
    const ecke: Kasten[] = [
      { x: 0, z: -1, breite: 6, tiefe: 0.4, hoehe: 2 },
      { x: -1, z: 0, breite: 0.4, tiefe: 6, hoehe: 2 },
    ];
    const { x, z } = kollisionLoesen(-0.7, -0.7, 0.5, ecke);
    // Danach darf keine Überschneidung mehr bestehen.
    for (const k of ecke) {
      expect(ausKastenSchieben(x, z, 0.5, k)).toBeNull();
    }
  });

  it('ignoriert, worauf man schon draufsteht', () => {
    const tonne: Kasten[] = [{ x: 0, z: 0, breite: 2, tiefe: 2, hoehe: 1.3 }];
    // Am Boden: wird weggeschoben.
    expect(kollisionLoesen(0.2, 0, 0.5, tonne, 0).x).not.toBeCloseTo(0.2, 3);
    // Oben drauf: bleibt stehen.
    const oben = kollisionLoesen(0.2, 0, 0.5, tonne, 1.3);
    expect(oben.x).toBeCloseTo(0.2, 5);
    expect(oben.z).toBeCloseTo(0, 5);
  });
});

describe('Bewegung', () => {
  it('startet am Spawn und steht still', () => {
    const s = spielerAmStart(WOHNVIERTEL);
    expect(s.x).toBe(WOHNVIERTEL.spawn.x);
    expect(s.z).toBe(WOHNVIERTEL.spawn.z);
    expect(s.tempo).toBe(0);
    expect(s.amBoden).toBe(true);
  });

  it('läuft in die Richtung, die gedrückt wird', () => {
    const s = laufen(spielerAmStart(WOHNVIERTEL), { x: 1, z: 0 }, 1);
    expect(s.x).toBeGreaterThan(WOHNVIERTEL.spawn.x + 2);
    expect(s.z).toBeCloseTo(WOHNVIERTEL.spawn.z, 1);
  });

  it('rennt schneller als es geht', () => {
    const start = spielerAmStart(WOHNVIERTEL);
    const gegangen = laufen(start, { x: 0, z: 1 }, 1.5);
    const gerannt = laufen(start, { x: 0, z: 1, rennen: true }, 1.5);
    expect(gerannt.z - start.z).toBeGreaterThan(gegangen.z - start.z);
    expect(gegangen.tempo).toBeCloseTo(GEH_TEMPO, 1);
    expect(gerannt.tempo).toBeCloseTo(RENN_TEMPO, 1);
  });

  it('bremst bis zum Stillstand, wenn nichts gedrückt wird', () => {
    let s = laufen(spielerAmStart(WOHNVIERTEL), { x: 1, z: 0, rennen: true }, 1);
    expect(s.tempo).toBeGreaterThan(1);
    s = laufen(s, {}, 1);
    expect(s.tempo).toBe(0);
  });

  it('dreht sich zur Laufrichtung, statt zu springen', () => {
    const start = { ...spielerAmStart(WOHNVIERTEL), blick: 0 };
    // Ein einzelner kleiner Schritt darf die Blickrichtung nicht schon
    // ganz umlegen — sonst ruckt die Figur bei jedem Richtungswechsel.
    const einSchritt = takt(start, { ...KEINE_EINGABE, x: -1, z: 0 }, WOHNVIERTEL, 1 / 60, KAESTEN);
    expect(Math.abs(einSchritt.blick)).toBeLessThan(Math.PI * 0.9);
    // Nach längerem Laufen zeigt sie aber wirklich dorthin.
    const laenger = laufen(start, { x: -1, z: 0 }, 1);
    expect(Math.abs(Math.abs(laenger.blick) - Math.PI)).toBeLessThan(0.05);
  });

  it('bleibt innerhalb der Zone', () => {
    for (const richtung of [
      { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
    ]) {
      const s = laufen(spielerAmStart(WOHNVIERTEL), { ...richtung, rennen: true }, 20);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(WOHNVIERTEL.grenze);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(WOHNVIERTEL.grenze);
    }
  });
});

describe('Springen', () => {
  it('hebt ab und landet wieder', () => {
    const start = spielerAmStart(WOHNVIERTEL);
    const abgehoben = takt(start, { ...KEINE_EINGABE, springen: true }, WOHNVIERTEL, 1 / 60, KAESTEN);
    expect(abgehoben.amBoden).toBe(false);
    expect(abgehoben.steigen).toBeGreaterThan(0);

    const gelandet = laufen(abgehoben, {}, 3);
    expect(gelandet.amBoden).toBe(true);
    expect(gelandet.y).toBeCloseTo(0, 5);
  });

  it('springt nicht ein zweites Mal in der Luft', () => {
    let s = takt(
      spielerAmStart(WOHNVIERTEL),
      { ...KEINE_EINGABE, springen: true },
      WOHNVIERTEL,
      1 / 60,
      KAESTEN,
    );
    const hoehePunkt = s.steigen;
    // Nochmal drücken, während sie fliegt.
    s = takt(s, { ...KEINE_EINGABE, springen: true }, WOHNVIERTEL, 1 / 60, KAESTEN);
    expect(s.steigen).toBeLessThan(hoehePunkt);
  });

  it('kommt hoch genug auf die Mülltonne', () => {
    // Die Sammelstücke auf 2,1 Metern setzen voraus, dass ein Sprung von
    // 1,3 Metern Tonnenhöhe aus überhaupt möglich ist. Ohne diesen Test
    // wären zwei Sammelstücke stillschweigend unerreichbar.
    const scheitel = (SPRUNG_KRAFT * SPRUNG_KRAFT) / (2 * 22);
    expect(scheitel).toBeGreaterThan(1.3);
  });

  it('landet auf der Mülltonne statt hindurchzufallen', () => {
    const tonne = WOHNVIERTEL.sperren.find((k) => k.hoehe === 1.3)!;
    let s: Spieler = {
      ...spielerAmStart(WOHNVIERTEL),
      x: tonne.x,
      z: tonne.z,
      y: 3,
      steigen: 0,
      amBoden: false,
    };
    s = laufen(s, {}, 2);
    expect(s.y).toBeCloseTo(1.3, 5);
    expect(s.amBoden).toBe(true);
  });
});

describe('Die Welt hält, was sie verspricht', () => {
  it('lässt niemanden durch ein Haus laufen', () => {
    // Von acht Startpunkten rund um jedes Haus stur dagegenlaufen.
    for (const h of WOHNVIERTEL.haeuser) {
      for (let i = 0; i < 8; i++) {
        const winkel = (i / 8) * Math.PI * 2;
        const abstand = Math.max(h.breite, h.tiefe) / 2 + 4;
        const start: Spieler = {
          ...spielerAmStart(WOHNVIERTEL),
          x: h.x + Math.cos(winkel) * abstand,
          z: h.z + Math.sin(winkel) * abstand,
        };
        // Richtung Hausmitte rennen.
        const s = laufen(start, { x: -Math.cos(winkel), z: -Math.sin(winkel), rennen: true }, 3);
        const drinX = Math.abs(s.x - h.x) < h.breite / 2 - 0.05;
        const drinZ = Math.abs(s.z - h.z) < h.tiefe / 2 - 0.05;
        expect(drinX && drinZ).toBe(false);
      }
    }
  });

  it('gleitet an einer Wand entlang, statt zu kleben', () => {
    const h = WOHNVIERTEL.haeuser[0]!;
    // Direkt vor der Südwand stehen und schräg dagegenlaufen.
    const start: Spieler = {
      ...spielerAmStart(WOHNVIERTEL),
      x: h.x,
      z: h.z + h.tiefe / 2 + FIGUR_RADIUS + 0.05,
    };
    const s = laufen(start, { x: 1, z: -1, rennen: true }, 1.2);
    // Sie darf nicht in die Wand, muss aber seitlich vorangekommen sein.
    expect(s.x - start.x).toBeGreaterThan(2);
  });

  it('hat alle Sammelstücke innerhalb der Zone und außerhalb von Wänden', () => {
    for (const s of WOHNVIERTEL.sammelstuecke) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(WOHNVIERTEL.grenze);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(WOHNVIERTEL.grenze);
      for (const h of WOHNVIERTEL.haeuser) {
        const drin =
          Math.abs(s.x - h.x) < h.breite / 2 && Math.abs(s.z - h.z) < h.tiefe / 2;
        expect(drin).toBe(false);
      }
    }
  });

  it('hat eindeutige Namen für Sammelstücke und NPCs', () => {
    const ids = WOHNVIERTEL.sammelstuecke.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const npc = WOHNVIERTEL.npcs.map((n) => n.id);
    expect(new Set(npc).size).toBe(npc.length);
  });

  it('setzt niemanden in eine Wand — auch keinen NPC', () => {
    for (const n of [...WOHNVIERTEL.npcs, WOHNVIERTEL.spawn as { x: number; z: number }]) {
      const geloest = kollisionLoesen(n.x, n.z, FIGUR_RADIUS, KAESTEN);
      expect(Math.hypot(geloest.x - n.x, geloest.z - n.z)).toBeLessThan(0.01);
    }
  });

  it('meldet die Bodenhöhe nur auf niedrigen Dingen', () => {
    expect(bodenhoehe(WOHNVIERTEL, 0, 0)).toBe(0);
    const tonne = WOHNVIERTEL.sperren.find((k) => k.hoehe === 1.3)!;
    expect(bodenhoehe(WOHNVIERTEL, tonne.x, tonne.z)).toBe(1.3);
    // Auf einem Haus steht man nicht.
    const h = WOHNVIERTEL.haeuser[0]!;
    expect(bodenhoehe(WOHNVIERTEL, h.x, h.z)).toBe(0);
  });
});

describe('Aufsammeln und Ansprechen', () => {
  const stueck = { id: 'a', x: 0, y: 1.1, z: 0 };

  it('sammelt ein, was nah genug ist', () => {
    const s: Spieler = { ...spielerAmStart(WOHNVIERTEL), x: 0, z: 0.5, y: 0 };
    expect(eingesammelt(s, [stueck], new Set())).toEqual(['a']);
  });

  it('sammelt nichts ein, was zu weit weg ist', () => {
    const s: Spieler = { ...spielerAmStart(WOHNVIERTEL), x: 0, z: AUFSAMMEL_ABSTAND + 0.3, y: 0 };
    expect(eingesammelt(s, [stueck], new Set())).toEqual([]);
  });

  it('sammelt nichts zweimal ein', () => {
    const s: Spieler = { ...spielerAmStart(WOHNVIERTEL), x: 0, z: 0, y: 0 };
    expect(eingesammelt(s, [stueck], new Set(['a']))).toEqual([]);
  });

  it('erreicht ein hoch liegendes Stück nur im Sprung', () => {
    const hoch = { id: 'b', x: 0, y: 2.1, z: 0 };
    const unten: Spieler = { ...spielerAmStart(WOHNVIERTEL), x: 0, z: 0, y: 0 };
    expect(eingesammelt(unten, [hoch], new Set())).toEqual([]);
    const oben: Spieler = { ...unten, y: 1.3 };
    expect(eingesammelt(oben, [hoch], new Set())).toEqual(['b']);
  });

  it('findet den nächsten NPC, aber nur in Reichweite', () => {
    const npcs = [
      { id: 'weit', x: 20, z: 0 },
      { id: 'nah', x: 1.5, z: 0 },
      { id: 'näher', x: 0.8, z: 0 },
    ];
    const s: Spieler = { ...spielerAmStart(WOHNVIERTEL), x: 0, z: 0 };
    expect(naechsterNpc(s, npcs)?.id).toBe('näher');
    const allein: Spieler = { ...s, x: -50 };
    expect(naechsterNpc(allein, npcs)).toBeNull();
  });
});

describe('Zeitschritt', () => {
  it('deckelt große Schritte, damit niemand durch Wände fährt', () => {
    const start = spielerAmStart(WOHNVIERTEL);
    // Fünf Sekunden auf einmal — nach einem App-Wechsel realistisch.
    const s = takt(start, { ...KEINE_EINGABE, x: 0, z: -1, rennen: true }, WOHNVIERTEL, 5, KAESTEN);
    const weg = Math.hypot(s.x - start.x, s.z - start.z);
    // Höchstens ein Schritt aus 50 ms bei Höchsttempo.
    expect(weg).toBeLessThanOrEqual(RENN_TEMPO * 0.05 + 0.001);
  });

  it('verträgt einen Zeitschritt von null', () => {
    const start = spielerAmStart(WOHNVIERTEL);
    const s = takt(start, { ...KEINE_EINGABE, x: 1, z: 0 }, WOHNVIERTEL, 0, KAESTEN);
    expect(s.x).toBeCloseTo(start.x, 6);
    expect(Number.isFinite(s.y)).toBe(true);
  });
});

describe('Missionsgegenstände liegen erreichbar', () => {
  it('steht kein Werkzeug in einer Wand oder außerhalb der Zone', () => {
    for (const w of WOHNVIERTEL.werkzeuge) {
      expect(Math.abs(w.x)).toBeLessThanOrEqual(WOHNVIERTEL.grenze);
      expect(Math.abs(w.z)).toBeLessThanOrEqual(WOHNVIERTEL.grenze);
      const geloest = kollisionLoesen(w.x, w.z, FIGUR_RADIUS, KAESTEN);
      expect(Math.hypot(geloest.x - w.x, geloest.z - w.z)).toBeLessThan(0.01);
    }
  });

  it('hat eindeutige Namen, die sich nicht mit Sternen überschneiden', () => {
    const wz = WOHNVIERTEL.werkzeuge.map((w) => w.id);
    expect(new Set(wz).size).toBe(wz.length);
    const sterne = new Set(WOHNVIERTEL.sammelstuecke.map((s) => s.id));
    for (const id of wz) expect(sterne.has(id)).toBe(false);
  });

  it('liegt jedes Werkzeug tief genug, um es im Gehen mitzunehmen', () => {
    for (const w of WOHNVIERTEL.werkzeuge) {
      const s: Spieler = { ...spielerAmStart(WOHNVIERTEL), x: w.x, z: w.z, y: 0 };
      expect(eingesammelt(s, [w], new Set())).toEqual([w.id]);
    }
  });
});
