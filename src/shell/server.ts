/**
 * Der Zugang zum Server (Supabase).
 *
 * **Ohne die Supabase-Bibliothek.** Gebraucht werden genau vier Endpunkte,
 * und `@supabase/supabase-js` brächte Realtime, Storage und Functions mit,
 * die hier niemand benutzt. Der entscheidende Grund ist aber ein anderer:
 * Die Bibliothek legt ihre Sitzung in eigenen `localStorage`-Schlüsseln ab
 * und bringt einen eigenen Erneuerungs-Zeitgeber mit. Das bricht die
 * Projektregel, dass `speicher.ts` der einzige Ort ist, der `localStorage`
 * anfassen darf. Man müsste ihr also ohnehin einen eigenen Speicher
 * unterschieben — und hätte dann die Bibliothek *und* den Eigenbau.
 *
 * Diese Datei fasst **keinen** Speicher an. Sie bekommt das Zugriffsmerkmal
 * gereicht und gibt Daten zurück; alles Bleibende macht `speicher.ts`.
 *
 * Die Spiele wissen von alldem nichts. Sie melden ihr Ergebnis wie bisher
 * über `onGameOver`, und die Hülle entscheidet, was damit passiert.
 * `GameApi`/`GameProps` bleiben unverändert.
 */

const URL_BASIS = 'https://wotdzumntewqmwrtykyb.supabase.co';

/**
 * Der öffentliche Schlüssel. Der gehört ins ausgelieferte JavaScript — er
 * ist genau dafür gedacht und verrät nichts. Was jemand damit tun darf,
 * entscheiden allein die Zugriffsregeln in der Datenbank.
 */
const OEFFENTLICHER_SCHLUESSEL = 'sb_publishable_Vg-LOTrjkbhR--mBbWUjCg_ByOTOkfQ';

/**
 * Aus dem Spielernamen wird eine Adresse gebildet.
 *
 * Supabase kennt Passwörter nur zusammen mit einer E-Mail-Adresse — einen
 * reinen Benutzernamen gibt es dort nicht. Also erfinden wir eine. Das Kind
 * sieht sie nie; es tippt nur seinen Namen.
 *
 * Die Domain ist bewusst eine eigene und nicht die von FitHold: In dieser
 * Datenbank liegen beide Apps, und so ist auf einen Blick zu sehen, welches
 * Konto zur Spielesammlung gehört.
 */
const NAMENS_DOMAIN = 'spieler.klarvorteil.de';

export type Sitzung = {
  zugriffsmerkmal: string;
  erneuerungsmerkmal: string;
  /** Wann das Zugriffsmerkmal abläuft, als Zeitstempel in Millisekunden. */
  laeuftAb: number;
  benutzerId: string;
  name: string;
};

export type Bestenlisteneintrag = {
  name: string;
  punkte: number;
  platz: number;
  /** Gehört der Eintrag der angemeldeten Person? */
  ich: boolean;
};

/** Ein Treppchenplatz — wie oben, plus die Spiel-id. */
export type Spitzeneintrag = Bestenlisteneintrag & { spiel: string };

/** Der eigene Platz in einem Spiel, auch außerhalb des Treppchens. */
export type EigenerPlatz = { spiel: string; punkte: number; platz: number };

/** Eine Zeile der Gesamtwertung über alle Spiele. */
export type Gesamteintrag = {
  name: string;
  /** Platzierungspunkte, nicht Spielpunkte — siehe Ansicht `spiel_gesamtwertung`. */
  punkte: number;
  gespielteSpiele: number;
  siege: number;
  ich: boolean;
};

/**
 * Umlaute und Sonderzeichen fest auf ASCII abbilden.
 *
 * Muss verlässlich sein: Aus „Jörg" muss **immer** dieselbe Adresse werden,
 * sonst kommt er nach einem Browserwechsel nicht mehr in sein Konto.
 */
