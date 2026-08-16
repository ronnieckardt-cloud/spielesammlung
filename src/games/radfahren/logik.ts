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

/** Mindest- und Streubreite der seltenen Mega-Kicker, siehe `gelaendeBauen`. */
const MEGA_BREITE_MIN = 9;
const MEGA_BREITE_STREUUNG = 3;
/** Freie Landezone hinter einem Mega-Kicker, zusätzlich zu seiner Breite. */
const MEGA_LANDEZONE = 13;
/** Größe der beiden kleinen Buckel eines Doppel-Abschnitts, siehe unten. */
const DOPPEL_HOEHE_MIN = 1.8;
const DOPPEL_BREITE_MIN = 2.4;
const DOPPEL_BREITE_STREUUNG = 0.8;
/** Lücke zwischen den beiden Buckeln — großzügig, das ist der ganze Witz. */
const DOPPEL_LUECKE = 8;

/**
 * Baut das Gelände **allein aus der Saat**.
 *
 * **Vierte Fassung.** Die dritte hatte drei Abschnittsarten — Rückmeldung
 * danach: „Die Strecken sind immer noch zu sehr Zickzack." Dazugekommen
 * ist `doppel`: zwei kleine, eigenständige Buckel mit einer bewusst
 * großzügigen Lücke dazwischen — ein „Double" im BMX/MTB-Sinn, bei dem man
 * vom ersten Buckel über die Lücke **und über den zweiten hinweg** springt,
 * statt weich von einer Kuppe in die nächste zu rollen. Ronni, wörtlich:
 * „kleinere Hubbel, wo du versuchen musst, den anderen kleinen Hubbel zu
 * überspringen." Macht zusammen vier **Abschnittsarten**: `ruhig` (kein
 * Kicker, nur die vorhandene Bodenwelle — Erholung und neuer Schwung),
 * `doppel` (die beiden kleinen Buckel), `kicker` (eine kurze Kette von
 * zwei bis vier normalen Sprüngen, „damit man in andere Sprünge springt")
 * und `mega` (ein einzelner, deutlich höherer und steilerer Sprung mit
 * großzügiger Landezone) — Ronni: „ein paar Sprünge, die dich mega hoch
 * kicken … aber nicht immer."
 *
 * **Fünfte Fassung: Rhythmus statt reinem Würfel.** Die vierte Fassung
 * würfelte die Abschnittsart bei **jedem einzelnen** Abschnitt neu, ohne
 * Gedächtnis — auf Strecken-Ebene wirkte das trotz der vier Arten
 * gleichförmig: mal ein ruhiger, mal ein knackiger Abschnitt, aber nie
 * eine klare Passage aus mehreren. Jetzt gibt es zwei **Zonen**, die sich
 * über mehrere Abschnitte hinweg abwechseln: `flow` (überwiegend `ruhig`
 * und `doppel`, großzügigere Abstände — Tempo aufbauen, durchrollen) und
 * `skill` (überwiegend `kicker`-Ketten und `mega` — Können gefragt, dicht
 * getaktet). Innerhalb einer Zone bleiben die einzelnen
 * Sprung-Formeln (Breite, Höhe, `MAX_KICKER_STEIGUNG`-Deckel) exakt
 * dieselben wie vorher; nur **welche Art wie oft hintereinander**
 * vorkommt, ist jetzt kein Zufall mehr Bild für Bild, sondern strukturiert.
 * Die Zonenlänge selbst kommt wie alles andere aus der Saat — dieselbe
 * Strecke bleibt bei gleicher Saat exakt gleich.
 */
