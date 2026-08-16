/**
 * Farbe je Kachelstufe. Bewusst eine eigene, kräftige Reihe (nicht die
 * beigen Töne, die man von ähnlichen Spielen kennt): von Blau über Grün und
 * Gelb bis Rot und Violett, damit man am Farbton allein schon sieht, wie
 * weit eine Kachel schon ist.
 */
const FARBEN: readonly string[] = [
  '#38bdf8', // 2
  '#22d3ee', // 4
  '#2dd4bf', // 8
  '#4ade80', // 16
  '#a3e635', // 32
  '#facc15', // 64
  '#fb923c', // 128
  '#f87171', // 256
  '#f472b6', // 512
  '#c084fc', // 1024
  '#a855f7', // 2048
];

/** Die beiden Schriftfarben, zwischen denen jede Kachel wählt. */
const TEXT_DUNKEL = '#0b0f14';
const TEXT_HELL = '#ffffff';

export function kachelFarbe(stufe: number): string {
  // Über der Liste bleibt es beim letzten Ton — so weit kommt man ohnehin
  // kaum, und ein fehlender Eintrag soll nie zu „undefined" führen.
  return FARBEN[Math.min(stufe, FARBEN.length) - 1] ?? FARBEN[0]!;
}

/**
 * Relative Helligkeit einer `#rrggbb`-Farbe nach WCAG (0 = schwarz, 1 = weiß).
 *
 * Nicht der naive Mittelwert der drei Kanäle: Grün wiegt für das Auge weit
 * schwerer als Blau, und die Kanäle müssen vorher aus der Bildschirmkennlinie
 * herausgerechnet werden. Genau daran scheiterte die Augenmaß-Schätzung
 * vorher — `#4ade80` (16) sieht „mittel" aus, ist aber die hellste Kachel
 * nach 32 und 64.
 */
export function luminanz(farbe: string): number {
  const kanal = (von: number) => {
    const wert = parseInt(farbe.slice(von, von + 2), 16) / 255;
    return wert <= 0.04045 ? wert / 12.92 : ((wert + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
}

/** Kontrastverhältnis zweier Farben nach WCAG: 1 = gleich, 21 = Schwarz auf Weiß. */
export function kontrast(a: string, b: string): number {
  const la = luminanz(a);
  const lb = luminanz(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Schriftfarbe einer Kachel: die von beiden, die sich besser abhebt.
 *
 * Vorher entschied das eine Handliste („Stufe 32 und 64 sind hell"), und die
 * lag daneben — auf neun der elf Kacheln stand weiße Schrift mit einem
 * Kontrast zwischen 1,7:1 und 4,0:1, also unter der 4,5:1-Grenze und teils
 * kaum noch lesbar. Die ganze Reihe ist eben durchgehend hell, nicht nur
 * Grün und Gelb.
 *
 * Gerechnet statt aufgezählt, damit eine später geänderte Kachelfarbe das
 * Problem nicht neu aufreißen kann: Wird eine Farbe dunkel, kommt hier von
 * selbst wieder weiße Schrift heraus.
 */
export function kachelTextFarbe(stufe: number): string {
  const farbe = kachelFarbe(stufe);
  return kontrast(farbe, TEXT_DUNKEL) >= kontrast(farbe, TEXT_HELL) ? TEXT_DUNKEL : TEXT_HELL;
}
