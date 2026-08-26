/**
 * Bestleistung des Geräts: höchster Punktestand und weiteste Welle.
 *
 * Die **einzige** Stelle im Prototyp, die `localStorage` anfasst. Das ist von
 * der Spielesammlung abgeschaut (dort darf es nur `shell/speicher.ts`): Wenn
 * der Zugriff an einer Stelle steht, gibt es genau einen Ort, an dem man den
 * Schlüsselnamen ändert, und genau einen, der abgesichert sein muss.
 *
 * Rechnen und Speichern sind getrennt: `bereinigen` und `vergleichen` sind
 * reine Funktionen ohne Browser und lassen sich deshalb einzeln prüfen —
 * gerade die Frage „ist das ein Rekord?" will man nicht nur dadurch getestet
 * haben, dass man zufällig gut gespielt hat.
 */
const Rekord = {
  // Mit Namensraum, damit der Schlüssel sich nicht mit etwas anderem beißt,
  // falls der Prototyp je unter derselben Adresse wie die Sammlung liegt.
  SCHLUESSEL: 'arena-brawler-mini:rekord',

  LEER: { punkte: 0, welle: 0 },

  /**
   * Gespeichertes ist nie vertrauenswürdig: ältere Fassung, halb geschrieben,
   * von Hand verändert. Ein kaputter Wert darf nicht dazu führen, dass der
   * Auswahlbildschirm „NaN Punkte" anzeigt oder die Szene beim Start abbricht.
   */
  bereinigen(roh) {
    const zahl = (wert) => {
      const n = Number(wert);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    };

    if (!roh || typeof roh !== 'object') return { ...Rekord.LEER };
    return { punkte: zahl(roh.punkte), welle: zahl(roh.welle) };
  },

  /**
   * Reiner Vergleich. Punkte und Welle zählen getrennt: Man kann dieselbe
   * Welle erreichen und dabei mehr Gegner erwischt haben — das ist ein
   * Punkterekord ohne Wellenrekord, und beides ist eine eigene Leistung.
   */
  vergleichen(alt, punkte, welle) {
    const sauber = Rekord.bereinigen(alt);
    const p = Math.max(0, Math.floor(punkte) || 0);
    const w = Math.max(0, Math.floor(welle) || 0);

    return {
      punkteRekord: p > sauber.punkte,
      welleRekord: w > sauber.welle,
      istRekord: p > sauber.punkte || w > sauber.welle,
      neu: { punkte: Math.max(sauber.punkte, p), welle: Math.max(sauber.welle, w) },
      vorher: sauber,
    };
  },

  /**
   * Liest den Stand. Schlägt irgendetwas fehl — kein localStorage, gesperrt,
   * unlesbarer Inhalt —, kommt der leere Stand zurück. Ein Prototyp darf an
   * einer Bestenliste nicht scheitern.
   */
  lesen() {
    try {
      const roh = window.localStorage.getItem(Rekord.SCHLUESSEL);
      if (!roh) return { ...Rekord.LEER };
      return Rekord.bereinigen(JSON.parse(roh));
    } catch (fehler) {
      return { ...Rekord.LEER };
    }
  },

  /**
   * Schreibt den Stand und meldet, ob es geklappt hat. Safari im privaten
   * Modus wirft beim Schreiben, obwohl `localStorage` vorhanden ist — deshalb
   * gehört der try/catch um den Schreibvorgang und nicht nur um die Abfrage,
   * ob es das Objekt überhaupt gibt.
   */
  schreiben(stand) {
    try {
      window.localStorage.setItem(Rekord.SCHLUESSEL, JSON.stringify(Rekord.bereinigen(stand)));
      return true;
    } catch (fehler) {
      return false;
    }
  },

  /** Runde melden: lesen, vergleichen, bei Bedarf schreiben. */
  melden(punkte, welle) {
    const ergebnis = Rekord.vergleichen(Rekord.lesen(), punkte, welle);
    if (ergebnis.istRekord) ergebnis.gespeichert = Rekord.schreiben(ergebnis.neu);
    else ergebnis.gespeichert = false;
    return ergebnis;
  },

  loeschen() {
    try {
      window.localStorage.removeItem(Rekord.SCHLUESSEL);
      return true;
    } catch (fehler) {
      return false;
    }
  },

  /** Eine Zeile für die Anzeige — oder null, wenn noch nichts gewertet ist. */
  zeile(stand) {
    const sauber = Rekord.bereinigen(stand);
    if (sauber.punkte === 0 && sauber.welle === 0) return null;
    return `Bester Lauf: ${sauber.punkte} Punkte · Welle ${sauber.welle}`;
  },
};
