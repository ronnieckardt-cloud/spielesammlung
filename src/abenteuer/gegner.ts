import { abstandEben, type Spieler } from './logik';

/**
 * Struppi, der Wachhund — der erste Gegner in Florianville.
 *
 * **Rein, ohne Uhr, ohne three.js.** Wie alles Rechnende hier.
 *
 * ## Warum ein Hund und kein Schläger
 *
 * Das Spiel ist für ein Kind. Ein Gegner, der Leben abzieht, braucht eine
 * Lebensanzeige, ein Sterben und einen Neustart mitten im Viertel — drei
 * Systeme für einen einzigen Gegner. Ein Hund, der einen zurückscheucht,
 * braucht davon nichts und erzeugt trotzdem echte Spannung: Er bewacht eine
 * Ecke, in der ein Stern liegt, und man muss an ihm vorbei.
 *
 * **Er tut niemandem weh.** Wer erwischt wird, wird ein Stück zurückgesetzt
 * und steht kurz begossen da. Nichts geht verloren. Genau das ist der
 * Unterschied zwischen „spannend" und „frustrierend", wenn ein Zehnjähriger
 * zum fünften Mal an derselben Ecke scheitert.
 *
 * ## Drei Zustände
 *
 * `patrouille` — läuft seine Strecke ab.
 * `jagd` — hat den Spieler gewittert und folgt ihm.
 * `heim` — der Spieler ist außer Reichweite, er trottet zurück.
 *
 * Der Zustand `heim` ist wichtig: Ohne ihn stünde der Hund nach jeder Jagd
 * irgendwo im Viertel herum, und die Ecke, die er bewachen soll, wäre offen.
 */

export type Hund = {
  x: number;
  z: number;
  /** Blickrichtung im Bogenmaß, 0 = nach Osten. */
  blick: number;
  zustand: 'patrouille' | 'jagd' | 'heim';
  /** Welcher der beiden Wendepunkte gerade angesteuert wird. */
  ziel: 0 | 1;
};

/** Die beiden Wendepunkte seiner Strecke. */
export const STRECKE: readonly [{ x: number; z: number }, { x: number; z: number }] = [
  { x: -19.5, z: 13 },
  { x: -19.5, z: 20 },
];

export const HUND_TEMPO = 2.4;
export const HUND_JAGD_TEMPO = 4.6;
/** Ab hier wittert er den Spieler. */
export const WITTERN = 6.5;
/** Weiter weg als das, und er gibt auf. */
export const AUFGEBEN = 10;
/** So nah, und er hat einen erwischt. */
export const SCHNAPPEN = 1.1;
/** Wie weit man zurückgescheucht wird. */
export const ZURUECK = 5;

export function hundAmStart(): Hund {
  return { x: STRECKE[0].x, z: STRECKE[0].z, blick: Math.PI / 2, zustand: 'patrouille', ziel: 1 };
}

/** Bewegt den Hund einen Zeitschritt weit. */
export function hundTakt(hund: Hund, spieler: Spieler, dtRoh: number): Hund {
  const dt = Math.min(0.05, Math.max(0, dtRoh));
  const weg = abstandEben(hund, spieler);

  /*
   * Der Zustandswechsel läuft **vor** der Bewegung. Andersherum würde der
   * Hund erst einen Schritt in die alte Richtung machen und dann umschalten
   * — bei sechzig Bildern kaum sichtbar, aber genau daran fühlt sich eine
   * Verfolgung träge an.
   */
  let zustand = hund.zustand;
  if (weg <= WITTERN) zustand = 'jagd';
  else if (zustand === 'jagd' && weg > AUFGEBEN) zustand = 'heim';

  const ziel =
    zustand === 'jagd'
      ? { x: spieler.x, z: spieler.z }
      : zustand === 'heim'
        ? STRECKE[hund.ziel]
        : STRECKE[hund.ziel];

  const dx = ziel.x - hund.x;
  const dz = ziel.z - hund.z;
  const entfernung = Math.hypot(dx, dz);

  let { x, z, ziel: naechstesZiel } = hund;
  let blick = hund.blick;

  if (entfernung > 0.05) {
    const tempo = zustand === 'jagd' ? HUND_JAGD_TEMPO : HUND_TEMPO;
    const schritt = Math.min(entfernung, tempo * dt);
    x += (dx / entfernung) * schritt;
    z += (dz / entfernung) * schritt;
    blick = Math.atan2(dz, dx);
  } else if (zustand === 'heim') {
    // Zu Hause angekommen — wieder patrouillieren.
    zustand = 'patrouille';
  } else if (zustand === 'patrouille') {
    // Wendepunkt erreicht: den anderen ansteuern.
    naechstesZiel = hund.ziel === 0 ? 1 : 0;
  }

  return { x, z, blick, zustand, ziel: naechstesZiel };
}

/** Hat er den Spieler erwischt? */
export function erwischt(hund: Hund, spieler: Spieler): boolean {
  // In der Luft ist man sicher — über ihn hinwegzuspringen ist die Lösung,
  // auf die ein Kind von selbst kommt, und sie soll auch funktionieren.
  if (spieler.y > 0.8) return false;
  return abstandEben(hund, spieler) <= SCHNAPPEN;
}

/**
 * Wohin der Spieler zurückgescheucht wird.
 *
 * **Weg vom Hund, nicht an einen festen Ort.** Ein fester Rücksetzpunkt
 * (etwa der Spawn) risse einen quer durch das halbe Viertel und fühlte sich
 * an wie eine Strafe. Fünf Meter in die Gegenrichtung fühlen sich an wie
 * „der hat mich verjagt" — und man steht sofort wieder in Sichtweite seines
 * Ziels.
 */
export function zurueckgescheucht(
  hund: Hund,
  spieler: Spieler,
): { x: number; z: number } {
  const dx = spieler.x - hund.x;
  const dz = spieler.z - hund.z;
  const laenge = Math.hypot(dx, dz);
  if (laenge < 0.01) {
    // Genau übereinander — dann einfach nach Osten, irgendwohin muss es ja.
    return { x: spieler.x + ZURUECK, z: spieler.z };
  }
  return {
    x: spieler.x + (dx / laenge) * ZURUECK,
    z: spieler.z + (dz / laenge) * ZURUECK,
  };
}
