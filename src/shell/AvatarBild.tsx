import type { AvatarKonfig } from './avatar';

/**
 * Die Avatar-Figur als SVG — ein Mensch, kein Fantasiewesen.
 *
 * Die erste Fassung war ein runder Blob mit zwei Augen. Rückmeldung: „Sieht
 * das nicht aus wie ein Wassertropfen? Ich will, dass die Avatare richtig
 * Menschen sind, die man anziehen kann." Die zweite Fassung hatte Kleidung,
 * aber nur in einer Farbe je Kleidungsstück — Rückmeldung: „nicht nur ein
 * T-Shirt, sondern langärmlig, kurzärmlig, ein Unterhemd … kurze, lange,
 * breite, dünne Hosen." **Schnitt und Farbe sind seither getrennte Teile**
 * (siehe `avatar.ts`), diese Datei zeichnet nur, was daraus zusammenkommt.
 *
 * Derselbe Aufbau wie die App-Symbole in `core/AppSymbol.tsx`: Licht oben
 * links, Schatten unten rechts, ein einzelner harter Glanzpunkt auf der
 * Haut statt zweier aufeinandergelegter Flächen — dieselbe Regel wie beim
 * Sternenschlucker in `platzhalter/Figur.tsx`, damit keine Kante quer über
 * eine Fläche läuft.
 *
 * ViewBox absichtlich hochkant (64×78): Die Figur steht, sie ist kein
 * Kreis. In einem quadratischen `size-N`-Rahmen (überall dort, wo der
 * Avatar auftaucht) bleibt links und rechts etwas Luft — wie ein Porträt
 * in einem quadratischen Passbild, nicht verzerrt.
 */

const HAUTTON: Record<string, { hell: string; dunkel: string }> = {
  hell: { hell: '#fde3cd', dunkel: '#e8a672' },
  mittel: { hell: '#eab784', dunkel: '#c17f45' },
  oliv: { hell: '#d1a26c', dunkel: '#9c7040' },
  braun: { hell: '#a9744a', dunkel: '#7a4f2c' },
  dunkel: { hell: '#7a4a2c', dunkel: '#4f2e19' },
};

const HAARTON: Record<string, string> = {
  braun: '#5c3a21',
  schwarz: '#231a14',
  grau: '#9ca3af',
  blond: '#e8c46a',
  rot: '#b5502e',
  orange: '#ea580c',
  blau: '#3b82f6',
  pink: '#ec4899',
  gruen: '#22c55e',
};

const KLEIDUNGSTON: Record<string, { hell: string; dunkel: string }> = {
  blau: { hell: '#7dd3fc', dunkel: '#0369a1' },
  gruen: { hell: '#86efac', dunkel: '#15803d' },
  orange: { hell: '#fdba74', dunkel: '#c2410c' },
  pink: { hell: '#f9a8d4', dunkel: '#be185d' },
  violett: { hell: '#c4b5fd', dunkel: '#6d28d9' },
  gold: { hell: '#fde68a', dunkel: '#b45309' },
  grau: { hell: '#cbd5e1', dunkel: '#475569' },
  schwarz: { hell: '#525252', dunkel: '#171717' },
  braun: { hell: '#a9744a', dunkel: '#6b4226' },
  weiss: { hell: '#ffffff', dunkel: '#cbd5e1' },
  rot: { hell: '#fca5a5', dunkel: '#b91c1c' },
  tuerkis: { hell: '#5eead4', dunkel: '#0f766e' },
  gelb: { hell: '#fde047', dunkel: '#ca8a04' },
  beige: { hell: '#e7d3b0', dunkel: '#a68a5f' },
};

function tonVon(tabelle: Record<string, { hell: string; dunkel: string }>, id: string) {
  return tabelle[id] ?? tabelle.blau!;
}

const MITTE = 32;
/** Mittelpunkt des Kopfes und sein Radius — alle Frisuren rechnen relativ dazu. */
const KOPF_Y = 15;
const KOPF_R = 9;
/** Wo der Rumpf anfängt (Schulterlinie) — für Fliege und Rollkragen gebraucht. */
const SCHULTER_Y = 25;

