/**
 * Ein Spieler mit Gedächtnis für die Tests: Er merkt sich jede aufgedeckte Karte, spielt bekannte Paare
 * sofort und deckt sonst unbekannte Karten auf. Ein Wirbel löscht sein Wissen; hat er einen Blick, nimmt
 * er ihn dann — und lernt dabei alle Karten auf einmal.
 *
 * Er ist der Beleg dafür, dass die Zuggrenzen und der Wirbel zu schaffen sind: Ein Spieler, der nichts
 * vergisst außer durch den Wirbel, muss durchkommen, und der Wirbel muss ihn **messbar** Züge kosten.
 */
import { aufdecken, blickEnde, blickMoeglich, blickNutzen, karteInZeile, schliessen, zeileBlickbar } from './logik';
import type { Zustand } from './logik';

export type Lauf = { z: Zustand; wirbel: number; blicke: number };

export function spielen(start: Zustand, mitBlick: boolean, hoechstensZuege = 400): Lauf {
  let z = start;
  /** Position → Motiv, soweit der Spieler sie gesehen hat und sie noch gilt. */
  let wissen = new Map<number, number>();
  const lerne = (pos: number) => wissen.set(pos, z.karten[pos]!.motiv);

  for (let schritt = 0; schritt < hoechstensZuege && !z.vorbei; schritt++) {
    // Nach einem Wirbel steht nichts mehr, wo es stand — ein Blick bringt einen Teil des Wissens zurück:
    // Er nimmt die Zeile mit den meisten noch verdeckten Karten.
    if (mitBlick && wissen.size === 0 && blickMoeglich(z)) {
      const zeilen = Math.ceil(z.karten.length / z.spalten);
      let beste = -1;
      let bestes = 0;
      for (let r = 0; r < zeilen; r++) {
        const n = karteInZeile(z, r).filter((i) => !z.karten[i]!.gefunden).length;
        if (zeileBlickbar(z, r) && n > bestes) {
          bestes = n;
          beste = r;
        }
      }
      if (beste >= 0) {
        z = blickNutzen(z, beste);
        for (const i of karteInZeile(z, beste)) if (!z.karten[i]!.gefunden) lerne(i);
        z = blickEnde(z);
      }
    }

    // 1. Ein bekanntes Paar?
    const nachMotiv = new Map<number, number[]>();
    for (const [pos, motiv] of wissen) {
      if (z.karten[pos]!.gefunden) continue;
      nachMotiv.set(motiv, [...(nachMotiv.get(motiv) ?? []), pos]);
    }
    const paar = [...nachMotiv.values()].find((l) => l.length >= 2);
    if (paar) {
      z = aufdecken(z, paar[0]!);
      z = aufdecken(z, paar[1]!);
      paar.forEach((p) => wissen.delete(p));
      continue;
    }

    // 2. Eine unbekannte Karte aufdecken …
    const unbekannt = z.karten.map((_, i) => i).filter((i) => !z.karten[i]!.gefunden && !wissen.has(i));
    const erste = unbekannt[0]!;
    z = aufdecken(z, erste);
    lerne(erste);
    const motiv = z.karten[erste]!.motiv;
    // … und wenn ihr Partner schon bekannt ist, ihn dazu.
    const partner = [...wissen].find(([pos, m]) => pos !== erste && m === motiv && !z.karten[pos]!.gefunden)?.[0];
    const zweite = partner ?? unbekannt[1] ?? [...wissen.keys()].find((p) => p !== erste && !z.karten[p]!.gefunden)!;
    z = aufdecken(z, zweite);
    if (partner === undefined) lerne(zweite);
    if (z.karten[erste]!.gefunden) {
      wissen.delete(erste);
      wissen.delete(zweite);
      continue;
    }
    // Fehlgriff: zudecken — ein Wirbel löscht das Wissen.
    const vorher = z.wirbel;
    z = schliessen(z);
    if (z.wirbel !== vorher) wissen = new Map();
  }
  return { z, wirbel: z.wirbel, blicke: z.blicke };
}
