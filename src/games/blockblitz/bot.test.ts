import { describe, it, expect } from 'vitest';
import { rng } from '../../core/rng';
import { neuesSpiel, etappeFuer, teilLegen, zurueck } from './logik';
import type { Zustand } from './logik';
import { formMasken, loesbar, maskenAus } from './loeser';
import { gierigerZug, sichererZug, unsichererZug, zufaelligerZug } from './bot';
import type { Zug } from './bot';

/**
 * Die Bots stellen die Schwierigkeit ein — und beweisen, dass sie fair ist.
 *
 * Ein Bot, der ein neues Spielsystem nur „durchspielt", beweist nichts: Er muss
 * an der richtigen Stelle scheitern. Hier sind das drei verschiedene Stellen:
 * Der **perfekte** Spieler darf nie sterben (jedes Ende ist vermeidbar), der
 * **gierige** muss irgendwann sterben (das Spiel ist nicht endlos), und er muss
 * auf höheren Etappen **früher** sterben (die Etappen bedeuten etwas).
 */

type Lauf = {
  zuege: number;
  tot: boolean;
  /** Wie viele Tabletts beim Austeilen nicht zu schaffen waren. */
  unloesbar: number;
  tabletts: number;
  etappe: number;
};

/**
 * Spielt eine Runde. `zug` wählt den Zug; `beiStillstand` darf einen Joker
 * einsetzen. Zählt bei jedem frisch ausgeteilten Tablett, ob es zu schaffen war.
 */
function spielen(
  saat: number,
  etappe: number,
  deckel: number,
  zug: (z: Zustand) => Zug,
  beiStillstand?: (z: Zustand) => Zustand,
): Lauf {
  let z = neuesSpiel(saat, etappe);
  let tabletts = 1;
  let unloesbar = loesbar(maskenAus(z.raster), z.tablett.map((t) => formMasken(t!.form))) ? 0 : 1;
  let zuege = 0;
  while (!z.vorbei && zuege < deckel) {
    if (z.festgefahren) {
      if (!beiStillstand) break;
      z = beiStillstand(z);
      continue;
    }
    const m = zug(z);
    const vorher = z.tablett.filter(Boolean).length;
    z = teilLegen(z, m.index, m.x, m.y);
    zuege++;
    if (vorher === 1 && z.tablett.every(Boolean)) {
      tabletts++;
      if (!loesbar(maskenAus(z.raster), z.tablett.map((t) => formMasken(t!.form)))) unloesbar++;
    }
  }
  return { zuege, tot: z.vorbei || z.festgefahren, unloesbar, tabletts, etappe: etappeFuer(z.linien) };
}

const median = (zahlen: number[]) => [...zahlen].sort((a, b) => a - b)[Math.floor(zahlen.length / 2)]!;
const saaten = (anzahl: number) => Array.from({ length: anzahl }, (_, i) => (i + 1) * 7919);

describe('Tabletts sind immer zu schaffen', () => {
  // Vorher kam in knapp der Hälfte aller Spiele (gemessen: 47 Prozent der Tode
  // eines gierigen Spielers) ein Tablett, dessen drei Teile zusammen nirgends
  // mehr hinpassten. Wer dort starb, hatte nichts falsch gemacht.
  it.each([1, 6, 14])('bei jedem Spieler und jedem Brett, ab Etappe %i', (etappe) => {
    let tabletts = 0;
    for (const saat of saaten(25)) {
      const zufall = rng(saat);
      for (const zug of [
        (z: Zustand) => zufaelligerZug(z, () => zufall.zahl()),
        (z: Zustand) => gierigerZug(z),
      ]) {
        const lauf = spielen(saat, etappe, 300, zug);
        expect(lauf.unloesbar).toBe(0);
        tabletts += lauf.tabletts;
      }
    }
    // Der Test muss genug Tabletts auch wirklich gesehen haben, sonst
    // beweist „keins unlösbar" nichts.
    expect(tabletts).toBeGreaterThan(150);
  });
});

describe('Wer stirbt, hat sich verlegt', () => {
  it.each([1, 12])('der Spieler, der die Lösung kennt, stirbt nie — ab Etappe %i', (etappe) => {
    for (const saat of saaten(5)) {
      const lauf = spielen(saat, etappe, 250, sichererZug);
      expect(lauf.tot).toBe(false);
      expect(lauf.zuege).toBe(250);
    }
  });
});

describe('Das Spiel ist nicht endlos — und wird mit den Etappen enger', () => {
  it('ein Spieler, der nur den Zufall kennt, stirbt früh', () => {
    for (const saat of saaten(30)) {
      const zufall = rng(saat);
      const lauf = spielen(saat, 1, 400, (z) => zufaelligerZug(z, () => zufall.zahl()));
      expect(lauf.tot).toBe(true);
      expect(lauf.zuege).toBeLessThan(100);
    }
  });

  it('ein gieriger Spieler, der nur ein Teil weit denkt, stirbt in jeder Runde', () => {
    for (const saat of saaten(30)) {
      const lauf = spielen(saat, 1, 1000, gierigerZug);
      expect(lauf.tot).toBe(true);
    }
  });

  it('der gierige Spieler hält auf Etappe 12 deutlich weniger Züge durch als auf Etappe 1', () => {
    // Gemessen (60 Saaten): Etappe 1 im Median 59 Züge, Etappe 4 38, Etappe 12 29.
    // Die Schwelle liegt weit darunter — der Test soll anschlagen, wenn die
    // Etappen nichts mehr bewirken, nicht bei jeder kleinen Verschiebung.
    const lang = saaten(40).map((s) => spielen(s, 1, 1000, gierigerZug).zuege);
    const eng = saaten(40).map((s) => spielen(s, 12, 1000, gierigerZug).zuege);
    expect(median(eng)).toBeLessThan(median(lang) * 0.75);
  });

  it('der Aufstieg ist erreichbar: Ein gieriger Spieler schafft im Median mehr als eine Etappe', () => {
    // Sonst wären die Etappen nur eine Zahl, die nie jemand sieht.
    const etappen = saaten(40).map((s) => spielen(s, 1, 1000, gierigerZug).etappe);
    expect(median(etappen)).toBeGreaterThanOrEqual(3);
  });
});

describe('Zurück hilft, ersetzt aber nichts', () => {
  it('ein Spieler mit Aussetzern kommt mit „Zurück bei Stillstand" im Median deutlich weiter', () => {
    // Der Joker kommt erst zum Einsatz, wenn nichts mehr geht — dann holt der
    // Spieler den Zug zurück und legt überlegt. Gemessen (60 Saaten, 15 Prozent
    // Aussetzer): 37 Züge ohne, 53 mit.
    const mitAussetzern = (saat: number) => {
      const zufall = rng(saat + 5);
      return (z: Zustand) => unsichererZug(z, 0.15, () => zufall.zahl());
    };
    const ohne = saaten(40).map((s) => spielen(s, 1, 800, mitAussetzern(s)).zuege);
    const mit = saaten(40).map(
      (s) =>
        spielen(s, 1, 800, mitAussetzern(s), (z) => {
          const frei = zurueck(z);
          const m = sichererZug(frei);
          return teilLegen(frei, m.index, m.x, m.y);
        }).zuege,
    );
    expect(median(mit)).toBeGreaterThan(median(ohne) * 1.15);
  });

  it('der Vorrat ist endlich: Auch mit Zurück stirbt ein gieriger Spieler', () => {
    for (const saat of saaten(15)) {
      const lauf = spielen(saat, 1, 1500, gierigerZug, zurueck);
      expect(lauf.tot).toBe(true);
    }
  });
});
