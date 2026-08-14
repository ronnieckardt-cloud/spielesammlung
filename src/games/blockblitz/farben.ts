/** Rein kosmetisch — anders als beim Farbsortierer spielt die Farbe hier keine Rolle fürs Lösen. */
export const FARBEN: readonly string[] = [
  '#38bdf8', // hellblau
  '#f97316', // orange
  '#a3e635', // limette
  '#f472b6', // pink
  '#facc15', // gelb
  '#c084fc', // lila
];

export function blockFarbe(index: number): string {
  return FARBEN[index % FARBEN.length]!;
}
