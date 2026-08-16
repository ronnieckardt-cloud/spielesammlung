import { describe, expect, it } from 'vitest';
import { spiele } from '../core/registry';
import { toenung } from './spielfarbe';

/**
 * Der Audit-Befund, der diese Datei ausgelöst hat: Sieben der zwanzig
 * Kachelverläufe lagen im selben Indigo/Violett-Feld, und drei Spiele
 * teilten sich exakt denselben `accent`-Wert. Auf der Startseite entwerten
 * sich Kacheln, die sich in Farbe nicht unterscheiden, gegenseitig.
 *
 * Diese Tests prüfen keine Ästhetik — dafür bräuchte man Augen, keinen
 * Test —, sondern die harte Tatsache, die sich messen lässt: keine zwei
 * Spiele mit demselben `accent`-Wert, und kein Farbton zu dicht am
 * nächsten. „Zu dicht" ist bewusst als Zahl festgelegt (siehe unten), nicht
 * als Gefühl.
 */

function hue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function kreisAbstand(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe('Akzentfarben der zwanzig Spiele', () => {
  it('keine zwei Spiele teilen sich denselben Akzent', () => {
    const nachFarbe = new Map<string, string[]>();
    for (const s of spiele) {
      const wert = s.accent.toLowerCase();
      nachFarbe.set(wert, [...(nachFarbe.get(wert) ?? []), s.id]);
    }
    const doppelt = [...nachFarbe.entries()].filter(([, ids]) => ids.length > 1);
    expect(doppelt, `Geteilte Akzente: ${JSON.stringify(doppelt)}`).toEqual([]);
  });

  /*
   * Zwei Sorten von Nähe sind bewusst erlaubt und stehen deshalb auf einer
   * Ausnahmeliste statt den Test einfach lockerer zu machen — eine Zahl,
   * die alles durchwinkt, findet auch die nächste echte Häufung nicht mehr:
   *
   * - `quiz` ↔ `schlange`: Absicht. Quiz Time bekam sein Grün genau deshalb,
   *   weil sein `accent` seit jeher Grün ist (siehe `spielfarbe.ts`) — näher
   *   an Snake Rushs Grün zu liegen ist hier kein Fehler, sondern der Punkt.
   * - `platzhalter` ↔ `blockblitz` ↔ `mergeup`: vorbestehend, nicht Teil
   *   dieser Entzerrung. Betraf nicht die sieben Symbole im
   *   Indigo/Violett-Feld, die den Anstoß gaben, und stand nicht auf der
   *   Befundliste.
   */
  const ERLAUBTE_NAEHE: readonly (readonly [string, string])[] = [
    ['quiz', 'schlange'],
    ['platzhalter', 'blockblitz'],
    ['platzhalter', 'mergeup'],
    ['blockblitz', 'mergeup'],
  ];

  it('keine zwei Farbtöne liegen enger als 10° zusammen — außer den dokumentierten Ausnahmen', () => {
    /*
     * 10° ist bewusst klein gewählt — bei zwanzig Spielen auf 360° sind
     * im Schnitt 18° Abstand das Beste, was überhaupt geht. Der Test soll
     * nur eine echte Häufung wie die vorgefundene (acht Spiele auf 37°)
     * verhindern, nicht jede Nähe verbieten.
     */
    const erlaubt = new Set(ERLAUBTE_NAEHE.map(([a, b]) => [a, b].sort().join('↔')));
    const eng: string[] = [];
    for (let i = 0; i < spiele.length; i++) {
      for (let j = i + 1; j < spiele.length; j++) {
        const a = spiele[i]!;
        const b = spiele[j]!;
        if (erlaubt.has([a.id, b.id].sort().join('↔'))) continue;
        const abstand = kreisAbstand(hue(a.accent), hue(b.accent));
        if (abstand < 10) eng.push(`${a.id} (${a.accent}) ↔ ${b.id} (${b.accent}): ${abstand.toFixed(0)}°`);
      }
    }
    expect(eng).toEqual([]);
  });

  it('Quiz Time bleibt trotz Grün-Akzent grün-frei auf dem Spielfeld', () => {
    // Die eine Stelle, an der `toenung` bewusst vom Akzent abweicht — sie
    // darf nicht versehentlich wieder Grün zurückgeben (Hue 90–150 wäre
    // Grün und würde das „richtige Antwort"-Signal im Quiz verwässern).
    const h = hue(toenung('quiz', spiele.find((s) => s.id === 'quiz')!.accent));
    expect(h < 90 || h > 150).toBe(true);
  });

  /*
   * **Der eigentlich wichtige Test.** Die globale 10°-Prüfung oben hätte
   * genau den Fehler nicht gefunden, der beim Bauen tatsächlich passiert
   * ist: Ring Rise bekam zuerst einen Farbton 11° von Even Cut entfernt —
   * über der globalen Schwelle, also technisch „bestanden". Im Kachelraster
   * stehen beide aber **nebeneinander** (`registry.ts` listet Ring Rise
   * direkt vor Even Cut), und bei ähnlicher Helligkeit sahen sie im Bild
   * praktisch identisch aus. Erst der Blick auf den Bildschirm hat das
   * gezeigt, kein Test — das soll beim nächsten Mal nicht mehr nötig sein.
   *
   * Die Rasterbreite (4 Spalten auf dem Handy) steht in `StartSeite.tsx`
   * nicht als Zahl, sondern ergibt sich aus `--kachel` und der verfügbaren
   * Breite — deshalb hier hart auf 4 gesetzt, das schmalste Raster, auf dem
   * die App läuft. Ein breiteres Raster hat mehr Nachbarn, nie weniger;
   * wer hier besteht, besteht auch dort.
   */
  it('direkte Rasternachbarn (4 Spalten) unterscheiden sich deutlich', () => {
    const SPALTEN = 4;
    const MINDESTABSTAND = 25;
    const zeile = (i: number) => Math.floor(i / SPALTEN);

    /** Rechter und unterer Nachbar reichen — jedes Paar kommt sonst doppelt. */
    function rasterNachbarn(i: number): number[] {
      const nachbarn: number[] = [];
      const rechts = i + 1;
      if (rechts < spiele.length && zeile(rechts) === zeile(i)) nachbarn.push(rechts);
      const unten = i + SPALTEN;
      if (unten < spiele.length) nachbarn.push(unten);
      return nachbarn;
    }

    const zuNah: string[] = [];
    for (let i = 0; i < spiele.length; i++) {
      for (const j of rasterNachbarn(i)) {
        const a = spiele[i]!;
        const b = spiele[j]!;
        const abstand = kreisAbstand(hue(a.accent), hue(b.accent));
        if (abstand < MINDESTABSTAND) {
          zuNah.push(
            `${a.id} (${a.accent}) ↔ ${b.id} (${b.accent}): ${abstand.toFixed(0)}° — stehen im Raster nebeneinander`,
          );
        }
      }
    }
    expect(zuNah).toEqual([]);
  });
});
