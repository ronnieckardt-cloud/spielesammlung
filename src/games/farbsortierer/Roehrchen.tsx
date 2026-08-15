import { ROEHRCHEN_BREITE, ROEHRCHEN_HOEHE, ROEHRCHEN_UMRISS } from './geometrie';
import type { FarbEintrag } from './farben';

type Block = { farbe: number; einheiten: number };

/**
 * Fasst aufeinanderfolgende Schichten derselben Farbe zu einem Block zusammen.
 * Ohne das bekäme jede einzelne Schicht ihren eigenen Verlauf und es sähe an
 * jeder Schichtgrenze wie ein Neuanfang aus — auch wenn zwei gleiche Farben
 * direkt übereinanderliegen. Ein Block = ein Rechteck = ein glatter Verlauf.
 */
function bloeckeBauen(
  farben: readonly number[],
  teilschicht: { farbe: number; einheiten: number } | undefined,
): Block[] {
  const bloecke: Block[] = [];
  for (const f of farben) {
    const letztes = bloecke[bloecke.length - 1];
    if (letztes && letztes.farbe === f) letztes.einheiten += 1;
    else bloecke.push({ farbe: f, einheiten: 1 });
  }
  if (teilschicht && teilschicht.einheiten > 0.008) {
    const letztes = bloecke[bloecke.length - 1];
    if (letztes && letztes.farbe === teilschicht.farbe) letztes.einheiten += teilschicht.einheiten;
    else bloecke.push({ farbe: teilschicht.farbe, einheiten: teilschicht.einheiten });
  }
  return bloecke;
}

/**
 * Zeichnet ein einzelnes Röhrchen mit seinem Inhalt — reine Anzeige, kein
 * Antippen, keine Bewegung. Gibt bewusst nur ein <g>-Fragment zurück, keine
 * eigene <svg>: so leben ruhig stehende UND das gerade fliegende Röhrchen im
 * selben Koordinatensystem wie die berechnete Gieß-Geometrie — die Drehung
 * in der Anzeige ist exakt dieselbe, die ausgusskante() zugrunde legt.
 */
export function Roehrchen({
  farben,
  kapazitaet,
  palette,
  ausgewaehlt = false,
  fertig = false,
  ruhig = false,
  teilschicht,
}: {
  farben: readonly number[];
  kapazitaet: number;
  /** Die für dieses Level gezogenen Farben, indiziert wie die Logik-Zahlen. */
  palette: readonly FarbEintrag[];
  ausgewaehlt?: boolean;
  /** Randvoll und einfarbig — dann bekommt es einen Deckel aufgesetzt. */
  fertig?: boolean;
  /** Bei „weniger Bewegung" wird der Deckel ohne Animation gesetzt. */
  ruhig?: boolean;
  /** Zusätzliche, stufenlose Höhe oberhalb von `farben` — für die Gieß-Animation:
   *  beim Ziel wächst sie von 0 an, bei der Quelle schrumpft sie auf 0. */
  teilschicht?: { farbe: number; hoehe: number };
}) {
  const schichthoehe = ROEHRCHEN_HOEHE / kapazitaet;
  const bloecke = bloeckeBauen(
    farben,
    teilschicht && { farbe: teilschicht.farbe, einheiten: teilschicht.hoehe / schichthoehe },
  );

  let y = ROEHRCHEN_HOEHE;

  return (
    <g style={{ filter: ausgewaehlt ? 'drop-shadow(0 0 8px var(--color-fokus))' : undefined }}>
      {/* Glaskörper: dezenter Verlauf statt platter Fläche, damit auch das
          leere Röhrchen nach Glas aussieht und nicht nach einem Umriss. */}
      <path
        d={ROEHRCHEN_UMRISS}
        fill="url(#glaskoerper)"
        stroke={ausgewaehlt ? 'var(--color-fokus)' : 'var(--color-rand)'}
        strokeWidth={ausgewaehlt ? 2.5 : 1.75}
      />

      <g clipPath="url(#roehrchen-form)">
        {bloecke.map((block, i) => {
          const hoehe = block.einheiten * schichthoehe;
          y -= hoehe;
          const oben = y;
          const eintrag = palette[block.farbe];
          const istOben = i === bloecke.length - 1;
          if (!eintrag) return null;
          return (
            <g key={i}>
              <rect
                x={0}
                y={oben - 0.5}
                width={ROEHRCHEN_BREITE}
                height={hoehe + 1}
                fill={`url(#fluessigkeit-${eintrag.id})`}
              />
              {/* Leicht gewölbte Oberfläche nur beim obersten Block. */}
              {istOben && (
                <ellipse
                  cx={ROEHRCHEN_BREITE / 2}
                  cy={oben}
                  rx={ROEHRCHEN_BREITE / 2 - 1}
                  ry={3.5}
                  fill={eintrag.hex}
                />
              )}
            </g>
          );
        })}

        {/* Glanzstreifen — der klassische Glaseffekt: ein heller Streifen,
            der nahe am linken Rand entlangläuft. */}
        <rect
          x={ROEHRCHEN_BREITE * 0.14}
          y={ROEHRCHEN_HOEHE * 0.06}
          width={ROEHRCHEN_BREITE * 0.14}
          height={ROEHRCHEN_HOEHE * 0.82}
          rx={ROEHRCHEN_BREITE * 0.07}
          fill="url(#glanzstreifen)"
        />
      </g>

      {/* Der Deckel: Ein fertig sortiertes Röhrchen sah vorher genauso aus
          wie ein halb sortiertes. Jetzt wird es sichtbar verschlossen —
          das ist der kleine Sieg zwischendurch. */}
      {fertig && (
        <g className={ruhig ? undefined : 'deckel-drauf'}>
          <rect
            x={-3}
            y={-9}
            width={ROEHRCHEN_BREITE + 6}
            height={16}
            rx={7}
            fill="#7c5a3a"
          />
          <rect
            x={-1}
            y={-7}
            width={ROEHRCHEN_BREITE + 2}
            height={5}
            rx={2.5}
            fill="#a97c4f"
          />
        </g>
      )}
    </g>
  );
}
