import { describe, expect, it } from 'vitest';
import {
  LEERE_MISSION,
  NAMEN,
  WERKZEUGE,
  ansprechen,
  marker,
  missionBereinigen,
  teilGefunden,
  teilSichtbar,
  zielText,
  type Missionsstand,
} from './mission';

/** Spielt die Mission von vorn bis hinten durch. */
function durchspielen(): Missionsstand {
  let stand = ansprechen(LEERE_MISSION, 'mechaniker').nachher;
  for (const w of WERKZEUGE) stand = teilGefunden(stand, w.id);
  return ansprechen(stand, 'mechaniker').nachher;
}

describe('Missionsablauf', () => {
  it('beginnt erst beim Ansprechen des Mechanikers', () => {
    expect(LEERE_MISSION.phase).toBe('nicht-begonnen');
    // Mit den anderen zu reden startet sie nicht.
    expect(ansprechen(LEERE_MISSION, 'leo').nachher.phase).toBe('nicht-begonnen');
    expect(ansprechen(LEERE_MISSION, 'nachbarin').nachher.phase).toBe('nicht-begonnen');
    expect(ansprechen(LEERE_MISSION, 'mechaniker').nachher.phase).toBe('suchen');
  });

  it('springt erst auf „zurück", wenn wirklich alles gefunden ist', () => {
    let stand = ansprechen(LEERE_MISSION, 'mechaniker').nachher;
    for (let i = 0; i < WERKZEUGE.length - 1; i++) {
      stand = teilGefunden(stand, WERKZEUGE[i]!.id);
      expect(stand.phase).toBe('suchen');
    }
    stand = teilGefunden(stand, WERKZEUGE[WERKZEUGE.length - 1]!.id);
    expect(stand.phase).toBe('zurueck');
  });

  it('zählt dasselbe Teil nicht doppelt', () => {
    let stand = ansprechen(LEERE_MISSION, 'mechaniker').nachher;
    stand = teilGefunden(stand, WERKZEUGE[0]!.id);
    stand = teilGefunden(stand, WERKZEUGE[0]!.id);
    expect(stand.teile).toEqual([WERKZEUGE[0]!.id]);
    expect(stand.phase).toBe('suchen');
  });

  it('nimmt kein Teil an, bevor die Mission läuft', () => {
    const stand = teilGefunden(LEERE_MISSION, WERKZEUGE[0]!.id);
    expect(stand).toEqual(LEERE_MISSION);
  });

  it('nimmt nichts an, was gar kein Werkzeug ist', () => {
    const start = ansprechen(LEERE_MISSION, 'mechaniker').nachher;
    expect(teilGefunden(start, 'st-1')).toEqual(start);
  });

  it('schließt beim zweiten Gespräch mit dem Mechaniker ab', () => {
    let stand = ansprechen(LEERE_MISSION, 'mechaniker').nachher;
    for (const w of WERKZEUGE) stand = teilGefunden(stand, w.id);
    const g = ansprechen(stand, 'mechaniker');
    expect(g.abgeschlossen).toBe(true);
    expect(g.nachher.phase).toBe('fertig');
    expect(g.xp).toBeGreaterThan(0);
  });

  it('gibt die Abschluss-Erfahrung nur einmal', () => {
    const fertig = durchspielen();
    const nochmal = ansprechen(fertig, 'mechaniker');
    expect(nochmal.xp).toBe(0);
    expect(nochmal.abgeschlossen).toBe(false);
    expect(nochmal.nachher.phase).toBe('fertig');
  });

  it('gibt die Start-Erfahrung nur einmal', () => {
    const erstes = ansprechen(LEERE_MISSION, 'mechaniker');
    expect(erstes.xp).toBeGreaterThan(0);
    const zweites = ansprechen(erstes.nachher, 'mechaniker');
    expect(zweites.xp).toBe(0);
  });
});

