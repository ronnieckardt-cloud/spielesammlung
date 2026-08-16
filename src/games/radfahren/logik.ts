import { saatAus, schritt } from '../../core/rng';

/**
 * Flow MTB — die Fahrphysik. **Ohne Canvas, ohne React, ohne Browser.**
 *
 * Ronnis Wunsch: „ein physikbasiertes 2D-Mountainbike-Spiel … Speed +
 * Airtime + Control + Landing." Und ausdrücklich: „Physik vor Features,
 * Game-Feel vor Technik." Deshalb steht hier **nur** das Rechnende, in
 * reinen Funktionen, die sich ohne Bildschirm durchspielen lassen —
 * gezeichnet wird in `zeichnen.ts`, das keine einzige Regel kennt.
 *
 * Koordinaten: `x` läuft nach rechts (Streckenmeter), `y` nach **oben**
 * (Höhe über null). Das ist die Konvention der Physik, nicht die des
 * Bildschirms; `zeichnen.ts` dreht `y` beim Zeichnen einmal um. Die Logik
 * mit umgedrehtem `y` zu rechnen wäre die Sorte Falle, bei der später jede
 * Schwerkraft-Formel ein Minuszeichen zu viel oder zu wenig hat.
 */

// ---------------------------------------------------------------
// Das Gelände
// ---------------------------------------------------------------

/**
 * Eine Welle des Geländes. Mehrere übereinandergelegt ergeben Hügel, die
 * sich nie exakt wiederholen — und weil alle Parameter aus der Saat
 * kommen, ist dieselbe Strecke auf jedem Gerät identisch.
 */
type Welle = { laenge: number; hoehe: number; phase: number };

/**
 * Eine Sprungschanze: eine glatte Glockenkurve auf dem Gelände.
 *
 * **Warum eine Gauß-Glocke und keine Rampe aus Geraden.** Eine Rampe hat
 * an der Kante einen Knick, und ein Knick heißt: Die Steigung springt von
 * einem Bild zum nächsten. Das Rad würde dort schlagartig eine andere
 * Neigung annehmen, und der Absprungwinkel wäre reiner Zufall statt
 * Können. Eine Glocke ist überall glatt und **analytisch ableitbar** —
 * die Steigung an jeder Stelle ist eine Formel, keine Schätzung.
 */
type Kicker = { x: number; hoehe: number; breite: number };

export type Gelaende = {
  wellen: readonly Welle[];
  kicker: readonly Kicker[];
  /** Länge der Strecke in Metern; dahinter liegt die Ziellinie. */
  laenge: number;
};

/**
 * So weit bleibt der Anfang flach — man soll erst ankommen, dann fahren.
 *
 * Bewusst kurz. Rückmeldung zur ersten Fassung (34 m Anlauf, 760 m
 * Strecke): „Man soll auch mal springen in der ersten Runde, das soll
 * nicht so lang sein." Bei vollem Gas ist diese Strecke in gut zwei
 * Sekunden vorbei, dann kommt sofort der erste Kicker.
 */
export const ANLAUF = 16;

/** Streckenlänge. Rund eine halbe Minute — kurz genug für „nochmal". */
export const STRECKE_LAENGE = 420;

/**
 * Baut das Gelände **allein aus der Saat**.
 *
 * Drei Wellenlängen: eine lange für das große Auf und Ab, eine mittlere
 * für Hügel, eine kurze für Unruhe im Boden. Dazu eine Handvoll
 * Sprungschanzen in wachsendem Abstand — Ronnis Wunsch: „Die
 * Schwierigkeit soll langsam steigen. Level 1: kleine Hügel … später:
 * extreme Sprünge." Innerhalb **einer** Strecke gilt dasselbe: vorne
 * kleine Kicker, hinten große.
 */
