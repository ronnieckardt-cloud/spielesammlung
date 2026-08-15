import { describe, expect, it } from 'vitest';
import { LEVEL } from './level';
import {
  LEVEL_ANZAHL,
  VERSATZ,
  alsFeld,
  gehen,
  levelLesen,
  neuesLevel,
  neustart,
  punkteFuerZuege,
  zurueck,
} from './logik';
import type { Richtung, Zustand } from './logik';

const RICHTUNGEN: readonly Richtung[] = ['oben', 'unten', 'links', 'rechts'];

describe('levelLesen', () => {
  it('liest Wände, Ziele, Kisten und Spieler heraus', () => {
    const { brett, spieler, kisten } = levelLesen(['####', '#@$#', '#. #', '####']);
    expect(brett.breite).toBe(4);
    expect(brett.hoehe).toBe(4);
    expect(spieler).toEqual({ x: 1, y: 1 });
    expect(kisten).toEqual([alsFeld({ x: 2, y: 1 }, 4)]);
    expect(brett.ziel[alsFeld({ x: 1, y: 2 }, 4)]).toBe(true);
  });

  it('versteht eine Kiste, die schon auf ihrem Ziel steht', () => {
    const { brett, kisten } = levelLesen(['###', '#*#', '###']);
    expect(kisten).toHaveLength(1);
    expect(brett.ziel[kisten[0]!]).toBe(true);
  });

  it('füllt kürzere Zeilen mit Boden auf', () => {
    const { brett } = levelLesen(['#####', '#@', '#####']);
    expect(brett.breite).toBe(5);
    expect(brett.wand).toHaveLength(15);
  });
});

describe('Die Level selbst', () => {
  it('hat überall genau einen Spieler und gleich viele Kisten wie Ziele', () => {
    for (let i = 0; i < LEVEL.length; i++) {
      const zeilen = LEVEL[i]!;
      const text = zeilen.join('');
      const spieler = (text.match(/[@+]/g) ?? []).length;
      const kisten = (text.match(/[$*]/g) ?? []).length;
      const ziele = (text.match(/[.*+]/g) ?? []).length;
      expect(spieler, `Level ${i + 1}: Spielerzahl`).toBe(1);
      expect(kisten, `Level ${i + 1}: Kisten passen zu Zielen`).toBe(ziele);
      expect(kisten, `Level ${i + 1}: mindestens eine Kiste`).toBeGreaterThan(0);
    }
  });

  it('ist überall ringsum von Wänden umschlossen', () => {
    // Ohne geschlossenen Rand könnte der Spieler aus dem Brett laufen —
    // die Regeln fangen das zwar ab, aber es wäre ein Baufehler.
    for (let i = 0; i < LEVEL.length; i++) {
      const { brett, spieler } = levelLesen(LEVEL[i]!);
      const { breite, hoehe, wand } = brett;
      for (let x = 0; x < breite; x++) {
        expect(wand[x], `Level ${i + 1}: obere Kante`).toBe(true);
        expect(wand[(hoehe - 1) * breite + x], `Level ${i + 1}: untere Kante`).toBe(true);
      }
      for (let y = 0; y < hoehe; y++) {
        expect(wand[y * breite], `Level ${i + 1}: linke Kante`).toBe(true);
        expect(wand[y * breite + breite - 1], `Level ${i + 1}: rechte Kante`).toBe(true);
      }
      expect(wand[alsFeld(spieler, breite)], `Level ${i + 1}: Spieler nicht in der Wand`).toBe(false);
    }
  });

  it('passt auf ein Handy', () => {
    // Mehr als zehn Felder Kantenlänge wird auf 375 Pixeln zu klein zum
    // Treffen — dann ist es kein Rätsel mehr, sondern Fingerakrobatik.
    for (const zeilen of LEVEL) {
      const { brett } = levelLesen(zeilen);
      expect(brett.breite).toBeLessThanOrEqual(10);
      expect(brett.hoehe).toBeLessThanOrEqual(10);
    }
  });
});

