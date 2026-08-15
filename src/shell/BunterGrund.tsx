import type { CSSProperties, ReactNode } from 'react';

/**
 * Der kräftige Farbgrund der Hüllenseiten.
 *
 * Stand vorher nur unter der Startseite. Genau dadurch entstand der
 * auffälligste Bruch der App: Wer von der bunten Startseite auf die
 * Bestenliste ging, landete auf fast schwarzem Grund — es wirkte wie zwei
 * verschiedene Programme. Jetzt teilen sich alle Hüllenseiten denselben
 * Grund, und der Zusammenhalt entsteht von selbst.
 *
 * Die vier Farbflecken sind stark unscharf und blass: Sie sollen den
 * Hintergrund beleben, aber nie mit dem Inhalt konkurrieren.
 */
const DEKO_FLECKEN: readonly {
  x: number;
  y: number;
  groesse: number;
  farbe: string;
  verzoegerung: number;
}[] = [
  { x: 6, y: 8, groesse: 90, farbe: '#f472b6', verzoegerung: 0 },
  { x: 88, y: 6, groesse: 70, farbe: '#38bdf8', verzoegerung: 0.8 },
  { x: 92, y: 60, groesse: 100, farbe: '#facc15', verzoegerung: 1.4 },
  { x: 4, y: 70, groesse: 80, farbe: '#2dd4bf', verzoegerung: 0.4 },
];

export function BunterGrund({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-full flex-col"
      style={{
        background:
          'linear-gradient(165deg, #1e1b4b 0%, #4338ca 30%, #7c3aed 60%, #db2777 100%)',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {DEKO_FLECKEN.map((f, i) => (
          <span
            key={i}
            className="block-schweben absolute rounded-full opacity-20 blur-2xl"
            style={
              {
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: f.groesse,
                height: f.groesse,
                backgroundColor: f.farbe,
                animationDelay: `${f.verzoegerung}s`,
                '--grundwinkel': '0deg',
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        /*
         * Auf Tablets breiter. `max-w-3xl` (768 px) ist für ein Handy
         * richtig und auf einem 13-Zoll-iPad im Hochformat (1032 Punkte)
         * eine schmale Spalte mit breiten toten Rändern links und rechts —
         * genau das, wovor die Regel „Mobile ist kein verkleinertes
         * Desktop" warnt, nur in die andere Richtung.
         */
        className="seiten-auftritt relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6 md:max-w-5xl md:px-6"
        style={
          {
            // Abstand zur Statusleiste bei installierter App auf dem iPhone.
            paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
