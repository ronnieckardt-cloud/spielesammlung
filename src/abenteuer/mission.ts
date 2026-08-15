/**
 * Die erste Mission und das Dialogsystem.
 *
 * **Rein, ohne Uhr, ohne Speicher, ohne three.js.** Wer mit wem worüber
 * redet und was das am Missionsstand ändert, ist eine Frage von Zustand und
 * Übergang — genau die Sorte Frage, die ein Test beantworten soll.
 *
 * ## Eigene Figuren, eigene Namen
 *
 * Florianville ist ein eigenes Universum. Die Figuren hier sind erfunden:
 * Kurt Zange (Mechaniker mit ewig kaputtem Rasenmäher), Frau Brummel
 * (Nachbarin, weiß alles, meist falsch) und Leo (frech, schnell, hat immer
 * eine Bedingung). Kein Bezug auf bestehende Serien oder Spiele.
 *
 * ## Warum die Mission Phasen hat
 *
 * „Geh zu A, hol das Ding, komm zurück" ist die langweiligste Mission, die
 * es gibt — man weiß nach dem ersten Satz, wie es ausgeht. Diese hier hat
 * vier Abschnitte, und zwischen dem dritten und vierten kippt sie: Was wie
 * eine Suchaufgabe beginnt, endet mit einem Hinweis, dass jemand die Kiste
 * absichtlich verteilt hat. Das ist der Haken für alles Weitere.
 */

export type Phase = 'nicht-begonnen' | 'suchen' | 'zurueck' | 'fertig';

export type Missionsstand = {
  phase: Phase;
  /** Die ids der schon gefundenen Werkzeugteile. */
  teile: string[];
};

export const LEERE_MISSION: Missionsstand = { phase: 'nicht-begonnen', teile: [] };

/** Die drei Werkzeugteile, die im Viertel verteilt liegen. */
export const WERKZEUGE = [
  { id: 'wz-schluessel', name: 'Schraubenschlüssel' },
  { id: 'wz-zange', name: 'Kombizange' },
  { id: 'wz-hammer', name: 'Gummihammer' },
] as const;

export function missionBereinigen(roh: unknown): Missionsstand {
  const q = (roh ?? {}) as Partial<Missionsstand>;
  const gueltig: Phase[] = ['nicht-begonnen', 'suchen', 'zurueck', 'fertig'];
  // Ausdrücklich `Set<string>`: `WERKZEUGE` ist `as const`, sonst wäre die
  // Menge auf die drei bekannten Namen typisiert und `has` würde jeden
  // anderen Wert schon beim Übersetzen ablehnen — geprüft werden soll hier
  // aber gerade **unbekannter** Inhalt aus dem Speicher.
  const erlaubt = new Set<string>(WERKZEUGE.map((w) => w.id));
  const teile = Array.isArray(q.teile)
    ? [...new Set(q.teile.filter((t) => typeof t === 'string' && erlaubt.has(t)))]
    : [];
  const phase = gueltig.includes(q.phase as Phase) ? (q.phase as Phase) : 'nicht-begonnen';
  /*
   * Ein gespeicherter Stand kann in sich widersprüchlich sein — etwa Phase
   * `zurueck` ohne alle Teile, wenn eine ältere Fassung anders gezählt hat.
   * Dann lieber eine Phase zurückfallen als eine Mission, die sich nicht
   * mehr abschließen lässt.
   */
  if (phase === 'zurueck' && teile.length < WERKZEUGE.length) return { phase: 'suchen', teile };
  return { phase, teile };
}

// ---------------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------------

export type Zeile = { wer: string; text: string };

export type Dialog = {
  zeilen: readonly Zeile[];
  /**
   * Antwortmöglichkeiten am Ende. Die Auswahl ändert **nur den Ton**, nicht
   * den Ablauf — sonst bräuchte jede Mission einen Baum statt einer Kette,
   * und bei einer ersten Mission ist das Aufwand ohne Gewinn. Dass die
   * Antwort trotzdem eine eigene Erwiderung bekommt, ist der ganze Punkt:
   * Man merkt, dass jemand zugehört hat.
   */
  antworten?: readonly { text: string; erwiderung: Zeile }[];
};

