import { describe, expect, it } from 'vitest';
import { GRABEN_BODEN, STRECKE_LAENGE, bodenHoehe, gelaendeBauen, lueckeEnde, lueckeKante, streckenSaat } from './logik';
import { gelaendeProfil, profilWaende } from './profil';

const SAATEN = Array.from({ length: 12 }, (_, i) => streckenSaat(i + 1));

describe('Geländeprofil', () => {
  it('beginnt und endet an den verlangten Stellen', () => {
    const g = gelaendeBauen(SAATEN[0]!);
    const p = gelaendeProfil(g, -4, STRECKE_LAENGE + 12);
    expect(p[0]!.x).toBe(-4);
    expect(p[p.length - 1]!.x).toBeGreaterThanOrEqual(STRECKE_LAENGE + 11.99);
  });

  it('läuft nie rückwärts und hat keine ungültigen Werte', () => {
    for (const saat of SAATEN) {
      const g = gelaendeBauen(saat);
      const p = gelaendeProfil(g, -4, STRECKE_LAENGE + 12);
      for (let i = 1; i < p.length; i++) {
        expect(p[i]!.x, `Saat ${saat}, Punkt ${i}`).toBeGreaterThanOrEqual(p[i - 1]!.x);
      }
      for (const q of p) {
        expect(Number.isFinite(q.x)).toBe(true);
        expect(Number.isFinite(q.y)).toBe(true);
      }
    }
  });

  it('stimmt an jedem Rasterpunkt mit der Bodenhöhe der Logik überein', () => {
    for (const saat of SAATEN) {
      const g = gelaendeBauen(saat);
      const p = gelaendeProfil(g, 0, STRECKE_LAENGE);
      for (const q of p) {
        // Auf einer Kante gibt es zwei Höhen (oben und unten); eine davon muss die Logik treffen.
        const h = bodenHoehe(g, q.x);
        const aufKante = g.luecken.some((l) => q.x === lueckeKante(l) || q.x === lueckeEnde(l));
        if (!aufKante) expect(q.y, `Saat ${saat}, x=${q.x}`).toBeCloseTo(h, 9);
      }
    }
  });

  it('setzt an jeder Lücke vier Eckpunkte mit senkrechten Wänden', () => {
    for (const saat of SAATEN) {
      const g = gelaendeBauen(saat);
      const p = gelaendeProfil(g, 0, STRECKE_LAENGE);
      const waende = profilWaende(p);
      for (const l of g.luecken) {
        const kante = waende.find((w) => w.x === lueckeKante(l));
        const ende = waende.find((w) => w.x === lueckeEnde(l));
        expect(kante, `Saat ${saat}: Kante bei ${lueckeKante(l)}`).toBeDefined();
        expect(ende, `Saat ${saat}: Gegenseite bei ${lueckeEnde(l)}`).toBeDefined();
        expect(kante!.unten).toBe(GRABEN_BODEN);
        expect(kante!.oben).toBeCloseTo(l.hoehe + bodenGrund(g, lueckeKante(l)), 6);
        expect(ende!.unten).toBe(GRABEN_BODEN);
        expect(ende!.oben).toBeGreaterThan(GRABEN_BODEN);
      }
    }
  });

  it('lässt im Graben keine Rasterpunkte zwischen den Wänden stehen', () => {
    for (const saat of SAATEN) {
      const g = gelaendeBauen(saat);
      const p = gelaendeProfil(g, 0, STRECKE_LAENGE);
      for (const l of g.luecken) {
        const dazwischen = p.filter((q) => q.x > lueckeKante(l) && q.x < lueckeEnde(l));
        expect(dazwischen.length, `Saat ${saat}`).toBe(0);
        // Und genau die vier Eckpunkte sind da.
        const aufKanten = p.filter((q) => q.x === lueckeKante(l) || q.x === lueckeEnde(l));
        expect(aufKanten.length).toBe(4);
      }
    }
  });

  it('hat ohne Lücken keine Wände', () => {
    const g = { ...gelaendeBauen(SAATEN[0]!), luecken: [] };
    expect(profilWaende(gelaendeProfil(g, 0, 200))).toEqual([]);
  });

  it('wächst mit der Länge, nicht mit der Zahl der Lücken: rund vier Punkte je Meter', () => {
    const g = gelaendeBauen(SAATEN[0]!);
    const p = gelaendeProfil(g, 0, STRECKE_LAENGE);
    expect(p.length).toBeGreaterThan(STRECKE_LAENGE * 3);
    expect(p.length).toBeLessThan(STRECKE_LAENGE * 5);
  });
});

/** Die Höhe der Rampe an der Kante ist der Boden darunter plus `hoehe` — hier der Boden darunter. */
function bodenGrund(g: ReturnType<typeof gelaendeBauen>, x: number): number {
  const ohne = { ...g, luecken: [] };
  return bodenHoehe(ohne, x);
}
