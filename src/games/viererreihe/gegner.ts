import { rng, saatAus } from '../../core/rng';
import {
  SPALTEN,
  einwurfZeile,
  feldMitStein,
  feldVoll,
  gewinnlinieAb,
  moeglicheSpalten,
} from './logik';
import type { Feld, Spieler, Stufe } from './logik';

/**
 * Der Computergegner für Drop Four.
 *
 * Verfahren: Minimax mit Alpha-Beta-Beschneidung. Der Computer spielt seine
 * Züge durch, nimmt an, dass der Mensch jeweils das für ihn Beste antwortet,
 * und wählt den Zug, der im schlechtesten Fall am besten dasteht.
 *
 * **Warum das hier vertretbar ist:** Sieben Spalten, Suchtiefe höchstens
 * sechs — das sind ohne Beschneidung 117 649 Stellungen, mit
 * Alpha-Beta und guter Zugreihenfolge typischerweise ein Bruchteil davon.
 * Das läuft auch auf einem alten iPad in wenigen Millisekunden.
 *
 * Alles rein und ohne React, damit es sich ohne Browser testen lässt.
 */

/** Bewertung einer sicher gewonnenen Stellung. */
const SIEG = 1_000_000;

/** Suchtiefe je Stufe. */
const TIEFE: Record<Stufe, number> = {
  // Zwei Halbzüge: Der Computer sieht seinen eigenen Sieg und die
  // unmittelbare Drohung des Menschen. Also nicht dumm, aber ohne Plan —
  // gegen ein Kind genau richtig.
  leicht: 2,
  mittel: 4,
  schwer: 6,
};

/**
 * Wie stark ein Zug schlechter sein darf, um trotzdem gewählt zu werden.
 *
 * Nur auf der leichten Stufe: Ohne diese Streuung spielt der Computer bei
 * gleicher Ausgangslage immer exakt dieselbe Partie, und das wird nach
 * dem dritten Mal langweilig. Auf „mittel" und „schwer" gibt es sie nicht —
 * dort soll er wirklich sein Bestes spielen.
 */
const NACHSICHT: Record<Stufe, number> = { leicht: 30, mittel: 0, schwer: 0 };

const GEGNER = (wer: Spieler): Spieler => (wer === 0 ? 1 : 0);

/**
 * Alle 69 Vierer-Fenster des Bretts, einmal vorab berechnet.
 *
 * Die Stellungsbewertung läuft im innersten Teil der Suche und wird
 * zehntausendfach aufgerufen — die Fensterliste bei jedem Aufruf neu
 * aufzubauen wäre der teuerste Einzelposten überhaupt.
 */
const FENSTER: readonly (readonly { x: number; y: number }[])[] = (() => {
  const richtungen = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
  ];
  const alle: { x: number; y: number }[][] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < SPALTEN; x++) {
      for (const r of richtungen) {
        const fenster = [0, 1, 2, 3].map((i) => ({ x: x + r.x * i, y: y + r.y * i }));
        if (fenster.every((p) => p.x >= 0 && p.x < SPALTEN && p.y >= 0 && p.y < 6)) {
          alle.push(fenster);
        }
      }
    }
  }
  return alle;
})();

/**
 * Stellungsbewertung aus Sicht von `ich`. Positiv heißt gut für `ich`.
 *
 * Gezählt wird über Vierer-Fenster: Ein Fenster mit drei eigenen Steinen
 * und einer Lücke ist viel wert, eines mit gemischten Farben gar nichts
 * (dort kann nie eine Viererreihe entstehen).
 *
 * Die Drohungen des Gegners werden **höher** gewichtet als die eigenen
 * Chancen (80 gegen 50, 12 gegen 10). Ohne dieses Übergewicht baut der
 * Computer lieber die eigene Reihe weiter, statt zu blocken — und verliert
 * gegen jeden, der einfach stur drei nebeneinander legt.
 */
