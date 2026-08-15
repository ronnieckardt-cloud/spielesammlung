import { useEffect, useMemo, useState } from 'react';
import type { GameApi } from '../core/types';
import { spiele } from '../core/registry';
import { Seite } from './Seite';
import { bestenlisteLesen, serverlisteLesen, serverlisteSchreiben } from './speicher';
import { bestenlistenHolen } from './konto';
import type { Bestenlisten, Konto } from './konto';

/**
 * Die Bestenliste — jetzt mit zwei Blickwinkeln.
 *
 * **Alle** zeigt, wer insgesamt vorn liegt und wer je Spiel auf dem
 * Treppchen steht. Das braucht ein Konto und Netz.
 *
 * **Ich** zeigt die eigenen Ergebnisse von diesem Gerät. Das lief schon
 * immer ohne alles und läuft weiter ohne alles — wer sich nie anmeldet,
 * bekommt genau die Seite von vorher.
 *
 * Der zuletzt geholte Stand wird gespeichert. Ohne Netz steht deshalb eine
 * echte Liste da und darunter „Stand: gestern 18:04" — kein hängender
 * Ladekreisel, es ist immer etwas zu sehen.
 */

const SPEICHER_SCHLUESSEL = 'bestenlisten';

const datumsformat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' });
const standformat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

function datum(iso: string): string {
  const wert = new Date(iso);
  return Number.isNaN(wert.getTime()) ? '' : datumsformat.format(wert);
}

/** Die drei Treppchenplätze als Zeichen — Farbe ist nie das einzige Merkmal. */
const MEDAILLEN = ['🥇', '🥈', '🥉'] as const;

function Spielkopf({ spiel }: { spiel: GameApi }) {
  const Icon = spiel.Icon;
  return (
    <h3 className="flex items-center gap-2 font-semibold">
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
    </h3>
  );
}

/** Ein Kasten je Spiel, in der festen Reihenfolge der Registrierung. */
function Spielkasten({ spiel, children }: { spiel: GameApi; children: React.ReactNode }) {
  return (
    <section
      style={{ borderLeftColor: spiel.accent }}
      className="rounded-karte border border-rand border-l-4 bg-flaeche p-4"
    >
      <Spielkopf spiel={spiel} />
      {children}
    </section>
  );
}

