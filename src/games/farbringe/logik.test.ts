import { describe, expect, it } from 'vitest';
import { saatAus } from '../../core/rng';
import {
  FALL_GRENZE,
  FARB_ANZAHL,
  KUGEL_R,
  RING_ABSTAND,
  SCHWERKRAFT,
  SICHT_HOCH,
  SICHT_RUNTER,
  SPRUNG,
  farbeAnStelle,
  halbmesserFuerRing,
  neuesSpiel,
  springen,
  takt,
  tempoFuerRing,
} from './logik';
import type { Ring, Zustand } from './logik';

const SAAT = saatAus('farbringe', 1);

/** Lässt die Zeit in kleinen Schritten laufen, wie die echte Schleife. */
function laufen(z: Zustand, sekunden: number, beiSchritt?: (z: Zustand) => Zustand): Zustand {
  const dt = 1 / 60;
  for (let t = 0; t < sekunden; t += dt) {
    z = takt(z, dt);
    if (beiSchritt) z = beiSchritt(z);
    if (z.vorbei) break;
  }
  return z;
}

describe('farbeAnStelle', () => {
  const ring: Ring = { y: 0, halbmesser: 25, winkel: 0, tempo: 0, durch: false };

  it('teilt den Kreis in vier gleich große Bögen', () => {
    const gefunden = new Set<number>();
    for (let i = 0; i < 400; i++) {
      gefunden.add(farbeAnStelle(ring, (i / 400) * 2 * Math.PI));
    }
    expect(gefunden.size).toBe(FARB_ANZAHL);
  });

  it('kommt auch mit negativen Winkeln klar', () => {
    // −π/2 ist dieselbe Stelle wie 3π/2 — das ist der Winkel, unter dem die
    // Kugel jeden Ring von unten trifft.
    expect(farbeAnStelle(ring, -Math.PI / 2)).toBe(farbeAnStelle(ring, (3 * Math.PI) / 2));
  });

  it('dreht sich mit dem Ring mit', () => {
    const bogen = (2 * Math.PI) / FARB_ANZAHL;
    const gedreht = { ...ring, winkel: bogen };
    // Eine Drehung um genau einen Bogen verschiebt die Farben um eins.
    expect(farbeAnStelle(gedreht, bogen)).toBe(farbeAnStelle(ring, 0));
  });
});

describe('Schwierigkeit', () => {
  it('dreht schneller, je höher man kommt — aber gedeckelt', () => {
    expect(tempoFuerRing(5)).toBeGreaterThan(tempoFuerRing(0));
    expect(tempoFuerRing(500)).toBe(tempoFuerRing(1000));
  });

  it('macht die Ringe enger — aber nie enger als die Kugel braucht', () => {
    expect(halbmesserFuerRing(10)).toBeLessThan(halbmesserFuerRing(0));
    expect(halbmesserFuerRing(500)).toBeGreaterThan(10);
  });
});

describe('Sichtfenster und Fallgrenze', () => {
  /**
   * Der Ring um die Kugel ist ihr äußerster sichtbarer Teil (`figuren.tsx`,
   * `KUGEL_R + 2.6`). Hier steht die Zahl noch einmal, damit der Test die
   * Anzeige nicht importieren muss — er prüft ja nur, dass die Logik ihr
   * genug Platz lässt.
   */
  const KUGEL_AUSSEN = KUGEL_R + 2.6;

  it('lässt die Kugel bis zum Spielende sichtbar', () => {
    // Vorher endete die Runde erst 75 Einheiten, nachdem die Kugel unten aus
    // dem Bild gefallen war — die letzten 0,35 Sekunden tippte man blind.
    expect(FALL_GRENZE + KUGEL_AUSSEN).toBeLessThanOrEqual(SICHT_RUNTER);
  });

  it('lässt Raum für mehrere Sprünge, um sich wieder zu fangen', () => {
    // Ein Sprung aus dem Stillstand trägt SPRUNG²/(2·SCHWERKRAFT) Einheiten.
    // Wer abrutscht, soll sich mit zwei, drei Tippern zurückholen können.
    const einSprung = (SPRUNG * SPRUNG) / (2 * SCHWERKRAFT);
    expect(FALL_GRENZE).toBeGreaterThan(2 * einSprung);
  });

  it('zeigt den nächsten Ring, bevor man ihn erreicht', () => {
    // Sonst taucht ein Tor auf, dessen Drehung man nicht mehr abpassen kann.
    expect(SICHT_HOCH).toBeGreaterThan(RING_ABSTAND);
  });

  it('beendet die Runde, solange die Kugel noch im Bild ist', () => {
    // Nicht nur die Konstanten, sondern der echte Ablauf: fallen lassen und
    // im Moment des Spielendes nachsehen, wo die Kugel steht.
    let z = neuesSpiel(SAAT);
    const dt = 1 / 60;
    while (!z.vorbei) z = takt(z, dt);
    const tiefe = z.hoehe - z.kugelY;
    expect(tiefe + KUGEL_AUSSEN).toBeLessThanOrEqual(SICHT_RUNTER);
  });
});

