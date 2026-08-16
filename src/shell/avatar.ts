/**
 * Der Avatar: eine Figur aus sechs Teilen, die mit der Stufe wächst.
 *
 * ## Warum es das gibt
 *
 * Bisher stand überall dort, wo ein Kind sich selbst wiedererkennen könnte
 * (Podest, Kontoseite), nur ein Kreis mit dem ersten Buchstaben des Namens.
 * Das ist neutral, aber es gibt nichts zu **verdienen** — anders als die
 * Erfolge oder die Sterne auf den Kacheln wächst daran nichts mit dem
 * Spielen. Der Avatar ist genau das.
 *
 * **Eine echte Figur, kein Fantasiewesen.** Die erste Fassung war ein
 * runder Blob mit Augen — Rückmeldung: „Sieht das nicht nur aus wie ein
 * Wassertropfen? Ich will, dass die Avatare richtig Menschen sind, die man
 * anziehen kann." Die Teile sind jetzt entsprechend Körperteile und
 * Kleidungsstücke: Hautfarbe, Frisur, Haarfarbe, Oberteil-Schnitt,
 * Oberteil-Farbe, Hosen-Schnitt, Hosen-Farbe, Extra. Schnitt und Farbe
 * stehen bei Kleidung bewusst getrennt — Rückmeldung: „nicht nur ein
 * T-Shirt, sondern langärmlig, kurzärmlig, ein Unterhemd … kurze, lange,
 * breite, dünne Hosen." Zusammen in einem Teil („blaues langärmliges
 * Oberteil" als eine Option) hätte die Liste je Farbe vervierfacht.
 *
 * ## Warum die Hautfarbe **nicht** gesperrt ist
 *
 * Jedes andere Teil schaltet sich über die Stufe frei — das ist der Anreiz.
 * Bei der Hautfarbe wäre das falsch: Sie ist keine Belohnung, sondern eine
 * Wahl, wer man sein möchte, und die muss von Anfang an vollständig
 * offenstehen. Deshalb tragen alle Hautfarben `abStufe: 1`.
 *
 * ## Warum eine Figur aus Teilen und kein Foto/Bild-Upload
 *
 * Kein Zugriff auf Kamera oder Fotos nötig, keine Fläche für unpassende
 * Inhalte, und die Figur bleibt ein SVG — skaliert verlustfrei von der
 * kleinen Bestenlisten-Zeile bis zur großen Anzeige auf der Kontoseite.
 *
 * ## Warum lokal und nicht über den Server
 *
 * Der Avatar ist reine Kür, kein Spielstand. Er speichert wie der
 * Fortschritt in `speicher.ts` — offline verfügbar, ohne Wartezeit, ohne
 * einen weiteren Baustein, der scheitern kann. Dass er dadurch nur auf
 * *diesem* Gerät sichtbar ist (auch für andere Spieler in der Bestenliste),
 * ist eine bewusste Einschränkung der ersten Fassung, keine Lücke, die
 * heimlich entstanden ist.
 */

export type AvatarTeil =
  | 'hautfarbe'
  | 'frisur'
  | 'haarfarbe'
  | 'oberteilSchnitt'
  | 'oberteil'
  | 'hosenSchnitt'
  | 'hose'
  | 'accessoire';

export type AvatarKonfig = {
  hautfarbe: string;
  frisur: string;
  haarfarbe: string;
  /** Der **Schnitt** des Oberteils — T-Shirt, langärmlig, Unterhemd, Pulli. */
  oberteilSchnitt: string;
  /** Die **Farbe** des Oberteils. */
  oberteil: string;
  /** Der **Schnitt** der Hose — lang, kurz, schmal, weit, Rock. */
  hosenSchnitt: string;
  /** Die **Farbe** der Hose. */
  hose: string;
  accessoire: string;
};

type Option = {
  id: string;
  /** Ab welcher Stufe wählbar. 1 = von Anfang an dabei. */
  abStufe: number;
};

/**
 * Die Optionen je Teil, in der Reihenfolge, in der sie in der Auswahl
 * stehen. Frühe Stufen zuerst — das ist zugleich die Reihenfolge, in der
 * ein Kind sie freischaltet.
 */
