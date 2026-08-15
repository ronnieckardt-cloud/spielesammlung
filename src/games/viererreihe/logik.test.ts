import { describe, it, expect } from 'vitest';
import {
  SPALTEN,
  ZEILEN,
  einwerfen,
  einwurfZeile,
  feldMitStein,
  feldVoll,
  gewinnlinieAb,
  leeresFeld,
  moeglicheSpalten,
  neuesSpiel,
  punkteFuer,
} from './logik';
import type { Feld, Spieler, Zelle } from './logik';
import { besterZug, bewerten } from './gegner';

/**
 * Baut ein Feld aus Textzeilen — oben ist oben.
 * `.` leer, `M` Mensch (0), `C` Computer (1).
 */
function feldAus(...zeilen: string[]): Feld {
  expect(zeilen).toHaveLength(ZEILEN);
  return zeilen.map((zeile) => {
    expect(zeile).toHaveLength(SPALTEN);
    return [...zeile].map<Zelle>((z) => (z === 'M' ? 0 : z === 'C' ? 1 : null));
  });
}

const LEER = ['.......', '.......', '.......', '.......', '.......', '.......'] as const;

describe('einwurfZeile / moeglicheSpalten', () => {
  it('lässt einen Stein bis ganz unten fallen', () => {
    expect(einwurfZeile(leeresFeld(), 0)).toBe(ZEILEN - 1);
  });

  it('stapelt auf dem vorhandenen Stein', () => {
    const feld = feldMitStein(leeresFeld(), 3, ZEILEN - 1, 0);
    expect(einwurfZeile(feld, 3)).toBe(ZEILEN - 2);
  });

  it('meldet eine volle Spalte als nicht bespielbar', () => {
    let feld = leeresFeld();
    for (let y = 0; y < ZEILEN; y++) feld = feldMitStein(feld, 2, y, 0);
    expect(einwurfZeile(feld, 2)).toBeNull();
    expect(moeglicheSpalten(feld)).not.toContain(2);
    expect(moeglicheSpalten(feld)).toHaveLength(SPALTEN - 1);
  });

  it('weist Spalten außerhalb des Bretts ab', () => {
    expect(einwurfZeile(leeresFeld(), -1)).toBeNull();
    expect(einwurfZeile(leeresFeld(), SPALTEN)).toBeNull();
  });
});

describe('gewinnlinieAb', () => {
  it('erkennt waagerecht', () => {
    const feld = feldAus(...LEER.slice(0, 5), 'MMMM...');
    expect(gewinnlinieAb(feld, 3, 5)).toHaveLength(4);
  });

  it('erkennt senkrecht', () => {
    const feld = feldAus('.......', '.......', '..C....', '..C....', '..C....', '..C....');
    expect(gewinnlinieAb(feld, 2, 2)).toHaveLength(4);
  });

  it('erkennt beide Diagonalen', () => {
    const ab = feldAus('.......', '.......', 'M......', '.M.....', '..M....', '...M...');
    expect(gewinnlinieAb(ab, 0, 2)).toHaveLength(4);

    const auf = feldAus('.......', '.......', '...C...', '..C....', '.C.....', 'C......');
    expect(gewinnlinieAb(auf, 3, 2)).toHaveLength(4);
  });

  it('zählt in beide Richtungen, nicht nur nach vorn', () => {
    // Der zuletzt gelegte Stein steht in der Mitte der Reihe.
    const feld = feldAus(...LEER.slice(0, 5), '.MMMM..');
    expect(gewinnlinieAb(feld, 2, 5)).toHaveLength(4);
  });

  it('lässt sich von einer fremden Farbe nicht täuschen', () => {
    const feld = feldAus(...LEER.slice(0, 5), 'MMCM...');
    expect(gewinnlinieAb(feld, 3, 5)).toBeNull();
    expect(gewinnlinieAb(feld, 0, 5)).toBeNull();
  });

  it('meldet auf einem leeren Feld nichts', () => {
    expect(gewinnlinieAb(leeresFeld(), 3, 5)).toBeNull();
  });
});

