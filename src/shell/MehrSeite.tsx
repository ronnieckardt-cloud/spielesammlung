import type { ReactNode } from 'react';
import { BunterGrund } from './BunterGrund';
import { Avatar } from './AvatarBild';
import { avatarLesen, fortschrittLesen } from './speicher';
import { stufeAus } from './fortschritt';
import type { Konto } from './konto';

/**
 * „Mehr": alles, was man selten braucht.
 *
 * Die Navigation hat fünf Plätze, und ab sechs wird jeder schmaler als ein
 * Daumen. Konto, Duelle und Einstellungen sind die drei Bereiche, die man
 * einmal einrichtet und danach kaum wieder anfasst — die gehören hinter
 * einen gemeinsamen Punkt, nicht auf die Leiste.
 */
function Zeile({
  symbol,
  titel,
  hinweis,
  onKlick,
}: {
  symbol: ReactNode;
  titel: string;
  hinweis?: string;
  onKlick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onKlick}
        className="druckbar flex min-h-14 w-full items-center gap-3.5 rounded-2xl border border-white/18 bg-white/10 px-4 py-3 text-left backdrop-blur-sm"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center text-2xl">
          {symbol}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-white">{titel}</span>
          {hinweis && <span className="block truncate text-xs text-white/70">{hinweis}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-white/55">
          ›
        </span>
      </button>
    </li>
  );
}

/**
 * Wie `Zeile`, aber ein echter Link statt eines Knopfs, der nur die Ansicht
 * innerhalb dieser App wechselt.
 *
 * Arena Brawler ist absichtlich kein `GameApi`-Spiel — kein Eintrag in
 * `registry.ts`, kein Wrapper, `src/games/` bleibt unangetastet. Es ist ein
 * eigenständiger Phaser-Prototyp mit eigener `index.html` unter
 * `/arena-brawler/` (siehe `arena-brawler-mini/README.md`), gespiegelt nach
 * `public/arena-brawler/`. Ein `<a>` mit echtem `href` navigiert deshalb die
 * **ganze Seite** dorthin, statt nur intern die Ansicht zu wechseln — genau
 * das ist hier richtig, nicht unabsichtlich einfacher gebaut. Bewusst ohne
 * `target="_blank"`: In einer installierten Startbildschirm-App auf iOS ist
 * ein neuer Tab unzuverlässig, eine normale Navigation funktioniert dort
 * wie im Browser auch immer gleich, und der Zurück-Knopf/die Wisch-Geste
 * bringt zuverlässig hierher zurück.
 */
function ZeileLink({
  symbol,
  titel,
  hinweis,
  href,
}: {
  symbol: ReactNode;
  titel: string;
  hinweis?: string;
  href: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="druckbar flex min-h-14 w-full items-center gap-3.5 rounded-2xl border border-white/18 bg-white/10 px-4 py-3 text-left backdrop-blur-sm"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center text-2xl">
          {symbol}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-white">{titel}</span>
          {hinweis && <span className="block truncate text-xs text-white/70">{hinweis}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-white/55">
          ›
        </span>
      </a>
    </li>
  );
}

export function MehrSeite({
  konto,
  onKonto,
  onAvatar,
  onDuelle,
  onEinstellungen,
}: {
  konto: Konto | null;
  onKonto: () => void;
  onAvatar: () => void;
  onDuelle: () => void;
  onEinstellungen: () => void;
}) {
  // Bewusst nicht hinter das Konto gestellt: Der Avatar ist lokale Kür wie
  // der Fortschritt, keine Kontoeinstellung — er funktioniert genauso ohne
  // Anmeldung, das soll die Reihenfolge hier auch zeigen.
  const stufe = stufeAus(fortschrittLesen().xp).stufe;
  const avatar = avatarLesen(stufe);

  return (
    <BunterGrund>
      <header className="rein-von-oben mb-4">
        <h1 className="text-3xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          Mehr
        </h1>
      </header>

      <ul className="rein-von-unten flex flex-col gap-2.5" style={{ animationDelay: '60ms' }}>
        <Zeile
          symbol={konto ? konto.name.slice(0, 1).toUpperCase() : '👤'}
          titel={konto ? konto.name : 'Anmelden'}
          hinweis={
            konto
              ? 'Punkte zählen auf allen Geräten'
              : 'Damit deine Punkte auf jedem Gerät zählen'
          }
          onKlick={onKonto}
        />
        <Zeile
          symbol={<Avatar konfig={avatar} className="size-9" />}
          titel="Avatar"
          hinweis="Farbe, Form, Augen und Extra"
          onKlick={onAvatar}
        />
        <Zeile
          symbol="⚔️"
          titel="Duelle"
          hinweis="Gegen jemanden dasselbe Level spielen"
          onKlick={onDuelle}
        />
        <Zeile symbol="⚙️" titel="Einstellungen" hinweis="Ton und Bewegung" onKlick={onEinstellungen} />
        <ZeileLink
          symbol="🕹️"
          titel="Arena Brawler"
          hinweis="Prototyp · öffnet eine eigene Seite"
          href="/arena-brawler/"
        />
      </ul>

      <p className="mt-5 text-center text-xs text-white/55">Läuft auch ohne Internet.</p>
    </BunterGrund>
  );
}