describe('neuesSpiel', () => {
  it('hält von Anfang an Ringe auf Vorrat', () => {
    const z = neuesSpiel(SAAT);
    expect(z.ringe.length).toBeGreaterThanOrEqual(4);
    expect(z.wechsler.length).toBe(z.ringe.length);
  });

  it('setzt den ersten Ring über die Kugel, nicht auf sie', () => {
    const z = neuesSpiel(SAAT);
    expect(z.ringe[0]!.y - z.ringe[0]!.halbmesser).toBeGreaterThan(z.kugelY + 5);
  });

  it('ergibt bei gleicher Saat denselben Aufstieg', () => {
    const a = neuesSpiel(SAAT).ringe.map((r) => [r.winkel, r.tempo]);
    const b = neuesSpiel(SAAT).ringe.map((r) => [r.winkel, r.tempo]);
    expect(a).toEqual(b);
  });

  it('wechselt nie auf die Farbe, die schon dran ist', () => {
    // Ein Wechsler, der nichts ändert, sieht aus wie ein Fehler.
    for (let i = 1; i < 20; i++) {
      let z = neuesSpiel(saatAus('farbringe', i));
      // Genug Ringe erzeugen, um viele Wechsler zu sehen.
      for (let n = 0; n < 30; n++) z = { ...z, punkte: n };
      const farben = neuesSpiel(saatAus('farbringe', i)).wechsler.map((w) => w.farbe);
      for (let k = 1; k < farben.length; k++) expect(farben[k]).not.toBe(farben[k - 1]);
    }
  });
});

describe('Bewegung', () => {
  it('zieht die Kugel ohne Antippen nach unten', () => {
    const z = takt(neuesSpiel(SAAT), 0.1);
    expect(z.kugelTempo).toBeLessThan(0);
    expect(z.kugelY).toBeLessThan(0);
  });

  it('gibt beim Antippen Schwung nach oben', () => {
    expect(springen(neuesSpiel(SAAT)).kugelTempo).toBe(SPRUNG);
  });

  it('beendet die Runde, wenn die Kugel zu tief fällt', () => {
    const z = laufen(neuesSpiel(SAAT), 5);
    expect(z.vorbei).toBe(true);
  });

  it('lässt eine beendete Runde in Ruhe', () => {
    const vorbei = laufen(neuesSpiel(SAAT), 5);
    expect(takt(vorbei, 0.1)).toBe(vorbei);
    expect(springen(vorbei)).toBe(vorbei);
  });
});

