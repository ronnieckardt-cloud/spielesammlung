/**
 * Der Sternenschlucker — die Spielfigur von Star Dash.
 *
 * Ausdrücklich **kein** bekanntes Tier und keine Emoji-Figur: ein
 * erfundenes Wesen, dessen ganze Oberseite ein weit offenes Maul ist. Es
 * schluckt die Sterne von oben. Die Augen sitzen deshalb unter dem Maul,
 * am Bauch — das ist der Kniff, der es von allem Bekannten wegrückt.
 *
 * Vorgänger war eine gelbe Kreisfigur mit Kerbe; die sah zu sehr nach
 * einem bekannten Spielhallen-Klassiker aus.
 *
 * Gezeichnet im Koordinatensystem 0…100, ohne eigenes `<svg>` — so lässt
 * sie sich sowohl im Spiel (eigenes svg) als auch im App-Symbol (über
 * `<g transform>` verkleinert) verwenden, ohne sie zweimal zu zeichnen.
 *
 * **Räumliche Wirkung** (zweite Fassung, Rückmeldung: „irgendwie son
 * dreidimensionales Ding"). Zwei Griffe, keine Verläufe und keine Filter —
 * beides mischt sich bei 46 Pixeln zu einem Mittelton und kostet nur
 * Rechenzeit:
 *
 * 1. **Das Maul ist ein Trichter, keine Scheibe.** Der vordere Rand ist
 *    dick und hell, der hintere dünn und dunkel, und der Schlund sitzt
 *    nach hinten versetzt. Genau diese Asymmetrie lässt eine Ellipse als
 *    Loch lesen statt als aufgemalten Fleck — vorher war der Rand rundum
 *    gleich dick, und das Maul wirkte wie ein Aufkleber.
 * 2. **Der Körper hat eine Lichtseite und eine Schattenseite**, dazu ein
 *    Schatten auf dem Boden. Der Glanz liegt in zwei Stufen übereinander:
 *    groß und weich, darin klein und hart. Der harte Punkt ist der
 *    eigentliche Trick — er sagt dem Auge „glatte, gewölbte Fläche".
 *
 * Lichtquelle ist durchgehend oben links. Wer hier etwas ändert, muss das
 * an allen vier Stellen tun (Lichtkante, Schattenseite, beide Glanzpunkte),
 * sonst zerfällt die Wölbung sofort.
 */

export const KOERPER = '#fb7185';
export const KOERPER_DUNKEL = '#be123c';
export const KOERPER_HELL = '#fecdd3';
/** Ganz hinten im Trichter — deutlich dunkler als der Maulrand. */
export const SCHLUND = '#2a0210';

/** Die Maulöffnung. Von hier hängen Trichter, Rand und Zunge ab. */
const MAUL = { cx: 50, cy: 34, rx: 34, ry: 11 };
/** Vorderer Maulrand: die **untere** Hälfte der Ellipse (Bogen mit sweep 0). */
const RAND_VORN = 'M16 34 A34 11 0 0 0 84 34';
/** Hinterer Maulrand: die obere Hälfte (sweep 1) — derselbe Bogen wie das Körperdach. */
const RAND_HINTEN = 'M16 34 A34 11 0 0 1 84 34';
/** Der Körper: oben der Maulrand, unten rund auslaufend. */
const KOERPER_PFAD = 'M16 34 A34 11 0 0 1 84 34 L84 62 C84 88 16 88 16 62 Z';

/**
 * Die Verlaufs-ids sind fest, nicht zufällig: Die Figur steht mehrfach auf
 * einer Seite (Spielfeld, Menükachel, Bestenliste). Alle Vorkommen
 * definieren denselben Verlauf, es ist also gleichgültig, welches gewinnt —
 * dieselbe Überlegung wie in `core/AppSymbol.tsx`.
 */
const KOERPER_VERLAUF_ID = 'sternenschlucker-koerper';
const SCHLUND_VERLAUF_ID = 'sternenschlucker-schlund';

