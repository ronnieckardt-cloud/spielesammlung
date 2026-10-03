import { rng } from '../../core/rng';
import type { Zufall } from '../../core/rng';
import { ANKUNFT, FLUG_S, normalisieren, werfen, zeitFortschritt } from './logik';
import type { Zustand } from './logik';

/**
 * Ein Spieler mit Vorausschau und **menschlicher Ungenauigkeit** — der
 * Maßstab, an dem Schwierigkeit und Zeitfenster der Level eingestellt wurden
 * (siehe `bot.test.ts`).
 *
 * Er sucht die größte freie Lücke zwischen den Messern, rechnet mit der
 * **echten Spielrechnung** aus, wann der Stamm sie unter den Einschlagpunkt
 * gedreht hat (die Flugzeit des Messers eingerechnet), und wirft dann. Mit
 * `ungenauigkeit` (Sekunden, Standardabweichung) wirft er je Wurf ein Stück zu
 * früh oder zu spät: So ungenau tippt auch ein Mensch, selbst wenn er genau
 * weiß, wann er tippen will — Reaktion, Gefühl für den Rhythmus, Finger.
 *
 * Die Wirkung hängt vom Tempo ab: 50 Millisekunden bei 3 Bogenmaß je Sekunde
 * sind 0,15 Bogenmaß daneben — genau die Größe, um die es in den späten
 * Leveln geht.
 */
export type BotEinstellung = {
  /** Standardabweichung des Wurfzeitpunkts in Sekunden. 0 = perfekt. */
  ungenauigkeit: number;
};

/** Gaußsche Zufallszahl (Box-Muller) aus der Saat des Bots — nie `Math.random`. */
function gauss(zufall: Zufall): number {
  const a = Math.max(1e-9, zufall.zahl());
  const b = zufall.zahl();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

/** Die Mitte der größten freien Lücke zwischen den steckenden Messern (Steckwinkel). */
export function groessteLueckenMitte(messer: readonly number[]): number {
  if (messer.length === 0) return normalisieren(ANKUNFT);
  const w = messer.map(normalisieren).sort((a, b) => a - b);
  let groesste = -1;
  let mitte = 0;
  for (let k = 0; k < w.length; k++) {
    const von = w[k]!;
    const bis = k + 1 < w.length ? w[k + 1]! : w[0]! + 2 * Math.PI;
    if (bis - von > groesste) {
      groesste = bis - von;
      mitte = von + groesste / 2;
    }
  }
  return normalisieren(mitte);
}

/** Vorzeichenbehafteter Abstand zweier Winkel auf dem Kreis, −π bis π. */
function abstand(a: number, b: number): number {
  const d = normalisieren(a - b);
  return d > Math.PI ? d - 2 * Math.PI : d;
}

/** So viele Bilder (bei 60 je Sekunde) fliegt ein Messer, bis es einschlägt: Das Spiel schlägt im ersten Bild ein, in dem die Flugzeit aufgebraucht ist. */
const FLUG_BILDER = Math.ceil(FLUG_S * 60 - 1e-9);

/** Schritt der Vorausrechnung. Feiner als das Spiel: Es geht um Hundertstel. */
const VORAUS_DT = 1 / 240;

/** So weit rechnet der Bot höchstens voraus. */
const VORAUS_MAX_S = 8;

/**
 * Wie viele Sekunden es dauert, bis ein **jetzt** geworfenes Messer die Mitte der
 * größten Lücke trifft — rechnet die Drehung mit `zeitFortschritt` durch, also genau
 * so, wie das Spiel sie rechnen wird, einschließlich der Richtungswechsel.
 */
export function zeitBisLuecke(z: Zustand): number {
  const ziel = groessteLueckenMitte(z.messer);
  // Ohne Messer, Flug, Pause und Apfeluhr: Es geht nur um die Drehung.
  let s: Zustand = { ...z, fliegend: null, pauseRest: 0, zerteilt: null };
  // Ein Wurf zur Zeit τ schlägt nach `FLUG_BILDER` Bildschritten ein — das Spiel zählt
  // die Flugzeit in ganzen Bildern, nicht auf die Hundertstel genau.
  s = zeitFortschritt(s, FLUG_BILDER / 60);
  let vorher = abstand(normalisieren(ANKUNFT - s.winkel), ziel);
  if (Math.abs(vorher) < 1e-9) return 0;
  let bester = { zeit: 0, wert: Math.abs(vorher) };
  for (let t = VORAUS_DT; t < VORAUS_MAX_S; t += VORAUS_DT) {
    s = zeitFortschritt(s, VORAUS_DT);
    const jetzt = abstand(normalisieren(ANKUNFT - s.winkel), ziel);
    if (Math.abs(jetzt) < bester.wert) bester = { zeit: t, wert: Math.abs(jetzt) };
    // Vorzeichenwechsel bei kleinem Abstand: Die Mitte ist durchlaufen.
    if (Math.sign(jetzt) !== Math.sign(vorher) && Math.abs(jetzt) < 1 && Math.abs(vorher) < 1) {
      return t - VORAUS_DT * (Math.abs(jetzt) / (Math.abs(jetzt) + Math.abs(vorher)));
    }
    vorher = jetzt;
  }
  return bester.zeit;
}

export type Lauf = {
  zustand: Zustand;
  /** Wie viele Messer der Bot geworfen hat. */
  wuerfe: number;
};

/**
 * Lässt den Bot spielen, bis die Runde vorbei ist oder `sekunden` um sind.
 *
 * Zu jedem Wurf wird einmal gerechnet, wann er fällig ist, und dazu der
 * zufällige Zeitversatz addiert. Ein negativer Versatz, der den Wurf in die
 * Vergangenheit schöbe, wirft sofort — der Spieler hat sich dann zu spät
 * entschieden, was ebenfalls menschlich ist.
 */
export function botSpielen(z0: Zustand, e: BotEinstellung, sekunden: number, saat = 1): Lauf {
  const zufall = rng(saat);
  const dt = 1 / 60;
  let z = z0;
  let wuerfe = 0;
  let plan: number | null = null;
  for (let t = 0; t < sekunden && !z.vorbei; t += dt) {
    if (plan === null && z.fliegend === null && z.pauseRest <= 0 && z.uebrig > 0) {
      plan = Math.max(0, zeitBisLuecke(z) + e.ungenauigkeit * gauss(zufall));
    }
    if (plan !== null) {
      plan -= dt;
      if (plan <= 0) {
        z = werfen(z);
        wuerfe++;
        plan = null;
      }
    }
    z = zeitFortschritt(z, dt);
  }
  return { zustand: z, wuerfe };
}
