import type { CSSProperties } from 'react';
import { ROEHRCHEN_BREITE } from './geometrie';

/**
 * Konfetti, das seitlich aus einem fertig sortierten Röhrchen stiebt.
 *
 * Ablauf: Das Röhrchen läuft voll, dann fällt der Deckel drauf, **dann**
 * kommt das Konfetti — deshalb die Grundverzögerung. Vorher feuerte es
 * gleichzeitig mit dem Gießen, also bevor überhaupt zu sehen war, dass
 * das Röhrchen fertig ist.
 *
 * Die Flugrichtungen stehen als feste Liste, kein Zufall: `Math.random`
 * ist im Projekt durchgehend unerwünscht, und von Hand gewählte Winkel
 * streuen gleichmäßiger als gewürfelte.
 */

/** Wartezeit, bis der Deckel sitzt (siehe `.deckel-drauf` in index.css). */
const NACH_DECKEL_MS = 300;

/** Je Stück: Seite (−1 links, +1 rechts), Starthöhe, Flug, Farbe, Maße. */
const STUECKE: readonly {
  seite: number;
  y: number;
  kx: number;
  ky: number;
  farbe: string;
  verzoegerung: number;
  breite: number;
  hoehe: number;
}[] = [
  { seite: -1, y: 2, kx: -52, ky: -34, farbe: '#facc15', verzoegerung: 0, breite: 8, hoehe: 11 },
  { seite: -1, y: 10, kx: -60, ky: -14, farbe: '#f472b6', verzoegerung: 45, breite: 10, hoehe: 7 },
  { seite: -1, y: 20, kx: -54, ky: 8, farbe: '#2dd4bf', verzoegerung: 20, breite: 7, hoehe: 10 },
  { seite: -1, y: 6, kx: -38, ky: -52, farbe: '#fb923c', verzoegerung: 70, breite: 9, hoehe: 8 },
  { seite: -1, y: 30, kx: -46, ky: 26, farbe: '#a855f7', verzoegerung: 95, breite: 8, hoehe: 8 },
  { seite: -1, y: 16, kx: -70, ky: -2, farbe: '#4ade80', verzoegerung: 130, breite: 7, hoehe: 9 },
  { seite: -1, y: 0, kx: -26, ky: -62, farbe: '#38bdf8', verzoegerung: 55, breite: 8, hoehe: 7 },

  { seite: 1, y: 2, kx: 52, ky: -36, farbe: '#38bdf8', verzoegerung: 15, breite: 8, hoehe: 11 },
  { seite: 1, y: 12, kx: 62, ky: -12, farbe: '#facc15', verzoegerung: 60, breite: 10, hoehe: 7 },
  { seite: 1, y: 22, kx: 50, ky: 10, farbe: '#f472b6', verzoegerung: 30, breite: 7, hoehe: 10 },
  { seite: 1, y: 5, kx: 36, ky: -54, farbe: '#4ade80', verzoegerung: 85, breite: 9, hoehe: 8 },
  { seite: 1, y: 30, kx: 44, ky: 28, farbe: '#fb923c', verzoegerung: 110, breite: 8, hoehe: 8 },
  { seite: 1, y: 17, kx: 72, ky: 0, farbe: '#a855f7', verzoegerung: 140, breite: 7, hoehe: 9 },
  { seite: 1, y: 0, kx: 24, ky: -64, farbe: '#2dd4bf', verzoegerung: 40, breite: 8, hoehe: 7 },
];

export function Konfetti({ ruhig }: { ruhig: boolean }) {
  // Bei „weniger Bewegung" gar nicht erst zeichnen: `.ruhig` würde die
  // Animation auf 0,01 ms stauchen, das gäbe nur ein Zuckbild.
  if (ruhig) return null;

  return (
    <g aria-hidden="true">
      {STUECKE.map((s, i) => (
        <rect
          key={i}
          className="konfetti"
          // Startet knapp neben der Glaswand, nicht in ihr.
          x={s.seite < 0 ? -s.breite - 1 : ROEHRCHEN_BREITE + 1}
          y={s.y}
          width={s.breite}
          height={s.hoehe}
          rx={2}
          fill={s.farbe}
          style={
            {
              '--kx': `${s.kx}px`,
              '--ky': `${s.ky}px`,
              animationDelay: `${NACH_DECKEL_MS + s.verzoegerung}ms`,
            } as CSSProperties
          }
        />
      ))}
    </g>
  );
}