export function SternenschluckerTeile({
  /** Der Bodenschatten stört im App-Symbol, dort schwebt die Figur im All. */
  mitBodenschatten = true,
}: {
  mitBodenschatten?: boolean;
} = {}) {
  return (
    <>
      {/* Bodenschatten in zwei Stufen: außen weit und blass, innen eng und
          kräftig. Eine einzelne Ellipse sieht aus wie ein untergelegter
          Fleck, zwei ineinander wie ein echter Schattenwurf. */}
      {mitBodenschatten && (
        <>
          <ellipse cx="50" cy="95" rx="37" ry="6" fill="#000000" opacity="0.15" />
          <ellipse cx="50" cy="94" rx="30" ry="4.5" fill="#000000" opacity="0.35" />
        </>
      )}

      {/* Füße, zuerst — sie sollen hinter dem Körper liegen. */}
      <ellipse cx="33" cy="88" rx="9" ry="6" fill={KOERPER_DUNKEL} />
      <ellipse cx="67" cy="88" rx="9" ry="6" fill={KOERPER_DUNKEL} />

      {/* Seitenflossen statt Ohren — nichts Säugetierhaftes. */}
      <path d="M17 52 L4 46 L15 66 Z" fill={KOERPER_DUNKEL} />
      <path d="M83 52 L96 46 L85 66 Z" fill={KOERPER_DUNKEL} />

      <defs>
        {/* Licht oben links, Tiefe unten rechts. Zwei aufeinandergelegte
            Ellipsen taten es zuerst auch, aber man sah ihre Kante quer
            über den Bauch laufen — und eine sichtbare Kante zerstört die
            Wölbung sofort wieder. Ein Verlauf hat diese Kante nicht. */}
        <radialGradient id={KOERPER_VERLAUF_ID} cx="0.32" cy="0.26" r="0.88">
          <stop offset="0" stopColor="#ffbcc5" />
          <stop offset="0.5" stopColor={KOERPER} />
          <stop offset="1" stopColor="#9f1239" />
        </radialGradient>
        {/* Der Schlund wird nach hinten dunkler — dasselbe Mittel, nur für
            die Tiefe des Trichters statt für die Wölbung des Bauchs. */}
        <radialGradient id={SCHLUND_VERLAUF_ID} cx="0.5" cy="0.95" r="1">
          <stop offset="0" stopColor="#7f1d3a" />
          <stop offset="1" stopColor={SCHLUND} />
        </radialGradient>
      </defs>

      <path d={KOERPER_PFAD} fill={`url(#${KOERPER_VERLAUF_ID})`} />

      {/* Das offene Maul als Trichter: außen der Rand in Körper-Dunkel, darin
          der nach hinten versetzte Schlund. Der sichtbare Ring dazwischen
          ist die Trichterwand — vorn breit, hinten schmal. */}
      <ellipse {...MAUL} fill={KOERPER_DUNKEL} />
      <ellipse cx="50" cy="32" rx="27" ry="7.5" fill={`url(#${SCHLUND_VERLAUF_ID})`} />
      {/* Zunge, ganz im dunklen Schlund — eine Idee weiter unten läge sie
          auf dem Maulrand und wäre farblich nicht mehr zu trennen. */}
      <ellipse cx="50" cy="36" rx="13" ry="2.8" fill="#f43f5e" />
      {/* Vorne dick und hell, hinten dünn und dunkel — das ist der ganze
          Trick. Reihenfolge: erst vorn, dann hinten, sonst überdeckt die
          breite helle Lippe den dünnen dunklen Bogen. */}
      <path d={RAND_VORN} fill="none" stroke="#fda4af" strokeWidth="6" />
      <path d={RAND_HINTEN} fill="none" stroke="#9f1239" strokeWidth="3" />

      {/* Augen am Bauch, leicht unterschiedlich groß — das gibt Charakter. */}
      <circle cx="35" cy="56" r="9" fill="#ffffff" />
      <circle cx="66" cy="57" r="7.5" fill="#ffffff" />
      <circle cx="37" cy="57" r="4.4" fill={SCHLUND} />
      <circle cx="67.5" cy="58" r="3.7" fill={SCHLUND} />
      <circle cx="34.5" cy="54" r="1.7" fill="#ffffff" />
      <circle cx="65.5" cy="55.5" r="1.4" fill="#ffffff" />

      {/* Ein einziger harter Glanzpunkt, oben links im hellen Teil des
          Verlaufs. Genau der macht aus einer Fläche eine glatte Kugel — die
          weiche Aufhellung drumherum erledigt schon der Verlauf. Ein zweiter,
          großer weicher Fleck war testweise drin und sah aus wie ein
          Schmierer auf dem Bauch. */}
      <ellipse cx="23" cy="46" rx="3.4" ry="2.2" fill="#ffffff" opacity="0.6" />
    </>
  );
}

/** Die Figur als eigenständiges Bild — so benutzt sie das Spiel. */
export function Sternenschlucker({ groesse = 46 }: { groesse?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={groesse} height={groesse} className="drop-shadow-lg">
      <SternenschluckerTeile />
    </svg>
  );
}
