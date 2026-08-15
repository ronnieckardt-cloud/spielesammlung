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
  Component: React.FC<GameProps>;
};
