/**
 * Der Avatar: eine kleine Figur aus vier Teilen, die mit der Stufe wächst.
 *
 * ## Warum es das gibt
 *
 * Bisher stand überall dort, wo ein Kind sich selbst wiedererkennen könnte
 * (Podest, Kontoseite), nur ein Kreis mit dem ersten Buchstaben des Namens.
 * Das ist neutral, aber es gibt nichts zu **verdienen** — anders als die
 * Erfolge oder die Sterne auf den Kacheln wächst daran nichts mit dem
 * Spielen. Der Avatar ist genau das: vier Teile (Farbe, Form, Augen,
 * Extra), von denen zu Beginn nur wenige zur Wahl stehen und der Rest sich
 * über die Stufe freischaltet — dieselbe Stufe, die `fortschritt.ts` schon
 * führt, keine zweite Zählung.
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
 * ist eine bewusste Einschränkung für die erste Fassung, keine Lücke, die
 * heimlich entstanden ist.
 */

export type AvatarTeil = 'koerperfarbe' | 'form' | 'augen' | 'accessoire';

export type AvatarKonfig = {
  koerperfarbe: string;
  form: string;
  augen: string;
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
  koerperfarbe: [
    { id: 'blau', abStufe: 1 },
    { id: 'gruen', abStufe: 1 },
    { id: 'orange', abStufe: 3 },
    { id: 'pink', abStufe: 3 },
    { id: 'violett', abStufe: 6 },
    { id: 'gold', abStufe: 12 },
  ],
  form: [
    { id: 'rund', abStufe: 1 },
    { id: 'eckig', abStufe: 1 },
    { id: 'spitz', abStufe: 4 },
    { id: 'wellig', abStufe: 7 },
    { id: 'stern', abStufe: 11 },
  ],
  augen: [
    { id: 'rund', abStufe: 1 },
    { id: 'schlaefrig', abStufe: 1 },
    { id: 'stern', abStufe: 5 },
    { id: 'herz', abStufe: 5 },
    { id: 'zwinker', abStufe: 10 },
  ],
  accessoire: [
    // „keins" ist keine Verlegenheitslösung, sondern eine gleichwertige
    // Wahl — ein Kind, das lieber nichts trägt, muss das ausdrücklich
    // wählen können, nicht nur, weil ihm sonst nichts einfällt.
    { id: 'keins', abStufe: 1 },
    { id: 'brille', abStufe: 2 },
    { id: 'schleife', abStufe: 5 },
    { id: 'hut', abStufe: 8 },
    { id: 'krone', abStufe: 15 },
  ],
};

const REIHENFOLGE: readonly AvatarTeil[] = ['koerperfarbe', 'form', 'augen', 'accessoire'];

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
    koerperfarbe: OPTIONEN.koerperfarbe[0]!.id,
    form: OPTIONEN.form[0]!.id,
    augen: OPTIONEN.augen[0]!.id,
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
