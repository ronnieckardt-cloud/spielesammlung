import type { CSSProperties, FC } from 'react';

/**
 * Eine Kachel, die **die Seite verlässt**, statt ein Spiel der Sammlung zu öffnen.
 *
 * Arena Brawler ist absichtlich kein `GameApi`-Spiel: Es gibt zwei eigenständige Fassungen (Godot-Export
 * und Phaser-Mini), jede mit eigener `index.html`, keine davon Teil dieser React-App (siehe den Kommentar
 * an `ZeileLink` in `MehrSeite.tsx`). Eine Kachel im Raster ist trotzdem der Ort, an dem man ein Spiel
 * sucht — die Zeilen unter „Mehr" findet ein Kind nicht.
 *
 * Deshalb sieht sie aus wie jede andere Kachel (gleiche Größe, gleicher Schatten, `.kippbar`), ist aber
 * ein `<a href>`: Ein echter Link navigiert die **ganze** Seite, und der Zurück-Knopf des Browsers
 * bringt zuverlässig hierher zurück. Bewusst ohne `target="_blank"` — in einer auf dem iPhone
 * installierten App ist ein neuer Tab unzuverlässig.
 *
 * **Keine Sterne und kein Fortschritt:** Die Seite weiß nichts von der Sammlung und meldet keine
 * Punkte, also gäbe es nichts anzuzeigen. Eine leere Sternreihe würde „hier ist etwas zu holen"
 * versprechen. Der Platz bleibt aber frei, damit der Name auf einer Linie mit den Nachbarn steht.
 */
export function Linkkachel({
  titel,
  href,
  Symbol,
  akzent,
  hinweis,
  verzoegerung,
}: {
  titel: string;
  href: string;
  /** Das fertige App-Symbol (füllt die Kachel selbst aus). */
  Symbol: FC<{ className?: string }>;
  /** Farbe des Schattens unter der Kachel. */
  akzent: string;
  /** Für Vorlese-Programme: wohin der Link führt. */
  hinweis: string;
  verzoegerung?: number;
}) {
  return (
    <li
      className="kachel-rein flex w-full flex-col items-center gap-1"
      style={{ '--verzoegerung': `${verzoegerung ?? 0}ms` } as CSSProperties}
    >
      <a
        href={href}
        aria-label={`${titel} — ${hinweis}`}
        style={{
          inlineSize: 'var(--kachel)',
          blockSize: 'var(--kachel)',
          boxShadow: `0 6px 16px -6px color-mix(in srgb, ${akzent} 70%, transparent)`,
        }}
        className="kippbar grid place-items-center rounded-[22%] text-white"
      >
        <Symbol className="size-full" />
      </a>

      {/* Dieselbe Höhe wie die Sternreihe der Spielkacheln, nur leer. */}
      <span aria-hidden="true" style={{ height: 'calc(var(--kachel) * 0.13)' }} />

      <span className="w-full min-w-0 text-center text-[11px] leading-tight font-medium text-white/90">{titel}</span>
    </li>
  );
}
