import type { GameApi } from '../../core/types';
import { Reihenfall } from './Reihenfall';

/** Alles, was die Hülle von diesem Spiel sehen darf. */
export const reihenfall: GameApi = {
  id: 'reihenfall',
  title: 'Reihenfall',
  blurb: 'Fallende Vierlinge — volle Reihen räumen, bevor der Stapel wächst.',
  accent: '#f43f5e',
  symbol: '🧱',
  Component: Reihenfall,
};