/**
 * Die Frisur — hinter dem Kopf gezeichnet (niedrigere Position im
 * Markup), damit lange Strähnen seitlich am Kopf vorbei bis zu den
 * Schultern reichen können, ohne das Gesicht zu verdecken.
 *
 * Acht Frisuren statt der ursprünglichen fünf — Rückmeldung: „viel mehr
 * Frisuren". Jede baut auf der „Kappe" auf (deckt das obere Kopfdrittel
 * ab) oder ersetzt sie ganz, wie bei `lockig` und `irokese`.
 *
 * Bewusst kein `null` bei einer gewählten Cap (`accessoire` beginnt mit
 * `cap-`), das entscheidet die aufrufende Stelle: Eine Cap deckt die Haare
 * ab, verdrängt sie aber nicht aus der Auswahl — beides bleibt unabhängig
 * wählbar, wie bei einer echten Cap über echten Haaren auch.
 */
function Frisur({ art, farbe }: { art: string; farbe: string }) {
  if (art === 'kahl') return null;

  // Die „Kappe": deckt das obere Kopfdrittel ab, Haaransatz knapp über
  // den Augen. Basis für kurz/mittel/zopf/zwei-zoepfe/lang.
  const kappe = `M${MITTE - 8.5},${KOPF_Y - 1} Q${MITTE - 9.5},${KOPF_Y - 11} ${MITTE},${KOPF_Y - 11.5} Q${MITTE + 9.5},${KOPF_Y - 11} ${MITTE + 8.5},${KOPF_Y - 1} Q${MITTE},${KOPF_Y - 5} ${MITTE - 8.5},${KOPF_Y - 1} Z`;

  // Eine Strähne, seitlich am Kopf vorbei bis zur Höhe `bisY`. Für
  // 'lang' (Schultern) und 'zwei-zoepfe' (kürzer, bis übers Ohr) dieselbe
  // Formel, nur mit anderer Länge — sonst zwei fast identische Pfade,
  // die beim nächsten Ändern leicht auseinanderlaufen.
  const straehne = (seite: 1 | -1, bisY: number) => {
    const innen = MITTE + seite * 6;
    const aussenAnsatz = MITTE + seite * 8.5;
    const aussenUnten = MITTE + seite * (10.5 + (bisY - (KOPF_Y + 16)) * 0.15);
    return `M${aussenAnsatz},${KOPF_Y - 2} Q${MITTE + seite * 12},${KOPF_Y + 6} ${aussenUnten},${bisY}
            L${innen},${bisY} Q${innen + seite},${KOPF_Y + 4} ${innen - seite * 0.5},${KOPF_Y - 3} Z`;
  };

  if (art === 'lockig') {
    // Statt der glatten Kappe eine krause Kontur aus überlappenden Kreisen
    // entlang des oberen Kopfbogens — eine glatte Fläche sähe bei „lockig"
    // wie ein Helm aus, nicht wie Haar.
    const kreise = [-7, -4.5, -2, 0, 2, 4.5, 7].map((dx, i) => (
      <circle key={i} cx={MITTE + dx} cy={KOPF_Y - 8 + Math.abs(dx) * 0.25} r={4.2} fill={farbe} />
    ));
    return <g>{kreise}</g>;
  }

  if (art === 'irokese') {
    // Ein einzelner hoher Kamm über der Mitte, seitlich am Kopf nichts —
    // die auffälligste Silhouette im ganzen Satz, bewusst als seltene,
    // späte Freischaltung.
    return (
      <path
        d={`M${MITTE - 2.5},${KOPF_Y - 2} Q${MITTE - 3},${KOPF_Y - 16} ${MITTE},${KOPF_Y - 17}
            Q${MITTE + 3},${KOPF_Y - 16} ${MITTE + 2.5},${KOPF_Y - 2}
            Q${MITTE},${KOPF_Y - 5} ${MITTE - 2.5},${KOPF_Y - 2} Z`}
        fill={farbe}
      />
    );
  }

  if (art === 'zopf') {
    return (
      <g fill={farbe}>
        <path d={kappe} />
        {/* Der Zopf hängt an der rechten Seite herunter, mit einem
            dunkleren Haargummi kurz unterhalb des Ansatzes. */}
        <path
          d={`M${MITTE + 7},${KOPF_Y - 4} Q${MITTE + 13},${KOPF_Y} ${MITTE + 10},${KOPF_Y + 14} Q${MITTE + 8.5},${KOPF_Y + 15} ${MITTE + 7},${KOPF_Y + 14} Q${MITTE + 9},${KOPF_Y + 2} ${MITTE + 4},${KOPF_Y - 3} Z`}
        />
        <ellipse cx={MITTE + 9} cy={KOPF_Y + 3} rx={2.2} ry={1.4} fill="#1e293b" opacity={0.55} />
      </g>
    );
  }

  if (art === 'zwei-zoepfe') {
    return (
      <g fill={farbe}>
        <path d={kappe} />
        <path d={straehne(-1, KOPF_Y + 11)} />
        <path d={straehne(1, KOPF_Y + 11)} />
        <ellipse cx={MITTE - 9.5} cy={KOPF_Y + 1} rx={1.8} ry={1.3} fill="#1e293b" opacity={0.55} />
        <ellipse cx={MITTE + 9.5} cy={KOPF_Y + 1} rx={1.8} ry={1.3} fill="#1e293b" opacity={0.55} />
      </g>
    );
  }

  if (art === 'lang') {
    return (
      <g fill={farbe}>
        <path d={kappe} />
        <path d={straehne(-1, KOPF_Y + 16)} />
        <path d={straehne(1, KOPF_Y + 16)} />
      </g>
    );
  }

  if (art === 'mittel') {
    // Zwischen kurz und lang: dieselbe Kappe, dazu zwei kurze Seiten, die
    // knapp übers Ohr reichen, aber nie bis zur Schulter.
    return (
      <g fill={farbe}>
        <path d={kappe} />
        <path
          d={`M${MITTE - 8.5},${KOPF_Y - 1} Q${MITTE - 10.5},${KOPF_Y + 3} ${MITTE - 8.5},${KOPF_Y + 6} L${MITTE - 6},${KOPF_Y + 6} Q${MITTE - 7},${KOPF_Y + 2} ${MITTE - 6},${KOPF_Y - 2} Z`}
        />
        <path
          d={`M${MITTE + 8.5},${KOPF_Y - 1} Q${MITTE + 10.5},${KOPF_Y + 3} ${MITTE + 8.5},${KOPF_Y + 6} L${MITTE + 6},${KOPF_Y + 6} Q${MITTE + 7},${KOPF_Y + 2} ${MITTE + 6},${KOPF_Y - 2} Z`}
        />
      </g>
    );
  }

  // 'kurz' — die Kappe allein.
  return <path d={kappe} fill={farbe} />;
}

