/**
 * Die untere Navigation.
 *
 * ## Warum es sie jetzt gibt
 *
 * Lange stand hier bewusst **keine**: Bei elf Spielen hätte eine
 * Reiterleiste sieben davon hinter einem Klick versteckt, und die ganze
 * App passte auf einen Bildschirm. Diese Rechnung hat sich umgedreht. Mit
 * zwanzig Spielen scrollte die Startseite, die Wortmarke schob sich unter
 * die Statusleiste, und Bestenliste und Duelle lagen unter der Falz — man
 * musste sie suchen. Dazu kamen Fortschritt und Erfolge als eigene
 * Bereiche. Ab hier kostet eine Leiste weniger, als sie einbringt.
 *
 * ## Entscheidungen
 *
 * **Unten, nicht oben.** Auf einem Handy hält man das Gerät in der Hand;
 * der Daumen erreicht die untere Kante mühelos und die obere gar nicht.
 * Auf breiten Bildschirmen rückt die Leiste in die Mitte und wird schmaler
 * — dort ist sie eine Leiste, kein Daumenbereich.
 *
 * **Fünf Punkte, nicht mehr.** Ab sechs wird jedes Ziel schmaler als der
 * Daumen, und man trifft daneben. Alles Seltene (Konto, Einstellungen,
 * Duelle) liegt hinter „Mehr".
 *
 * **Der aktive Punkt ist an drei Dingen erkennbar** — Farbe, gefülltes
 * Symbol und ein Kissen dahinter. Farbe allein wäre für ein
 * farbfehlsichtiges Kind kein Merkmal, und genau das ist die Frage, die
 * eine Navigation beantworten muss: „Wo bin ich?"
 *
 * **Die Leiste ist ein normales Flex-Kind, nichts Festgeklebtes.** Ein
 * `position: fixed` verdeckt am Seitenende Inhalt, und man muss den
 * verdeckten Streifen mit einem Abstandhalter wieder freiräumen — der auf
 * iPhones mit Aussparung dann falsch hoch ist. So wie hier kann das gar
 * nicht passieren: Die Seite scrollt in ihrem eigenen Bereich darüber.
 */

export type NavZiel = 'start' | 'spiele' | 'bestenliste' | 'fortschritt' | 'mehr';

type Punkt = {
  ziel: NavZiel;
  name: string;
  /** Umrisszeichnung für den ruhenden Zustand. */
  pfad: string;
  /** Gefüllte Fassung für den aktiven — Form ist das zweite Merkmal. */
  pfadAktiv?: string;
};

