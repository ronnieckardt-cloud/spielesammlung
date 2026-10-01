import { GRABEN_BODEN, bodenHoehe, lueckeEnde, lueckeKante } from './logik';
import type { Gelaende } from './logik';

/**
 * Das Höhenprofil der Strecke als Linienzug — die Grundlage für das 3-D-Gelände.
 *
 * Rein und ohne three.js, damit sich prüfen lässt, was die Szene später zeichnet:
 * Das Gelände ist in der Logik eine Funktion `bodenHoehe(x)`, die Grafik braucht
 * aber Eckpunkte. Zwei Dinge sind dabei heikel:
 *
 * 1. **An jeder Lücke springt die Höhe.** Die Kante ist eine echte Kante, kein
 *    steiler Hang: An `lueckeKante` fällt der Boden senkrecht auf `GRABEN_BODEN`,
 *    an `lueckeEnde` steigt er senkrecht auf die Gegenseite. Ein gleichmäßiges
 *    Raster würde diese Wände zu schrägen Flächen verschmieren — deshalb stehen
 *    die vier Eckpunkte jeder Lücke **mit doppelter x-Koordinate** im Linienzug
 *    (zwei Punkte übereinander = eine senkrechte Wand).
 * 2. **Ein Raster darf die Kante nicht überspringen.** Wer alle 25 cm abtastet,
 *    trifft die Kante höchstens zufällig; die Randpunkte werden deshalb
 *    ausdrücklich eingefügt und die Rasterpunkte dazwischen weggelassen.
 */
export type ProfilPunkt = { x: number; y: number };

/** Abstand der Rasterpunkte in Metern. Kleiner als die schmalste Glocke (3 m) mit viel Luft. */
export const PROFIL_SCHRITT = 0.25;

/**
 * Der Linienzug von `von` bis `bis`.
 *
 * Die x-Werte wachsen nie rückwärts. Gleiche x-Werte hintereinander sind eine
 * senkrechte Wand (Kante oder Gegenseite einer Lücke).
 */
export function gelaendeProfil(g: Gelaende, von: number, bis: number, schritt = PROFIL_SCHRITT): ProfilPunkt[] {
  /** Die Lücken im Bereich, nach Lage sortiert. */
  const luecken = g.luecken
    .filter((l) => lueckeEnde(l) >= von && lueckeKante(l) <= bis)
    .slice()
    .sort((a, b) => a.x0 - b.x0);

  const punkte: ProfilPunkt[] = [];
  const hinzu = (x: number, y: number) => punkte.push({ x, y });

  let nr = 0;
  const l0 = () => luecken[nr];
  for (let x = von; x <= bis + 1e-9; x += schritt) {
    const xx = Math.min(x, bis);
    // Alle Lücken, die vor diesem Rasterpunkt beginnen, zuerst abhandeln.
    let l = l0();
    while (l && lueckeKante(l) <= xx) {
      hinzu(lueckeKante(l), bodenHoehe(g, lueckeKante(l)));
      hinzu(lueckeKante(l), GRABEN_BODEN);
      hinzu(lueckeEnde(l), GRABEN_BODEN);
      hinzu(lueckeEnde(l), bodenHoehe(g, lueckeEnde(l)));
      nr += 1;
      l = l0();
    }
    // Rasterpunkte im Graben selbst entfallen: Dort steht schon die Wand.
    const imGraben = g.luecken.some((k) => xx > lueckeKante(k) && xx < lueckeEnde(k));
    if (imGraben) continue;
    // Punkte direkt auf einer Kante gibt es schon.
    const aufKante = g.luecken.some((k) => xx === lueckeKante(k) || xx === lueckeEnde(k));
    if (aufKante) continue;
    hinzu(xx, bodenHoehe(g, xx));
  }
  return bereinigen(punkte);
}

/**
 * Wirft unmittelbare Wiederholungen weg und stellt die Reihenfolge sicher.
 * Ein Rasterpunkt, der kurz vor einem eingefügten Randpunkt liegt, hätte sonst
 * ein kleineres x als sein Vorgänger.
 */
function bereinigen(punkte: ProfilPunkt[]): ProfilPunkt[] {
  const aus: ProfilPunkt[] = [];
  for (const p of punkte) {
    const letzter = aus[aus.length - 1];
    if (letzter && p.x < letzter.x) continue;
    if (letzter && p.x === letzter.x && p.y === letzter.y) continue;
    aus.push(p);
  }
  return aus;
}

/** Die senkrechten Wände im Linienzug: Positionen, an denen die Höhe bei gleichem x springt. */
export type Wand = { x: number; oben: number; unten: number };

export function profilWaende(profil: readonly ProfilPunkt[]): Wand[] {
  const waende: Wand[] = [];
  for (let i = 1; i < profil.length; i++) {
    const a = profil[i - 1]!;
    const b = profil[i]!;
    if (a.x === b.x && a.y !== b.y) {
      waende.push({ x: a.x, oben: Math.max(a.y, b.y), unten: Math.min(a.y, b.y) });
    }
  }
  return waende;
}