describe('Ringe durchqueren', () => {
  function modulo(w: number): number {
    return ((w % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }

  /**
   * Baut eine Lage mit **einem** stillstehenden Ring über der Kugel, bei dem
   * unten am Tor genau `farbeUnten` liegt.
   */
  function mitRuhendemRing(farbeUnten: number): Zustand {
    const z = neuesSpiel(SAAT);
    const bogen = (2 * Math.PI) / FARB_ANZAHL;
    const ring: Ring = {
      y: 30,
      halbmesser: 10,
      // So gedreht, dass die Mitte des Bogens `farbeUnten` genau unten steht.
      winkel: modulo(-Math.PI / 2 - farbeUnten * bogen - bogen / 2),
      tempo: 0,
      durch: false,
    };
    return { ...z, ringe: [ring], wechsler: [], farbe: 0 };
  }

  it('lässt die passende Farbe durch und gibt einen Punkt', () => {
    let z = mitRuhendemRing(0);
    z = laufen(z, 1.6, (s) => (s.kugelTempo < 20 ? springen(s) : s));
    expect(z.vorbei).toBe(false);
    expect(z.punkte).toBe(1);
  });

  it('beendet die Runde bei der falschen Farbe', () => {
    let z = mitRuhendemRing(2);
    z = laufen(z, 1.6, (s) => (s.kugelTempo < 20 ? springen(s) : s));
    expect(z.vorbei).toBe(true);
    expect(z.punkte).toBe(0);
  });

  it('zählt jeden Ring nur einmal', () => {
    let z = mitRuhendemRing(0);
    z = laufen(z, 1.6, (s) => (s.kugelTempo < 20 ? springen(s) : s));
    const punkteNachher = z.punkte;
    // Zurückfallen und wieder hoch — der Ring darf nicht noch einmal zählen.
    z = laufen({ ...z, kugelTempo: -60 }, 0.5);
    z = laufen(z, 1.2, (s) => (s.kugelTempo < 20 ? springen(s) : s));
    expect(z.punkte).toBe(punkteNachher);
  });
});

describe('Ist das Spiel überhaupt zu schaffen?', () => {
  /**
   * Der aussagekräftigste Test des ganzen Spiels: ein einfacher Spieler.
   *
   * Er schwebt unter dem nächsten Ring und schießt erst hoch, wenn seine
   * Farbe unten am Tor steht. Kommt er damit weit, ist das Spiel fair
   * gebaut — kommt er nicht durch, stimmt etwas mit Tempo, Abstand oder
   * Zeitfenster nicht. Genau dieser Test hätte die erste Fassung mit der
   * doppelten Prüfung (unten *und* oben) sofort auffliegen lassen.
   */
  function spielen(saat: number, sekunden: number): Zustand {
    let z = neuesSpiel(saat);
    const dt = 1 / 60;
    for (let t = 0; t < sekunden && !z.vorbei; t += dt) {
      const naechster = z.ringe.filter((r) => !r.durch).sort((a, b) => a.y - b.y)[0];
      if (naechster) {
        const tor = naechster.y - naechster.halbmesser;
        // Sicherheitsabstand unter dem Tor, in dem gewartet wird.
        const wartehoehe = tor - 16;
        const passt = farbeAnStelle(naechster, -Math.PI / 2) === z.farbe;
        // Losschießen, wenn die Farbe stimmt und wir nah genug sind;
        // sonst nur so viel hüpfen, dass wir nicht abstürzen.
        if (passt && z.kugelY > wartehoehe - 24) {
          if (z.kugelTempo < 40) z = springen(z);
        } else if (z.kugelY < wartehoehe - 12 && z.kugelTempo < 10) {
          z = springen(z);
        }
      }
      z = takt(z, dt);
    }
    return z;
  }

  it('kommt ein einfacher Spieler über viele Ringe', () => {
    const punkte = [1, 2, 3, 4, 5].map((n) => spielen(saatAus('farbringe', n), 60).punkte);
    // Jeder Durchgang muss mehrere Ringe schaffen, im Schnitt deutlich mehr.
    for (const p of punkte) expect(p).toBeGreaterThanOrEqual(3);
    const schnitt = punkte.reduce((a, b) => a + b, 0) / punkte.length;
    expect(schnitt).toBeGreaterThan(8);
  });

  it('lässt auch beim schnellsten Ring genug Zeit zum Zielen', () => {
    // Das Zeitfenster ist ein Viertelkreis geteilt durch das Drehtempo.
    const fenster = Math.PI / 2 / tempoFuerRing(9999);
    expect(fenster).toBeGreaterThan(0.4);
  });
});

describe('Farbwechsler', () => {
  it('färbt die Kugel um, sobald sie ihn berührt', () => {
    const z = neuesSpiel(SAAT);
    const ziel = (z.farbe + 2) % FARB_ANZAHL;
    const vorbereitet: Zustand = {
      ...z,
      ringe: [],
      wechsler: [{ y: 10, farbe: ziel, genommen: false }],
    };
    const nachher = laufen(springen(vorbereitet), 0.6);
    expect(nachher.farbe).toBe(ziel);
    expect(nachher.wechsler[0]!.genommen).toBe(true);
  });

  it('wirkt nur einmal', () => {
    const z = neuesSpiel(SAAT);
    const vorbereitet: Zustand = {
      ...z,
      ringe: [],
      wechsler: [{ y: 10, farbe: 2, genommen: false }],
    };
    let nachher = laufen(springen(vorbereitet), 0.6);
    nachher = { ...nachher, farbe: 1 };
    // Beim Zurückfallen darf er nicht erneut greifen.
    nachher = laufen(nachher, 0.8);
    expect(nachher.farbe).toBe(1);
  });
});

describe('Nachschub', () => {
  it('erzeugt neue Ringe, während man aufsteigt', () => {
    const z = neuesSpiel(SAAT);
    const mitPunkten = takt({ ...z, punkte: 12 }, 1 / 60);
    expect(mitPunkten.ringe.length).toBeGreaterThan(z.ringe.length);
    // Und die neuen liegen wirklich weiter oben.
    const hoechster = Math.max(...mitPunkten.ringe.map((r) => r.y));
    expect(hoechster).toBeGreaterThan(RING_ABSTAND * 5);
  });
});
