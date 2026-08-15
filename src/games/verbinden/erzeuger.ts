import { schritt } from '../../core/rng';

/**
 * Flow Link — der Rätsel-Erzeuger.
 *
 * **Der Kniff: Erst die Lösung bauen, dann die Aufgabe daraus ableiten.**
 *
 * Ein Rätsel, das man sich ausdenkt und hinterher zu lösen versucht, kann
 * unlösbar sein — beim Farbsortierer braucht es dafür einen eigenen
 * Suchlauf. Hier geht es viel billiger: Wir bauen zuerst einen Weg, der
 * **jedes** Feld genau einmal berührt, zerschneiden ihn in Stücke und
 * setzen an die Enden der Stücke die farbigen Punkte. Damit ist das Rätsel
 * lösbar *und* vollständig füllbar — beides ohne einen einzigen Suchlauf.
 *
 * Dass es daneben noch andere Lösungen geben kann, ist hier ausdrücklich in
 * Ordnung: Für ein Kind zählt „alle verbunden und alles voll", nicht
 * „genau der eine gedachte Weg". (Bei Nonogrammen wäre das anders — deshalb
 * steht Pixel Paint bis heute auf der zurückgestellten Liste.)
 */

export type Zelle = number;

/** Ein Paar gleichfarbiger Punkte. */
export type Paar = { farbe: number; a: Zelle; b: Zelle };

export type Raetsel = {
  breite: number;
  hoehe: number;
  paare: readonly Paar[];
  /** Der gedachte Lösungsweg je Paar — nur für Tests und Hinweise. */
  loesung: readonly (readonly Zelle[])[];
};

export const zuXY = (z: Zelle, breite: number) => ({ x: z % breite, y: Math.floor(z / breite) });
export const zuZelle = (x: number, y: number, breite: number) => y * breite + x;

/** Die bis zu vier Nachbarfelder. */
export function nachbarn(z: Zelle, breite: number, hoehe: number): Zelle[] {
  const { x, y } = zuXY(z, breite);
  const raus: Zelle[] = [];
  if (x > 0) raus.push(z - 1);
  if (x < breite - 1) raus.push(z + 1);
  if (y > 0) raus.push(z - breite);
  if (y < hoehe - 1) raus.push(z + breite);
  return raus;
}

export function sindNachbarn(a: Zelle, b: Zelle, breite: number, hoehe: number): boolean {
  return nachbarn(a, breite, hoehe).includes(b);
}

/**
 * Ein Weg, der jedes Feld genau einmal berührt (Hamiltonweg).
 *
 * Angefangen wird mit dem Schlangenweg — Zeile für Zeile, abwechselnd hin
 * und her. Der ist trivial zu bauen, aber als Rätsel langweilig: Alle
 * Stücke wären waagerechte Striche.
 *
 * Deshalb danach der **Rückbiss** (im Englischen „backbite"): Man nimmt ein
 * Wegende, sucht sich einen beliebigen Nachbarn im Gitter, und dreht das
 * Wegstück dahinter um. Das Ergebnis ist wieder ein Hamiltonweg — nur ein
 * anderer. Oft genug wiederholt, kommt ein gut durchgemischter Weg heraus,
 * ohne dass je geprüft werden müsste, ob er noch gültig ist. Genau das ist
 * der Grund für dieses Verfahren: Es kann gar keinen ungültigen Zustand
 * erzeugen.
 */
