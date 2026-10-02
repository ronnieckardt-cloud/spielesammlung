import type { LeiterFrage } from '../../core/leiter';

/**
 * Alle Wissensfragen — aus **jeder** Datei `fragen.ts` und `fragen-*.ts` in diesem Ordner.
 *
 * Neue Fragen legt man einfach in eine neue Datei `fragen-<thema>.ts` und exportiert sie als Liste; hier
 * muss nichts eingetragen werden. Das ist Absicht: Eine Liste von Hand zu pflegen heißt, dass früher oder
 * später eine Datei vergessen wird, und eine ganze Schwere fehlt dann unbemerkt. `leiterfragen.test.ts`
 * prüft dieselben Dateien auf Formfehler.
 */
// Nicht `./fragen*.ts`: Das fasste auch `fragen.test.ts` und zog dadurch das Testwerkzeug in die App
// (Fehler beim Laden der ganzen Sammlung). Testdateien werden ausdrücklich ausgeschlossen.
const dateien = import.meta.glob<Record<string, unknown>>(['./fragen.ts', './fragen-*.ts', '!./**/*.test.ts'], { eager: true });

function istFragenliste(wert: unknown): wert is LeiterFrage[] {
  return Array.isArray(wert) && wert.length > 0 && typeof (wert[0] as LeiterFrage).frage === 'string';
}

export const WISSENSFRAGEN: readonly LeiterFrage[] = Object.keys(dateien)
  .sort()
  .flatMap((pfad) => Object.values(dateien[pfad]!).filter(istFragenliste).flat());
