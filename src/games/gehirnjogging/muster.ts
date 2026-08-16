import { rng } from '../../core/rng';
import type { Zufall } from '../../core/rng';

/**
 * Muster erkennen: eine sichtbare Zahlenfolge, vier Zahlen zur Wahl für das
 * nächste Glied. Reine Funktion — gleiche Saat ergibt immer dieselbe Folge.
 */

export type MusterAufgabe = {
  folge: readonly number[];
  antworten: readonly [number, number, number, number];
  richtig: 0 | 1 | 2 | 3;
};

const SICHTBARE_LAENGE = 4;

export type Regel = 'arithmetisch' | 'wechselnd' | 'geometrisch';

/** Sechs Stufen, alle 15 Level eine höher — dieselbe Formel wie beim Kopfrechnen. */
export function stufeFuerLevel(level: number): number {
  return Math.min(5, Math.floor((level - 1) / 15));
}

/** Die Stellschrauben einer Stufe. */
export type Stufenwerte = {
  /** Welche Bildungsgesetze auf dieser Stufe vorkommen dürfen. */
  regeln: readonly Regel[];
  /** Größter Schritt einer gleichmäßigen Folge. */
  schrittMax: number;
  /** Größter der beiden Schritte einer wechselnden Folge. */
  wechselMax: number;
  /** Darf die Folge auch rückwärts laufen? */
  abwaerts: boolean;
};

/**
 * Die sechs Stufen als Tabelle statt als Kette von `if (stufe <= n)`.
 *
 * Die Kette hatte einen Fehler, den man ihr nicht ansah: Stufe 0 und 1
 * stimmten in **jedem** Wert überein, Stufe 2 und 3 ebenso, Stufe 4 und 5
 * ebenso — aus sechs Stufen wurden in Wahrheit drei. Am Anfang tat das am
 * meisten weh, denn „Muster erkennen" ist nur jedes dritte Level dran: Bis
 * Level 30, also bis zur zehnten Muster-Runde, wurde es kein einziges Mal
 * schwerer.
 *
 * In einer Tabelle steht jede Stufe in einer Zeile, und ein Blick genügt,
 * um zu sehen, dass sich von Zeile zu Zeile etwas ändert. `muster.test.ts`
 * prüft das zusätzlich nach, damit es beim nächsten Anfassen so bleibt.
 */
export const STUFEN: readonly Stufenwerte[] = [
  // `wechselMax` steht hier nur, weil das Feld zum Typ gehört — Stufe 0
  // kennt die Regel „wechselnd" nicht und liest den Wert nie.
  { regeln: ['arithmetisch'], schrittMax: 5, wechselMax: 4, abwaerts: false },
  { regeln: ['arithmetisch', 'wechselnd'], schrittMax: 7, wechselMax: 4, abwaerts: false },
  { regeln: ['arithmetisch', 'wechselnd'], schrittMax: 9, wechselMax: 6, abwaerts: true },
  {
    regeln: ['arithmetisch', 'wechselnd', 'geometrisch'],
    schrittMax: 11,
    wechselMax: 8,
    abwaerts: true,
  },
  {
    regeln: ['arithmetisch', 'wechselnd', 'geometrisch'],
    schrittMax: 15,
    wechselMax: 10,
    abwaerts: true,
  },
  {
    regeln: ['arithmetisch', 'wechselnd', 'geometrisch'],
    schrittMax: 20,
    wechselMax: 12,
    abwaerts: true,
  },
];

export function werteFuerLevel(level: number): Stufenwerte {
  return STUFEN[stufeFuerLevel(level)]!;
}

function folgeArithmetisch(z: Zufall, w: Stufenwerte): { folge: number[]; naechster: number } {
  // Der Kurzschluss ist Absicht: Auf den unteren Stufen wird gar nicht erst
  // gewürfelt, dort läuft jede Folge aufwärts.
  const richtung = w.abwaerts && z.waehlen([true, false]) ? -1 : 1;
  const schrittGroesse = z.bereich(1, w.schrittMax);
  const schritt = schrittGroesse * richtung;
  // Bei einer fallenden Folge hoch genug anfangen, damit auch das gesuchte
  // fünfte Glied noch positiv bleibt.
  const start =
    richtung > 0
      ? z.bereich(1, 20)
      : z.bereich(schrittGroesse * SICHTBARE_LAENGE + 5, schrittGroesse * SICHTBARE_LAENGE + 30);
  const folge = Array.from({ length: SICHTBARE_LAENGE }, (_, i) => start + schritt * i);
  return { folge, naechster: start + schritt * SICHTBARE_LAENGE };
}