function alsAdresse(name: string): string {
  const ersetzt = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${ersetzt}@${NAMENS_DOMAIN}`;
}

/** Ein Fehler, dessen Text einem Kind etwas sagt. */
export class ServerFehler extends Error {}

async function anfragen(pfad: string, optionen: RequestInit & { merkmal?: string } = {}) {
  const { merkmal, ...rest } = optionen;
  const antwort = await fetch(`${URL_BASIS}${pfad}`, {
    ...rest,
    headers: {
      apikey: OEFFENTLICHER_SCHLUESSEL,
      'Content-Type': 'application/json',
      // Ohne Anmeldung gilt der öffentliche Schlüssel als Merkmal — die
      // Zugriffsregeln lassen damit ohnehin nichts durch.
      Authorization: `Bearer ${merkmal ?? OEFFENTLICHER_SCHLUESSEL}`,
      ...(rest.headers ?? {}),
    },
  });

  if (!antwort.ok) {
    let text = `Fehler ${antwort.status}`;
    try {
      const inhalt = (await antwort.json()) as { message?: string; error_description?: string };
      text = inhalt.message ?? inhalt.error_description ?? text;
    } catch {
      /* Antwort war kein JSON — dann bleibt es beim Statuscode. */
    }
    throw new ServerFehler(text);
  }
  return antwort.status === 204 ? null : await antwort.json();
}

function alsSitzung(roh: Record<string, unknown>, name: string): Sitzung {
  return {
    zugriffsmerkmal: String(roh.access_token),
    erneuerungsmerkmal: String(roh.refresh_token),
    // Etwas früher als nötig erneuern, damit kein Aufruf mitten im Ablauf
    // in einen abgelaufenen Zugang läuft.
    laeuftAb: Date.now() + (Number(roh.expires_in) - 60) * 1000,
    benutzerId: String((roh.user as { id?: string } | undefined)?.id ?? ''),
    name,
  };
}

/**
 * Ein neues Konto anlegen.
 *
 * Läuft über eine Funktion auf dem Server, nicht direkt gegen Supabase.
 * Zwei Gründe: Nur mit dem Dienstschlüssel lässt sich ein Konto **ohne
 * Bestätigungsmail** anlegen (die Adresse ist ja erfunden, niemand bekäme
 * je eine Mail) — und der Dienstschlüssel darf niemals ins ausgelieferte
 * JavaScript. Dort wird auch der Einladungscode geprüft.
 */
export async function registrieren(name: string, passwort: string, code: string): Promise<void> {
  const antwort = await fetch(`${URL_BASIS}/functions/v1/spiel-registrieren`, {
    method: 'POST',
    headers: { apikey: OEFFENTLICHER_SCHLUESSEL, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, passwort, code }),
  });
  const inhalt = (await antwort.json().catch(() => ({}))) as { fehler?: string };
  if (!antwort.ok) {
    throw new ServerFehler(inhalt.fehler ?? 'Das hat gerade nicht geklappt.');
  }
}

export async function anmelden(name: string, passwort: string): Promise<Sitzung> {
  const roh = (await anfragen('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: alsAdresse(name), password: passwort }),
  })) as Record<string, unknown>;
  const sitzung = alsSitzung(roh, name);
  // Der eingetippte Name kann in der Groß-/Kleinschreibung abweichen —
  // maßgeblich ist der im Profil hinterlegte.
  return { ...sitzung, name: (await eigenerName(sitzung)) ?? name };
}

/** Holt den im Profil hinterlegten Namen. */
async function eigenerName(sitzung: Sitzung): Promise<string | null> {
  const zeilen = (await anfragen(
    `/rest/v1/spiel_profil?id=eq.${sitzung.benutzerId}&select=name`,
    { merkmal: sitzung.zugriffsmerkmal },
  )) as { name: string }[];
  return zeilen[0]?.name ?? null;
}

/**
 * Sitzung erneuern. Wird sie abgelehnt, ist sie endgültig verloren — dann
 * still abmelden und die lokalen Daten unangetastet lassen. Ein Kind soll
 * nie vor einer Fehlermeldung stehen, die es nicht auflösen kann.
 */
export async function erneuern(sitzung: Sitzung): Promise<Sitzung | null> {
  try {
    const roh = (await anfragen('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: sitzung.erneuerungsmerkmal }),
    })) as Record<string, unknown>;
    return alsSitzung(roh, sitzung.name);
  } catch {
    return null;
  }
}

/** Ein Ergebnis melden. Gibt Platz und Teilnehmerzahl zurück. */
export async function ergebnisMelden(
  sitzung: Sitzung,
  eintrag: { spiel: string; punkte: number; gespieltAm: string; schluessel: string },
): Promise<{ platz: number; teilnehmer: number; bestwert: number } | null> {
  const zeilen = (await anfragen('/rest/v1/rpc/spiel_ergebnis_melden', {
    method: 'POST',
    merkmal: sitzung.zugriffsmerkmal,
    body: JSON.stringify({
      p_spiel: eintrag.spiel,
      p_punkte: eintrag.punkte,
      p_gespielt_am: eintrag.gespieltAm,
      p_schluessel: eintrag.schluessel,
    }),
  })) as { platz: number; teilnehmer: number; bestwert: number }[];
  return zeilen[0] ?? null;
}

/**
 * Die besten Drei **aller** Spiele auf einmal.
 *
 * Bewusst eine einzige Abfrage statt vierzehn: Die Bestenlisten-Seite zeigt
 * je Spiel ein kurzes Treppchen, und vierzehn Anfragen hintereinander wären
 * auf einem Handy im Funkloch eine halbe Ewigkeit.
 *
 * Der Filter `platz=lte.3` läuft im Ansichts-Ergebnis, nicht davor —
 * Postgres schiebt keine Bedingung durch eine Fensterfunktion. Die Plätze
 * stimmen also, es sind wirklich die drei Besten je Spiel.
 */
export async function spitzenreiterHolen(sitzung: Sitzung): Promise<Spitzeneintrag[]> {
  const zeilen = (await anfragen(
    '/rest/v1/spiel_bestenliste?platz=lte.3&select=spiel,name,punkte,platz,spieler' +
      '&order=spiel.asc,platz.asc&limit=200',
    { merkmal: sitzung.zugriffsmerkmal },
  )) as { spiel: string; name: string; punkte: number; platz: number; spieler: string }[];

  return zeilen.map((z) => ({
    spiel: z.spiel,
    name: z.name,
    punkte: z.punkte,
    platz: z.platz,
    ich: z.spieler === sitzung.benutzerId,
  }));
}

/** Die eigenen Plätze je Spiel — auch die außerhalb des Treppchens. */
export async function eigenePlaetzeHolen(sitzung: Sitzung): Promise<EigenerPlatz[]> {
  return (await anfragen(
    `/rest/v1/spiel_bestenliste?spieler=eq.${sitzung.benutzerId}&select=spiel,punkte,platz`,
    { merkmal: sitzung.zugriffsmerkmal },
  )) as EigenerPlatz[];
}

// ---------------------------------------------------------------------
// Duelle
// ---------------------------------------------------------------------

export type Duell = {
  id: string;
  spiel: string;
  /** Beide spielen genau dieses Level — das macht das Duell fair. */
  level: number;
  herausforderer: string;
  herausfordererName: string;
  gegner: string;
  gegnerName: string;
  punkteHerausforderer: number | null;
  punkteGegner: number | null;
  erstelltAm: string;
};

type DuellRoh = {
  id: string;
  spiel: string;
  level: number;
  herausforderer: string;
  herausforderer_name: string;
  gegner: string;
  gegner_name: string;
  punkte_herausforderer: number | null;
  punkte_gegner: number | null;
  erstellt_am: string;
};

function alsDuell(r: DuellRoh): Duell {
  return {
    id: r.id,
    spiel: r.spiel,
    level: r.level,
    herausforderer: r.herausforderer,
    herausfordererName: r.herausforderer_name,
    gegner: r.gegner,
    gegnerName: r.gegner_name,
    punkteHerausforderer: r.punkte_herausforderer,
    punkteGegner: r.punkte_gegner,
    erstelltAm: r.erstellt_am,
  };
}

/** Alle Duelle, an denen man selbst beteiligt ist. */
export async function duelleHolen(sitzung: Sitzung): Promise<Duell[]> {
  const zeilen = (await anfragen('/rest/v1/spiel_duell_liste?select=*&order=erstellt_am.desc&limit=40', {
    merkmal: sitzung.zugriffsmerkmal,
  })) as DuellRoh[];
  return zeilen.map(alsDuell);
}

/**
 * Ein Duell starten.
 *
 * Das Level würfelt der **Server**. Käme es aus der App, könnte man sich
 * sein Lieblingslevel aussuchen und dem Gegner ein schweres geben.
 */
export async function duellStarten(
  sitzung: Sitzung,
  spiel: string,
  gegnerName: string,
): Promise<Duell> {
  const roh = (await anfragen('/rest/v1/rpc/spiel_duell_starten', {
    method: 'POST',
    merkmal: sitzung.zugriffsmerkmal,
    body: JSON.stringify({ p_spiel: spiel, p_gegner_name: gegnerName }),
  })) as DuellRoh;
  return alsDuell(roh);
}

/** Sein Ergebnis für ein Duell eintragen. Jede Seite genau einmal. */
export async function duellMelden(
  sitzung: Sitzung,
  duellId: string,
  punkte: number,
): Promise<Duell> {
  const roh = (await anfragen('/rest/v1/rpc/spiel_duell_melden', {
    method: 'POST',
    merkmal: sitzung.zugriffsmerkmal,
    body: JSON.stringify({ p_duell: duellId, p_punkte: punkte }),
  })) as DuellRoh;
  return alsDuell(roh);
}

/** Die Namen aller Mitspieler — für die Gegnerwahl. */
export async function spielerNamenHolen(sitzung: Sitzung): Promise<string[]> {
  const zeilen = (await anfragen('/rest/v1/spiel_profil?select=id,name&order=name.asc&limit=100', {
    merkmal: sitzung.zugriffsmerkmal,
  })) as { id: string; name: string }[];
  return zeilen.filter((z) => z.id !== sitzung.benutzerId).map((z) => z.name);
}

/** Die Gesamtwertung über alle Spiele, nach Platzierungspunkten. */
export async function gesamtwertungHolen(sitzung: Sitzung): Promise<Gesamteintrag[]> {
  const zeilen = (await anfragen(
    '/rest/v1/spiel_gesamtwertung?select=spieler,name,punkte,gespielte_spiele,siege' +
      '&order=punkte.desc&limit=20',
    { merkmal: sitzung.zugriffsmerkmal },
  )) as {
    spieler: string;
    name: string;
    punkte: number;
    gespielte_spiele: number;
    siege: number;
  }[];

  return zeilen.map((z) => ({
    name: z.name,
    punkte: z.punkte,
    gespielteSpiele: z.gespielte_spiele,
    siege: z.siege,
    ich: z.spieler === sitzung.benutzerId,
  }));
}
