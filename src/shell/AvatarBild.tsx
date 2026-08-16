import type { AvatarKonfig } from './avatar';

/**
 * Die Avatar-Figur als SVG.
 *
 * Ein einzelner runder Körper (0 0 64 64), darauf Augen und ein optionales
 * Extra — keine Fotos, kein Hochladen, verlustfrei von der kleinen
 * Bestenlisten-Zeile bis zur großen Anzeige auf der Kontoseite. Derselbe
 * Aufbau wie die App-Symbole in `core/AppSymbol.tsx`: Licht oben links,
 * Schatten unten rechts, ein einzelner harter Glanzpunkt — dieselbe Regel
 * wie beim Sternenschlucker in `platzhalter/Figur.tsx`, „ein Verlauf statt
 * zwei aufeinandergelegter Flächen", damit keine Kante quer über den
 * Körper läuft.
 */

const FARBTON: Record<string, { hell: string; dunkel: string }> = {
  blau: { hell: '#7dd3fc', dunkel: '#0369a1' },
  gruen: { hell: '#86efac', dunkel: '#15803d' },
  orange: { hell: '#fdba74', dunkel: '#c2410c' },
  pink: { hell: '#f9a8d4', dunkel: '#be185d' },
  violett: { hell: '#c4b5fd', dunkel: '#6d28d9' },
  gold: { hell: '#fde68a', dunkel: '#b45309' },
};

/** Fällt niemals auf ein unbekanntes Feld, ohne etwas zu zeichnen. */
function farbtonVon(id: string) {
  return FARBTON[id] ?? FARBTON.blau!;
}

const MITTE = 32;

/**
 * Die Kontur des Körpers, je Form ein eigener Pfad — alle im selben
 * 64×64-Raster, damit Augen und Extra bei jeder Form an derselben Stelle
 * sitzen und nicht für jede Form neu einjustiert werden müssen.
 */
function koerperPfad(form: string): string {
  switch (form) {
    case 'eckig':
      // Abgerundetes Quadrat statt scharfer Ecken — bleibt freundlich.
      return 'M14,10 h36 a4,4 0 0 1 4,4 v36 a4,4 0 0 1 -4,4 h-36 a4,4 0 0 1 -4,-4 v-36 a4,4 0 0 1 4,-4 Z';
    case 'spitz':
      // Ein Kreis mit einer Zacke oben — ein einzelnes Dreieck reicht als
      // Silhouette, mehr würde bei 40 Pixeln Anzeigegröße verschmieren.
      return 'M32,4 L40,16 A20,20 0 1 1 24,16 Z';
    case 'wellig':
      // Sechs sanfte Ausbuchtungen statt eines glatten Kreises — eine
      // echte Wolke aus Kreisbögen, keine Zufallsform: Der Radius
      // schwingt gleichmäßig zwischen 19 und 22, sechsmal im Kreis, sonst
      // sieht „wellig" auf einer kleinen Kachel wie ein Zeichenfehler aus.
      return waelligerPfad();
    case 'stern':
      // Fünfzackiger Stern, Radius 22 außen / 10 innen — dieselbe Formel
      // wie der Erfolgs- und Podest-Stern anderswo im Projekt, hier nur
      // als Körper statt als Abzeichen.
      return sternPfad(MITTE, MITTE, 22, 10, 5);
    default:
      return `M${MITTE},${MITTE - 22} a22,22 0 1 1 0,44 a22,22 0 1 1 0,-44 Z`;
  }
}

