/**
 * Kugelfarben. Bewusst gut unterscheidbare Töne, nicht nur helle Pastelle —
 * bei fünf Farben nebeneinander muss man sie auf einen Blick auseinander
 * halten können.
 */
const FARBEN: readonly { hex: string; name: string }[] = [
  { hex: '#f43f5e', name: 'Rot' },
  { hex: '#38bdf8', name: 'Blau' },
  { hex: '#4ade80', name: 'Grün' },
  { hex: '#facc15', name: 'Gelb' },
  { hex: '#c084fc', name: 'Violett' },
];

export function kugelFarbe(index: number): string {
  return FARBEN[index % FARBEN.length]!.hex;
}

/** Farbname fürs `aria-label` — Farbe ist nie das einzige Merkmal. */
export function kugelName(index: number): string {
  return FARBEN[index % FARBEN.length]!.name;
}
