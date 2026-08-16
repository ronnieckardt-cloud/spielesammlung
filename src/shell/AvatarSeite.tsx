import { useState } from 'react';
import { Seite } from './Seite';
import { Avatar } from './AvatarBild';
import { OPTIONEN, abStufeVon, freigeschaltet } from './avatar';
import type { AvatarTeil } from './avatar';
import { avatarLesen, avatarSchreiben, fortschrittLesen } from './speicher';
import { stufeAus } from './fortschritt';

/**
 * Der Avatar-Baukasten.
 *
 * Sechs Reihen — Hautfarbe, Frisur, Haarfarbe, Oberteil, Hose, Extra —, in
 * jeder die Vorschau jeder Option. Gesperrte Optionen stehen **blass, aber
 * sichtbar** da, mit der Stufe, ab der sie zu haben sind — dieselbe Regel
 * wie bei den Erfolgen auf der Fortschrittsseite: „Neu" beschreibt eine
 * Abwesenheit und verschwindet, ein gesperrtes Teil beschreibt ein Ziel und
 * bleibt stehen. Ein Kind muss sehen können, was als Nächstes kommt, sonst
 * ist der Anreiz weg.
 *
 * Bei der Hautfarbe ist **jede** Option von Anfang an offen — siehe die
 * Begründung in `avatar.ts`. Diese Seite weiß davon nichts Besonderes,
 * `freigeschaltet('hautfarbe', 1)` liefert einfach schon alle.
 */

const TEIL_NAME: Record<AvatarTeil, string> = {
  hautfarbe: 'Hautfarbe',
  frisur: 'Frisur',
  haarfarbe: 'Haarfarbe',
  oberteilSchnitt: 'Oberteil — Schnitt',
  oberteil: 'Oberteil — Farbe',
  hosenSchnitt: 'Hose — Schnitt',
  hose: 'Hose — Farbe',
  accessoire: 'Extra',
};

const OPTION_NAME: Record<string, string> = {
  hell: 'Hell',
  mittel: 'Mittel',
  oliv: 'Oliv',
  braun: 'Braun',
  dunkel: 'Dunkel',
  kahl: 'Kahl',
  kurz: 'Kurz',
  zopf: 'Zopf',
  'zwei-zoepfe': 'Zwei Zöpfe',
  lang: 'Lang',
  lockig: 'Lockig',
  irokese: 'Irokese',
  schwarz: 'Schwarz',
  blond: 'Blond',
  rot: 'Rot',
  blau: 'Blau',
  pink: 'Pink',
  gruen: 'Grün',
  orange: 'Orange',
  violett: 'Violett',
  gold: 'Gold',
  grau: 'Grau',
  weiss: 'Weiß',
  tuerkis: 'Türkis',
  gelb: 'Gelb',
  beige: 'Beige',
  kurzarm: 'Kurzarm',
  langarm: 'Langarm',
  pulli: 'Pulli',
  'kurz-eng': 'Kurz, schmal',
  'kurz-weit': 'Kurz, weit',
  'lang-eng': 'Lang, schmal',
  'lang-weit': 'Lang, weit',
  rock: 'Rock',
  keins: 'Keins',
  brille: 'Brille',
  fliege: 'Fliege',
  schal: 'Schal',
  kopfhoerer: 'Kopfhörer',
  'cap-schwarz': 'Cap, schwarz',
  'cap-weiss': 'Cap, weiß',
  'cap-gruen': 'Cap, grün',
  'cap-schwarz-hinten': 'Cap, schwarz, andersrum',
  'cap-weiss-hinten': 'Cap, weiß, andersrum',
  'cap-gruen-hinten': 'Cap, grün, andersrum',
  krone: 'Krone',
};

export function AvatarSeite({ onZurueck }: { onZurueck: () => void }) {
  // Wie `FortschrittSeite`: frisch aus dem Speicher gelesen, keine Props
  // von der Hülle nötig. `stufe` bestimmt, was zur Wahl steht — `avatarLesen`
  // bekommt sie deshalb sofort mit und liefert nie eine gesperrte Auswahl.
  const stufe = stufeAus(fortschrittLesen().xp).stufe;
  const [konfig, setKonfig] = useState(() => avatarLesen(stufe));

  const waehlen = (teil: AvatarTeil, id: string) => {
    const neu = { ...konfig, [teil]: id };
    setKonfig(neu);
    avatarSchreiben(neu);
  };

  return (
    <Seite titel="Avatar" onZurueck={onZurueck}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6">
        <Avatar konfig={konfig} className="size-32 drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]" />

        {(Object.keys(OPTIONEN) as AvatarTeil[]).map((teil) => (
          <section key={teil} className="w-full" aria-labelledby={`avatar-${teil}-titel`}>
            <h2 id={`avatar-${teil}-titel`} className="mb-2 text-sm font-black text-white/85">
              {TEIL_NAME[teil]}
            </h2>
            <ul className="grid grid-cols-4 gap-2">
              {OPTIONEN[teil].map((option) => {
                const offen = freigeschaltet(teil, stufe).includes(option.id);
                const gewaehlt = konfig[teil] === option.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      disabled={!offen}
                      onClick={() => waehlen(teil, option.id)}
                      aria-label={
                        offen
                          ? `${TEIL_NAME[teil]}: ${OPTION_NAME[option.id] ?? option.id}${gewaehlt ? ' — ausgewählt' : ''}`
                          : `${TEIL_NAME[teil]}: ${OPTION_NAME[option.id] ?? option.id} — gesperrt bis Stufe ${option.abStufe}`
                      }
                      className={`flex min-h-11 w-full flex-col items-center gap-1 rounded-2xl border p-2 transition-colors ${
                        gewaehlt
                          ? 'border-fokus bg-fokus/15'
                          : offen
                            ? 'border-rand bg-flaeche enabled:active:bg-flaeche-hoch'
                            : 'border-rand/50 bg-flaeche/40'
                      }`}
                    >
                      <span className={offen ? '' : 'opacity-35 grayscale'}>
                        <Avatar
                          konfig={{ ...konfig, [teil]: option.id }}
                          className="size-11"
                        />
                      </span>
                      <span
                        className={`text-center text-[11px] leading-tight font-medium ${
                          offen ? 'text-white/85' : 'text-white/50'
                        }`}
                      >
                        {offen ? (OPTION_NAME[option.id] ?? option.id) : `ab Stufe ${abStufeVon(teil, option.id)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Seite>
  );
}
