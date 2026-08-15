import { beforeEach, describe, expect, it } from 'vitest';
import {
  ausgangErledigt,
  ausgangLesen,
  bestenlisteLesen,
  bestenlisteLoeschen,
  bestwert,
  eigenenServerwertMerken,
  ergebnisEintragen,
  serverlisteLesen,
  serverlisteSchreiben,
  sitzungLesen,
  sitzungSchreiben,
  zuletztGespielt,
  zuletztGespieltMerken,
} from './speicher';

/**
 * Ein Ersatz für `localStorage` im Test.
 *
 * Die Daten liegen als **eigene, aufzählbare** Eigenschaften am Objekt —
 * `bestenlisteLoeschen` läuft mit `Object.keys` darüber, ein Ersatz aus einer
 * Map allein würde diesen Teil also gar nicht prüfen. Die drei Methoden sind
 * deshalb ausdrücklich nicht aufzählbar.
 */
function neuerSpeicher(): Storage {
  const daten: Record<string, string> = {};
  const methoden: Record<string, unknown> = {
    getItem: (k: string) => (k in daten ? daten[k] : null),
    setItem: (k: string, v: string) => {
      daten[k] = String(v);
    },
    removeItem: (k: string) => {
      delete daten[k];
    },
  };
  for (const [name, wert] of Object.entries(methoden)) {
    Object.defineProperty(daten, name, { value: wert, enumerable: false });
  }
  return daten as unknown as Storage;
}

const SITZUNG = {
  zugriffsmerkmal: 'a',
  erneuerungsmerkmal: 'r',
  laeuftAb: 9_999_999_999_999,
  benutzerId: 'u1',
  name: 'Florian',
};

beforeEach(() => {
  globalThis.localStorage = neuerSpeicher();
});

describe('Bestenliste je Gerät', () => {
  it('hebt die fünf besten Ergebnisse auf, absteigend sortiert', () => {
    for (const punkte of [10, 50, 30, 70, 20, 60]) ergebnisEintragen('quiz', punkte);
    expect(bestenlisteLesen('quiz').map((e) => e.punkte)).toEqual([70, 60, 50, 30, 20]);
  });

  it('trennt die Spiele sauber', () => {
    ergebnisEintragen('quiz', 10);
    ergebnisEintragen('schlange', 99);
    expect(bestenlisteLesen('quiz').map((e) => e.punkte)).toEqual([10]);
    expect(bestenlisteLesen('schlange').map((e) => e.punkte)).toEqual([99]);
  });
});

describe('Ausgangsschlange', () => {
  it('hängt jede Runde an — auch eine schlechte, die es nicht in die Liste schafft', () => {
    for (const punkte of [10, 20, 30, 40, 50, 1]) ergebnisEintragen('quiz', punkte);
    // Die 1 fliegt aus der Bestenliste, muss aber trotzdem zum Server:
    // Der Server rechnet mit allen Runden, nicht nur mit den besten fünf.
    expect(ausgangLesen()).toHaveLength(6);
    expect(ausgangLesen().at(-1)?.punkte).toBe(1);
  });

  it('gibt je Runde einen eigenen Schlüssel zurück', () => {
    const a = ergebnisEintragen('quiz', 10).schluessel;
    const b = ergebnisEintragen('quiz', 10).schluessel;
    expect(a).not.toBe(b);
    expect(ausgangLesen().map((e) => e.schluessel)).toEqual([a, b]);
  });

  it('räumt genau den erledigten Eintrag weg', () => {
    const a = ergebnisEintragen('quiz', 10).schluessel;
    const b = ergebnisEintragen('quiz', 20).schluessel;
    ausgangErledigt(a);
    expect(ausgangLesen().map((e) => e.schluessel)).toEqual([b]);
  });

  it('verwirft bei Überlauf die ältesten, nicht die neuesten', () => {
    for (let i = 0; i < 205; i++) ergebnisEintragen('quiz', i);
    const schlange = ausgangLesen();
    expect(schlange).toHaveLength(200);
    // Die gerade gespielte Runde zu verlieren täte am meisten weh.
    expect(schlange.at(-1)?.punkte).toBe(204);
    expect(schlange[0]?.punkte).toBe(5);
  });
});

describe('Bestwert über alle Geräte', () => {
  it('nimmt den höheren von hier und vom Server', () => {
    ergebnisEintragen('quiz', 40);
    expect(bestwert('quiz')).toBe(40);
    eigenenServerwertMerken('quiz', 90);
    expect(bestwert('quiz')).toBe(90);
  });

  it('lässt sich vom Server nicht nach unten ziehen', () => {
    eigenenServerwertMerken('quiz', 90);
    eigenenServerwertMerken('quiz', 30);
    expect(bestwert('quiz')).toBe(90);
  });

  it('ist ohne alles null', () => {
    expect(bestwert('quiz')).toBe(0);
  });
});

describe('Sitzung', () => {
  it('kommt unverändert zurück', () => {
    sitzungSchreiben(SITZUNG);
    expect(sitzungLesen()).toEqual(SITZUNG);
  });

  it('verwirft Bruchstücke ohne Erneuerungsmerkmal', () => {
    localStorage.setItem('spielesammlung:sitzung', JSON.stringify({ name: 'Florian' }));
    expect(sitzungLesen()).toBeNull();
  });

  it('überlebt „alle Punktestände löschen"', () => {
    sitzungSchreiben(SITZUNG);
    ergebnisEintragen('quiz', 10);
    eigenenServerwertMerken('quiz', 90);
    zuletztGespieltMerken('quiz');

    bestenlisteLoeschen();

    // Löschen ist Löschen — aber Abmelden ist eine eigene Handlung. Ohne
    // E-Mail-Adresse gibt es kein „Passwort vergessen".
    expect(sitzungLesen()).toEqual(SITZUNG);
    expect(bestenlisteLesen('quiz')).toEqual([]);
    expect(ausgangLesen()).toEqual([]);
    expect(bestwert('quiz')).toBe(0);
    expect(zuletztGespielt()).toBeUndefined();
  });

  it('löscht mit Spiel-id nur dieses eine Spiel', () => {
    ergebnisEintragen('quiz', 10);
    ergebnisEintragen('schlange', 20);
    bestenlisteLoeschen('quiz');
    expect(bestenlisteLesen('quiz')).toEqual([]);
    expect(bestenlisteLesen('schlange')).toHaveLength(1);
  });
});

describe('Zwischenspeicher für Serverlisten', () => {
  it('merkt sich die Daten mit einem Zeitstempel', () => {
    serverlisteSchreiben('bestenlisten', { gesamt: [{ name: 'Florian' }] });
    const gelesen = serverlisteLesen<{ gesamt: { name: string }[] }>('bestenlisten');
    expect(gelesen?.daten.gesamt[0]?.name).toBe('Florian');
    expect(Number.isNaN(new Date(gelesen?.stand ?? '').getTime())).toBe(false);
  });

  it('kennt einen unbekannten Schlüssel nicht', () => {
    expect(serverlisteLesen('gibtsnicht')).toBeNull();
  });
});

describe('Zuletzt gespielt', () => {
  it('nennt das zuletzt geöffnete Spiel', () => {
    zuletztGespieltMerken('quiz');
    zuletztGespieltMerken('schlange');
    expect(zuletztGespielt()).toBe('schlange');
  });
});
