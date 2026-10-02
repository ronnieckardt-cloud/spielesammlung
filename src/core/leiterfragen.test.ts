import { describe, it, expect } from 'vitest';
import { pruefeFrage } from './leiter';
import type { LeiterFrage } from './leiter';

/**
 * Prüft **jede** Fragendatei der Leiter-Spiele auf Formfehler.
 *
 * Eingesammelt werden alle Dateien `fragen.ts`, `fragen-*.ts` und `wortfragen-*.ts` unter `src/games`. Wer neue
 * Fragen schreibt, legt sie einfach in so eine Datei und exportiert sie als Liste — dieser Test
 * findet sie von selbst. Er prüft nur die Form (vier verschiedene Antworten, Längen, Schwere …);
 * stimmt eine Antwort sachlich, kann kein Test sagen.
 */
const dateien = {
  ...import.meta.glob(['../games/**/fragen.ts', '../games/**/fragen-*.ts', '!../games/**/*.test.ts'], { eager: true }),
  ...import.meta.glob(['../games/**/wortfragen-*.ts', '!../games/**/*.test.ts'], { eager: true }),
} as Record<string, Record<string, unknown>>;

function listenIn(modul: Record<string, unknown>): { name: string; fragen: LeiterFrage[] }[] {
  return Object.entries(modul)
    .filter(([, wert]) => Array.isArray(wert) && wert.length > 0 && typeof (wert[0] as LeiterFrage).frage === 'string')
    .map(([name, wert]) => ({ name, fragen: wert as LeiterFrage[] }));
}

describe('Fragendateien der Leiter-Spiele', () => {
  const namen = Object.keys(dateien);

  it('es gibt Dateien zu prüfen', () => {
    expect(namen.length).toBeGreaterThan(0);
  });

  for (const pfad of namen) {
    describe(pfad, () => {
      const listen = listenIn(dateien[pfad]!);

      it('exportiert mindestens eine Fragenliste', () => {
        expect(listen.length).toBeGreaterThan(0);
      });

      for (const { name, fragen } of listen) {
        it(`${name}: jede der ${fragen.length} Fragen ist formal in Ordnung`, () => {
          const meldungen: string[] = [];
          fragen.forEach((f, i) => {
            for (const problem of pruefeFrage(f)) {
              meldungen.push(`#${i + 1} „${String(f.frage).slice(0, 50)}": ${problem}`);
            }
          });
          expect(meldungen, meldungen.join('\n')).toEqual([]);
        });

        it(`${name}: keine Frage kommt in der Liste doppelt vor`, () => {
          const texte = fragen.map((f) => f.frage.trim().toLowerCase() + '|' + [...f.antworten].sort().join('|').toLowerCase());
          expect(new Set(texte).size).toBe(texte.length);
        });
      }
    });
  }
});
