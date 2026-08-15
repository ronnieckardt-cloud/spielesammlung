import type { Einstellungen } from '../core/types';
import { fortschrittBereinigen, type Fortschritt } from './fortschritt';

/**
 * Der einzige Ort im Projekt, der localStorage anfassen darf.
 *
 * Spiele bekommen ihre Punkte über onScore/onGameOver zurückgemeldet und
 * wissen nichts von Speicherung. Später kann hier zusätzlich eine
 * geräteübergreifende Bestenliste andocken, ohne dass ein Spiel sich ändert.
 */

const PRAEFIX = 'spielesammlung:';
const EINTRAEGE_PRO_SPIEL = 5;

export type Eintrag = { punkte: number; datum: string };

function lesen<T>(schluessel: string, standard: T): T {
  try {
    const roh = localStorage.getItem(PRAEFIX + schluessel);
    return roh === null ? standard : (JSON.parse(roh) as T);
  } catch {
    // Privater Modus oder voller Speicher — dann eben ohne.
    return standard;
  }
}

function schreiben(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(PRAEFIX + schluessel, JSON.stringify(wert));
  } catch {
    /* absichtlich still */
  }
}

export function bestenlisteLesen(spielId: string): Eintrag[] {
  const liste = lesen<Eintrag[]>(`beste:${spielId}`, []);
  return Array.isArray(liste) ? liste : [];
}

/**
 * Die beste je erreichte Punktzahl.
 *
 * Seit es Konten gibt, ist das das Maximum aus dem, was auf **diesem** Gerät
 * liegt, und dem, was der Server für dieses Konto kennt. Die Bedeutung
 * ändert sich damit (Bestwert über alle Geräte statt nur über dieses), die
 * Signatur nicht — für Block Bursts Startbildschirm bleibt alles wie es
 * war, die Zahl wird nur richtiger.
 */
export function bestwert(spielId: string): number {
  const oertlich = bestenlisteLesen(spielId)[0]?.punkte ?? 0;
  const vomServer = lesen<Record<string, number>>(EIGENE_SERVERWERTE, {})[spielId] ?? 0;
  return Math.max(oertlich, vomServer);
}

/**
 * Trägt ein Ergebnis ein und gibt die neue Liste zurück.
 *
 * Schreibt zusätzlich in die **Ausgangsschlange**. Das ist der Kern des
 * Offline-Versprechens: Die Runde ist sofort gespeichert, ob mit Netz oder
 * ohne, und der Absender räumt die Schlange später ab. Kein Spielablauf
 * wartet je auf den Server.
 *
 * Der mitgegebene `schluessel` ist der Ausgangs-Schlüssel **genau dieser**
 * Runde. Der Rahmen braucht ihn, um am Rundenende den Platz für sie zu
 * erfragen — „irgendein Eintrag dieses Spiels aus der Schlange" wäre falsch,
 * wenn dort noch eine ältere Runde liegt, die offline aufgelaufen ist.
 */
export function ergebnisEintragen(
  spielId: string,
  punkte: number,
): { liste: Eintrag[]; schluessel: string } {
  const datum = new Date().toISOString();
  const liste = [...bestenlisteLesen(spielId), { punkte, datum }]
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, EINTRAEGE_PRO_SPIEL);
  schreiben(`beste:${spielId}`, liste);
  const schluessel = neuerSchluessel();
  ausgangAnhaengen({ spiel: spielId, punkte, gespieltAm: datum, schluessel });
  return { liste, schluessel };
}

// ---------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------

const SITZUNG = 'sitzung';
const AUSGANG = 'ausgang';
const EIGENE_SERVERWERTE = 'serverbestwerte';
const SERVERLISTE = 'serverliste';

/** Was von der Anmeldung übrig bleibt, wenn die App geschlossen wird. */
export type GespeicherteSitzung = {
  zugriffsmerkmal: string;
  erneuerungsmerkmal: string;
  laeuftAb: number;
  benutzerId: string;
  name: string;
};

export function sitzungLesen(): GespeicherteSitzung | null {
  const s = lesen<GespeicherteSitzung | null>(SITZUNG, null);
  return s && typeof s.erneuerungsmerkmal === 'string' ? s : null;
}

