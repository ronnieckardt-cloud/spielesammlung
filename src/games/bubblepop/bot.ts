/**
 * Ein einfacher Spieler für die Tests: Er zielt, tauscht und setzt die Spezialkugel ein — mehr nicht.
 *
 * Er dient als Belegt für die Spielbarkeit (kommt ein vernünftiger Spieler durch die ersten Etappen?),
 * nicht als Maßstab für gutes Spielen: Er sieht nur einen Schuss voraus. Liegt dieser Bot unter dem, was
 * ein Kind schafft, wäre das Spiel zu schwer; liegt er weit darüber, zu leicht.
 */
import { MAX_ABWEICHUNG, SENKRECHT, flugbahn } from './geometrie';
import { andocken, gruppeAb, nachbarn, spezialUmschalten, tauschen, tiefsteZeile } from './logik';
import type { Punkt, SchussErgebnis, Zustand } from './logik';

export type Wahl = { winkel: number; tausch: boolean; spezial: boolean; ziel: Punkt };

function winkelListe(grad: number): number[] {
  const liste: number[] = [];
  for (let w = SENKRECHT - MAX_ABWEICHUNG; w <= SENKRECHT + MAX_ABWEICHUNG + 1e-9; w += (Math.PI / 180) * grad) liste.push(w);
  return liste;
}
const WINKEL: Record<number, number[]> = {};
function winkelFuer(grad: number): number[] {
  return (WINKEL[grad] ??= winkelListe(grad));
}

/** Wie gut ein Schuss ist: Punkte zählen, ein Fehlschuss wird nach Lage im Feld bewertet. */
function wert(e: SchussErgebnis, ziel: Punkt): number {
  if (e.geplatzt.length > 0) return 1000 + e.gewinn + e.gefallen.length * 5;
  // Ein Fehlschuss: lieber dort, wo er an gleichfarbigen hängt (baut die nächste Gruppe vor) und weit oben.
  const nach = e.zustand.wabe;
  const gleiche = gruppeAb(nach, ziel).length;
  const nachbarnBelegt = nachbarn(ziel).filter((n) => nach[n.zeile]![n.spalte] !== null).length;
  return gleiche * 30 + nachbarnBelegt - ziel.zeile * 2 - (e.zustand.vorbei ? 5000 : 0);
}

/** Die beste Wahl, die der Bot sieht. */
export function waehle(z: Zustand, spezialNutzen: boolean, grad = 3): Wahl | null {
  const zustaende: { z: Zustand; tausch: boolean; spezial: boolean }[] = [{ z, tausch: false, spezial: false }];
  if (!z.bereit) zustaende.push({ z: tauschen(z), tausch: true, spezial: false });
  if (spezialNutzen && z.spezial !== null && !z.bereit) zustaende.push({ z: spezialUmschalten(z), tausch: false, spezial: true });

  // Viele Winkel enden im selben Feld — für die Logik genügt je Feld einer.
  const nachFeld = new Map<string, { w: number; ziel: Punkt }>();
  for (const w of winkelFuer(grad)) {
    const ziel = flugbahn(z.wabe, w).ziel;
    if (ziel && !nachFeld.has(`${ziel.spalte},${ziel.zeile}`)) nachFeld.set(`${ziel.spalte},${ziel.zeile}`, { w, ziel });
  }
  const bahnen = [...nachFeld.values()];

  let beste: Wahl | null = null;
  let besterWert = -Infinity;
  for (const s of zustaende) {
    if (s.tausch && s.z === z) continue;
    for (const b of bahnen) {
      const e = andocken(s.z, b.ziel);
      if (e.zustand === s.z) continue;
      let v = wert(e, b.ziel);
      // Die Spezialkugel nur für etwas Lohnendes: viel Ertrag oder Not.
      if (s.spezial) v = e.gewinn >= 150 || tiefsteZeile(z.wabe) >= 7 ? v + 400 : -Infinity;
      if (v > besterWert) {
        besterWert = v;
        beste = { winkel: b.w, tausch: s.tausch, spezial: s.spezial, ziel: b.ziel };
      }
    }
  }
  return beste;
}

export type Lauf = {
  z: Zustand;
  schuesse: number;
  bomben: number;
  regenbogen: number;
  verdientBombe: number;
  verdientRegenbogen: number;
  hoechsteSerie: number;
  etappenSchuesse: number[];
};

/** Spielt, bis die Runde vorbei ist oder `maxSchuesse` erreicht sind. */
export function spielen(start: Zustand, maxSchuesse: number, spezialNutzen = true, grad = 3): Lauf {
  let z = start;
  const lauf: Lauf = { z, schuesse: 0, bomben: 0, regenbogen: 0, verdientBombe: 0, verdientRegenbogen: 0, hoechsteSerie: 0, etappenSchuesse: [] };
  let seitEtappe = 0;
  while (!z.vorbei && lauf.schuesse < maxSchuesse) {
    const w = waehle(z, spezialNutzen, grad);
    if (!w) break;
    let s = z;
    if (w.tausch) s = tauschen(s);
    if (w.spezial) s = spezialUmschalten(s);
    const e = andocken(s, w.ziel);
    if (e.zustand === s) break;
    if (e.art === 'bombe') lauf.bomben++;
    if (e.art === 'regenbogen') lauf.regenbogen++;
    if (e.verdient === 'bombe') lauf.verdientBombe++;
    if (e.verdient === 'regenbogen') lauf.verdientRegenbogen++;
    lauf.hoechsteSerie = Math.max(lauf.hoechsteSerie, e.zustand.serie);
    z = e.zustand;
    lauf.schuesse++;
    seitEtappe++;
    if (e.etappeGeschafft) {
      lauf.etappenSchuesse.push(seitEtappe);
      seitEtappe = 0;
    }
  }
  lauf.z = z;
  return lauf;
}
