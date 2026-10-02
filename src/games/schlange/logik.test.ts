import { describe, it, expect } from 'vitest';
import {
  BREITE,
  EXTRA_DAUER_SCHRITTE,
  EXTRA_JE_FUTTER,
  FUTTER_JE_ETAPPE,
  HOEHE,
  KOMBO_MAX,
  KOMBO_PUFFER,
  MAX_PUFFER,
  MAX_START_LAENGE,
  MITTE_X,
  MITTE_Y,
  PUNKTE_GOLD,
  PUNKTE_HILFE,
  PUNKTE_JE_FUTTER,
  SCHERE_GLIEDER,
  START_LAENGE,
  TAKT_MIN_S,
  TAKT_START_S,
  TAKT_STUFE_S,
  ZEITLUPE_FAKTOR,
  ZEITLUPE_SCHRITTE,
  arenaGueltig,
  bildGeaendert,
  etappenBonus,
  etappenPlan,
  feldWechseln,
  felsenErzeugen,
  freiesFeld,
  naechsteEtappe,
  neuesSpiel,
  richtungWaehlen,
  schrittZiel,
  startKorridor,
  startLaengeNach,
  taktStart,
  wegLaenge,
  wirksamerTakt,
  zeitFortschritt,
} from './logik';
import type { Punkt, Richtung, Zustand } from './logik';

const RICHTUNGEN: Richtung[] = ['hoch', 'runter', 'links', 'rechts'];
const GEGEN: Record<Richtung, Richtung> = {
  hoch: 'runter',
  runter: 'hoch',
  links: 'rechts',
  rechts: 'links',
};
const k = (p: Punkt) => `${p.x},${p.y}`;

/**
 * Baut einen Zustand ohne Felsen, mit offenem Rand und weit entferntem Apfel. Die Schlange kommt
 * aus `neuesSpiel`: Kopf bei (8, 8), Schwanz bei (6, 8), Blick nach rechts.
 */
function stand(teile: Partial<Zustand> = {}): Zustand {
  const basis = neuesSpiel(1);
  return {
    ...basis,
    felsen: [],
    rand: 'offen',
    futter: { x: BREITE - 1, y: HOEHE - 1 },
    extra: null,
    ...teile,
  };
}

describe('neuesSpiel', () => {
  it('legt die Schlange in die mittlere Reihe, Kopf in der Mitte, Blick nach rechts', () => {
    const z = neuesSpiel(1);
    expect(z.schlange).toHaveLength(START_LAENGE);
    expect(z.schlange[0]).toEqual({ x: MITTE_X, y: MITTE_Y });
    expect(z.schlange.every((p) => p.y === MITTE_Y)).toBe(true);
    expect(z.richtung).toBe('rechts');
    expect(z.vorbei).toBe(false);
    expect(z.punkte).toBe(0);
    expect(z.taktS).toBe(TAKT_START_S);
  });

  it('beginnt mit einer freien, offenen Arena', () => {
    const z = neuesSpiel(1);
    expect(z.etappe).toBe(1);
    expect(z.felsen).toHaveLength(0);
    expect(z.rand).toBe('offen');
  });

  it('legt den Apfel weder auf die Schlange noch in ihre unmittelbare Nähe', () => {
    for (let saat = 0; saat < 60; saat++) {
      const z = neuesSpiel(saat);
      const kopf = z.schlange[0]!;
      const f = z.futter!;
      expect(z.schlange.some((p) => p.x === f.x && p.y === f.y)).toBe(false);
      const dx = Math.min(Math.abs(f.x - kopf.x), BREITE - Math.abs(f.x - kopf.x));
      const dy = Math.min(Math.abs(f.y - kopf.y), HOEHE - Math.abs(f.y - kopf.y));
      expect(dx + dy).toBeGreaterThan(2);
    }
  });

  it('gleiche Saat ergibt denselben Anfang', () => {
    expect(neuesSpiel(77)).toEqual(neuesSpiel(77));
  });

  it('gibt dem ersten Apfel ein Zeitfenster, das länger ist als der Weg dorthin', () => {
    const z = neuesSpiel(5);
    const weg = wegLaenge(z.felsen, z.rand, z.schlange[0]!, z.futter!)!;
    expect(z.komboRest).toBe(weg + KOMBO_PUFFER);
  });
});

describe('etappenPlan', () => {
  it('beginnt leer und offen', () => {
    expect(etappenPlan(1)).toEqual({ rand: 'offen', felsen: 0 });
  });

  it('wechselt ab der dritten Etappe zwischen Mauer und offenem Rand', () => {
    expect(etappenPlan(2).rand).toBe('offen');
    expect(etappenPlan(3).rand).toBe('mauer');
    expect(etappenPlan(4).rand).toBe('offen');
    expect(etappenPlan(5).rand).toBe('mauer');
    expect(etappenPlan(20).rand).toBe('offen');
    expect(etappenPlan(21).rand).toBe('mauer');
  });

  it('wird nie leichter als die Etappe davor derselben Art und ist gedeckelt', () => {
    for (let n = 2; n < 40; n++) {
      const jetzt = etappenPlan(n);
      const davor = etappenPlan(n - 2);
      if (n - 2 >= 2 && davor.rand === jetzt.rand) {
        expect(jetzt.felsen).toBeGreaterThanOrEqual(davor.felsen);
      }
      expect(jetzt.felsen).toBeLessThanOrEqual(16);
    }
  });

  it('gibt Mauer-Etappen weniger Felsen — der Rand ist dort schon Hindernis genug', () => {
    expect(etappenPlan(5).felsen).toBeLessThan(etappenPlan(6).felsen);
  });
});