export function sitzungSchreiben(sitzung: GespeicherteSitzung | null): void {
  if (sitzung) schreiben(SITZUNG, sitzung);
  else {
    try {
      localStorage.removeItem(PRAEFIX + SITZUNG);
    } catch {
      /* absichtlich still */
    }
  }
}

// ---------------------------------------------------------------------
// Ausgangsschlange
// ---------------------------------------------------------------------

/** Eine Runde, die noch zum Server soll. */
export type AusgangsEintrag = {
  spiel: string;
  punkte: number;
  gespieltAm: string;
  /**
   * Eindeutig je Runde und Gerät. Der Server hat darauf eine
   * Eindeutigkeitsregel — dadurch ist ein Wiederholungsversuch völlig
   * ungefährlich, egal wie oft der Absender es probiert.
   */
  schluessel: string;
};

/** Mehr als das hebt niemand auf — sonst wächst die Schlange endlos. */
const AUSGANG_MAX = 200;

function neuerSchluessel(): string {
  // `crypto.randomUUID` gibt es in allen Zielbrowsern; der Rückfall ist nur
  // für sehr alte Umgebungen und muss nicht schön sein.
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function ausgangLesen(): AusgangsEintrag[] {
  const liste = lesen<AusgangsEintrag[]>(AUSGANG, []);
  return Array.isArray(liste) ? liste : [];
}

function ausgangAnhaengen(eintrag: AusgangsEintrag): void {
  // Ältesten zuerst verwerfen: Eine alte Runde zu verlieren tut weniger weh
  // als die gerade gespielte.
  schreiben(AUSGANG, [...ausgangLesen(), eintrag].slice(-AUSGANG_MAX));
}

export function ausgangErledigt(schluessel: string): void {
  schreiben(
    AUSGANG,
    ausgangLesen().filter((e) => e.schluessel !== schluessel),
  );
}

// ---------------------------------------------------------------------
// Was vom Server kam
// ---------------------------------------------------------------------

/** Merkt sich den eigenen Bestwert je Spiel, damit `bestwert` ihn kennt. */
export function eigenenServerwertMerken(spielId: string, punkte: number): void {
  const alle = lesen<Record<string, number>>(EIGENE_SERVERWERTE, {});
  if ((alle[spielId] ?? 0) >= punkte) return;
  schreiben(EIGENE_SERVERWERTE, { ...alle, [spielId]: punkte });
}

/**
 * Die zuletzt geholte Bestenliste, mit Zeitstempel.
 *
 * Damit steht offline „Stand: gestern 18:04" da statt eines hängenden
 * Ladekreisels. Es ist immer etwas zu sehen.
 *
 * Bewusst hier und nicht im Service Worker: Der steigt bei fremden Adressen
 * ohnehin aus, und Bestenlisten dürfen auch gar nicht in seinen Speicher —
 * sonst liefert er nach einem Update alte Ranglisten aus.
 */
export function serverlisteLesen<T>(schluessel: string): { stand: string; daten: T } | null {
  const alle = lesen<Record<string, { stand: string; daten: T }>>(SERVERLISTE, {});
  return alle[schluessel] ?? null;
}

export function serverlisteSchreiben<T>(schluessel: string, daten: T): void {
  const alle = lesen<Record<string, unknown>>(SERVERLISTE, {});
  schreiben(SERVERLISTE, { ...alle, [schluessel]: { stand: new Date().toISOString(), daten } });
}

export function bestenlisteLoeschen(spielId?: string): void {
  try {
    if (spielId) {
      localStorage.removeItem(`${PRAEFIX}beste:${spielId}`);
      return;
    }
    for (const schluessel of Object.keys(localStorage)) {
      if (schluessel.startsWith(`${PRAEFIX}beste:`)) localStorage.removeItem(schluessel);
    }
    // Beim großen Aufräumen muss auch das Weiterspielen-Angebot weg —
    // sonst bietet die Startseite nach dem „alles löschen" weiter ein
    // Spiel an, zu dem es gar keine Daten mehr gibt.
    localStorage.removeItem(`${PRAEFIX}${ZULETZT}`);
    // Ebenso die noch nicht abgeschickten Runden und alles, was vom Server
    // kam — sonst tauchen die gelöschten Werte gleich wieder auf.
    localStorage.removeItem(`${PRAEFIX}${AUSGANG}`);
    localStorage.removeItem(`${PRAEFIX}${EIGENE_SERVERWERTE}`);
    localStorage.removeItem(`${PRAEFIX}${SERVERLISTE}`);
    // Und der Fortschritt. Stufe 12 zu behalten, während alle Punkte weg
    // sind, wäre ein Widerspruch — die Stufe ist ja aus genau diesen Runden
    // entstanden.
    localStorage.removeItem(`${PRAEFIX}${FORTSCHRITT}`);
    // Die Sitzung bleibt ausdrücklich stehen: „Bestenliste löschen" darf
    // nicht heimlich abmelden. Abmelden ist eine eigene Handlung.
  } catch {
    /* absichtlich still */
  }
}

// ---------------------------------------------------------------------
// Fortschritt
// ---------------------------------------------------------------------

const FORTSCHRITT = 'fortschritt';

/**
 * Der gespeicherte Fortschritt — Erfahrung, Stufe, Statistik, Erfolge.
 *
 * Geht **immer** durch `fortschrittBereinigen`. Der Speicher kann aus einer
 * älteren Fassung stammen, von Hand verändert oder halb geschrieben worden
 * sein; ein fehlendes Feld darf nicht die halbe Startseite weiß werden
 * lassen. Das ist derselbe Grund, aus dem `bestenlisteLesen` auf `Array`
 * prüft, nur konsequenter.
 */
export function fortschrittLesen(): Fortschritt {
  return fortschrittBereinigen(lesen<unknown>(FORTSCHRITT, null));
}

export function fortschrittSchreiben(stand: Fortschritt): void {
  schreiben(FORTSCHRITT, stand);
}

const ZULETZT = 'zuletzt';

/**
 * Welches Spiel zuletzt geöffnet wurde — Grundlage der Weiterspielen-Karte
 * auf der Startseite.
 *
 * Das `datum` in der Bestenliste taugt dafür **nicht**: Dort überleben nur
 * die fünf besten Ergebnisse, eine schwache Runde von gestern fliegt also
 * wieder raus. Deshalb ein eigener Schlüssel.
 */
export function zuletztGespieltMerken(spielId: string): void {
  const { [spielId]: _alterEintrag, ...uebrige } = lesen<Record<string, string>>(ZULETZT, {});
  // Erst raus, dann wieder rein: Dadurch steht das zuletzt geöffnete Spiel
  // immer an letzter Stelle. Ein bloßes Überschreiben ließe es an seinem
  // alten Platz — und genau dieser Platz entscheidet unten den Gleichstand.
  schreiben(ZULETZT, { ...uebrige, [spielId]: new Date().toISOString() });
}

/** Die id des zuletzt geöffneten Spiels, oder `undefined` beim ersten Start. */
export function zuletztGespielt(): string | undefined {
  const alle = lesen<Record<string, string>>(ZULETZT, {});
  if (typeof alle !== 'object' || alle === null) return undefined;
  // `reverse` vor dem Sortieren: Zwei Zeitstempel können auf die
  // Millisekunde gleich sein. `sort` ist stabil, die Reihenfolge davor
  // entscheidet dann — und die zuletzt eingetragene id soll gewinnen.
  return Object.entries(alle)
    .reverse()
    .sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0];
}

export function einstellungenLesen(): Einstellungen {
  const standard: Einstellungen = {
    sound: true,
    reducedMotion:
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const gespeichert = lesen<Partial<Einstellungen>>('einstellungen', {});
  return {
    sound: typeof gespeichert.sound === 'boolean' ? gespeichert.sound : standard.sound,
    reducedMotion:
      typeof gespeichert.reducedMotion === 'boolean'
        ? gespeichert.reducedMotion
        : standard.reducedMotion,
  };
}

export function einstellungenSchreiben(einstellungen: Einstellungen): void {
  schreiben('einstellungen', einstellungen);
}
