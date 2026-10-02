import { rng, saatAus } from '../../core/rng';
import type { Zufall } from '../../core/rng';
import type { LeiterFrage } from '../../core/leiter';

/**
 * Kopfnuss: gerechnete Fragen für die Gewinnleiter.
 *
 * Quiz Time mischt unter die Wissensfragen ein paar Rechenaufgaben — „es werden mehr rechnen". Sie
 * werden aus einer Saat **erzeugt**, nicht aus einer Liste gezogen: Gleiche Saat ergibt dieselbe Aufgabe
 * (Duell!), und trotzdem gibt es auf jeder Schwere Tausende verschiedene.
 *
 * Wie bei allen Fragen steigt die Schwere in fünf Stufen: von „47 + 38" bis zu „47 × 53".
 */

export type Rechenaufgabe = {
  /** Der volle Fragetext. */
  frage: string;
  /** Ein Ausdruck, den JavaScript auswerten kann — damit die Tests den Wert **unabhängig** nachrechnen können. */
  ausdruck: string;
  wert: number;
  /** Rechenweg für die Erklärung, ohne den Satzanfang. */
  weg: string;
  /** Typische Fehlergebnisse (falsch gerechnet, falsche Reihenfolge …), bevorzugt als falsche Antworten. */
  fallen: number[];
};

const ZAHL = new Intl.NumberFormat('de-DE');
export const formatiere = (n: number) => ZAHL.format(n);

const MINUS = '−';
const HOCH: Record<number, string> = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', 10: '¹⁰' };

type Erzeuger = (z: Zufall) => Rechenaufgabe;

/* --- Schwere 1: Plus, Minus und kleines Einmaleins --------------------------------------------- */

const plus: Erzeuger = (z) => {
  const a = z.bereich(12, 78);
  const b = z.bereich(11, 99 - a);
  const wert = a + b;
  return {
    frage: `Wie viel ist ${a} + ${b}?`,
    ausdruck: `${a} + ${b}`,
    wert,
    weg: `${a} + ${b} = ${wert}`,
    // Der typische Fehler: den Übertrag vergessen oder doppelt zählen.
    fallen: [wert - 10, wert + 10, wert - 1, wert + 1],
  };
};

const minus: Erzeuger = (z) => {
  const a = z.bereich(32, 99);
  const b = z.bereich(11, a - 11);
  const wert = a - b;
  return {
    frage: `Wie viel ist ${a} ${MINUS} ${b}?`,
    ausdruck: `${a} - ${b}`,
    wert,
    weg: `${a} ${MINUS} ${b} = ${wert}`,
    fallen: [wert + 10, wert - 10, wert + 1, wert - 1],
  };
};

const malKlein: Erzeuger = (z) => {
  const a = z.bereich(3, 9);
  const b = z.bereich(3, 9);
  const wert = a * b;
  return {
    frage: `Wie viel ist ${a} × ${b}?`,
    ausdruck: `${a} * ${b}`,
    wert,
    weg: `${a} × ${b} = ${wert}`,
    fallen: [wert + a, wert - a, wert + b, wert - b],
  };
};

/* --- Schwere 2: großes Einmaleins, Teilen, Punkt vor Strich ------------------------------------ */

const malGross: Erzeuger = (z) => {
  const a = z.bereich(6, 12);
  const b = z.bereich(6, 12);
  const wert = a * b;
  return {
    frage: `Wie viel ist ${a} × ${b}?`,
    ausdruck: `${a} * ${b}`,
    wert,
    weg: `${a} × ${b} = ${wert}`,
    fallen: [wert + a, wert - a, wert + b, wert - b, wert + 10, wert - 10],
  };
};

const geteilt: Erzeuger = (z) => {
  const b = z.bereich(4, 12);
  const wert = z.bereich(4, 12);
  const a = b * wert;
  return {
    frage: `Wie viel ist ${a} : ${b}?`,
    ausdruck: `${a} / ${b}`,
    wert,
    weg: `${a} : ${b} = ${wert}, denn ${wert} × ${b} = ${a}`,
    fallen: [wert + 1, wert - 1, wert + 2, wert - 2, b],
  };
};

