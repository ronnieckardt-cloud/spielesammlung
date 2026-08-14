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
  /** Genau einmal pro Runde beim Spielende. Die Hülle trägt den Wert ein. */
  onGameOver: (score: number) => void;
  /** Zurück ins Menü. Das Spiel muss das nicht selbst anbieten. */
  onExit: () => void;
  settings: Einstellungen;
};

export type GameApi = {
  /** Kurz, klein, ohne Leerzeichen — steht auch in der Adresszeile. */
  id: string;
  title: string;
  /** Ein Satz fürs Kachelmenü. */
  blurb: string;
  /** Farbe der Kachel, als CSS-Farbe. */
  accent: string;
  /** Zeichen auf der Kachel — damit Farbe nicht das einzige Merkmal ist. */
  symbol: string;
  Component: React.FC<GameProps>;
};
