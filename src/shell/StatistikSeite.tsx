import { Seite } from './Seite';
import { spiele } from '../core/registry';
import { bestenlisteLesen, fortschrittLesen } from './speicher';
import { statistikGesamt, statistikZeilen } from './statistik';
import type { GameApi } from '../core/types';

/**
 * Die Statistik-Seite: eine Zeile je Spiel — Runden, Siege, Sterne,
 * Bestwert, zuletzt gespielt.
 *
 * **Erhebt keine einzige neue Zahl.** Alles hier stand schon in
 * `fortschritt.jeSpiel` oder in der Bestenliste; diese Seite liest es nur
 * anders zusammen als die Fortschrittsseite (dort zählt die **Summe**
 * über alle Spiele, hier die Aufschlüsselung **je Spiel**). Zwei Seiten,
 * eine Wahrheit — die Rechnung dafür steht in `statistik.ts`, damit sie
 * unabhängig vom Bildschirm testbar ist.
 *
 * Die Sternenskalen zwischen den Spielen sind unvergleichbar (Quiz Time
 * 0–10, Block Burst in den Tausenden), deshalb steht hier bewusst keine
 * Rangliste zwischen den Spielen — nur, wie es bei jedem einzelnen steht.
 */

function Zahl({ wert, bezeichnung }: { wert: string | number; bezeichnung: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-base font-black tabular-nums">{wert}</span>
      <span className="text-[10px] leading-tight text-gedaempft">{bezeichnung}</span>
    </div>
  );
}

const datumsformat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

function zuletztText(iso: string | null): string {
  if (!iso) return 'noch nicht gespielt';
  const wert = new Date(iso);
  if (Number.isNaN(wert.getTime())) return 'noch nicht gespielt';
  return datumsformat.format(wert);
}

function SpielZeile({
  spiel,
  daten,
}: {
  spiel: GameApi;
  daten: ReturnType<typeof statistikZeilen>[number];
}) {
  const Icon = spiel.Icon;
  /*
   * **Nicht nur `partien > 0`.** Runden zählt `fortschritt.jeSpiel`, das
   * Datum kommt aus der Bestenliste — zwei verschiedene Speicherorte, die
   * bei älteren Einträgen (von vor der Fortschritt-Funktion) auseinander
   * fallen können: eine echte Bestleistung, aber `partien` steht noch auf
   * 0. Beide zusammen entscheiden deshalb, ob überhaupt gespielt wurde;
   * sonst hätte diese Karte ein Datum gezeigt und trotzdem „nie gespielt"
   * behauptet.
   */
  const gespielt = daten.partien > 0 || daten.zuletzt !== null;

  return (
    <li
      className={`flex flex-col gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] p-3 backdrop-blur-sm ${
        gespielt ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        {spiel.iconVollflaechig ? (
          <Icon className="size-10 shrink-0 rounded-xl" />
        ) : (
          <span
            aria-hidden="true"
            style={{ backgroundColor: spiel.accent }}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-white"
          >
            <Icon className="size-5" />
          </span>
        )}

        {/* `min-w-0` ist hier keine Kosmetik: Ohne das drückt ein langer
            Titel wie „Kistenschieben" die Zahlenreihe unten aus der Karte,
            statt selbst umzubrechen — dieselbe Falle wie bei den
            Kachelnamen im Menü. */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{spiel.title}</p>
          <p className="text-xs text-gedaempft">{zuletztText(daten.zuletzt)}</p>
        </div>
      </div>

      {gespielt && (
        <div className="flex justify-between border-t border-white/10 pt-2.5">
          <Zahl wert={daten.partien} bezeichnung="Runden" />
          <Zahl wert={daten.siege} bezeichnung="Siege" />
          <Zahl wert={`${daten.besteSterne}★`} bezeichnung="Sterne" />
          <Zahl wert={daten.bestwert} bezeichnung="Bestwert" />
        </div>
      )}
    </li>
  );
}

export function StatistikSeite({ onZurueck }: { onZurueck: () => void }) {
  const fortschritt = fortschrittLesen();
  // Einmal gelesen, nicht zwanzigmal verstreut über die Anzeige — derselbe
  // Kniff wie bei der Bestenliste (siehe dort den Kommentar zu `listen`).
  const bestenlisten = Object.fromEntries(spiele.map((s) => [s.id, bestenlisteLesen(s.id)]));
  const zeilen = statistikZeilen(
    spiele.map((s) => s.id),
    fortschritt.jeSpiel,
    bestenlisten,
  );
  const gesamt = statistikGesamt(zeilen);
  const spielVon = new Map(spiele.map((s) => [s.id, s]));

  return (
    <Seite titel="Statistik" onZurueck={onZurueck}>
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <ul className="grid grid-cols-4 gap-2">
          <li className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
            <span aria-hidden="true" className="text-xl">
              🎮
            </span>
            <span className="text-xl font-black text-white tabular-nums">{gesamt.partien}</span>
            <span className="text-center text-[10px] leading-tight font-medium text-white/70">Runden</span>
          </li>
          <li className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
            <span aria-hidden="true" className="text-xl">
              🏆
            </span>
            <span className="text-xl font-black text-white tabular-nums">{gesamt.siege}</span>
            <span className="text-center text-[10px] leading-tight font-medium text-white/70">Siege</span>
          </li>
          <li className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
            <span aria-hidden="true" className="text-xl">
              ⭐
            </span>
            <span className="text-xl font-black text-white tabular-nums">{gesamt.sterne}</span>
            <span className="text-center text-[10px] leading-tight font-medium text-white/70">Sterne</span>
          </li>
          <li className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 backdrop-blur-sm">
            <span aria-hidden="true" className="text-xl">
              🎯
            </span>
            <span className="text-xl font-black text-white tabular-nums">
              {gesamt.ausprobiert}/{spiele.length}
            </span>
            <span className="text-center text-[10px] leading-tight font-medium text-white/70">
              Ausprobiert
            </span>
          </li>
        </ul>

        <ul className="flex flex-col gap-2">
          {zeilen.map((z) => {
            const spiel = spielVon.get(z.id);
            if (!spiel) return null;
            return <SpielZeile key={z.id} spiel={spiel} daten={z} />;
          })}
        </ul>
      </div>
    </Seite>
  );
}
