/**
 * Zufall mit Startzahl (Saat).
 *
 * Wichtig: gleiche Saat = gleiche Zahlenfolge, auf jedem Gerät, für immer.
 * Nur so ergibt Levelnummer 12 bei allen dasselbe Rätsel.
 * Deshalb hier niemals Math.random verwenden.
 */

/**
 * Ein einzelner Schritt, ohne Zustand (mulberry32).
 * Gibt die Zahl (0 bis unter 1) und die nächste Saat zurück.
 * Für reine Spiellogik, die ihre Saat selbst mitführt.
 */
export function schritt(saat: number): { wert: number; saat: number } {
  const a = (saat + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { wert: ((t ^ (t >>> 14)) >>> 0) / 4294967296, saat: a };
}

/** Text oder Zahlen zu einer Saat verrechnen, z. B. saatAus('farbsortierer', 12). */
export function saatAus(...teile: Array<string | number>): number {
  let h = 0x811c9dc5;
  for (const teil of teile) {
    const text = String(teil) + '|';
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

export type Zufall = {
  /** Kommazahl von 0 (einschließlich) bis 1 (ausschließlich). */
  zahl: () => number;
  /** Ganze Zahl von 0 bis unter obergrenze. */
  ganzzahl: (obergrenze: number) => number;
  /** Ganze Zahl von min bis max, beide eingeschlossen. */
  bereich: (min: number, max: number) => number;
  /** Ein Element aus der Liste. */
  waehlen: <T>(liste: readonly T[]) => T;
  /** Neue, gemischte Liste. Die übergebene bleibt unverändert. */
  mischen: <T>(liste: readonly T[]) => T[];
  /** Aktuelle Saat — damit lässt sich derselbe Stand später fortsetzen. */
  saat: () => number;
};

export function rng(saat: number | string): Zufall {
  let s = typeof saat === 'number' ? saat | 0 : saatAus(saat);

  const zahl = () => {
    const e = schritt(s);
    s = e.saat;
    return e.wert;
  };

  const ganzzahl = (obergrenze: number) => Math.floor(zahl() * obergrenze);

  return {
    zahl,
    ganzzahl,
    bereich: (min, max) => min + ganzzahl(max - min + 1),
    waehlen: <T,>(liste: readonly T[]): T => liste[ganzzahl(liste.length)] as T,
    mischen: <T,>(liste: readonly T[]): T[] => {
      const kopie = [...liste];
      for (let i = kopie.length - 1; i > 0; i--) {
        const j = ganzzahl(i + 1);
        [kopie[i], kopie[j]] = [kopie[j] as T, kopie[i] as T];
      }
      return kopie;
    },
    saat: () => s,
  };
}
