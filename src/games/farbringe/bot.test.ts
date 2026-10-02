import { describe, expect, it } from 'vitest';
import { saatAus } from '../../core/rng';
import { ETAPPE_LAENGE, etappeVon, neuesSpiel, springen, takt } from './logik';
import type { Zustand } from './logik';
import { botSpielen } from './bot';

/**
 * Der Bot ist der Maßstab für Tempo und Aufbau — wie der Gedächtnis-Spieler
 * bei Pair Up oder der Schütze bei Bubble Pop.
 *
 * Was er **nicht** zeigen kann: wo ein Mensch scheitert. Ein Bot, der nur
 * geht, wenn die Farbe mit Sicherheitsabstand stimmt, stirbt gar nicht — jedes
 * Hindernis hat ja ein Tor, an dem irgendwann jede Farbe vorbeikommt. Er
 * beweist deshalb zwei andere Dinge: dass **alles zu schaffen ist** (auch die
 * späten Etappen mit den schnellsten Hindernissen und der schmalsten Mitte)
 * und dass **Genauigkeit sich lohnt**.
 */
const SAATEN = [1, 2, 3, 4, 5, 6].map((n) => saatAus('farbringe', n));

describe('Der vorsichtige Bot', () => {
  // Ein langer Lauf pro Saat, von den Tests unten gemeinsam ausgewertet —
  // die Vorausrechnung des Bots ist das Teuerste an dieser Datei.
  const laeufe = SAATEN.slice(0, 3).map((saat) => botSpielen(neuesSpiel(saat), { reserve: 0.5 }, 150));

  it('kommt von Anfang an durch bis in die späten Etappen, ohne je zu sterben', () => {
    for (const l of laeufe) {
      expect(l.zustand.vorbei).toBe(false);
      // Etappe 7 ist die erste mit der schmalsten Mitte.
      expect(etappeVon(l.zustand.geschafft)).toBeGreaterThanOrEqual(7);
    }
  });

  it('schafft die Etappen 8 bis 12 mit allen Hindernisarten und schnellsten Tempi, ohne zu sterben', () => {
    // Hier liegt die Härte: Tempo und Mitte sind am Ende ihrer Skala.
    for (const saat of SAATEN) {
      const l = botSpielen(neuesSpiel(saat, 8), { reserve: 0.5 }, 45);
      expect(l.zustand.vorbei).toBe(false);
      expect(l.zustand.geschafft).toBeGreaterThan(7 * ETAPPE_LAENGE + 10);
    }
  });

  it('hält die Serie fast immer', () => {
    const mitten = laeufe.reduce((a, l) => a + l.mitten, 0);
    const rand = laeufe.reduce((a, l) => a + l.rand, 0);
    // Er kann die Mitte nur verfehlen, wenn die grobe Vorausrechnung um ein
    // paar Hundertstel danebenliegt — eine Ausnahme, nie die Regel.
    expect(rand).toBeLessThan(0.05 * (mitten + rand));
  });

  it('spielt bei gleicher Saat immer dasselbe', () => {
    const a = botSpielen(neuesSpiel(SAATEN[0]!), { reserve: 0.35 }, 30);
    const b = botSpielen(neuesSpiel(SAATEN[0]!), { reserve: 0.35 }, 30);
    expect(b.zustand.punkte).toBe(a.zustand.punkte);
    expect(b.zustand.geschafft).toBe(a.zustand.geschafft);
  });
});

describe('Genauigkeit lohnt sich', () => {
  /**
   * Gemessen wird in Etappe 6, wo die Mitte schmal ist: In den ersten
   * Etappen treffen auch Grobe sie fast immer, dort ist der Unterschied
   * klein (Etappe 1, 45 s: 453 / 535 / 575). Etappe 6, sechs Saaten, 45 s:
   * 961 / 999 / 1388.
   */
  function punkteMit(reserve: number): number {
    let summe = 0;
    for (const saat of SAATEN) summe += botSpielen(neuesSpiel(saat, 6), { reserve }, 45).zustand.punkte;
    return summe;
  }

  it('belohnt einen genaueren Spieler mit deutlich mehr Punkten, bei gleicher Spielzeit', () => {
    const grob = punkteMit(0);
    const mittel = punkteMit(0.3);
    const fein = punkteMit(0.5);
    expect(mittel).toBeGreaterThanOrEqual(grob);
    expect(fein).toBeGreaterThan(mittel * 1.2);
    expect(fein).toBeGreaterThan(grob * 1.3);
  });
});

describe('Wer nicht hinsieht, kommt nicht weit', () => {
  it('scheitert beim stumpfen Durchtippen noch in der ersten Etappe', () => {
    // Vier Farben, eine passt: Acht Hindernisse in Folge zu treffen, ohne
    // hinzusehen, ist eine Chance von eins zu 65.000.
    for (const saat of SAATEN) {
      let z: Zustand = neuesSpiel(saat);
      for (let i = 0; i < 60 * 120 && !z.vorbei; i++) {
        z = takt(z.kugelTempo < 30 ? springen(z) : z, 1 / 60);
      }
      expect(z.vorbei).toBe(true);
      expect(z.geschafft).toBeLessThan(ETAPPE_LAENGE);
    }
  });
});
