import { describe, expect, it } from 'vitest';
import {
  OPTIONEN,
  abStufeVon,
  avatarBereinigen,
  freigeschaltet,
  voreingestellterAvatar,
} from './avatar';
import type { AvatarTeil } from './avatar';

const TEILE: readonly AvatarTeil[] = [
  'hautfarbe',
  'frisur',
  'haarfarbe',
  'oberteilSchnitt',
  'oberteil',
  'hosenSchnitt',
  'hose',
  'accessoire',
];

describe('freigeschaltet', () => {
  it('bei Stufe 1 ist für jedes Teil mindestens eine Option offen', () => {
    for (const teil of TEILE) {
      expect(freigeschaltet(teil, 1).length).toBeGreaterThan(0);
    }
  });

  it('bei Hautfarbe sind bei Stufe 1 bereits ALLE Optionen offen', () => {
    // Keine Belohnung, sondern eine Wahl — siehe avatar.ts.
    expect(freigeschaltet('hautfarbe', 1)).toEqual(OPTIONEN.hautfarbe.map((o) => o.id));
  });

  it('schaltet nichts frei, was noch nicht dran ist', () => {
    for (const teil of TEILE) {
      const spaeteste = Math.max(...OPTIONEN[teil].map((o) => o.abStufe));
      const kurzDavor = freigeschaltet(teil, spaeteste - 1);
      expect(kurzDavor.some((id) => abStufeVon(teil, id) === spaeteste)).toBe(false);
    }
  });

  it('schaltet nichts mehr aus, wenn die Stufe wieder sinkt (steigt monoton)', () => {
    for (const teil of TEILE) {
      let vorher: readonly string[] = [];
      for (let stufe = 1; stufe <= 20; stufe++) {
        const jetzt = freigeschaltet(teil, stufe);
        for (const id of vorher) expect(jetzt).toContain(id);
        vorher = jetzt;
      }
    }
  });

  it('am Ende sind alle Optionen eines Teils erreichbar', () => {
    for (const teil of TEILE) {
      const alle = OPTIONEN[teil].map((o) => o.id);
      expect(freigeschaltet(teil, 200)).toEqual(alle);
    }
  });
});

describe('voreingestellterAvatar', () => {
  it('benutzt für jedes Teil nur Optionen, die ab Stufe 1 offen sind', () => {
    const start = voreingestellterAvatar();
    for (const teil of TEILE) {
      expect(freigeschaltet(teil, 1)).toContain(start[teil]);
    }
  });
});

describe('avatarBereinigen', () => {
  it('liefert die Voreinstellung, wenn nichts gespeichert ist', () => {
    expect(avatarBereinigen(null, 1)).toEqual(voreingestellterAvatar());
    expect(avatarBereinigen(undefined, 1)).toEqual(voreingestellterAvatar());
  });

  it('übernimmt einen gültigen, freigeschalteten Wert', () => {
    const ergebnis = avatarBereinigen({ oberteil: 'orange' }, 3);
    expect(ergebnis.oberteil).toBe('orange');
  });

  it('fällt auf die Voreinstellung zurück, wenn die Stufe zu niedrig ist', () => {
    // 'gold' braucht bei oberteil Stufe 12 — bei Stufe 3 gesperrt.
    const ergebnis = avatarBereinigen({ oberteil: 'gold' }, 3);
    expect(ergebnis.oberteil).toBe(voreingestellterAvatar().oberteil);
  });

  it('ignoriert erfundene Teile-Werte', () => {
    const ergebnis = avatarBereinigen({ oberteil: 'unsichtbar-lila-kariert' }, 50);
    expect(ergebnis.oberteil).toBe(voreingestellterAvatar().oberteil);
  });

  it('übersteht kaputte oder fremde Eingaben, ohne zu werfen', () => {
    for (const kaputt of [null, undefined, 42, 'text', [], true, { oberteil: 123 }]) {
      expect(() => avatarBereinigen(kaputt, 5)).not.toThrow();
    }
  });

  it('lässt einen einmal freigeschalteten Wert bei fallender Stufe nicht verschwinden', () => {
    // Die Stufe fällt in der App nie — aber die Funktion soll trotzdem nie
    // einen Wert liefern, der bei der ÜBERGEBENEN Stufe gesperrt ist.
    const hoch = avatarBereinigen({ oberteil: 'gold' }, 12);
    expect(hoch.oberteil).toBe('gold');
    const wiederNiedrig = avatarBereinigen({ oberteil: 'gold' }, 5);
    expect(wiederNiedrig.oberteil).not.toBe('gold');
  });

  it('räumt alle acht Teile unabhängig voneinander auf', () => {
    const ergebnis = avatarBereinigen(
      {
        hautfarbe: 'dunkel', // immer erlaubt, bleibt stehen
        frisur: 'irokese', // Stufe 12, bei Stufe 1 gesperrt
        haarfarbe: 'pink', // Stufe 9, gesperrt
        oberteilSchnitt: 'pulli', // Stufe 10, gesperrt
        oberteil: 'gold', // Stufe 12, gesperrt
        hosenSchnitt: 'rock', // Stufe 7, gesperrt
        hose: 'gold', // Stufe 13, gesperrt
        accessoire: 'krone', // Stufe 15, gesperrt
      },
      1,
    );
    const voreinstellung = voreingestellterAvatar();
    // Hautfarbe bleibt erhalten — sie ist nie gesperrt.
    expect(ergebnis.hautfarbe).toBe('dunkel');
    // Alles andere fällt zurück, weil bei Stufe 1 gesperrt.
    expect(ergebnis.frisur).toBe(voreinstellung.frisur);
    expect(ergebnis.haarfarbe).toBe(voreinstellung.haarfarbe);
    expect(ergebnis.oberteilSchnitt).toBe(voreinstellung.oberteilSchnitt);
    expect(ergebnis.oberteil).toBe(voreinstellung.oberteil);
    expect(ergebnis.hosenSchnitt).toBe(voreinstellung.hosenSchnitt);
    expect(ergebnis.hose).toBe(voreinstellung.hose);
    expect(ergebnis.accessoire).toBe(voreinstellung.accessoire);
  });
});

describe('OPTIONEN', () => {
  it('jedes Teil hat mindestens eine Option ab Stufe 1', () => {
    for (const teil of TEILE) {
      expect(OPTIONEN[teil].some((o) => o.abStufe === 1)).toBe(true);
    }
  });

  it('keine doppelten ids innerhalb eines Teils', () => {
    for (const teil of TEILE) {
      const ids = OPTIONEN[teil].map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('accessoire kennt „keins" als wählbare, keine Verlegenheits-Option', () => {
    expect(OPTIONEN.accessoire[0]!.id).toBe('keins');
    expect(OPTIONEN.accessoire[0]!.abStufe).toBe(1);
  });

  it('frisur kennt „kahl" als wählbare Option, nicht nur als Leerzustand', () => {
    expect(OPTIONEN.frisur.some((o) => o.id === 'kahl' && o.abStufe === 1)).toBe(true);
  });
});