describe('einwerfen', () => {
  it('wechselt den Zug', () => {
    const z = einwerfen(neuesSpiel('mittel'), 3);
    expect(z.amZug).toBe(1);
    expect(z.letzter).toEqual({ x: 3, y: ZEILEN - 1 });
  });

  it('lässt einen unmöglichen Zug wirkungslos', () => {
    let z = neuesSpiel('mittel');
    for (let i = 0; i < ZEILEN; i++) z = { ...einwerfen(z, 0), amZug: z.amZug };
    expect(einwerfen(z, 0)).toBe(z);
    expect(einwerfen(z, 99)).toBe(z);
  });

  it('beendet die Partie beim Vierer und merkt sich die Linie', () => {
    let z = { ...neuesSpiel('mittel'), feld: feldAus(...LEER.slice(0, 5), 'MMM....') };
    z = einwerfen(z, 3);
    expect(z.vorbei).toBe(true);
    expect(z.gewinner).toBe(0);
    expect(z.gewinnlinie).toHaveLength(4);
    expect(z.punkte).toBeGreaterThan(0);
  });

  it('gibt bei einer Niederlage null Punkte', () => {
    let z = {
      ...neuesSpiel('schwer'),
      amZug: 1 as Spieler,
      feld: feldAus(...LEER.slice(0, 5), 'CCC....'),
    };
    z = einwerfen(z, 3);
    expect(z.gewinner).toBe(1);
    expect(z.punkte).toBe(0);
  });

  it('nimmt nach dem Ende keine Züge mehr an', () => {
    let z = { ...neuesSpiel('mittel'), feld: feldAus(...LEER.slice(0, 5), 'MMM....') };
    z = einwerfen(z, 3);
    expect(einwerfen(z, 5)).toBe(z);
  });

  it('erkennt ein volles Brett als unentschieden', () => {
    // Muster, das nirgends vier gleiche in einer Reihe ergibt.
    const muster = ['MMCCMMC', 'MMCCMMC', 'CCMMCCM', 'CCMMCCM', 'MMCCMMC', 'MMCCMMC'];
    const fastVoll: Feld = feldAus(...muster).map((zeile, y) =>
      y === 0 ? zeile.map<Zelle>((z, x) => (x === 6 ? null : z)) : zeile,
    );
    let z = { ...neuesSpiel('mittel'), feld: fastVoll };
    z = einwerfen(z, 6);
    expect(feldVoll(z.feld)).toBe(true);
    expect(z.unentschieden).toBe(true);
    expect(z.gewinner).toBeNull();
    expect(z.punkte).toBeGreaterThan(0); // ein Remis ist nicht nichts
  });
});

describe('Punkte', () => {
  it('belohnt die schwerere Stufe deutlich stärker', () => {
    // Sonst lohnt es sich, immer auf „leicht" zu spielen.
    expect(punkteFuer('schwer', 10, 'gewonnen')).toBeGreaterThan(punkteFuer('mittel', 10, 'gewonnen'));
    expect(punkteFuer('mittel', 10, 'gewonnen')).toBeGreaterThan(punkteFuer('leicht', 10, 'gewonnen'));
  });

  it('belohnt den schnelleren Sieg', () => {
    expect(punkteFuer('mittel', 4, 'gewonnen')).toBeGreaterThan(punkteFuer('mittel', 15, 'gewonnen'));
  });

  it('gibt für eine Niederlage nichts und fürs Remis etwas', () => {
    expect(punkteFuer('schwer', 20, 'verloren')).toBe(0);
    expect(punkteFuer('schwer', 20, 'unentschieden')).toBeGreaterThan(0);
    expect(punkteFuer('schwer', 20, 'unentschieden')).toBeLessThan(punkteFuer('schwer', 20, 'gewonnen'));
  });
});