describe('arenaGueltig', () => {
  it('lässt eine leere Arena gelten, offen wie mit Mauer', () => {
    expect(arenaGueltig([], 'offen')).toBe(true);
    expect(arenaGueltig([], 'mauer')).toBe(true);
  });

  it('verwirft eine Arena mit einer Sackgasse', () => {
    // Die Ecke (0,0) hätte nur noch einen Ausgang — in einer Mauer-Arena ein Loch ohne Rückweg.
    expect(arenaGueltig([{ x: 1, y: 0 }], 'mauer')).toBe(false);
    // Im offenen Feld hat dieselbe Ecke noch den Weg über den Rand.
    expect(arenaGueltig([{ x: 1, y: 0 }], 'offen')).toBe(true);
  });

  it('verwirft eine Arena, die in zwei Teile zerfällt', () => {
    const wand: Punkt[] = [];
    for (let y = 0; y < HOEHE; y++) wand.push({ x: 4, y });
    expect(arenaGueltig(wand, 'mauer')).toBe(false);
  });

  it('verwirft einen Felsen auf dem Startfeld', () => {
    expect(arenaGueltig([{ x: MITTE_X, y: MITTE_Y }], 'offen')).toBe(false);
  });
});

describe('felsenErzeugen', () => {
  it('liefert für jede Etappe und jede Saat eine befahrbare Arena', () => {
    for (let etappe = 1; etappe <= 30; etappe++) {
      for (let saat = 0; saat < 40; saat++) {
        const a = felsenErzeugen(etappe, saat * 7919 + etappe);
        expect(arenaGueltig(a.felsen, a.rand)).toBe(true);
      }
    }
  });

  it('lässt die Startreihe frei', () => {
    const frei = new Set(startKorridor().map(k));
    for (let etappe = 2; etappe <= 20; etappe++) {
      for (let saat = 0; saat < 25; saat++) {
        const a = felsenErzeugen(etappe, saat + 1000);
        expect(a.felsen.some((p) => frei.has(k(p)))).toBe(false);
      }
    }
  });

  it('erreicht die geplante Felsenzahl fast immer', () => {
    // Bleibt der Erzeuger deutlich darunter, hat jemand die Regeln so verschärft, dass er kaum noch
    // etwas platzieren kann — dann sähen die Etappen alle gleich leer aus.
    for (let etappe = 2; etappe <= 20; etappe++) {
      for (let saat = 0; saat < 25; saat++) {
        const a = felsenErzeugen(etappe, saat + 5);
        expect(a.felsen.length).toBeGreaterThanOrEqual(etappenPlan(etappe).felsen - 2);
        expect(a.felsen.length).toBeLessThanOrEqual(etappenPlan(etappe).felsen);
      }
    }
  });

  it('legt keine zwei Felsen auf dasselbe Feld', () => {
    for (let saat = 0; saat < 40; saat++) {
      const a = felsenErzeugen(10, saat);
      expect(new Set(a.felsen.map(k)).size).toBe(a.felsen.length);
    }
  });

  it('ergibt für dieselbe Saat dieselbe Arena', () => {
    expect(felsenErzeugen(8, 123)).toEqual(felsenErzeugen(8, 123));
  });

  it('ergibt für verschiedene Saaten verschiedene Arenen', () => {
    const arenen = new Set<string>();
    for (let saat = 0; saat < 20; saat++) {
      arenen.add(
        felsenErzeugen(8, saat)
          .felsen.map(k)
          .sort()
          .join('|'),
      );
    }
    expect(arenen.size).toBeGreaterThan(15);
  });
});

describe('schrittZiel', () => {
  it('läuft im offenen Feld am Rand auf der anderen Seite weiter', () => {
    expect(schrittZiel({ x: BREITE - 1, y: 3 }, 'rechts', 'offen')).toEqual({ x: 0, y: 3 });
    expect(schrittZiel({ x: 3, y: 0 }, 'hoch', 'offen')).toEqual({ x: 3, y: HOEHE - 1 });
  });

  it('meldet bei einer Mauer, dass es dort nicht weitergeht', () => {
    expect(schrittZiel({ x: BREITE - 1, y: 3 }, 'rechts', 'mauer')).toBeNull();
    expect(schrittZiel({ x: 0, y: 3 }, 'links', 'mauer')).toBeNull();
    expect(schrittZiel({ x: 3, y: 3 }, 'rechts', 'mauer')).toEqual({ x: 4, y: 3 });
  });
});