const punktVorStrich: Erzeuger = (z) => {
  const a = z.bereich(2, 9);
  const b = z.bereich(2, 9);
  const c = z.bereich(2, 9);
  const wert = a + b * c;
  return {
    frage: `Wie viel ist ${a} + ${b} × ${c}?`,
    ausdruck: `${a} + ${b} * ${c}`,
    wert,
    weg: `Punkt vor Strich: ${b} × ${c} = ${b * c}, dann ${a} + ${b * c} = ${wert}`,
    // Von links nach rechts gerechnet — der klassische Fehler.
    fallen: [(a + b) * c, wert + 1, wert - 1, wert + 10],
  };
};

/* --- Schwere 3: zweistellig mal einstellig, Prozent, Brüche, Klammern -------------------------- */

const malZweistellig: Erzeuger = (z) => {
  const a = z.bereich(13, 49);
  const b = z.bereich(3, 9);
  const wert = a * b;
  const zehner = Math.floor(a / 10) * 10;
  const einer = a - zehner;
  return {
    frage: `Wie viel ist ${a} × ${b}?`,
    ausdruck: `${a} * ${b}`,
    wert,
    weg: `${a} × ${b} = ${zehner} × ${b} + ${einer} × ${b} = ${zehner * b} + ${einer * b} = ${wert}`,
    fallen: [wert + 10, wert - 10, wert + b, wert - b, wert + 20],
  };
};

const prozent: Erzeuger = (z) => {
  const p = z.waehlen([10, 20, 25, 50, 75]);
  const basis = z.waehlen([40, 60, 80, 120, 160, 200, 240, 400]);
  const wert = (p * basis) / 100;
  return {
    frage: `Wie viel sind ${p} % von ${basis}?`,
    ausdruck: `${p} * ${basis} / 100`,
    wert,
    weg: `${p} % von ${basis} = ${basis} × ${p} : 100 = ${wert}`,
    fallen: [basis - wert, wert * 2, wert / 2, wert + 10, wert * 10].filter((x) => Number.isInteger(x)),
  };
};

const bruch: Erzeuger = (z) => {
  const nenner = z.waehlen([2, 3, 4, 5]);
  const zaehler = z.bereich(1, nenner - 1);
  const basis = nenner * z.bereich(6, 30);
  const wert = (zaehler * basis) / nenner;
  return {
    frage: `Wie viel ist ${zaehler}/${nenner} von ${basis}?`,
    ausdruck: `${zaehler} * ${basis} / ${nenner}`,
    wert,
    weg: `${basis} : ${nenner} = ${basis / nenner}, mal ${zaehler} = ${wert}`,
    // Nur ein Teil statt `zaehler` Teile — der häufigste Fehler.
    fallen: [basis / nenner, basis - wert, wert + nenner, wert - nenner],
  };
};

const klammer: Erzeuger = (z) => {
  const a = z.bereich(3, 19);
  const b = z.bereich(3, 19);
  const c = z.bereich(3, 9);
  const wert = (a + b) * c;
  return {
    frage: `Wie viel ist (${a} + ${b}) × ${c}?`,
    ausdruck: `(${a} + ${b}) * ${c}`,
    wert,
    weg: `Erst die Klammer: ${a} + ${b} = ${a + b}, dann × ${c} = ${wert}`,
    fallen: [a + b * c, wert + 10, wert - 10, wert + c],
  };
};

/* --- Schwere 4: zweistellig mal zweistellig, Wurzeln, Potenzen ---------------------------------- */

const malZweiMalZwei: Erzeuger = (z) => {
  const a = z.bereich(12, 29);
  const b = z.bereich(12, 29);
  const wert = a * b;
  const zehner = Math.floor(b / 10) * 10;
  const einer = b - zehner;
  return {
    frage: `Wie viel ist ${a} × ${b}?`,
    ausdruck: `${a} * ${b}`,
    wert,
    weg: `${a} × ${b} = ${a} × ${zehner} + ${a} × ${einer} = ${a * zehner} + ${a * einer} = ${wert}`,
    fallen: [wert + 10, wert - 10, wert + a, wert - a, wert + b, wert - b, wert + 20],
  };
};

const wurzel: Erzeuger = (z) => {
  const n = z.bereich(11, 25);
  return {
    frage: `Was ist die Quadratwurzel aus ${formatiere(n * n)}?`,
    ausdruck: `Math.sqrt(${n * n})`,
    wert: n,
    weg: `${n} × ${n} = ${formatiere(n * n)}, also ist die Wurzel ${n}`,
    // Die Nachbarn: knapp daneben ist der Reiz der Aufgabe.
    fallen: [n + 1, n - 1, n + 2, n - 2, n + 10],
  };
};