describe('Gegner — Bewertung', () => {
  it('sieht eine eigene Dreierreihe als gut und die des Gegners als schlecht', () => {
    const meine = feldAus(...LEER.slice(0, 5), 'CCC....');
    const seine = feldAus(...LEER.slice(0, 5), 'MMM....');
    expect(bewerten(meine, 1)).toBeGreaterThan(0);
    expect(bewerten(seine, 1)).toBeLessThan(0);
  });

  it('gewichtet die Drohung des Gegners stärker als die eigene Chance', () => {
    // Sonst baut der Computer lieber weiter, statt zu blocken — und
    // verliert gegen jeden, der stur drei nebeneinander legt.
    const meine = feldAus(...LEER.slice(0, 5), 'CCC....');
    const seine = feldAus(...LEER.slice(0, 5), 'MMM....');
    expect(Math.abs(bewerten(seine, 1))).toBeGreaterThan(bewerten(meine, 1));
  });

  it('bewertet die Mitte höher als den Rand', () => {
    const mitte = feldAus(...LEER.slice(0, 5), '...C...');
    const rand = feldAus(...LEER.slice(0, 5), 'C......');
    expect(bewerten(mitte, 1)).toBeGreaterThan(bewerten(rand, 1));
  });
});

describe('Gegner — Zugwahl', () => {
  const STUFEN = ['leicht', 'mittel', 'schwer'] as const;

  it.each(STUFEN)('nimmt auf Stufe %s den eigenen Sieg mit', (stufe) => {
    const feld = feldAus(...LEER.slice(0, 5), 'CCC....');
    expect(besterZug(feld, 1, stufe, 7)).toBe(3);
  });

  it.each(STUFEN)('blockt auf Stufe %s die Vierer-Drohung des Menschen', (stufe) => {
    const feld = feldAus(...LEER.slice(0, 5), 'MMM....');
    expect(besterZug(feld, 1, stufe, 7)).toBe(3);
  });

  it('zieht den eigenen Sieg dem Blocken vor', () => {
    // Beides liegt an: Wer am Zug ist, gewinnt — also gewinnen, nicht blocken.
    const feld = feldAus('.......', '.......', '.......', '.......', 'MMM....', 'CCC....');
    expect(besterZug(feld, 1, 'schwer', 7)).toBe(3);
  });

  it('spielt auf einem leeren Feld in die Mitte', () => {
    expect(besterZug(leeresFeld(), 1, 'schwer', 1)).toBe(3);
  });

  it('meldet auf vollem Feld keinen Zug', () => {
    let feld = leeresFeld();
    for (let x = 0; x < SPALTEN; x++) {
      for (let y = 0; y < ZEILEN; y++) feld = feldMitStein(feld, x, y, x % 2 === 0 ? 0 : 1);
    }
    expect(besterZug(feld, 1, 'mittel', 1)).toBeNull();
  });

  it('gibt bei gleicher Saat immer denselben Zug', () => {
    const feld = feldAus('.......', '.......', '.......', '.......', '..M....', '..MC...');
    expect(besterZug(feld, 1, 'mittel', 5)).toBe(besterZug(feld, 1, 'mittel', 5));
  });

  it('vermeidet den Zug, der dem Menschen sofort den Sieg schenkt', () => {
    // Legt der Computer in Spalte 3, kommt der Mensch darüber und hat vier
    // diagonal. Die schwere Stufe muss das sehen.
    const feld = feldAus(
      '.......',
      '.......',
      '.......',
      '...M...',
      '..MC...',
      '.MCC...',
    );
    const zug = besterZug(feld, 1, 'schwer', 3);
    expect(zug).not.toBe(3);
  });

  it('schlägt die leichte Stufe, wenn die schwere gegen sie spielt', () => {
    // Der eigentliche Beweis, dass Suchtiefe etwas bringt: Beide spielen
    // eine ganze Partie gegeneinander, die schwere Stufe fängt an.
    let feld = leeresFeld();
    let amZug: Spieler = 1;
    let sieger: Spieler | null = null;
    for (let zug = 0; zug < SPALTEN * ZEILEN; zug++) {
      const stufe = amZug === 1 ? 'schwer' : 'leicht';
      const x = besterZug(feld, amZug, stufe, zug + 1);
      if (x === null) break;
      const y = einwurfZeile(feld, x)!;
      feld = feldMitStein(feld, x, y, amZug);
      if (gewinnlinieAb(feld, x, y)) {
        sieger = amZug;
        break;
      }
      amZug = amZug === 0 ? 1 : 0;
    }
    expect(sieger).toBe(1);
  });
});
