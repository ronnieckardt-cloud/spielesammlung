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
   * Auf einem Handy passen vier Kacheln je Reihe, auf einem Tablet fünf.
   * Acht Kacheln ergeben dort 5 + 3 — eine halbe Reihe, die schief im
   * Regal hängt. Mit zwei zusätzlichen Kacheln stehen auf beiden Geräten
   * **volle** Reihen: 4 + 4 auf dem Handy, 5 + 5 auf dem Tablet.
   */
  nurBreit?: boolean;
}) {
  const Icon = spiel.Icon;
  // Fertige App-Symbole bringen Hintergrund und Ecken selbst mit — von der
  // Hülle kommt dann nur noch der farbige Schatten.
  const vollflaechig = spiel.iconVollflaechig === true;

  return (
    <li
      className={`kachel-rein flex-col items-center gap-1 ${nurBreit ? 'hidden md:flex' : 'flex'}`}
      style={
        {
          // Beschriftungsbreite wächst mit der Kachel mit. Knapp bemessen:
          // Jeder zusätzliche Zentimeter kostet auf einem 375er-iPhone die
          // vierte Kachel je Reihe — und damit eine ganze Reihe.
          width: 'calc(var(--kachel) + 0.5rem)',
          '--verzoegerung': `${verzoegerung ?? 0}ms`,
        } as CSSProperties
      }
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
          <svg key={n} viewBox="-12 -12 24 24" className="size-2.5">
            <path
              d="M0-11 3.2-3.9 11-3.1 5.2 2.1 6.8 9.7 0 5.9-6.8 9.7-5.2 2.1-11-3.1-3.2-3.9Z"
              fill={n <= sterne ? 'var(--color-gold)' : 'rgba(255,255,255,0.18)'}
            />
          </svg>
        ))}
      </span>

      <span className="w-full text-center text-[11px] leading-tight font-medium text-white/90">
        {spiel.title}
      </span>
    </li>
  );
}