function folgeWechselnd(z: Zufall, w: Stufenwerte): { folge: number[]; naechster: number } {
  const a = z.bereich(1, w.wechselMax);
  let b = z.bereich(1, w.wechselMax);
  if (b === a) b = a + 1;
  const schritte = [a, b];
  const start = z.bereich(1, 15);
  const folge = [start];
  for (let i = 1; i < SICHTBARE_LAENGE; i++) {
    folge.push(folge[i - 1]! + schritte[(i - 1) % 2]!);
  }
  const naechster = folge[SICHTBARE_LAENGE - 1]! + schritte[(SICHTBARE_LAENGE - 1) % 2]!;
  return { folge, naechster };
}

/**
 * Verdoppeln oder verdreifachen. Bewusst ohne Stufenwerte: Schon der Faktor 3
 * führt beim fünften Glied auf 324, ein Faktor 4 käme auf über tausend — die
 * Zahl wächst dann schneller als die Aufgabe schwerer wird. Diese Regel
 * unterscheidet die Stufen dadurch, **dass** sie überhaupt vorkommt.
 */
function folgeGeometrisch(z: Zufall): { folge: number[]; naechster: number } {
  const faktor = z.waehlen([2, 3] as const);
  const start = z.bereich(1, 4);
  const folge = Array.from({ length: SICHTBARE_LAENGE }, (_, i) => start * faktor ** i);
  return { folge, naechster: start * faktor ** SICHTBARE_LAENGE };
}

/**
 * Die drei falschen Antworten neben der richtigen.
 *
 * **Nie kleiner als 1.** Der Abstand der Ablenker richtet sich nach der
 * Schrittweite der Folge (bis 20), die richtige Antwort einer *fallenden*
 * Folge liegt aber nur zwischen 5 und 30 — nach unten gestreut kamen
 * dabei Null und negative Zahlen heraus. Bei Level 33 zum Beispiel stand
 * unter „29, 23, 17, 11, ?" die Auswahl −1 / 5 / 1 / 11.
 *
 * Für ein Kind dieses Alters ist das keine Denksportaufgabe, sondern ein
 * Fehler: Alle Folgen des Spiels bestehen aus natürlichen Zahlen, eine
 * negative Antwort kann also gar nicht gemeint sein und verrät sich damit
 * selbst als Ablenker. Sie macht die Aufgabe leichter statt schwerer.
 *
 * Fällt ein Wert unter 1, wird er nach **oben** gespiegelt statt verworfen
 * — sonst rutschten alle drei Ablenker auf eine Seite, und die richtige
 * Antwort wäre bei fallenden Folgen immer die kleinste gewesen.
 */
function distraktorenErzeugen(z: Zufall, naechster: number, letzterSichtbarer: number): number[] {
  const basisAbstand = Math.max(1, Math.round(Math.abs(naechster - letzterSichtbarer)) || 3);
  const werte = new Set<number>([naechster]);
  let versuche = 0;
  while (werte.size < 4 && versuche < 100) {
    versuche++;
    const versatz = z.bereich(1, basisAbstand) * z.waehlen([1, -1] as const);
    const wert = naechster + versatz;
    werte.add(wert >= 1 ? wert : naechster + Math.abs(versatz));
  }
  // Notfall-Auffüllung: immer nach oben, damit sie nie unter 1 gerät.
  let sprung = basisAbstand + 1;
  while (werte.size < 4) {
    werte.add(naechster + sprung);
    sprung++;
  }
  werte.delete(naechster);
  return Array.from(werte);
}

export function musterAufgabe(saat: number, level: number): MusterAufgabe {
  const z = rng(saat);
  const werte = werteFuerLevel(level);
  const regel = z.waehlen(werte.regeln);

  const { folge, naechster } =
    regel === 'arithmetisch'
      ? folgeArithmetisch(z, werte)
      : regel === 'wechselnd'
        ? folgeWechselnd(z, werte)
        : folgeGeometrisch(z);

  const distraktoren = distraktorenErzeugen(z, naechster, folge[folge.length - 1] ?? 0);
  const alle = z.mischen([naechster, ...distraktoren]);
  const richtigIndex = alle.indexOf(naechster) as 0 | 1 | 2 | 3;

  return {
    folge,
    antworten: alle as [number, number, number, number],
    richtig: richtigIndex,
  };
}
