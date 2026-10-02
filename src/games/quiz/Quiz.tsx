import { Leiterspiel } from '../../core/Leiterspiel';
import type { LeiterStil } from '../../core/Leiterspiel';
import { levelstand } from '../../core/levelstand';
import type { DekoTeil } from '../../core/Startbildschirm';
import type { GameProps } from '../../core/types';
import { QuizIcon } from './Icon';
import { fragenFuerLevel } from './logik';

/**
 * Quiz Time: Wissen und ein paar Kopfnüsse auf der Gewinnleiter.
 *
 * Der Umschlag ist dünn: Regeln, Joker und Oberfläche stecken in `core/Leiterspiel.tsx`, die Fragen in
 * `logik.ts`. Dieses Spiel liefert nur seine Farben und sein Titelbild.
 */

/**
 * Welche Levelnummer als Nächstes drankommt — hält den Stand für die Sitzung (damit „Nochmal" weiterzählt)
 * und übernimmt beim ersten Betreten den gespeicherten aus der Hülle.
 */
const levelStand = levelstand();

/** Marineblau mit Gold: die Farben einer Fernsehshow, nicht die eines Schulhefts. */
const STIL: LeiterStil = {
  buehne: 'radial-gradient(130% 75% at 50% 0%, #1b2fa8 0%, #0b1456 48%, #040720 100%)',
  akzent: '#fbbf24',
  akzentDunkel: '#b45309',
  flaeche: 'rgba(9, 18, 84, 0.88)',
};

function Plakette({ text, groesse }: { text: string; groesse: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-xl border-2 font-black"
      style={{
        width: groesse,
        height: groesse,
        fontSize: groesse * 0.5,
        color: '#fbbf24',
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(8, 16, 78, 0.85)',
        boxShadow: '0 0 14px rgba(251, 191, 36, 0.45)',
      }}
    >
      {text}
    </span>
  );
}

const DEKO: readonly DekoTeil[] = [
  { x: 8, y: 11, winkel: -10, verzoegerung: 0, inhalt: <Plakette text="?" groesse={42} /> },
  { x: 85, y: 9, winkel: 12, verzoegerung: 0.6, inhalt: <Plakette text="A" groesse={32} /> },
  { x: 87, y: 72, winkel: -8, verzoegerung: 1.2, inhalt: <Plakette text="?" groesse={46} /> },
  { x: 5, y: 75, winkel: 10, verzoegerung: 0.35, inhalt: <Plakette text="D" groesse={34} /> },
  { x: 92, y: 42, winkel: 18, verzoegerung: 1.65, inhalt: <Plakette text="B" groesse={26} /> },
  { x: 3, y: 44, winkel: -16, verzoegerung: 0.9, inhalt: <Plakette text="C" groesse={28} /> },
];

export function Quiz(props: GameProps) {
  return (
    <Leiterspiel
      {...props}
      spiel="quiz"
      titel="Quiz Time"
      untertitel="Fünfzehn Fragen bis 100.000 Punkte. Drei Joker, zwei Sicherheitsstufen — und du darfst jederzeit aufhören."
      Symbol={QuizIcon}
      deko={DEKO}
      verlauf="linear-gradient(160deg, #0b1456 0%, #1e3a8a 52%, #4c1d95 100%)"
      knopfFarbe="#1e3a8a"
      stil={STIL}
      fragenFuerLevel={fragenFuerLevel}
      levelStand={levelStand}
    />
  );
}
