import type { LeiterFrage } from '../../core/leiter';
import { WOERTER } from './woerter';

/**
 * Alle Wortfragen von Word Play.
 *
 * Zwei Quellen:
 *
 * 1. **Die 90 Rechtschreib-Wörter** aus `woerter.ts`. Sie bleiben dort, wie sie sind (reine Daten mit
 *    Stufe 1 bis 3); hier werden sie zu Leiter-Fragen: Die Stufe wird die Schwere, die Regel die Erklärung.
 * 2. **Jede Datei `wortfragen-*.ts`** in diesem Ordner: Wortschatz, Redewendungen, Rechtschreibung und
 *    Grammatik der oberen Schweren. Neue Fragen legt man einfach in eine neue Datei — hier muss nichts
 *    eingetragen werden (siehe `quiz/pool.ts`, dort steht auch, warum das Muster Testdateien ausschließt).
 *
 * Ein späteres Sprachen-Spiel (Vokabeln) bekommt denselben Aufbau mit eigenem Ordner.
 */
const dateien = import.meta.glob<Record<string, unknown>>(['./wortfragen-*.ts', '!./**/*.test.ts'], { eager: true });

function istFragenliste(wert: unknown): wert is LeiterFrage[] {
  return Array.isArray(wert) && wert.length > 0 && typeof (wert[0] as LeiterFrage).frage === 'string';
}

export const RECHTSCHREIBUNG: readonly LeiterFrage[] = WOERTER.map((w) => ({
  kategorie: 'Rechtschreibung',
  frage: 'Welches Wort ist richtig geschrieben?',
  antworten: w.antworten,
  richtig: w.richtig,
  erklaerung: w.regel,
  schwere: w.stufe,
}));

export const WORTFRAGEN: readonly LeiterFrage[] = [
  ...RECHTSCHREIBUNG,
  ...Object.keys(dateien)
    .sort()
    .flatMap((pfad) => Object.values(dateien[pfad]!).filter(istFragenliste).flat()),
];