export function gelaendeBauen(saat: number, laenge = STRECKE_LAENGE): Gelaende {
  let s = saat;
  const naechste = () => {
    const e = schritt(s);
    s = e.saat;
    return e.wert;
  };

  const wellen: Welle[] = [
    { laenge: 120 + naechste() * 60, hoehe: 3.2 + naechste() * 1.6, phase: naechste() * 6.28 },
    { laenge: 46 + naechste() * 22, hoehe: 1.5 + naechste() * 0.9, phase: naechste() * 6.28 },
    { laenge: 17 + naechste() * 7, hoehe: 0.35 + naechste() * 0.3, phase: naechste() * 6.28 },
  ];

  const kicker: Kicker[] = [];
  // Der erste Sprung kommt sofort nach dem Anlauf — er ist das, was das
  // Spiel ausmacht, und darf nicht erst nach einer halben Minute Rollen
  // auftauchen.
  let x = ANLAUF + 14;
  while (x < laenge - 24) {
    // Der Anteil der zurückgelegten Strecke steuert die Größe: vorne
    // zahm, hinten fordernd.
    const anteil = (x - ANLAUF) / Math.max(1, laenge - ANLAUF);
    /*
     * Der erste Kicker ist bewusst zahm, danach wächst es — Ronni: „im
     * ersten Level muss man natürlich noch nicht so hoch springen." Der
     * erste Sprung soll gelingen, ohne dass man etwas gelernt hat; erst
     * danach muss man die Landung wirklich treffen.
     */
    const wuchs = 0.7 + anteil * 1.5;
    kicker.push({
      x,
      hoehe: (1.7 + naechste() * 1.4) * wuchs,
      /*
       * Schmalere Glocke = stärker gekrümmte Kuppe = früheres Abheben
       * (siehe die Fliehkraft-Bedingung in `takt`). Bewusst nicht unter
       * 2,2 m: darunter wird der Kicker zur Stufe, das Rad schnellt
       * unkontrollierbar ab, und die Landung wäre Glückssache.
       */
      breite: 4.3 - anteil * 1.5 + naechste() * 0.9,
    });
    x += 26 + naechste() * 22;
  }

  return { wellen, kicker, laenge };
}

/**
 * Die Bodenhöhe an einer Stelle.
 *
 * Vor `ANLAUF` bewusst genau flach (0), damit der Start immer gleich und
 * ruhig ist. Der Übergang danach wird über `einblenden` weich
 * hochgezogen — ohne das stünde am Ende der Startgeraden eine Stufe.
 */
export function bodenHoehe(g: Gelaende, x: number): number {
  if (x <= ANLAUF) return 0;
  const einblenden = Math.min(1, (x - ANLAUF) / 18);

  let h = 0;
  for (const w of g.wellen) {
    h += Math.sin((x / w.laenge) * Math.PI * 2 + w.phase) * w.hoehe;
    // Die Welle bei x = ANLAUF abziehen, damit die Summe dort wirklich
    // null ist und nicht irgendwo mitten in der Welle anfängt.
    h -= Math.sin((ANLAUF / w.laenge) * Math.PI * 2 + w.phase) * w.hoehe;
  }
  h *= einblenden;

  for (const k of g.kicker) {
    const d = (x - k.x) / k.breite;
    h += k.hoehe * Math.exp(-d * d);
  }
  return h;
}

/**
 * Die Steigung des Bodens an einer Stelle, als Ableitung — **exakt
 * gerechnet, nicht geschätzt.**
 *
 * Ein numerischer Differenzenquotient (`(h(x+ε) − h(x)) / ε`) wäre hier
 * verlockend, aber er rauscht bei kleinem ε und schmiert bei großem. Der
 * Absprungwinkel hängt genau an diesem Wert; ein rauschender Wert heißt
 * ein zufälliger Absprung. Beide Bausteine (Sinus, Gauß-Glocke) haben eine
 * bekannte Ableitung, also nehmen wir die.
 */
export function bodenSteigung(g: Gelaende, x: number): number {
  if (x <= ANLAUF) return 0;
  const einblenden = Math.min(1, (x - ANLAUF) / 18);
  const einblendenAbleitung = x - ANLAUF < 18 ? 1 / 18 : 0;

  let summe = 0;
  let ableitung = 0;
  for (const w of g.wellen) {
    const k = (Math.PI * 2) / w.laenge;
    summe += Math.sin(x * k + w.phase) * w.hoehe;
    summe -= Math.sin(ANLAUF * k + w.phase) * w.hoehe;
    ableitung += Math.cos(x * k + w.phase) * w.hoehe * k;
  }
  // Produktregel, weil die Summe noch mit `einblenden` multipliziert ist.
  let s = ableitung * einblenden + summe * einblendenAbleitung;

  for (const kk of g.kicker) {
    const d = (x - kk.x) / kk.breite;
    s += kk.hoehe * Math.exp(-d * d) * (-2 * d) / kk.breite;
  }
  return s;
}