export function BestenlisteSeite({
  konto,
  onZurueck,
  onKonto,
}: {
  konto: Konto | null;
  onZurueck: () => void;
  onKonto: () => void;
}) {
  // Ohne Konto gibt es unter „Alle" nichts zu sehen — dann gleich die
  // eigenen Ergebnisse zeigen statt einer leeren Werbefläche.
  const [blick, setBlick] = useState<'alle' | 'ich'>(konto ? 'alle' : 'ich');
  const [daten, setDaten] = useState<Bestenlisten | null>(null);
  const [stand, setStand] = useState<string | null>(null);
  const [frisch, setFrisch] = useState(false);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (!konto) {
      setDaten(null);
      setStand(null);
      setFrisch(false);
      return;
    }

    // Erst der letzte bekannte Stand, damit sofort etwas dasteht …
    const zwischenspeicher = serverlisteLesen<Bestenlisten>(SPEICHER_SCHLUESSEL);
    if (zwischenspeicher) {
      setDaten(zwischenspeicher.daten);
      setStand(zwischenspeicher.stand);
    }

    // … dann der Versuch, es aktuell zu machen.
    let abgemeldet = false;
    setLaedt(true);
    void bestenlistenHolen()
      .then((neu) => {
        if (abgemeldet || !neu) return;
        serverlisteSchreiben(SPEICHER_SCHLUESSEL, neu);
        setDaten(neu);
        setStand(null);
        setFrisch(true);
      })
      .finally(() => {
        if (!abgemeldet) setLaedt(false);
      });

    return () => {
      abgemeldet = true;
    };
  }, [konto]);

  // Treppchen je Spiel, einmal umsortiert statt vierzehnmal gefiltert.
  const treppchen = useMemo(() => {
    const nach = new Map<string, Bestenlisten['spitze']>();
    for (const eintrag of daten?.spitze ?? []) {
      const liste = nach.get(eintrag.spiel);
      if (liste) liste.push(eintrag);
      else nach.set(eintrag.spiel, [eintrag]);
    }
    return nach;
  }, [daten]);

  const eigenePlaetze = useMemo(
    () => new Map((daten?.eigene ?? []).map((e) => [e.spiel, e])),
    [daten],
  );

  return (
    <Seite titel="Bestenliste" onZurueck={onZurueck}>
      {/* Zwei große Schalter statt eines Auswahlmenüs — für einen Daumen
          leichter zu treffen, und man sieht beide Möglichkeiten auf einmal. */}
      <div
        role="tablist"
        aria-label="Blickwinkel"
        className="mb-4 flex gap-1 rounded-2xl border border-rand bg-flaeche p-1"
      >
        {(
          [
            ['alle', 'Alle Spieler'],
            ['ich', 'Nur ich'],
          ] as const
        ).map(([wert, beschriftung]) => (
          <button
            key={wert}
            type="button"
            role="tab"
            aria-selected={blick === wert}
            onClick={() => setBlick(wert)}
            className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-bold transition-colors ${
              blick === wert ? 'bg-fokus text-grund' : 'text-gedaempft hover:bg-white/5'
            }`}
          >
            {beschriftung}
          </button>
        ))}
      </div>

      {blick === 'alle' ? (
        <AlleSpieler
          konto={konto}
          daten={daten}
          treppchen={treppchen}
          eigenePlaetze={eigenePlaetze}
          stand={stand}
          frisch={frisch}
          laedt={laedt}
          onKonto={onKonto}
        />
      ) : (
        <NurIch eigenePlaetze={eigenePlaetze} />
      )}
    </Seite>
  );
}

function AlleSpieler({
  konto,
  daten,
  treppchen,
  eigenePlaetze,
  stand,
  frisch,
  laedt,
  onKonto,
}: {
  konto: Konto | null;
  daten: Bestenlisten | null;
  treppchen: Map<string, Bestenlisten['spitze']>;
  eigenePlaetze: Map<string, Bestenlisten['eigene'][number]>;
  stand: string | null;
  frisch: boolean;
  laedt: boolean;
  onKonto: () => void;
}) {
  if (!konto) {
    return (
      <div className="rounded-karte border border-rand bg-flaeche p-6 text-center">
        <p className="text-4xl" aria-hidden="true">
          🏆
        </p>
        <h2 className="mt-3 text-lg font-black">Wer ist der Beste?</h2>
        <p className="mt-2 text-sm text-gedaempft">
          Mit einem Spielnamen zählen deine Punkte mit — auf allen deinen Geräten und gegen alle
          anderen. Eine E-Mail-Adresse brauchst du nicht.
        </p>
        <button
          type="button"
          onClick={onKonto}
          // Siehe KontoSeite: `.spielknopf` steht ohne Ebene in der
          // CSS-Datei und schlägt damit jede Tailwind-Hintergrundklasse.
          style={{ backgroundColor: 'var(--color-fokus)' }}
          className="spielknopf spielknopf-gross mt-5 w-full text-grund"
        >
          Anmelden oder Konto anlegen
        </button>
      </div>
    );
  }

  if (!daten) {
    return (
      <p className="rounded-karte border border-rand bg-flaeche p-6 text-center text-sm text-gedaempft">
        {laedt ? 'Wird geladen …' : 'Die Bestenliste ist gerade nicht erreichbar. Kein Internet?'}
      </p>
    );
  }

  const bespielt = spiele.filter((s) => (treppchen.get(s.id)?.length ?? 0) > 0);
  const frei = spiele.filter((s) => (treppchen.get(s.id)?.length ?? 0) === 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-karte border border-rand bg-flaeche p-4">
        <h2 className="font-black">Gesamtwertung</h2>
        <p className="mt-0.5 text-xs text-gedaempft">
          Punkte für gute Plätze in jedem einzelnen Spiel — nicht die Spielpunkte selbst. So zählt
          Quiz Time genauso viel wie Block Burst.
        </p>
        {daten.gesamt.length === 0 ? (
          <p className="mt-3 text-sm text-gedaempft">Noch hat niemand gespielt. Fang du an!</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1">
            {daten.gesamt.map((eintrag, i) => (
              <li
                key={`${eintrag.name}-${i}`}
                className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm tabular-nums ${
                  eintrag.ich ? 'bg-fokus/20 ring-1 ring-fokus/40' : ''
                }`}
              >
                <span aria-hidden="true" className="w-6 shrink-0 text-center">
                  {MEDAILLEN[i] ?? `${i + 1}.`}
                </span>
                {/* Name und Zahlen untereinander, nicht nebeneinander: Auf
                    einem 375er-Handy blieb dem Namen sonst so wenig Platz,
                    dass er nach drei Buchstaben abgeschnitten war. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {eintrag.name}
                    {eintrag.ich && <span className="ml-1 text-xs text-fokus">(du)</span>}
                  </span>
                  <span className="block text-xs text-gedaempft">
                    {eintrag.gespielteSpiele} {eintrag.gespielteSpiele === 1 ? 'Spiel' : 'Spiele'}
                    {eintrag.siege > 0 && ` · ${eintrag.siege}× erster`}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-black">{eintrag.punkte}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <h2 className="mt-1 font-black">Treppchen je Spiel</h2>

      {/* Nur Spiele, in denen wirklich jemand gespielt hat. Vierzehn Kästen
          mit „hier war noch niemand" wären eine Seite Leere — die freien
          Spiele stehen unten in **einer** Zeile, und die liest sich sogar wie
          eine Einladung. */}
      {bespielt.map((spiel) => {
        const oben = treppchen.get(spiel.id) ?? [];
        const eigen = eigenePlaetze.get(spiel.id);
        // Nur zeigen, wenn man nicht ohnehin oben steht — sonst stünde der
        // eigene Platz zweimal untereinander.
        const eigenExtra = eigen && !oben.some((e) => e.ich) ? eigen : null;

        return (
          <Spielkasten key={spiel.id} spiel={spiel}>
            <ol className="mt-2 flex flex-col gap-1">
              {oben.map((eintrag) => (
                <li
                  key={`${eintrag.platz}-${eintrag.name}`}
                  className={`flex items-baseline gap-3 rounded-lg px-2 py-1 text-sm tabular-nums ${
                    eintrag.ich ? 'bg-fokus/20 font-bold ring-1 ring-fokus/40' : ''
                  }`}
                >
                  <span aria-hidden="true" className="w-6 shrink-0 text-center">
                    {MEDAILLEN[eintrag.platz - 1] ?? `${eintrag.platz}.`}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {eintrag.name}
                    {eintrag.ich && <span className="ml-1 text-xs text-fokus">(du)</span>}
                  </span>
                  <span className="font-semibold">{eintrag.punkte}</span>
                </li>
              ))}
            </ol>
            {eigenExtra && (
              <p className="mt-2 rounded-lg bg-fokus/15 px-2 py-1 text-sm tabular-nums">
                Dein Platz: <strong>{eigenExtra.platz}</strong> mit {eigenExtra.punkte} Punkten
              </p>
            )}
          </Spielkasten>
        );
      })}

      {frei.length > 0 && (
        <section className="rounded-karte border border-dashed border-rand p-4">
          <h3 className="font-semibold">
            {bespielt.length === 0 ? 'Alle Plätze sind frei' : 'Hier ist der erste Platz noch frei'}
          </h3>
          <p className="mt-1 text-sm text-gedaempft">{frei.map((s) => s.title).join(' · ')}</p>
        </section>
      )}

      {/* Nur wenn die Zahlen wirklich aus dem Zwischenspeicher kommen. Steht
          da nichts, sind sie von eben. */}
      {stand && !frisch && (
        <p className="text-center text-xs text-gedaempft">
          Stand: {standformat.format(new Date(stand))} — gerade kein Internet.
        </p>
      )}
    </div>
  );
}

/** Die eigenen Ergebnisse von diesem Gerät. Läuft ohne Konto und ohne Netz. */
function NurIch({
  eigenePlaetze,
}: {
  eigenePlaetze: Map<string, Bestenlisten['eigene'][number]>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {spiele.map((spiel) => {
        const eintraege = bestenlisteLesen(spiel.id);
        const eigen = eigenePlaetze.get(spiel.id);
        return (
          <Spielkasten key={spiel.id} spiel={spiel}>
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
            {eigen && (
              <p className="mt-2 text-sm text-gedaempft tabular-nums">
                Unter allen Spielern: Platz <strong className="text-text">{eigen.platz}</strong>
              </p>
            )}
          </Spielkasten>
        );
      })}
    </div>
  );
}
