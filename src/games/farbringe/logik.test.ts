import { describe, expect, it } from 'vitest';
import { saatAus } from '../../core/rng';
import {
  ART_WERT,
  BAND_PERIODE,
  ETAPPEN_BONUS,
  ETAPPE_LAENGE,
  FALL_GRENZE,
  FARB_ANZAHL,
  FAKTOR_MAX,
  KUGEL_R,
  MITTE_MIN,
  MITTE_START,
  PULS_PERIODE,
  PULS_TIEFE,
  RING_ABSTAND,
  SCHWERKRAFT,
  SICHT_HOCH,
  SICHT_RUNTER,
  SPRUNG,
  abstandZurMitte,
  artFuer,
  bandSegmente,
  etappeVon,
  etappenNeuheit,
  farbeAnStelle,
  halbmesserFuerRing,
  mitteBreite,
  neuesSpiel,
  serieFaktor,
  springen,
  takt,
  tempoFuerBand,
  tempoFuerPuls,
  tempoFuerRing,
  torFarbe,
} from './logik';
import type { Ring, Zustand } from './logik';

const SAAT = saatAus('farbringe', 1);

/** Ein Ring für Tests: Pflichtfelder vorbelegt, der Rest wie angegeben. */
function ringVon(teil: Partial<Ring>): Ring {
  return { id: 0, nr: 0, art: 'ring', y: 0, halbmesser: 25, winkel: 0, tempo: 0, phase: 0, durch: false, ...teil };
}

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
  const ring = ringVon({});

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
    const ring = ringVon({
      y: 30,
      halbmesser: 10,
      // So gedreht, dass die Mitte des Bogens `farbeUnten` genau unten steht.
      winkel: modulo(-Math.PI / 2 - farbeUnten * bogen - bogen / 2),
    });
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

describe('Mitten im Spiel beginnen', () => {
  it('beginnt in der verlangten Etappe, mit der Kugel am Fuß der Hindernisse', () => {
    const z = neuesSpiel(SAAT, 5);
    expect(etappeVon(z.geschafft)).toBe(5);
    expect(z.ringe[0]!.nr).toBe(4 * ETAPPE_LAENGE);
    expect(z.ringe[0]!.y - z.ringe[0]!.halbmesser).toBeGreaterThan(z.kugelY + 5);
    expect(z.punkte).toBe(0);
  });

  it('ist für Etappe 1 dasselbe wie ein gewöhnlicher Start', () => {
    expect(neuesSpiel(SAAT, 1)).toEqual(neuesSpiel(SAAT));
  });
});

describe('Nachschub', () => {
  it('erzeugt neue Ringe, während man aufsteigt', () => {
    const z = neuesSpiel(SAAT);
    const mitPunkten = takt({ ...z, geschafft: 12 }, 1 / 60);
    expect(mitPunkten.ringe.length).toBeGreaterThan(z.ringe.length);
    // Und die neuen liegen wirklich weiter oben.
    const hoechster = Math.max(...mitPunkten.ringe.map((r) => r.y));
    expect(hoechster).toBeGreaterThan(RING_ABSTAND * 5);
  });
});

/**
 * Ein Zustand mit Ringen, die stillstehen und die Farbe 0 in der Mitte am Tor
 * zeigen — `versatz` schiebt sie aus der Mitte (Bogenmaß).
 */