/** Der Neigungswinkel des Bodens in Radiant. */
export function bodenWinkel(g: Gelaende, x: number): number {
  return Math.atan(bodenSteigung(g, x));
}

/**
 * Die Krümmung des Bodens — wie schnell sich die Steigung ändert.
 *
 * Sie entscheidet, ob das Rad abhebt: Auf einer Kuppe muss der Boden
 * schneller wegfallen, als die Schwerkraft das Rad herunterziehen kann.
 * Genau diese Bedingung braucht die zweite Ableitung, siehe `takt`.
 *
 * Hier **numerisch** gerechnet, anders als bei der ersten Ableitung: Die
 * Formel von Hand herzuleiten wäre bei der Kicker-Glocke fehleranfällig,
 * und `bodenSteigung` ist selbst exakt — der Differenzenquotient darauf
 * ist also schon genau genug. Der Schritt von 5 cm ist klein gegen die
 * schmalste Glocke (3 m) und groß genug gegen Rundungsfehler.
 */
export function bodenKruemmung(g: Gelaende, x: number): number {
  const h = 0.05;
  return (bodenSteigung(g, x + h) - bodenSteigung(g, x - h)) / (2 * h);
}

// ---------------------------------------------------------------
// Fahrwerte — alle an einer Stelle, damit sich das Fahrgefühl
// nachjustieren lässt, ohne die Formeln anzufassen
// ---------------------------------------------------------------

/** Erdanziehung in Meter je Sekunde². Höher als echt, das fühlt sich straffer an. */
export const SCHWERKRAFT = 22;
/** Antrieb bei voll durchgedrücktem Gas. */
export const ANTRIEB = 11.5;
/** Bremskraft. Deutlich stärker als der Antrieb — Bremsen muss wirken. */
export const BREMSE = 20;
/** Höchsttempo in Meter je Sekunde (rund 65 km/h). */
export const TEMPO_MAX = 18;
/** Rollwiderstand am Boden, Anteil je Sekunde. */
export const ROLLEN = 0.22;
/** Luftwiderstand, Anteil je Sekunde. */
export const LUFT = 0.06;
/** Wie schnell sich das Rad in der Luft dreht, wenn man lehnt. */
export const LUFT_DREHUNG = 4.2;
/** Wie hart sich das Rad am Boden an die Bodenneigung anlegt. */
const ANLEGEN = 14;

/**
 * Landungsschwellen — der Winkelunterschied zwischen Rad und Boden.
 *
 * Das ist die eigentliche Fähigkeit des Spiels: Ronnis „PERFECT LANDING /
 * GOOD / HARD / CRASH". Die Zahlen sind Radiant (0,25 ≈ 14°).
 */
export const LANDUNG_PERFEKT = 0.25;
export const LANDUNG_GUT = 0.55;
export const LANDUNG_HART = 1.0;

/** Was bei der letzten Landung passiert ist — nur fürs Anzeigen und Punkte. */
export type Landung = 'perfekt' | 'gut' | 'hart' | 'sturz';

