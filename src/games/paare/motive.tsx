/**
 * Die fünfzehn Kartenmotive.
 *
 * Jedes hat eine **eigene Form und** eine eigene Farbe. Das ist keine
 * Spielerei: Farbe darf nie das einzige Unterscheidungsmerkmal sein, sonst
 * ist das Spiel für farbfehlsichtige Spieler unlösbar — und bei einem
 * Spiel, das ausschließlich aus „sind diese beiden gleich?" besteht, wäre
 * genau das der Fall. Zusätzlich trägt jede aufgedeckte Karte den Namen
 * ihres Motivs im `aria-label`.
 *
 * Gezeichnet im Koordinatensystem 0…100, ohne eigenes `<svg>` — dieselbe
 * Machart wie beim Sternenschlucker, damit die Motive auch im App-Symbol
 * verkleinert benutzt werden können.
 */

export type Motiv = {
  name: string;
  farbe: string;
  /** Der Pfad im Bereich 0…100. Wird gefüllt, nicht gestrichelt. */
  pfad: string;
};

export const MOTIVE: readonly Motiv[] = [
  { name: 'Stern', farbe: '#facc15', pfad: 'M50 8 L62 38 L94 40 L69 61 L77 92 L50 74 L23 92 L31 61 L6 40 L38 38 Z' },
  { name: 'Herz', farbe: '#f43f5e', pfad: 'M50 88 C10 60 8 34 26 22 C38 14 50 22 50 34 C50 22 62 14 74 22 C92 34 90 60 50 88 Z' },
  { name: 'Mond', farbe: '#a5b4fc', pfad: 'M66 12 A40 40 0 1 0 66 88 A32 32 0 1 1 66 12 Z' },
  { name: 'Blitz', farbe: '#fb923c', pfad: 'M58 6 L22 56 L44 56 L38 94 L78 42 L54 42 Z' },
  { name: 'Tropfen', farbe: '#38bdf8', pfad: 'M50 6 C50 6 80 42 80 62 A30 30 0 0 1 20 62 C20 42 50 6 50 6 Z' },
  { name: 'Blatt', farbe: '#4ade80', pfad: 'M84 16 C84 62 56 90 16 88 C14 44 42 16 84 16 Z M22 84 L70 32' },
  { name: 'Wolke', farbe: '#e2e8f0', pfad: 'M28 74 A20 20 0 0 1 30 34 A24 24 0 0 1 74 40 A18 18 0 0 1 74 74 Z' },
  { name: 'Kreis', farbe: '#c084fc', pfad: 'M50 10 A40 40 0 1 1 49.9 10 Z M50 32 A18 18 0 1 0 50.1 32 Z' },
  { name: 'Dreieck', farbe: '#2dd4bf', pfad: 'M50 10 L92 84 L8 84 Z' },
  { name: 'Raute', farbe: '#ec4899', pfad: 'M50 6 L90 50 L50 94 L10 50 Z' },
  { name: 'Krone', farbe: '#eab308', pfad: 'M12 74 L20 26 L38 48 L50 20 L62 48 L80 26 L88 74 Z' },
  { name: 'Rakete', farbe: '#f87171', pfad: 'M50 6 C68 24 74 46 74 64 L60 76 L40 76 L26 64 C26 46 32 24 50 6 Z M26 62 L10 88 L34 80 Z M74 62 L90 88 L66 80 Z' },
  { name: 'Anker', farbe: '#60a5fa', pfad: 'M44 22 A6 6 0 1 1 56 22 A6 6 0 1 1 44 22 Z M45 30 h10 v56 h-10 Z M22 44 h56 v9 h-56 Z M14 60 C14 84 32 94 50 94 C68 94 86 84 86 60 h-11 C75 78 62 84 50 84 C38 84 25 78 25 60 Z' },
  { name: 'Schlüssel', farbe: '#94a3b8', pfad: 'M34 10 A24 24 0 1 1 34 58 A24 24 0 1 1 34 10 Z M34 22 A12 12 0 1 0 34 46 A12 12 0 1 0 34 22 Z M52 28 h40 v10 h-10 v12 h-10 v-12 h-8 v16 h-10 Z' },
  { name: 'Würfel', farbe: '#fb7185', pfad: 'M14 14 h72 v72 h-72 Z M30 30 A7 7 0 1 0 30.1 30 Z M70 30 A7 7 0 1 0 70.1 30 Z M50 50 A7 7 0 1 0 50.1 50 Z M30 70 A7 7 0 1 0 30.1 70 Z M70 70 A7 7 0 1 0 70.1 70 Z' },
];

/**
 * Ein Motiv als Bild.
 *
 * `fillRule="evenodd"` ist wichtig: Kreis, Schlüssel und Würfel bestehen
 * aus einer Außenform mit Löchern darin. Ohne die Regel füllt der Browser
 * die Löcher mit, und aus dem Ring wird eine Scheibe.
 */
export function MotivBild({ motiv, groesse }: { motiv: Motiv; groesse: number | string }) {
  return (
    <svg viewBox="0 0 100 100" width={groesse} height={groesse} aria-hidden="true">
      <path
        d={motiv.pfad}
        fill={motiv.farbe}
        fillRule="evenodd"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="3"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}
