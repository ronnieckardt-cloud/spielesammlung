/**
 * Kurze Töne, im Browser erzeugt — keine Audiodateien, nichts nachzuladen.
 *
 * Ein Spiel ruft einfach sfx('gut') auf. Ob Ton erlaubt ist, meldet die Hülle
 * einmal über sfxEinstellen; das Spiel muss sich nicht darum kümmern.
 */

export type Ton = 'klick' | 'gut' | 'schlecht' | 'ende' | 'stufe';

type Rezept = {
  frequenzen: number[];
  dauer: number;
  form: OscillatorType;
  lautstaerke: number;
};

const rezepte: Record<Ton, Rezept> = {
  klick: { frequenzen: [420], dauer: 0.05, form: 'triangle', lautstaerke: 0.18 },
  gut: { frequenzen: [660, 880], dauer: 0.09, form: 'triangle', lautstaerke: 0.22 },
  stufe: { frequenzen: [523, 659, 784], dauer: 0.1, form: 'triangle', lautstaerke: 0.22 },
  schlecht: { frequenzen: [220, 165], dauer: 0.12, form: 'sawtooth', lautstaerke: 0.16 },
  ende: { frequenzen: [392, 311, 233], dauer: 0.18, form: 'sine', lautstaerke: 0.22 },
};

let an = true;
let kontext: AudioContext | null = null;

/** Nur die Hülle ruft das auf, wenn sich die Einstellung ändert. */
export function sfxEinstellen(optionen: { an: boolean }): void {
  an = optionen.an;
}

function holeKontext(): AudioContext | null {
  if (!an) return null;
  try {
    if (!kontext) kontext = new AudioContext();
    // Browser starten den Ton erst nach einer Nutzeraktion.
    if (kontext.state === 'suspended') void kontext.resume();
    return kontext;
  } catch {
    return null;
  }
}

export function sfx(name: Ton): void {
  const rezept = rezepte[name];
  const ctx = holeKontext();
  if (!ctx || !rezept) return;

  rezept.frequenzen.forEach((frequenz, i) => {
    const start = ctx.currentTime + i * rezept.dauer;
    const ende = start + rezept.dauer;

    const oszillator = ctx.createOscillator();
    const huellkurve = ctx.createGain();

    oszillator.type = rezept.form;
    oszillator.frequency.setValueAtTime(frequenz, start);

    // Sanft ein- und ausblenden, sonst knackt es.
    huellkurve.gain.setValueAtTime(0.0001, start);
    huellkurve.gain.exponentialRampToValueAtTime(rezept.lautstaerke, start + 0.01);
    huellkurve.gain.exponentialRampToValueAtTime(0.0001, ende);

    oszillator.connect(huellkurve).connect(ctx.destination);
    oszillator.start(start);
    oszillator.stop(ende + 0.02);
  });
}
