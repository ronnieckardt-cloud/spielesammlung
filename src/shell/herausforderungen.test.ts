import { describe, expect, it } from 'vitest';
import {
  LEERER_TAG,
  istGeschafft,
  rundeVerbuchen,
  standFuer,
  standFuerHeute,
  tagesaufgaben,
  tagesstandBereinigen,
  type Aufgabe,
  type Tagesstand,
} from './herausforderungen';

const SPIELE = [
  { id: 'quiz', title: 'Quiz Time' },
  { id: 'schlange', title: 'Snake Rush' },
  { id: 'paare', title: 'Pair Up' },
  { id: 'laufen', title: 'Dash City' },
];

const RUNDE = { spielId: 'quiz', gewonnen: false, sterne: 1 as const, bestleistung: false };

describe('Tagesaufgaben', () => {
  it('sind für denselben Tag immer dieselben', () => {
    const a = tagesaufgaben('2026-08-15', SPIELE);
    const b = tagesaufgaben('2026-08-15', SPIELE);
    expect(a).toEqual(b);
  });

  it('unterscheiden sich von Tag zu Tag', () => {
    // Über zwei Wochen darf nicht jeden Tag dasselbe herauskommen.
    const tage = Array.from({ length: 14 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const fingerabdruecke = new Set(
      tage.map((t) => tagesaufgaben(t, SPIELE).map((a) => `${a.art}:${a.ziel}`).join('|')),
    );
    expect(fingerabdruecke.size).toBeGreaterThan(4);
  });

  it('sind immer genau drei mit eindeutigen ids', () => {
    for (let i = 1; i <= 60; i++) {
      const tag = `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      const aufgaben = tagesaufgaben(tag, SPIELE);
      expect(aufgaben).toHaveLength(3);
      expect(new Set(aufgaben.map((a) => a.id)).size).toBe(3);
    }
  });

  it('bringen immer mindestens eine Aufgabe, die reines Spielen erledigt', () => {
    // Ohne das könnte ein Tag drei Aufgaben bringen, von denen keine sicher
    // zu schaffen ist — dann ist das Ganze Frust statt Anreiz.
    for (let i = 1; i <= 60; i++) {
      const tag = `2027-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      const aufgaben = tagesaufgaben(tag, SPIELE);
      expect(aufgaben.some((a) => a.art === 'runden')).toBe(true);
    }
  });

  it('wiederholt keine Aufgabenart am selben Tag', () => {
    for (let i = 1; i <= 60; i++) {
      const tag = `2028-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      const arten = tagesaufgaben(tag, SPIELE).map((a) => a.art);
      expect(new Set(arten).size).toBe(arten.length);
    }
  });

  it('zeigt bei „spiele ein bestimmtes Spiel" auf ein Spiel, das es gibt', () => {
    const ids = new Set(SPIELE.map((s) => s.id));
    for (let i = 1; i <= 60; i++) {
      const tag = `2029-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      for (const a of tagesaufgaben(tag, SPIELE)) {
        if (a.art === 'spiel') {
          expect(a.spielId).toBeDefined();
          expect(ids.has(a.spielId!)).toBe(true);
          expect(a.text).toContain(SPIELE.find((s) => s.id === a.spielId)!.title);
        }
      }
    }
  });

  it('kommt auch ohne Spieleliste zurecht', () => {
    const aufgaben = tagesaufgaben('2026-08-15', []);
    expect(aufgaben).toHaveLength(3);
    expect(aufgaben.every((a) => a.art !== 'spiel')).toBe(true);
  });

  it('hat für jede Aufgabe Text, Ziel und Erfahrung', () => {
    for (const a of tagesaufgaben('2026-08-15', SPIELE)) {
      expect(a.text.length).toBeGreaterThan(0);
      expect(a.symbol.length).toBeGreaterThan(0);
      expect(a.ziel).toBeGreaterThan(0);
      expect(a.xp).toBeGreaterThan(0);
    }
  });
});

describe('Runden verbuchen', () => {
  const dreiRunden: Aufgabe = {
    id: 'a', art: 'runden', text: '', symbol: '', ziel: 3, xp: 30,
  };
  const zweiSpiele: Aufgabe = {
    id: 'b', art: 'verschiedene', text: '', symbol: '', ziel: 2, xp: 35,
  };
  const einSieg: Aufgabe = { id: 'c', art: 'sieg', text: '', symbol: '', ziel: 1, xp: 45 };

  it('zählt Runden, Sterne, Siege und Bestleistungen', () => {
    const a = rundeVerbuchen(
      LEERER_TAG,
      [],
      { spielId: 'quiz', gewonnen: true, sterne: 3, bestleistung: true },
      '2026-08-15',
    );
    expect(a.stand).toMatchObject({
      tag: '2026-08-15', runden: 1, sterne: 3, siege: 1, bestleistungen: 1,
    });
    expect(a.stand.spieleHeute).toEqual(['quiz']);
  });

  it('zählt dasselbe Spiel nicht doppelt als „verschiedenes"', () => {
    let stand = rundeVerbuchen(LEERER_TAG, [], RUNDE, '2026-08-15').stand;
    stand = rundeVerbuchen(stand, [], RUNDE, '2026-08-15').stand;
    expect(stand.runden).toBe(2);
    expect(stand.spieleHeute).toEqual(['quiz']);
  });

  it('meldet eine Aufgabe genau in der Runde, die sie fertig macht', () => {
    let stand = LEERER_TAG;
    for (let i = 0; i < 2; i++) {
      const a = rundeVerbuchen(stand, [dreiRunden], RUNDE, '2026-08-15');
      expect(a.fertig).toHaveLength(0);
      stand = a.stand;
    }
    const dritte = rundeVerbuchen(stand, [dreiRunden], RUNDE, '2026-08-15');
    expect(dritte.fertig.map((a) => a.id)).toEqual(['a']);
    expect(dritte.xp).toBe(30);
  });

  it('meldet eine erledigte Aufgabe kein zweites Mal', () => {
    let stand = LEERER_TAG;
    for (let i = 0; i < 3; i++) {
      stand = rundeVerbuchen(stand, [dreiRunden], RUNDE, '2026-08-15').stand;
    }
    const weitere = rundeVerbuchen(stand, [dreiRunden], RUNDE, '2026-08-15');
    expect(weitere.fertig).toHaveLength(0);
    expect(weitere.xp).toBe(0);
  });

  it('kann mehrere Aufgaben in einer Runde fertig machen', () => {
    const stand = rundeVerbuchen(LEERER_TAG, [zweiSpiele, einSieg], RUNDE, '2026-08-15').stand;
    const zweite = rundeVerbuchen(
      stand,
      [zweiSpiele, einSieg],
      { spielId: 'paare', gewonnen: true, sterne: 3, bestleistung: false },
      '2026-08-15',
    );
    expect(zweite.fertig.map((a) => a.id).sort()).toEqual(['b', 'c']);
    expect(zweite.xp).toBe(80);
  });

  it('fängt an einem neuen Tag bei null an', () => {
    let stand = LEERER_TAG;
    for (let i = 0; i < 3; i++) {
      stand = rundeVerbuchen(stand, [dreiRunden], RUNDE, '2026-08-15').stand;
    }
    expect(stand.runden).toBe(3);
    expect(stand.erledigt).toContain('a');

    const morgen = rundeVerbuchen(stand, [dreiRunden], RUNDE, '2026-08-16');
    expect(morgen.stand.tag).toBe('2026-08-16');
    expect(morgen.stand.runden).toBe(1);
    expect(morgen.stand.sterne).toBe(1);
    expect(morgen.stand.spieleHeute).toEqual(['quiz']);
    // Die alte Erledigt-Liste darf nicht mitwandern, sonst gilt die neue
    // Aufgabe mit gleicher id sofort als geschafft.
    expect(morgen.stand.erledigt).not.toContain('a');
  });
});

describe('Stand ablesen', () => {
  const stand: Tagesstand = {
    tag: '2026-08-15', runden: 2, sterne: 5, siege: 1, bestleistungen: 0,
    spieleHeute: ['quiz', 'paare'], erledigt: [],
  };
  const auf = (art: Aufgabe['art'], ziel: number, spielId?: string): Aufgabe => ({
    id: 'x', art, text: '', symbol: '', ziel, xp: 10, ...(spielId ? { spielId } : {}),
  });

  it('liest jede Art richtig ab', () => {
    expect(standFuer(stand, auf('runden', 3))).toBe(2);
    expect(standFuer(stand, auf('sterne', 6))).toBe(5);
    expect(standFuer(stand, auf('verschiedene', 3))).toBe(2);
    expect(standFuer(stand, auf('sieg', 1))).toBe(1);
    expect(standFuer(stand, auf('bestleistung', 1))).toBe(0);
    expect(standFuer(stand, auf('spiel', 1, 'paare'))).toBe(1);
    expect(standFuer(stand, auf('spiel', 1, 'laufen'))).toBe(0);
  });

  it('erkennt geschafft ab dem Ziel, nicht davor', () => {
    expect(istGeschafft(stand, auf('runden', 2))).toBe(true);
    expect(istGeschafft(stand, auf('runden', 3))).toBe(false);
  });

  it('setzt den Stand an einem neuen Tag zurück', () => {
    expect(standFuerHeute(stand, '2026-08-15')).toBe(stand);
    const neu = standFuerHeute(stand, '2026-08-16');
    expect(neu.runden).toBe(0);
    expect(neu.tag).toBe('2026-08-16');
  });
});

describe('Gespeichertes bereinigen', () => {
  it('macht aus Unsinn einen brauchbaren Stand', () => {
    for (const muell of [null, undefined, 7, 'text', []]) {
      const s = tagesstandBereinigen(muell);
      expect(s.runden).toBe(0);
      expect(s.spieleHeute).toEqual([]);
      expect(s.erledigt).toEqual([]);
    }
  });

  it('entfernt Doppelte und ungültige Werte', () => {
    const s = tagesstandBereinigen({
      tag: '2026-08-15',
      runden: -3,
      sterne: 4.8,
      spieleHeute: ['quiz', 'quiz', 5, null, 'paare'],
      erledigt: ['a', 9],
    });
    expect(s.runden).toBe(0);
    expect(s.sterne).toBe(4);
    expect(s.spieleHeute).toEqual(['quiz', 'paare']);
    expect(s.erledigt).toEqual(['a']);
  });
});
