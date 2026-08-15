import { describe, it, expect } from 'vitest';
import { FRAGEN } from './fragen';

describe('Fragenpool', () => {
  it('hat ungefähr hundert Fragen', () => {
    expect(FRAGEN.length).toBeGreaterThanOrEqual(90);
  });

  it('jede Frage hat genau vier, nicht-leere Antworten', () => {
    for (const f of FRAGEN) {
      expect(f.antworten).toHaveLength(4);
      for (const a of f.antworten) expect(a.trim().length).toBeGreaterThan(0);
    }
  });

  it('jede Frage und jede Kategorie ist ausgefüllt', () => {
    for (const f of FRAGEN) {
      expect(f.frage.trim().length).toBeGreaterThan(0);
      expect(f.kategorie.trim().length).toBeGreaterThan(0);
    }
  });

  it('der Index der richtigen Antwort ist immer gültig', () => {
    for (const f of FRAGEN) {
      expect(f.richtig).toBeGreaterThanOrEqual(0);
      expect(f.richtig).toBeLessThanOrEqual(3);
    }
  });

  it('innerhalb einer Frage kommt keine Antwort doppelt vor', () => {
    for (const f of FRAGEN) {
      expect(new Set(f.antworten).size).toBe(4);
    }
  });

  it('keine Frage kommt wortgleich doppelt im Pool vor', () => {
    const texte = FRAGEN.map((f) => f.frage.trim().toLowerCase());
    expect(new Set(texte).size).toBe(texte.length);
  });

  it('es gibt mehrere unterschiedliche Kategorien', () => {
    const kategorien = new Set(FRAGEN.map((f) => f.kategorie));
    expect(kategorien.size).toBeGreaterThanOrEqual(6);
  });
});