export function gelaendeBauen(saat: number, laenge = STRECKE_LAENGE): Gelaende {
  let s = saat;
  const naechste = () => {
    const e = schritt(s);
    s = e.saat;
    return e.wert;
  };

  const wellen: Welle[] = [
    { laenge: 16 + naechste() * 8, hoehe: 0.15 + naechste() * 0.15, phase: naechste() * 6.28 },
  ];

  const kicker: Kicker[] = [];
  // Der erste Sprung kommt sofort nach dem Anlauf — er ist das, was das
  // Spiel ausmacht, und darf nicht erst nach einer halben Minute Rollen
  // auftauchen. Deshalb ist die erste Runde immer eine Kicker-Reihe, erst
  // danach beginnt der Zonen-Rhythmus.
  let x = ANLAUF + 10;
  let ersteRunde = true;

  /*
   * Die Zone wechselt nicht bei jedem Abschnitt, sondern nach 2 bis 4
   * Abschnitten — kurz genug, dass beide Zonen mehrfach auf einer Strecke
   * vorkommen, lang genug, dass eine Zone als eigene Passage spürbar ist,
   * nicht nur als einzelner Ausreißer.
   */
  let zone: 'flow' | 'skill' = 'flow';
  let zoneRest = 2 + Math.floor(naechste() * 3);

  while (x < laenge - 30) {
    // Der Anteil der zurückgelegten Strecke steuert die Größe: vorne
    // zahm, hinten fordernd — gilt für alle vier Abschnittsarten gleich.
    const anteil = (x - ANLAUF) / Math.max(1, laenge - ANLAUF);

    if (!ersteRunde) {
      if (zoneRest <= 0) {
        zone = zone === 'flow' ? 'skill' : 'flow';
        zoneRest = 2 + Math.floor(naechste() * 3);
      }
      zoneRest--;
    }

    /*
     * **Der Höhepunkt:** im letzten Fünftel der Strecke erzwingt die
     * nächste fällige Zone `skill` statt sie dem Zufall zu überlassen —
     * sonst könnte eine Strecke ausgerechnet vor der Ziellinie in eine
     * ruhige Rollphase auslaufen, statt auf einen letzten, deutlich
     * anspruchsvollen Abschnitt zuzulaufen. Die Sprünge selbst werden
     * dadurch nicht größer als das Übliche am Streckenende (das steuert
     * weiterhin `anteil` in den einzelnen Formeln) — nur die Art wird
     * sicher `skill` statt zufällig `flow`.
     */
    const wuerfel = naechste();
    const effektiveZone: 'flow' | 'skill' = anteil > 0.8 ? 'skill' : zone;
    const art: 'ruhig' | 'doppel' | 'kicker' | 'mega' = ersteRunde
      ? 'kicker'
      : effektiveZone === 'flow'
        ? // Flow-Zone: viel Rollen und höchstens ein sanfter Doppel-Hubbel,
          // kaum Kicker-Ketten und nie ein Mega — Tempo halten, nicht fordern.
          wuerfel < 0.55
          ? 'ruhig'
          : wuerfel < 0.85
            ? 'doppel'
            : 'kicker'
        : // Skill-Zone: dicht getaktete Sprünge, Ruhepausen sind selten.
          wuerfel < 0.08
          ? 'ruhig'
          : wuerfel < 0.3
            ? 'doppel'
            : wuerfel < 0.55
              ? 'mega'
              : 'kicker';
    ersteRunde = false;

    if (art === 'ruhig') {
      // Erholung: kein einziger Kicker. Genau hier baut man nach einer
      // harten Landung wieder Tempo auf — ohne dieses Gegenstück bräche
      // eine Kette unperfekter Landungen das Tempo immer weiter herunter,
      // ohne je eine Gelegenheit, es zurückzuholen.
      //
      // In einer Flow-Zone etwas großzügiger als vorher (20–36 m → 24–46 m)
      // — „längere, flachere Wellen, größere Abstände", genau das, was die
      // Zone von einer knapp getakteten Skill-Zone unterscheiden soll.
      x += (effektiveZone === 'flow' ? 24 : 20) + naechste() * (effektiveZone === 'flow' ? 22 : 16);
    } else if (art === 'doppel') {
      // Zwei kleine, eigenständige Buckel — kein glattes Ineinanderrollen
      // wie bei einer Kicker-Kette, sondern eine klare Lücke, die man
      // gezielt überspringen muss. Steigung gedeckelt wie bei `kicker`,
      // siehe `MAX_KICKER_STEIGUNG`: zwei benachbarte Buckel sind genau
      // die Falle, an der ein zu steiler Kicker vorher hängen blieb.
      for (let i = 0; i < 2; i++) {
        const breite = DOPPEL_BREITE_MIN + naechste() * DOPPEL_BREITE_STREUUNG;
        const verhaeltnis = Math.min(MAX_KICKER_STEIGUNG, 0.5 + naechste() * 0.3);
        const hoehe = Math.max(DOPPEL_HOEHE_MIN, breite * verhaeltnis);
        kicker.push({ x, hoehe, breite });
        x += breite * 1.2 + DOPPEL_LUECKE + naechste() * 4;
      }
    } else if (art === 'mega') {
      /*
       * Ein einzelner, deutlich höherer und steilerer Absprung. Ronni
       * nannte „fünf Sekunden in der Luft" — physikalisch nicht ganz
       * erreichbar (bei `TEMPO_MAX` = 18 m/s und `SCHWERKRAFT` = 22 liegt
       * die maximale Flugzeit rechnerisch bei rund 1,6 s, siehe
       * `bodenSteigung`-Herleitung), aber deutlich, spürbar länger als ein
       * normaler Hüpfer — das war der eigentliche Wunsch dahinter.
       *
       * **Auch hier gilt `MAX_KICKER_STEIGUNG`.** Der erste Versuch ließ
       * Mega-Kicker steiler als jeden anderen, in der Annahme, dass sie
       * ja einzeln mit großzügiger Landezone stehen — die eigentliche
       * Falle waren aber zwei Mega-Abschnitte kurz hintereinander (der
       * Würfel verbietet das nicht), zwischen denen genau dieselbe
       * Pendel-Falle wie bei zwei benachbarten Kickern entstand. Die
       * Dramatik kommt seitdem aus einer **breiteren** Glocke statt aus
       * einer steileren — der Absprungwinkel bleibt sicher, aber die
       * Kuppe ist groß genug, um trotzdem spürbar mehr Flugzeit zu geben.
       */
      const breite = MEGA_BREITE_MIN + naechste() * MEGA_BREITE_STREUUNG + anteil * 5;
      const verhaeltnis = MAX_KICKER_STEIGUNG * (0.88 + naechste() * 0.12);
      const hoehe = breite * verhaeltnis;
      kicker.push({ x, hoehe, breite });
      // Große Lücke danach — man fliegt weit, der nächste Boden braucht
      // also entsprechend Abstand, sonst landet man mitten im Anstieg.
      x += breite * 1.3 + MEGA_LANDEZONE + naechste() * 6;
    } else {
      // Eine kurze Kette normaler Kicker.
      const anzahl = 2 + Math.floor(naechste() * 3);
      for (let i = 0; i < anzahl && x < laenge - 20; i++) {
        /*
         * Schmalere Glocke = stärker gekrümmte Kuppe = früheres, härteres
         * Abheben (siehe die Fliehkraft-Bedingung in `takt`). Bewusst
         * nicht unter 2,4 m: darunter wird der Kicker zur Stufe, das Rad
         * schnellt unkontrollierbar ab, und die Landung wäre Glückssache.
         * Wächst leicht mit der Strecke, damit spätere Kicker trotz der
         * gedeckelten Steigung (siehe unten) noch höher sein können.
         */
        const breite = Math.max(2.4, 2.7 + naechste() * 1.1 + anteil * 2.0);
        /*
         * Höhe **aus der Breite**, nicht mehr unabhängig gewürfelt — mit
         * `MAX_KICKER_STEIGUNG` gedeckelt. Vorne zahm, hinten bis an die
         * Decke heran, aber nie darüber: siehe die Herleitung bei
         * `MAX_KICKER_STEIGUNG` weiter unten.
         */
        const verhaeltnis = Math.min(MAX_KICKER_STEIGUNG, (0.22 + naechste() * 0.2) * (1.0 + anteil * 0.9));
        const hoehe = breite * verhaeltnis;
        kicker.push({ x, hoehe, breite });
        /*
         * **Die Lücke zur nächsten Kuppe ist an das gebunden, was bei
         * Höchsttempo überhaupt in der Luft zu schaffen ist**, nicht an
         * eine mit der Sprunghöhe mitwachsende Zahl. Mit `TEMPO_MAX` =
         * 18 m/s trägt ein Sprung bei realistischem Absprungwinkel
         * höchstens etwa 9 bis 13 m weit (Wurfweite v² sin 2θ / g). Eine
         * mit der Höhe mitwachsende Lücke wuchs früher über jede
         * schaffbare Weite hinaus — der Bot landete permanent mitten in
         * der Anfahrt des nächsten Kickers. Jetzt bleibt die Lücke in
         * diesem Rahmen, unabhängig von der Höhe.
         */
        x += breite * 1.2 + 5 + naechste() * 4;
      }
    }
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

/**
 * Größte Kicker-Steigung, die noch sicher zu befahren ist — benutzt von
 * `gelaendeBauen` bei den Abschnittsarten `kicker` und `doppel`.
 *
 * Eine Gauß-Glocke hat ihre steilste Stelle bei ±0,707 Breiten vom
 * Gipfel; dort ist die Steigung `0,858 × Höhe / Breite` (Herleitung: Die
 * Ableitung von `exp(-d²) · (-2d)` nach `d` ist bei `d² = 0,5` null, und
 * `exp(-0,5) · 2 · 0,707 ≈ 0,858`). **Bleibt die Steigung unter dem
 * Winkel, den `ANTRIEB` allein aus dem Stand noch hochfährt
 * (`asin(ANTRIEB / SCHWERKRAFT)`), kann kein Kicker eine Stelle erzeugen,
 * an der sich Antrieb und Hangabtrieb exakt aufheben.**
 *
 * Genau das ist über den Fairness-Test aufgefallen: Ein Bot, der stur Gas
 * gab, blieb bei genau diesem Winkel für immer hängen — kein
 * Vorwärtskommen (der Antrieb reicht nicht), aber auch kein Zurückrollen
 * (der Antrieb hält exakt dagegen). Ein Bot, der stattdessen bewusst
 * zurückrollt, um neuen Anlauf zu holen, half nur halb: Bei zwei
 * benachbarten, beide zu steilen Kickern (eine ganz normale
 * Kicker-Kette) pendelte er endlos zwischen ihnen hin und her, ohne für
 * einen von beiden je genug Schwung zu holen — der Boden dazwischen war
 * selbst zu steil, um ihn aufzubauen. Mit Sicherheitsabstand (Faktor
 * 0,78) bleibt jeder Kicker dieser beiden Arten, gleich wie hoch, mit
 * Antrieb allein befahrbar — Höhe kommt seitdem aus einer breiteren
 * Glocke, nicht aus einer steileren. `mega`-Kicker sind bewusst
 * ausgenommen: Sie stehen einzeln mit großzügiger Landezone, nie direkt
 * neben einem zweiten steilen Kicker, und genau diese Nachbarschaft war
 * die eigentliche Falle.
 */
const MAX_KICKER_STEIGUNG = Math.tan(Math.asin(ANTRIEB / SCHWERKRAFT)) * 0.78;
/** Bremskraft. Deutlich stärker als der Antrieb — Bremsen muss wirken. */
export const BREMSE = 20;
/** Höchsttempo in Meter je Sekunde (rund 65 km/h). */
export const TEMPO_MAX = 18;
/** Rollwiderstand am Boden, Anteil je Sekunde. */
export const ROLLEN = 0.22;
/** Luftwiderstand, Anteil je Sekunde. */
export const LUFT = 0.06;
/**
 * Wie schnell sich das Rad in der Luft dreht, wenn man lehnt.
 *
 * Deutlich höher als der erste Wert (4,2) — Rückmeldung: „Das Kippen nach
 * vorne oder hinten muss leichter, heißt schneller gehen. Wenn ich nur
 * kurz drauf tippe, soll sich schon gut was bewegen." Bei 4,2 baute ein
 * 100-ms-Antippen kaum mehr als 15° Drehung auf — spürbar träge, obwohl
 * ein kurzer Antipp sich sofort deutlich auswirken soll.
 *
 * **War zwischenzeitlich auf 16**, als `NATUR_NICKEN` dazukam (mehr
 * Antrieb sollte die aktive Steuerung klar über die passive Drift heben).
 * Ein zu hoher Wert hier macht aber genau das kaputt, was er schützen
 * soll: Bei so viel Antrieb je `lehnen`-Einheit reagiert `drehen` auf jeden
 * Korrekturimpuls überproportional, und ein reiner Proportionalregler (wie
 * der Fairness-Bot in `logik.test.ts`) überschießt regelmäßig über das
 * Ziel hinaus, bevor er bremsen kann — mit sichtbaren Ausschlägen von über
 * 100°. `10` reicht für spürbar schnelles Kippen (siehe oben), ohne die
 * Regelstrecke unnötig zu verschärfen; siehe `NATUR_NICKEN` für den Rest
 * der Geschichte.
 */
export const LUFT_DREHUNG = 10;
/**
 * Feste Drehbeschleunigung nach unten (Nase runter), die in der Luft immer
 * wirkt — unabhängig von `lehnen`. Siehe die Herleitung in `takt`: Ohne
 * sie hielt „nichts tun" den Absprungwinkel exakt bis zur Landung, was
 * Steuern zur Nebensache machte. Rückmeldung, wörtlich: „Man muss nichts
 * machen — wenn ich nur Gas gebe, komme ich auch ans Ziel, so sollte das
 * nicht sein. Es sollte immer notwendig sein, sich je nach Sprung richtig
 * zu bewegen."
 *
 * **Die Zahl ist das Ergebnis einer Gratwanderung, kein Wunschwert.** Zwei
 * Tests ziehen in entgegengesetzte Richtungen: reines Gasgeben darf auf
 * höchstens 2 von 10 Strecken ins Ziel kommen (`kommt mit reinem Gasgeben
 * nicht zuverlässig ins Ziel`), aber ein einfacher **aktiver** Bot muss
 * weiterhin alle 10 schaffen (Fairness). Kleine Werte (2–5) drehen die
 * Nase zwar spürbar, aber zufällig fast immer in dieselbe Richtung, in
 * die ein Kicker-Absprung ohnehin zur Landung hin rotiert — reines Gas
 * gewann damit trotzdem 9–10 von 10 Strecken. Ab etwa 7 kippt das
 * Verhältnis um. `8` ist der Wert, bei dem beide Tests zusammen zum
 * ersten Mal gleichzeitig grün sind (passiv 1/10, aktiv 10/10) — siehe
 * `LUFT_DREHUNG` für die zweite Hälfte der Geschichte, warum eine hohe
 * `NATUR_NICKEN` allein nicht reicht, wenn `LUFT_DREHUNG` mitwächst.
 */
export const NATUR_NICKEN = 8.0;
/**
 * So lange nach dem Abheben wirkt `NATUR_NICKEN` noch **nicht** — reine
 * Reaktionszeit für den Menschen am anderen Ende der Steuerung.
 *
 * Ohne diese Verzögerung ist die Anforderung „Gegenlenken muss nötig
 * sein" zwar erfüllt, aber nur für einen Bot, der jedes Bild neu plant.
 * Ein echter Spieler steuert ausschließlich binär (siehe `FlowMtb.tsx`,
 * `lehnen` ist immer −1, 0 oder 1 — kein Analogwert wie beim Fairness-Bot
 * in `logik.test.ts`) und braucht eine echte, spürbare Reaktionszeit,
 * bevor die erste Korrektur überhaupt beim Rad ankommt. Bei kurzen
 * Kicker-Hüpfern (oft nur 0,3–0,5 s Flugzeit insgesamt) frisst eine
 * Drehbeschleunigung, die ab der ersten Millisekunde wirkt, genau das
 * kleine Zeitfenster auf, das ein Mensch bräuchte, um überhaupt zu
 * reagieren — gemessen an einem Bot mit 100 ms simulierter Reaktionszeit
 * sank die Erfolgsquote dadurch auf einzelne Strecken. Diese Gnadenfrist
 * gibt genau dieses Fenster zurück, ohne die Wirkung auf längere Sprünge
 * (Kicker-Ketten, Mega-Kicker) zu schwächen — dort ist ohnehin reichlich
 * Flugzeit für die Drift übrig.
 */
export const NATUR_NICKEN_VERZOEGERUNG = 0;
/**
 * Wie weit `NATUR_NICKEN` die Nase höchstens unter den Absprungwinkel
 * drückt, bevor die Drift von selbst aufhört — siehe die Herleitung an der
 * Anwendungsstelle in `takt`.
 */
export const NATUR_NICKEN_GRENZE = 0.55;
/** Wie hart sich das Rad am Boden an die Bodenneigung anlegt. */
const ANLEGEN = 14;
/**
 * Wie schnell man höchstens rückwärts rollt, wenn ein Hang zu steil zum
 * Hochfahren ist.
 *
 * Deutlich unter `TEMPO_MAX`: Das Rückwärtsrollen ist keine zweite
 * Fahrtrichtung, die man steuert, sondern nur die Schwerkraft, die einen
 * dort abholt, wo man stehen geblieben ist.
 */
const RUECKROLL_MAX = 6;

/**
 * Landungsschwellen — der Winkelunterschied zwischen Rad und Boden.
 *
 * Das ist die eigentliche Fähigkeit des Spiels: Ronnis „PERFECT LANDING /
 * GOOD / HARD / CRASH". Die Zahlen sind Radiant (0,25 ≈ 14°).
 */
export const LANDUNG_PERFEKT = 0.25;
export const LANDUNG_GUT = 0.55;
export const LANDUNG_HART = 1.0;

/**
 * Punkte je voller Drehung, die man in der Luft schafft **und steht**.
 * Ronnis ursprüngliche Vorgabe für die Punkte nannte „Tricks" schon immer
 * mit („Score entsteht aus … Distanz, Tricks, perfekte Landungen …"), nur
 * gab es dafür bis jetzt keine Zählung — ein Sprung mit Salto brachte
 * nicht mehr Punkte als derselbe Sprung ohne. Ein Wert in der
 * Größenordnung einer perfekten Landung (`perfekte * 60`), aber deutlich
 * darüber: Ein Salto ist schwerer und seltener als eine einfach saubere
 * Landung, das muss sich auch im Punktestand zeigen.
 */
export const TRICK_PUNKTE_JE_DREHUNG = 200;

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
  /**
   * `winkel` im Moment des Abhebens — die Vergleichsbasis, um beim Landen
   * zu wissen, wie viele volle Drehungen man in der Luft geschafft hat.
   * Nur während eines Sprungs aussagekräftig, siehe `punkte`.
   */
  luftDrehStart: number;
  /**
   * Punkte für geschaffte Drehungen in der Luft — ein eigener Topf, wie
   * `doppelPunkte` bei Dash City: wird nie geleert, was man sich verdient
   * hat, bleibt. Siehe „Tricks" in `takt`.
   */
  trickPunkte: number;
  /** Volle Drehungen der letzten Landung — nur für die Anzeige. */
  letzterTrick: number;
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
    luftDrehStart: 0,
    trickPunkte: 0,
    letzterTrick: 0,
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
    /*
     * Nach dem Aus läuft die Sturzuhr weiter, damit die Darstellung
     * ausschwingen kann — bei einem Sieg passiert sonst nichts mehr, bei
     * einem Sturz aber schon: Das Rad rutscht mit dem Rest seines Schwungs
     * noch ein Stück aus. Rückmeldung: „Falls man stürzt, soll es nicht im
     * letzten Moment abbrechen, sondern man soll sehen, wie der Typ
     * stürzt." Ein hartes Einfrieren genau im Sturzmoment sah dagegen aus
     * wie ein Fehler, kein Sturz. Der Punktestand ist davon unberührt —
     * `FlowMtb.tsx` liest ihn genau einmal, im selben Bild, in dem
     * `vorbei` wahr wird, bevor dieses Ausrutschen überhaupt beginnt.
     */
    if (!lauf.gewonnen && lauf.vx !== 0) {
      const x = lauf.x + lauf.vx * dt;
      const vx = lauf.vx - lauf.vx * 3.2 * dt;
      return {
        ...lauf,
        x,
        y: bodenHoehe(lauf.gelaende, x),
        vx: Math.abs(vx) < 0.05 ? 0 : vx,
        sturzZeit: lauf.sturzZeit + dt,
      };
    }
    return { ...lauf, sturzZeit: lauf.sturzZeit + dt };
  }

  const g = lauf.gelaende;
  let { x, y, vx, vy, winkel, drehen, amBoden, luftZeit, flow } = lauf;
  let luftGesamt = lauf.luftGesamt;
  let letzteLandung = lauf.letzteLandung;
  let perfekte = lauf.perfekte;
  let trickPunkte = lauf.trickPunkte;
  let letzterTrick = lauf.letzterTrick;
  let luftDrehStart = lauf.luftDrehStart;

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

    // Rollwiderstand wirkt in beide Richtungen gegen die Bewegung — das
    // Produkt `vx * ROLLEN` kehrt sein eigenes Vorzeichen mit `vx` um,
    // bremst also Rückwärtsrollen genauso wie Vorwärtsfahren.
    vx -= vx * ROLLEN * dt;

    /*
     * **Kein Boden hält für immer.** Bleibt man an einem Hang mit zu
     * wenig Schwung stehen, muss die Schwerkraft einen wieder herunter-
     * ziehen können — Rückmeldung: „Wenn man auf 'nem Berg stehen bleiben
     * sollte, sollte man auch wieder zurückrollen … sieht komisch aus,
     * wenn man dann einfach stehen bleibt, ohne die Bremse zu ziehen."
     * Der erste Versuch deckelte `vx` nach unten bei 0 — auf einem Hang
     * zog der Hangabtrieb `vx` dadurch bis auf 0 und blieb dort für immer
     * hängen, egal wie steil es weiterging. Jetzt darf `vx` negativ
     * werden, gedeckelt bei `RUECKROLL_MAX`; Gas oder Bremse holen einen
     * jederzeit da wieder heraus (beide wirken unten ungebremst in ihre
     * Richtung).
     */
    vx = Math.min(TEMPO_MAX, Math.max(-RUECKROLL_MAX, vx));

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
      // Merkpunkt für die Drehzählung — siehe „Tricks" unten bei der Landung.
      luftDrehStart = winkel;
    }
  } else {
    // --- In der Luft ---
    vy -= SCHWERKRAFT * dt;
    vx -= vx * LUFT * dt;
    x += vx * dt;
    y += vy * dt;
    luftZeit += dt;
    luftGesamt += dt;

    /*
     * Gewichtsverlagerung: die eigentliche Können-Mechanik. Lehnen dreht
     * das Rad, und die Drehung läuft weiter, bis man gegenlenkt.
     *
     * **Das Vorzeichen war umgedreht** — Rückmeldung: „Wenn ich den Pfeil
     * nach hinten drücke, geht das Körpergewicht nicht nach hinten,
     * sondern nach vorne." Gewicht nach hinten muss das Vorderrad
     * **anheben** (`winkel` steigt, siehe `Lauf.winkel`), Gewicht nach
     * vorne muss es **senken** — dieselbe Konvention wie bei jedem
     * Trials- oder Hügel-Spiel. `lehnen` ist −1 für „Hinten", +1 für
     * „Vorne"; ohne das Minuszeichen drehte „Hinten" das Rad nach unten
     * statt nach oben.
     */
    drehen -= e.lehnen * LUFT_DREHUNG * dt;
    /*
     * **Ohne Eingabe treibt die Nase langsam nach unten** — kein
     * Gleichgewicht, das sich von selbst hält. Rückmeldung: „Ich muss
     * überhaupt gar nicht Gewicht nach vorne oder hinten legen — wenn ich
     * einfach die ganze Zeit auf Gas drücke, kriege ich meine Punkte. Das
     * ist nicht so cool." Vorher blieb `winkel` in der Luft ohne Eingabe
     * exakt beim Absprungwinkel stehen (`drehen` startete dort bei null
     * und wurde nur durch `lehnen` bewegt) — und der liegt bei vielen
     * Kickern zufällig schon nahe am Landewinkel, sodass „nichts tun"
     * fast wie „richtig gemacht" wirkte.
     *
     * `NATUR_NICKEN` ist eine **feste** Drehbeschleunigung, genau wie der
     * `lehnen`-Term darüber — kein Sonderfall, der Bildrate anders
     * behandeln könnte. Zusammen mit der Dämpfung direkt darunter pendelt
     * sich `drehen` ohne Gegensteuern auf eine feste Sink-Rate ein
     * (`-NATUR_NICKEN / 1.6`), die über eine mehrsekündige Flugbahn
     * spürbar Nase-runter dreht. Wer landen will, muss also aktiv
     * gegenhalten — ein einzelner kurzer Absprungwinkel reicht nicht mehr.
     */
    /*
     * **Gedeckelt, statt endlos zu beschleunigen.** Eine feste
     * Drehbeschleunigung ohne Deckel läuft über eine lange Flugbahn
     * (Mega-Kicker, ~1,6 s) zu einer riesigen Winkelabweichung auf —
     * nicht nur „man muss reagieren", sondern „die Abweichung wächst
     * schneller, als ein Mensch mit Reaktionszeit sie einholen kann",
     * siehe die Herleitung bei `NATUR_NICKEN_VERZOEGERUNG`. Ab
     * `NATUR_NICKEN_GRENZE` unter dem Absprungwinkel hört die Drift auf zu
     * wirken — das Rad pendelt sich (durch die Dämpfung darunter) auf
     * dieser Schräglage ein, statt endlos weiterzudrehen. Wer nichts tut,
     * landet also **verlässlich schräg genug für eine schlechte
     * Landung**, aber nicht in einer sich selbst verschärfenden Spirale,
     * die auch ein rechtzeitig reagierender Spieler nicht mehr einholen
     * könnte.
     */
    if (luftZeit > NATUR_NICKEN_VERZOEGERUNG && luftDrehStart - winkel < NATUR_NICKEN_GRENZE) {
      drehen -= NATUR_NICKEN * dt;
    }
    drehen -= drehen * 1.6 * dt;
    winkel += drehen * dt;

    const boden = bodenHoehe(g, x);
    if (y <= boden) {
      // --- Landung ---
      y = boden;
      const hang = bodenWinkel(g, x);
      const bewertung = landungBewerten(winkel - hang);
      letzteLandung = bewertung;

      /*
       * --- Tricks ---
       *
       * Ein eigener Punkte-Topf für volle Drehungen in der Luft, wie
       * `doppelPunkte` bei Dash City nie geleert. `winkel` ist beim
       * Fliegen unbeschränkt (siehe `winkelKuerzen`s Kommentar zu
       * Saltos) — die reine Differenz zum Absprungwinkel `luftDrehStart`
       * zählt die Umdrehungen deshalb exakt, ganz ohne eigene
       * Zählschleife während des Flugs. Nur ein Sturz zählt nicht: Wer
       * die Landung nicht steht, hat den Trick nicht „geschafft" —
       * dieselbe Regel wie beim Skaten oder Snowboarden.
       */
      const drehungGesamt = Math.abs(winkel - luftDrehStart);
      const flips = Math.floor(drehungGesamt / (Math.PI * 2));
      letzterTrick = bewertung === 'sturz' ? 0 : flips;
      if (bewertung !== 'sturz' && flips > 0) {
        trickPunkte += flips * TRICK_PUNKTE_JE_DREHUNG;
      }

      if (bewertung === 'sturz') {
        return {
          ...lauf,
          x,
          y,
          // Nicht hart auf null — ein Rest des Schwungs trägt das
          // Ausrutschen nach dem Sturz, siehe die Sturzuhr oben in `takt`.
          vx: vx * 0.35,
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
          trickPunkte,
          letzterTrick,
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
        trickPunkte,
        letzterTrick,
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
      trickPunkte,
      letzterTrick,
      luftDrehStart,
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
    trickPunkte,
    letzterTrick,
    luftDrehStart,
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
 * Ein Punkt je Meter, dazu Flugzeit, perfekte Landungen und Tricks — und
 * ein Zeitbonus nur, **wenn** man ins Ziel kommt. Ronni: „Score entsteht
 * aus Geschwindigkeit, Airtime, Distanz, Tricks, perfekte Landungen,
 * Flow." Ohne den Zielbonus wäre langsames, vorsichtiges Fahren die beste
 * Taktik — und das ist das Gegenteil des Spiels. `trickPunkte` steht
 * schon fertig in `lauf` (siehe „Tricks" in `takt`), hier wird nur
 * addiert.
 */
export function punkte(lauf: Lauf): number {
  const strecke = Math.floor(lauf.x);
  const luft = Math.floor(lauf.luftGesamt * 40);
  const landungen = lauf.perfekte * 60;
  const zielBonus = lauf.gewonnen ? Math.max(0, Math.floor(1600 - lauf.zeit * 12)) : 0;
  return strecke + luft + landungen + lauf.trickPunkte + zielBonus;
}

/** Die Saat einer Strecke. Gleiche Nummer = gleiche Strecke, überall. */
export function streckenSaat(nummer: number): number {
  return saatAus('radfahren', nummer);
}
