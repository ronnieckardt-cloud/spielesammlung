/**
 * Die vier Farben und — genauso wichtig — ihre vier **Strichmuster**.
 *
 * Dieses Spiel besteht aus einer einzigen Frage: „Passt meine Farbe zu dem
 * Bogen da oben?" Ginge das nur über den Farbton, wäre es für ein
 * farbfehlsichtiges Kind schlicht nicht spielbar — und Rot/Grün ist genau
 * die häufigste Schwäche.
 *
 * Deshalb trägt jeder Bogen ein eigenes Strichmuster, und die Kugel trägt
 * **dasselbe** Muster als Ring um sich herum. Verglichen wird dann Muster
 * mit Muster, nicht nur Farbe mit Farbe.
 *
 * Die Muster sind bewusst grob gestaffelt (durchgezogen, lang, kurz,
 * gepunktet) — feine Abstufungen erkennt man bei Ringgröße 20 nicht mehr.
 */

export type FarbEintrag = {
  /** Für SVG-interne ids. */
  id: string;
  hex: string;
  /** Dunklere Fassung für die Tiefe unter dem Bogen. */
  dunkel: string;
  /** Wird vorgelesen und steht im aria-label. */
  name: string;
  /**
   * `stroke-dasharray` des Bogens. `undefined` = durchgezogen.
   * Die Werte gelten für einen Ring mit Halbmesser um die 25.
   */
  muster?: string;
};

export const FARBEN: readonly FarbEintrag[] = [
  { id: 'kirsche', hex: '#fb7185', dunkel: '#9f1239', name: 'Rot' },
  { id: 'sonne', hex: '#fbbf24', dunkel: '#b45309', name: 'Gelb', muster: '13 7' },
  { id: 'lagune', hex: '#2dd4bf', dunkel: '#0f766e', name: 'Türkis', muster: '6 6' },
  { id: 'flieder', hex: '#c084fc', dunkel: '#6b21a8', name: 'Violett', muster: '1.5 6' },
];

export function farbe(index: number): FarbEintrag {
  return FARBEN[index % FARBEN.length]!;
}
