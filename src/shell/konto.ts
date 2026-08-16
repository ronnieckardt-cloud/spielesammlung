import {
  ausgangErledigt,
  ausgangLesen,
  eigenenServerwertMerken,
  sitzungLesen,
  sitzungSchreiben,
} from './speicher';
import type { GespeicherteSitzung } from './speicher';
import * as server from './server';

/**
 * Die Klammer zwischen Speicher und Server.
 *
 * `server.ts` kennt nur HTTP und fasst nichts Bleibendes an, `speicher.ts`
 * kennt nur `localStorage` und nichts vom Netz. Hier kommt beides zusammen:
 * Sitzung halten, erneuern, Ergebnisse nachreichen.
 *
 * **Grundsatz: `localStorage` ist die maßgebliche Quelle, der Server ist ein
 * Spiegel.** Kein Spielablauf wartet je auf das Netz. Wer nicht angemeldet
 * ist, bekommt genau die App von vorher.
 */

export type Konto = { name: string; benutzerId: string };

let sitzung: GespeicherteSitzung | null = null;
const horcher = new Set<(konto: Konto | null) => void>();

function melden(): void {
  const konto = sitzung ? { name: sitzung.name, benutzerId: sitzung.benutzerId } : null;
  for (const h of horcher) h(konto);
}

/** Beim Start einmal aufrufen. */
export function kontoLaden(): Konto | null {
  sitzung = sitzungLesen();
  return sitzung ? { name: sitzung.name, benutzerId: sitzung.benutzerId } : null;
}

export function kontoBeobachten(rueckruf: (konto: Konto | null) => void): () => void {
  horcher.add(rueckruf);
  return () => {
    horcher.delete(rueckruf);
  };
}

export function angemeldet(): boolean {
  return sitzung !== null;
}

function uebernehmen(neu: GespeicherteSitzung | null): void {
  sitzung = neu;
  sitzungSchreiben(neu);
  melden();
}

/**
 * Gibt ein gültiges Zugriffsmerkmal zurück, oder null.
 *
 * Erneuert selbst, wenn es abgelaufen ist. Wird die Erneuerung abgelehnt,
 * wird still abgemeldet und die **lokalen Daten bleiben unangetastet** —
 * ein Kind soll nie vor einer Meldung stehen, die es nicht auflösen kann.
 */
async function gueltigeSitzung(): Promise<GespeicherteSitzung | null> {
  if (!sitzung) return null;
  if (sitzung.laeuftAb > Date.now()) return sitzung;

  const erneuert = await server.erneuern(sitzung);
  uebernehmen(erneuert);
  return erneuert;
}

/**
 * Ein neues Passwort setzen und sich damit gleich anmelden.
 *
 * Der zweite Schritt ist wichtig: Wer sein Passwort vergessen hat, will
 * spielen, nicht Formulare ausfüllen. Nach dem Setzen ist er drin.
 *
 * Schlägt ausgerechnet die Anmeldung danach fehl, gilt dieselbe Regel wie
 * beim Registrieren — es braucht einen eigenen Satz, sonst rätselt man,
 * warum das neue Passwort angeblich nicht stimmt.
 */
export async function passwortNeuSetzen(
  name: string,
  code: string,
  passwort: string,
): Promise<void> {
  await server.passwortNeuSetzen(name, code, passwort);
  try {
    await anmelden(name, passwort);
  } catch {
    throw new Error(
      `Das neue Passwort steht, ${name}! Die Anmeldung hat nur gerade nicht geklappt. ` +
        'Tipp unten auf „Ich habe schon ein Konto" und melde dich damit an.',
    );
  }
}

export async function registrieren(name: string, passwort: string, code: string): Promise<void> {
  await server.registrieren(name, passwort, code);
  try {
    await anmelden(name, passwort);
  } catch {
    // Heikelster Moment der ganzen Anmeldung: Das Konto **existiert** jetzt,
    // nur die Anmeldung danach ging schief. Ohne eigenen Hinweis stünde da
    // „hat nicht geklappt", der zweite Versuch liefe wieder auf
    // „Diesen Namen hat schon jemand" — und das Kind wäre ratlos.
    throw new Error(
      `Dein Konto ist fertig, ${name}! Die Anmeldung hat nur gerade nicht geklappt. ` +
        'Tipp unten auf „Ich habe schon ein Konto" und melde dich an.',
    );
  }
}

export async function anmelden(name: string, passwort: string): Promise<Konto> {
  const neu = await server.anmelden(name, passwort);
  uebernehmen(neu);
  // Was offline aufgelaufen ist, geht direkt mit hoch.
  void abgleichen();
  return { name: neu.name, benutzerId: neu.benutzerId };
}

export function abmelden(): void {
  uebernehmen(null);
}

/**
 * Schickt alles ab, was in der Warteschlange liegt.
 *
 * Läuft still: Fehler werden geschluckt, der Eintrag bleibt dann einfach für
 * den nächsten Versuch liegen. Weil jeder Eintrag einen eigenen Schlüssel
 * hat und der Server darauf eine Eindeutigkeitsregel, ist ein zweiter
 * Versuch völlig ungefährlich.
 */
