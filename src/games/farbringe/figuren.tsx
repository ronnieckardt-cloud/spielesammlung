import { FARBEN, farbe } from './farben';
import { KUGEL_R, RING_STRICH, FARB_ANZAHL } from './logik';
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

/**
 * Ein Ring aus vier Farbbögen.
 *
 * Gezeichnet wird um den Nullpunkt; die Gruppe außen setzt ihn an seinen
 * Platz. Der Bogen 0 beginnt beim Ringwinkel und läuft **gegen** den
 * Uhrzeigersinn — dieselbe Zählrichtung wie `farbeAnStelle` in der Logik,
 * sonst zeigt die Anzeige etwas anderes an, als die Prüfung rechnet.
 */
export function Farbring({ ring }: { ring: Ring }) {
  const bogen = (2 * Math.PI) / FARB_ANZAHL;
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

      {/* Die Tormarke: zwei kleine Striche genau unten, wo die Kugel
          durchkommt. Ohne sie muss man erraten, welche Stelle des Rings
          eigentlich zählt — und ein Spiel, dessen Regel man raten muss,
          fühlt sich unfair an, auch wenn es das gar nicht ist. */}
      <g stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" opacity={0.5}>
        <line
          x1={-8}
          y1={ring.halbmesser + 6}
          x2={-3.5}
          y2={ring.halbmesser + 6}
        />
        <line x1={3.5} y1={ring.halbmesser + 6} x2={8} y2={ring.halbmesser + 6} />
      </g>
    </g>
  );
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
