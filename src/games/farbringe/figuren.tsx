import { FARBEN, farbe } from './farben';
import { BAND_PERIODE, FARB_ANZAHL, KUGEL_R, RING_STRICH, bandSegmente, etappeVon, mitteBreite } from './logik';
import type { Ring, Wechsler } from './logik';

/**
 * Die Zeichenteile von Ring Rise.
 *
 * Alles hier arbeitet in **Welt-Koordinaten mit y nach oben**, genau wie die
 * Logik. Das Umdrehen auf die Bildschirmrichtung passiert an einer einzigen
 * Stelle: der Kamera-Gruppe in `RingRise.tsx`. So muss keine einzige Figur
 * wissen, dass y auf dem Bildschirm nach unten wächst.
 */

/** Ein Viertelbogen als SVG-Pfad um (0,0), von Winkel `a` bis `b` (Bogenmaß). */
function bogenPfad(halbmesser: number, a: number, b: number): string {
  // y wird negiert: Welt zeigt nach oben, SVG nach unten.
  const x1 = Math.cos(a) * halbmesser;
  const y1 = -Math.sin(a) * halbmesser;
  const x2 = Math.cos(b) * halbmesser;
  const y2 = -Math.sin(b) * halbmesser;
  // Ein Viertelkreis ist nie der große Bogen; im SVG dreht die Y-Spiegelung
  // den Umlaufsinn um, deshalb sweep = 0.
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${halbmesser} ${halbmesser} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Eine kleine Raute um (x, y) — die Mitte eines Farbbogens. */
function Raute({ x, y, r = 2.4 }: { x: number; y: number; r?: number }) {
  return (
    <polygon
      points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
      fill="#ffffff"
      stroke="#0b1020"
      strokeWidth={0.6}
      strokeLinejoin="round"
      opacity={0.92}
    />
  );
}

/**
 * Die Tormarke: zwei kleine Striche unter dem Tor, genau so weit auseinander,
 * wie die Mitte des Bogens in dieser Etappe reicht.
 *
 * Ohne sie muss man erraten, welche Stelle des Rings eigentlich zählt — und
 * ein Spiel, dessen Regel man raten muss, fühlt sich unfair an, auch wenn es
 * das gar nicht ist. Die Striche wandern mit der Etappe zusammen, weil die
 * Mitte schmaler wird: Die Regel steht im Bild, nicht nur in der Logik.
 * Steht eine Raute zwischen ihnen, zählt der Durchflug als „mitten".
 */
function Tormarke({ halbBreite, y }: { halbBreite: number; y: number }) {
  return (
    <g stroke="#ffffff" strokeWidth={1.3} strokeLinecap="round" opacity={0.6}>
      <line x1={-halbBreite} y1={y - 2.6} x2={-halbBreite} y2={y + 2.6} />
      <line x1={halbBreite} y1={y - 2.6} x2={halbBreite} y2={y + 2.6} />
    </g>
  );
}

/**
 * Ein Ring aus vier Farbbögen.
 *
 * Gezeichnet wird um den Nullpunkt; die Gruppe außen setzt ihn an seinen
 * Platz. Der Bogen 0 beginnt beim Ringwinkel und läuft **gegen** den
 * Uhrzeigersinn — dieselbe Zählrichtung wie `farbeAnStelle` in der Logik,
 * sonst zeigt die Anzeige etwas anderes an, als die Prüfung rechnet.
 *
 * Der Pulsring ist derselbe Ring, nur mit einem zweiten, dünnen Gestrichelten
 * außen herum — er soll auf den ersten Blick als „der, der stockt und
 * schwingt" erkennbar sein, nicht erst, wenn man ihn beim Drehen beobachtet.
 */
export function Farbring({ ring }: { ring: Ring }) {
  const bogen = (2 * Math.PI) / FARB_ANZAHL;
  const mitte = mitteBreite(etappeVon(ring.nr));
  return (
    <g>
      {/* Dunkler Grundring darunter gibt dem Ganzen Tiefe und macht die
          gepunkteten Bögen auf hellem Grund überhaupt erst lesbar. */}
      <circle
        r={ring.halbmesser}
        fill="none"
        stroke="#0b1020"
        strokeOpacity={0.55}
        strokeWidth={RING_STRICH + 3}
      />
      {ring.art === 'puls' && (
        <circle
          r={ring.halbmesser + 6.5}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1}
          strokeDasharray="2.5 3.5"
          opacity={0.45}
        />
      )}
      {FARBEN.map((f, i) => (
        <path
          key={f.id}
          d={bogenPfad(ring.halbmesser, ring.winkel + i * bogen, ring.winkel + (i + 1) * bogen)}
          fill="none"
          stroke={f.hex}
          strokeWidth={RING_STRICH}
          strokeLinecap="butt"
          strokeDasharray={f.muster}
        />
      ))}

      {/* Die Mitte jedes Bogens: Wer die Raute zwischen den Strichen unten
          durchlässt, fliegt „mitten" durch. */}
      {FARBEN.map((f, i) => {
        const a = ring.winkel + (i + 0.5) * bogen;
        return <Raute key={f.id} x={Math.cos(a) * ring.halbmesser} y={-Math.sin(a) * ring.halbmesser} />;
      })}

      <Tormarke halbBreite={mitte * ring.halbmesser} y={ring.halbmesser + 10} />
    </g>
  );
}

