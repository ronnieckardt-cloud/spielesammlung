import { AppSymbol, BAND_OBEN } from '../../core/AppSymbol';

/**
 * App-Symbol: ein Ausschnitt des Bretts genau in dem Moment, um den es
 * geht — unten liegen drei blaue Steine mit einer Lücke dazwischen, und
 * der vierte fällt schon darüber. Aufbau siehe `core/AppSymbol.tsx`.
 *
 * Drei Dinge, die hier nicht Geschmack sind, sondern gerechnet:
 *
 * 1. **Alles bleibt über `BAND_OBEN`.** Darunter liegt das Schriftband,
 *    und es wird *nach* dem Einblick gezeichnet — was zu weit unten steht,
 *    verschwindet halb darunter. Deshalb rechnet die Höhe hier von der
 *    Bandkante nach oben zurück und nicht von oben nach unten.
 * 2. **Der fallende Stein liegt ganz im Bild.** Er saß vorher auf cy = 2
 *    bei r = 5, ragte also bis y = −3 und wurde von den runden Ecken
 *    angeschnitten — das las sich als Klecks in der Ecke, nicht als Stein.
 * 3. **Die Stellung ist im Zugwechsel wirklich erreichbar**: vier blaue
 *    gegen vier orange, jede Spalte von unten lückenlos gefüllt, und noch
 *    keine Viererreihe auf dem Brett. Blau ist am Zug, der fallende Stein
 *    landet unten in der Lücke und macht die Reihe voll.
 *
 * Alle drei Punkte prüft `logik.test.ts` nach.
 */

const BLAU = '#38bdf8';
const ORANGE = '#fb923c';

const SPALTEN = 4;
const ZEILEN = 3;
/** Durchmesser eines Lochs. Größer geht nicht: Über dem Brett muss der
    fallende Stein noch ganz hinpassen (siehe FALL_CY unten). */
const LOCH = 9;
const ABSTAND = 1.5;
/** Rahmen des Bretts rund um die Löcher. */
const RAND = 2;

const BRETT_BREITE = SPALTEN * LOCH + (SPALTEN - 1) * ABSTAND + 2 * RAND;
const BRETT_HOEHE = ZEILEN * LOCH + (ZEILEN - 1) * ABSTAND + 2 * RAND;
const BRETT_X = (64 - BRETT_BREITE) / 2;
/** Ein Hauch Luft über dem Schriftband, damit die Kante nicht klebt. */
const BRETT_Y = BAND_OBEN - 1 - BRETT_HOEHE;

const LINKS = BRETT_X + RAND;
const OBEN = BRETT_Y + RAND;
const SCHRITT = LOCH + ABSTAND;
const STEIN_R = LOCH / 2 - 1;

const mitteX = (x: number) => LINKS + x * SCHRITT + LOCH / 2;
const mitteY = (y: number) => OBEN + y * SCHRITT + LOCH / 2;

/**
 * Die Spalte, in die der Stein fällt — die einzige noch leere.
 *
 * Bewusst **nicht** die Randspalte: Dort saß der fallende Stein in der
 * Ecke, halb im Lichtschein des Symbols, und sah aus wie ein Fleck. Über
 * einer Lücke *mitten* in der blauen Reihe ist sofort klar, wohin er will.
 */
const FALL_SPALTE = 2;
/** Tiefstmöglich, ohne das Brett zu berühren, und trotzdem ganz im Bild. */
const FALL_CY = 5;

/**
 * Steine im Ausschnitt: `m` Mensch (blau), `c` Computer (orange).
 * Schlüssel ist `x,y`, y = 0 ist oben.
 *
 * Unten drei blaue mit einer Lücke in der Mitte — genau dort fällt der
 * vierte hinein. Die Orangen liegen bewusst verstreut und bilden keine
 * eigene Dreierreihe: Zwei Dreierreihen nebeneinander machen auf 64 Pixeln
 * nicht mehr klar, um welche es geht.
 */