describe('Dialoge', () => {
  it('haben immer mindestens eine Zeile mit Sprecher und Text', () => {
    const staende: Missionsstand[] = [
      LEERE_MISSION,
      { phase: 'suchen', teile: [] },
      { phase: 'suchen', teile: [WERKZEUGE[0]!.id] },
      { phase: 'zurueck', teile: WERKZEUGE.map((w) => w.id) },
      { phase: 'fertig', teile: WERKZEUGE.map((w) => w.id) },
    ];
    for (const stand of staende) {
      for (const npc of ['mechaniker', 'nachbarin', 'leo']) {
        const d = ansprechen(stand, npc).dialog;
        expect(d.zeilen.length).toBeGreaterThan(0);
        for (const z of d.zeilen) {
          expect(z.wer.length).toBeGreaterThan(0);
          expect(z.text.length).toBeGreaterThan(0);
        }
        for (const a of d.antworten ?? []) {
          expect(a.text.length).toBeGreaterThan(0);
          expect(a.erwiderung.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('nennt beim Suchen genau die Teile, die noch fehlen', () => {
    const stand: Missionsstand = { phase: 'suchen', teile: [WERKZEUGE[0]!.id] };
    const text = ansprechen(stand, 'mechaniker').dialog.zeilen[0]!.text;
    expect(text).toContain(WERKZEUGE[1]!.name);
    expect(text).toContain(WERKZEUGE[2]!.name);
    expect(text).not.toContain(WERKZEUGE[0]!.name);
  });

  it('ändert den Ton je nach Missionsstand', () => {
    const vorher = ansprechen(LEERE_MISSION, 'leo').dialog.zeilen[0]!.text;
    const nachher = ansprechen(durchspielen(), 'leo').dialog.zeilen[0]!.text;
    expect(vorher).not.toBe(nachher);
  });

  it('kennt jeden NPC des Viertels beim Namen', () => {
    for (const id of ['mechaniker', 'nachbarin', 'leo']) {
      expect(NAMEN[id]).toBeTruthy();
      // Der Sprecher im Dialog muss derselbe Name sein.
      expect(ansprechen(LEERE_MISSION, id).dialog.zeilen[0]!.wer).toBe(NAMEN[id]);
    }
  });

  it('bleibt bei einem unbekannten Gegenüber ruhig', () => {
    const g = ansprechen(LEERE_MISSION, 'gibt-es-nicht');
    expect(g.dialog.zeilen.length).toBeGreaterThan(0);
    expect(g.nachher).toEqual(LEERE_MISSION);
    expect(g.xp).toBe(0);
  });
});

describe('Anzeige', () => {
  it('zeigt in jeder Phase ein sinnvolles Ziel — außer am Ende', () => {
    expect(zielText(LEERE_MISSION)).toBeTruthy();
    expect(zielText({ phase: 'suchen', teile: [] })).toContain('0 von 3');
    expect(zielText({ phase: 'suchen', teile: [WERKZEUGE[0]!.id] })).toContain('1 von 3');
    expect(zielText({ phase: 'zurueck', teile: [] })).toContain(NAMEN.mechaniker!);
    expect(zielText({ phase: 'fertig', teile: [] })).toBeNull();
  });

  it('setzt das Zeichen nur über den Mechaniker', () => {
    expect(marker(LEERE_MISSION, 'nachbarin')).toBeNull();
    expect(marker(LEERE_MISSION, 'leo')).toBeNull();
    expect(marker(LEERE_MISSION, 'mechaniker')).toBe('!');
    expect(marker({ phase: 'suchen', teile: [] }, 'mechaniker')).toBe('?');
    expect(marker({ phase: 'zurueck', teile: [] }, 'mechaniker')).toBe('!');
    expect(marker({ phase: 'fertig', teile: [] }, 'mechaniker')).toBe('✓');
  });

  it('zeigt Werkzeug nur, solange gesucht wird', () => {
    const id = WERKZEUGE[0]!.id;
    expect(teilSichtbar(LEERE_MISSION, id)).toBe(false);
    expect(teilSichtbar({ phase: 'suchen', teile: [] }, id)).toBe(true);
    expect(teilSichtbar({ phase: 'suchen', teile: [id] }, id)).toBe(false);
    expect(teilSichtbar({ phase: 'fertig', teile: [] }, id)).toBe(false);
  });
});

describe('Gespeichertes bereinigen', () => {
  it('macht aus Unsinn einen brauchbaren Stand', () => {
    for (const muell of [null, undefined, 5, 'text', [], { phase: 'quatsch' }]) {
      expect(missionBereinigen(muell)).toEqual(LEERE_MISSION);
    }
  });

  it('wirft erfundene Teile weg und entfernt Doppelte', () => {
    const s = missionBereinigen({
      phase: 'suchen',
      teile: [WERKZEUGE[0]!.id, WERKZEUGE[0]!.id, 'erfunden', 42],
    });
    expect(s.teile).toEqual([WERKZEUGE[0]!.id]);
  });

  it('rettet einen widersprüchlichen Stand, statt ihn unlösbar zu lassen', () => {
    // Phase „zurück" ohne alle Teile wäre eine Sackgasse: Kurt gratuliert,
    // aber der Zähler stimmt nicht — und die Mission ließe sich nie sauber
    // abschließen. Also lieber eine Phase zurück.
    const s = missionBereinigen({ phase: 'zurueck', teile: [WERKZEUGE[0]!.id] });
    expect(s.phase).toBe('suchen');
  });

  it('lässt einen gültigen Stand unverändert durch', () => {
    const fertig = durchspielen();
    expect(missionBereinigen(fertig)).toEqual(fertig);
  });
});
