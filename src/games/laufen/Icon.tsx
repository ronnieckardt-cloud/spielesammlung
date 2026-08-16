import { AppSymbol } from '../../core/AppSymbol';

/**
 * Ein Haus mit beleuchteten Fenstern.
 *
 * **Die Fenster sind nicht Zierrat, sie tragen das Bild.** Der graue Block
 * allein hob sich vom violetten Grund kaum ab (gemessen rund 1,2:1 — man sah
 * den Umriss praktisch nicht). Ein heller Beton bringt das auf etwa das
 * Dreifache, und die gelben Fensterpunkte liegen mit rund 6:1 so weit
 * darüber, dass die Silhouette selbst dann noch lesbar bleibt, wenn das
 * Symbol auf Kachelgröße schrumpft.
 */
function Haus({ x, y, b, h }: { x: number; y: number; b: number; h: number }) {
  // Reihen und Spalten aus der Hausgröße, damit jedes Haus sein eigenes,
  // zur Fläche passendes Fensterraster bekommt.
  const spalten = Math.max(2, Math.floor(b / 3.2));
  const reihen = Math.max(2, Math.floor(h / 4.6));
  return (
    <>
      <rect x={x} y={y} width={b} height={h} rx={1} fill="#7c8aa0" />
      {Array.from({ length: reihen }, (_, r) =>
        Array.from({ length: spalten }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={x + 1 + (c * (b - 1.4)) / spalten}
            y={y + 1.6 + (r * (h - 2.4)) / reihen}
            width={(b - 1.4) / spalten - 0.9}
            height={1.9}
            fill="#fbbf24"
            // Ein paar dunkle Fenster — alle gleich hell sähe nach Raster
            // aus, nicht nach Haus.
            opacity={(r + c + x) % 4 === 0 ? 0.22 : 0.85}
          />
        )),
      )}
    </>
  );
}

/**
 * App-Symbol: die Straße läuft in die Tiefe, die Figur rennt darauf zu.
 * Der Fluchtpunkt ist hier das Wichtigste — er sagt sofort „3-D".
 * Aufbau siehe `core/AppSymbol.tsx`.
 */
export function LaufenIcon({ className }: { className?: string }) {
  return (
    <AppSymbol
      id="dashcity"
            /*
       * **Magenta statt Indigo/Navy.** War eines von sieben Symbolen im
       * selben Farbfeld — dabei passt ein Neon-Ton besser zu einem
       * nächtlichen 3-D-Läufer als noch mehr gedecktes Blau.
       */
      verlauf={['#ea3eca', '#ac1591', '#371030']}
      schriftzug="DASH CITY"
      className={className}
    >
      {/* Häuser links und rechts, nach hinten kleiner werdend. */}
      {[
        { x: 2, y: 8, b: 9, h: 26 },
        { x: 11, y: 14, b: 7, h: 20 },
        { x: 46, y: 6, b: 10, h: 28 },
        { x: 39, y: 13, b: 7, h: 21 },
      ].map((h) => (
        <Haus key={`${h.x}`} {...h} />
      ))}

      {/* Die Straße als Trapez — das ist die Zentralprojektion in einem Bild.
          Helleres Asphaltgrau als früher: Das alte #2f3542 lag mit 1,4:1 auf
          dem fast schwarzen Grund, die Fahrbahn war damit kaum vom Himmel zu
          unterscheiden und nur die gelben Striche trugen das Bild. */}
      <path d="M20,20 L44,20 L58,42 L6,42 Z" fill="#515f70" />
      {/* Zwei Spurtrennlinien, die auf den Fluchtpunkt zulaufen. */}
      <path d="M28,20 L22,42" stroke="#f7d774" strokeWidth={1.6} strokeDasharray="3 3" />
      <path d="M36,20 L42,42" stroke="#f7d774" strokeWidth={1.6} strokeDasharray="3 3" />

      {/*
        Das Hindernis steht auf der **linken** Spur, nicht in der Fluchtlinie
        der Figur. Vorher lag es bei x 29…36 — also vollständig hinter dem
        Kopf (Mittelpunkt 32/25, Radius 3) und der roten Mütze darüber. Zu
        sehen blieb ein Streifen von knapp zwei Einheiten rechts neben dem
        Kopf, und der las sich als Ohr. Ausgerechnet das einzige Element, das
        den Läufer als Ausweichspiel kennzeichnet, war damit unsichtbar.
        Die Beine machen aus dem Balken eine Hürde: Form sagt hier wie im
        Spiel, was zu tun ist.
      */}
      <rect x={18.6} y={24.6} width={7.4} height={2.6} rx={0.7} fill="#f97316" />
      <rect x={19.4} y={27.2} width={1.4} height={2.3} fill="#c2410c" />
      <rect x={23.8} y={27.2} width={1.4} height={2.3} fill="#c2410c" />

      {/* Die Figur, vorn und groß — von hinten, wie im Spiel. */}
      <g transform="translate(32 30)">
        <ellipse cx={0} cy={11} rx={4} ry={1.2} fill="#000000" opacity={0.35} />
        <rect x={-3} y={-2} width={6} height={9} rx={3} fill="#38bdf8" />
        <circle cx={0} cy={-5} r={3} fill="#fcd5b0" />
        <path d="M-3,-6 a3,3 0 0 1 6,0 Z" fill="#f43f5e" />
        <rect x={-3.4} y={6} width={2.6} height={5} rx={1.2} fill="#1e40af" />
        <rect x={0.8} y={6} width={2.6} height={5} rx={1.2} fill="#1e40af" />
      </g>
    </AppSymbol>
  );
}
