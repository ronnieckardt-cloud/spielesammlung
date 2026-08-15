import { useCallback, useEffect, useState } from 'react';
import { spiele, spielFinden } from '../core/registry';
import { Seite } from './Seite';
import { duelleHolen, duellStarten, spielerNamenHolen } from './konto';
import type { Duell, Konto } from './konto';
import { eigenePunkte, fremdePunkte, gegnerName, sortieren, standFuer, standText } from './duell';

/**
 * Duelle: zwei Angemeldete spielen **dasselbe Level**, der höhere
 * Punktestand gewinnt.
 *
 * Bewusst rundenbasiert und nicht gleichzeitig: Niemand muss warten, bis
 * der andere online ist. Das passt zu einem Kind, das zwischendurch zehn
 * Minuten spielt — und es kommt ohne Dauerverbindung aus, also ohne den
 * einen Baustein, den dieses Projekt nicht hat.
 */

const datumsformat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' });

export function DuellSeite({
  konto,
  onZurueck,
  onSpielen,
  onKonto,
}: {
  konto: Konto | null;
  onZurueck: () => void;
  /** Ein Duell spielen — die Hülle kennt daraus Spiel und Level. */
  onSpielen: (duellId: string) => void;
  onKonto: () => void;
}) {
  const [duelle, setDuelle] = useState<Duell[] | null>(null);
  const [namen, setNamen] = useState<string[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!konto) return;
    setLaedt(true);
    const [liste, spieler] = await Promise.all([duelleHolen(), spielerNamenHolen()]);
    setDuelle(liste);
    setNamen(spieler);
    setLaedt(false);
  }, [konto]);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (!konto) {
    return (
      <Seite titel="Duelle" onZurueck={onZurueck}>
        <div className="rounded-karte border border-rand bg-flaeche p-6 text-center">
          <p className="text-4xl" aria-hidden="true">
            ⚔️
          </p>
          <h2 className="mt-3 text-lg font-black">Tritt gegen deine Freunde an</h2>
          <p className="mt-2 text-sm text-gedaempft">
            Ihr spielt beide dasselbe Level — wer mehr Punkte holt, gewinnt. Dafür brauchst du
            einen Spielnamen.
          </p>
          <button
            type="button"
            onClick={onKonto}
            style={{ backgroundColor: 'var(--color-fokus)' }}
            className="spielknopf spielknopf-gross mt-5 w-full text-grund"
          >
            Anmelden oder Konto anlegen
          </button>
        </div>
      </Seite>
    );
  }

  const sortiert = duelle ? sortieren(duelle, konto.benutzerId) : [];

  return (
    <Seite titel="Duelle" onZurueck={onZurueck}>
      <div className="flex flex-col gap-4">
        {neuOffen ? (
          <NeuesDuell
            namen={namen}
            onAbbrechen={() => {
              setNeuOffen(false);
              setFehler(null);
            }}
            onStarten={async (spiel, gegner) => {
              setFehler(null);
              try {
                const duell = await duellStarten(spiel, gegner);
                setNeuOffen(false);
                await laden();
                // Direkt losspielen — wer herausfordert, will nicht erst
                // eine Liste ansehen.
                onSpielen(duell.id);
              } catch (ausnahme) {
                setFehler(
                  ausnahme instanceof Error && ausnahme.message
                    ? ausnahme.message
                    : 'Das hat gerade nicht geklappt.',
                );
              }
            }}
            fehler={fehler}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNeuOffen(true)}
            style={{ backgroundColor: 'var(--color-fokus)' }}
            className="spielknopf spielknopf-gross w-full text-grund"
          >
            ⚔️ Jemanden herausfordern
          </button>
        )}

        {duelle === null ? (
          <p className="rounded-karte border border-rand bg-flaeche p-6 text-center text-sm text-gedaempft">
            {laedt ? 'Wird geladen …' : 'Duelle brauchen Internet. Spielen geht trotzdem.'}
          </p>
        ) : sortiert.length === 0 ? (
          <p className="rounded-karte border border-dashed border-rand p-6 text-center text-sm text-gedaempft">
            Noch kein Duell. Fordere jemanden heraus!
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortiert.map((d) => (
              <DuellZeile
                key={d.id}
                duell={d}
                ich={konto.benutzerId}
                onSpielen={() => onSpielen(d.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Seite>
  );
}

function DuellZeile({
  duell,
  ich,
  onSpielen,
}: {
  duell: Duell;
  ich: string;
  onSpielen: () => void;
}) {
  const spiel = spielFinden(duell.spiel);
  const stand = standFuer(duell, ich);
  const dran = stand.art === 'du-bist-dran';
  const meine = eigenePunkte(duell, ich);
  const seine = fremdePunkte(duell, ich);
  const Icon = spiel?.Icon;

  const inhalt = (
    <>
      {Icon && <Icon className="size-10 shrink-0 rounded-xl" />}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-bold">
          gegen {gegnerName(duell, ich)}
          {spiel && <span className="font-normal text-gedaempft"> · {spiel.title}</span>}
        </span>
        <span className="block text-xs text-gedaempft tabular-nums">
          Level {duell.level} · {datumsformat.format(new Date(duell.erstelltAm))}
          {meine !== null && ` · du ${meine}`}
          {seine !== null && ` · ${gegnerName(duell, ich)} ${seine}`}
        </span>
      </span>
      <span
        className={`shrink-0 text-sm font-bold ${
          stand.art === 'gewonnen'
            ? 'text-amber-300'
            : stand.art === 'verloren'
              ? 'text-gedaempft'
              : ''
        }`}
      >
        {dran ? 'Spielen ›' : standText(stand)}
      </span>
    </>
  );

  return (
    <li>
      {dran ? (
        <button
          type="button"
          onClick={onSpielen}
          className="flex min-h-14 w-full items-center gap-3 rounded-karte border border-fokus/40 bg-fokus/15 px-3 py-2 transition-transform active:scale-[0.99]"
        >
          {inhalt}
        </button>
      ) : (
        <div className="flex min-h-14 w-full items-center gap-3 rounded-karte border border-rand bg-flaeche px-3 py-2">
          {inhalt}
        </div>
      )}
    </li>
  );
}

/** Die Auswahl: welches Spiel, gegen wen. */
function NeuesDuell({
  namen,
  onStarten,
  onAbbrechen,
  fehler,
}: {
  namen: readonly string[];
  onStarten: (spiel: string, gegner: string) => Promise<void>;
  onAbbrechen: () => void;
  fehler: string | null;
}) {
  // Nur Spiele, bei denen gleiche Levelnummer dasselbe Rätsel ergibt —
  // sonst entschiede das Glück statt das Können.
  const moeglich = spiele.filter((s) => s.duellFaehig);
  const [spiel, setSpiel] = useState(moeglich[0]?.id ?? '');
  const [gegner, setGegner] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLaeuft(true);
        await onStarten(spiel, gegner.trim());
        setLaeuft(false);
      }}
      className="flex flex-col gap-4 rounded-karte border border-rand bg-flaeche p-4"
    >
      <h2 className="font-black">Neues Duell</h2>

      <div>
        <p className="mb-2 text-sm font-medium">Welches Spiel?</p>
        <div className="flex flex-wrap gap-2">
          {moeglich.map((s) => {
            const Icon = s.Icon;
            const gewaehlt = s.id === spiel;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpiel(s.id)}
                aria-pressed={gewaehlt}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-2 py-1.5 text-sm font-semibold transition-colors ${
                  gewaehlt ? 'border-fokus bg-fokus/20' : 'border-rand hover:bg-white/5'
                }`}
              >
                <Icon className="size-7 rounded-lg" />
                {s.title}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gedaempft">
          Nur diese Spiele: Bei ihnen ergibt dieselbe Levelnummer dasselbe Rätsel — sonst
          entschiede das Glück statt das Können.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Gegen wen?
        <input
          value={gegner}
          onChange={(e) => setGegner(e.target.value)}
          list="duell-spieler"
          required
          autoCapitalize="off"
          placeholder="Spielname"
          className="rounded-xl border border-rand bg-grund px-4 py-3 text-base"
        />
        <datalist id="duell-spieler">
          {namen.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {namen.length > 0 && (
          <span className="text-xs text-gedaempft">Schon dabei: {namen.join(', ')}</span>
        )}
      </label>

      {fehler && (
        <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {fehler}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onAbbrechen} className="spielknopf flex-1">
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={laeuft || !gegner.trim()}
          style={{ backgroundColor: 'var(--color-fokus)' }}
          className="spielknopf spielknopf-gross flex-1 text-grund disabled:opacity-40"
        >
          {laeuft ? 'Einen Moment …' : 'Los!'}
        </button>
      </div>
    </form>
  );
}
