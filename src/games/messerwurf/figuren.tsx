/**
 * Die Bildteile von Blade Toss — Bretterwand, Stamm, Messer, Apfel.
 *
 * Alles im Koordinatensystem 0…100 waagerecht, 0…`HOEHE` senkrecht. Der
 * Stamm sitzt oben, darunter ist Platz für das anfliegende Messer.
 *
 * Ein steckendes Messer wird **nicht** an eine berechnete Position gesetzt,
 * sondern immer an derselben Stelle gezeichnet (unten am Stamm) und dann um
 * den Stammmittelpunkt gedreht. Das ist der Grund, warum die Logik
 * Steckwinkel und nicht Koordinaten speichert: Drehen ist eine einzige
 * Transformation, Koordinaten wären an jeder Stelle neu zu rechnen.
 */

export const MITTE = { x: 50, y: 45 };
export const RADIUS = 28;

/** Wie tief die Klinge im Holz steckt. */
const KLINGE_TIEFE = 9;

/**
 * Halbe Breite der Klinge. **Hängt an `MIN_ABSTAND` in `logik.ts`**: Zwei
 * Klingen dürfen sich auf dem Stammrand (Halbmesser 28) gerade nicht
 * berühren, wenn ihre Mitten `MIN_ABSTAND` auseinanderliegen —
 * 2 · 2,2 / 28 ≈ 0,157. Wer eine der beiden Zahlen ändert, ändert die andere mit,
 * sonst steckt ein „erlaubtes" Messer sichtbar im Nachbarn oder ein
 * „tödliches" liegt sichtbar daneben.
 */
const KLINGE_HALB = 2.2;

const HOLZ = '#c08a4e';
const HOLZ_DUNKEL = '#8a5c2b';
const RINDE = '#5b3a1c';
/** Der Boss-Stamm: dunkleres, fast rötliches Holz. */
const HOLZ_BOSS = '#a0673a';
const RINDE_BOSS = '#3a1f12';
const KLINGE = '#cbd5e1';
const KLINGE_DUNKEL = '#64748b';
const GRIFF = '#3f2410';
/** Für die beiden Klingen, die am Rundenende zusammengestoßen sind. */
const ALARM_DUNKEL = '#dc2626';

const APFEL = '#dc2626';
const APFEL_RAND = '#7f1d1d';
/** Das Fruchtfleisch an der Schnittfläche. */
const APFEL_INNEN = '#fde68a';

/** Jahresringe — feste Liste, kein Zufall. */
const RINGE: readonly { r: number; breite: number }[] = [
  { r: 22, breite: 1.2 },
  { r: 17, breite: 0.9 },
  { r: 12, breite: 1.1 },
  { r: 7, breite: 0.8 },
];

/** Höhe der Zeichenfläche. Knapp bemessen: Unter dem Stamm braucht es nur
 *  so viel Platz, dass das fliegende Messer von außerhalb hereinkommt. */
export const HOEHE = 112;

/**
 * Die Bretterwand hinter dem Stamm.
 *
 * Als einziges Spiel hatte Blade Toss gar keine Brettfläche — der Stamm
 * schwebte frei auf dem Seitenhintergrund, und sein Schlagschatten lag auf
 * nichts. Die Wand gibt ihm einen Ort und ist bewusst dunkel und ruhig
 * gehalten: Das helle Holz und die Klingen sollen davor stehen, nicht mit
 * ihr um Aufmerksamkeit ringen.
 */
