import { memo } from 'react';
import { EXTRA_DAUER_SCHRITTE } from './logik';
import type { Extra, Punkt, Rand, Richtung } from './logik';
import { gliedArt, kachelMitte, laeufe, laeuftSenkrecht, pfadDurch } from './geometrie';

/**
 * Snake Rush — die gezeichneten Teile.
 *
 * Alles im Koordinatensystem „eine Einheit = eine Kachel"; das umgebende
 * `<svg>` in `Schlange.tsx` legt die viewBox darüber. Vorher bestand die
 * Schlange aus einzelnen Kacheln mit einer Fuge dazwischen — sie konnten
 * sich also gar nicht berühren, und übrig blieb ein grüner Streifen.
 *
 * Jetzt ist der Körper ein durchgehender Linienzug aus vier Schichten:
 * Schatten, dunkle Kante, Fläche, helle Lichtkante. Das ist derselbe
 * Kniff wie bei `GlanzBlock` in den App-Symbolen und `.glanzstein` auf den
 * Spielfeldern — er lässt eine flache Form rund wirken. Die Kurven
 * entstehen von selbst durch `stroke-linejoin="round"`, es braucht also
 * keine Eckvarianten.
 */

const KOERPER_DUNKEL = '#065f46';
const KOERPER = '#16a34a';
const KOERPER_HELL = '#6ee7b7';
const KOPF_HELL = '#22c55e';
const ZUNGE = '#f43f5e';
const APFEL = '#f43f5e';
const GOLD = '#facc15';
const HOF = '#0b0f14';
/** So viele Schritte liegt ein Extra — der Ring um das Extra schrumpft darauf bezogen. */
const EXTRA_DAUER = EXTRA_DAUER_SCHRITTE;

/** Strichstärken der vier Schichten. */
const BREIT_KANTE = 0.92;
const BREIT_FLAECHE = 0.76;
const BREIT_LICHT = 0.26;
/** Der Schwanz läuft über die letzten beiden Glieder dünner aus. */
const BREIT_SCHWANZ_KANTE = 0.55;
const BREIT_SCHWANZ_FLAECHE = 0.4;

const RUND = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const WINKEL: Record<Richtung, number> = { rechts: 0, runter: 90, links: 180, hoch: 270 };

/**
 * Der Körper. Die Kette wird an Rand-Umschlägen in Läufe zerlegt (siehe
 * `laeufe`) — ein einziger Pfad würde beim Umschlag quer über das ganze
 * Feld gemalt.
 *
 * Reihenfolge ist wichtig: **erst alle dunklen Kanten, dann alle Flächen.**
 * Zeichnet man den Schwanz stückweise fertig, malt dessen schmale Kante
 * einen sichtbaren Ring quer über den breiten Körper.
 */
export function Koerper({ schlange }: { schlange: readonly Punkt[] }) {
  const teile = laeufe(schlange);
  // Der Schwanz sitzt immer im letzten Lauf. Nur wenn der lang genug ist,
  // lohnt sich das Auslaufen — sonst überspringen wir es für dieses Bild.
  const letzter = teile[teile.length - 1] ?? [];
  const schwanzPfad = letzter.length >= 2 ? pfadDurch(letzter.slice(-2)) : null;
  const hauptTeile = teile.map((lauf, i) =>
    i === teile.length - 1 && schwanzPfad && lauf.length > 2 ? lauf.slice(0, -1) : lauf,
  );

  return (
    <>
      {/* Schatten unter dem Körper. */}
      <g transform="translate(0 0.16)" opacity="0.45">
        {hauptTeile.map((lauf, i) => (
          <path key={i} d={pfadDurch(lauf)} stroke="#000000" strokeWidth={BREIT_KANTE} {...RUND} />
        ))}
      </g>

      {/* Dunkle Umrandung, Körper und Schwanz gemeinsam. */}
      {hauptTeile.map((lauf, i) => (
        <path key={i} d={pfadDurch(lauf)} stroke={KOERPER_DUNKEL} strokeWidth={BREIT_KANTE} {...RUND} />
      ))}
      {schwanzPfad && (
        <path d={schwanzPfad} stroke={KOERPER_DUNKEL} strokeWidth={BREIT_SCHWANZ_KANTE} {...RUND} />
      )}

      {/* Fläche. */}
      {hauptTeile.map((lauf, i) => (
        <path key={i} d={pfadDurch(lauf)} stroke={KOERPER} strokeWidth={BREIT_FLAECHE} {...RUND} />
      ))}
      {schwanzPfad && (
        <path d={schwanzPfad} stroke={KOERPER} strokeWidth={BREIT_SCHWANZ_FLAECHE} {...RUND} />
      )}

      {/* Lichtkante, leicht nach oben versetzt — das macht das Runde aus. */}
      <g transform="translate(0 -0.15)" opacity="0.5">
        {hauptTeile.map((lauf, i) => (
          <path key={i} d={pfadDurch(lauf)} stroke={KOERPER_HELL} strokeWidth={BREIT_LICHT} {...RUND} />
        ))}
      </g>
    </>
  );
}

