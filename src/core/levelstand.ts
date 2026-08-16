/**
 * Welche Levelnummer als Nächstes drankommt — je Spiel.
 *
 * ## Warum es diesen Baustein gibt
 *
 * Acht Spiele führten dafür eine eigene Modul-Variable (`let naechstesLevel
 * = 1`). Innerhalb einer Sitzung reichte das: „Nochmal" mountet das Spiel
 * per neuem `key` komplett neu, die Variable überlebt das. Beim **Schließen
 * der App** war sie aber weg, und beim nächsten Öffnen fing man wieder bei
 * Level 1 an.
 *
 * Genau das war Ronnis Rückmeldung: „Bei Flow Link geht es nicht ins
 * nächste Level. Nach dem ersten Level ist Schluss." Nachgestellt war die
 * Progression innerhalb einer Sitzung völlig in Ordnung — nur eben nie
 * darüber hinaus. Betroffen: Color Pour, Quiz Time, Brain Blitz, Word Play,
 * Pair Up, Even Cut, Flow Link und Box Push.
 *
 * ## Warum die Hülle den Stand hält und nicht das Spiel
 *
 * `src/games/**` darf `localStorage` nicht anfassen — das ist die
 * Kernregel der Schnittstelle. Der Stand kommt deshalb als `startLevel`
 * herein und geht als `onLevel` wieder hinaus; gespeichert wird er in
 * `shell/speicher.ts` wie alles andere auch.
 *
 * ## Warum trotzdem eine Variable je Modul bleibt
 *
 * `startLevel` wird von der Hülle **einmal beim Betreten** gelesen und
 * ändert sich danach nicht mehr. Würde ein Spiel bei jedem Mounten direkt
 * daraus starten, spielte „Nochmal" wieder dasselbe Level — der Prop trägt
 * ja noch den alten Wert. Der Sitzungsstand hier ist also kein Überbleibsel,
 * sondern die Brücke zwischen zwei Runden; `startLevel` setzt ihn nur
 * **einmal** auf, beim ersten Betreten nach dem App-Start.
 */
export type Levelstand = {
  /**
   * Die Levelnummer für diese Runde. Beim ersten Aufruf nach dem App-Start
   * übernimmt sie den gespeicherten Stand, danach den der Sitzung.
   */
  anfang(startLevel: number | undefined): number;
  /** Setzt den Stand für die nächste Runde. */
  setzen(level: number): void;
};

export function levelstand(): Levelstand {
  let naechstes = 1;
  let ausSpeicher = false;

  return {
    anfang(startLevel) {
      if (!ausSpeicher && typeof startLevel === 'number' && Number.isFinite(startLevel)) {
        // Unter 1 wäre unsinnig — Brain Blitz ist an einer Null sogar
        // abgestürzt, bevor die Stufenrechnung geklemmt wurde.
        naechstes = Math.max(1, Math.floor(startLevel));
        ausSpeicher = true;
      }
      return naechstes;
    },
    setzen(level) {
      if (!Number.isFinite(level)) return;
      naechstes = Math.max(1, Math.floor(level));
    },
  };
}