export function Bretterwand() {
  return (
    <g aria-hidden="true">
      <defs>
        {/* Feste id wie bei den App-Symbolen: Das Brett kann mehrfach auf
            einer Seite stehen, die Definition ist dann überall dieselbe. */}
        <linearGradient id="messerwurf-wand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f1e10" />
          <stop offset="0.55" stopColor="#1d120a" />
          <stop offset="1" stopColor="#120b05" />
        </linearGradient>
        <radialGradient id="messerwurf-schein" cx="0.5" cy={MITTE.y / HOEHE} r="0.55">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height={HOEHE} fill="url(#messerwurf-wand)" />
      {[20, 40, 60, 80].map((x) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2={HOEHE} stroke="#0a0603" strokeWidth="1" opacity="0.75" />
          <line x1={x + 0.9} y1="0" x2={x + 0.9} y2={HOEHE} stroke="#4a2f18" strokeWidth="0.5" opacity="0.5" />
        </g>
      ))}
      {/* Warmes Licht auf der Wand hinter dem Stamm — dadurch liest sich die
          Fläche als Raum und nicht als schwarzer Kasten. */}
      <rect width="100" height={HOEHE} fill="url(#messerwurf-schein)" />
    </g>
  );
}

/**
 * Der Stamm von vorn. Die Rinde ist ein eigener Ring außen, damit man
 * sieht, dass die Klingen wirklich **im** Holz stecken und nicht davor
 * liegen.
 */