export const OPTIONEN: Record<AvatarTeil, readonly Option[]> = {
  // Alle Hautfarben ab Stufe 1 — siehe Kommentar oben, keine Belohnung.
  hautfarbe: [
    { id: 'hell', abStufe: 1 },
    { id: 'mittel', abStufe: 1 },
    { id: 'oliv', abStufe: 1 },
    { id: 'braun', abStufe: 1 },
    { id: 'dunkel', abStufe: 1 },
  ],
  /*
   * Acht Frisuren statt der ursprünglichen fünf — Rückmeldung: „viel mehr
   * Frisuren". Jede hat eine eigene, auch bei 44 Pixeln unterscheidbare
   * Silhouette (siehe `AvatarBild.tsx`); zwei ähnliche Formen nur mit
   * anderem Namen wären keine echte neue Wahl.
   */
  frisur: [
    { id: 'kahl', abStufe: 1 },
    { id: 'kurz', abStufe: 1 },
    { id: 'mittel', abStufe: 3 },
    { id: 'zopf', abStufe: 4 },
    { id: 'zwei-zoepfe', abStufe: 5 },
    { id: 'lang', abStufe: 6 },
    { id: 'lockig', abStufe: 9 },
    { id: 'irokese', abStufe: 12 },
  ],
  haarfarbe: [
    { id: 'braun', abStufe: 1 },
    { id: 'schwarz', abStufe: 1 },
    { id: 'grau', abStufe: 1 },
    { id: 'blond', abStufe: 3 },
    { id: 'rot', abStufe: 3 },
    { id: 'orange', abStufe: 6 },
    { id: 'blau', abStufe: 9 },
    { id: 'pink', abStufe: 9 },
    { id: 'gruen', abStufe: 11 },
  ],
  /*
   * Der **Schnitt** des Oberteils, unabhängig von der Farbe — Rückmeldung:
   * „nicht nur als T-Shirt, sondern langärmlig, kurzärmlig." Ein
   * Unterhemd stand ebenfalls zur Wahl, ist aber auf Ronnis Wunsch wieder
   * raus — „das brauchen wir nicht".
   */
  oberteilSchnitt: [
    { id: 'kurzarm', abStufe: 1 },
    { id: 'langarm', abStufe: 5 },
    { id: 'pulli', abStufe: 10 },
  ],
  oberteil: [
    { id: 'blau', abStufe: 1 },
    { id: 'gruen', abStufe: 1 },
    { id: 'schwarz', abStufe: 1 },
    { id: 'weiss', abStufe: 1 },
    { id: 'rot', abStufe: 1 },
    { id: 'orange', abStufe: 3 },
    { id: 'pink', abStufe: 3 },
    { id: 'tuerkis', abStufe: 5 },
    { id: 'gelb', abStufe: 5 },
    { id: 'violett', abStufe: 6 },
    { id: 'gold', abStufe: 12 },
  ],
  /*
   * Der **Schnitt** der Hose — Rückmeldung: „kurz, lang, breit, dünn
   * machen." Länge und Weite als eine gemeinsame Wahl statt zweier eigener
   * Teile: Acht Teile hat der Baukasten schon, ein neuntes und zehntes für
   * zwei Fragen, die zusammen eigentlich eine Hose beschreiben, wäre eine
   * Auswahl zu viel.
   */
  hosenSchnitt: [
    { id: 'kurz-eng', abStufe: 1 },
    { id: 'lang-eng', abStufe: 1 },
    { id: 'kurz-weit', abStufe: 4 },
    { id: 'lang-weit', abStufe: 4 },
    { id: 'rock', abStufe: 7 },
  ],
  hose: [
    { id: 'blau', abStufe: 1 },
    { id: 'grau', abStufe: 1 },
    { id: 'gruen', abStufe: 1 },
    { id: 'beige', abStufe: 1 },
    { id: 'schwarz', abStufe: 3 },
    { id: 'braun', abStufe: 3 },
    { id: 'violett', abStufe: 7 },
    { id: 'rot', abStufe: 9 },
    { id: 'gold', abStufe: 13 },
  ],
  /*
   * Die Mütze war zuerst eine einzelne, fest rot-weiße Wintermütze —
   * Rückmeldung: „Könnten wir schwarze Cappy machen? Auch eine weiße und
   * eine grüne." Jetzt eine Cap (Schirmmütze) in drei eigenen Farben statt
   * einer Wintermütze in einer festen Farbe. Kein zusätzlicher Teil dafür
   * (neun Teile wären eines zu viel) — die drei Farben stehen stattdessen
   * als drei eigene Optionen hier, alle ab derselben Stufe.
   *
   * Dieselben drei Farben gibt es noch einmal mit `-hinten` — Rückmeldung:
   * „dass man die Kappe andersrum anziehen kann." Eine eigene Option statt
   * eines Schalters, weil sie genauso freigeschaltet werden soll wie die
   * Cap selbst, nicht automatisch mit ihr mitkommt. `AvatarBild.tsx`
   * zeichnet dieselbe Kuppel, nur ohne den Schirm vorn.
   *
   * Kopfhörer und Schal kamen dazu, weil „das war jetzt halt so'n
   * Beispiel, mach halt noch viel mehr" — zwei zusätzliche, in Form (nicht
   * Farbe) feste Extras wie die Fliege, damit dieser eine Teil nicht
   * ausschließlich aus Kopfbedeckungen besteht.
   */
  accessoire: [
    // „keins" ist keine Verlegenheitslösung, sondern eine gleichwertige
    // Wahl — ein Kind, das lieber nichts trägt, muss das ausdrücklich
    // wählen können, nicht nur, weil ihm sonst nichts einfällt.
    { id: 'keins', abStufe: 1 },
    { id: 'brille', abStufe: 2 },
    { id: 'schal', abStufe: 4 },
    { id: 'fliege', abStufe: 5 },
    { id: 'kopfhoerer', abStufe: 6 },
    { id: 'cap-schwarz', abStufe: 8 },
    { id: 'cap-weiss', abStufe: 8 },
    { id: 'cap-gruen', abStufe: 8 },
    { id: 'cap-schwarz-hinten', abStufe: 8 },
    { id: 'cap-weiss-hinten', abStufe: 8 },
    { id: 'cap-gruen-hinten', abStufe: 8 },
    { id: 'krone', abStufe: 15 },
  ],
};