export const NAMEN: Record<string, string> = {
  mechaniker: 'Kurt Zange',
  nachbarin: 'Frau Brummel',
  leo: 'Leo',
};

const KURT = NAMEN.mechaniker!;
const BRUMMEL = NAMEN.nachbarin!;
const LEO = NAMEN.leo!;

/** Was passiert, wenn man jemanden anspricht. */
export type Gespraech = {
  dialog: Dialog;
  /** Der Stand **danach**. */
  nachher: Missionsstand;
  /** Erfahrung, die dieses Gespräch einbringt. */
  xp: number;
  /** `true`, wenn die Mission gerade abgeschlossen wurde. */
  abgeschlossen: boolean;
};

export function ansprechen(stand: Missionsstand, npcId: string): Gespraech {
  const ohneAenderung = (dialog: Dialog): Gespraech => ({
    dialog,
    nachher: stand,
    xp: 0,
    abgeschlossen: false,
  });

  if (npcId === 'mechaniker') {
    if (stand.phase === 'nicht-begonnen') {
      return {
        dialog: {
          zeilen: [
            { wer: KURT, text: 'Na endlich, jemand mit Beinen! Meine Werkzeugkiste ist weg.' },
            { wer: KURT, text: 'Nicht die Kiste. Der Inhalt. Jemand hat drei Sachen im Viertel verteilt.' },
            { wer: KURT, text: 'Schraubenschlüssel, Kombizange, Gummihammer. Bring sie mir, ja?' },
          ],
          antworten: [
            {
              text: 'Mach ich!',
              erwiderung: { wer: KURT, text: 'Guter Junge. Schau hinter den Hecken nach.' },
            },
            {
              text: 'Und was krieg ich dafür?',
              erwiderung: {
                wer: KURT,
                text: 'Meinen ewigen Dank. Und ich erzähl dir nicht von meinem Rasenmäher.',
              },
            },
          ],
        },
        nachher: { ...stand, phase: 'suchen' },
        xp: 20,
        abgeschlossen: false,
      };
    }

    if (stand.phase === 'suchen') {
      const fehlt = WERKZEUGE.filter((w) => !stand.teile.includes(w.id));
      return ohneAenderung({
        zeilen: [
          { wer: KURT, text: `Noch nicht alles. Es fehlt: ${fehlt.map((f) => f.name).join(', ')}.` },
          { wer: KURT, text: 'Und nein, mein Rasenmäher ist immer noch kaputt.' },
        ],
      });
    }

    if (stand.phase === 'zurueck') {
      return {
        dialog: {
          zeilen: [
            { wer: KURT, text: 'Alle drei! Du bist schneller als mein Rasenmäher.' },
            { wer: KURT, text: 'Aber sag mal … lagen die wirklich einfach so herum?' },
            { wer: KURT, text: 'Die Kiste war abgeschlossen. Jemand hat sie aufgemacht.' },
            { wer: KURT, text: 'Und dann alles ordentlich verteilt. Wer macht denn so was?' },
          ],
          antworten: [
            {
              text: 'Ich finde es heraus.',
              erwiderung: { wer: KURT, text: 'Dachte ich mir. Pass auf dich auf, Kleiner.' },
            },
            {
              text: 'Vielleicht dein Rasenmäher?',
              erwiderung: { wer: KURT, text: 'Sehr witzig. Der steht seit April im Schuppen.' },
            },
          ],
        },
        nachher: { ...stand, phase: 'fertig' },
        xp: 120,
        abgeschlossen: true,
      };
    }

    return ohneAenderung({
      zeilen: [
        { wer: KURT, text: 'Alles wieder da, dank dir.' },
        { wer: KURT, text: 'Wenn du den findest, der das war — der schuldet mir ein Schloss.' },
      ],
    });
  }

  if (npcId === 'nachbarin') {
    if (stand.phase === 'nicht-begonnen') {
      return ohneAenderung({
        zeilen: [
          { wer: BRUMMEL, text: 'Heute Nacht war was los, sag ich dir!' },
          { wer: BRUMMEL, text: 'Erst ein Klappern, dann ein Rumpeln, dann gar nichts mehr.' },
          { wer: BRUMMEL, text: 'Wahrscheinlich Marder. Es ist immer der Marder.' },
        ],
      });
    }
    if (stand.phase === 'fertig') {
      return ohneAenderung({
        zeilen: [
          { wer: BRUMMEL, text: 'Du hast Kurts Werkzeug gefunden? Siehst du. Marder.' },
        ],
      });
    }
    return ohneAenderung({
      zeilen: [
        { wer: BRUMMEL, text: 'Kurts Werkzeug? Ja, da lag was hinter meiner Hecke.' },
        { wer: BRUMMEL, text: 'Ich fasse so etwas nicht an. Man weiß ja nie.' },
      ],
    });
  }

  if (npcId === 'leo') {
    if (stand.phase === 'nicht-begonnen') {
      return ohneAenderung({
        zeilen: [
          { wer: LEO, text: 'Hey! Wetten, du schaffst es nicht auf die Mülltonne?' },
          { wer: LEO, text: 'Da oben liegt ein Stern. Ich komm da nicht hoch.' },
        ],
      });
    }
    if (stand.phase === 'fertig') {
      return ohneAenderung({
        zeilen: [
          { wer: LEO, text: 'Alles gefunden? Nicht schlecht.' },
          { wer: LEO, text: 'Ich hab übrigens jemanden gesehen. Nachts. Mit einer Taschenlampe.' },
          { wer: LEO, text: 'Aber ich sag nichts. Noch nicht.' },
        ],
      });
    }
    return ohneAenderung({
      zeilen: [
        { wer: LEO, text: 'Kurts Werkzeug suchst du?' },
        { wer: LEO, text: 'Ich hab was blitzen sehen. Hinten in den Ecken vom Viertel.' },
        { wer: LEO, text: 'Aber gesagt hab ich nichts, klar?' },
      ],
    });
  }

  return ohneAenderung({ zeilen: [{ wer: '?', text: '…' }] });
}