const potenz: Erzeuger = (z) => {
  const [basis, hoch] = z.waehlen<[number, number]>([
    [2, 7], [2, 8], [2, 9], [2, 10], [3, 4], [3, 5], [4, 4], [4, 5], [5, 3], [5, 4], [6, 3], [7, 3], [9, 3],
  ]);
  const wert = basis ** hoch;
  const faktoren = Array(hoch).fill(basis).join(' × ');
  return {
    frage: `Wie viel ist ${basis}${HOCH[hoch]}?`,
    ausdruck: `${basis} ** ${hoch}`,
    wert,
    weg: `${basis}${HOCH[hoch]} = ${faktoren} = ${formatiere(wert)}`,
    // Mal statt hoch gerechnet, und eine Potenz zu wenig oder zu viel.
    fallen: [basis * hoch, basis ** (hoch - 1), basis ** (hoch + 1), wert + 10, wert - 10],
  };
};

const prozentSchwerer: Erzeuger = (z) => {
  const p = z.waehlen([5, 15, 30, 45, 60, 70]);
  const basis = z.waehlen([40, 60, 80, 120, 160, 200, 240, 300, 400, 500]);
  const wert = (p * basis) / 100;
  return {
    frage: `Wie viel sind ${p} % von ${basis}?`,
    ausdruck: `${p} * ${basis} / 100`,
    wert,
    weg: `${p} % von ${basis} = ${basis} × ${p} : 100 = ${wert}`,
    fallen: [wert * 10, wert / 10, wert + 10, wert - 10, basis - wert].filter((x) => Number.isInteger(x)),
  };
};

/* --- Schwere 5: knifflig ----------------------------------------------------------------------- */

const malSchwer: Erzeuger = (z) => {
  const a = z.bereich(31, 59);
  const b = z.bereich(21, 49);
  const wert = a * b;
  const zehner = Math.floor(b / 10) * 10;
  const einer = b - zehner;
  return {
    frage: `Wie viel ist ${a} × ${b}?`,
    ausdruck: `${a} * ${b}`,
    wert,
    weg: `${a} × ${b} = ${a} × ${zehner} + ${a} × ${einer} = ${formatiere(a * zehner)} + ${a * einer} = ${formatiere(wert)}`,
    fallen: [wert + 10, wert - 10, wert + a, wert - a, wert + b, wert - b, wert + 100],
  };
};

const quadrat: Erzeuger = (z) => {
  const n = z.bereich(21, 39);
  const wert = n * n;
  return {
    frage: `Wie viel ist ${n}²?`,
    ausdruck: `${n} ** 2`,
    wert,
    weg: `${n}² = ${n} × ${n} = ${formatiere(wert)}`,
    fallen: [wert + n, wert - n, wert + 10, wert - 10, n * 2, wert + 2 * n],
  };
};

const mischung: Erzeuger = (z) => {
  // Das Ergebnis soll positiv bleiben — eine negative Antwort wäre für diese Altersstufe keine Kopfnuss, sondern ein Rätsel.
  for (;;) {
    const a = z.bereich(6, 15);
    const b = z.bereich(6, 15);
    const c = z.bereich(3, 9);
    const d = z.bereich(4, 12);
    const wert = a * b - c * d;
    if (wert < 10) continue;
    return {
      frage: `Wie viel ist ${a} × ${b} ${MINUS} ${c} × ${d}?`,
      ausdruck: `${a} * ${b} - ${c} * ${d}`,
      wert,
      weg: `Punkt vor Strich: ${a} × ${b} = ${a * b} und ${c} × ${d} = ${c * d}, also ${a * b} ${MINUS} ${c * d} = ${wert}`,
      // Von links nach rechts: erst (a×b − c), dann × d.
      fallen: [(a * b - c) * d, wert + 10, wert - 10, a * b + c * d],
    };
  }
};

