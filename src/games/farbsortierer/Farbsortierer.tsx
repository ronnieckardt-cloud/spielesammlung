import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameLoop } from '../../core/useGameLoop';
import { sfx } from '../../core/sfx';
import type { GameProps } from '../../core/types';
import {
  KAPAZITAET,
  extraRoehrchenHinzufuegen,
  neuesLevel,
  punkteFuerLoesung,
  roehrchenAntippen,
  zurueck,
} from './logik';
import type { Zustand } from './logik';
import {
  ROEHRCHEN_BREITE,
  ROEHRCHEN_HOEHE,
  ausgusskante,
  fliegendePosition,
  giessFortschritt,
  rasterBreite,
  rasterHoehe,
  roehrchenPosition,
} from './geometrie';
import { FarbMusterDefs } from './FarbMusterDefs';
import { Roehrchen } from './Roehrchen';
import { farbpaletteFuerLevel } from './farben';
import type { FarbEintrag } from './farben';

type Tempo = 'normal' | 'schnell' | 'aus';
const DAUER_MS: Record<Tempo, number> = { normal: 950, schnell: 380, aus: 0 };
const TEMPO_BESCHRIFTUNG: Record<Tempo, string> = { normal: 'Normal', schnell: 'Schnell', aus: 'Aus' };
const NAECHSTES_TEMPO: Record<Tempo, Tempo> = { normal: 'schnell', schnell: 'aus', aus: 'normal' };

const SCHICHTHOEHE = ROEHRCHEN_HOEHE / KAPAZITAET;

/**
 * Welches Level als Nächstes drankommt — als Modul-Variable, nicht als
 * React-State: „Nochmal" nach einer Lösung lässt die Hülle das Spiel per
 * neuem `key` komplett neu mounten (siehe Spielrahmen.tsx), ein useState
 * würde also jedes Mal wieder bei seinem Anfangswert landen. Die Variable
 * bleibt für die Dauer der Sitzung im Speicher — kein Browser-Speicher,
 * kein Zugriff nach außen, verschwindet beim echten Neuladen der Seite.
 */
let naechsteLevelNummer = 1;

type Guss = {
  von: number;
  nach: number;
  nachherVon: readonly number[];
  vorherNach: readonly number[];
  farbe: number;
  anzahl: number;
  anzahlRoehrchen: number;
  t: number;
  dauerMs: number;
};

/** Beschreibt ein Röhrchen für Screenreader — Farbe ist nie das einzige Merkmal. */
function beschreibung(
  index: number,
  inhalt: readonly number[],
  palette: readonly FarbEintrag[],
): string {
  const basis = `Röhrchen ${index + 1}`;
  if (inhalt.length === 0) return `${basis}, leer`;
  return `${basis}, von unten nach oben: ${inhalt.map((f) => palette[f]?.name ?? '').join(', ')}`;
}