export type Lauf = {
  gelaende: Gelaende;
  /** Position auf der Strecke in Metern. */
  x: number;
  /** Höhe in Metern; am Boden gleich `bodenHoehe`. */
  y: number;
  /** Geschwindigkeit entlang der Strecke. */
  vx: number;
  /** Senkrechte Geschwindigkeit. Nur in der Luft von null verschieden. */
  vy: number;
  /** Neigung des Rades in Radiant. Positiv = Vorderrad hoch. */
  winkel: number;
  /** Drehgeschwindigkeit des Rades. */
  drehen: number;
  amBoden: boolean;
  /** Sekunden in der Luft beim aktuellen Sprung; 0 am Boden. */
  luftZeit: number;
  /** Summe aller Flugzeiten — geht in die Punkte ein. */
  luftGesamt: number;
  /** Bewertung der letzten Landung, für Anzeige und Punkte. */
  letzteLandung: Landung | null;
  /** Sekunden, die die Landungsmeldung noch stehen bleibt. */
  meldungRest: number;
  /**
   * Der Flow-Zähler. Ronni: „Perfect Landing → Flow x2 → … Crash → Flow
   * zurückgesetzt." Beginnt bei 1 (kein Vervielfacher).
   */
  flow: number;
  /** Anzahl perfekter Landungen — für Anzeige und Punkte. */
  perfekte: number;
  /** Verstrichene Fahrzeit in Sekunden. */
  zeit: number;
  vorbei: boolean;
  /** Nur wahr, wenn die Ziellinie erreicht wurde (nicht bei Sturz). */
  gewonnen: boolean;
  /** Sekunden seit dem Sturz — treibt die Sturzdarstellung. */
  sturzZeit: number;
};

/** Die Eingaben eines Bildes. Alles, was der Spieler beeinflussen kann. */
export type Eingabe = {
  gas: boolean;
  bremse: boolean;
  /** −1 = Gewicht nach hinten, +1 = nach vorne, 0 = nichts. */
  lehnen: number;
};

export const KEINE_EINGABE: Eingabe = { gas: false, bremse: false, lehnen: 0 };

export function neuesSpiel(saat: number, laenge = STRECKE_LAENGE): Lauf {
  const gelaende = gelaendeBauen(saat, laenge);
  return {
    gelaende,
    x: 4,
    y: 0,
    vx: 0,
    vy: 0,
    winkel: 0,
    drehen: 0,
    amBoden: true,
    luftZeit: 0,
    luftGesamt: 0,
    letzteLandung: null,
    meldungRest: 0,
    flow: 1,
    perfekte: 0,
    zeit: 0,
    vorbei: false,
    gewonnen: false,
    sturzZeit: 0,
  };
}

/**
 * Kürzt einen Winkel auf −π … +π.
 *
 * Unentbehrlich für die Landungsbewertung: Nach zwei Rückwärtssaltos steht
 * `winkel` bei rund −12,6, der Boden bei 0,1 — die reine Differenz wäre
 * riesig, obwohl das Rad **richtig** herum liegt. Ohne diese Kürzung wäre
 * jede Landung nach einem Salto ein Sturz.
 */
export function winkelKuerzen(w: number): number {
  const zwei = Math.PI * 2;
  let r = ((w % zwei) + zwei) % zwei;
  if (r > Math.PI) r -= zwei;
  return r;
}

/** Wie eine Landung ausfällt, allein aus dem Winkelunterschied. */
export function landungBewerten(unterschied: number): Landung {
  const d = Math.abs(winkelKuerzen(unterschied));
  if (d < LANDUNG_PERFEKT) return 'perfekt';
  if (d < LANDUNG_GUT) return 'gut';
  if (d < LANDUNG_HART) return 'hart';
  return 'sturz';
}

/**
 * Ein Zeitschritt. Rein — gleiche Eingabe, gleiches Ergebnis.
 *
 * Aufbau: erst die Kräfte (Antrieb, Bremse, Hang, Widerstand), dann die
 * Bewegung, dann der Bodenkontakt. Die Reihenfolge ist wichtig — wer den
 * Bodenkontakt vor der Bewegung prüft, prüft den Stand von gestern.
 */
