import { describe, it, expect } from 'vitest';
import { rng } from '../../core/rng';
import { FORMEN, aufloesen, legen, leeresRaster, passtAn, volleZeilenUndSpalten } from './logik';
import type { Raster } from './logik';
import { ersteZuege, formMasken, legenMasken, loesbar, maskenAus } from './loeser';

/** Ein Brett aus Text: `#` belegt, alles andere leer. */
function brett(zeilen: readonly string[]): Raster {
  return zeilen.map((z) => Array.from({ length: 8 }, (_, x) => (z[x] === '#' ? 0 : null)));
}

const einzel = FORMEN.find((f) => f.length === 1)!;
const domino = FORMEN.find((f) => f.length === 2 && f.every((v) => v.dy === 0))!;

function zufallsbrett(zufall: ReturnType<typeof rng>, dichte: number): Raster {
  let raster: Raster = leeresRaster();
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (zufall.zahl() < dichte) raster = legen(raster, [{ dx: 0, dy: 0 }], x, y, 0);
    }
  }
  return raster;
}

describe('formMasken / maskenAus', () => {
  it('legt eine L-Form ganz links in Zeilenmasken', () => {
    const l = FORMEN.find((f) => f.length === 4 && f.some((v) => v.dx === 0 && v.dy === 0) && f.some((v) => v.dy === 1 && v.dx === 2))!;
    const m = formMasken(l);
    expect(m.breite).toBe(3);
    expect(m.hoehe).toBe(2);
    expect(m.zeilen).toEqual([0b001, 0b111]);
  });

  it('übersetzt ein Raster in ein Bit je belegtem Feld', () => {
    const m = maskenAus(brett(['#.......', '.......#', '........', '........', '........', '........', '........', '........']));
    expect(m.slice(0, 2)).toEqual([0b00000001, 0b10000000]);
    expect(m.slice(2).every((z) => z === 0)).toBe(true);
  });
});

describe('legenMasken — dieselbe Regel wie das Spiel', () => {
  // Der eigentliche Prüfstein: Der Löser rechnet auf Bits, das Spiel auf dem
  // Raster. Weichen beide auch nur in einem Fall voneinander ab, beweist
  // „lösbar" nichts mehr — der Löser stünde auf einem anderen Brett als die
  // Spieler. Deshalb viele zufällige, **dichte** Bretter: Auf leeren passiert
  // das Abräumen nie.
  it('gibt für jedes Brett, jede Form und jede Stelle dasselbe Ergebnis wie legen + aufloesen', () => {
    const zufall = rng(2024);
    let verglichen = 0;
    let abgeraeumt = 0;
    for (let versuch = 0; versuch < 1500; versuch++) {
      let raster = zufallsbrett(zufall, 0.2 + zufall.zahl() * 0.5);
      // Fast volle Reihen und Spalten, damit das Abräumen oft genug drankommt.
      for (let k = zufall.ganzzahl(3); k > 0; k--) {
        const linie = zufall.ganzzahl(8);
        const waagerecht = zufall.zahl() < 0.5;
        const luecken = new Set([zufall.ganzzahl(8), zufall.ganzzahl(8)]);
        for (let i = 0; i < 8; i++) {
          if (luecken.has(i)) continue;
          const x = waagerecht ? i : linie;
          const y = waagerecht ? linie : i;
          if (raster[y]![x] === null) raster = legen(raster, [{ dx: 0, dy: 0 }], x, y, 0);
        }
      }
      const form = zufall.waehlen(FORMEN);
      const frei: [number, number][] = [];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (passtAn(raster, form, x, y)) frei.push([x, y]);
      const m = formMasken(form);
      if (frei.length === 0) {
        // Nirgends frei: Der Löser muss an einer beliebigen Stelle ablehnen.
        expect(legenMasken(maskenAus(raster), m, zufall.ganzzahl(8), zufall.ganzzahl(8))).toBeNull();
        continue;
      }
      const [x, y] = zufall.waehlen(frei);
      const nachLegen = legen(raster, form, x!, y!, 0);
      const { zeilen, spalten } = volleZeilenUndSpalten(nachLegen);
      if (zeilen.length + spalten.length > 0) abgeraeumt++;
      expect(legenMasken(maskenAus(raster), m, x!, y!)).toEqual([...maskenAus(aufloesen(nachLegen, zeilen, spalten))]);
      verglichen++;
    }
    // Der Test muss die Fälle, um die es geht, auch wirklich erzeugt haben.
    expect(verglichen).toBeGreaterThan(500);
    expect(abgeraeumt).toBeGreaterThan(100);
  });

  it('räumt Zeile und Spalte gemeinsam ab, auch wenn sie sich kreuzen', () => {
    // Zeile 0 und Spalte 0 sind bis auf die Ecke voll; ein Stein liegt abseits.
    const kreuz = brett([
      '.#######',
      '#.......',
      '#.......',
      '#.......',
      '#...#...',
      '#.......',
      '#.......',
      '#.......',
    ]);
    const m = legenMasken(maskenAus(kreuz), formMasken(einzel), 0, 0)!;
    // Beide Linien fallen zugleich, der Stein bleibt.
    expect(m).toEqual([0, 0, 0, 0, 0b10000, 0, 0, 0]);
  });

  it('lehnt eine Form ab, die über den Rand ragt oder auf Belegtem liegt', () => {
    const leer = maskenAus(leeresRaster());
    expect(legenMasken(leer, formMasken(domino), 7, 0)).toBeNull();
    expect(legenMasken(leer, formMasken(domino), -1, 0)).toBeNull();
    expect(legenMasken(leer, formMasken(domino), 0, 8)).toBeNull();
    const besetzt = maskenAus(brett(['#.......', '', '', '', '', '', '', '']));
    expect(legenMasken(besetzt, formMasken(einzel), 0, 0)).toBeNull();
  });
});