// ---------------------------------------------------------------------
// Werkzeug einsammeln
// ---------------------------------------------------------------------

/**
 * Verbucht ein gefundenes Werkzeugteil.
 *
 * Der Übergang nach `zurueck` passiert **hier**, nicht beim Ansprechen:
 * Sonst müsste der Spieler erst mit Kurt reden, damit das Ziel oben
 * umspringt — und stünde bis dahin vor der Anzeige „noch 0 von 3 fehlen".
 */
export function teilGefunden(stand: Missionsstand, id: string): Missionsstand {
  if (stand.phase !== 'suchen') return stand;
  if (!WERKZEUGE.some((w) => w.id === id)) return stand;
  if (stand.teile.includes(id)) return stand;
  const teile = [...stand.teile, id];
  return { phase: teile.length >= WERKZEUGE.length ? 'zurueck' : 'suchen', teile };
}

/** Ob ein Werkzeugteil gerade in der Welt liegt. */
export function teilSichtbar(stand: Missionsstand, id: string): boolean {
  return stand.phase === 'suchen' && !stand.teile.includes(id);
}

// ---------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------

/** Das aktuelle Ziel für die Kopfzeile. `null` = kein laufendes Ziel. */
export function zielText(stand: Missionsstand): string | null {
  switch (stand.phase) {
    case 'nicht-begonnen':
      return 'Sprich mit jemandem im Viertel';
    case 'suchen':
      return `Werkzeug finden: ${stand.teile.length} von ${WERKZEUGE.length}`;
    case 'zurueck':
      return `Bring das Werkzeug zu ${KURT}`;
    case 'fertig':
      return null;
  }
}

/**
 * Das Zeichen über einem NPC.
 *
 * `!` heißt „hier geht etwas los", `?` heißt „hier geht es weiter", ein
 * Haken heißt „erledigt". **Formen, keine Farben** — dieselbe Regel wie
 * überall im Projekt; ein farbfehlsichtiges Kind soll die drei Zustände
 * unterscheiden können.
 */
export function marker(stand: Missionsstand, npcId: string): '!' | '?' | '✓' | null {
  if (npcId !== 'mechaniker') return null;
  switch (stand.phase) {
    case 'nicht-begonnen':
      return '!';
    case 'suchen':
      return '?';
    case 'zurueck':
      return '!';
    case 'fertig':
      return '✓';
  }
}