const STEINE: Record<string, 'm' | 'c'> = {
  '0,2': 'm',
  '1,2': 'm',
  '3,2': 'm',
  '0,1': 'c',
  '1,1': 'c',
  '3,1': 'c',
  '0,0': 'c',
  '1,0': 'm',
};

/**
 * Was der Test am Einblick nachrechnet (siehe `logik.test.ts`).
 *
 * Die drei Punkte oben im Dateikopf sind alle drei schon einmal falsch
 * gewesen — als Zahlen im Test fallen sie beim nächsten Mal sofort auf,
 * statt erst jemandem auf dem Handy.
 */
export const EINBLICK = {
  spalten: SPALTEN,
  zeilen: ZEILEN,
  steine: STEINE,
  fallSpalte: FALL_SPALTE,
  /** Oberkante des fallenden Steins — muss im Bild liegen. */
  fallOben: FALL_CY - STEIN_R,
  /** Unterkante des fallenden Steins — muss über dem Brett bleiben. */
  fallUnten: FALL_CY + STEIN_R,
  brettOben: BRETT_Y,
  /** Unterkante des Bretts — muss über dem Schriftband bleiben. */
  brettUnten: BRETT_Y + BRETT_HOEHE,
  /** Linke und rechte Kante — dürfen nicht aus dem Symbol laufen. */
  brettLinks: BRETT_X,
  brettRechts: BRETT_X + BRETT_BREITE,
} as const;

/** Ein Spielstein: Farbe, Form-Merkmal, Glanzlicht. */
function Stein({ cx, cy, wer }: { cx: number; cy: number; wer: 'm' | 'c' }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={STEIN_R} fill={wer === 'm' ? BLAU : ORANGE} />
      {/* Kreis gegen Raute — Farbe ist nie das einzige Merkmal, auch nicht
          im Symbol. */}
      {wer === 'm' ? (
        <circle cx={cx} cy={cy} r={STEIN_R * 0.38} fill="#ffffff" opacity="0.5" />
      ) : (
        <rect
          x={cx - STEIN_R * 0.34}
          y={cy - STEIN_R * 0.34}
          width={STEIN_R * 0.68}
          height={STEIN_R * 0.68}
          fill="#ffffff"
          opacity="0.5"
          transform={`rotate(45 ${cx} ${cy})`}
        />
      )}
      <ellipse
        cx={cx - STEIN_R * 0.32}
        cy={cy - STEIN_R * 0.44}
        rx={STEIN_R * 0.48}
        ry={STEIN_R * 0.28}
        fill="#ffffff"
        opacity="0.28"
      />
    </>
  );
}

export function DropFourIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="dropfour"
      verlauf={['#60a5fa', '#1d4ed8', '#172554']}
      schriftzug="DROP FOUR"
      className={className}
    >
      {/* Das Brett. */}
      <rect x={BRETT_X} y={BRETT_Y} width={BRETT_BREITE} height={BRETT_HOEHE} rx="4" fill="#1e3a8a" />
      <rect x={BRETT_X} y={BRETT_Y} width={BRETT_BREITE} height="2" rx="1" fill="#ffffff" opacity="0.16" />

      {Array.from({ length: SPALTEN * ZEILEN }, (_, i) => {
        const x = i % SPALTEN;
        const y = Math.floor(i / SPALTEN);
        const cx = mitteX(x);
        const cy = mitteY(y);
        const wer = STEINE[`${x},${y}`];
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={LOCH / 2} fill="#0b1226" />
            {wer && <Stein cx={cx} cy={cy} wer={wer} />}
          </g>
        );
      })}

      {/* Der fallende Stein, der die untere Reihe schließt. */}
      <Stein cx={mitteX(FALL_SPALTE)} cy={FALL_CY} wer="m" />
    </AppSymbol>
  );
}