/**
 * Querringe auf den geraden Gliedern — sie gliedern den Körper, man kann
 * die Länge abzählen. Auf Kurven bleiben sie weg: Dort läge der Ring
 * schief zum Körper und schwebte sichtbar daneben.
 */
export function Ringe({ schlange }: { schlange: readonly Punkt[] }) {
  const ringe = [];
  for (let i = 2; i < schlange.length - 1; i++) {
    if (gliedArt(schlange, i) !== 'gerade') continue;
    const m = kachelMitte(schlange[i]!);
    // Der Ring steht quer zum Körper: läuft dieser senkrecht, liegt der
    // Ring waagerecht.
    const quer = laeuftSenkrecht(schlange, i);
    const halb = 0.32;
    ringe.push(
      <line
        key={i}
        x1={m.x - (quer ? halb : 0)}
        y1={m.y - (quer ? 0 : halb)}
        x2={m.x + (quer ? halb : 0)}
        y2={m.y + (quer ? 0 : halb)}
        stroke={KOERPER_DUNKEL}
        strokeWidth="0.13"
        strokeLinecap="round"
        opacity="0.85"
      />,
    );
  }
  return <>{ringe}</>;
}

/**
 * Der Kopf — einmal nach rechts gezeichnet und dann in die Laufrichtung
 * gedreht. Die zwei Augen sind nicht nur Zierde: Vorher unterschied sich
 * der Kopf allein durch einen etwas dunkleren Grünton, also nur durch die
 * Farbe. Jetzt sieht man auf einen Blick, wo vorn ist.
 *
 * `key` von außen auf die Schlangenlänge gesetzt lässt beim Fressen die
 * Schluck-Animation neu anlaufen.
 */
export function Kopf({
  kopf,
  richtung,
  ruhig,
}: {
  kopf: Punkt;
  richtung: Richtung;
  ruhig: boolean;
}) {
  const m = kachelMitte(kopf);
  return (
    // **Zwei Ebenen, und das ist kein Zierrat.** Die Schluck-Animation skaliert über die einzelne
    // CSS-Eigenschaft `scale`, und die wird in der Transformationskette *vor* dem `transform`-Attribut
    // angewandt. Stand beides am selben Element, skalierte die Animation um den Ursprung der
    // viewBox statt um den Kopf: Bei jedem Apfel sprang der Kopf für 0,2 Sekunden um rund ein
    // Fünftel seiner Entfernung zur oberen linken Ecke weg — bis zu drei Felder vom Körper. Außen
    // sitzt deshalb nur die Platzierung, innen die Animation.
    <g transform={`translate(${m.x} ${m.y}) rotate(${WINKEL[richtung]})`}>
      <g className={ruhig ? undefined : 'schlange-schluckt'}>
        {/* Zunge, züngelt gelegentlich. Liegt hinter dem Kopf, damit sie
            scheinbar aus dem Maul kommt. */}
        <path
          className={ruhig ? undefined : 'schlange-zuengelt'}
          d="M0.66 0 h0.42 l0.22 -0.15 M1.08 0 l0.22 0.15"
          stroke={ZUNGE}
          strokeWidth="0.1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse rx="0.7" ry="0.56" fill={KOERPER_DUNKEL} />
        <ellipse rx="0.6" ry="0.46" fill={KOPF_HELL} />
        <ellipse cx="-0.06" cy="-0.14" rx="0.44" ry="0.17" fill="#ffffff" opacity="0.28" />
        {[-1, 1].map((seite) => (
          <g key={seite}>
            <circle cx="0.18" cy={0.24 * seite} r="0.19" fill="#ffffff" />
            <circle cx="0.24" cy={0.24 * seite} r="0.1" fill="#0b1020" />
          </g>
        ))}
      </g>
    </g>
  );
}