let laeuft = false;
export async function abgleichen(): Promise<void> {
  // Die Sperre **vor** dem ersten `await` setzen. Dahinter wäre sie
  // wirkungslos: Start, Netzrückkehr und Rundenende können in derselben
  // Millisekunde auslösen, und beide Läufe kämen an der Prüfung vorbei.
  if (laeuft) return;
  laeuft = true;
  try {
    const gueltig = await gueltigeSitzung();
    if (!gueltig) return;

    for (const eintrag of ausgangLesen()) {
      try {
        const ergebnis = await server.ergebnisMelden(gueltig, eintrag);
        ausgangErledigt(eintrag.schluessel);
        if (ergebnis) eigenenServerwertMerken(eintrag.spiel, ergebnis.bestwert);
      } catch {
        // Netz weg oder Server zickt — beim nächsten Mal wieder.
        break;
      }
    }
  } finally {
    laeuft = false;
  }
}

/**
 * Meldet **eine bestimmte** Runde und gibt ihren Platz zurück.
 *
 * Wird direkt am Rundenende gerufen, damit der Dialog „Platz 3 von 8"
 * zeigen kann. Der Schlüssel kommt aus `ergebnisEintragen` — „irgendein
 * Eintrag dieses Spiels" wäre falsch, wenn in der Schlange noch eine ältere
 * Runde liegt, die offline aufgelaufen ist.
 *
 * Klappt es nicht, bleibt der Eintrag in der Warteschlange und der Dialog
 * zeigt eben keinen Platz — mehr passiert nicht.
 */
export async function ergebnisMelden(
  schluessel: string,
): Promise<{ platz: number; teilnehmer: number } | null> {
  const gueltig = await gueltigeSitzung();
  if (!gueltig) return null;

  const eintrag = ausgangLesen().find((e) => e.schluessel === schluessel);
  if (!eintrag) return null;

  try {
    const ergebnis = await server.ergebnisMelden(gueltig, eintrag);
    ausgangErledigt(eintrag.schluessel);
    // Was sonst noch liegen geblieben ist, geht gleich mit hoch — jetzt ist
    // erwiesenermaßen Netz da.
    void abgleichen();
    if (ergebnis) {
      eigenenServerwertMerken(eintrag.spiel, ergebnis.bestwert);
      return { platz: ergebnis.platz, teilnehmer: ergebnis.teilnehmer };
    }
  } catch {
    /* bleibt in der Warteschlange */
  }
  return null;
}

// ---------------------------------------------------------------------
// Duelle
// ---------------------------------------------------------------------

export type Duell = server.Duell;

/**
 * Duelle laufen bewusst **nicht** über die Ausgangsschlange.
 *
 * Ein Duellergebnis ohne Netz nachzureichen klingt erst gut, wäre aber
 * heikel: Der Gegner sähe tagelang „hat noch nicht gespielt", obwohl längst
 * gespielt wurde. Ein Duell braucht deshalb im Moment des Meldens Netz —
 * und wenn keins da ist, sagt die App das offen, statt so zu tun als ob.
 * Die normale Bestenliste dagegen ist weiterhin voll offline-fähig.
 */
export async function duelleHolen(): Promise<Duell[] | null> {
  const gueltig = await gueltigeSitzung();
  if (!gueltig) return null;
  try {
    return await server.duelleHolen(gueltig);
  } catch {
    return null;
  }
}

export async function duellStarten(spiel: string, gegnerName: string): Promise<Duell> {
  const gueltig = await gueltigeSitzung();
  if (!gueltig) throw new Error('Dafür musst du angemeldet sein.');
  return await server.duellStarten(gueltig, spiel, gegnerName);
}

export async function duellMelden(duellId: string, punkte: number): Promise<Duell | null> {
  const gueltig = await gueltigeSitzung();
  if (!gueltig) return null;
  try {
    return await server.duellMelden(gueltig, duellId, punkte);
  } catch {
    return null;
  }
}

export async function spielerNamenHolen(): Promise<string[]> {
  const gueltig = await gueltigeSitzung();
  if (!gueltig) return [];
  try {
    return await server.spielerNamenHolen(gueltig);
  } catch {
    return [];
  }
}

export type Bestenlisten = {
  gesamt: server.Gesamteintrag[];
  spitze: server.Spitzeneintrag[];
  eigene: server.EigenerPlatz[];
};

/**
 * Alles, was die Bestenlisten-Seite braucht — in **drei** Anfragen
 * nebeneinander statt in sechzehn hintereinander.
 *
 * Gibt `null` zurück, wenn niemand angemeldet ist oder das Netz nicht
 * mitspielt. Die Seite zeigt dann den zuletzt geholten Stand.
 */
export async function bestenlistenHolen(): Promise<Bestenlisten | null> {
  const gueltig = await gueltigeSitzung();
  if (!gueltig) return null;
  try {
    const [gesamt, spitze, eigene] = await Promise.all([
      server.gesamtwertungHolen(gueltig),
      server.spitzenreiterHolen(gueltig),
      server.eigenePlaetzeHolen(gueltig),
    ]);
    return { gesamt, spitze, eigene };
  } catch {
    return null;
  }
}