/**
 * Ein dichtes, aber **spielechtes** Brett: In jeder Zeile und jeder Spalte
 * liegen zwei freie Felder (`(i, i)` und `(i+2, i)`), nirgends zwei nebeneinander.
 * Kein Domino passt hinein; ein einzelnes Einzelteil vervollständigt noch keine
 * Linie — erst das zweite in derselben Zeile.
 */
const loecherBrett = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 8 }, (_, x) => (x === i || x === (i + 2) % 8 ? '.' : '#')).join(''),
);

describe('loesbar', () => {
  it('ist auf einem leeren Brett für jedes Tablett wahr', () => {
    const grosses = FORMEN.reduce((a, b) => (b.length > a.length ? b : a));
    expect(loesbar(maskenAus(leeresRaster()), [formMasken(grosses), formMasken(grosses), formMasken(grosses)])).toBe(true);
  });

  it('ist ohne Teile wahr', () => {
    expect(loesbar(maskenAus(brett(loecherBrett)), [])).toBe(true);
  });

  it('ist falsch, wenn ein Teil nirgends passt', () => {
    expect(loesbar(maskenAus(brett(loecherBrett)), [formMasken(domino)])).toBe(false);
  });

  it('ist falsch, wenn die Teile zusammen nicht unterkommen', () => {
    // Das Einzelteil füllt ein Loch, aber keine Linie — danach ist immer noch
    // kein Platz für das Domino.
    expect(loesbar(maskenAus(brett(loecherBrett)), [formMasken(einzel), formMasken(domino)])).toBe(false);
  });

  it('rechnet das Abräumen mit: Das zweite Einzelteil schließt eine Zeile und macht Platz', () => {
    // Beide Einzelteile in dieselbe Zeile: Sie fällt, acht freie Felder liegen
    // nebeneinander, das Domino passt. Dafür muss der Löser das zweite Einzelteil
    // in das **passende** Loch legen — nicht in irgendeins.
    const tablett = [formMasken(einzel), formMasken(einzel), formMasken(domino)];
    expect(loesbar(maskenAus(brett(loecherBrett)), tablett)).toBe(true);
  });

  it('kommt bei einem Domino zuerst im Tablett genauso zum Ergebnis', () => {
    const tablett = [formMasken(domino), formMasken(einzel), formMasken(einzel)];
    expect(loesbar(maskenAus(brett(loecherBrett)), tablett)).toBe(true);
  });
});