/**
 * Ein Laufband: vier Farben in Segmenten, die seitlich durchs Bild laufen,
 * die Kugel kommt bei x = 0 hindurch.
 *
 * Die Segmente liegen im Bild über die ganze Breite, damit man die kommende
 * Farbe schon sieht, bevor sie am Tor ist — wie beim Ring die Bögen, die
 * von der Seite heranlaufen.
 */
export function Farbband({ ring }: { ring: Ring }) {
  const h = ring.halbmesser;
  const mitte = mitteBreite(etappeVon(ring.nr));
  // Eine Bogenmaß-Einheit entspricht so vielen Welteinheiten Weg.
  const proRad = BAND_PERIODE / (2 * Math.PI);
  return (
    <g>
      <rect x={-60} y={-h - 1.5} width={120} height={2 * h + 3} fill="#0b1020" opacity={0.55} />
      {bandSegmente(ring).map((seg) => {
        const f = FARBEN[seg.farbe]!;
        // Außerhalb des Bildes gar nicht erst zeichnen.
        if (seg.x > 56 || seg.x + seg.breite < -56) return null;
        return (
          <g key={`${seg.farbe}-${seg.x.toFixed(2)}`}>
            <line
              x1={seg.x}
              y1={0}
              x2={seg.x + seg.breite}
              y2={0}
              stroke={f.hex}
              strokeWidth={2 * h}
              strokeDasharray={f.bandMuster}
              strokeDashoffset={f.bandVersatz}
            />
            <Raute x={seg.x + seg.breite / 2} y={0} r={2} />
          </g>
        );
      })}
      {/* Zarte Kanten oben und unten, damit das Band als Band steht und nicht als Farbfleck. */}
      <line x1={-60} y1={-h} x2={60} y2={-h} stroke="#ffffff" strokeWidth={0.6} opacity={0.5} />
      <line x1={-60} y1={h} x2={60} y2={h} stroke="#0b1020" strokeWidth={0.8} opacity={0.7} />
      <Tormarke halbBreite={mitte * proRad} y={h + 5.5} />
    </g>
  );
}

/** Zeichnet das Hindernis, das zu seiner Art passt. */
export function Hindernis({ ring }: { ring: Ring }) {
  return ring.art === 'band' ? <Farbband ring={ring} /> : <Farbring ring={ring} />;
}

/**
 * Die Kugel.
 *
 * Der Ring um sie herum trägt **dasselbe Strichmuster** wie die passenden
 * Bögen — daran erkennt man auch ohne Farbunterscheidung, wo man durchdarf.
 */
export function Kugel({ farbIndex }: { farbIndex: number }) {
  const f = farbe(farbIndex);
  return (
    <g>
      <circle r={KUGEL_R} fill={f.hex} />
      {/* Lichtpunkt oben links — dieselbe Lichtrichtung wie überall sonst. */}
      <circle cx={-KUGEL_R * 0.32} cy={-KUGEL_R * 0.34} r={KUGEL_R * 0.3} fill="#ffffff" opacity={0.65} />
      <circle
        r={KUGEL_R + 2.6}
        fill="none"
        stroke={f.hex}
        strokeWidth={1.8}
        strokeDasharray={f.muster}
        opacity={0.95}
      />
    </g>
  );
}

/** Der Farbwechsler: ein kleiner Stern in Viertelfarben. */
export function Farbwechsel({ wechsler }: { wechsler: Wechsler }) {
  if (wechsler.genommen) return null;
  const bogen = (2 * Math.PI) / FARB_ANZAHL;
  return (
    <g>
      <circle r={5.6} fill="#0b1020" opacity={0.5} />
      {FARBEN.map((f, i) => (
        <path
          key={f.id}
          // Vier Tortenstücke: Mittelpunkt, Kante, Bogen, zurück.
          d={
            `M 0 0 L ${(Math.cos(i * bogen) * 4.6).toFixed(2)} ${(-Math.sin(i * bogen) * 4.6).toFixed(2)} ` +
            `A 4.6 4.6 0 0 0 ${(Math.cos((i + 1) * bogen) * 4.6).toFixed(2)} ${(-Math.sin((i + 1) * bogen) * 4.6).toFixed(2)} Z`
          }
          fill={f.hex}
        />
      ))}
      <circle r={1.6} fill="#ffffff" opacity={0.9} />
    </g>
  );
}