/**
 * Apfel und Goldstück. Beide bekommen einen dunklen Hof, damit sie sich
 * vom Grün abheben, wenn der Körper direkt daneben liegt.
 *
 * Wichtig: Das Goldstück ist ein **Stern**, kein Kreis. Vorher waren beide
 * Kreise und nur an der Farbe zu unterscheiden — das verstieß gegen die
 * Projektregel, dass Farbe nie das einzige Merkmal sein darf.
 */
export function Apfel({ ort }: { ort: Punkt }) {
  const m = kachelMitte(ort);
  return (
    <g>
      <circle cx={m.x} cy={m.y} r="0.5" fill={HOF} opacity="0.7" />
      <circle cx={m.x} cy={m.y} r="0.4" fill={APFEL} />
      <ellipse cx={m.x - 0.13} cy={m.y - 0.15} rx="0.13" ry="0.08" fill="#ffffff" opacity="0.5" />
      <path
        d={`M${m.x} ${m.y - 0.4} v-0.2`}
        stroke="#4ade80"
        strokeWidth="0.12"
        strokeLinecap="round"
      />
    </g>
  );
}

export function Goldstern({ ort, ruhig }: { ort: Punkt; ruhig: boolean }) {
  const m = kachelMitte(ort);
  const zacken: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 1 ? 0.19 : 0.46;
    const w = (Math.PI / 5) * i - Math.PI / 2;
    zacken.push(`${m.x + Math.cos(w) * r} ${m.y + Math.sin(w) * r}`);
  }
  return (
    // Der Ursprung kommt aus der Klasse (`fill-box`, Mitte). Ein eigener `transform-origin` in Pixeln
    // bezöge sich bei `fill-box` auf die obere linke Ecke des Sterns — und der Stern wanderte beim
    // Pulsieren davon.
    <g className={ruhig ? undefined : 'pulsiert-sanft'}>
      <circle cx={m.x} cy={m.y} r="0.52" fill={HOF} opacity="0.7" />
      <path d={`M${zacken.join(' L')} Z`} fill={GOLD} />
    </g>
  );
}

/**
 * Ein Fels: kantig, grau, mit heller Oberseite und dunkler Schattenseite — er soll auf den ersten
 * Blick als „hier geht es nicht weiter" lesen und sich dabei vom grünen Körper und den runden Äpfeln
 * in der **Form** unterscheiden, nicht nur in der Farbe.
 *
 * Alle Felsen eines Bildes haben dieselbe Gestalt; ein Fels aus mehreren Kacheln liest sich dadurch
 * als Gruppe einzelner Steine, nicht als eine zusammenhängende Wand — und genau so ist er gebaut.
 */
export function Fels({ ort }: { ort: Punkt }) {
  return (
    <g transform={`translate(${ort.x} ${ort.y})`}>
      <ellipse cx="0.5" cy="0.9" rx="0.42" ry="0.1" fill="#000000" opacity="0.3" />
      <path
        d="M0.1 0.8 L0.06 0.46 L0.26 0.14 L0.62 0.07 L0.9 0.28 L0.94 0.66 L0.72 0.9 L0.3 0.92Z"
        fill="#6b7280"
        stroke="#374151"
        strokeWidth="0.06"
        strokeLinejoin="round"
      />
      <path d="M0.26 0.14 L0.62 0.07 L0.9 0.28 L0.56 0.36 L0.34 0.42 L0.06 0.46Z" fill="#9ca3af" />
      <path d="M0.56 0.36 L0.9 0.28 L0.94 0.66 L0.72 0.9 L0.58 0.62Z" fill="#4b5563" />
    </g>
  );
}

/**
 * Der Rand der Arena. **Zwei verschiedene Bilder, nicht zwei Farben:** Eine Mauer ist ein
 * durchgehender Streifen aus roten und gelben Strichen (Warnband), ein offener Rand nur eine feine,
 * gepunktete Linie. Wer die Farben nicht unterscheidet, sieht trotzdem sofort, dass hier etwas
 * anders ist — und genau das ist die Information, auf die es bei jedem Randfeld ankommt.
 */