/**
 * Dieselbe Frage noch einmal, aber auf dem **Raster** mit den Regeln aus
 * `logik.ts` (`passtAn`, `legen`, `aufloesen`) und ohne jede Maske. Eine
 * Prüfung, die dieselbe Rechnung benutzt wie der geprüfte Code, prüft nichts —
 * deshalb steht hier eine zweite, bewusst langsame und einfache Fassung.
 */
function loesbarAufRaster(raster: Raster, formen: readonly (typeof FORMEN)[number][]): boolean {
  if (formen.length === 0) return true;
  for (let i = 0; i < formen.length; i++) {
    const rest = formen.filter((_, j) => j !== i);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (!passtAn(raster, formen[i]!, x, y)) continue;
        const nach = legen(raster, formen[i]!, x, y, 0);
        const { zeilen, spalten } = volleZeilenUndSpalten(nach);
        if (loesbarAufRaster(aufloesen(nach, zeilen, spalten), rest)) return true;
      }
    }
  }
  return false;
}

describe('loesbar und ersteZuege gegen die Spielregel', () => {
  it('urteilt auf zufälligen Brettern wie die langsame Rasterfassung', () => {
    const zufall = rng(77);
    let wahr = 0;
    let falsch = 0;
    for (let versuch = 0; versuch < 250; versuch++) {
      const raster = zufallsbrett(zufall, 0.5 + zufall.zahl() * 0.42);
      const anzahl = 1 + zufall.ganzzahl(3);
      const formen = Array.from({ length: anzahl }, () => zufall.waehlen(FORMEN));
      const erwartet = loesbarAufRaster(raster, formen);
      expect(loesbar(maskenAus(raster), formen.map(formMasken))).toBe(erwartet);
      if (erwartet) wahr++;
      else falsch++;
    }
    // Beide Antworten müssen vorkommen, sonst prüft der Test nur eine Seite.
    expect(wahr).toBeGreaterThan(20);
    expect(falsch).toBeGreaterThan(20);
  });

  it('zählt die guten ersten Züge so wie die Rasterfassung', () => {
    const zufall = rng(91);
    for (let versuch = 0; versuch < 60; versuch++) {
      const raster = zufallsbrett(zufall, 0.4 + zufall.zahl() * 0.45);
      const formen = Array.from({ length: 3 }, () => zufall.waehlen(FORMEN));
      let zuege = 0;
      let gut = 0;
      formen.forEach((form, i) => {
        const rest = formen.filter((_, j) => j !== i);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            if (!passtAn(raster, form, x, y)) continue;
            zuege++;
            const nach = legen(raster, form, x, y, 0);
            const { zeilen, spalten } = volleZeilenUndSpalten(nach);
            if (loesbarAufRaster(aufloesen(nach, zeilen, spalten), rest)) gut++;
          }
        }
      });
      expect(ersteZuege(maskenAus(raster), formen.map(formMasken))).toEqual({ zuege, gut });
    }
  });
});

describe('ersteZuege', () => {
  it('zählt auf einem leeren Brett jeden ersten Zug als gut', () => {
    const { zuege, gut } = ersteZuege(maskenAus(leeresRaster()), [formMasken(einzel), formMasken(einzel), formMasken(domino)]);
    expect(zuege).toBeGreaterThan(0);
    expect(gut).toBe(zuege);
  });

  it('zählt Züge, die ins Leere laufen: Auf dem Löcherbrett ist nach dem Einzelteil nichts mehr zu retten', () => {
    // 16 Löcher, 16 mögliche Züge für das Einzelteil, keiner für das Domino —
    // und keiner führt zum Ziel.
    expect(ersteZuege(maskenAus(brett(loecherBrett)), [formMasken(einzel), formMasken(domino)])).toEqual({
      zuege: 16,
      gut: 0,
    });
  });

  it('zählt mit zwei Einzelteilen jeden Zug als gut, weil das zweite stets die Zeile schließen kann', () => {
    const { zuege, gut } = ersteZuege(maskenAus(brett(loecherBrett)), [
      formMasken(einzel),
      formMasken(einzel),
      formMasken(domino),
    ]);
    expect(zuege).toBe(32);
    expect(gut).toBe(32);
  });
});
