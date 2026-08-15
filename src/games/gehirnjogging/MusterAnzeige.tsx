import type { MusterAufgabe } from './muster';
import { ZahlAntworten } from './ZahlAntworten';

export function MusterAnzeige({
  aufgabe,
  ausgewaehlt,
  onWaehlen,
}: {
  aufgabe: MusterAufgabe;
  ausgewaehlt: number | null;
  onWaehlen: (index: 0 | 1 | 2 | 3) => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      <p className="text-2xl font-bold tabular-nums" aria-label={`${aufgabe.folge.join(', ')}, was kommt als Nächstes?`}>
        {aufgabe.folge.join(', ')}, <span className="text-gedaempft">?</span>
      </p>
      <ZahlAntworten
        antworten={aufgabe.antworten}
        richtig={aufgabe.richtig}
        ausgewaehlt={ausgewaehlt}
        onWaehlen={onWaehlen}
      />
    </div>
  );
}
