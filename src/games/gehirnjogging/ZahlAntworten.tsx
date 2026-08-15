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
        if (beantwortet && istRichtig) {
          rahmenfarbe = RICHTIG_FARBE;
          hintergrund = `${RICHTIG_FARBE}26`;
        } else if (beantwortet && istAusgewaehlt) {
          rahmenfarbe = FALSCH_FARBE;
          hintergrund = `${FALSCH_FARBE}26`;
        } else if (beantwortet) {
          deckkraft = 0.5;
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onWaehlen(i as 0 | 1 | 2 | 3)}
            disabled={beantwortet}
            className="rounded-xl border border-rand bg-flaeche p-4 text-center text-xl font-bold tabular-nums transition-colors disabled:cursor-default"
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
