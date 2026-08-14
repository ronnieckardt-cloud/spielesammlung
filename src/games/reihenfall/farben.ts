import type { TeilTyp } from './logik';

/**
 * Bewusst anders zugeordnet als beim Original — keine originalen
 * Steinfarben. Jede Zuordnung (Form → Farbe) weicht von der klassischen ab.
 */
export const FARBEN: readonly string[] = [
  '#ec4899', // I — Pink (klassisch: Cyan)
  '#14b8a6', // O — Türkis (klassisch: Gelb)
  '#f59e0b', // T — Bernstein (klassisch: Lila)
  '#6366f1', // S — Indigo (klassisch: Grün)
  '#84cc16', // Z — Limette (klassisch: Rot)
  '#f43f5e', // J — Rose (klassisch: Blau)
  '#38bdf8', // L — Himmelblau (klassisch: Orange)
];

export function reihenfallFarbe(index: number): string {
  return FARBEN[index % FARBEN.length]!;
}

export const TEIL_NAMEN: Record<TeilTyp, string> = {
  I: 'I-Stein',
  O: 'O-Stein',
  T: 'T-Stein',
  S: 'S-Stein',
  Z: 'Z-Stein',
  J: 'J-Stein',
  L: 'L-Stein',
};