export function Stamm({ boss = false }: { boss?: boolean }) {
  return (
    <g aria-hidden="true">
      <circle cx={MITTE.x} cy={MITTE.y + 1.5} r={RADIUS} fill="#000000" opacity="0.35" />
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS} fill={boss ? RINDE_BOSS : RINDE} />
      <circle cx={MITTE.x} cy={MITTE.y} r={RADIUS - 3} fill={boss ? HOLZ_BOSS : HOLZ} />
      {RINGE.map((ring) => (
        <circle
          key={ring.r}
          cx={MITTE.x}
          cy={MITTE.y}
          r={ring.r}
          fill="none"
          stroke={HOLZ_DUNKEL}
          strokeWidth={ring.breite}
          opacity="0.55"
        />
      ))}
      <circle cx={MITTE.x} cy={MITTE.y} r="2.6" fill={HOLZ_DUNKEL} />
      {/* Der Boss trägt zwei Eisenbänder und Nieten — die Form allein sagt „das ist ein anderer
          Stamm", ohne sich auf eine Farbe zu verlassen. Die Bänder liegen **unter** den Klingen. */}
      {boss && (
        <g>
          {[24.5, 15].map((r) => (
            <g key={r}>
              <circle cx={MITTE.x} cy={MITTE.y} r={r} fill="none" stroke="#1e293b" strokeWidth="3" opacity="0.85" />
              <circle cx={MITTE.x} cy={MITTE.y} r={r - 0.6} fill="none" stroke="#94a3b8" strokeWidth="0.8" opacity="0.75" />
            </g>
          ))}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2 + 0.26;
            return (
              <circle
                key={i}
                cx={MITTE.x + Math.cos(a) * 24.5}
                cy={MITTE.y + Math.sin(a) * 24.5}
                r="0.9"
                fill="#cbd5e1"
                stroke="#0f172a"
                strokeWidth="0.4"
              />
            );
          })}
        </g>
      )}
      {/* Lichtkante oben links, wie bei den anderen Figuren im Projekt. */}
      <path
        d={`M${MITTE.x - 19} ${MITTE.y - 16} A26 26 0 0 1 ${MITTE.x + 12} ${MITTE.y - 23}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.18"
      />
    </g>
  );
}

/**
 * Ein Messer, gezeichnet unten am Stamm und nach oben zeigend.
 *
 * `alarm` zieht einen roten Umriss darum: So ist am Rundenende zu sehen,
 * welche beiden Klingen zusammengestoßen sind.
 */
function MesserForm({ alarm = false }: { alarm?: boolean }) {
  const spitze = MITTE.y + RADIUS - KLINGE_TIEFE;
  const schulter = MITTE.y + RADIUS + 3;
  const b = KLINGE_HALB;
  const klinge = `M${MITTE.x} ${spitze} L${MITTE.x + b} ${spitze + 7} L${MITTE.x + b} ${schulter} L${MITTE.x - b} ${schulter} L${MITTE.x - b} ${spitze + 7} Z`;
  return (
    <>
      <path d={klinge} fill={KLINGE} />
      {/* Schattenseite rechts — macht aus der Fläche eine Klinge. */}
      <path
        d={`M${MITTE.x + 0.6} ${spitze + 2} L${MITTE.x + b} ${spitze + 7} L${MITTE.x + b} ${schulter} L${MITTE.x + 0.6} ${schulter} Z`}
        fill={KLINGE_DUNKEL}
      />
      <rect x={MITTE.x - b - 1.2} y={schulter} width={2 * b + 2.4} height="2.4" rx="1" fill={KLINGE_DUNKEL} />
      <rect x={MITTE.x - b} y={schulter + 2.4} width={2 * b} height="12" rx="2" fill={GRIFF} />
      <rect x={MITTE.x - 1} y={schulter + 4} width="1.1" height="8" rx="0.55" fill="#ffffff" opacity="0.22" />
      {/* Der rote Umriss kommt **über** die Klinge und ist dünn: Ein dicker
          Saum darunter verschmolz die beiden beteiligten Messer zu einem
          roten Klecks, und dann sah man erst recht nicht, was passiert ist.
          Die Klinge bleibt stahlfarben und damit als Messer erkennbar. */}
      {alarm && <path d={klinge} fill="none" stroke={ALARM_DUNKEL} strokeWidth="1.6" strokeLinejoin="round" />}
    </>
  );
}

/**
 * Der Aufschlag zweier Klingen: ein Funkenstern am Stammrand.
 *
 * Am Rundenende stehen dort zwei Messer fast übereinander — die
 * unterscheidet niemand. Der Stern sagt „hier war der Zusammenstoß", und
 * zwar ohne sich allein auf die Farbe Rot zu verlassen.
 */
export function Zusammenstoss({ drehung }: { drehung: number }) {
  const y = MITTE.y + RADIUS - 2;
  const strahlen = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <circle cx={MITTE.x} cy={y} r="9" fill={ALARM_DUNKEL} opacity="0.3" />
      {strahlen.map((winkel) => {
        const bogen = (winkel * Math.PI) / 180;
        const lang = winkel % 90 === 0 ? 12.5 : 9.5;
        return (
          <line
            key={winkel}
            x1={MITTE.x + Math.cos(bogen) * 5}
            y1={y + Math.sin(bogen) * 5}
            x2={MITTE.x + Math.cos(bogen) * lang}
            y2={y + Math.sin(bogen) * lang}
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.95"
          />
        );
      })}
    </g>
  );
}

/**
 * Ein steckendes Messer. `drehung` ist der Winkel in Grad, um den es
 * gegenüber der Einschlagstelle unten weitergedreht ist.
 */
export function SteckendesMesser({ drehung, alarm = false }: { drehung: number; alarm?: boolean }) {
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      <MesserForm alarm={alarm} />
    </g>
  );
}

/** Startversatz des fliegenden Messers — so weit unterhalb seiner Endlage
 *  beginnt es, also außerhalb der Zeichenfläche. */
const ANFLUG = 36;

/** Das Messer auf dem Weg zum Stamm. `fortschritt` läuft von 0 bis 1. */
export function FliegendesMesser({ fortschritt }: { fortschritt: number }) {
  return (
    <g transform={`translate(0 ${(1 - fortschritt) * ANFLUG})`} aria-hidden="true">
      <MesserForm />
    </g>
  );
}

/** Wo ein Apfel auf dem Stammrand sitzt. */
const APFEL_Y = MITTE.y + RADIUS - 4;

/** Der goldene Apfel des Boss-Stamms. */
const GOLD = '#fbbf24';
const GOLD_RAND = '#a16207';

/**
 * Ein Apfel auf dem Stammrand. Der goldene ist **größer**, hat eine **andere
 * Form** (ein Stern im Apfel, kein bloßer Farbton) und einen hellen Schein: Bei
 * einem Spiel, in dem man beim Zielen nicht lange hinsieht, muss die Silhouette
 * sagen, dass er das Vierfache wert ist.
 */
export function Apfel({ drehung, gold = false }: { drehung: number; gold?: boolean }) {
  const y = APFEL_Y;
  const r = gold ? 5.6 : 4.6;
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true">
      {gold && <circle cx={MITTE.x} cy={y} r={r + 3} fill={GOLD} opacity="0.28" />}
      <path
        d={`M${MITTE.x} ${y - r - 0.9} q-1.5 -2.5 -3.5 -2.8`}
        fill="none"
        stroke="#4d7c0f"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle
        cx={MITTE.x}
        cy={y}
        r={r}
        fill={gold ? GOLD : APFEL}
        stroke={gold ? GOLD_RAND : APFEL_RAND}
        strokeWidth="1"
        paintOrder="stroke"
      />
      {gold ? (
        <polygon
          points={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map((i) => {
              const a = -Math.PI / 2 + (i * Math.PI) / 5;
              const rr = i % 2 === 0 ? 3 : 1.3;
              return `${(MITTE.x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr + 0.3).toFixed(2)}`;
            })
            .join(' ')}
          fill="#fffbeb"
          stroke={GOLD_RAND}
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
      ) : (
        <ellipse cx={MITTE.x - 1.6} cy={y - 1.8} rx="1.5" ry="1" fill="#ffffff" opacity="0.5" />
      )}
    </g>
  );
}

/**
 * Die beiden Hälften eines eben zerteilten Apfels.
 *
 * Sie fliegen quer zur Klinge auseinander — das Messer kommt von unten, der
 * Schnitt liegt also senkrecht, und die Hälften weichen nach links und
 * rechts aus. `fortschritt` läuft von 0 (gerade getroffen, beide Hälften
 * liegen noch aufeinander) bis 1 (verschwunden).
 *
 * Die Zeit dafür zählt die Logik mit (`ZERTEILT_S`), nicht eine
 * CSS-Animation: Der Apfel ist im selben Augenblick aus `aepfel`
 * verschwunden, in dem er getroffen wird — die Anzeige hätte gar nichts
 * mehr, woran sie eine Animation aufhängen könnte.
 */
export function ZerteilterApfel({ drehung, fortschritt, gold = false }: { drehung: number; fortschritt: number; gold?: boolean }) {
  const y = APFEL_Y;
  const r = gold ? 5.6 : 4.6;
  const weg = fortschritt * 7;
  const kippen = fortschritt * 40;
  // Erst gegen Ende ausblenden, sonst sieht man das Auseinanderfliegen kaum.
  const deckkraft = Math.max(0, 1 - fortschritt * fortschritt);
  return (
    <g transform={`rotate(${drehung} ${MITTE.x} ${MITTE.y})`} aria-hidden="true" opacity={deckkraft}>
      {[-1, 1].map((seite) => (
        <g
          key={seite}
          transform={`translate(${seite * weg} ${fortschritt * 2}) rotate(${seite * kippen} ${MITTE.x} ${y})`}
        >
          <path
            d={`M${MITTE.x} ${y - r} A${r} ${r} 0 0 ${seite > 0 ? 1 : 0} ${MITTE.x} ${y + r} Z`}
            fill={gold ? GOLD : APFEL}
            stroke={gold ? GOLD_RAND : APFEL_RAND}
            strokeWidth="1"
            paintOrder="stroke"
          />
          {/* Die helle Schnittfläche ist das, was „zerteilt" überhaupt lesbar
              macht — zwei rote Halbkreise allein sähen aus wie ein Apfel. */}
          <path
            d={`M${MITTE.x} ${y - r + 0.2} L${MITTE.x} ${y + r - 0.2}`}
            stroke={APFEL_INNEN}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

/** Kleines Messer für die Vorratsanzeige unten. */
export function VorratsMesser({ verbraucht }: { verbraucht: boolean }) {
  return (
    <svg viewBox="0 0 12 30" width="10" height="25" aria-hidden="true" opacity={verbraucht ? 0.22 : 1}>
      <path d="M6 0 L9 7 L9 17 L3 17 L3 7 Z" fill={KLINGE} />
      <rect x="1.4" y="17" width="9.2" height="2.4" rx="1" fill={KLINGE_DUNKEL} />
      <rect x="3" y="19.4" width="6" height="10" rx="2.6" fill={GRIFF} />
    </svg>
  );
}