const PUNKTE: readonly Punkt[] = [
  {
    ziel: 'start',
    name: 'Start',
    pfad: 'M12 3.2 3 10.6V21h6v-6.2h6V21h6V10.6L12 3.2Zm0 2.6 7 5.75V19h-2v-6.2H7V19H5v-7.45l7-5.75Z',
    pfadAktiv: 'M12 3.2 3 10.6V21h6.5v-6.7h5V21H21V10.6L12 3.2Z',
  },
  {
    ziel: 'spiele',
    name: 'Spiele',
    pfad: 'M4.5 4h6v6h-6V4Zm1.6 1.6v2.8h2.8V5.6H6.1ZM13.5 4h6v6h-6V4Zm1.6 1.6v2.8h2.8V5.6h-2.8ZM4.5 13h6v6h-6v-6Zm1.6 1.6v2.8h2.8v-2.8H6.1ZM13.5 13h6v6h-6v-6Zm1.6 1.6v2.8h2.8v-2.8h-2.8Z',
    pfadAktiv: 'M4.5 4h6v6h-6V4Zm9 0h6v6h-6V4Zm-9 9h6v6h-6v-6Zm9 0h6v6h-6v-6Z',
  },
  {
    ziel: 'bestenliste',
    name: 'Rangliste',
    pfad: 'M7 3h10v2h3.5v2.8a4.2 4.2 0 0 1-4 4.2 5.5 5.5 0 0 1-3.3 2.7V17h3v2H7.8v-2h3V14.7A5.5 5.5 0 0 1 7.5 12a4.2 4.2 0 0 1-4-4.2V5H7V3Zm0 4H5.4v.8A2.4 2.4 0 0 0 7 9.9V7Zm10 2.9a2.4 2.4 0 0 0 1.6-2.1V7H17v2.9ZM8.8 5v5.3a3.4 3.4 0 0 0 6.4 0V5H8.8Z',
    pfadAktiv:
      'M7 3h10v2h3.5v2.8a4.2 4.2 0 0 1-4 4.2 5.5 5.5 0 0 1-3.3 2.7V17h3v2H7.8v-2h3V14.7A5.5 5.5 0 0 1 7.5 12a4.2 4.2 0 0 1-4-4.2V5H7V3Zm0 4H5.4v.8A2.4 2.4 0 0 0 7 9.9V7Zm10 2.9a2.4 2.4 0 0 0 1.6-2.1V7H17v2.9Z',
  },
  {
    ziel: 'fortschritt',
    name: 'Fortschritt',
    pfad: 'M12 2.6 15 9l7 .7-5.3 4.7 1.6 6.9L12 17.6 5.7 21.3l1.6-6.9L2 9.7 9 9l3-6.4Zm0 4.7-1.8 3.8-4.1.4 3.1 2.8-.9 4.1 3.7-2.2 3.7 2.2-.9-4.1 3.1-2.8-4.1-.4L12 7.3Z',
    pfadAktiv: 'M12 2.6 15 9l7 .7-5.3 4.7 1.6 6.9L12 17.6 5.7 21.3l1.6-6.9L2 9.7 9 9l3-6.4Z',
  },
  {
    ziel: 'mehr',
    name: 'Mehr',
    pfad: 'M6 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  },
];

export function Unternavigation({
  aktiv,
  onWechsel,
}: {
  aktiv: NavZiel;
  onWechsel: (ziel: NavZiel) => void;
}) {
  return (
    <nav
      aria-label="Hauptbereiche"
      className="shrink-0 border-t border-rand bg-grund/92 backdrop-blur-lg"
      style={{ boxShadow: '0 -8px 24px -12px rgb(0 0 0 / 0.7)' }}
    >
      {/* Auf dem Handy schmal (Daumenbereich), auf dem Tablet etwas
          breiter. Voll ausgereizt wäre falsch: Auf einem 13-Zoll-iPad
          stünden fünf Punkte dreißig Zentimeter auseinander, und man
          zielt quer über den Bildschirm.

          **Absichtlich enger als der Inhalt darüber** (der steht in
          `max-w-3xl md:max-w-5xl`, also 768/1024 Pixel). Die beiden Raster
          fallen dadurch nicht zusammen — das ist geprüft und so gewollt.
          Erreichbarkeit schlägt Rasterreinheit: Eine Navigationsleiste
          bedient man im Vorbeigehen mit dem Daumen, ein Inhalt wird
          gelesen. Wer das angleichen will, muss vorher entscheiden, ob
          Florian auf dem iPad wirklich quer über den Bildschirm greifen
          soll. */}
      <ul className="mx-auto flex w-full max-w-md md:max-w-lg">
        {PUNKTE.map((p) => {
          const istAktiv = p.ziel === aktiv;
          return (
            <li key={p.ziel} className="flex-1">
              <button
                type="button"
                onClick={() => onWechsel(p.ziel)}
                aria-current={istAktiv ? 'page' : undefined}
                // 56 Pixel plus Aussparung: Apple verlangt 44, und die
                // Beschriftung braucht darunter noch Platz.
                className="relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 pt-1.5"
                style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
              >
                {/* Das Kissen hinter dem aktiven Symbol. Es ist das
                    auffälligste der drei Merkmale und deshalb das, was man
                    aus dem Augenwinkel sieht. */}
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 h-8 w-14 rounded-full transition-opacity"
                  style={{
                    background:
                      'radial-gradient(closest-side, color-mix(in oklab, var(--color-fokus) 26%, transparent), transparent)',
                    opacity: istAktiv ? 1 : 0,
                    transitionDuration: 'var(--zeit-mittel)',
                  }}
                />
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="relative size-6 transition-colors"
                  style={{
                    color: istAktiv ? 'var(--color-fokus)' : 'var(--color-gedaempft)',
                    transitionDuration: 'var(--zeit-mittel)',
                  }}
                >
                  <path fill="currentColor" d={istAktiv ? (p.pfadAktiv ?? p.pfad) : p.pfad} />
                </svg>
                <span
                  className="relative text-[10px] leading-none font-bold transition-colors"
                  style={{
                    color: istAktiv ? 'var(--color-fokus)' : 'var(--color-gedaempft)',
                    transitionDuration: 'var(--zeit-mittel)',
                  }}
                >
                  {p.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
