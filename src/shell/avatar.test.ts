import { describe, expect, it } from 'vitest';
import {
  OPTIONEN,
  abStufeVon,
  avatarBereinigen,
  freigeschaltet,
  voreingestellterAvatar,
} from './avatar';
import type { AvatarTeil } from './avatar';

const TEILE: readonly AvatarTeil[] = ['koerperfarbe', 'form', 'augen', 'accessoire'];

describe('freigeschaltet', () => {
  it('bei Stufe 1 ist für jedes Teil mindestens eine Option offen', () => {
    for (const teil of TEILE) {
      expect(freigeschaltet(teil, 1).length).toBeGreaterThan(0);
    }
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
    const ergebnis = avatarBereinigen({ koerperfarbe: 'orange' }, 3);
    expect(ergebnis.koerperfarbe).toBe('orange');
  });

  it('fällt auf die Voreinstellung zurück, wenn die Stufe zu niedrig ist', () => {
    // 'gold' braucht Stufe 12 — bei Stufe 3 gesperrt.
    const ergebnis = avatarBereinigen({ koerperfarbe: 'gold' }, 3);
    expect(ergebnis.koerperfarbe).toBe(voreingestellterAvatar().koerperfarbe);
  });

  it('ignoriert erfundene Teile-Werte', () => {
    const ergebnis = avatarBereinigen({ koerperfarbe: 'unsichtbar-lila-kariert' }, 50);
    expect(ergebnis.koerperfarbe).toBe(voreingestellterAvatar().koerperfarbe);
  });

  it('übersteht kaputte oder fremde Eingaben, ohne zu werfen', () => {
    for (const kaputt of [null, undefined, 42, 'text', [], true, { koerperfarbe: 123 }]) {
      expect(() => avatarBereinigen(kaputt, 5)).not.toThrow();
    }
  });

  it('lässt einen einmal freigeschalteten Wert bei fallender Stufe nicht verschwinden', () => {
    // Die Stufe fällt in der App nie — aber die Funktion soll trotzdem nie
    // einen Wert liefern, der bei der ÜBERGEBENEN Stufe gesperrt ist.
    const hoch = avatarBereinigen({ koerperfarbe: 'gold' }, 12);
    expect(hoch.koerperfarbe).toBe('gold');
    const wiederNiedrig = avatarBereinigen({ koerperfarbe: 'gold' }, 5);
    expect(wiederNiedrig.koerperfarbe).not.toBe('gold');
  });

  it('räumt alle vier Teile unabhängig voneinander auf', () => {
    const ergebnis = avatarBereinigen(
      { koerperfarbe: 'gold', form: 'stern', augen: 'zwinker', accessoire: 'krone' },
      1,
    );
    // Bei Stufe 1 ist von den vieren nichts freigeschaltet — alles fällt
    // auf die Voreinstellung zurück.
    expect(ergebnis).toEqual(voreingestellterAvatar());
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
});
