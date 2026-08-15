import type { Stufenstand } from './fortschritt';

/**
 * Stufe und Erfahrungsbalken — auf der Startseite und auf der
 * Fortschrittsseite dasselbe Bauteil.
 *
 * Das Abzeichen links ist eine **Scheibe mit Rand**, keine Zahl auf
 * farbigem Grund. Der Unterschied ist klein und wirkt trotzdem: Eine
 * Scheibe mit hellem Rand und dunklem Kern liest sich als Gegenstand, eine
 * Zahl auf einem Rechteck als Beschriftung. Ein Level-Abzeichen soll wie
 * etwas aussehen, das man sich verdient hat.
 */
export function Stufenkarte({
  stand,
  gross = false,
}: {
  stand: Stufenstand;
  /** Größere Fassung für die Fortschrittsseite. */
  gross?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-white/20 bg-white/12 backdrop-blur-sm ${gross ? 'p-4' : 'px-3.5 py-3'}`}
      style={{ boxShadow: 'var(--schatten-2)' }}
    >
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full font-black text-white ${gross ? 'size-16 text-2xl' : 'size-12 text-lg'}`}
        style={{
          background:
            'radial-gradient(circle at 32% 26%, color-mix(in oklab, var(--color-xp) 80%, white), var(--color-xp) 55%, color-mix(in oklab, var(--color-xp) 70%, black))',
          boxShadow:
            'inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 -2px 6px rgb(0 0 0 / 0.35), var(--schatten-2)',
        }}
      >
        {stand.stufe}
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className={`font-black text-white ${gross ? 'text-lg' : 'text-sm'}`}>
            Stufe {stand.stufe}
          </span>
          <span className="text-xs font-bold text-white/75 tabular-nums">
            {stand.imLevel} / {stand.fuerLevel} XP
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-black/30"
          role="img"
          aria-label={`Stufe ${stand.stufe}, ${stand.imLevel} von ${stand.fuerLevel} Erfahrungspunkten`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.round(stand.anteil * 100))}%`,
              background: 'linear-gradient(90deg, var(--color-xp), var(--color-fokus))',
              boxShadow: '0 0 12px -2px var(--color-fokus)',
              transition: 'width 700ms var(--kurve)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