const REIHENFOLGE: readonly AvatarTeil[] = [
  'hautfarbe',
  'frisur',
  'haarfarbe',
  'oberteilSchnitt',
  'oberteil',
  'hosenSchnitt',
  'hose',
  'accessoire',
];

/** Die Optionen eines Teils, die bei dieser Stufe schon offenstehen. */
export function freigeschaltet(teil: AvatarTeil, stufe: number): readonly string[] {
  return OPTIONEN[teil].filter((o) => o.abStufe <= stufe).map((o) => o.id);
}

/** Stufe, ab der eine bestimmte Option wählbar ist — für die Anzeige „ab Stufe X". */
export function abStufeVon(teil: AvatarTeil, id: string): number {
  return OPTIONEN[teil].find((o) => o.id === id)?.abStufe ?? 1;
}

/** Der Avatar, mit dem jedes Konto beginnt — je erste Option pro Teil. */
export function voreingestellterAvatar(): AvatarKonfig {
  return {
    hautfarbe: OPTIONEN.hautfarbe[0]!.id,
    frisur: OPTIONEN.frisur[0]!.id,
    haarfarbe: OPTIONEN.haarfarbe[0]!.id,
    oberteilSchnitt: OPTIONEN.oberteilSchnitt[0]!.id,
    oberteil: OPTIONEN.oberteil[0]!.id,
    hosenSchnitt: OPTIONEN.hosenSchnitt[0]!.id,
    hose: OPTIONEN.hose[0]!.id,
    accessoire: OPTIONEN.accessoire[0]!.id,
  };
}

/**
 * Räumt einen gespeicherten Avatar für eine gegebene Stufe gerade.
 *
 * Zwei Fälle, die das behandeln muss, nicht nur kaputte Daten:
 *
 * 1. **Der Speicher ist nicht vertrauenswürdig** — ältere Fassung, halb
 *    geschrieben, von Hand verändert. Dieselbe Regel wie bei
 *    `fortschrittBereinigen`.
 * 2. **Ein Teil kann zwischenzeitlich wieder gesperrt sein.** Kommt heute
 *    nicht vor (Stufen steigen nur), ist aber die ehrliche Zusicherung:
 *    Diese Funktion garantiert, dass am Ende nur Optionen herauskommen,
 *    die bei `stufe` wirklich erlaubt sind — nicht nur „was mal gespeichert
 *    wurde".
 */
export function avatarBereinigen(wert: unknown, stufe: number): AvatarKonfig {
  const roh = typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : {};
  const voreinstellung = voreingestellterAvatar();
  const ergebnis = { ...voreinstellung };
  for (const teil of REIHENFOLGE) {
    const erlaubt = freigeschaltet(teil, stufe);
    const gewaehlt = roh[teil];
    if (typeof gewaehlt === 'string' && erlaubt.includes(gewaehlt)) {
      ergebnis[teil] = gewaehlt;
    }
    // Sonst bleibt die Voreinstellung stehen — die erste Option jedes Teils
    // hat immer `abStufe: 1` und ist deshalb selbst nie gesperrt.
  }
  return ergebnis;
}
