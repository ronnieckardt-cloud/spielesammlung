/**
 * Die Maße des Rades — rein, ohne three.js und ohne Canvas.
 *
 * Alles in **Metern**, im Bezugssystem des Rades: x nach vorn, **y nach unten**
 * (wie in der 2-D-Zeichnung und im Skelett des Fahrers, `fahrer.ts`), Ursprung auf
 * dem Boden unter dem Rad, die Nabe liegt also bei `y = −RAD_R`. Die 3-D-Szene
 * dreht y beim Aufbau um; dadurch lässt sich jede Zahl hier direkt mit der
 * 2-D-Zeichnung vergleichen.
 *
 * **Warum die Geometrie hier steht und nicht in der Szene:** Sie ist das Ergebnis
 * einer Reihe von Entscheidungen, die sich gegenseitig bedingen (Radstand, Lenkwinkel,
 * Sattelhöhe, Reichweite des Fahrers), und jede davon ist schon einmal an einem
 * Messfehler gescheitert — der Sattel stieß durch das Oberrohr, der Arm erreichte
 * den Griff nicht. Als reine Funktion lässt sie sich prüfen, ohne ein Bild zu zeichnen.
 */

export type P = { x: number; y: number };

export const RAD_R = 0.42;
/** Visueller Radstand — länger als der Wert der Physik (die rechnet mit einem Punkt). */
export const RADSTAND = 1.3;
/** Lenkwinkel: gut 19° von der Senkrechten. Eine fast senkrechte Gabel liest sich als BMX. */
export const GABEL_NEIGUNG = 0.34;

export type RadGeo = {
  radR: number;
  hintenX: number;
  vornX: number;
  /** Nabe des Hinterrads und des Vorderrads. Die Räder bleiben auf dem Boden, der Rahmen sinkt ein. */
  nabeHinten: P;
  nabeVorn: P;
  tretlager: P;
  /** Oben am Sattelrohr — dort treffen Oberrohr, Sattelrohr und Sitzstrebe zusammen. */
  sattel: P;
  /** Richtung des Sattelrohrs, von unten nach oben (y-nach-unten-Zahlen, also y < 0). */
  sattelRichtung: P;
  stuetzeUnten: P;
  stuetzeOben: P;
  /** Mitte der Sattelschale. */
  sattelMitte: P;
  /** Wo der Fahrer sitzt: Oberkante des Sattels. */
  sitz: P;
  gabelAchse: P;
  /** Senkrecht zur Gabelachse, nach vorn-oben. */
  gabelQuer: P;
  /** Untere Gabelbrücke, knapp unter dem Steuerrohr. */
  gabelOben: P;
  /** Oberes Ende des Steuerrohrs. */
  steuerkopf: P;
  /** Obere Gabelbrücke — dort sitzt der Vorbau. */
  standOben: P;
  unterEnde: P;
  oberEnde: P;
  klemme: P;
  /** Mitte der Griffe (in der Seitenansicht ein Punkt, in 3-D zwei, links und rechts). */
  lenker: P;
  sitzstrebeOben: P;
  daempferA: P;
  daempferB: P;
  /** Wie viel das Vorder- und das Hinterteil eingefedert sind (Meter nach unten). */
  wegVorn: number;
  wegHinten: number;
};

/**
 * @param federVorn  0 bis 1: wie weit die Gabel eingefedert ist
 * @param federHinten 0 bis 1: wie weit der Hinterbau eingefedert ist
 */
export function radGeometrie(federVorn: number, federHinten: number): RadGeo {
  const radR = RAD_R;
  const hintenX = -RADSTAND * 0.5;
  const vornX = RADSTAND * 0.5;
  const nabeY = -radR;
  const wegVorn = federVorn * 0.11;
  const wegHinten = federHinten * 0.1;

  const nabeHinten = { x: hintenX, y: nabeY };
  const nabeVorn = { x: vornX, y: nabeY };

  /*
   * Der Rahmen sinkt ein, die Räder bleiben auf dem Boden. In der 2-D-Zeichnung
   * wanderte dagegen die Nabe nach unten (`nabeY + weg`) — das Rad sank dort ein
   * wenig in den Boden. In 3-D fiele das sofort auf, es steht ja ein Körper auf der Erde.
   */
  const tretlager = { x: -0.13, y: nabeY - 0.05 + wegHinten };
  const sattel = { x: -0.49, y: tretlager.y - 0.54 };
  const dx = sattel.x - tretlager.x;
  const dy = sattel.y - tretlager.y;
  const l = Math.hypot(dx, dy) || 1;
  const sattelRichtung = { x: dx / l, y: dy / l };
  // Die Sattelstütze: 11,5 cm über dem Knoten. Länger streckt das Bein am untersten Pedalpunkt ganz.
  const stuetzeOben = { x: sattel.x + sattelRichtung.x * 0.115, y: sattel.y + sattelRichtung.y * 0.115 };
  const stuetzeUnten = { x: sattel.x - sattelRichtung.x * 0.05, y: sattel.y - sattelRichtung.y * 0.05 };
  const sattelMitte = { x: stuetzeOben.x + 0.012, y: stuetzeOben.y - 0.032 };
  const sitz = { x: sattelMitte.x, y: sattelMitte.y - 0.05 };

  const gabelAchse = { x: -Math.sin(GABEL_NEIGUNG), y: -Math.cos(GABEL_NEIGUNG) };
  const gabelQuer = { x: -gabelAchse.y, y: gabelAchse.x };
  // Die Gabel hängt am Vorderteil des Rahmens und sinkt um `wegVorn` ein.
  const gabelOben = { x: vornX - 0.172, y: nabeY - 0.05 - 0.44 + wegVorn };
  const steuerkopf = { x: gabelOben.x + gabelAchse.x * 0.085, y: gabelOben.y + gabelAchse.y * 0.085 };
  const standOben = { x: gabelOben.x + gabelAchse.x * 0.24, y: gabelOben.y + gabelAchse.y * 0.24 };
  const unterEnde = { x: gabelOben.x + 0.006, y: gabelOben.y + 0.045 };
  const oberEnde = {
    x: steuerkopf.x + (gabelOben.x - steuerkopf.x) * 0.3,
    y: steuerkopf.y + (gabelOben.y - steuerkopf.y) * 0.3,
  };
  const klemme = { x: standOben.x + 0.1, y: standOben.y - 0.035 };
  const lenker = { x: klemme.x + 0.03, y: klemme.y - 0.105 };

  return {
    radR,
    hintenX,
    vornX,
    nabeHinten,
    nabeVorn,
    tretlager,
    sattel,
    sattelRichtung,
    stuetzeUnten,
    stuetzeOben,
    sattelMitte,
    sitz,
    gabelAchse,
    gabelQuer,
    gabelOben,
    steuerkopf,
    standOben,
    unterEnde,
    oberEnde,
    klemme,
    lenker,
    sitzstrebeOben: { x: sattel.x + 0.1, y: sattel.y + 0.2 },
    daempferA: { x: tretlager.x - 0.04, y: tretlager.y - 0.14 },
    daempferB: { x: sattel.x + 0.16, y: sattel.y + 0.3 },
    wegVorn,
    wegHinten,
  };
}
