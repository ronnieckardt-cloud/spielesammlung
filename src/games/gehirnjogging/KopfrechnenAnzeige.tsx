import type { KopfrechnenAufgabe } from './kopfrechnen';
import { ZahlAntworten } from './ZahlAntworten';

export function KopfrechnenAnzeige({
  aufgabe,
  ausgewaehlt,
  onWaehlen,
}: {
  aufgabe: KopfrechnenAufgabe;
  ausgewaehlt: number | null;
  onWaehlen: (index: 0 | 1 | 2 | 3) => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      <p className="text-3xl font-bold tabular-nums">{aufgabe.text}</p>
      <ZahlAntworten
        antworten={aufgabe.antworten}
        richtig={aufgabe.richtig}
        ausgewaehlt={ausgewaehlt}
        onWaehlen={onWaehlen}
      />
    </div>
  );
}
