import { describe, expect, it } from 'vitest';
import {
  GRABEN_BODEN,
  KEINE_EINGABE,
  TEMPO_MAX,
  bodenHoehe,
  bodenWinkel,
  lueckeEnde,
  lueckeKante,
  neuesSpiel,
  streckenSaat,
  takt,
} from './logik';
import type { Eingabe, Lauf } from './logik';
import { RAD_RADIUS, neuerRig, rigSchritt } from './rig';

const DT = 1 / 60;
const GAS: Eingabe = { gas: true, bremse: false, lehnen: 0 };
const SAAT = streckenSaat(3);

/** Ein Lauf, der an einer Stelle auf dem Boden steht. */
function lauf(x: number, tempo = 0): Lauf {
  const start = neuesSpiel(SAAT);
  return { ...start, x, y: bodenHoehe(start.gelaende, x), vx: tempo, winkel: bodenWinkel(start.gelaende, x) };
}

describe('Darstellungszustand', () => {
  it('springt im ersten Bild auf die Kamera-Position und löst keine Funken aus', () => {
    const z = neuerRig();
    const l = { ...lauf(40, 10), geholt: new Set([0, 1, 2]) };
    const a = rigSchritt(z, l, DT);
    expect(z.kameraX).toBeGreaterThan(40);
    expect(z.kameraGesetzt).toBe(true);
    expect(a.effekte.filter((e) => e.art === 'funken')).toEqual([]);
  });

  it('zeigt eine eingesammelte Münze genau einmal als Funken', () => {
    const z = neuerRig();
    const l0 = lauf(40, 10);
    rigSchritt(z, l0, DT);
    const l1 = { ...l0, geholt: new Set([0]) };
    const a1 = rigSchritt(z, l1, DT);
    expect(a1.effekte.filter((e) => e.art === 'funken').length).toBe(1);
    const a2 = rigSchritt(z, l1, DT);
    expect(a2.effekte.filter((e) => e.art === 'funken').length).toBe(0);
  });

  it('vergisst die Münzen bei einem neuen Lauf, ohne einen Funkenregen auszulösen', () => {
    const z = neuerRig();
    const l0 = { ...lauf(40, 10), geholt: new Set([0, 1, 2, 3]) };
    rigSchritt(z, l0, DT);
    // Neuer Lauf: weniger eingesammelt als zuvor bekannt.
    const l1 = { ...lauf(40, 10), geholt: new Set<number>() };
    const a = rigSchritt(z, l1, DT);
    expect(a.effekte.filter((e) => e.art === 'funken')).toEqual([]);
    expect(z.bekanntMuenzen.size).toBe(0);
  });

  it('federt bei einer harten Landung ein und klingt wieder ab', () => {
    const z = neuerRig();
    const l0 = { ...lauf(40, 12), vy: -10, amBoden: false };
    rigSchritt(z, l0, DT);
    const gelandet = { ...l0, vy: 0, amBoden: true };
    const a = rigSchritt(z, gelandet, DT);
    expect(z.federVorn).toBeGreaterThan(0.4);
    expect(z.federHinten).toBeGreaterThan(z.federVorn * 0.9);
    expect(a.effekte.some((e) => e.art === 'erde')).toBe(true);
    for (let i = 0; i < 90; i++) rigSchritt(z, gelandet, DT);
    expect(z.federVorn).toBe(0);
    expect(z.federHinten).toBe(0);
  });

  it('wackelt nur bei einem echten Einschlag', () => {
    const z = neuerRig();
    rigSchritt(z, { ...lauf(40, 12), vy: -2, amBoden: false }, DT);
    rigSchritt(z, { ...lauf(40, 12), vy: 0, amBoden: true }, DT);
    expect(z.schuettel).toBe(0);
    const hart = neuerRig();
    rigSchritt(hart, { ...lauf(40, 12), vy: -12, amBoden: false }, DT);
    rigSchritt(hart, { ...lauf(40, 12), vy: 0, amBoden: true }, DT);
    expect(hart.schuettel).toBeGreaterThan(0.3);
  });

  it('steht bei Tempo und in der Luft, sitzt bei langsamer Fahrt', () => {
    const z = neuerRig();
    for (let i = 0; i < 120; i++) rigSchritt(z, lauf(40, 2), DT);
    expect(z.stehen).toBeLessThan(0.05);
    for (let i = 0; i < 120; i++) rigSchritt(z, lauf(40, 14), DT);
    expect(z.stehen).toBeGreaterThan(0.95);
    const luft = neuerRig();
    for (let i = 0; i < 120; i++) rigSchritt(luft, { ...lauf(40, 2), amBoden: false }, DT);
    expect(luft.stehen).toBeGreaterThan(0.95);
  });

  it('dreht die Räder mit dem Tempo und rückwärts beim Zurückrollen', () => {
    const z = neuerRig();
    rigSchritt(z, lauf(40, 10), 1);
    expect(z.radDrehung).toBeCloseTo(10 / RAD_RADIUS, 6);
    const r = neuerRig();
    rigSchritt(r, lauf(40, -3), 0.5);
    expect(r.radDrehung).toBeLessThan(0);
  });

  it('wächst die Sicht mit dem Tempo', () => {
    const langsam = rigSchritt(neuerRig(), lauf(40, 0), DT).sicht;
    const schnell = rigSchritt(neuerRig(), lauf(40, TEMPO_MAX), DT).sicht;
    expect(schnell).toBeGreaterThan(langsam);
  });

  it('lässt keinen Sturzfahrer entstehen, solange der Lauf nicht verloren ist', () => {
    const z = neuerRig();
    for (let i = 0; i < 60; i++) rigSchritt(z, lauf(40, 12), DT);
    expect(z.sturz).toBeNull();
    // Ein gewonnener Lauf ist vorbei, aber kein Sturz.
    rigSchritt(z, { ...lauf(40, 12), vorbei: true, gewonnen: true }, DT);
    expect(z.sturz).toBeNull();
  });
});