export function Farbsortierer({ onScore, onGameOver, settings }: GameProps) {
  const [z, setZ] = useState<Zustand>(() => neuesLevel(naechsteLevelNummer));
  const [tempo, setTempo] = useState<Tempo>(settings.reducedMotion ? 'aus' : 'normal');
  const [guss, setGuss] = useState<Guss | null>(null);

  // Welche Farben dieses Level zeigt — aus der Levelnummer gemischt, damit
  // nicht immer dieselbe Reihenfolge der Palette drankommt.
  const palette = useMemo(
    () => farbpaletteFuerLevel(z.level, z.farbenAnzahl),
    [z.level, z.farbenAnzahl],
  );

  const beiAntippen = useCallback(
    (index: number) => {
      if (guss || z.geloest) return;

      const quelleVorher = z.ausgewaehlt;
      const nachher = roehrchenAntippen(z, index);
      if (nachher === z) return;

      const wurdeGegossen = nachher.zuege > z.zuege;
      if (!wurdeGegossen || quelleVorher === null) {
        setZ(nachher);
        sfx('klick');
        return;
      }

      const vorherVon = z.roehrchen[quelleVorher]!;
      const nachherVon = nachher.roehrchen[quelleVorher]!;
      const vorherNach = z.roehrchen[index]!;
      const nachherNach = nachher.roehrchen[index]!;
      const dauerMs = DAUER_MS[tempo];

      setZ(nachher);
      sfx('gut');

      if (dauerMs === 0) return; // Tempo "aus": sofort da, keine Animation nötig

      setGuss({
        von: quelleVorher,
        nach: index,
        nachherVon,
        vorherNach,
        farbe: vorherVon[vorherVon.length - 1]!,
        anzahl: nachherNach.length - vorherNach.length,
        anzahlRoehrchen: z.roehrchen.length,
        t: 0,
        dauerMs,
      });
    },
    [z, guss, tempo],
  );

  useGameLoop(
    (dt) => {
      setGuss((g) => {
        if (!g) return g;
        const naechstesT = g.t + (dt * 1000) / g.dauerMs;
        return naechstesT >= 1 ? null : { ...g, t: naechstesT };
      });
    },
    { fps: 60, running: guss !== null },
  );

  useEffect(() => {
    onScore(punkteFuerLoesung(z.zuege, z.farbenAnzahl));
  }, [z.zuege, z.farbenAnzahl, onScore]);

  useEffect(() => {
    if (z.geloest && !guss) {
      sfx('ende');
      // "Nochmal" im Vorbei-Bildschirm der Hülle startet damit automatisch
      // das nächste Level, nicht wieder dasselbe.
      naechsteLevelNummer = z.level + 1;
      onGameOver(punkteFuerLoesung(z.zuege, z.farbenAnzahl));
    }
    // Absichtlich nur an geloest/guss gebunden — onGameOver darf nur einmal kommen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.geloest, !!guss]);

  const beiZurueck = useCallback(() => {
    if (!guss) setZ((alt) => zurueck(alt));
  }, [guss]);

  const beiExtraRoehrchen = useCallback(() => {
    if (!guss) setZ((alt) => extraRoehrchenHinzufuegen(alt));
  }, [guss]);

  // Freie Levelwahl — "gleiche Levelnummer, gleiches Rätsel" soll man auch
  // gezielt ansteuern können, nicht nur der Reihe nach durchspielen.
  const beiLevelWechsel = useCallback(
    (neu: number) => {
      if (guss) return;
      const geklemmt = Math.max(1, neu);
      naechsteLevelNummer = geklemmt;
      setZ(neuesLevel(geklemmt));
    },
    [guss],
  );

  const breite = rasterBreite(z.roehrchen.length);
  const hoehe = rasterHoehe(z.roehrchen.length);

  const posVon = guss ? roehrchenPosition(guss.von, guss.anzahlRoehrchen) : null;
  const posNach = guss ? roehrchenPosition(guss.nach, guss.anzahlRoehrchen) : null;
  const flug = guss && posVon && posNach ? fliegendePosition(guss.t, posVon, posNach) : null;
  const giessAnteil = guss ? giessFortschritt(guss.t) : 0;

  const kante = guss && flug ? ausgusskante(flug.position, flug.winkelGrad) : null;
  const zielMitteX = posNach ? posNach.x + ROEHRCHEN_BREITE / 2 : 0;
  const zielFuellHoehe = guss ? (guss.vorherNach.length + giessAnteil * guss.anzahl) * SCHICHTHOEHE : 0;
  const zielOberflaeche = posNach ? posNach.y + ROEHRCHEN_HOEHE - zielFuellHoehe : 0;
  const strahlSichtbar =
    !!guss && !!flug && !!kante && Math.abs(flug.winkelGrad) > 85 && giessAnteil < 1;
  const wackeln = guss ? Math.sin(guss.t * 46) * 2 : 0;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4">
      <FarbMusterDefs />

      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1 font-semibold text-gedaempft">
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level - 1)}
            disabled={z.level <= 1 || !!guss}
            aria-label="Voriges Level"
            className="rounded-lg border border-rand bg-flaeche px-2 py-1 text-base leading-none disabled:opacity-30"
          >
            ‹
          </button>
          <span className="w-16 text-center tabular-nums">Level {z.level}</span>
          <button
            type="button"
            onClick={() => beiLevelWechsel(z.level + 1)}
            disabled={!!guss}
            aria-label="Nächstes Level"
            className="rounded-lg border border-rand bg-flaeche px-2 py-1 text-base leading-none disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={beiZurueck}
            disabled={z.verlauf.length === 0 || !!guss}
            className="rounded-lg border border-rand bg-flaeche px-3 py-1.5 disabled:opacity-40"
          >
            <span aria-hidden="true">↩</span> Zurück
          </button>
          <button
            type="button"
            onClick={beiExtraRoehrchen}
            disabled={z.extraRoehrchenUebrig === 0 || !!guss}
            className="rounded-lg border border-rand bg-flaeche px-3 py-1.5 disabled:opacity-40"
          >
            + Röhrchen
          </button>
          <button
            type="button"
            onClick={() => setTempo((t) => NAECHSTES_TEMPO[t])}
            className="rounded-lg border border-rand bg-flaeche px-3 py-1.5"
          >
            Tempo: {TEMPO_BESCHRIFTUNG[tempo]}
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${breite} ${hoehe}`}
        role="group"
        aria-label={`Farbsortierer, Level ${z.level}. ${z.roehrchen.map((r, i) => beschreibung(i, r, palette)).join('. ')}.`}
        style={{ width: '100%', maxWidth: breite, aspectRatio: `${breite} / ${hoehe}`, overflow: 'visible' }}
      >
        {z.roehrchen.map((inhalt, i) => {
          const istVon = guss?.von === i;
          const istNach = guss?.nach === i;
          const pos = roehrchenPosition(i, z.roehrchen.length);

          return (
            <g
              key={i}
              transform={`translate(${pos.x} ${pos.y})`}
              role="button"
              tabIndex={istVon ? -1 : 0}
              aria-label={beschreibung(i, inhalt, palette)}
              aria-disabled={!!guss}
              onClick={() => beiAntippen(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  beiAntippen(i);
                }
              }}
              style={{ cursor: guss ? 'default' : 'pointer' }}
            >
              <Roehrchen
                farben={istVon ? [] : istNach ? guss!.vorherNach : inhalt}
                kapazitaet={KAPAZITAET}
                palette={palette}
                ausgewaehlt={z.ausgewaehlt === i}
                teilschicht={
                  istNach
                    ? { farbe: guss!.farbe, hoehe: giessAnteil * guss!.anzahl * SCHICHTHOEHE }
                    : undefined
                }
              />
            </g>
          );
        })}

        {/* Das fliegende Röhrchen — dreht sich um denselben Drehpunkt, den
            ausgusskante() zur Berechnung benutzt, deshalb landet der Strahl
            exakt an der gezeichneten Öffnung. */}
        {guss && flug && (
          <g
            transform={`translate(${flug.position.x} ${flug.position.y}) rotate(${flug.winkelGrad} ${ROEHRCHEN_BREITE / 2} ${ROEHRCHEN_HOEHE * 0.32})`}
          >
            <Roehrchen
              farben={guss.nachherVon}
              kapazitaet={KAPAZITAET}
              palette={palette}
              teilschicht={{ farbe: guss.farbe, hoehe: (1 - giessAnteil) * guss.anzahl * SCHICHTHOEHE }}
            />
          </g>
        )}

        {strahlSichtbar && kante && (
          <g aria-hidden="true">
            <path
              d={`M ${kante.x - 2.5},${kante.y}
                  Q ${(kante.x + zielMitteX) / 2 + wackeln},${(kante.y + zielOberflaeche) / 2} ${zielMitteX - 1.5},${zielOberflaeche}
                  L ${zielMitteX + 1.5},${zielOberflaeche}
                  Q ${(kante.x + zielMitteX) / 2 + wackeln + 5},${(kante.y + zielOberflaeche) / 2} ${kante.x + 2.5},${kante.y}
                  Z`}
              fill={`url(#fluessigkeit-${palette[guss.farbe]?.id})`}
              opacity={0.9}
            />
            <ellipse cx={zielMitteX} cy={zielOberflaeche} rx={9} ry={2.5} fill="white" opacity={0.3} />
          </g>
        )}
      </svg>

      <p className="max-w-md text-center text-sm text-gedaempft">
        Antippen wählt ein Röhrchen, nochmal Antippen gießt hinein.
        <br />
        Gelöst? „Nochmal" im nächsten Bildschirm startet automatisch das
        nächste Level — mit den Pfeilen oben lässt sich auch direkt ein
        bestimmtes Level ansteuern.
      </p>
    </div>
  );
}