export function hamiltonweg(
  breite: number,
  hoehe: number,
  saat: number,
  mischungen: number,
): Zelle[] {
  const weg: Zelle[] = [];
  for (let y = 0; y < hoehe; y++) {
    for (let i = 0; i < breite; i++) {
      const x = y % 2 === 0 ? i : breite - 1 - i;
      weg.push(zuZelle(x, y, breite));
    }
  }

  /** Wo liegt welche Zelle im Weg? Sonst wäre jeder Rückbiss eine Suche. */
  const stelle = new Map<Zelle, number>();
  weg.forEach((z, i) => stelle.set(z, i));

  let s = saat;
  for (let n = 0; n < mischungen; n++) {
    const a = schritt(s);
    s = a.saat;
    // Mal am Anfang, mal am Ende beißen — sonst wandert nur ein Ende.
    const amEnde = a.wert < 0.5;
    const endeZelle = amEnde ? weg[weg.length - 1]! : weg[0]!;

    const moegliche = nachbarn(endeZelle, breite, hoehe);
    const b = schritt(s);
    s = b.saat;
    const ziel = moegliche[Math.floor(b.wert * moegliche.length)]!;
    const i = stelle.get(ziel)!;

    if (amEnde) {
      // Der Nachbar ist schon der direkte Vorgänger — nichts zu drehen.
      if (i === weg.length - 2) continue;
      // Alles nach dem Nachbarn umdrehen.
      const schwanz = weg.splice(i + 1);
      schwanz.reverse();
      weg.push(...schwanz);
      for (let k = i + 1; k < weg.length; k++) stelle.set(weg[k]!, k);
    } else {
      if (i === 1) continue;
      const kopf = weg.splice(0, i);
      kopf.reverse();
      weg.unshift(...kopf);
      for (let k = 0; k < i; k++) stelle.set(weg[k]!, k);
    }
  }

  return weg;
}

/**
 * Zerschneidet den Weg in `anzahl` Stücke von jeweils mindestens zwei
 * Feldern.
 *
 * Weniger als zwei ginge nicht: Beide Punkte eines Paares lägen dann auf
 * demselben Feld.
 */
export function zerschneiden(weg: readonly Zelle[], anzahl: number, saat: number): Zelle[][] {
  const stuecke: Zelle[][] = [];
  let rest = weg.length;
  let start = 0;
  let s = saat;

  for (let i = 0; i < anzahl; i++) {
    const uebrigeStuecke = anzahl - i - 1;
    if (uebrigeStuecke === 0) {
      stuecke.push([...weg.slice(start)]);
      break;
    }
    // So lang darf dieses Stück höchstens sein, damit für die restlichen
    // Stücke noch je zwei Felder übrig bleiben.
    const maximal = rest - uebrigeStuecke * 2;
    const a = schritt(s);
    s = a.saat;
    const laenge = 2 + Math.floor(a.wert * Math.max(1, maximal - 1));
    stuecke.push([...weg.slice(start, start + laenge)]);
    start += laenge;
    rest -= laenge;
  }
  return stuecke;
}

/** Feldgröße und Farbzahl steigen mit dem Level, beides gedeckelt. */
export function massFuerLevel(level: number): { breite: number; hoehe: number; farben: number } {
  // 5×5 bis 7×7: Darüber wird ein Feld auf einem 375er-Handy zu klein zum
  // Treffen, und die Rätsel werden für ein Kind zäh statt kniffliger.
  const kante = Math.min(7, 5 + Math.floor((level - 1) / 3));
  // Mehr Farben = mehr Wege = kniffliger. Nie mehr als es Farben gibt.
  const farben = Math.min(6, 3 + Math.floor((level - 1) / 2));
  return { breite: kante, hoehe: kante, farben };
}

export function raetselErzeugen(saat: number, level: number): Raetsel {
  const { breite, hoehe, farben } = massFuerLevel(level);
  // Reichlich mischen: Faustregel aus der Literatur ist ein Vielfaches der
  // Feldzahl. Bei 49 Feldern sind das rund 1000 Rückbisse — auf jedem Gerät
  // eine Sache von Millisekunden, weil jeder Schritt nur eine Umkehrung ist.
  const weg = hamiltonweg(breite, hoehe, saat, breite * hoehe * 20);
  const stuecke = zerschneiden(weg, farben, saat ^ 0x9e3779b9);

  return {
    breite,
    hoehe,
    paare: stuecke.map((stueck, i) => ({
      farbe: i,
      a: stueck[0]!,
      b: stueck[stueck.length - 1]!,
    })),
    loesung: stuecke,
  };
}
