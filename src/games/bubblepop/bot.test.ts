import { beforeAll, describe, it, expect } from 'vitest';
import { SENKRECHT, flugbahn } from './geometrie';
import { andocken, neuesSpiel } from './logik';
import { spielen } from './bot';
import type { Lauf } from './bot';

/**
 * Der Bot ist der Beleg für die Spielbarkeit — dieselbe Rolle wie der einfache Spieler in Ring Rise.
 * Er sieht nur einen Schuss voraus und zielt auf drei Grad genau; wer ihn schlägt, ist nicht der Maßstab,
 * aber wer an ihm scheitert, muss das Spiel ändern.
 *
 * Gemessen (zwölf Saaten, 3 Grad, bis zu 400 Schüsse): Mit Spezialkugeln erreicht er Etappe 3 bis 10
 * (Mitte etwa 7), ohne sie Etappe 3 bis 6 — jeder Lauf endet vor Schuss 300. Das ist die Spanne, in der
 * ein Spiel mit vielen Etappen noch eine Aufgabe ist und keine Beschäftigung.
 */
const SAATEN = [1, 2, 3].map((n) => n * 7919);
const SCHUESSE = 110;

let mit: Lauf[] = [];
let ohne: Lauf[] = [];

beforeAll(() => {
  mit = SAATEN.map((saat) => spielen(neuesSpiel(saat), SCHUESSE, true));
  ohne = SAATEN.map((saat) => spielen(neuesSpiel(saat), SCHUESSE, false));
}, 120000);

describe('der einfache Spieler', () => {
  it('räumt die erste Etappe in jeder Saat leer — und zwar mit gezielten Schüssen', () => {
    for (const [i, lauf] of mit.entries()) {
      expect(lauf.z.etappe, `Saat ${SAATEN[i]}`).toBeGreaterThanOrEqual(2);
      expect(lauf.etappenSchuesse[0], `Saat ${SAATEN[i]}`).toBeLessThanOrEqual(60);
    }
  });

  it('kommt mit den Spezialkugeln weiter als ohne', () => {
    const punkte = (laeufe: Lauf[]) => laeufe.reduce((summe, l) => summe + l.z.punkte, 0);
    expect(punkte(mit)).toBeGreaterThan(punkte(ohne));
  });

  it('verdient Spezialkugeln und setzt sie ein', () => {
    const verdient = mit.reduce((n, l) => n + l.verdientBombe + l.verdientRegenbogen, 0);
    const benutzt = mit.reduce((n, l) => n + l.bomben + l.regenbogen, 0);
    expect(verdient).toBeGreaterThan(0);
    expect(benutzt).toBeGreaterThan(0);
    // Ohne Spezialkugeln im Einsatz bleibt nur der Vorrat liegen.
    expect(ohne.every((l) => l.bomben + l.regenbogen === 0)).toBe(true);
  });
});

describe('einer, der nur senkrecht nach oben schießt', () => {
  it('verliert in jeder Saat — blindes Schießen reicht nicht, das Spiel ist nicht endlos', () => {
    for (const saat of SAATEN) {
      let z = neuesSpiel(saat);
      for (let i = 0; i < 400 && !z.vorbei; i++) {
        const ziel = flugbahn(z.wabe, SENKRECHT).ziel;
        if (!ziel) break;
        const e = andocken(z, ziel);
        if (e.zustand === z) break;
        z = e.zustand;
      }
      expect(z.vorbei, `Saat ${saat}`).toBe(true);
    }
  });
});