function mitStehendenRingen(anzahl: number, versatz = 0): Zustand {
  const z = neuesSpiel(SAAT);
  const bogen = (2 * Math.PI) / FARB_ANZAHL;
  const ringe = Array.from({ length: anzahl }, (_, i) =>
    ringVon({
      id: i,
      nr: i,
      y: 30 + i * 90,
      halbmesser: 10,
      winkel: (((-Math.PI / 2 - bogen / 2 - versatz) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
    }),
  );
  return { ...z, ringe, wechsler: [], farbe: 0 };
}

function steigen(s: Zustand): Zustand {
  return s.kugelTempo < 20 ? springen(s) : s;
}

describe('Hindernisarten', () => {
  it('liest beim Band dieselbe Farbe am Tor, die das Bild bei x = 0 zeigt', () => {
    // Anzeige und Prüfung dürfen nicht auseinanderlaufen: Das Band wird aus
    // `bandSegmente` gezeichnet, geprüft wird mit `torFarbe`.
    for (let i = 0; i < 360; i++) {
      const ring = ringVon({ art: 'band', winkel: (i / 360) * 2 * Math.PI });
      const segment = bandSegmente(ring).find((s) => s.x <= 0 && 0 < s.x + s.breite)!;
      expect(segment.farbe).toBe(torFarbe(ring));
    }
  });

  it('zeigt am Band vier gleich breite Farben, die sich nach einer Periode wiederholen', () => {
    const segmente = bandSegmente(ringVon({ art: 'band', winkel: 1 }));
    expect(segmente[0]!.breite * FARB_ANZAHL).toBeCloseTo(BAND_PERIODE, 6);
    expect(segmente[0]!.farbe).toBe(segmente[FARB_ANZAHL]!.farbe);
  });

  it('liest beim Ring das Tor unten, beim Band bei x = 0', () => {
    const ring = ringVon({ winkel: 0.7 });
    expect(torFarbe(ring)).toBe(farbeAnStelle(ring, -Math.PI / 2));
  });

  it('beginnt mit gewöhnlichen Ringen und führt eine Neuheit je Etappe ein', () => {
    for (let nr = 0; nr < ETAPPE_LAENGE; nr++) expect(artFuer(nr, 0.9)).toBe('ring');
    // Etappe 2 bringt das Band, Etappe 3 den Pulsring — und zwar garantiert.
    const art = (e: number) => Array.from({ length: ETAPPE_LAENGE }, (_, i) => artFuer((e - 1) * ETAPPE_LAENGE + i, 0.1));
    expect(art(2)).toContain('band');
    expect(art(2)).not.toContain('puls');
    expect(art(3)).toContain('puls');
    expect(art(3)).not.toContain('band');
  });

  it('meldet als Neuheit genau das, was die Erzeugung bringt', () => {
    expect(etappenNeuheit(2)?.art).toBe('band');
    expect(etappenNeuheit(3)?.art).toBe('puls');
    expect(etappenNeuheit(1)).toBeNull();
  });

  it('mischt ab Etappe 4 alle drei Arten', () => {
    const z = (() => {
      let s = neuesSpiel(SAAT);
      // Genug Hindernisse erzeugen lassen, ohne zu spielen.
      s = { ...s, geschafft: 120 };
      return takt(s, 1 / 60);
    })();
    const arten = new Set(z.ringe.filter((r) => r.nr >= 3 * ETAPPE_LAENGE).map((r) => r.art));
    expect(arten.size).toBe(3);
  });

  it('lässt das Tempo des Pulsrings um das Grundtempo schwingen — und nie rückwärts laufen', () => {
    const ring = ringVon({ art: 'puls', tempo: 2, phase: 0.3 });
    const dt = 1 / 600;
    let z: Zustand = { ...neuesSpiel(SAAT), ringe: [ring], wechsler: [], kugelY: 0, kugelTempo: 0 };
    let weg = 0;
    let letzter = z.ringe[0]!.winkel;
    let kleinste = Infinity;
    let groesste = 0;
    for (let t = 0; t < PULS_PERIODE; t += dt) {
      // Die Kugel fest halten, damit nichts anderes passiert.
      z = takt({ ...z, kugelY: 0, kugelTempo: 0, hoehe: 0 }, dt);
      const jetzt = z.ringe[0]!.winkel;
      const schritt = (((jetzt - letzter) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      weg += schritt;
      kleinste = Math.min(kleinste, schritt / dt);
      groesste = Math.max(groesste, schritt / dt);
      letzter = jetzt;
    }
    // Ein Durchlauf der Schwingung dreht im Mittel mit dem Grundtempo (±2 %).
    expect(weg / PULS_PERIODE).toBeGreaterThan(2 * 0.98);
    expect(weg / PULS_PERIODE).toBeLessThan(2 * 1.02);
    // Die Schwankung ist wirklich da, und es gibt nie Stillstand oder Rückwärtsgang.
    expect(kleinste).toBeGreaterThan(0.1);
    expect(kleinste).toBeLessThan(2 * (1 - PULS_TIEFE) * 1.1);
    expect(groesste).toBeGreaterThan(2 * (1 + PULS_TIEFE) * 0.9);
  });

  it('lässt auch beim schnellsten Band und Pulsring genug Zeit zum Zielen', () => {
    // Eine Farbe geht in (π/2)/Tempo Sekunden am Tor vorbei.
    expect(Math.PI / 2 / tempoFuerBand(9999)).toBeGreaterThan(0.35);
    // Der Pulsring ist im schnellsten Moment das 1,8-fache seines Grundtempos.
    expect(Math.PI / 2 / (tempoFuerPuls(9999) * (1 + PULS_TIEFE))).toBeGreaterThan(0.28);
  });

  it('lässt auch die schmalste Mitte noch ein Zeitfenster, das man treffen kann', () => {
    // Die Mitte reicht ±MITTE_MIN um die Bogenmitte — das ist 2·MITTE_MIN lang.
    const schnellster = Math.max(tempoFuerRing(9999), tempoFuerBand(9999), tempoFuerPuls(9999));
    expect((2 * MITTE_MIN) / schnellster).toBeGreaterThan(0.15);
  });
});

describe('Die Mitte', () => {
  it('ist 0 genau in der Mitte des Bogens und läuft von −π/4 bis π/4', () => {
    const bogen = (2 * Math.PI) / FARB_ANZAHL;
    for (const art of ['ring', 'band'] as const) {
      // Winkel, bei dem die Mitte des Bogens 0 am Tor steht.
      const mitte = art === 'band' ? -bogen / 2 : -Math.PI / 2 - bogen / 2;
      expect(abstandZurMitte(ringVon({ art, winkel: mitte }))).toBeCloseTo(0, 9);
      for (let i = 0; i < 720; i++) {
        const a = abstandZurMitte(ringVon({ art, winkel: (i / 720) * 2 * Math.PI }));
        expect(a).toBeGreaterThanOrEqual(-bogen / 2 - 1e-9);
        expect(a).toBeLessThan(bogen / 2 + 1e-9);
      }
    }
  });

  it('wird mit den Etappen schmaler — aber nie schmaler als das Mindestmaß', () => {
    expect(mitteBreite(1)).toBe(MITTE_START);
    expect(mitteBreite(3)).toBeLessThan(mitteBreite(2));
    expect(mitteBreite(500)).toBe(MITTE_MIN);
    // Die Mitte passt in den Bogen (±π/4), sonst wäre jeder Durchflug „mitten".
    expect(MITTE_START).toBeLessThan(Math.PI / 4);
  });
});

describe('Serie, Punkte und Etappen', () => {
  it('gibt für einen Durchflug in der Mitte den Grundwert und eine Serie von eins', () => {
    const z = laufen(mitStehendenRingen(1), 1.6, steigen);
    expect(z.geschafft).toBe(1);
    expect(z.serie).toBe(1);
    expect(z.punkte).toBe(ART_WERT.ring * 1);
  });

  it('lässt den Faktor mit jedem Treffer in der Mitte wachsen', () => {
    const z = laufen(mitStehendenRingen(3), 5, steigen);
    expect(z.geschafft).toBe(3);
    expect(z.serie).toBe(3);
    // 1·1 + 1·2 + 1·3
    expect(z.punkte).toBe(6);
  });

  it('deckelt den Faktor', () => {
    expect(serieFaktor(0)).toBe(1);
    expect(serieFaktor(2)).toBe(2);
    expect(serieFaktor(99)).toBe(FAKTOR_MAX);
  });

  it('zählt einen Durchflug am Rand des Bogens, reißt aber die Serie', () => {
    // Knapp innerhalb des Bogens (0,75 von 0,785), aber weit außerhalb der Mitte.
    const z0 = mitStehendenRingen(2);
    const rand = { ...z0, ringe: [z0.ringe[0]!, { ...mitStehendenRingen(2, 0.75).ringe[1]! }], serie: 2, geschafft: 2 };
    const z = laufen(rand, 5, steigen);
    expect(z.vorbei).toBe(false);
    // Der erste Ring (mittig) hat die Serie auf 3 gebracht, der zweite (am Rand) riss sie.
    expect(z.geschafft).toBe(4);
    expect(z.serie).toBe(0);
    // 3 (Faktor 3) für den ersten, nur 1 (kein Faktor) für den zweiten.
    expect(z.punkte).toBe(3 + 1);
  });

  it('beendet die Runde bei der falschen Farbe, auch mit Serie', () => {
    const z0 = mitStehendenRingen(1);
    const z = laufen({ ...z0, farbe: 2, serie: 4 }, 1.6, steigen);
    expect(z.vorbei).toBe(true);
  });

  it('lässt die Serie nicht durch Warten reißen', () => {
    // Die Serie hängt an der Genauigkeit, nicht an der Uhr: Wie lang man auf
    // seine Farbe warten muss, bestimmt allein der Ring.
    let z: Zustand = { ...mitStehendenRingen(1), serie: 3 };
    // 20 Sekunden unter dem Tor (bei y = 20) schweben: Ein Sprung trägt gut
    // 20 Einheiten, also wird erst unter −10 neu getippt.
    const dt = 1 / 60;
    for (let t = 0; t < 20; t += dt) {
      z = takt(z.kugelY < -10 && z.kugelTempo < 0 ? springen(z) : z, dt);
    }
    expect(z.vorbei).toBe(false);
    expect(z.serie).toBe(3);
  });

  it('zählt Etappen und gibt beim Abschluss den Bonus', () => {
    expect(etappeVon(0)).toBe(1);
    expect(etappeVon(ETAPPE_LAENGE - 1)).toBe(1);
    expect(etappeVon(ETAPPE_LAENGE)).toBe(2);
    // Das letzte Hindernis der ersten Etappe: Grundwert × Faktor plus Bonus.
    const vorher = { ...mitStehendenRingen(1), geschafft: ETAPPE_LAENGE - 1 };
    const z = laufen(vorher, 1.6, steigen);
    expect(z.geschafft).toBe(ETAPPE_LAENGE);
    expect(z.punkte).toBe(1 + ETAPPEN_BONUS * 1);
    // Die zweite Etappe zahlt doppelt.
    const zweite = laufen({ ...mitStehendenRingen(1), geschafft: 2 * ETAPPE_LAENGE - 1 }, 1.6, steigen);
    expect(zweite.punkte).toBe(1 + ETAPPEN_BONUS * 2);
  });

  it('gewichtet das schwerere Hindernis höher', () => {
    expect(ART_WERT.puls).toBeGreaterThan(ART_WERT.ring);
  });

  it('räumt weit zurückliegende Hindernisse weg, damit ein langer Lauf nicht zäh wird', () => {
    let z = neuesSpiel(SAAT);
    // Weit nach oben versetzen, ohne zu spielen.
    z = { ...z, kugelY: 5000, hoehe: 5000, geschafft: 60 };
    z = takt(z, 1 / 60);
    expect(z.ringe.every((r) => r.y >= z.hoehe - 300)).toBe(true);
    expect(z.ringe.length).toBe(z.wechsler.length);
  });
});
