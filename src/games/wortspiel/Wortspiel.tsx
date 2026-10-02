import { Leiterspiel } from '../../core/Leiterspiel';
import type { LeiterStil } from '../../core/Leiterspiel';
import { levelstand } from '../../core/levelstand';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { WortspielIcon } from './Icon';
import { fragenFuerLevel } from './logik';

/**
 * Word Play: Wörter, Redewendungen und Rechtschreibung auf der Gewinnleiter.
 *
 * Der Umschlag ist dünn: Regeln, Joker und Oberfläche stecken in `core/Leiterspiel.tsx`, die Fragen in
 * `logik.ts`. Dieses Spiel liefert nur seine Farben und sein Titelbild.
 */

/**
 * Welche Levelnummer als Nächstes drankommt — hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * und übernimmt beim ersten Betreten den gespeicherten aus der Hülle.
 */
const levelStand = levelstand();

/** Tiefes Violett mit Pink: dieselbe Bühne wie Quiz Time, nur in der Farbe des Spiels. */
const STIL: LeiterStil = {
  buehne: 'radial-gradient(130% 75% at 50% 0%, #6a1fa8 0%, #2c0c5c 48%, #12041f 100%)',
  akzent: '#ff6fae',
  akzentDunkel: '#be185d',
  flaeche: 'rgba(40, 10, 78, 0.88)',
};

/** Buchstabenplättchen als Deko — feste Liste, kein Zufall. */
const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 12, winkel: -12, verzoegerung: 0, inhalt: <Plaettchen buchstabe="W" groesse={40} /> },
  { x: 85, y: 10, winkel: 14, verzoegerung: 0.6, inhalt: <Plaettchen buchstabe="O" groesse={32} /> },
  { x: 87, y: 71, winkel: -8, verzoegerung: 1.2, inhalt: <Plaettchen buchstabe="R" groesse={44} /> },
  { x: 5, y: 74, winkel: 10, verzoegerung: 0.35, inhalt: <Plaettchen buchstabe="T" groesse={36} /> },
  { x: 92, y: 42, winkel: 20, verzoegerung: 1.65, inhalt: <Plaettchen buchstabe="ß" groesse={26} /> },
  { x: 3, y: 44, winkel: -20, verzoegerung: 0.9, inhalt: <Plaettchen buchstabe="Ä" groesse={30} /> },
];

function Plaettchen({ buchstabe, groesse }: { buchstabe: string; groesse: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-lg bg-white/90 font-black text-rose-700 shadow-lg"
      style={{ width: groesse, height: groesse, fontSize: groesse * 0.55 }}
    >
      {buchstabe}
    </span>
  );
}

export function Wortspiel(props: GameProps) {
  return (
    <Leiterspiel
      {...props}
      spiel="wortspiel"
      titel="Word Play"
      untertitel="Fünfzehn Wort-Fragen bis 100.000 Punkte. Drei Joker, zwei Sicherheitsstufen — und du darfst jederzeit aufhören."
      Symbol={WortspielIcon}
      deko={DEKO}
      verlauf="linear-gradient(160deg, #be123c 0%, #9333ea 50%, #1d4ed8 100%)"
      knopfFarbe="#be123c"
      stil={STIL}
      fragenFuerLevel={fragenFuerLevel}
      levelStand={levelStand}
    />
  );
}