/** Zwei Augen, ein angedeutetes Lächeln — bei jeder Frisur an derselben Stelle. */
function Gesicht() {
  return (
    <g>
      <circle cx={MITTE - 3.6} cy={KOPF_Y} r={1.3} fill="#1e293b" />
      <circle cx={MITTE + 3.6} cy={KOPF_Y} r={1.3} fill="#1e293b" />
      <path
        d={`M${MITTE - 2.8},${KOPF_Y + 4} Q${MITTE},${KOPF_Y + 5.6} ${MITTE + 2.8},${KOPF_Y + 4}`}
        stroke="#1e293b"
        strokeWidth={1}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
    </g>
  );
}

/** Die drei Cap-Farben — siehe `avatar.ts` für die Begründung. */
const CAP_FARBE: Record<string, { hell: string; dunkel: string }> = {
  'cap-schwarz': { hell: '#3f3f46', dunkel: '#18181b' },
  'cap-weiss': { hell: '#f8fafc', dunkel: '#cbd5e1' },
  'cap-gruen': { hell: '#4ade80', dunkel: '#15803d' },
};

/** Das Extra — Brille und Fliege liegen über der Kleidung, Cap und Krone über der Frisur. */
function Accessoire({ art }: { art: string }) {
  if (art === 'brille') {
    return (
      <g stroke="#1e293b" strokeWidth={1.4} fill="none">
        <circle cx={MITTE - 3.6} cy={KOPF_Y} r={4} />
        <circle cx={MITTE + 3.6} cy={KOPF_Y} r={4} />
        <path d={`M${MITTE - 0.4},${KOPF_Y - 0.6} h0.8`} strokeLinecap="round" />
      </g>
    );
  }
  if (art === 'fliege') {
    const cy = SCHULTER_Y + 2;
    return (
      <g fill="#ef4444" stroke="#991b1b" strokeWidth={0.6}>
        <path d={`M${MITTE - 1},${cy} L${MITTE - 6},${cy - 3} L${MITTE - 6},${cy + 3} Z`} />
        <path d={`M${MITTE + 1},${cy} L${MITTE + 6},${cy - 3} L${MITTE + 6},${cy + 3} Z`} />
        <circle cx={MITTE} cy={cy} r={1.6} stroke="none" />
      </g>
    );
  }
  if (art.startsWith('cap-')) {
    // Eine Cap statt einer Wintermütze — Rückmeldung: „Könnten wir
    // schwarze Cappy machen? Auch eine weiße und eine grüne." Drei
    // eigene Farben statt einer festen (siehe `avatar.ts`); die Form ist
    // für alle drei gleich, nur die Farbe kommt aus der ID.
    //
    // „-hinten" — Rückmeldung: „dass man die Kappe andersrum anziehen
    // kann." Dieselbe Kuppel, aber von vorn gesehen fehlt der Schirm (er
    // zeigt nach hinten, weg von der Kamera); stattdessen blitzt seitlich
    // der Verschluss-Riemen hervor, wie bei einer echten Cap andersrum.
    const hinten = art.endsWith('-hinten');
    const basis = hinten ? art.slice(0, -'-hinten'.length) : art;
    const farbe = CAP_FARBE[basis] ?? CAP_FARBE['cap-schwarz']!;
    return (
      <g fill={farbe.hell}>
        {/* Die Kuppel, wie bei einer Kappe ohne Bommel. */}
        <path
          d={`M${MITTE - 9},${KOPF_Y - 2} Q${MITTE - 10},${KOPF_Y - 13} ${MITTE},${KOPF_Y - 13.5} Q${MITTE + 10},${KOPF_Y - 13} ${MITTE + 9},${KOPF_Y - 2} Z`}
        />
        {hinten ? (
          <>
            <rect x={MITTE - 10.5} y={KOPF_Y - 4} width={2.4} height={3} rx={1} fill={farbe.dunkel} />
            <rect x={MITTE + 8.1} y={KOPF_Y - 4} width={2.4} height={3} rx={1} fill={farbe.dunkel} />
          </>
        ) : (
          // Der Schirm — ragt vorn (unten) über die Stirn, dunklerer Ton
          // für etwas Tiefe.
          <ellipse cx={MITTE} cy={KOPF_Y - 1.5} rx={7} ry={2.2} fill={farbe.dunkel} />
        )}
      </g>
    );
  }
  if (art === 'kopfhoerer') {
    // Fest in Dunkelgrau, wie die Fliege in Fest-Rot — keine eigene
    // Farbwahl für ein einzelnes Extra. Bewusst NICHT Teil von
    // `zeigeHaare`: Kopfhörer sitzen über der Frisur, statt sie zu
    // ersetzen, wie bei einer echten Frisur mit Kopfhörern auch.
    return (
      <g>
        <path
          d={`M${MITTE - 9.5},${KOPF_Y - 1} Q${MITTE - 9.5},${KOPF_Y - 14} ${MITTE},${KOPF_Y - 14} Q${MITTE + 9.5},${KOPF_Y - 14} ${MITTE + 9.5},${KOPF_Y - 1}`}
          stroke="#27272a"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx={MITTE - 9.5} cy={KOPF_Y + 1} rx={2.6} ry={3.6} fill="#27272a" />
        <ellipse cx={MITTE + 9.5} cy={KOPF_Y + 1} rx={2.6} ry={3.6} fill="#27272a" />
        <ellipse cx={MITTE - 9.5} cy={KOPF_Y + 1} rx={1.3} ry={2} fill="#52525b" />
        <ellipse cx={MITTE + 9.5} cy={KOPF_Y + 1} rx={1.3} ry={2} fill="#52525b" />
      </g>
    );
  }
  if (art === 'schal') {
    // Fest in Petrol — Wickel um den Hals, ein Zipfel hängt über die
    // Brust. Andere feste Farbe als die Fliege (Rot), damit die beiden
    // sich nicht wie Varianten derselben Idee anfühlen.
    return (
      <g fill="#0d9488" stroke="#134e4a" strokeWidth={0.5}>
        <rect x={MITTE - 5} y={SCHULTER_Y - 3} width={10} height={4} rx={2} />
        <path
          d={`M${MITTE - 2},${SCHULTER_Y + 1} L${MITTE + 2},${SCHULTER_Y + 1} L${MITTE + 1.5},${SCHULTER_Y + 9} L${MITTE - 1.5},${SCHULTER_Y + 9} Z`}
        />
      </g>
    );
  }
  if (art === 'krone') {
    return (
      <g fill="#facc15" stroke="#a16207" strokeWidth={1}>
        <path
          d={`M${MITTE - 10},${KOPF_Y - 4} L${MITTE - 6},${KOPF_Y - 15} L${MITTE - 1},${KOPF_Y - 8} L${MITTE},${KOPF_Y - 17} L${MITTE + 1},${KOPF_Y - 8} L${MITTE + 6},${KOPF_Y - 15} L${MITTE + 10},${KOPF_Y - 4} Z`}
        />
        <circle cx={MITTE - 6} cy={KOPF_Y - 15} r={1.6} fill="#f43f5e" stroke="none" />
        <circle cx={MITTE} cy={KOPF_Y - 17} r={1.6} fill="#22d3ee" stroke="none" />
        <circle cx={MITTE + 6} cy={KOPF_Y - 15} r={1.6} fill="#f43f5e" stroke="none" />
      </g>
    );
  }
  return null;
}

