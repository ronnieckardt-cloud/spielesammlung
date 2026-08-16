import { describe, it, expect } from 'vitest';
import { WOERTER } from './woerter';

describe('Wortpool', () => {
  it('hat ungefähr neunzig Wörter', () => {
    expect(WOERTER.length).toBeGreaterThanOrEqual(80);
  });

  it('jedes Wort hat genau vier, nicht-leere Antworten', () => {
    for (const w of WOERTER) {
      expect(w.antworten).toHaveLength(4);
      for (const a of w.antworten) expect(a.trim().length).toBeGreaterThan(0);
    }
  });

  it('innerhalb eines Worts kommt keine Schreibweise doppelt vor', () => {
    for (const w of WOERTER) {
      expect(new Set(w.antworten).size).toBe(4);
    }
  });

  it('der Index der richtigen Schreibweise ist immer gültig', () => {
    for (const w of WOERTER) {
      expect(w.richtig).toBeGreaterThanOrEqual(0);
      expect(w.richtig).toBeLessThanOrEqual(3);
    }
  });

  it('die richtige Schreibweise kommt im ganzen Pool nicht doppelt vor', () => {
    const richtigeWoerter = WOERTER.map((w) => w.antworten[w.richtig]);
    expect(new Set(richtigeWoerter).size).toBe(richtigeWoerter.length);
  });

  // Anlass: „Kühe" stand als Fehlschreibung von „Küche" im Pool, ist aber
  // ein völlig korrekt geschriebenes Wort — wer es kannte, wurde für
  // richtiges Wissen bestraft. Dieser Test kann das nicht allgemein
  // erkennen (dafür bräuchte es ein Wörterbuch), er fängt aber den Fall ab,
  // in dem der Pool sich selbst widerspricht: eine Schreibweise, die hier
  // falsch sein soll und ein paar Zeilen weiter die richtige Lösung ist.
  it('keine Fehlschreibung ist anderswo im Pool die richtige Schreibweise', () => {
    const richtige = new Set(WOERTER.map((w) => w.antworten[w.richtig]));
    for (const w of WOERTER) {
      const falsche = w.antworten.filter((_, i) => i !== w.richtig);
      for (const a of falsche) expect(richtige.has(a), `"${a}" ist anderswo die Lösung`).toBe(false);
    }
  });

  it('jede Kategorie und jede Regel ist ausgefüllt', () => {
    for (const w of WOERTER) {
      expect(w.kategorie.trim().length).toBeGreaterThan(0);
      expect(w.regel.trim().length).toBeGreaterThan(0);
    }
  });

  it('die Stufe ist immer 1, 2 oder 3', () => {
    for (const w of WOERTER) {
      expect([1, 2, 3]).toContain(w.stufe);
    }
  });

  it('jede Stufe hat mindestens acht Wörter, damit ein Level immer genug zur Auswahl hat', () => {
    for (const stufe of [1, 2, 3] as const) {
      const anzahl = WOERTER.filter((w) => w.stufe === stufe).length;
      expect(anzahl).toBeGreaterThanOrEqual(8);
    }
  });

  it('es gibt mehrere unterschiedliche Kategorien', () => {
    const kategorien = new Set(WOERTER.map((w) => w.kategorie));
    expect(kategorien.size).toBeGreaterThanOrEqual(6);
  });
});
