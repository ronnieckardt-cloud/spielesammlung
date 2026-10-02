import { springen, takt, torFarbe } from './logik';
import type { Ring, Zustand } from './logik';

/**
 * Ein Spieler mit Vorausschau — der Maßstab, an dem Tempo und Aufbau der
 * Hindernisse eingestellt wurden (siehe `bot.test.ts`).
 *
 * Er rechnet in jedem Bild nach, ob „jetzt dauernd steigen" das nächste
 * Hindernis schafft, und **nutzt dafür die echte Spielrechnung** (`takt`)
 * statt einer eigenen Formel — eine zweite Rechnung neben der Physik liefe
 * bei der nächsten Änderung still auseinander. Geht es nicht, schwebt er
 * unter dem Tor und wartet.
 *
 * `reserve` ist sein Sicherheitsabstand in Bogenmaß: Er geht nur, wenn die
 * Farbe am Tor auch noch stimmt, falls sich der Ring in der Zwischenzeit um
 * so viel weniger oder mehr gedreht hat. Das ist der Ersatz für menschliche
 * Ungenauigkeit — Reaktionszeit, Tippzeitpunkt, falsch geschätztes Tempo.
 * Ein Bogen ist ±0,785 breit; mit `reserve` r kommt der Bot also höchstens
 * r vom Rand entfernt an, das heißt **mindestens** ±(0,785 − r) um die Mitte.
 * Wer die Serie halten will, braucht r ≥ 0,785 − `mitteBreite(etappe)`.
 */
export type BotEinstellung = {
  reserve: number;
};

/**
 * Schritt der Vorausrechnung — **derselbe** wie im Spiel. Mit 1/30 kam der Bot
 * bei langsamem Steigen um Zehntelsekunden zu früh oder zu spät an: Die
 * Tipps liegen auf anderen Rasterpunkten, und der Unterschied summiert sich
 * über die zwei Sekunden Anflug.
 */
const VORAUS_DT = 1 / 60;

/** Wie lange der Bot höchstens vorausrechnet — länger als jede Anfahrt. */
const VORAUS_MAX = 240;

/** Das Tor wird zum **kleinsten** Index unter den noch nicht durchquerten genommen. */
function naechstes(z: Zustand): Ring | undefined {
  let bester: Ring | undefined;
  for (const r of z.ringe) if (!r.durch && (!bester || r.nr < bester.nr)) bester = r;
  return bester;
}

/**
 * Steigen mit einem gewählten Tippschema: Es wird neu getippt, sobald die
 * Kugel langsamer als `schwelle` nach oben fliegt. 30 ist Dauerfeuer (rund
 * 85 Einheiten je Sekunde), 0 tippt erst am höchsten Punkt (rund 52), −60
 * lässt die Kugel vor dem nächsten Tippen schon ein Stück sinken (rund 22).
 * Ein Mensch regelt sein Tempo genau so: schneller oder langsamer tippen.
 */
function steigen(z: Zustand, schwelle: number): Zustand {
  return z.kugelTempo < schwelle ? springen(z) : z;
}

/** Die Tippschemata, schnellstes zuerst. Der Bot nimmt das schnellste, das noch schafft. */
const SCHWELLEN: readonly number[] = [30, 0, -60];

/**
 * Schafft man das nächste Hindernis, wenn man ab jetzt dauernd steigt —
 * und zwar mit Sicherheitsabstand?
 */
export function schaffbar(z: Zustand, reserve: number, schwelle = 30): boolean {
  const ziel = naechstes(z);
  if (!ziel) return false;
  let s = z;
  for (let i = 0; i < VORAUS_MAX; i++) {
    s = takt(steigen(s, schwelle), VORAUS_DT);
    if (s.vorbei) return false;
    const r = s.ringe.find((x) => x.id === ziel.id);
    if (!r) return false;
    if (r.durch) {
      // Im Schritt, in dem das Tor gekreuzt wurde, hat die Farbe gestimmt
      // (sonst wäre `vorbei` gesetzt). Jetzt noch mit Reserve nachprüfen.
      const vor = torFarbe({ ...r, winkel: r.winkel - reserve });
      const nach = torFarbe({ ...r, winkel: r.winkel + reserve });
      return vor === s.farbe && nach === s.farbe;
    }
  }
  return false;
}

/**
 * Ein Bild des Bots: gibt den Zustand **nach** seiner Eingabe zurück (er tippt
 * oder tippt nicht), gerechnet wird danach wie immer mit `takt`.
 *
 * `merk` hält fest, ob er sich schon zum Durchstarten entschlossen hat (und
 * mit welchem Tippschema) — ohne das könnte die grobe Vorausrechnung zwischen
 * zwei Bildern ihre Meinung ändern und der Bot mitten im Flug zögern. Ein
 * Mensch tut das nicht.
 */
export function botEingabe(z: Zustand, e: BotEinstellung, merk: { entschlossen: number; schwelle: number }): Zustand {
  const ziel = naechstes(z);
  if (!ziel) return z;
  if (merk.entschlossen !== ziel.id) merk.entschlossen = -1;
  if (merk.entschlossen !== ziel.id) {
    for (const schwelle of SCHWELLEN) {
      if (schaffbar(z, e.reserve, schwelle)) {
        merk.entschlossen = ziel.id;
        merk.schwelle = schwelle;
        break;
      }
    }
  }
  if (merk.entschlossen === ziel.id) return steigen(z, merk.schwelle);
  // Warten: unter dem Tor schweben. Weit darunter erst einmal zügig hoch.
  const schwebeHoehe = ziel.y - ziel.halbmesser - 18;
  if (z.kugelY < schwebeHoehe - 25) return z.kugelTempo < 30 ? springen(z) : z;
  if (z.kugelY < schwebeHoehe - 10 && z.kugelTempo < 0) return springen(z);
  return z;
}

export type Lauf = {
  zustand: Zustand;
  /** Wie viele Hindernisse mitten durch die Farbe geschafft wurden (Serie gewachsen). */
  mitten: number;
  /** Wie viele am Rand des Bogens durch kamen (Serie gerissen). */
  rand: number;
};

/**
 * Lässt den Bot spielen, bis die Runde vorbei ist oder `sekunden` um sind.
 */
export function botSpielen(z0: Zustand, e: BotEinstellung, sekunden: number): Lauf {
  let z = z0;
  const dt = 1 / 60;
  const merk = { entschlossen: -1, schwelle: 30 };
  let mitten = 0;
  let rand = 0;
  for (let t = 0; t < sekunden && !z.vorbei; t += dt) {
    z = botEingabe(z, e, merk);
    const vorher = z;
    z = takt(z, dt);
    if (z.geschafft > vorher.geschafft) {
      if (z.serie > vorher.serie) mitten += 1;
      else rand += 1;
    }
  }
  return { zustand: z, mitten, rand };
}
