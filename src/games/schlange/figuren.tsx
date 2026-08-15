import type { Punkt, Richtung } from './logik';
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
    <g
      className={ruhig ? undefined : 'schlange-schluckt'}
      transform={`translate(${m.x} ${m.y}) rotate(${WINKEL[richtung]})`}
    >
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
    <g className={ruhig ? undefined : 'pulsiert-sanft'} style={{ transformOrigin: `${m.x}px ${m.y}px` }}>
      <circle cx={m.x} cy={m.y} r="0.52" fill={HOF} opacity="0.7" />
      <path d={`M${zacken.join(' L')} Z`} fill={GOLD} />
    </g>
  );
}

/** Schwaches Raster im Hintergrund, damit man die Kacheln noch ahnt. */
export function Raster({ breite, hoehe }: { breite: number; hoehe: number }) {
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
}