describe('Der Sturzfahrer', () => {
  /** Fährt ohne Absprung in die erste Lücke, bis der Sturz gezählt ist; danach läuft die Darstellung weiter. */
  function sturzInLuecke() {
    const start = neuesSpiel(SAAT);
    const l = start.gelaende.luecken[0]!;
    let z: Lauf = { ...start, x: l.x0 - 1, y: bodenHoehe(start.gelaende, l.x0 - 1), vx: TEMPO_MAX, winkel: bodenWinkel(start.gelaende, l.x0 - 1) };
    const rig = neuerRig();
    const spur: { x: number; y: number; schlaff: number }[] = [];
    for (let i = 0; i < 400; i++) {
      z = takt(z, DT, z.vorbei ? KEINE_EINGABE : GAS);
      rigSchritt(rig, z, DT);
      if (rig.sturz) spur.push({ x: rig.sturz.x, y: rig.sturz.y, schlaff: rig.sturz.schlaff });
    }
    return { l, rig, spur, z };
  }

  it('entsteht beim Sturz in der Nähe des Rades', () => {
    const { rig, spur, z } = sturzInLuecke();
    expect(z.vorbei && !z.gewonnen).toBe(true);
    expect(rig.sturz).not.toBeNull();
    expect(spur.length).toBeGreaterThan(100);
    // Der Sturz zählt, sobald das Rad im Graben ist — der Fahrer startet also irgendwo über ihm.
    const l = z.gelaende.luecken[0]!;
    const erster = spur[0]!;
    expect(erster.x).toBeGreaterThan(lueckeKante(l) - 1);
    expect(erster.x).toBeLessThan(lueckeEnde(l) + 2);
  });

  it('kommt zur Ruhe und liegt am Ende still', () => {
    const { rig, spur } = sturzInLuecke();
    const f = rig.sturz!;
    expect(f.schlaff).toBe(1);
    const n = spur.length;
    const vor = spur[n - 20]!;
    const nach = spur[n - 1]!;
    expect(Math.abs(nach.x - vor.x)).toBeLessThan(0.05);
    expect(Math.abs(nach.y - vor.y)).toBeLessThan(0.05);
  });

  it('geht nie durch die Wand der Gegenseite', () => {
    const { l, spur, z } = sturzInLuecke();
    const ende = lueckeEnde(l);
    const oben = bodenHoehe(z.gelaende, ende + 1e-6);
    // Wer die Linie der Wand überquert, muss über ihrer Oberkante sein — kein Tunneln.
    for (let i = 1; i < spur.length; i++) {
      const vor = spur[i - 1]!;
      const jetzt = spur[i]!;
      if (vor.x < ende && jetzt.x >= ende) {
        expect(jetzt.y, `x=${jetzt.x} y=${jetzt.y}`).toBeGreaterThanOrEqual(oben - 0.3 - 1e-6);
      }
    }
  });

  it('bleibt über dem Grund des Grabens', () => {
    const { spur } = sturzInLuecke();
    for (const p of spur) expect(p.y).toBeGreaterThanOrEqual(GRABEN_BODEN - 0.01);
  });

  it('schlägt nur einmal auf und wirft dabei Erde auf', () => {
    const start = neuesSpiel(SAAT);
    const l = start.gelaende.luecken[0]!;
    let z: Lauf = { ...start, x: l.x0 - 1, y: bodenHoehe(start.gelaende, l.x0 - 1), vx: TEMPO_MAX, winkel: bodenWinkel(start.gelaende, l.x0 - 1) };
    const rig = neuerRig();
    let erdeAbSturz = 0;
    for (let i = 0; i < 400; i++) {
      z = takt(z, DT, z.vorbei ? KEINE_EINGABE : GAS);
      const a = rigSchritt(rig, z, DT);
      if (z.vorbei) erdeAbSturz += a.effekte.filter((e) => e.art === 'erde' && e.zahl >= 9).length;
    }
    expect(erdeAbSturz).toBe(1);
  });
});
