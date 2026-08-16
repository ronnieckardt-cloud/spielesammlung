import type React from 'react';

/**
 * Die einzige Schnittstelle zwischen Hülle und Spiel.
 * Ein Spiel sieht von der Hülle nichts außer diesen Props — kein Speicher,
 * kein Router, keine Bestenliste. Dadurch kann ein neues Spiel kein
 * bestehendes kaputtmachen.
 */

export type Einstellungen = {
  /** Töne erlaubt. Die Hülle meldet das zusätzlich an sfx. */
  sound: boolean;
  /** Nutzer wünscht wenig Bewegung — Animationen weglassen oder kürzen. */
  reducedMotion: boolean;
};

export type GameProps = {
  /** Laufender Punktestand. Darf beliebig oft kommen, auch mit gleichem Wert. */
  onScore: (score: number) => void;
  /** Genau einmal pro Runde beim Spielende. Die Hülle trägt den Wert ein.
   * `gewonnen` ist optional — nur Spiele mit einer echten Sieg-Bedingung
   * (nicht nur "Leben aufgebraucht") geben es mit, dann zeigt die Hülle
   * eine andere Überschrift als beim gewöhnlichen Rundenende. */
  onGameOver: (score: number, gewonnen?: boolean) => void;
  /** Zurück ins Menü. Das Spiel muss das nicht selbst anbieten. */
  onExit: () => void;
  settings: Einstellungen;
  /** Bisherige Bestleistung dieses Spiels, schreibgeschützt — z. B. für
   * einen eigenen Startbildschirm. Kein Zugriff auf die Bestenliste selbst,
   * nur diese eine Zahl. 0, wenn noch nie gespielt. */
  bestScore: number;
  /** Ob dies die erste Runde seit dem Betreten des Spiels ist. Bei
   * „Nochmal" mountet die Hülle das Spiel komplett neu (frischer Zustand),
   * meldet hier aber `false` — Spiele mit eigenem Startbildschirm können
   * ihn dann überspringen und direkt weiterspielen lassen. Zurück ins Menü
   * und erneut hinein ergibt wieder `true`. */
  istErsteRunde: boolean;
  /**
   * Das zuletzt erreichte Level dieses Spiels, aus dem Speicher der Hülle.
   * `undefined` bei Spielen ohne Levelnummer.
   *
   * **Die dritte Erweiterung dieser Schnittstelle überhaupt** (nach
   * `gewonnen` und `level`/`duellFaehig`), und sie war nötig: Die acht
   * Level-Spiele führten ihre nächste Levelnummer in einer Modul-Variablen,
   * die beim Schließen der App verschwand — Florian fing bei jedem Öffnen
   * wieder bei Level 1 an. Ein Spiel darf nicht selbst speichern (Regel
   * oben), also muss die Hülle den Stand hereinreichen.
   */
  startLevel?: number;
  /**
   * Meldet der Hülle, welches Level als Nächstes drankommt — sie legt es ab.
   *
   * Wird beim Lösen aufgerufen und bei jedem Sprung über die Levelpfeile.
   * Im Duell (`level` gesetzt) rufen die Spiele es nicht auf: Ein
   * vorgegebenes Level ist kein Fortschritt.
   */
  onLevel?: (level: number) => void;
  /**
   * Ein **festgelegtes** Level. Nur im Duell gesetzt; sonst `undefined`.
   *
   * Spiele, bei denen gleiche Levelnummer schon immer dasselbe Rätsel
   * bedeutet, spielen dann genau dieses Level, merken sich hinterher **kein**
   * nächstes Level und lassen die Level-Pfeile nicht zu. Genau das macht ein
   * Duell fair: Beide bekommen dieselbe Aufgabe.
   *
   * Absichtlich optional und ohne jede Wirkung, wenn ein Spiel es nicht
   * liest — kein bestehendes Spiel musste sich dafür ändern, und die Hülle
   * bietet ein Duell nur bei Spielen mit `duellFaehig` an.
   */
  level?: number;
};

export type GameApi = {
  /** Kurz, klein, ohne Leerzeichen — steht auch in der Adresszeile. Bleibt
   * stabil, auch wenn sich `title` mal ändert — Bestenlisten hängen daran. */
  id: string;
  title: string;
  /** Farbe der Kachel, als CSS-Farbe. */
  accent: string;
  /** Eigenes SVG-Symbol auf der Kachel — kein Emoji, damit es zum Rest der
   * eigenen Optik passt. Größe kommt immer von außen. */
  Icon: React.FC<{ className?: string }>;
  /** `true`, wenn das Icon ein fertiges App-Symbol ist: eigener Hintergrund,
   * eigene runde Ecken, füllt die Kachel ganz aus. Die Hülle legt dann
   * keinen Farbverlauf mehr darunter. Ohne Angabe (der Normalfall) ist das
   * Icon ein kleines Zeichen, das mittig auf der Akzentfarbe sitzt. */
  iconVollflaechig?: boolean;
  /**
   * `true`, wenn dieses Spiel `GameProps.level` auswertet — wenn also
   * gleiche Levelnummer bei allen dasselbe Rätsel ergibt.
   *
   * Nur solche Spiele bietet die Hülle im Duell an. Bei einem Spiel mit
   * frischem Zufall je Runde (Snake Rush, Block Burst) hinge der Sieg am
   * Glück statt am Können, und ein Duell wäre nichts wert.
   */
  duellFaehig?: boolean;
  Component: React.FC<GameProps>;
};