export const Randrahmen = memo(function Randrahmen({
  rand,
  breite,
  hoehe,
}: {
  rand: Rand;
  breite: number;
  hoehe: number;
}) {
  if (rand === 'mauer') {
    const b = breite - 0.28;
    const h = hoehe - 0.28;
    return (
      <g aria-hidden="true">
        <rect x="0.14" y="0.14" width={b} height={h} fill="none" stroke="#b91c1c" strokeWidth="0.28" />
        <rect
          x="0.14"
          y="0.14"
          width={b}
          height={h}
          fill="none"
          stroke="#fde68a"
          strokeWidth="0.28"
          strokeDasharray="0.45 0.45"
        />
      </g>
    );
  }
  return (
    <rect
      x="0.08"
      y="0.08"
      width={breite - 0.16}
      height={hoehe - 0.16}
      fill="none"
      stroke="#60a5fa"
      strokeWidth="0.07"
      strokeDasharray="0.2 0.3"
      opacity="0.6"
      aria-hidden="true"
    />
  );
});

/**
 * Die drei Extras. Jedes hat eine **eigene Silhouette**: das Gold einen Stern, die Zeitlupe eine
 * Scheibe mit Zeigern, die Schere eine Scheibe mit gekreuzten Klingen. Dazu läuft ein weißer Ring um
 * das Extra herum ab — er zeigt, wie lange es noch liegt, ohne zu blinken (Dauerpulse gibt es nur
 * unter 1,7 Hz, und ein schrumpfender Ring braucht nicht einmal das).
 */
export function ExtraBild({ extra, rest, ruhig }: { extra: Extra; rest: number; ruhig: boolean }) {
  const m = kachelMitte(extra);
  const anteil = Math.max(0, Math.min(1, rest / EXTRA_DAUER));
  return (
    <g>
      {extra.art === 'gold' ? (
        <Goldstern ort={extra} ruhig={ruhig} />
      ) : (
        <g>
          <circle cx={m.x} cy={m.y} r="0.52" fill={HOF} opacity="0.7" />
          <circle
            cx={m.x}
            cy={m.y}
            r="0.4"
            fill={extra.art === 'zeitlupe' ? '#0ea5e9' : '#f97316'}
          />
          {extra.art === 'zeitlupe' ? (
            <g stroke="#ffffff" strokeWidth="0.09" strokeLinecap="round" fill="none">
              <circle cx={m.x} cy={m.y} r="0.25" strokeWidth="0.07" />
              <path d={`M${m.x} ${m.y} v-0.17 M${m.x} ${m.y} l0.11 0.07`} />
            </g>
          ) : (
            <g stroke="#ffffff" strokeWidth="0.09" strokeLinecap="round" fill="none">
              <path
                d={`M${m.x - 0.22} ${m.y - 0.25} L${m.x + 0.1} ${m.y + 0.08} M${m.x + 0.22} ${m.y - 0.25} L${m.x - 0.1} ${m.y + 0.08}`}
              />
              <circle cx={m.x - 0.14} cy={m.y + 0.2} r="0.09" strokeWidth="0.06" />
              <circle cx={m.x + 0.14} cy={m.y + 0.2} r="0.09" strokeWidth="0.06" />
            </g>
          )}
        </g>
      )}
      <circle
        cx={m.x}
        cy={m.y}
        r="0.58"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.07"
        strokeLinecap="round"
        opacity="0.85"
        pathLength="1"
        strokeDasharray={`${anteil} 1`}
        transform={`rotate(-90 ${m.x} ${m.y})`}
      />
    </g>
  );
}

/**
 * Schwaches Raster im Hintergrund, damit man die Kacheln noch ahnt.
 *
 * `memo`, weil die Maße des Bretts fest sind: Ohne das baut React die 32
 * Linien bei **jedem** Bild neu auf, obwohl sich daran nie etwas ändert.
 */
export const Raster = memo(function Raster({ breite, hoehe }: { breite: number; hoehe: number }) {
  const linien = [];
  for (let i = 1; i < breite; i++) {
    linien.push(
      <line key={`s${i}`} x1={i} y1={0} x2={i} y2={hoehe} stroke="#1c2735" strokeWidth="0.03" />,
    );
  }
  for (let i = 1; i < hoehe; i++) {
    linien.push(
      <line key={`z${i}`} x1={0} y1={i} x2={breite} y2={i} stroke="#1c2735" strokeWidth="0.03" />,
    );
  }
  return <>{linien}</>;
});