describe('gehen', () => {
  const einfach = () => neuesLevel(1);

  it('läuft auf ein freies Feld', () => {
    const z = gehen(einfach(), 'links');
    expect(z.spieler.x).toBe(2);
    expect(z.zuege).toBe(1);
  });

  it('schiebt eine Kiste, wenn dahinter Platz ist', () => {
    const start = einfach();
    const z = gehen(start, 'unten');
    expect(z.kisten).not.toEqual(start.kisten);
    expect(z.geloest).toBe(true);
  });

  it('bleibt an der Wand stehen und zählt das nicht als Zug', () => {
    let z = neuesLevel(1);
    // Nach oben ist bei Level 1 nach einem Schritt die Wand.
    z = gehen(z, 'oben');
    const anDerWand = gehen(z, 'oben');
    expect(anDerWand).toBe(z);
  });

  it('schiebt keine zwei Kisten hintereinander', () => {
    // Zwei Kisten in einer Reihe, Spieler davor: Das darf nicht gehen.
    const zeilen = ['#######', '#     #', '#@$$  #', '#  .. #', '#######'];
    const { brett, spieler, kisten } = levelLesen(zeilen);
    const z: Zustand = {
      level: 1,
      brett,
      spieler,
      kisten,
      zuege: 0,
      verlauf: [],
      geloest: false,
    };
    expect(gehen(z, 'rechts')).toBe(z);
  });

  it('schiebt keine Kiste in eine Wand', () => {
    const zeilen = ['#####', '#@$##', '#    #', '#  .#', '#####'];
    const { brett, spieler, kisten } = levelLesen(zeilen);
    const z: Zustand = { level: 1, brett, spieler, kisten, zuege: 0, verlauf: [], geloest: false };
    expect(gehen(z, 'rechts')).toBe(z);
  });

  it('rührt ein gelöstes Level nicht mehr an', () => {
    const geloest = gehen(neuesLevel(1), 'unten');
    expect(geloest.geloest).toBe(true);
    for (const r of RICHTUNGEN) expect(gehen(geloest, r)).toBe(geloest);
  });
});

describe('zurueck', () => {
  it('macht einen Schritt rückgängig', () => {
    const start = neuesLevel(3);
    const nachher = gehen(start, 'oben');
    const wieder = zurueck(nachher);
    expect(wieder.spieler).toEqual(start.spieler);
    expect(wieder.kisten).toEqual(start.kisten);
  });

  it('holt auch eine geschobene Kiste zurück', () => {
    // Das ist der eigentliche Sinn: Eine Kiste in der Ecke ist sonst für
    // immer verloren.
    const start = neuesLevel(1);
    const geschoben = gehen(start, 'unten');
    const wieder = zurueck(geschoben);
    expect(wieder.kisten).toEqual(start.kisten);
    expect(wieder.geloest).toBe(false);
  });

  it('zählt als eigener Zug', () => {
    // Sonst könnte man beliebig lange probieren und trotzdem die volle
    // Punktzahl abräumen.
    const z = zurueck(gehen(neuesLevel(3), 'oben'));
    expect(z.zuege).toBe(2);
  });

  it('tut am Anfang nichts', () => {
    const start = neuesLevel(1);
    expect(zurueck(start)).toBe(start);
  });
});

describe('neustart', () => {
  it('stellt alles zurück, lässt aber den Zug-Zähler stehen', () => {
    const start = neuesLevel(3);
    const gelaufen = gehen(gehen(start, 'oben'), 'links');
    const frisch = neustart(gelaufen);
    expect(frisch.spieler).toEqual(start.spieler);
    expect(frisch.kisten).toEqual(start.kisten);
    expect(frisch.verlauf).toHaveLength(0);
    expect(frisch.zuege).toBe(gelaufen.zuege);
  });
});

describe('punkteFuerZuege', () => {
  it('belohnt kurze Lösungen und höhere Level', () => {
    expect(punkteFuerZuege(1, 10)).toBeGreaterThan(punkteFuerZuege(1, 40));
    expect(punkteFuerZuege(9, 20)).toBeGreaterThan(punkteFuerZuege(1, 20));
  });

  it('fällt nie unter den Mindestwert', () => {
    expect(punkteFuerZuege(1, 5000)).toBe(50);
  });
});

/**
 * Der wichtigste Test des ganzen Spiels.
 *
 * Bei einem Schiebe-Rätsel ist „unlösbar" kein theoretisches Risiko: Eine
 * Kiste einen Schritt zu weit links gesetzt, und das Level ist Müll — man
 * merkt es beim Selbertesten aber erst nach zwanzig Minuten Grübeln, und
 * ein Kind schriebe den Fehler sich selbst zu.
 *
 * Deshalb sucht hier eine Breitensuche für **jedes** Level wirklich eine
 * Lösung. Ein Zustand ist Spielerposition plus Kistenpositionen; das reicht
 * bei diesen Größen locker.
 */