export function bewerten(feld: Feld, ich: Spieler): number {
  const gegner = GEGNER(ich);
  let wert = 0;

  // Die Mitte ist mehr wert: Durch ein Feld in der mittleren Spalte laufen
  // mehr mögliche Viererreihen als durch eines am Rand.
  for (let y = 0; y < 6; y++) {
    if (feld[y]![3] === ich) wert += 6;
    else if (feld[y]![3] === gegner) wert -= 6;
  }

  for (const fenster of FENSTER) {
    let meine = 0;
    let seine = 0;
    for (const p of fenster) {
      const zelle = feld[p.y]![p.x];
      if (zelle === ich) meine++;
      else if (zelle === gegner) seine++;
    }
    if (meine > 0 && seine > 0) continue; // gemischt — hier geht nichts mehr
    if (meine === 3) wert += 50;
    else if (meine === 2) wert += 10;
    else if (seine === 3) wert -= 80;
    else if (seine === 2) wert -= 12;
  }
  return wert;
}

/**
 * Zugreihenfolge für die Suche: von der Mitte nach außen.
 *
 * Alpha-Beta beschneidet umso mehr, je früher der beste Zug geprüft wird —
 * und in diesem Spiel ist das fast immer ein mittlerer. Mit dieser einen
 * Zeile wird die Suche um ein Vielfaches schneller.
 */
function nachMitteSortiert(spalten: readonly number[]): number[] {
  const mitte = (SPALTEN - 1) / 2;
  return [...spalten].sort((a, b) => Math.abs(a - mitte) - Math.abs(b - mitte));
}

/**
 * Minimax mit Alpha-Beta.
 *
 * `tiefe` zählt herunter. Ein Sieg wird um die Resttiefe verringert, damit
 * ein Sieg in zwei Zügen mehr wert ist als derselbe Sieg in vier — sonst
 * schiebt der Computer einen sicheren Gewinn beliebig vor sich her.
 */
function suchen(
  feld: Feld,
  tiefe: number,
  alpha: number,
  beta: number,
  amZug: Spieler,
  ich: Spieler,
): number {
  const spalten = moeglicheSpalten(feld);
  if (spalten.length === 0) return 0; // unentschieden

  if (tiefe === 0) return bewerten(feld, ich);

  let besteWertung = amZug === ich ? -Infinity : Infinity;

  for (const x of nachMitteSortiert(spalten)) {
    const y = einwurfZeile(feld, x)!;
    const naechstes = feldMitStein(feld, x, y, amZug);

    let wertung: number;
    if (gewinnlinieAb(naechstes, x, y)) {
      wertung = amZug === ich ? SIEG + tiefe : -(SIEG + tiefe);
    } else if (feldVoll(naechstes)) {
      wertung = 0;
    } else {
      wertung = suchen(naechstes, tiefe - 1, alpha, beta, GEGNER(amZug), ich);
    }

    if (amZug === ich) {
      besteWertung = Math.max(besteWertung, wertung);
      alpha = Math.max(alpha, wertung);
    } else {
      besteWertung = Math.min(besteWertung, wertung);
      beta = Math.min(beta, wertung);
    }
    if (alpha >= beta) break; // dieser Ast kann das Ergebnis nicht mehr ändern
  }

  return besteWertung;
}

/**
 * Der Zug des Computers.
 *
 * `saat` macht die Auswahl unter gleich guten Zügen wiederholbar — ohne sie
 * bräuchte es `Math.random`, und das ist im Projekt durchgehend unerwünscht.
 */
export function besterZug(feld: Feld, ich: Spieler, stufe: Stufe, saat: number): number | null {
  const spalten = moeglicheSpalten(feld);
  if (spalten.length === 0) return null;

  const bewertungen = nachMitteSortiert(spalten).map((x) => {
    const y = einwurfZeile(feld, x)!;
    const naechstes = feldMitStein(feld, x, y, ich);
    if (gewinnlinieAb(naechstes, x, y)) return { x, wert: SIEG + TIEFE[stufe] };
    if (feldVoll(naechstes)) return { x, wert: 0 };
    return {
      x,
      wert: suchen(naechstes, TIEFE[stufe] - 1, -Infinity, Infinity, GEGNER(ich), ich),
    };
  });

  const beste = Math.max(...bewertungen.map((b) => b.wert));

  // Einen sicheren Sieg oder eine nötige Abwehr nie verstreuen — sonst
  // übersieht die leichte Stufe einen Vierer, der direkt vor ihr liegt,
  // und das wirkt kaputt statt leicht.
  const schwelle = Math.abs(beste) >= SIEG ? 0 : NACHSICHT[stufe];
  const infrage = bewertungen.filter((b) => b.wert >= beste - schwelle);

  return infrage[rng(saatAus('viererreihe-zug', saat)).ganzzahl(infrage.length)]!.x;
}
