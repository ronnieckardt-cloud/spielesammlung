import { describe, it, expect } from 'vitest';
import { FRAGEN } from './fragen';
import {
  FRAGEN_PRO_LEVEL,
  LEVEL_JE_DURCHGANG,
  antwortWaehlen,
  fragenFuerLevel,
  naechsteFrage,
  neuesLevel,
  punkteFuerAntwort,
} from './logik';

describe('neuesLevel', () => {
  it('ist bei gleicher Levelnummer reproduzierbar', () => {
    expect(neuesLevel(5)).toEqual(neuesLevel(5));
  });

  it('unterscheidet sich zwischen zwei Levelnummern', () => {
    expect(neuesLevel(1).fragen).not.toEqual(neuesLevel(2).fragen);
  });

  it('zieht genau FRAGEN_PRO_LEVEL Fragen, ohne Wiederholung innerhalb des Levels', () => {
    const z = neuesLevel(3);
    expect(z.fragen).toHaveLength(FRAGEN_PRO_LEVEL);
    const texte = z.fragen.map((f) => f.frage);
    expect(new Set(texte).size).toBe(FRAGEN_PRO_LEVEL);
  });

  it('zieht nur Fragen aus dem echten Pool', () => {
    const z = neuesLevel(7);
    const poolTexte = new Set(FRAGEN.map((f) => f.frage));
    for (const f of z.fragen) expect(poolTexte.has(f.frage)).toBe(true);
  });

  it('stellt innerhalb eines Durchgangs keine Frage zweimal', () => {
    const gesehen = new Set<string>();
    for (let level = 1; level <= LEVEL_JE_DURCHGANG; level++) {
      for (const f of neuesLevel(level).fragen) {
        expect(gesehen.has(f.frage)).toBe(false);
        gesehen.add(f.frage);
      }
    }
    expect(gesehen.size).toBe(LEVEL_JE_DURCHGANG * FRAGEN_PRO_LEVEL);
  });

  it('fängt nach einem vollen Durchgang neu gemischt an, nicht von vorn', () => {
    const ersteRunde = neuesLevel(1).fragen.map((f) => f.frage);
    const zweiteRunde = neuesLevel(1 + LEVEL_JE_DURCHGANG).fragen.map((f) => f.frage);
    expect(zweiteRunde).not.toEqual(ersteRunde);
  });

  it('liefert für jedes Level volle FRAGEN_PRO_LEVEL Fragen, auch weit oben', () => {
    for (const level of [1, LEVEL_JE_DURCHGANG, LEVEL_JE_DURCHGANG + 1, 137]) {
      expect(fragenFuerLevel(level)).toHaveLength(FRAGEN_PRO_LEVEL);
    }
  });

  it('startet bei Frage 0, 0 Punkten, nicht vorbei', () => {
    const z = neuesLevel(1);
    expect(z.index).toBe(0);
    expect(z.punkte).toBe(0);
    expect(z.richtigeAnzahl).toBe(0);
    expect(z.vorbei).toBe(false);
    expect(z.ausgewaehlt).toBeNull();
  });
});

describe('antwortWaehlen', () => {
  it('erkennt eine richtige Antwort und zählt sie', () => {
    const z = neuesLevel(1);
    const richtigerIndex = z.fragen[0]!.richtig;
    const nach = antwortWaehlen(z, richtigerIndex);
    expect(nach.ausgewaehlt).toBe(richtigerIndex);
    expect(nach.richtigeAnzahl).toBe(1);
    expect(nach.serie).toBe(1);
    expect(nach.punkte).toBeGreaterThan(0);
  });

  it('erkennt eine falsche Antwort und setzt die Serie zurück', () => {
    const z = neuesLevel(1);
    const falscherIndex = [0, 1, 2, 3].find((i) => i !== z.fragen[0]!.richtig) as 0 | 1 | 2 | 3;
    const nach = antwortWaehlen(z, falscherIndex);
    expect(nach.richtigeAnzahl).toBe(0);
    expect(nach.serie).toBe(0);
    expect(nach.punkte).toBe(0);
  });

  it('lässt sich für dieselbe Frage nicht zweimal beantworten', () => {
    const z = neuesLevel(1);
    const einmal = antwortWaehlen(z, z.fragen[0]!.richtig);
    const zweimal = antwortWaehlen(einmal, 0);
    expect(zweimal).toBe(einmal);
  });

  it('reagiert nach Rundenende auf nichts mehr', () => {
    const z = { ...neuesLevel(1), vorbei: true };
    expect(antwortWaehlen(z, 0)).toBe(z);
  });
});

describe('naechsteFrage', () => {
  it('geht erst weiter, nachdem geantwortet wurde', () => {
    const z = neuesLevel(1);
    expect(naechsteFrage(z)).toBe(z);
  });

  it('springt zur nächsten Frage und setzt die Auswahl zurück', () => {
    const z = neuesLevel(1);
    const beantwortet = antwortWaehlen(z, z.fragen[0]!.richtig);
    const nach = naechsteFrage(beantwortet);
    expect(nach.index).toBe(1);
    expect(nach.ausgewaehlt).toBeNull();
  });

  it('markiert die Runde nach der letzten Frage als vorbei', () => {
    let z = neuesLevel(1);
    for (let i = 0; i < FRAGEN_PRO_LEVEL; i++) {
      z = antwortWaehlen(z, z.fragen[z.index]!.richtig);
      z = naechsteFrage(z);
    }
    expect(z.vorbei).toBe(true);
    expect(z.richtigeAnzahl).toBe(FRAGEN_PRO_LEVEL);
  });
});

describe('punkteFuerAntwort', () => {
  it('gibt 0 Punkte für eine falsche Antwort', () => {
    expect(punkteFuerAntwort(false, 0)).toBe(0);
  });

  it('gibt mehr Punkte für eine längere Serie, bis zu einem Deckel', () => {
    const kurz = punkteFuerAntwort(true, 1);
    const laenger = punkteFuerAntwort(true, 5);
    const sehrLang = punkteFuerAntwort(true, 50);
    expect(laenger).toBeGreaterThan(kurz);
    expect(sehrLang).toBeGreaterThanOrEqual(laenger);
  });
});
