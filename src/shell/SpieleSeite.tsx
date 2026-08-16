import { spiele } from '../core/registry';
import { fortschrittLesen } from './speicher';
import { BunterGrund } from './BunterGrund';
import { Spielkachel } from './Spielkachel';

/**
 * Alle Spiele auf einer eigenen Seite.
 *
 * Das Raster stand vorher unten auf der Startseite. Bei zwanzig Spielen
 * füllte es die Seite so weit, dass alles andere unter die Falz rutschte —
 * und der Fortschrittshinweis stand allein oben in der Kopfzeile, weit weg
 * von den Kacheln, auf die er sich bezieht.
 *
 * **Die Reihenfolge ist fest und darf sich nie ändern.** Florian lernt
 * „Snake Rush ist das grüne unten links" und tippt es beim zehnten Mal
 * blind. Ein Raster, das sich nach jedem Spielen umsortiert, nimmt genau
 * diese Sicherheit weg — und ausgerechnet beim Lieblingsspiel, das dann
 * ständig woanders läge. Dynamik gehört auf die Startseite, hier gehört
 * Verlässlichkeit hin.
 */
export function SpieleSeite({ onSpielen }: { onSpielen: (id: string) => void }) {
  const fortschritt = fortschrittLesen();
  const gespielt = spiele.filter((s) => (fortschritt.jeSpiel[s.id]?.partien ?? 0) > 0).length;
  const sterne = spiele.reduce((summe, s) => summe + (fortschritt.jeSpiel[s.id]?.besteSterne ?? 0), 0);
  const moeglich = spiele.length * 3;

  return (
    <BunterGrund>
      <header className="rein-von-oben mb-4">
        <h1 className="text-3xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          Spiele
        </h1>
        {/* Zwei Zahlen, die etwas bedeuten: wie viele ausprobiert, und wie
            viele Sterne insgesamt zu holen sind. Eine reine Gesamtpunktzahl
            gibt es hier bewusst nicht — die Skalen der Spiele sind
            unvergleichbar (Quiz Time 0 bis 10, Block Burst in den
            Tausenden). Sterne sind die einzige Währung, die überall
            dasselbe bedeutet. */}
        <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
          <span>
            {gespielt} von {spiele.length} ausprobiert
          </span>
          <span aria-hidden="true" className="text-white/35">
            ·
          </span>
          <span className="flex items-center gap-1">
            <svg viewBox="-12 -12 24 24" aria-hidden="true" className="size-3.5">
              <path
                d="M0-11 3.2-3.9 11-3.1 5.2 2.1 6.8 9.7 0 5.9-6.8 9.7-5.2 2.1-11-3.1-3.2-3.9Z"
                fill="var(--color-gold)"
              />
            </svg>
            {sterne} von {moeglich}
          </span>
        </p>
      </header>

      <ul className="buehne-3d grid justify-items-center gap-x-2 gap-y-4 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:gap-x-3 sm:p-5"
          /*
           * `auto-fit` statt `flex-wrap`: Das Raster teilt jede Breite
           * selbst in gleich breite Spalten auf. Damit gibt es keine
           * Breite mehr, bei der die Reihe unerwartet umbricht — der
           * Fehler, der zwischen 640 und 833 Pixeln zweimal auftrat.
           */
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(calc(var(--kachel) + 0.75rem), 1fr))',
          }}>
        {spiele.map((spiel, i) => (
          <Spielkachel
            key={spiel.id}
            spiel={spiel}
            sterne={fortschritt.jeSpiel[spiel.id]?.besteSterne ?? 0}
            onSpielen={onSpielen}
            // Gedeckelt: Bei zwanzig Kacheln wäre eine durchgezählte Staffel
            // sonst über eine halbe Sekunde lang, und die letzten Kacheln
            // kämen spürbar zu spät.
            verzoegerung={100 + Math.min(i * 24, 380)}
          />
        ))}
      </ul>

      {/* Nur auf breiten Bildschirmen: Auf dem Handy gibt es keine Tastatur,
          und die Zeile kostete 48 Pixel Höhe. */}
      <p className="mt-4 hidden text-center text-xs text-white/60 sm:block">
        Tastatur: Pfeiltasten oder WASD bewegen, X dreht, Leertaste lässt fallen, Eingabetaste
        wählt.
      </p>
    </BunterGrund>
  );
}