/**
 * Rumpf und Arme zusammen — sie hängen zu eng voneinander ab, um sie
 * getrennt zu zeichnen: Ob ein Arm ab dem Ärmelsaum in Hautfarbe erscheint
 * oder ganz in Oberteil-Farbe steckt, entscheidet einzig der Schnitt.
 *
 * - `kurzarm`: volle Schulterkappe bis zum Ärmelsaum (y 37), Haut darunter.
 * - `langarm`: Ärmel in Oberteil-Farbe bis zum Handgelenk, kleine Hand.
 * - `pulli`: wie `langarm`, dazu ein dickerer Rollkragen.
 *
 * Ein „Unterhemd" stand ebenfalls zur Wahl (schmale Träger statt der
 * Kappe, ein eigener Rumpf-Umriss dafür) — auf Ronnis Wunsch wieder raus.
 * Mit ihm ist auch der einzige Grund verschwunden, den Rumpf-Umriss
 * dynamisch zusammenzusetzen: Ein einziger, vollständig ausgeschriebener
 * Pfad reicht jetzt für alle drei verbliebenen Schnitte.
 */
const RUMPF_KAPPE_PFAD = `M15,${SCHULTER_Y + 4} a5,5 0 0 1 5,-5 h4 a9,9 0 0 1 16,0 h4 a5,5 0 0 1 5,5
          v8 a3,3 0 0 1 -3,3 h-1 v6 a8,8 0 0 1 -8,8 h-10 a8,8 0 0 1 -8,-8 v-6 h-1
          a3,3 0 0 1 -3,-3 Z`;

