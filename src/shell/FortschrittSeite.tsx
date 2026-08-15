import { spiele } from '../core/registry';
import { fortschrittLesen } from './speicher';
import { ALLE_ERFOLGE, stufeAus } from './fortschritt';
import { BunterGrund } from './BunterGrund';
import { Stufenkarte } from './Stufenkarte';

/**
 * Die Fortschrittsseite: Stufe, Zahlen, Erfolge.
 *
 * **Verschlossene Erfolge stehen blass da, statt zu fehlen.** Eine Liste,
 * die nur zeigt, was man schon hat, ist eine Urkunde; eine Liste, die auch
 * zeigt, was es noch gibt, ist ein Ziel. Für ein Kind ist der Unterschied
 * der ganze Reiz — es muss sehen können, was als Nächstes kommt.
 *
 * **Keine Gesamtpunktzahl.** Die Skalen der zwanzig Spiele sind
 * unvergleichbar (Quiz Time 0 bis 10, Block Burst in den Tausenden); eine
 * Summe daraus wäre eine Zahl ohne Bedeutung. Gezählt wird, was überall
 * dasselbe heißt: Runden, Siege, Sterne, Tage.
 */

function Zahlenkachel({
  wert,
  bezeichnung,
  symbol,
}: {
  wert: string | number;
  bezeichnung: string;
  symbol: string;
}) {
  return (
    <li className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
      <span aria-hidden="true" className="text-xl">
        {symbol}
      </span>
      <span className="text-xl font-black text-white tabular-nums">{wert}</span>
      <span className="text-center text-[10px] leading-tight font-medium text-white/70">
        {bezeichnung}
      </span>
    </li>
  );
}

export function FortschrittSeite() {
  const f = fortschrittLesen();
  const stand = stufeAus(f.xp);
  const sterne = spiele.reduce((s, sp) => s + (f.jeSpiel[sp.id]?.besteSterne ?? 0), 0);
  const geschafft = new Set(f.erfolge);

  return (
    <BunterGrund>
      <header className="rein-von-oben mb-4">
        <h1 className="text-3xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          Fortschritt
        </h1>
        <p className="mt-1 text-sm text-white/75">
          {f.partien === 0
            ? 'Noch keine Runde gespielt — hier füllt sich gleich einiges.'
            : `Insgesamt ${f.xp} Erfahrungspunkte gesammelt.`}
        </p>
      </header>

      <div className="rein-von-unten mb-3" style={{ animationDelay: '60ms' }}>
        <Stufenkarte stand={stand} gross />
      </div>

      <ul
        className="rein-von-unten mb-4 grid grid-cols-4 gap-2"
        style={{ animationDelay: '120ms' }}
      >
        <Zahlenkachel wert={f.partien} bezeichnung="Runden" symbol="🎮" />
        <Zahlenkachel wert={f.siege} bezeichnung="Siege" symbol="🏆" />
        <Zahlenkachel wert={sterne} bezeichnung="Sterne" symbol="⭐" />
        <Zahlenkachel
          wert={f.serie}
          bezeichnung={f.laengsteSerie > f.serie ? `Tage (Rekord ${f.laengsteSerie})` : 'Tage am Stück'}
          symbol="🔥"
        />
      </ul>

      <section className="rein-von-unten" style={{ animationDelay: '180ms' }} aria-labelledby="erfolge-titel">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 id="erfolge-titel" className="text-sm font-black text-white/85">
            Erfolge
          </h2>
          <span className="text-xs font-bold text-white/70 tabular-nums">
            {geschafft.size} / {ALLE_ERFOLGE.length}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {ALLE_ERFOLGE.map((e) => {
            const offen = geschafft.has(e.id);
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 backdrop-blur-sm"
                style={{
                  borderColor: offen ? 'color-mix(in oklab, var(--color-gold) 42%, transparent)' : 'rgb(255 255 255 / 0.12)',
                  background: offen ? 'color-mix(in oklab, var(--color-gold) 12%, rgb(255 255 255 / 0.08))' : 'rgb(255 255 255 / 0.07)',
                  boxShadow: offen ? 'var(--schatten-2)' : 'none',
                }}
              >
                <span
                  aria-hidden="true"
                  className={offen ? 'text-2xl' : 'text-2xl opacity-40 grayscale'}
                >
                  {e.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-bold ${offen ? 'text-white' : 'text-white/70'}`}>
                    {e.titel}
                  </span>
                  <span className="block text-xs text-white/65">{e.beschreibung}</span>
                </span>
                {/* Das Häkchen ist das zweite Merkmal neben Farbe und
                    Sättigung — Farbe darf nie das einzige sein. Der
                    vorgelesene Text steht daneben, damit ein Screenreader
                    nicht nur „Häkchen" sagt. */}
                <span
                  className="shrink-0 text-lg"
                  style={{ color: offen ? 'var(--color-gold)' : 'rgb(255 255 255 / 0.22)' }}
                >
                  <span aria-hidden="true">{offen ? '✓' : '🔒'}</span>
                  <span className="sr-only">{offen ? 'geschafft' : 'noch offen'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </BunterGrund>
  );
}