describe('wegLaenge', () => {
  it('zählt die Schritte auf freier Fläche', () => {
    expect(wegLaenge([], 'mauer', { x: 0, y: 0 }, { x: 3, y: 2 })).toBe(5);
  });

  it('nimmt im offenen Feld die Abkürzung über den Rand', () => {
    expect(wegLaenge([], 'offen', { x: 0, y: 0 }, { x: BREITE - 1, y: 0 })).toBe(1);
    expect(wegLaenge([], 'mauer', { x: 0, y: 0 }, { x: BREITE - 1, y: 0 })).toBe(BREITE - 1);
  });

  it('geht um Felsen herum', () => {
    const felsen = [{ x: 1, y: 0 }, { x: 1, y: 1 }];
    expect(wegLaenge(felsen, 'mauer', { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(6);
  });

  it('meldet null, wenn es keinen Weg gibt', () => {
    const wand: Punkt[] = [];
    for (let y = 0; y < HOEHE; y++) wand.push({ x: 4, y });
    expect(wegLaenge(wand, 'mauer', { x: 0, y: 0 }, { x: 8, y: 0 })).toBeNull();
  });
});

describe('freiesFeld', () => {
  it('meidet belegte Felder', () => {
    const belegt: Punkt[] = [];
    for (let x = 0; x < BREITE; x++) for (let y = 0; y < HOEHE; y++) belegt.push({ x, y });
    const [frei] = belegt.splice(100, 1);
    const e = freiesFeld(belegt, 1);
    expect(e.feld).toEqual(frei);
  });

  it('gibt null zurück, wenn das Feld voll ist', () => {
    const belegt: Punkt[] = [];
    for (let x = 0; x < BREITE; x++) for (let y = 0; y < HOEHE; y++) belegt.push({ x, y });
    expect(freiesFeld(belegt, 1).feld).toBeNull();
  });
});

describe('richtungWaehlen', () => {
  it('merkt eine Richtung quer zur aktuellen vor', () => {
    expect(richtungWaehlen(stand(), 'hoch').gepuffert).toEqual(['hoch']);
  });

  it('verwirft die Gegenrichtung — sonst führe man in den eigenen Hals', () => {
    const z = stand();
    expect(richtungWaehlen(z, 'links')).toBe(z);
  });

  it('merkt zwei Richtungen hintereinander vor — „hoch, dann links" geht nicht verloren', () => {
    // Das war der Fehler des einen Puffer-Platzes: Die zweite Eingabe überschrieb die erste, und
    // die Schlange fuhr um die Ecke geradeaus weiter.
    const z = richtungWaehlen(richtungWaehlen(stand(), 'hoch'), 'links');
    expect(z.gepuffert).toEqual(['hoch', 'links']);
  });

  it('prüft gegen die zuletzt vorgemerkte Richtung, nicht gegen die aktuelle', () => {
    const nachHoch = richtungWaehlen(stand(), 'hoch');
    // Aus „hoch" ist „runter" die Gegenrichtung — auch wenn die Schlange noch nach rechts schaut.
    expect(richtungWaehlen(nachHoch, 'runter')).toBe(nachHoch);
  });

  it('übergeht eine Wiederholung derselben Richtung', () => {
    const nachHoch = richtungWaehlen(stand(), 'hoch');
    expect(richtungWaehlen(nachHoch, 'hoch')).toBe(nachHoch);
    const z = stand();
    expect(richtungWaehlen(z, 'rechts')).toBe(z);
  });

  it('merkt höchstens so viele vor, wie der Puffer fasst', () => {
    let z = stand();
    z = richtungWaehlen(z, 'hoch');
    z = richtungWaehlen(z, 'links');
    z = richtungWaehlen(z, 'runter');
    expect(z.gepuffert).toHaveLength(MAX_PUFFER);
    expect(z.gepuffert).toEqual(['hoch', 'links']);
  });

  it('ändert nichts, wenn die Runde vorbei ist oder die Etappe gefeiert wird', () => {
    const aus = stand({ vorbei: true });
    expect(richtungWaehlen(aus, 'hoch')).toBe(aus);
    const feier = stand({ etappeGeschafft: true });
    expect(richtungWaehlen(feier, 'hoch')).toBe(feier);
  });
});

describe('feldWechseln', () => {
  it('rückt den Kopf ein Feld weiter und lässt die Länge gleich', () => {
    const z = stand();
    const n = feldWechseln(z);
    expect(n.schlange[0]).toEqual({ x: z.schlange[0]!.x + 1, y: z.schlange[0]!.y });
    expect(n.schlange).toHaveLength(z.schlange.length);
    expect(n.schlange[n.schlange.length - 1]).toEqual(z.schlange[z.schlange.length - 2]);
  });

  it('nimmt die vorgemerkten Richtungen der Reihe nach, je eine pro Schritt', () => {
    let z = richtungWaehlen(richtungWaehlen(stand(), 'hoch'), 'links');
    z = feldWechseln(z);
    expect(z.richtung).toBe('hoch');
    expect(z.gepuffert).toEqual(['links']);
    z = feldWechseln(z);
    expect(z.richtung).toBe('links');
    expect(z.gepuffert).toEqual([]);
  });

  it('läuft am Rand einer offenen Arena auf der anderen Seite weiter', () => {
    const z = stand({
      schlange: [{ x: BREITE - 1, y: 4 }, { x: BREITE - 2, y: 4 }, { x: BREITE - 3, y: 4 }],
    });
    const n = feldWechseln(z);
    expect(n.vorbei).toBe(false);
    expect(n.schlange[0]).toEqual({ x: 0, y: 4 });
  });

  it('endet an einer Mauer', () => {
    const z = stand({
      rand: 'mauer',
      schlange: [{ x: BREITE - 1, y: 4 }, { x: BREITE - 2, y: 4 }, { x: BREITE - 3, y: 4 }],
    });
    const n = feldWechseln(z);
    expect(n.vorbei).toBe(true);
    expect(n.ende).toBe('mauer');
  });

  it('endet an einem Felsen', () => {
    const z = stand({ felsen: [{ x: 9, y: 8 }] });
    const n = feldWechseln(z);
    expect(n.vorbei).toBe(true);
    expect(n.ende).toBe('fels');
  });

  it('endet, wenn die Schlange sich selbst berührt', () => {
    const z = stand({
      schlange: [
        { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 },
      ],
      richtung: 'hoch',
      gepuffert: ['links'],
    });
    // Kopf (5,5) nach links ist (4,5) — ein Körperglied.
    const n = feldWechseln(z);
    expect(n.vorbei).toBe(true);
    expect(n.ende).toBe('selbst');
  });

  it('darf auf das Feld ziehen, das der Schwanz gerade freigibt', () => {
    // Ein Quadrat aus vier Gliedern: Der Kopf läuft genau dorthin, wo der Schwanz eben noch war.
    const z = stand({
      schlange: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }],
      richtung: 'hoch',
      gepuffert: ['links'],
    });
    const n = feldWechseln(z);
    expect(n.vorbei).toBe(false);
    expect(n.schlange[0]).toEqual({ x: 4, y: 5 });
  });

  it('ändert nichts mehr, wenn die Runde vorbei ist oder die Etappe gefeiert wird', () => {
    const aus = stand({ vorbei: true });
    expect(feldWechseln(aus)).toBe(aus);
    const feier = stand({ etappeGeschafft: true });
    expect(feldWechseln(feier)).toBe(feier);
  });
});

describe('Fressen', () => {
  it('wächst um ein Glied, gibt Punkte und wird schneller', () => {
    const z = stand({ futter: { x: 9, y: 8 } });
    const n = feldWechseln(z);
    expect(n.schlange).toHaveLength(z.schlange.length + 1);
    expect(n.punkte).toBe(PUNKTE_JE_FUTTER);
    expect(n.taktS).toBeCloseTo(z.taktS - TAKT_STUFE_S, 10);
    expect(n.futterInEtappe).toBe(1);
  });

  it('legt einen neuen Apfel hin — nicht auf die Schlange, nicht auf einen Felsen', () => {
    for (let saat = 0; saat < 40; saat++) {
      const z = stand({ futter: { x: 9, y: 8 }, felsen: [{ x: 2, y: 2 }, { x: 3, y: 2 }], saat });
      const n = feldWechseln(z);
      const f = n.futter!;
      expect(n.schlange.some((p) => p.x === f.x && p.y === f.y)).toBe(false);
      expect(n.felsen.some((p) => p.x === f.x && p.y === f.y)).toBe(false);
    }
  });

  it('beschleunigt nie über das Tempolimit hinaus', () => {
    const z = stand({ futter: { x: 9, y: 8 }, taktS: TAKT_MIN_S });
    expect(feldWechseln(z).taktS).toBe(TAKT_MIN_S);
  });

  it('beginnt jede weitere Etappe etwas schneller, aber nie unter dem Limit', () => {
    expect(taktStart(1)).toBe(TAKT_START_S);
    expect(taktStart(2)).toBeLessThan(taktStart(1));
    expect(taktStart(500)).toBe(TAKT_MIN_S);
  });
});

describe('Serie (Kombo)', () => {
  it('der erste Apfel einer Etappe eröffnet die Serie, ganz gleich wie schnell', () => {
    const z = stand({ futter: { x: 9, y: 8 }, serie: 0, komboRest: -50 });
    const n = feldWechseln(z);
    expect(n.serie).toBe(1);
    expect(n.punkte).toBe(PUNKTE_JE_FUTTER);
  });

  it('setzt die Serie fort, wenn der Apfel rechtzeitig kam, und zählt mehr', () => {
    const z = stand({ futter: { x: 9, y: 8 }, serie: 2, komboRest: 5 });
    const n = feldWechseln(z);
    expect(n.serie).toBe(3);
    expect(n.punkte).toBe(PUNKTE_JE_FUTTER * 3);
  });

  it('lässt die Serie genau auf dem letzten erlaubten Schritt noch zu', () => {
    const z = stand({ futter: { x: 9, y: 8 }, serie: 2, komboRest: 1 });
    expect(feldWechseln(z).serie).toBe(3);
    const zuSpaet = stand({ futter: { x: 9, y: 8 }, serie: 2, komboRest: 0 });
    expect(feldWechseln(zuSpaet).serie).toBe(1);
  });

  it('fängt bei eins wieder an, wenn der Apfel zu spät kam — und gibt ihn trotzdem', () => {
    const z = stand({ futter: { x: 9, y: 8 }, serie: 4, komboRest: -3 });
    const n = feldWechseln(z);
    expect(n.serie).toBe(1);
    expect(n.punkte).toBe(PUNKTE_JE_FUTTER);
  });

  it('wächst nur bis zum Deckel — auch als gezeigte Zahl, nicht nur als Faktor', () => {
    const z = stand({ futter: { x: 9, y: 8 }, serie: 12, komboRest: 5 });
    const n = feldWechseln(z);
    expect(n.punkte).toBe(PUNKTE_JE_FUTTER * KOMBO_MAX);
    expect(n.serie).toBe(KOMBO_MAX);
  });

  it('zählt die Schritte seit dem Legen des Apfels herunter', () => {
    const z = stand({ komboRest: 10 });
    expect(feldWechseln(z).komboRest).toBe(9);
  });

  it('gibt dem nächsten Apfel ein neues Fenster aus dem echten Weg', () => {
    const z = stand({ futter: { x: 9, y: 8 }, serie: 1, komboRest: 5 });
    const n = feldWechseln(z);
    const weg = wegLaenge(n.felsen, n.rand, n.schlange[0]!, n.futter!)!;
    expect(n.komboRest).toBe(weg + KOMBO_PUFFER);
  });

  it('ein Spieler, der immer den kürzesten Weg nimmt, reißt die Serie nie ab', () => {
    // Das Fenster ist so bemessen, dass „kürzester Weg plus Umdrehen" reicht — sonst wäre die Serie
    // ein Glücksspiel um die Lage des nächsten Apfels. Gemessen mit dem vorsichtigen Bot unten.
    let rissen = 0;
    let gegessen = 0;
    for (let saat = 1; saat <= 25; saat++) {
      let z = neuesSpiel(saat);
      for (let i = 0; i < 4000 && !z.vorbei && z.etappe <= 2; i++) {
        const vorher = z.futterInEtappe;
        const serieVorher = z.serie;
        z = feldWechseln(richtungWaehlen(z, botRichtung(z)));
        if (z.etappeGeschafft) z = naechsteEtappe(z);
        else if (z.futterInEtappe > vorher) {
          gegessen++;
          if (serieVorher >= 1 && z.serie === 1) rissen++;
        }
      }
    }
    expect(gegessen).toBeGreaterThan(100);
    expect(rissen / gegessen).toBeLessThan(0.1);
  });
});

describe('Extras', () => {
  it('erscheinen nach genügend Äpfeln und bleiben begrenzt liegen', () => {
    const z = stand({ futter: { x: 9, y: 8 }, seitExtra: EXTRA_JE_FUTTER - 1 });
    const n = feldWechseln(z);
    expect(n.extra).not.toBeNull();
    expect(n.extraRest).toBe(EXTRA_DAUER_SCHRITTE);
    expect(n.seitExtra).toBe(0);
  });

  it('erscheinen nicht auf Schlange, Felsen oder Apfel', () => {
    for (let saat = 0; saat < 60; saat++) {
      const z = stand({
        futter: { x: 9, y: 8 },
        seitExtra: EXTRA_JE_FUTTER - 1,
        felsen: [{ x: 3, y: 3 }],
        saat,
      });
      const n = feldWechseln(z);
      const e = n.extra!;
      expect(n.schlange.some((p) => p.x === e.x && p.y === e.y)).toBe(false);
      expect(n.felsen.some((p) => p.x === e.x && p.y === e.y)).toBe(false);
      expect(n.futter && n.futter.x === e.x && n.futter.y === e.y).toBe(false);
    }
  });

  it('legt nur dann ein neues Extra, wenn keines liegt', () => {
    const vorhanden = { x: 1, y: 1, art: 'gold' as const };
    const z = stand({
      futter: { x: 9, y: 8 },
      seitExtra: EXTRA_JE_FUTTER,
      extra: vorhanden,
      extraRest: 30,
    });
    expect(feldWechseln(z).extra).toEqual(vorhanden);
  });

  it('bietet die Schere nur an, wenn die Schlange lang genug ist, dass sie etwas bringt', () => {
    const arten = new Set<string>();
    for (let saat = 0; saat < 200; saat++) {
      const z = stand({ futter: { x: 9, y: 8 }, seitExtra: EXTRA_JE_FUTTER - 1, saat });
      const e = feldWechseln(z).extra;
      if (e) arten.add(e.art);
    }
    expect(arten.has('schere')).toBe(false);
    expect(arten.has('gold')).toBe(true);
    expect(arten.has('zeitlupe')).toBe(true);

    const lang: Punkt[] = [];
    for (let i = 0; i < 8; i++) lang.push({ x: 8 - i, y: 8 });
    const mitLang = new Set<string>();
    for (let saat = 0; saat < 200; saat++) {
      const z = stand({
        schlange: lang,
        futter: { x: 9, y: 8 },
        seitExtra: EXTRA_JE_FUTTER - 1,
        saat,
      });
      const e = feldWechseln(z).extra;
      if (e) mitLang.add(e.art);
    }
    expect(mitLang.has('schere')).toBe(true);
  });

  it('das Goldstück gibt Zusatzpunkte und verschwindet', () => {
    const z = stand({ extra: { x: 9, y: 8, art: 'gold' }, extraRest: 20 });
    const n = feldWechseln(z);
    expect(n.punkte).toBe(PUNKTE_GOLD);
    expect(n.extra).toBeNull();
  });

  it('die Zeitlupe verlängert den Takt für eine Weile', () => {
    const z = stand({ extra: { x: 9, y: 8, art: 'zeitlupe' }, extraRest: 20 });
    const n = feldWechseln(z);
    expect(n.zeitlupeRest).toBe(ZEITLUPE_SCHRITTE);
    expect(n.punkte).toBe(PUNKTE_HILFE);
    expect(wirksamerTakt(n)).toBeCloseTo(n.taktS * ZEITLUPE_FAKTOR, 10);
  });

  it('die Zeitlupe läuft nach genau so vielen Schritten aus', () => {
    let z = stand({ zeitlupeRest: 3 });
    z = feldWechseln(z);
    z = feldWechseln(z);
    expect(z.zeitlupeRest).toBe(1);
    z = feldWechseln(z);
    expect(z.zeitlupeRest).toBe(0);
    expect(wirksamerTakt(z)).toBe(z.taktS);
  });

  it('die Schere kürzt den Schwanz, aber nie unter die Startlänge', () => {
    const lang: Punkt[] = [];
    for (let i = 0; i < 10; i++) lang.push({ x: 9 - i, y: 8 });
    const n = feldWechseln(stand({ schlange: lang, extra: { x: 10, y: 8, art: 'schere' }, extraRest: 20 }));
    expect(n.schlange).toHaveLength(10 - SCHERE_GLIEDER);
    expect(n.punkte).toBe(PUNKTE_HILFE);

    const kurz: Punkt[] = [];
    for (let i = 0; i < 5; i++) kurz.push({ x: 9 - i, y: 8 });
    const m = feldWechseln(stand({ schlange: kurz, extra: { x: 10, y: 8, art: 'schere' }, extraRest: 20 }));
    expect(m.schlange).toHaveLength(START_LAENGE);
  });

  it('verschwinden von selbst, wenn die Zeit abgelaufen ist', () => {
    const z = stand({ extra: { x: 1, y: 1, art: 'gold' }, extraRest: 2 });
    const n1 = feldWechseln(z);
    expect(n1.extra).not.toBeNull();
    const n2 = feldWechseln(n1);
    expect(n2.extra).toBeNull();
  });
});

describe('Etappe', () => {
  it('ist mit dem letzten Apfel geschafft: Prämie, kein Apfel mehr, Uhr steht', () => {
    const z = stand({
      futter: { x: 9, y: 8 },
      futterInEtappe: FUTTER_JE_ETAPPE - 1,
      extra: { x: 1, y: 1, art: 'gold' },
      extraRest: 10,
    });
    const n = feldWechseln(z);
    expect(n.etappeGeschafft).toBe(true);
    expect(n.futter).toBeNull();
    expect(n.extra).toBeNull();
    expect(n.punkte).toBe(PUNKTE_JE_FUTTER + etappenBonus(1));
    expect(n.vorbei).toBe(false);
    expect(zeitFortschritt(n, 5)).toBe(n);
  });

  it('die Prämie wächst mit der Etappe', () => {
    expect(etappenBonus(5)).toBeGreaterThan(etappenBonus(1));
  });

  it('startLaengeNach behält die Hälfte des Zuwachses, gedeckelt', () => {
    expect(startLaengeNach(START_LAENGE)).toBe(START_LAENGE);
    expect(startLaengeNach(START_LAENGE + 7)).toBe(START_LAENGE + 3);
    expect(startLaengeNach(100)).toBe(MAX_START_LAENGE);
  });

  it('naechsteEtappe baut eine neue Arena und stellt die Schlange neu auf', () => {
    const lang: Punkt[] = [];
    for (let i = 0; i < 10; i++) lang.push({ x: 12 - i, y: 3 });
    const fertig = stand({
      schlange: lang,
      etappeGeschafft: true,
      futter: null,
      punkte: 345,
      serie: 4,
      zeitlupeRest: 5,
      futterInEtappe: FUTTER_JE_ETAPPE,
      extra: null,
    });
    const n = naechsteEtappe(fertig);
    expect(n.etappe).toBe(2);
    expect(n.etappeGeschafft).toBe(false);
    expect(n.punkte).toBe(345);
    expect(n.schlange).toHaveLength(startLaengeNach(10));
    expect(n.schlange[0]).toEqual({ x: MITTE_X, y: MITTE_Y });
    expect(n.richtung).toBe('rechts');
    expect(n.gepuffert).toEqual([]);
    expect(n.felsen.length).toBeGreaterThan(0);
    expect(arenaGueltig(n.felsen, n.rand)).toBe(true);
    expect(n.futter).not.toBeNull();
    expect(n.futterInEtappe).toBe(0);
    expect(n.serie).toBe(0);
    expect(n.zeitlupeRest).toBe(0);
    expect(n.taktS).toBe(taktStart(2));
  });

  it('naechsteEtappe wechselt in der dritten Etappe auf die Mauer', () => {
    const zwei = { ...stand(), etappe: 2, etappeGeschafft: true, futter: null };
    expect(naechsteEtappe(zwei).rand).toBe('mauer');
  });

  it('naechsteEtappe ändert nichts, solange die Etappe nicht geschafft ist', () => {
    const z = stand();
    expect(naechsteEtappe(z)).toBe(z);
  });

  it('legt den ersten Apfel der neuen Etappe so, dass er erreichbar ist', () => {
    for (let saat = 0; saat < 60; saat++) {
      const z = { ...neuesSpiel(saat), etappe: 4, etappeGeschafft: true, futter: null };
      const n = naechsteEtappe(z);
      expect(wegLaenge(n.felsen, n.rand, n.schlange[0]!, n.futter!)).not.toBeNull();
    }
  });
});

describe('zeitFortschritt', () => {
  it('rückt erst, wenn ein voller Takt zusammen ist', () => {
    const z = stand();
    const a = zeitFortschritt(z, z.taktS * 0.5);
    expect(a.schlange).toBe(z.schlange);
    const b = zeitFortschritt(a, z.taktS * 0.6);
    expect(b.schlange[0]).toEqual({ x: z.schlange[0]!.x + 1, y: z.schlange[0]!.y });
  });

  it('holt mehrere fällige Takte in einem Aufruf nach', () => {
    const z = stand();
    const n = zeitFortschritt(z, z.taktS * 3.2);
    expect(n.schlange[0]!.x).toBe(z.schlange[0]!.x + 3);
  });

  it('braucht in der Zeitlupe entsprechend länger', () => {
    const z = stand({ zeitlupeRest: 5 });
    expect(zeitFortschritt(z, z.taktS * 1.2).schlange).toBe(z.schlange);
    expect(zeitFortschritt(z, z.taktS * ZEITLUPE_FAKTOR * 1.01).schlange).not.toBe(z.schlange);
  });

  it('hält mitten im Nachholen an, wenn die Etappe geschafft ist', () => {
    // Zwei Takte fällig, der erste isst den letzten Apfel: Der zweite darf nicht mehr laufen.
    const z = stand({ futter: { x: 9, y: 8 }, futterInEtappe: FUTTER_JE_ETAPPE - 1 });
    const n = zeitFortschritt(z, z.taktS * 2.5);
    expect(n.etappeGeschafft).toBe(true);
    expect(n.schlange[0]).toEqual({ x: 9, y: 8 });
  });

  it('ändert nichts mehr, wenn die Runde vorbei ist', () => {
    const z = stand({ vorbei: true });
    expect(zeitFortschritt(z, 5)).toBe(z);
  });
});

describe('bildGeaendert', () => {
  it('meldet nichts, solange nur Zeit angesammelt wird', () => {
    const z = stand();
    expect(bildGeaendert(z, zeitFortschritt(z, z.taktS * 0.3))).toBe(false);
  });

  it('meldet einen Feldwechsel', () => {
    const z = stand();
    expect(bildGeaendert(z, feldWechseln(z))).toBe(true);
  });

  it('meldet den Zusammenstoß, bei dem die Kette stehen bleibt', () => {
    const z = stand({ felsen: [{ x: 9, y: 8 }], gepuffert: ['hoch'] });
    // Der Kopf dreht sich zum Felsen hin; die Kette bleibt, aber `vorbei` ändert sich.
    expect(bildGeaendert(z, feldWechseln(z))).toBe(true);
  });

  it('meldet das Ende der Etappe und die neue Arena', () => {
    const z = stand({ futter: { x: 9, y: 8 }, futterInEtappe: FUTTER_JE_ETAPPE - 1 });
    const fertig = feldWechseln(z);
    expect(bildGeaendert(z, fertig)).toBe(true);
    expect(bildGeaendert(fertig, naechsteEtappe(fertig))).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Spielbarkeit: ein vorsichtiger Spieler
// ---------------------------------------------------------------------

/** Nachbartabellen je Randart — der Bot rechnet über Indizes, weil er in jedem Schritt mehrfach sucht. */
const NACHBARN: Record<'offen' | 'mauer', number[][]> = { offen: [], mauer: [] };
for (const rand of ['offen', 'mauer'] as const) {
  for (let i = 0; i < BREITE * HOEHE; i++) {
    const p = { x: i % BREITE, y: Math.floor(i / BREITE) };
    const liste: number[] = [];
    for (const r of RICHTUNGEN) {
      const n = schrittZiel(p, r, rand);
      if (n) liste.push(n.y * BREITE + n.x);
    }
    NACHBARN[rand].push(liste);
  }
}
const idx = (p: Punkt) => p.y * BREITE + p.x;

/**
 * Eine Breitensuche von `start` aus über freie Felder. Liefert, wie viele Felder erreichbar sind und
 * wie weit das Ziel (falls vorhanden) entfernt ist.
 */
function suche(
  rand: 'offen' | 'mauer',
  start: number,
  gesperrt: Uint8Array,
  ziel: number,
): { platz: number; abstand: number } {
  const abstand = new Int16Array(BREITE * HOEHE).fill(-1);
  abstand[start] = 0;
  const schlange = [start];
  let platz = 0;
  for (let i = 0; i < schlange.length; i++) {
    const p = schlange[i]!;
    platz++;
    for (const n of NACHBARN[rand][p]!) {
      if (gesperrt[n] || abstand[n] >= 0) continue;
      abstand[n] = abstand[p]! + 1;
      schlange.push(n);
    }
  }
  return { platz, abstand: ziel >= 0 ? abstand[ziel]! : 0 };
}

/**
 * Ein vorsichtiger Spieler: nimmt den kürzesten Weg zum Apfel, aber nur über Züge, nach denen noch
 * genug freie Fläche übrig ist. Er steht für „jemand, der aufpasst" — er spielt nicht perfekt, er
 * stirbt nur nicht aus Dummheit. Wenn er in einer Arena trotzdem stirbt, ist die Arena unfair.
 */
function botRichtung(z: Zustand): Richtung {
  const kopf = z.schlange[0]!;
  const gesperrt = new Uint8Array(BREITE * HOEHE);
  for (const f of z.felsen) gesperrt[idx(f)] = 1;
  // Die Schwanzspitze zieht im selben Schritt nach und gilt deshalb als frei.
  for (const p of z.schlange.slice(0, -1)) gesperrt[idx(p)] = 1;
  const ziel = z.futter ? idx(z.futter) : -1;

  const moeglich: { r: Richtung; platz: number; abstand: number }[] = [];
  for (const r of RICHTUNGEN) {
    if (r === GEGEN[z.richtung]) continue;
    const n = schrittZiel(kopf, r, z.rand);
    if (!n || gesperrt[idx(n)]) continue;
    const e = suche(z.rand, idx(n), gesperrt, ziel);
    moeglich.push({ r, platz: e.platz, abstand: e.abstand < 0 ? 999 : e.abstand });
  }
  if (moeglich.length === 0) return z.richtung;
  const sicher = moeglich.filter((m) => m.platz >= z.schlange.length + 3);
  const wahl = sicher.length > 0 ? sicher : moeglich;
  wahl.sort((a, b) => (sicher.length > 0 ? a.abstand - b.abstand : b.platz - a.platz));
  return wahl[0]!.r;
}

describe('Spielbarkeit', () => {
  it('ein vorsichtiger Spieler kommt durch zehn Etappen, in dreißig verschiedenen Spielen', () => {
    // Das ist der Fairness-Test dieses Spiels, wie `istPassierbar` bei Dash City: Eine Arena, in der
    // selbst jemand mit Übersicht stirbt, wäre ein Zufallstod. Der Bot kennt keine Abkürzungen und
    // spielt keine Zugfolgen voraus — er prüft nur, dass noch Platz bleibt.
    for (let saat = 1; saat <= 30; saat++) {
      let z = neuesSpiel(saat * 31);
      let schritte = 0;
      while (!z.vorbei && z.etappe <= 10 && schritte < 20000) {
        z = feldWechseln(richtungWaehlen(z, botRichtung(z)));
        if (z.etappeGeschafft) z = naechsteEtappe(z);
        schritte++;
      }
      expect({ saat, ende: z.ende, etappe: z.etappe }).toEqual({ saat, ende: null, etappe: 11 });
    }
  });

  it('der Bot braucht für einen Apfel im Mittel nicht viel mehr als den kürzesten Weg', () => {
    // Schutz gegen Arenen, in denen der Weg zum Apfel durch Felsen absurd lang wird.
    let schritte = 0;
    let aepfel = 0;
    for (let saat = 1; saat <= 20; saat++) {
      let z = neuesSpiel(saat * 17);
      while (!z.vorbei && z.etappe <= 8) {
        const vorher = z.futterInEtappe;
        z = feldWechseln(richtungWaehlen(z, botRichtung(z)));
        schritte++;
        if (z.etappeGeschafft) {
          aepfel++;
          z = naechsteEtappe(z);
        } else if (z.futterInEtappe > vorher) aepfel++;
      }
    }
    expect(schritte / aepfel).toBeLessThan(30);
  });

  it('hält über viele zufällige Spiele alle Grundregeln ein', () => {
    for (let saat = 1; saat <= 40; saat++) {
      let z = neuesSpiel(saat);
      for (let i = 0; i < 400 && !z.vorbei; i++) {
        // Meist der vorsichtige Zug, manchmal eine zufällige Richtung — damit auch Kurven, Enge und
        // Beinahe-Unfälle vorkommen.
        const r = (i * 7 + saat) % 5 === 0 ? RICHTUNGEN[(i + saat) % 4]! : botRichtung(z);
        z = feldWechseln(richtungWaehlen(z, r));
        if (z.etappeGeschafft) z = naechsteEtappe(z);
        if (z.vorbei) break;

        const felder = z.schlange.map(k);
        expect(new Set(felder).size).toBe(felder.length);
        expect(z.schlange.length).toBeGreaterThanOrEqual(START_LAENGE);
        const belegt = new Set([...felder, ...z.felsen.map(k)]);
        expect(belegt.size).toBe(felder.length + z.felsen.length);
        if (z.futter) expect(belegt.has(k(z.futter))).toBe(false);
        if (z.extra) expect(belegt.has(k(z.extra))).toBe(false);
        expect(z.taktS).toBeGreaterThanOrEqual(TAKT_MIN_S);
        expect(z.taktS).toBeLessThanOrEqual(TAKT_START_S);
        expect(z.zeitlupeRest).toBeGreaterThanOrEqual(0);
        expect(z.gepuffert.length).toBeLessThanOrEqual(MAX_PUFFER);
      }
    }
  });
});