export function takt(lauf: Lauf, dt: number, e: Eingabe = KEINE_EINGABE): Lauf {
  if (lauf.vorbei) {
    // Nach dem Aus läuft nur noch die Sturzuhr weiter, damit die
    // Darstellung ausschwingen kann.
    return { ...lauf, sturzZeit: lauf.sturzZeit + dt };
  }

  const g = lauf.gelaende;
  let { x, y, vx, vy, winkel, drehen, amBoden, luftZeit, flow } = lauf;
  let luftGesamt = lauf.luftGesamt;
  let letzteLandung = lauf.letzteLandung;
  let perfekte = lauf.perfekte;

  if (amBoden) {
    const hangWinkel = bodenWinkel(g, x);

    // Hangabtrieb: bergab schneller, bergauf langsamer. Das ist der Grund,
    // warum man vor einem Sprung Anlauf braucht.
    vx -= Math.sin(hangWinkel) * SCHWERKRAFT * dt;

    if (e.gas) vx += ANTRIEB * dt;
    if (e.bremse) {
      // Nie ins Rückwärtsfahren bremsen — ein Mountainbike rollt nicht
      // von selbst zurück, und ein negatives `vx` würde das Gelände
      // rückwärts durchlaufen.
      vx = Math.max(0, vx - BREMSE * dt);
    }

    vx -= vx * ROLLEN * dt;
    vx = Math.min(TEMPO_MAX, Math.max(0, vx));

    x += vx * dt;
    y = bodenHoehe(g, x);

    /*
     * Das Rad legt sich an den Boden an, statt sofort dessen Winkel
     * anzunehmen. Der Unterschied ist sichtbar: Ohne Dämpfung ruckt das
     * Rad bei jeder Bodenwelle in den neuen Winkel; mit Dämpfung rollt es
     * sichtbar darüber. `ANLEGEN * dt` ist der Anteil, der pro Schritt
     * aufgeholt wird — bei kleinem dt also mehrere kleine Schritte, das
     * bleibt framerate-unabhängig.
     */
    const zielWinkel = bodenWinkel(g, x);
    winkel += winkelKuerzen(zielWinkel - winkel) * Math.min(1, ANLEGEN * dt);
    drehen = 0;

    /*
     * **Abheben.** Auf einer Kuppe fällt der Boden weg; solange die
     * Schwerkraft das Rad schnell genug hinterherzieht, bleibt es unten.
     * Reicht sie nicht, hebt es ab.
     *
     * Die Bedingung dafür ist die **Fliehkraft auf der Kuppe**:
     *
     *     Krümmung × Tempo²  >  Schwerkraft
     *
     * Das ist dieselbe Rechnung wie bei einer Achterbahn im Looping, nur
     * andersherum. Sie hat zwei Eigenschaften, die hier entscheidend sind:
     * Sie hängt **quadratisch** vom Tempo ab — doppeltes Tempo heißt
     * vierfache Abhebekraft, deshalb fliegt man schnell weit und rollt
     * langsam nur drüber. Und sie enthält **kein `dt`**.
     *
     * Der erste Versuch verglich stattdessen die Höhendifferenz eines
     * Zeitschritts mit `SCHWERKRAFT * dt * 6`. Das war doppelt falsch: Der
     * Schwellwert wuchs mit dem Zeitschritt, also hob dieselbe Fahrt bei
     * 30 Bildern je Sekunde woanders ab als bei 60 — und der Faktor 6 war
     * frei geraten statt hergeleitet.
     */
    const kruemmung = bodenKruemmung(g, x);
    const winkelJetzt = bodenWinkel(g, x);
    if (vx > 2 && -kruemmung * vx * vx > SCHWERKRAFT * Math.cos(winkelJetzt)) {
      amBoden = false;
      // Beim Abheben zeigt die Geschwindigkeit den Hang entlang.
      vy = Math.sin(winkelJetzt) * vx;
      luftZeit = 0;
    }
  } else {
    // --- In der Luft ---
    vy -= SCHWERKRAFT * dt;
    vx -= vx * LUFT * dt;
    x += vx * dt;
    y += vy * dt;
    luftZeit += dt;
    luftGesamt += dt;

    // Gewichtsverlagerung: die eigentliche Können-Mechanik. Lehnen dreht
    // das Rad, und die Drehung läuft weiter, bis man gegenlenkt.
    drehen += e.lehnen * LUFT_DREHUNG * dt;
    drehen -= drehen * 1.6 * dt;
    winkel += drehen * dt;

    const boden = bodenHoehe(g, x);
    if (y <= boden) {
      // --- Landung ---
      y = boden;
      const hang = bodenWinkel(g, x);
      const bewertung = landungBewerten(winkel - hang);
      letzteLandung = bewertung;

      if (bewertung === 'sturz') {
        return {
          ...lauf,
          x,
          y,
          vx: 0,
          vy: 0,
          winkel,
          drehen,
          amBoden: true,
          luftZeit: 0,
          luftGesamt,
          letzteLandung: 'sturz',
          meldungRest: 2,
          flow: 1,
          perfekte,
          zeit: lauf.zeit + dt,
          vorbei: true,
          gewonnen: false,
          sturzZeit: 0,
        };
      }

      /*
       * Der Tempoverlust ist die eigentliche Belohnung für gutes Landen —
       * nicht die Punkte. Wer sauber landet, behält seinen Schwung und ist
       * am nächsten Sprung schneller; wer hart landet, muss neu anfahren.
       * Genau daraus entsteht Ronnis „Flow".
       */
      if (bewertung === 'perfekt') {
        perfekte += 1;
        flow = Math.min(9, flow + 1);
        // Ein kleiner Schub — sauber gelandet fühlt sich schnell an.
        vx = Math.min(TEMPO_MAX, vx * 1.04);
      } else if (bewertung === 'gut') {
        vx *= 0.94;
      } else {
        vx *= 0.72;
        flow = 1;
      }

      // Die Federung nimmt den senkrechten Stoß auf, statt ihn ins
      // Vorwärtstempo zu leiten.
      vy = 0;
      amBoden = true;
      luftZeit = 0;
      winkel = hang;
      drehen = 0;

      return {
        ...lauf,
        x,
        y,
        vx,
        vy,
        winkel,
        drehen,
        amBoden,
        luftZeit,
        luftGesamt,
        letzteLandung,
        meldungRest: 1.2,
        flow,
        perfekte,
        zeit: lauf.zeit + dt,
      };
    }
  }

  // Ziel erreicht?
  if (x >= g.laenge) {
    return {
      ...lauf,
      x: g.laenge,
      y,
      vx,
      vy,
      winkel,
      drehen,
      amBoden,
      luftZeit,
      luftGesamt,
      letzteLandung,
      meldungRest: 0,
      flow,
      perfekte,
      zeit: lauf.zeit + dt,
      vorbei: true,
      gewonnen: true,
      sturzZeit: 0,
    };
  }

  return {
    ...lauf,
    x,
    y,
    vx,
    vy,
    winkel,
    drehen,
    amBoden,
    luftZeit,
    luftGesamt,
    letzteLandung,
    meldungRest: Math.max(0, lauf.meldungRest - dt),
    flow,
    perfekte,
    zeit: lauf.zeit + dt,
  };
}

