import type { Duell } from './konto';

/**
 * Kleine Helfer rund um ein Duell — reine Funktionen, ohne React und ohne
 * Netz, damit sich die kniffligen Fälle testen lassen.
 *
 * Der kniffligste ist gar nicht das Rechnen, sondern die Sicht: Dieselbe
 * Zeile bedeutet für den Herausforderer etwas anderes als für den Gegner.
 * Genau da entstehen sonst die Fehler, bei denen jemand „du hast gewonnen"
 * liest, obwohl er verloren hat.
 */

export type Stand =
  | { art: 'du-bist-dran' }
  | { art: 'warten-auf-gegner' }
  | { art: 'gewonnen' }
  | { art: 'verloren' }
  | { art: 'unentschieden' };

/** Wie steht dieses Duell aus Sicht der Person mit dieser Id? */
export function standFuer(duell: Duell, ich: string): Stand {
  const binHerausforderer = duell.herausforderer === ich;
  const meine = binHerausforderer ? duell.punkteHerausforderer : duell.punkteGegner;
  const seine = binHerausforderer ? duell.punkteGegner : duell.punkteHerausforderer;

  if (meine === null) return { art: 'du-bist-dran' };
  if (seine === null) return { art: 'warten-auf-gegner' };
  if (meine > seine) return { art: 'gewonnen' };
  if (meine < seine) return { art: 'verloren' };
  return { art: 'unentschieden' };
}

/** Wie heißt der andere? */
export function gegnerName(duell: Duell, ich: string): string {
  return duell.herausforderer === ich ? duell.gegnerName : duell.herausfordererName;
}

/** Die eigene Punktzahl, oder null wenn noch nicht gespielt. */
export function eigenePunkte(duell: Duell, ich: string): number | null {
  return duell.herausforderer === ich ? duell.punkteHerausforderer : duell.punkteGegner;
}

/** Die des anderen. */
export function fremdePunkte(duell: Duell, ich: string): number | null {
  return duell.herausforderer === ich ? duell.punkteGegner : duell.punkteHerausforderer;
}

/** Ist an diesem Duell noch etwas zu tun? Sortierung und Abzeichen hängen daran. */
export function offen(duell: Duell, ich: string): boolean {
  return standFuer(duell, ich).art === 'du-bist-dran';
}

/**
 * Sortiert: erst was ich spielen muss, dann was noch läuft, dann Erledigtes.
 * Innerhalb einer Gruppe das Neueste zuerst.
 */
export function sortieren(duelle: readonly Duell[], ich: string): Duell[] {
  const rang = (d: Duell) => {
    const art = standFuer(d, ich).art;
    if (art === 'du-bist-dran') return 0;
    if (art === 'warten-auf-gegner') return 1;
    return 2;
  };
  return [...duelle].sort(
    (a, b) => rang(a) - rang(b) || b.erstelltAm.localeCompare(a.erstelltAm),
  );
}

/** Ein Satz für die Zeile in der Liste. */
export function standText(stand: Stand): string {
  switch (stand.art) {
    case 'du-bist-dran':
      return 'Du bist dran';
    case 'warten-auf-gegner':
      return 'Wartet auf den Gegner';
    case 'gewonnen':
      return '🏆 Gewonnen';
    case 'verloren':
      return 'Verloren';
    default:
      return 'Unentschieden';
  }
}