function RumpfUndArme({
  schnitt,
  oberteilUrl,
  hautUrl,
}: {
  schnitt: string;
  oberteilUrl: string;
  hautUrl: string;
}) {
  const langeAermel = schnitt === 'langarm' || schnitt === 'pulli';

  return (
    <g>
      {langeAermel ? (
        <>
          {/* Ärmel in Oberteil-Farbe bis zum Handgelenk, dahinter eine
              kleine Hand in Hautfarbe. */}
          <rect x={14} y={33} width={7} height={16} rx={3} fill={hautUrl} />
          <rect x={43} y={33} width={7} height={16} rx={3} fill={hautUrl} />
          <rect x={13.5} y={26} width={7.5} height={19} rx={3.2} fill={oberteilUrl} />
          <rect x={43} y={26} width={7.5} height={19} rx={3.2} fill={oberteilUrl} />
        </>
      ) : (
        // Arme in Hautfarbe, ab dem kurzen Ärmelsaum.
        <>
          <rect x={14.5} y={33} width={6} height={15} rx={2.8} fill={hautUrl} />
          <rect x={43.5} y={33} width={6} height={15} rx={2.8} fill={hautUrl} />
        </>
      )}

      <path d={RUMPF_KAPPE_PFAD} fill={oberteilUrl} />

      {schnitt === 'pulli' && (
        // Rollkragen: ein dickerer Ring am Hals, in Oberteil-Farbe.
        <rect x={MITTE - 4.5} y={SCHULTER_Y - 4} width={9} height={5} rx={2.5} fill={oberteilUrl} />
      )}
    </g>
  );
}

/**
 * Die Hose (oder der Rock) samt Beinen — Länge und Weite kommen aus
 * `hosenSchnitt`, unabhängig von der Farbe.
 */