/** Tempo in km/h — nur für die Anzeige, die Physik rechnet in m/s. */
export function tempoKmh(lauf: Lauf): number {
  return lauf.vx * 3.6;
}

/** Wie weit die Strecke geschafft ist, 0 bis 1. */
export function fortschritt(lauf: Lauf): number {
  return Math.min(1, lauf.x / lauf.gelaende.laenge);
}

/**
 * Die Punktzahl.
 *
 * Ein Punkt je Meter, dazu Flugzeit und perfekte Landungen — und ein
 * Zeitbonus nur, **wenn** man ins Ziel kommt. Ronni: „Score entsteht aus
 * Geschwindigkeit, Airtime, Distanz, Tricks, perfekte Landungen, Flow."
 * Ohne den Zielbonus wäre langsames, vorsichtiges Fahren die beste
 * Taktik — und das ist das Gegenteil des Spiels.
 */
export function punkte(lauf: Lauf): number {
  const strecke = Math.floor(lauf.x);
  const luft = Math.floor(lauf.luftGesamt * 40);
  const landungen = lauf.perfekte * 60;
  const zielBonus = lauf.gewonnen ? Math.max(0, Math.floor(1600 - lauf.zeit * 12)) : 0;
  return strecke + luft + landungen + zielBonus;
}

/** Die Saat einer Strecke. Gleiche Nummer = gleiche Strecke, überall. */
export function streckenSaat(nummer: number): number {
  return saatAus('radfahren', nummer);
}
