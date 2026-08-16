import type { CSSProperties } from 'react';
import type { GameApi } from '../core/types';

/**
 * Eine Spielkachel — Symbol, verdiente Sterne, Name.
 *
 * ## Warum hier Sterne stehen und kein „Neu" mehr
 *
 * Vorher trug jede noch nicht gespielte Kachel ein oranges „Neu". Bei
 * vierzehn Spielen war das ein Hinweis; bei **zwanzig** waren es zwanzig
 * orange Fähnchen gleichzeitig, die lauter schrien als die Symbole
 * darunter. Wenn alles neu ist, ist nichts neu — das Abzeichen sagte
 * nichts mehr und störte nur.
 *
 * An seiner Stelle stehen jetzt die **verdienten Sterne**. Der Unterschied
 * ist grundsätzlich: „Neu" beschreibt eine Abwesenheit und verschwindet,
 * sobald man etwas tut. Sterne beschreiben einen Besitz und **wachsen**.
 * Drei blasse Sterne sagen einem Kind genauso deutlich „hier ist noch
 * nichts" — aber sie sagen zusätzlich, dass es hier etwas zu holen gibt,
 * und wie viel.
 *
 * Sie kommen aus `fortschritt.jeSpiel[id].besteSterne`, also aus derselben
 * Rechnung wie die Sterne im Rundenende. Es gibt keine zweite Wahrheit.
 */
export function Spielkachel({
  spiel,
  sterne,
  onSpielen,
  verzoegerung,
  nurBreit = false,
}: {
  spiel: GameApi;
  /** Beste je erreichte Sternzahl, 0 = noch nicht gespielt. */
  sterne: number;
  onSpielen: (id: string) => void;
  verzoegerung?: number;
  /**
   * Nur auf breiten Bildschirmen zeigen.
   *
   * Auf dem Handy stehen acht Kacheln auf der Startseite, auf einem Tablet
   * alle zwanzig — dort ist Platz, und sie füllen genau die Höhe, die sonst
   * leer bliebe. Umgesetzt als CSS-Regel statt als Abfrage in JavaScript,
   * damit beim Drehen des Geräts nichts nachgerechnet werden muss.
   *
   * Wie viele je Reihe stehen, entscheidet nicht diese Marke, sondern das
   * Raster der Liste (`repeat(auto-fit, …)`) — es füllt jede Breite von
   * selbst aus.
   */
  nurBreit?: boolean;
}) {
  const Icon = spiel.Icon;
  // Fertige App-Symbole bringen Hintergrund und Ecken selbst mit — von der
  // Hülle kommt dann nur noch der farbige Schatten.
  const vollflaechig = spiel.iconVollflaechig === true;

  return (
    <li
      /*
       * **Keine feste Breite mehr.** Die Kachel ist jetzt eine Rasterzelle
       * und füllt sie aus; wie breit die Zelle ist, entscheidet die Liste.
       * Mit der früheren festen Breite plus `flex-wrap` brach die Reihe bei
       * jeder Bildschirmbreite anders um — zwischen 640 und 767 Pixeln
       * ergaben acht Kacheln 6+2, zwischen 768 und 833 standen nur drei je
       * Reihe, weniger als auf einem 375er-iPhone.
       */
      className={`kachel-rein w-full flex-col items-center gap-1 ${nurBreit ? 'hidden md:flex' : 'flex'}`}
      style={{ '--verzoegerung': `${verzoegerung ?? 0}ms` } as CSSProperties}
    >
      <button
        type="button"
        onClick={() => onSpielen(spiel.id)}
        aria-label={`${spiel.title} — ${sterne > 0 ? `${sterne} von 3 Sternen` : 'noch nicht gespielt'}`}
        style={{
          inlineSize: 'var(--kachel)',
          blockSize: 'var(--kachel)',
          background: vollflaechig
            ? undefined
            : `linear-gradient(150deg, color-mix(in srgb, ${spiel.accent} 100%, white 30%), ${spiel.accent} 55%, color-mix(in srgb, ${spiel.accent} 100%, black 22%))`,
          boxShadow: `0 6px 16px -6px color-mix(in srgb, ${spiel.accent} 70%, transparent)`,
        }}
        className="kippbar grid place-items-center rounded-[22%] text-white"
      >
        {vollflaechig ? (
          <Icon className="size-full" />
        ) : (
          <Icon className="size-2/5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
        )}
      </button>

      {/* Die Sterne sind `aria-hidden` — dieselbe Information steht schon im
          `aria-label` des Knopfes, und zweimal vorgelesen nervt. */}
      <span aria-hidden="true" className="flex gap-px">
        {[1, 2, 3].map((n) => (
          <svg
            key={n}
            viewBox="-12 -12 24 24"
            /* Waechst mit der Kachel mit. Vorher fest 10 Pixel: Auf einem
               Tablet mit 88er-Kachel schrumpften die Sterne optisch zu
               Staub, obwohl sie die Auszeichnung des Spiels sind. */
            style={{ width: 'calc(var(--kachel) * 0.13)', height: 'calc(var(--kachel) * 0.13)' }}
          >
            <path
              d="M0-11 3.2-3.9 11-3.1 5.2 2.1 6.8 9.7 0 5.9-6.8 9.7-5.2 2.1-11-3.1-3.2-3.9Z"
              fill={n <= sterne ? 'var(--color-gold)' : 'rgba(255,255,255,0.18)'}
            />
          </svg>
        ))}
      </span>

      {/* `min-w-0` ist nötig, damit ein langer Name die Rasterzelle nicht
          auseinanderdrückt — „Ghost Chase" bricht dann um, statt die ganze
          Reihe breiter zu machen. */}
      <span className="w-full min-w-0 text-center text-[11px] leading-tight font-medium text-white/90">
        {spiel.title}
      </span>
    </li>
  );
}