const wurzelPlusQuadrat: Erzeuger = (z) => {
  const n = z.bereich(12, 25);
  const m = z.bereich(6, 12);
  const wert = n + m * m;
  return {
    frage: `Wie viel ist √${formatiere(n * n)} + ${m}²?`,
    ausdruck: `Math.sqrt(${n * n}) + ${m} ** 2`,
    wert,
    weg: `√${formatiere(n * n)} = ${n} und ${m}² = ${m * m}, zusammen ${wert}`,
    fallen: [n + m * 2, n * n + m, wert + 10, wert - 10, n * m],
  };
};

const prozentKnifflig: Erzeuger = (z) => {
  // Nur Kombinationen mit ganzzahligem Ergebnis.
  for (;;) {
    const p = z.waehlen([12, 18, 35, 45, 85]);
    const basis = z.waehlen([20, 40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 500]);
    const wert = (p * basis) / 100;
    if (!Number.isInteger(wert)) continue;
    return {
      frage: `Wie viel sind ${p} % von ${basis}?`,
      ausdruck: `${p} * ${basis} / 100`,
      wert,
      weg: `10 % von ${basis} sind ${basis / 10}; ${p} % von ${basis} = ${basis} × ${p} : 100 = ${wert}`,
      fallen: [wert * 10, wert / 10, wert + 10, wert - 10, basis - wert].filter((x) => Number.isInteger(x)),
    };
  }
};

const ERZEUGER: readonly (readonly Erzeuger[])[] = [
  [plus, minus, malKlein],
  [malGross, geteilt, punktVorStrich],
  [malZweistellig, prozent, bruch, klammer],
  [malZweiMalZwei, wurzel, potenz, prozentSchwerer],
  [malSchwer, quadrat, mischung, wurzelPlusQuadrat, prozentKnifflig],
];

/** Die Aufgabe zu einer Saat und Schwere — ohne die Antworten, für die Tests. */
export function rechenaufgabe(saat: number, schwere: 1 | 2 | 3 | 4 | 5): Rechenaufgabe {
  const z = rng(saat);
  return z.waehlen(ERZEUGER[schwere - 1]!)(z);
}

/**
 * Die Kopfnuss als fertige Frage.
 *
 * Falsche Antworten sind bevorzugt die **typischen Fehler** der Aufgabe (falsche Reihenfolge, vergessener
 * Übertrag, ein Teil statt mehrerer); fehlen davon welche, kommen Nachbarwerte dazu. Alle sind ganze,
 * nicht negative Zahlen, verschieden voneinander und vom richtigen Ergebnis.
 */
export function kopfnuss(saat: number, schwere: 1 | 2 | 3 | 4 | 5): LeiterFrage {
  const aufgabe = rechenaufgabe(saat, schwere);
  const z = rng(saatAus(saat, 'antworten'));
  const { wert } = aufgabe;

  const gueltig = (x: number) => Number.isInteger(x) && x >= 0 && x !== wert;
  const falsche: number[] = [];
  const nimm = (x: number) => {
    if (gueltig(x) && !falsche.includes(x)) falsche.push(x);
  };
  // Der typischste Fehler (steht in `fallen` an erster Stelle) ist **immer** dabei — er ist der Grund, warum die
  // Aufgabe eine Kopfnuss ist. Die übrigen Plätze lost die Saat unter den anderen Fehlern und den Nachbarwerten aus.
  const typisch = aufgabe.fallen[0];
  if (typisch !== undefined) nimm(typisch);
  z.mischen(aufgabe.fallen.slice(1)).forEach(nimm);
  for (const abstand of [1, 2, 10, 5, 3, 20, 4]) {
    nimm(wert + abstand);
    nimm(wert - abstand);
  }
  const rest = falsche.slice(typisch !== undefined && falsche[0] === typisch ? 1 : 0, 6);
  const drei = z.mischen([...(typisch !== undefined && falsche[0] === typisch ? [typisch] : []), ...z.mischen(rest).slice(0, falsche[0] === typisch ? 2 : 3)]);

  const richtigPlatz = z.ganzzahl(4);
  const antworten: string[] = [];
  let k = 0;
  for (let i = 0; i < 4; i++) antworten.push(i === richtigPlatz ? formatiere(wert) : formatiere(drei[k++]!));

  return {
    kategorie: 'Kopfnuss',
    frage: aufgabe.frage,
    antworten: antworten as unknown as LeiterFrage['antworten'],
    richtig: richtigPlatz as 0 | 1 | 2 | 3,
    erklaerung: `Rechenweg: ${aufgabe.weg}.`,
    schwere,
  };
}
