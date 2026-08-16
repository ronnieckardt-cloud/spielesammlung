import type { CSSProperties, FC, ReactNode } from 'react';

/**
 * Der Startbildschirm eines Spiels.
 *
 * Acht Spiele hatten sich diesen Aufbau einzeln zusammengesetzt — jedes Mal
 * dieselben rund fünfzig Zeilen, und dabei sind kleine Unterschiede
 * entstanden (mal `<h1>`, mal `<h2>`, mal mit 🏆 vor der Bestleistung, mal
 * ohne `autoFocus`). Vier Spiele hatten überhaupt keinen: Star Dash,
 * Ghost Chase, Brain Blitz und Word Play — dabei liegen `bestScore` und
 * `istErsteRunde` längst in `GameProps` bereit, sie wurden nur nie benutzt.
 *
 * Hier steckt der gemeinsame Teil. Ein Spiel liefert nur noch Verlauf,
 * Deko-Teile und den Untertitel.
 *
 * Ausdrücklich **kein** dunkler Hintergrund: „Ich will nicht, dass es alles
 * mit 'nem schwarzen Hintergrund ist." Jeder Startbildschirm hat seinen
 * eigenen kräftigen Verlauf.
 */

/** Ein schwebendes Deko-Teil im Hintergrund. Feste Liste je Spiel, kein Zufall. */
export type DekoTeil = {
  /** Position in Prozent der Fläche. */
  x: number;
  y: number;
  /** Startdrehung — `.block-schweben` dreht darum herum. */
  winkel?: number;
  /** Versetzt den Beginn, damit nicht alle im Gleichtakt schweben. */
  verzoegerung: number;
  /** Was gezeichnet wird. */
  inhalt: ReactNode;
};

export function Startbildschirm({
  titel,
  untertitel,
  bestScore,
  verlauf,
  deko = [],
  Symbol,
  knopfFarbe,
  onStart,
}: {
  titel: string;
  /** Steht unter dem Titel, solange es noch keine Bestleistung gibt. */
  untertitel: string;
  bestScore: number;
  /** Der Hintergrundverlauf, als fertiger CSS-Wert. */
  verlauf: string;
  deko?: readonly DekoTeil[];
  /** Das App-Symbol des Spiels. */
  Symbol: FC<{ className?: string }>;
  /** Textfarbe des Spielen-Knopfes, passend zum Verlauf. */
  knopfFarbe: string;
  onStart: () => void;
}) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center"
      style={{ background: verlauf }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {deko.map((d, i) => (
          <span
            key={i}
            className="block-schweben absolute"
            style={
              {
                left: `${d.x}%`,
                top: `${d.y}%`,
                animationDelay: `${d.verzoegerung}s`,
                '--grundwinkel': `${d.winkel ?? 0}deg`,
              } as CSSProperties
            }
          >
            {d.inhalt}
          </span>
        ))}
      </div>

      {/* Das App-Symbol bringt Hintergrund und Ecken selbst mit — es steht
          hier für sich, wie auf einer Store-Seite. */}
      <Symbol className="relative size-32 rounded-[2rem] shadow-2xl md:size-40 md:rounded-[2.5rem]" />

      <div className="relative">
        <h1
          className="text-5xl leading-none font-black tracking-tight text-white md:text-6xl"
          style={{ textShadow: '0 4px 0 rgba(0,0,0,0.24), 0 10px 24px rgba(0,0,0,0.35)' }}
        >
          {titel}
        </h1>
        {/*
         * **Beides, nicht entweder-oder.**
         *
         * Vorher stand hier `bestScore > 0 ? Bestleistung : untertitel` —
         * der Untertitel ist aber die **Spielregel**, und die verschwand
         * damit nach der allerersten Runde für immer. Zusammen mit
         * `.nur-bei-platz` (blendet den Hilfetext im Spiel unter 720 Pixel
         * Höhe aus) hieß das auf einem kurzen Bildschirm: Sobald ein
         * Bestwert existiert, steht die Regel **nirgends mehr**. Das traf
         * zwölf Spiele.
         *
         * Die Regel steht jetzt immer oben, die Bestleistung als zweite,
         * kleinere Zeile darunter — die eine sagt, was zu tun ist, die
         * andere, wie gut man schon war. Das sind zwei verschiedene
         * Auskünfte und keine Alternative.
         */}
        <p className="mt-3 text-sm font-semibold text-white/85 md:text-base">{untertitel}</p>
        {bestScore > 0 && (
          <p className="mt-1.5 text-sm font-bold text-white/70 md:text-base">
            <span aria-hidden="true">🏆</span> Beste Punktzahl: {bestScore}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onStart}
        // Wer mit der Tastatur kommt, soll sofort loslegen können.
        autoFocus
        /* Wächst auf dem Tablet mit. Der Startbildschirm ist die einzige
           Seite, die nur aus drei Dingen besteht — Symbol, Name, Knopf —,
           und wenn keines davon mitwächst, steht auf einem iPad eine
           Handy-Ansicht in der Mitte einer großen leeren Fläche. */
        className="startknopf-puls relative rounded-2xl bg-white px-14 py-4 text-xl font-extrabold shadow-2xl transition-transform duration-100 ease-out active:scale-95 md:px-16 md:py-5 md:text-2xl"
        style={{ color: knopfFarbe }}
      >
        Spielen
      </button>
    </div>
  );
}
