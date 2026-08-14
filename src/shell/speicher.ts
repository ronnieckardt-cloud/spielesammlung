import type { Einstellungen } from '../core/types';

/**
 * Der einzige Ort im Projekt, der localStorage anfassen darf.
 *
 * Spiele bekommen ihre Punkte über onScore/onGameOver zurückgemeldet und
 * wissen nichts von Speicherung. Später kann hier zusätzlich eine
 * geräteübergreifende Bestenliste andocken, ohne dass ein Spiel sich ändert.
 */

const PRAEFIX = 'spielesammlung:';
const EINTRAEGE_PRO_SPIEL = 5;

export type Eintrag = { punkte: number; datum: string };

function lesen<T>(schluessel: string, standard: T): T {
  try {
    const roh = localStorage.getItem(PRAEFIX + schluessel);
    return roh === null ? standard : (JSON.parse(roh) as T);
  } catch {
    // Privater Modus oder voller Speicher — dann eben ohne.
    return standard;
  }
}

function schreiben(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(PRAEFIX + schluessel, JSON.stringify(wert));
  } catch {
    /* absichtlich still */
  }
}

export function bestenlisteLesen(spielId: string): Eintrag[] {
  const liste = lesen<Eintrag[]>(`beste:${spielId}`, []);
  return Array.isArray(liste) ? liste : [];
}

export function bestwert(spielId: string): number {
  return bestenlisteLesen(spielId)[0]?.punkte ?? 0;
}

/** Trägt ein Ergebnis ein und gibt die neue Liste zurück. */
export function ergebnisEintragen(spielId: string, punkte: number): Eintrag[] {
  const neu = [...bestenlisteLesen(spielId), { punkte, datum: new Date().toISOString() }]
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, EINTRAEGE_PRO_SPIEL);
  schreiben(`beste:${spielId}`, neu);
  return neu;
}

export function bestenlisteLoeschen(spielId?: string): void {
  try {
    if (spielId) {
      localStorage.removeItem(`${PRAEFIX}beste:${spielId}`);
      return;
    }
    for (const schluessel of Object.keys(localStorage)) {
      if (schluessel.startsWith(`${PRAEFIX}beste:`)) localStorage.removeItem(schluessel);
    }
  } catch {
    /* absichtlich still */
  }
}

export function einstellungenLesen(): Einstellungen {
  const standard: Einstellungen = {
    sound: true,
    reducedMotion:
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const gespeichert = lesen<Partial<Einstellungen>>('einstellungen', {});
  return {
    sound: typeof gespeichert.sound === 'boolean' ? gespeichert.sound : standard.sound,
    reducedMotion:
      typeof gespeichert.reducedMotion === 'boolean'
        ? gespeichert.reducedMotion
        : standard.reducedMotion,
  };
}

export function einstellungenSchreiben(einstellungen: Einstellungen): void {
  schreiben('einstellungen', einstellungen);
}