function Hose({
  schnitt,
  hoseUrl,
  hautUrl,
}: {
  schnitt: string;
  hoseUrl: string;
  hautUrl: string;
}) {
  if (schnitt === 'rock') {
    return (
      <g>
        {/* Nackte Beine unterm Rock. */}
        <rect x={MITTE - 9} y={54} width={7} height={13} rx={3} fill={hautUrl} />
        <rect x={MITTE + 2} y={54} width={7} height={13} rx={3} fill={hautUrl} />
        {/* Der Rock selbst: ein Trapez, das sich nach unten weitet. */}
        <path
          d={`M${MITTE - 13},${46} h26 v2 L${MITTE + 15},${60} h-30 L${MITTE - 13},${48} Z`}
          fill={hoseUrl}
        />
      </g>
    );
  }

  const kurz = schnitt.startsWith('kurz');
  const weit = schnitt.endsWith('weit');
  const breite = weit ? 12.5 : 10;
  const beinEndeY = kurz ? 55 : 66;
  const luecke = 1.5;

  return (
    <g>
      {kurz && (
        <>
          {/* Nackte Unterschenkel unter der kurzen Hose. */}
          <rect x={MITTE - 8.5} y={55} width={6.5} height={12} rx={2.8} fill={hautUrl} />
          <rect x={MITTE + 2} y={55} width={6.5} height={12} rx={2.8} fill={hautUrl} />
        </>
      )}
      <rect
        x={MITTE - luecke - breite}
        y={46}
        width={breite}
        height={beinEndeY - 46}
        rx={weit ? 4.5 : 3.5}
        fill={hoseUrl}
      />
      <rect
        x={MITTE + luecke}
        y={46}
        width={breite}
        height={beinEndeY - 46}
        rx={weit ? 4.5 : 3.5}
        fill={hoseUrl}
      />
    </g>
  );
}

export function Avatar({ konfig, className }: { konfig: AvatarKonfig; className?: string }) {
  const haut = tonVon(HAUTTON, konfig.hautfarbe);
  const oberteil = tonVon(KLEIDUNGSTON, konfig.oberteil);
  const hose = tonVon(KLEIDUNGSTON, konfig.hose);
  const haar = HAARTON[konfig.haarfarbe] ?? HAARTON.braun!;
  const id = `avatar-${konfig.hautfarbe}-${konfig.oberteil}-${konfig.hose}`;
  const zeigeHaare = !konfig.accessoire.startsWith('cap-');

  return (
    <svg viewBox="0 -2 64 78" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-haut`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor={haut.hell} />
          <stop offset="100%" stopColor={haut.dunkel} />
        </radialGradient>
        <linearGradient id={`${id}-oberteil`} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={oberteil.hell} />
          <stop offset="100%" stopColor={oberteil.dunkel} />
        </linearGradient>
        <linearGradient id={`${id}-hose`} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={hose.hell} />
          <stop offset="100%" stopColor={hose.dunkel} />
        </linearGradient>
      </defs>

      {/* Schuhe — kein eigenes Teil (das wäre ein neunter), aber auch
          nicht mehr eine einzige feste Farbe: Rückmeldung: „verschiedene
          Schuhe". Sie übernehmen den dunklen Ton der gewählten Hose —
          zu Jeansblau werden sie dunkelblau, zu Gold bronzefarben, und
          bei Schwarz bleiben sie, was Schuhe meistens sind. */}
      <ellipse cx={MITTE - 7} cy={68} rx={5.5} ry={3} fill={hose.dunkel} />
      <ellipse cx={MITTE + 7} cy={68} rx={5.5} ry={3} fill={hose.dunkel} />

      <Hose schnitt={konfig.hosenSchnitt} hoseUrl={`url(#${id}-hose)`} hautUrl={`url(#${id}-haut)`} />

      <RumpfUndArme
        schnitt={konfig.oberteilSchnitt}
        oberteilUrl={`url(#${id}-oberteil)`}
        hautUrl={`url(#${id}-haut)`}
      />

      {/* Hals — hinter dem Kopf, sonst schwebt der Kopf sichtbar darüber. */}
      <rect x={MITTE - 3} y={20} width={6} height={6} fill={`url(#${id}-haut)`} />

      {konfig.accessoire === 'fliege' && <Accessoire art="fliege" />}
      {konfig.accessoire === 'schal' && <Accessoire art="schal" />}

      {zeigeHaare && <Frisur art={konfig.frisur} farbe={haar} />}

      {/* Kopf. */}
      <circle cx={MITTE} cy={KOPF_Y} r={KOPF_R} fill={`url(#${id}-haut)`} />
      <ellipse cx={MITTE - 3} cy={KOPF_Y - 4} rx={2.6} ry={1.6} fill="#ffffff" opacity={0.3} />

      <Gesicht />

      {konfig.accessoire === 'brille' && <Accessoire art="brille" />}
      {!zeigeHaare && <Accessoire art={konfig.accessoire} />}
      {konfig.accessoire === 'kopfhoerer' && <Accessoire art="kopfhoerer" />}
      {konfig.accessoire === 'krone' && <Accessoire art="krone" />}
    </svg>
  );
}