describe('Jedes Level ist lösbar', () => {
  /**
   * Sucht die kürzeste Lösung und gibt die Zahl der **Schübe** zurück
   * (nicht der Schritte), oder null.
   *
   * Gesucht wird über Schübe, nicht über Einzelschritte — und das ist keine
   * Feinheit, sondern der Unterschied zwischen „läuft" und „läuft nicht":
   * Über Schritte kam der Suchlauf bei vier Kisten auf über eine Million
   * Zustände und gab vorzeitig auf, obwohl das Level lösbar war. Über
   * Schübe sind es ein paar tausend.
   *
   * Der Kniff dabei: Wo genau der Spieler steht, ist egal — es zählt nur,
   * **welchen Bereich** er erreichen kann. Zwei Stände mit denselben Kisten
   * und demselben erreichbaren Bereich sind dieselbe Lage. Als Kennzeichen
   * dient deshalb das kleinste erreichbare Feld.
   */
  function loesen(zeilen: readonly string[], grenze = 300_000): number | null {
    const { brett, spieler, kisten } = levelLesen(zeilen);
    const { breite, hoehe, wand, ziel } = brett;

    /** Alle Felder, die der Spieler von `start` aus erreicht. */
    function erreichbar(start: number, besetzt: ReadonlySet<number>): Set<number> {
      const gesehen = new Set<number>([start]);
      const rand = [start];
      while (rand.length) {
        const f = rand.pop()!;
        const x = f % breite;
        const y = Math.floor(f / breite);
        for (const r of RICHTUNGEN) {
          const d = VERSATZ[r];
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx < 0 || ny < 0 || nx >= breite || ny >= hoehe) continue;
          const nf = ny * breite + nx;
          if (wand[nf] || besetzt.has(nf) || gesehen.has(nf)) continue;
          gesehen.add(nf);
          rand.push(nf);
        }
      }
      return gesehen;
    }

    const fertig = (k: readonly number[]) => k.every((f) => ziel[f]);
    if (fertig(kisten)) return 0;

    const kennzeichen = (bereich: Set<number>, k: readonly number[]) =>
      `${Math.min(...bereich)}|${k.join(',')}`;

    const start = { kisten: [...kisten], von: alsFeld(spieler, breite) };
    let rand: typeof start[] = [start];
    const gesehen = new Set<string>([
      kennzeichen(erreichbar(start.von, new Set(kisten)), kisten),
    ]);
    let schuebe = 0;

    while (rand.length > 0 && gesehen.size < grenze) {
      schuebe += 1;
      const naechste: typeof rand = [];
      for (const stand of rand) {
        const besetzt = new Set(stand.kisten);
        const bereich = erreichbar(stand.von, besetzt);

        for (const kiste of stand.kisten) {
          const kx = kiste % breite;
          const ky = Math.floor(kiste / breite);
          for (const r of RICHTUNGEN) {
            const d = VERSATZ[r];
            // Der Spieler muss auf der Gegenseite stehen können …
            const sx = kx - d.x;
            const sy = ky - d.y;
            if (sx < 0 || sy < 0 || sx >= breite || sy >= hoehe) continue;
            const sf = sy * breite + sx;
            if (!bereich.has(sf)) continue;
            // … und hinter der Kiste muss Platz sein.
            const zx = kx + d.x;
            const zy = ky + d.y;
            if (zx < 0 || zy < 0 || zx >= breite || zy >= hoehe) continue;
            const zf = zy * breite + zx;
            if (wand[zf] || besetzt.has(zf)) continue;

            const neu = stand.kisten
              .filter((k) => k !== kiste)
              .concat(zf)
              .sort((a, b) => a - b);
            if (fertig(neu)) return schuebe;

            const s = kennzeichen(erreichbar(kiste, new Set(neu)), neu);
            if (gesehen.has(s)) continue;
            gesehen.add(s);
            naechste.push({ kisten: neu, von: kiste });
          }
        }
      }
      rand = naechste;
    }
    return null;
  }

  // Einmal rechnen, zweimal auswerten. Vorher lief der Suchlauf für jeden
  // der beiden Tests komplett durch und das Prüfen des ganzen Projekts
  // dauerte plötzlich zehn Sekunden statt einer.
  const SCHUEBE = LEVEL.map((zeilen) => loesen(zeilen));

  it('findet für alle Level eine Lösung', () => {
    for (let i = 0; i < LEVEL.length; i++) {
      expect(SCHUEBE[i], `Level ${i + 1} ist nicht lösbar`).not.toBeNull();
      expect(SCHUEBE[i], `Level ${i + 1} braucht mindestens einen Schub`).toBeGreaterThan(0);
    }
  });

  it('wird von vorn nach hinten nicht einfacher', () => {
    // Kein strenger Anstieg — mal ist ein späteres Level kürzer, aber
    // kniffliger. Nur der Trend muss stimmen: Die zweite Hälfte darf im
    // Schnitt nicht weniger Schübe brauchen als die erste.
    const werte = SCHUEBE.map((s) => s ?? 0);
    const mitte = Math.floor(werte.length / 2);
    const schnitt = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(schnitt(werte.slice(mitte))).toBeGreaterThan(schnitt(werte.slice(0, mitte)));
  });

  it('bietet genug Level für eine Weile', () => {
    expect(LEVEL_ANZAHL).toBeGreaterThanOrEqual(10);
  });
});
