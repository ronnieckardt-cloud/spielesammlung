import { useEffect, useMemo, useState } from 'react';
import type { GameApi } from '../core/types';
import { spiele } from '../core/registry';
import { Seite } from './Seite';
import {
  bestenlisteLesen,
  fortschrittLesen,
  serverlisteLesen,
  serverlisteSchreiben,
} from './speicher';
import { bestenlistenHolen } from './konto';
import type { Bestenlisten, Konto } from './konto';

/**
 * Die Bestenliste — mit zwei Blickwinkeln.
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
const MEDAILLENFARBE = ['var(--color-gold)', 'var(--color-silber)', 'var(--color-bronze)'] as const;

/** Eine Karte im Stil der übrigen Hüllenseiten: durchscheinend, nicht schwarz. */
function Karte({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm ${className}`}
      style={{ boxShadow: 'var(--schatten-2)' }}
    >
      {children}
    </section>
  );
}

/**
 * Das Podest für die besten Drei.
 *
 * **Gold steht in der Mitte und am höchsten, nicht links.** Das ist der
 * ganze Unterschied zwischen einem Podest und einer nummerierten Liste:
 * Eine Liste liest man von oben nach unten und muss die Zahlen vergleichen;
 * ein Podest sieht man auf einen Blick, weil die Höhe die Information ist.
 * Stünde Platz 1 links, wäre es wieder eine Liste — nur waagerecht.
 *
 * Die Reihenfolge im Markup ist trotzdem **1, 2, 3** und wird nur optisch
 * umsortiert. Ein Vorleseprogramm liest sonst „Silber, Gold, Bronze", und
 * das ist schlicht falsch.
 */
/**
 * Die drei Stufenhöhen — **nach Platz**, nicht nach Anzeigereihenfolge.
 *
 * Stehen auf Modulebene, weil sie an zwei Stellen gebraucht werden: im
 * Podest selbst und im Ladegerüst darunter. Vorher standen dieselben drei
 * Werte doppelt im Code, im Gerüst sogar in der Anzeigereihenfolge
 * umsortiert (Silber, Gold, Bronze). Wer eine Stufe ändert und die andere
 * Stelle übersieht, bekommt ein Gerüst, das beim Umschalten auf die
 * echten Daten sichtbar springt.
 */
const PODESTHOEHEN = ['4.75rem', '3.25rem', '2.5rem'] as const;

/** Höchstbreite einer Podeststufe — ebenfalls in Anzeige und Gerüst gebraucht. */
const PODESTBREITE = '7.5rem';

function Podest({ oben }: { oben: readonly { name: string; punkte: number; ich?: boolean }[] }) {
  // Anzeigereihenfolge: Silber, Gold, Bronze. Fehlt jemand, rückt nichts nach —
  // ein Podest mit zwei Stufen ist ehrlicher als eines mit einer Lücke in der Mitte.
  const ordnung = [1, 0, 2] as const;
  /*
   * **Nach Platz sortiert, nicht nach Anzeigereihenfolge.** Genau da steckte
   * ein Fehler: Die Liste stand zuerst in der Reihenfolge Silber-Gold-Bronze
   * da, abgegriffen wurde sie aber mit dem Platzindex. Ergebnis: Silber
   * bekam die höchste Stufe, Gold die mittlere — das Podest sagte das
   * Gegenteil dessen aus, was es zeigen soll. Im Bild fällt so etwas sofort
   * auf, im Code überhaupt nicht.
   */
  const hoehen = PODESTHOEHEN;

  return (
    <ol className="flex items-end justify-center gap-2 pt-2">
      {ordnung.map((platzIndex) => {
        const eintrag = oben[platzIndex];
        if (!eintrag) return null;
        const farbe = MEDAILLENFARBE[platzIndex]!;
        return (
          <li
            key={platzIndex}
            className="podest-auf flex min-w-0 flex-1 flex-col items-center"
            style={{ animationDelay: `${platzIndex * 130}ms`, maxWidth: PODESTBREITE }}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {MEDAILLEN[platzIndex]}
            </span>

            {/* Der Kreis mit dem Anfangsbuchstaben. Bis es Avatare gibt, ist
                das die schnellste Art, einen Namen wiederzuerkennen — und er
                gibt dem Podest oben eine Form statt nur Text. */}
            <span
              aria-hidden="true"
              className="mt-1 grid size-11 place-items-center rounded-full text-base font-black text-black/75"
              style={{
                background: `radial-gradient(circle at 34% 28%, color-mix(in oklab, ${farbe} 55%, white), ${farbe})`,
                boxShadow: `inset 0 -2px 5px rgb(0 0 0 / 0.28), 0 0 16px -4px ${farbe}`,
              }}
            >
              {eintrag.name.slice(0, 1).toUpperCase()}
            </span>

            <span className="mt-1 w-full truncate text-center text-xs font-bold text-white">
              {eintrag.name}
              {eintrag.ich && <span className="ml-1 text-fokus">(du)</span>}
            </span>
            <span className="text-sm font-black tabular-nums" style={{ color: farbe }}>
              {eintrag.punkte}
            </span>

            {/* Die Stufe selbst. Höhe = Platz, und das ist die eigentliche
                Aussage des Bildes. */}
            <span
              aria-hidden="true"
              className="mt-1.5 grid w-full place-items-center rounded-t-lg text-lg font-black text-white/85"
              style={{
                height: hoehen[platzIndex],
                background: `linear-gradient(180deg, color-mix(in oklab, ${farbe} 42%, transparent), color-mix(in oklab, ${farbe} 12%, transparent))`,
                borderTop: `2px solid ${farbe}`,
              }}
            >
              {platzIndex + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Ein Platz in einer Rangliste — Zeile für alles ab Platz 4. */
function Rangzeile({
  platz,
  name,
  punkte,
  unterzeile,
  ich,
}: {
  platz: number;
  name: string;
  punkte: number;
  unterzeile?: string;
  ich?: boolean;
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm tabular-nums"
      style={
        ich
          ? {
              background: 'color-mix(in oklab, var(--color-fokus) 22%, transparent)',
              boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--color-fokus) 45%, transparent)',
            }
          : undefined
      }
    >
      <span
        aria-hidden="true"
        className="w-7 shrink-0 text-center font-black"
        style={{ color: MEDAILLENFARBE[platz - 1] ?? 'var(--color-gedaempft)' }}
      >
        {MEDAILLEN[platz - 1] ?? platz}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {name}
          {ich && <span className="ml-1 text-xs text-fokus">(du)</span>}
        </span>
        {unterzeile && <span className="block text-xs text-gedaempft">{unterzeile}</span>}
      </span>
      <span className="shrink-0 text-base font-black">{punkte}</span>
    </li>
  );
}

function Spielkopf({ spiel, rechts }: { spiel: GameApi; rechts?: React.ReactNode }) {
  const Icon = spiel.Icon;
  return (
    <h3 className="flex items-center gap-2.5 font-bold">
      {spiel.iconVollflaechig ? (
        <Icon className="size-8 shrink-0 rounded-lg" />
      ) : (
        <span
          aria-hidden="true"
          style={{ backgroundColor: spiel.accent }}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
        >
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{spiel.title}</span>
      {rechts}
    </h3>
  );
}

/** Ein Kasten je Spiel, in der festen Reihenfolge der Registrierung. */
function Spielkasten({
  spiel,
  rechts,
  children,
}: {
  spiel: GameApi;
  rechts?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{ borderLeftColor: spiel.accent, boxShadow: 'var(--schatten-2)' }}
      className="rounded-2xl border border-white/12 border-l-4 bg-white/[0.06] p-4 backdrop-blur-sm"
    >
      <Spielkopf spiel={spiel} rechts={rechts} />
      {children}
    </section>
  );
}

/**
 * Der Ladezustand als **Platzhalter in der Form des Ergebnisses**, nicht
 * als Satz „Wird geladen …".
 *
 * Eine leere Fläche mit einem Wort darauf liest sich als Fehler. Ein
 * Gerüst, das schon aussieht wie das, was gleich kommt, liest sich als
 * „gleich da" — und wenn die Daten eintreffen, springt nichts, weil die
 * Höhe schon stimmt.
 */
function Geruest() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Karte>
        <span className="schimmer block h-4 w-32 rounded" />
        <div className="mt-4 flex items-end justify-center gap-2">
          {/* Dieselbe Reihenfolge wie oben: Silber, Gold, Bronze. */}
          {[1, 0, 2].map((platz, i) => (
            <span key={i} className="flex flex-1 flex-col items-center gap-1.5" style={{ maxWidth: PODESTBREITE }}>
              <span className="schimmer size-11 rounded-full" />
              <span className="schimmer h-3 w-14 rounded" />
              <span className="schimmer w-full rounded-t-lg" style={{ height: PODESTHOEHEN[platz] }} />
            </span>
          ))}
        </div>
      </Karte>
      {[0, 1].map((i) => (
        <Karte key={i}>
          <div className="flex items-center gap-2.5">
            <span className="schimmer size-8 rounded-lg" />
            <span className="schimmer h-4 w-28 rounded" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <span className="schimmer h-4 w-full rounded" />
            <span className="schimmer h-4 w-4/5 rounded" />
          </div>
        </Karte>
      ))}
    </div>
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

  // Treppchen je Spiel, einmal umsortiert statt zwanzigmal gefiltert.
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
    <Seite titel="Rangliste" onZurueck={onZurueck}>
      {/* Zwei große Schalter statt eines Auswahlmenüs — für einen Daumen
          leichter zu treffen, und man sieht beide Möglichkeiten auf einmal. */}
      <div
        role="tablist"
        aria-label="Blickwinkel"
        className="mb-4 flex gap-1 rounded-2xl border border-white/12 bg-black/25 p-1"
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
            className="min-h-11 flex-1 rounded-xl px-3 text-sm font-bold"
            style={{
              background: blick === wert ? 'var(--color-fokus)' : 'transparent',
              color: blick === wert ? 'var(--color-grund)' : 'var(--color-gedaempft)',
              boxShadow: blick === wert ? 'var(--schatten-2)' : 'none',
              transition: `background var(--zeit-kurz) var(--kurve), color var(--zeit-kurz) var(--kurve)`,
            }}
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
      <Karte className="text-center">
        <p className="text-5xl" aria-hidden="true">
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
          className="spielknopf spielknopf-gross druckbar mt-5 w-full text-grund"
        >
          Anmelden oder Konto anlegen
        </button>
      </Karte>
    );
  }

  if (!daten) {
    return laedt ? (
      <Geruest />
    ) : (
      <Karte className="text-center">
        <p className="text-4xl" aria-hidden="true">
          📡
        </p>
        <h2 className="mt-3 font-black">Die Rangliste ist gerade nicht erreichbar</h2>
        <p className="mt-1.5 text-sm text-gedaempft">
          Vermutlich ist kein Internet da. Deine Punkte sind trotzdem gespeichert und gehen später
          von allein mit hoch.
        </p>
      </Karte>
    );
  }

  const bespielt = spiele.filter((s) => (treppchen.get(s.id)?.length ?? 0) > 0);
  const frei = spiele.filter((s) => (treppchen.get(s.id)?.length ?? 0) === 0);
  const podest = daten.gesamt.slice(0, 3);
  const dahinter = daten.gesamt.slice(3);

  return (
    <div className="flex flex-col gap-4">
      <Karte>
        <h2 className="font-black">Gesamtwertung</h2>
        <p className="mt-0.5 text-xs text-gedaempft">
          Punkte für gute Plätze in jedem einzelnen Spiel — nicht die Spielpunkte selbst. So zählt
          Quiz Time genauso viel wie Block Burst.
        </p>

        {daten.gesamt.length === 0 ? (
          <div className="mt-4 text-center">
            <p className="text-4xl" aria-hidden="true">
              🎬
            </p>
            <p className="mt-2 text-sm font-bold">Noch hat niemand gespielt.</p>
            <p className="mt-1 text-sm text-gedaempft">Der erste Platz gehört dir. Fang an!</p>
          </div>
        ) : (
          <>
            <Podest oben={podest} />
            {dahinter.length > 0 && (
              <ol className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-3">
                {dahinter.map((eintrag, i) => (
                  <Rangzeile
                    key={`${eintrag.name}-${i}`}
                    platz={i + 4}
                    name={eintrag.name}
                    punkte={eintrag.punkte}
                    ich={eintrag.ich}
                    unterzeile={`${eintrag.gespielteSpiele} ${eintrag.gespielteSpiele === 1 ? 'Spiel' : 'Spiele'}${
                      eintrag.siege > 0 ? ` · ${eintrag.siege}× erster` : ''
                    }`}
                  />
                ))}
              </ol>
            )}
          </>
        )}
      </Karte>

      {bespielt.length > 0 && <h2 className="mt-1 px-1 font-black">Treppchen je Spiel</h2>}

      {/* Nur Spiele, in denen wirklich jemand gespielt hat. Zwanzig Kästen
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
            <ol className="mt-2.5 flex flex-col gap-1">
              {oben.map((eintrag) => (
                <Rangzeile
                  key={`${eintrag.platz}-${eintrag.name}`}
                  platz={eintrag.platz}
                  name={eintrag.name}
                  punkte={eintrag.punkte}
                  ich={eintrag.ich}
                />
              ))}
            </ol>
            {eigenExtra && (
              <p
                className="mt-2 rounded-xl px-2.5 py-1.5 text-sm tabular-nums"
                style={{ background: 'color-mix(in oklab, var(--color-fokus) 16%, transparent)' }}
              >
                Dein Platz: <strong>{eigenExtra.platz}</strong> mit {eigenExtra.punkte} Punkten
              </p>
            )}
          </Spielkasten>
        );
      })}

      {frei.length > 0 && (
        <section className="rounded-2xl border border-dashed border-white/25 p-4">
          <h3 className="font-bold">
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

/**
 * Die eigenen Ergebnisse von diesem Gerät. Läuft ohne Konto und ohne Netz.
 *
 * **Nur gespielte Spiele.** Vorher standen hier alle zwanzig untereinander,
 * und auf den meisten stand „Noch nichts gespielt." — zwanzig fast
 * identische dunkle Kästen, die nichts sagten. Das war die schwächste Seite
 * der App. Ungespielte Spiele stehen jetzt in **einer** Zeile am Ende, und
 * die liest sich als Einladung statt als Mangelliste.
 */
function NurIch({
  eigenePlaetze,
}: {
  eigenePlaetze: Map<string, Bestenlisten['eigene'][number]>;
}) {
  const fortschritt = fortschrittLesen();
  /*
   * **Einmal lesen, viermal benutzen.**
   *
   * Vorher stand `bestenlisteLesen(id)` an vier Stellen: zweimal beim
   * Filtern, einmal beim Zählen, einmal beim Anzeigen. Jeder Aufruf ist ein
   * `localStorage.getItem` plus `JSON.parse` — bei zwanzig Spielen achtzig
   * Stück, und zwar bei **jedem** Rendern der Seite. `localStorage` ist
   * dabei nicht nur langsam, sondern blockiert den Hauptstrang.
   */
  const listen = new Map(spiele.map((s) => [s.id, bestenlisteLesen(s.id)]));
  const mitEintrag = spiele.filter((s) => (listen.get(s.id)?.length ?? 0) > 0);
  const ohne = spiele.filter((s) => (listen.get(s.id)?.length ?? 0) === 0);

  if (mitEintrag.length === 0) {
    return (
      <Karte className="text-center">
        <p className="text-5xl" aria-hidden="true">
          🎮
        </p>
        <h2 className="mt-3 text-lg font-black">Noch keine Runde gespielt</h2>
        <p className="mt-2 text-sm text-gedaempft">
          Sobald du das erste Mal spielst, stehen hier deine besten fünf Ergebnisse je Spiel.
        </p>
      </Karte>
    );
  }

  const sterne = spiele.reduce((s, sp) => s + (fortschritt.jeSpiel[sp.id]?.besteSterne ?? 0), 0);
  const ergebnisse = mitEintrag.reduce((s, sp) => s + (listen.get(sp.id)?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Drei Zahlen, die **zu der Liste darunter passen müssen.**
          Zuerst stand hier die Rundenzahl aus dem Fortschritt — und die
          zählt erst, seit es den Fortschritt gibt. Auf einem Gerät mit
          älteren Ergebnissen stand dann „2 Runden" über sieben
          aufgelisteten Ergebnissen. Eine Kopfzahl, die ihrer eigenen Liste
          widerspricht, sieht nach Fehler aus, auch wenn beide Zahlen für
          sich stimmen. Also wird gezählt, was tatsächlich darunter steht.

          Eine Gesamtpunktzahl gibt es hier bewusst nicht: Die Skalen der
          Spiele sind unvergleichbar. */}
      <Karte className="flex items-center justify-around text-center">
        <span>
          <span className="block text-2xl font-black tabular-nums">{ergebnisse}</span>
          <span className="block text-xs text-gedaempft">Ergebnisse</span>
        </span>
        <span>
          <span className="block text-2xl font-black tabular-nums">{mitEintrag.length}</span>
          <span className="block text-xs text-gedaempft">Spiele</span>
        </span>
        <span>
          <span
            className="block text-2xl font-black tabular-nums"
            style={{ color: 'var(--color-gold)' }}
          >
            {sterne}
          </span>
          <span className="block text-xs text-gedaempft">Sterne</span>
        </span>
      </Karte>

      {mitEintrag.map((spiel) => {
        const eintraege = listen.get(spiel.id) ?? [];
        const eigen = eigenePlaetze.get(spiel.id);
        const meine = fortschritt.jeSpiel[spiel.id]?.besteSterne ?? 0;
        return (
          <Spielkasten
            key={spiel.id}
            spiel={spiel}
            rechts={
              <span aria-label={`${meine} von 3 Sternen`} className="flex shrink-0 gap-0.5">
                {[1, 2, 3].map((n) => (
                  <svg key={n} viewBox="-12 -12 24 24" aria-hidden="true" className="size-3">
                    <path
                      d="M0-11 3.2-3.9 11-3.1 5.2 2.1 6.8 9.7 0 5.9-6.8 9.7-5.2 2.1-11-3.1-3.2-3.9Z"
                      fill={n <= meine ? 'var(--color-gold)' : 'rgba(255,255,255,0.2)'}
                    />
                  </svg>
                ))}
              </span>
            }
          >
            <ol className="mt-2.5 flex flex-col gap-1">
              {eintraege.map((eintrag, i) => (
                <li
                  key={`${eintrag.datum}-${i}`}
                  className="flex items-baseline gap-3 text-sm tabular-nums"
                >
                  <span
                    className="w-5 font-black"
                    style={{ color: MEDAILLENFARBE[i] ?? 'var(--color-gedaempft)' }}
                  >
                    {i + 1}.
                  </span>
                  <span className="flex-1 font-bold">{eintrag.punkte}</span>
                  <span className="text-gedaempft">{datum(eintrag.datum)}</span>
                </li>
              ))}
            </ol>
            {eigen && (
              <p className="mt-2 text-sm text-gedaempft tabular-nums">
                Unter allen Spielern: Platz <strong className="text-text">{eigen.platz}</strong>
              </p>
            )}
          </Spielkasten>
        );
      })}

      {ohne.length > 0 && (
        <section className="rounded-2xl border border-dashed border-white/25 p-4">
          <h3 className="font-bold">Diese warten noch auf dich</h3>
          <p className="mt-1 text-sm text-gedaempft">{ohne.map((s) => s.title).join(' · ')}</p>
        </section>
      )}
    </div>
  );
}
