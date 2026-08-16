const RICHTIG_FARBE = '#22c55e';
const FALSCH_FARBE = '#ef4444';

/**
 * Vier Zahlen zur Wahl, mit Rückmeldung nach der Antwort — von Kopfrechnen
 * und Muster erkennen gemeinsam benutzt, weil beide dasselbe Antwortformat
 * haben (siehe `KopfrechnenAufgabe`/`MusterAufgabe`).
 */
export function ZahlAntworten({
  antworten,
  richtig,
  ausgewaehlt,
  onWaehlen,
}: {
  antworten: readonly [number, number, number, number];
  richtig: 0 | 1 | 2 | 3;
  ausgewaehlt: number | null;
  onWaehlen: (index: 0 | 1 | 2 | 3) => void;
}) {
  const beantwortet = ausgewaehlt !== null;

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      {antworten.map((wert, i) => {
        const istAusgewaehlt = ausgewaehlt === i;
        const istRichtig = i === richtig;

        let rahmenfarbe: string | undefined;
        let hintergrund: string | undefined;
        let deckkraft: number | undefined;
        // Siehe Quiz Time: Die richtige Zahl ploppt immer auf, gewackelt
        // wird nur bei der angetippten falschen. Weil Kopfrechnen und
        // Muster erkennen sich diese Anzeige teilen, gilt das für beide.
        let bewegung = '';
        if (beantwortet && istRichtig) {
          rahmenfarbe = RICHTIG_FARBE;
          hintergrund = `${RICHTIG_FARBE}26`;
          bewegung = 'antwort-richtig';
        } else if (beantwortet && istAusgewaehlt) {
          rahmenfarbe = FALSCH_FARBE;
          hintergrund = `${FALSCH_FARBE}26`;
          bewegung = 'antwort-falsch';
        } else if (beantwortet) {
          deckkraft = 0.5;
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onWaehlen(i as 0 | 1 | 2 | 3)}
            disabled={beantwortet}
            // Antipp-Reaktion wie bei `.spielknopf`: 5 % kleiner, 100 ms.
            // Die Klasse selbst passt hier nicht — sie bringt eigene Ecken,
            // Innenabstände und `inline-flex` mit und würde das Zweierraster
            // sprengen —, ihr Verhalten schon.
            //
            // Die Übergänge stehen einzeln statt als `transition-colors
            // transition-transform`: Beide Klassen setzen dieselbe
            // CSS-Eigenschaft, es gälte also nur eine von beiden, und welche,
            // hängt an Tailwinds Reihenfolge statt an unserer. `enabled:`
            // hört nach der Antwort auf und kommt so `antwort-richtig` nicht
            // in die Quere, das `scale` über Keyframes bewegt.
            //
            // **`scale` steht deshalb bewusst NICHT in der Übergangsliste.**
            // Im Moment der Antwort wird der Knopf `disabled`, die
            // Antipp-Stauchung fällt weg, und ein Übergang darauf ließe
            // `scale` 100 ms lang von 0,95 zurück auf 1 laufen. Übergänge
            // stehen in der Kaskade über Animationen — er hätte damit
            // genau den Anfang von `antwort-richtig` überschrieben
            // (Höhepunkt bei 119 ms) und danach sichtbar geruckt. Die
            // Stauchung beim Antippen bleibt trotzdem, sie braucht keinen
            // eigenen Übergang.
            className={`rounded-xl border border-rand bg-flaeche p-4 text-center text-xl font-bold tabular-nums transition-[background-color,border-color,opacity] duration-100 enabled:active:scale-95 disabled:cursor-default ${bewegung}`}
            style={{ borderColor: rahmenfarbe, backgroundColor: hintergrund, opacity: deckkraft }}
          >
            {wert}
            {beantwortet && istRichtig && (
              <span aria-hidden="true" className="ml-2">
                ✓
              </span>
            )}
            {beantwortet && istAusgewaehlt && !istRichtig && (
              <span aria-hidden="true" className="ml-2">
                ✗
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
