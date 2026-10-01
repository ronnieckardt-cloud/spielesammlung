import { describe, expect, it } from 'vitest';
import { skelettBerechnen } from './fahrer';
import type { FahrerPose, Skelett } from './fahrer';
import { RADSTAND, RAD_R, radGeometrie } from './radgeo';

const OBERARM = 0.35;
const UNTERARM = 0.31;
const OBERSCHENKEL = 0.52;
const UNTERSCHENKEL = 0.5;

const abstand = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function haltung(werte: Partial<FahrerPose>, federVorn = 0, federHinten = 0): { s: Skelett; geo: ReturnType<typeof radGeometrie> } {
  const geo = radGeometrie(federVorn, federHinten);
  const pose: FahrerPose = { stehen: 0, hocke: 0, gewicht: 0, streck: 0, kurbel: 0, wind: 0, zeit: 0, ...werte };
  const s = skelettBerechnen({ m: 1, tretlager: geo.tretlager, sattel: geo.sitz, lenker: geo.lenker }, pose);
  return { s, geo };
}

describe('Maße des Rades', () => {
  it('lässt die Räder auf dem Boden stehen, auch wenn der Rahmen einfedert', () => {
    for (const f of [0, 0.5, 1]) {
      const g = radGeometrie(f, f);
      expect(g.nabeVorn.y).toBeCloseTo(-RAD_R, 9);
      expect(g.nabeHinten.y).toBeCloseTo(-RAD_R, 9);
      expect(g.nabeVorn.x - g.nabeHinten.x).toBeCloseTo(RADSTAND, 9);
    }
  });

  it('senkt den Rahmen beim Einfedern, nie hebt er sich', () => {
    const aus = radGeometrie(0, 0);
    const ein = radGeometrie(1, 1);
    // y zeigt nach unten: größer = tiefer.
    expect(ein.tretlager.y).toBeGreaterThan(aus.tretlager.y);
    expect(ein.sattel.y).toBeGreaterThan(aus.sattel.y);
    expect(ein.lenker.y).toBeGreaterThan(aus.lenker.y);
    expect(ein.steuerkopf.y).toBeGreaterThan(aus.steuerkopf.y);
  });

  it('hat eine flache Gabel: das Steuerrohr liegt deutlich hinter der Vorderradnabe', () => {
    const g = radGeometrie(0, 0);
    expect(g.nabeVorn.x - g.gabelOben.x).toBeGreaterThan(0.15);
    // Die Achse zeigt nach oben-hinten.
    expect(g.gabelAchse.y).toBeLessThan(0);
    expect(g.gabelAchse.x).toBeLessThan(0);
  });

  it('setzt den Sattel auf eine Stütze über dem Oberrohr', () => {
    const g = radGeometrie(0, 0);
    // Oberkante des Sattels deutlich über dem Knoten (y kleiner = höher).
    expect(g.sitz.y).toBeLessThan(g.sattel.y - 0.1);
    // Das Oberrohr setzt am Knoten an, nicht am Sattel.
    expect(g.oberEnde.x).toBeGreaterThan(g.sattel.x);
  });
});

describe('Der Fahrer auf dem Rad', () => {
  it('erreicht den Griff mit der Hand — in jeder Haltung, auch im Einfedern', () => {
    for (const stehen of [0, 0.5, 1]) {
      for (const gewicht of [-1, -0.5, 0, 0.5, 1]) {
        for (const hocke of [0, 0.5, 1]) {
          for (const streck of [0, 1]) {
            for (const feder of [0, 1]) {
              const { s, geo } = haltung({ stehen, gewicht, hocke, streck }, feder, feder);
              const reichweite = abstand(s.schulter, geo.lenker);
              const msg = `stehen ${stehen}, gewicht ${gewicht}, hocke ${hocke}, streck ${streck}, feder ${feder}: ${reichweite.toFixed(3)}`;
              // Nie weiter als der Arm lang ist (sonst greift die Hand ins Leere) ...
              expect(reichweite, msg).toBeLessThanOrEqual(OBERARM + UNTERARM + 1e-6);
              // ... und nie so nah, dass der Ellbogen weit vor die Hand springt.
              if (stehen === 1) expect(reichweite, msg).toBeGreaterThanOrEqual((OBERARM + UNTERARM) * 0.5);
            }
          }
        }
      }
    }
  });

  it('lässt den Unterarm nicht nach hinten zur Hand laufen (die Haltung „verkehrt herum")', () => {
    // Stehend, wie im Spiel auf dem Hang: Die Hand liegt nie hinter dem Ellbogen.
    for (const gewicht of [-0.5, 0, 0.5]) {
      const { s, geo } = haltung({ stehen: 1, gewicht, hocke: 0.12 });
      expect(geo.lenker.x, `gewicht ${gewicht}`).toBeGreaterThanOrEqual(s.ellbogenNah.x - 0.02);
    }
  });

  it('erreicht beide Pedale in jeder Kurbelstellung, sitzend', () => {
    for (let k = 0; k < 24; k++) {
      const kurbel = (k / 24) * Math.PI * 2;
      for (const feder of [0, 1]) {
        const { s } = haltung({ stehen: 0, kurbel }, feder, feder);
        expect(abstand(s.huefte, s.knoechelNah), `Kurbel ${k}`).toBeLessThanOrEqual(OBERSCHENKEL + UNTERSCHENKEL + 1e-6);
        expect(abstand(s.huefte, s.knoechelFern), `Kurbel ${k}`).toBeLessThanOrEqual(OBERSCHENKEL + UNTERSCHENKEL + 1e-6);
      }
    }
  });

  it('erreicht beide Pedale stehend in jeder Haltung', () => {
    for (const gewicht of [-1, 0, 1]) {
      for (const hocke of [0, 0.5, 1]) {
        for (const streck of [0, 1]) {
          const { s } = haltung({ stehen: 1, gewicht, hocke, streck });
          const msg = `gewicht ${gewicht}, hocke ${hocke}, streck ${streck}`;
          expect(abstand(s.huefte, s.knoechelNah), msg).toBeLessThanOrEqual(OBERSCHENKEL + UNTERSCHENKEL + 1e-6);
          expect(abstand(s.huefte, s.knoechelFern), msg).toBeLessThanOrEqual(OBERSCHENKEL + UNTERSCHENKEL + 1e-6);
        }
      }
    }
  });

  it('hat in keiner Haltung ein überstrecktes Bein (der Fuß bleibt auf dem Pedal)', () => {
    // Überstreckt heißt: Der Abstand liegt am Anschlag der Inversen Kinematik. Dann sitzt der Knöchel nicht mehr auf dem Pedal.
    for (const stehen of [0, 1]) {
      const { s, geo } = haltung({ stehen, kurbel: Math.PI / 2 });
      const pedal = s.pedalNah;
      expect(abstand(s.knoechelNah, { x: pedal.x - 0.04, y: pedal.y - 0.1 })).toBeLessThan(1e-9);
      expect(abstand(s.huefte, s.knoechelNah)).toBeLessThan((OBERSCHENKEL + UNTERSCHENKEL) * 0.995);
      expect(geo.tretlager).toBeDefined();
    }
  });
});
