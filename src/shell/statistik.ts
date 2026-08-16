import type { Eintrag } from './speicher';
import type { SpielStatistik } from './fortschritt';

/**
 * Die Statistik-Zeilen — reine Rechnung, kein Speicherzugriff.
 *
 * Erhebt bewusst **keine einzige neue Zahl**. Runden, Siege und Sterne
 * stehen längst in `fortschritt.jeSpiel` (siehe `fortschritt.ts`), das
 * Datum der letzten Runde lässt sich aus der ohnehin gespeicherten
 * Bestenliste ablesen — der jüngste der bis zu fünf Einträge. Eine eigene
 * Zählung wäre eine zweite Wahrheit neben der ersten, und die beiden liefen
 * früher oder später auseinander.
 */

export type StatistikZeile = {
  id: string;
  partien: number;
  siege: number;
  besteSterne: number;
  bestwert: number;
  /** ISO-Datum der jüngsten Bestenlisten-Runde, oder `null` — nie gespielt. */
  zuletzt: string | null;
};

const LEER: SpielStatistik = { partien: 0, siege: 0, bestwert: 0, besteSterne: 0 };

/** Das jüngste Datum aus einer Bestenliste — oder `null`, wenn sie leer ist. */
function juengstesDatum(eintraege: readonly Eintrag[]): string | null {
  if (eintraege.length === 0) return null;
  // Absteigend nach Datum, damit auch eine unsortiert übergebene Liste
  // (Bestenlisten sind eigentlich nach Punkten sortiert, nicht nach Zeit)
  // das richtige Ergebnis liefert.
  return eintraege.reduce((neuste, e) => (e.datum > neuste ? e.datum : neuste), eintraege[0]!.datum);
}

/**
 * Baut eine Zeile je Spiel und sortiert sie.
 *
 * **Gespielte Spiele zuerst, jüngste Runde oben** — das beantwortet die
 * Frage, die man beim Öffnen dieser Seite hat: „Was habe ich zuletzt
 * gemacht, und wie stehe ich da?" Nie gespielte Spiele bleiben stehen
 * (nicht ausgeblendet, dieselbe Regel wie bei den Erfolgen), aber hinten,
 * in derselben Reihenfolge wie im Kachelmenü.
 */
export function statistikZeilen(
  spielIds: readonly string[],
  jeSpiel: Record<string, SpielStatistik>,
  bestenlisten: Record<string, readonly Eintrag[]>,
): StatistikZeile[] {
  const zeilen = spielIds.map((id): StatistikZeile => {
    const s = jeSpiel[id] ?? LEER;
    return {
      id,
      partien: s.partien,
      siege: s.siege,
      besteSterne: s.besteSterne,
      bestwert: s.bestwert,
      zuletzt: juengstesDatum(bestenlisten[id] ?? []),
    };
  });

  const urIndex = new Map(spielIds.map((id, i) => [id, i]));
  return [...zeilen].sort((a, b) => {
    if (a.zuletzt && b.zuletzt) return a.zuletzt > b.zuletzt ? -1 : a.zuletzt < b.zuletzt ? 1 : 0;
    if (a.zuletzt) return -1;
    if (b.zuletzt) return 1;
    return urIndex.get(a.id)! - urIndex.get(b.id)!;
  });
}

/** Zusammenfassung über alle Spiele — dieselben vier Zahlen wie oben auf der Fortschrittsseite. */
export function statistikGesamt(zeilen: readonly StatistikZeile[]): {
  partien: number;
  siege: number;
  sterne: number;
  ausprobiert: number;
} {
  return {
    partien: zeilen.reduce((s, z) => s + z.partien, 0),
    siege: zeilen.reduce((s, z) => s + z.siege, 0),
    sterne: zeilen.reduce((s, z) => s + z.besteSterne, 0),
    ausprobiert: zeilen.filter((z) => z.partien > 0).length,
  };
}
