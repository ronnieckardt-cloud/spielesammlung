import { spiele } from '../core/registry';
import { Seite } from './Seite';
import { bestenlisteLesen } from './speicher';

const datumsformat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' });

function datum(iso: string): string {
  const wert = new Date(iso);
  return Number.isNaN(wert.getTime()) ? '' : datumsformat.format(wert);
}

export function BestenlisteSeite({ onZurueck }: { onZurueck: () => void }) {
  return (
    <Seite titel="Bestenliste" onZurueck={onZurueck}>
      <div className="flex flex-col gap-4">
        {spiele.map((spiel) => {
          const eintraege = bestenlisteLesen(spiel.id);
          const Icon = spiel.Icon;
          return (
            <section
              key={spiel.id}
              style={{ borderLeftColor: spiel.accent }}
              className="rounded-karte border border-rand border-l-4 bg-flaeche p-4"
            >
              <h2 className="flex items-center gap-2 font-semibold">
                {/* Fertige App-Symbole stehen für sich, siehe Kachelmenue. */}
                {spiel.iconVollflaechig ? (
                  <Icon className="size-7 shrink-0 rounded-lg" />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: spiel.accent }}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-white"
                  >
                    <Icon className="size-4" />
                  </span>
                )}
                {spiel.title}
              </h2>
              {eintraege.length === 0 ? (
                <p className="mt-2 text-sm text-gedaempft">Noch nichts gespielt.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-1">
                  {eintraege.map((eintrag, i) => (
                    <li
                      key={`${eintrag.datum}-${i}`}
                      className="flex items-baseline gap-3 text-sm tabular-nums"
                    >
                      <span className="w-5 text-gedaempft">{i + 1}.</span>
                      <span className="flex-1 font-semibold">{eintrag.punkte}</span>
                      <span className="text-gedaempft">{datum(eintrag.datum)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </Seite>
  );
}