function waelligerPfad(): string {
  const zacken = 6;
  const rMin = 19;
  const rMax = 22;
  const punkte: string[] = [];
  for (let i = 0; i <= zacken * 2; i++) {
    const winkel = (Math.PI * i) / zacken - Math.PI / 2;
    const radius = i % 2 === 0 ? rMax : rMin;
    const x = MITTE + Math.cos(winkel) * radius;
    const y = MITTE + Math.sin(winkel) * radius;
    punkte.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return punkte.join(' ') + ' Z';
}

function sternPfad(cx: number, cy: number, rAussen: number, rInnen: number, zacken: number): string {
  const punkte: string[] = [];
  for (let i = 0; i < zacken * 2; i++) {
    const winkel = (Math.PI * i) / zacken - Math.PI / 2;
    const radius = i % 2 === 0 ? rAussen : rInnen;
    const x = cx + Math.cos(winkel) * radius;
    const y = cy + Math.sin(winkel) * radius;
    punkte.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return punkte.join(' ') + ' Z';
}

/** Ein Auge bei (x, y) — die Form entscheidet, was dort steht. */
function Augen({ art }: { art: string }) {
  const x1 = MITTE - 8;
  const x2 = MITTE + 8;
  const y = MITTE - 2;

  if (art === 'schlaefrig') {
    // Zwei ruhige Bögen statt Kreisen — kein Weiß, kein Glanzpunkt, die
    // Figur wirkt entspannt statt wach.
    return (
      <g stroke="#1e293b" strokeWidth={3} strokeLinecap="round" fill="none">
        <path d={`M${x1 - 4},${y} q4,4 8,0`} />
        <path d={`M${x2 - 4},${y} q4,4 8,0`} />
      </g>
    );
  }
  if (art === 'stern') {
    return (
      <g fill="#1e293b">
        <path d={sternPfad(x1, y, 4.5, 2, 4)} />
        <path d={sternPfad(x2, y, 4.5, 2, 4)} />
      </g>
    );
  }
  if (art === 'herz') {
    const herz = (cx: number, cy: number) =>
      `M${cx},${cy + 3.2} C${cx - 6},${cy - 2} ${cx - 3},${cy - 6} ${cx},${cy - 2.4} ` +
      `C${cx + 3},${cy - 6} ${cx + 6},${cy - 2} ${cx},${cy + 3.2} Z`;
    return (
      <g fill="#f43f5e">
        <path d={herz(x1, y)} />
        <path d={herz(x2, y)} />
      </g>
    );
  }
  if (art === 'zwinker') {
    // Ein Auge offen (Kreis mit Glanzpunkt), das andere zwinkert (Bogen) —
    // Asymmetrie ist hier Absicht, nicht Ungenauigkeit.
    return (
      <g>
        <circle cx={x1} cy={y} r={4.5} fill="#1e293b" />
        <circle cx={x1 - 1.3} cy={y - 1.3} r={1.3} fill="#ffffff" opacity={0.85} />
        <path
          d={`M${x2 - 4.5},${y} q4.5,4 9,0`}
          stroke="#1e293b"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  // 'rund' — der Standard: schlichter Kreis mit Glanzpunkt.
  return (
    <g fill="#1e293b">
      <circle cx={x1} cy={y} r={4.5} />
      <circle cx={x2} cy={y} r={4.5} />
      <circle cx={x1 - 1.3} cy={y - 1.3} r={1.3} fill="#ffffff" opacity={0.85} />
      <circle cx={x2 - 1.3} cy={y - 1.3} r={1.3} fill="#ffffff" opacity={0.85} />
    </g>
  );
}

/** Das Extra, oberhalb der Augen. `null` bei „keins" — dann fehlt einfach nichts. */
function Accessoire({ art }: { art: string }) {
  if (art === 'brille') {
    return (
      <g stroke="#1e293b" strokeWidth={2} fill="none">
        <circle cx={MITTE - 8} cy={MITTE - 2} r={7} />
        <circle cx={MITTE + 8} cy={MITTE - 2} r={7} />
        <path d="M31,32 h2" strokeLinecap="round" />
      </g>
    );
  }
  if (art === 'schleife') {
    return (
      <g fill="#f43f5e" stroke="#9f1239" strokeWidth={1}>
        <path d={`M${MITTE - 1},7 L${MITTE - 11},2 a3,3 0 0 0 -2,5.5 L${MITTE - 1},9 Z`} />
        <path d={`M${MITTE + 1},7 L${MITTE + 11},2 a3,3 0 0 1 2,5.5 L${MITTE + 1},9 Z`} />
        <circle cx={MITTE} cy={7} r={2.6} stroke="none" />
      </g>
    );
  }
  if (art === 'hut') {
    return (
      <g>
        <path d="M12,10 h40 v3 h-40 Z" fill="#78350f" />
        <path d="M20,10 L24,-4 h16 L44,10 Z" fill="#92400e" />
      </g>
    );
  }
  if (art === 'krone') {
    return (
      <g fill="#facc15" stroke="#a16207" strokeWidth={1}>
        <path d="M16,10 L20,-2 L27,6 L32,-6 L37,6 L44,-2 L48,10 Z" />
        <circle cx={20} cy={-2} r={2} fill="#f43f5e" stroke="none" />
        <circle cx={32} cy={-6} r={2} fill="#22d3ee" stroke="none" />
        <circle cx={44} cy={-2} r={2} fill="#f43f5e" stroke="none" />
      </g>
    );
  }
  return null;
}

export function Avatar({
  konfig,
  className,
}: {
  konfig: AvatarKonfig;
  className?: string;
}) {
  const farbe = farbtonVon(konfig.koerperfarbe);
  const id = `avatar-${konfig.koerperfarbe}-${konfig.form}`;

  return (
    <svg viewBox="-6 -8 76 72" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="34%" cy="30%" r="75%">
          <stop offset="0%" stopColor={farbe.hell} />
          <stop offset="100%" stopColor={farbe.dunkel} />
        </radialGradient>
      </defs>
      <path d={koerperPfad(konfig.form)} fill={`url(#${id})`} stroke={farbe.dunkel} strokeWidth={1.5} />
      {/* Der Glanzpunkt — derselbe Griff wie beim Sternenschlucker: ein
          einzelner harter Punkt macht mehr Wölbung als jeder Verlauf allein. */}
      <ellipse cx={24} cy={18} rx={5} ry={3.2} fill="#ffffff" opacity={0.35} />
      <Augen art={konfig.augen} />
      <Accessoire art={konfig.accessoire} />
    </svg>
  );
}
