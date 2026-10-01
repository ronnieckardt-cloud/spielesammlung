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

/**
 * Mit welchem Tempo der Probefahrer anrollt (m/s). Mit Gas beschleunigt er auf
 * dem Weg zur Kuppe noch bis rund `TEMPO_MAX` — das ist, wo ein Spieler die
 * meiste Zeit tatsächlich fährt.
 */
const PROBE_TEMPO = 14;

/** Eine Münze: Mittelpunkt in Weltkoordinaten (`y` ist die Höhe über null). */
export type Muenze = { x: number; y: number };

/** Ein Boost-Streifen am Boden: wer drüberfährt, bekommt einen Schub. */
export type Pad = { x: number; laenge: number };

/**
 * Eine **Lücke**: eine Rampe, die an einer harten Kante endet, ein Graben, und
 * auf der anderen Seite ein Landehang.
 *
 * Anders als ein Kicker (eine glatte Glocke, auf der man irgendwo abhebt) ist
 * der Absprung hier **eine Stelle**: die Kante. Dort ist der Boden weg, jeder
 * hebt ab, und was danach passiert, entscheiden Tempo und Pop — wer zu kurz
 * kommt, prallt gegen die Wand der Gegenseite oder fällt in den Graben. Das
 * ist der Teil des Spiels, bei dem man den Absprung wirklich **steuert**.
 *
 * Alle Maße sind Meter. Höhen sind über dem übrigen Gelände gemessen, damit
 * die Lücke auf jeder Bodenwelle gleich aussieht.
 */
export type Luecke = {
  /** Wo die Rampe beginnt. */
  x0: number;
  /** Länge der Rampe; sie endet an der Kante. */
  rampe: number;
  /** Höhe der Kante. */
  hoehe: number;
  /** Breite des Grabens, von der Kante bis zur Gegenseite. */
  breite: number;
  /** Höhe der Gegenseite — niedriger (Abwärts), gleich (Eben) oder höher (Hinauf) als die Kante. */
  hZiel: number;
  /** Länge des Landehangs, der von der Gegenseite sanft zum Gelände abfällt. */
  hang: number;
};

export type Gelaende = {
  wellen: readonly Welle[];
  kicker: readonly Kicker[];
  /** Länge der Strecke in Metern; dahinter liegt die Ziellinie. */
  laenge: number;
  /**
   * Münzen und Boost-Streifen. Sie **ändern das Gelände nicht** und ziehen
   * keine Zufallszahl: Sie werden nach dem Bauen aus den Kickern abgeleitet
   * (siehe `inhaltBauen`). Dadurch bleibt jede Strecke mit ihrer Saat exakt
   * dieselbe wie vor der Überarbeitung — und alle Fairness-Prüfungen
   * gelten unverändert weiter.
   */
  muenzen: readonly Muenze[];
  pads: readonly Pad[];
  /**
   * Wo ein Fahrer mit gewöhnlichem Tempo über jeden Kicker abhebt. Die
   * Darstellung zeigt diese Stellen als leuchtende Marke — dort lohnt sich
   * der Pop.
   */
  absprung: readonly number[];
  /** Die Lücken. Ohne Lücken ist das Gelände eine reine Glockenlandschaft wie zuvor. */
  luecken: readonly Luecke[];
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

/** So lang ist das ebene Stück vor der Rampe: genug, um nach jeder Landung wieder Höchsttempo zu haben. */
const LUECKEN_ANLAUF = 28;
/** So lang bleibt es hinter dem Landehang ruhig, bevor der nächste Abschnitt beginnt. */
const LUECKEN_AUSLAUF = 14;
/** Länge des Landehangs hinter der Gegenseite. */
const LUECKEN_HANG = 7;
/**
 * Wie weit unter der Kante der Gegenseite (senkrecht) ein Fahrer **ohne** Pop
 * am Ende des Grabens ankommen muss — sonst käme bei Rückenwind und Boost auch
 * ohne Pop jemand hinüber. Und wie weit **darüber** einer mit dem schwächsten
 * gültigen Pop mindestens sein muss. Zusammen sind das die zwei Zusagen einer
 * Lücke: Ohne Pop schafft sie keiner, mit Pop schafft sie jeder.
 */
const LUECKE_MARGE_KURZ = 0.55;
const LUECKE_MARGE_DRUEBER = 0.55;

/** Die Höhe einer Flugbahn an einer Stelle, linear zwischen zwei Messpunkten; `null`, wenn die Bahn nicht so weit reicht. */
function bahnHoehe(bahn: readonly { x: number; y: number }[], x: number): number | null {
  for (let i = 1; i < bahn.length; i++) {
    const a = bahn[i - 1]!;
    const b = bahn[i]!;
    if (x >= a.x && x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1e-9, b.x - a.x);
  }
  return null;
}

/**
 * Fliegt probeweise auf die Rampe einer Lücke zu und gibt die Flugbahn ab der
 * Kante zurück. `tippVorKante` ist, wie viele Sekunden vor der Kante der Pop
 * angetippt wird; `null` heißt: gar nicht.
 *
 * Die Probefahrt benutzt **die echte Fahrphysik** (`taktKern`) und nicht eine
 * zweite Rechnung daneben — sonst wäre jede spätere Änderung an der Physik
 * ein stilles Auseinanderlaufen von Probe und Spiel. Der Graben ist dabei
 * absichtlich 60 m breit, damit die Bahn nirgends auf eine Gegenseite trifft;
 * wo die Gegenseite wirklich liegt, ergibt sich erst aus dieser Bahn.
 */
function lueckenFlug(
  basis: Gelaende,
  l: Luecke,
  tippVorKante: number | null,
): { x: number; y: number }[] {
  const probe: Gelaende = { ...basis, luecken: [{ ...l, breite: 60 }] };
  const start = l.x0 - LUECKEN_ANLAUF;
  let lauf: Lauf = { ...leererLauf(probe, 0), x: start, y: bodenHoehe(probe, start), vx: TEMPO_MAX };
  const kante = lueckeKante(l);
  const bahn: { x: number; y: number }[] = [];
  let tippRest = 0;
  for (let i = 0; i < 1200 && !lauf.vorbei; i++) {
    if (tippVorKante !== null && lauf.amBoden && tippRest === 0 && kante - lauf.x <= lauf.vx * tippVorKante) {
      tippRest = 5;
    }
    const hinten = tippRest > 0;
    if (hinten) tippRest--;
    lauf = taktKern(lauf, 1 / 60, { gas: true, bremse: false, lehnen: 0, hinten });
    if (!lauf.amBoden) bahn.push({ x: lauf.x, y: lauf.y });
    else if (bahn.length > 0) break;
  }
  return bahn;
}

/**
 * Baut eine Lücke mit der **kleinsten** Breite, bei der beide Zusagen halten:
 * Ohne Pop kommt man klar zu kurz, mit dem schwächsten gültigen Pop klar
 * hinüber. Beides wird an der echten Flugbahn gemessen, bei dem Tempo, das
 * man nach dem ebenen Anlauf immer hat (`TEMPO_MAX`).
 *
 * Gibt `null` zurück, wenn es für diese Rampe keine solche Breite gibt — der
 * Aufrufer baut dann stattdessen eine ruhige Strecke.
 */
function lueckeBauen(
  basis: Gelaende,
  x0: number,
  hoehe: number,
  zielArt: 'abwaerts' | 'eben' | 'hinauf',
): Luecke | null {
  // Die Rampe endet mit rund 0,48 Steigung: steil genug für einen echten
  // Absprung, flach genug, dass man sie auch aus dem Stand noch hochkommt
  // (`MAX_KICKER_STEIGUNG` liegt bei rund 0,47, die Grenze des Antriebs bei 0,61).
  const rampe = Math.max(4, (RAMPEN_POTENZ * hoehe) / 0.48);
  const hZiel = zielArt === 'abwaerts' ? Math.max(0.35, hoehe - 1.0) : zielArt === 'eben' ? hoehe * 0.9 : hoehe + 0.6;
  const roh: Luecke = { x0, rampe, hoehe, breite: 60, hZiel, hang: LUECKEN_HANG };
  const kante = lueckeKante(roh);
  const ohne = lueckenFlug(basis, roh, null);
  const schwach = lueckenFlug(basis, roh, POP_FENSTER * 0.93);
  for (let w = 5; w <= 24; w += 0.25) {
    const ende = kante + w;
    const oben = grundHoehe(basis, ende) + hZiel;
    const yOhne = bahnHoehe(ohne, ende);
    const ySchwach = bahnHoehe(schwach, ende);
    if (yOhne === null || ySchwach === null) continue;
    if (oben - yOhne >= LUECKE_MARGE_KURZ && ySchwach - oben >= LUECKE_MARGE_DRUEBER) return { ...roh, breite: w };
  }
  return null;
}

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
  const luecken: Luecke[] = [];
  /** Der Boden, auf dem eine Lücke später liegt — für die Probefahrten beim Bauen. */
  const probeBasis: Gelaende = { wellen, kicker: [], laenge, muenzen: [], pads: [], absprung: [], luecken: [] };
  let abschnitt = 0;
  /** War der vorige Abschnitt eine Lücke? Ein breiter Kicker braucht dann mehr Platz hinter ihr. */
  let nachLuecke = false;
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
    /*
     * **Lücken sind gesetzt, nicht nur gewürfelt.** Der zweite Abschnitt ist
     * immer eine, und im weiteren Verlauf sorgt eine Untergrenze dafür, dass
     * keine Strecke ohne bleibt: Wer die Lücke nicht springen muss, muss auch
     * den Absprung nicht steuern — genau das war der Fehler der Fassung davor
     * (mit reinem Dauergas kamen 24 von 40 Strecken ins Ziel).
     */
    const brauchtLuecke =
      abschnitt === 1 ||
      (luecken.length < 2 && anteil > 0.5) ||
      (luecken.length < 3 && anteil > 0.78);
    const art: 'ruhig' | 'doppel' | 'kicker' | 'mega' | 'luecke' = ersteRunde
      ? 'kicker'
      : brauchtLuecke
        ? 'luecke'
        : effektiveZone === 'flow'
          ? // Flow-Zone: viel Rollen und höchstens ein sanfter Doppel-Hubbel,
            // kaum Kicker-Ketten und nie ein Mega — Tempo halten, nicht fordern.
            wuerfel < 0.4
            ? 'ruhig'
            : wuerfel < 0.62
              ? 'doppel'
              : wuerfel < 0.8
                ? 'kicker'
                : 'luecke'
          : // Skill-Zone: dicht getaktete Sprünge, Ruhepausen sind selten.
            wuerfel < 0.05
            ? 'ruhig'
            : wuerfel < 0.18
              ? 'doppel'
              : wuerfel < 0.4
                ? 'mega'
                : wuerfel < 0.72
                  ? 'kicker'
                  : 'luecke';
    ersteRunde = false;
    abschnitt++;
    const warLuecke = nachLuecke;
    nachLuecke = art === 'luecke';

    if (art === 'luecke') {
      // Erst ein ebenes Stück, auf dem man wieder Höchsttempo erreicht, dann
      // die Rampe, der Graben und der Landehang, danach wieder Ruhe.
      x += LUECKEN_ANLAUF;
      const hoehe = 1.0 + naechste() * 0.5 + anteil * 0.4;
      const w = naechste();
      const zielArt = w < 0.4 ? 'abwaerts' : w < 0.75 ? 'eben' : 'hinauf';
      // Rampe, Graben und Landehang brauchen bis zu 40 m — und hinter der
      // Landung muss noch Platz bis zum Ziel sein. Wer die Ziellinie mitten im
      // Flug überquert, hätte die Lücke nie springen müssen.
      const l = x + 40 > laenge - 10 ? null : lueckeBauen(probeBasis, x, hoehe, zielArt);
      if (l) {
        luecken.push(l);
        x = lueckeEnde(l) + l.hang + LUECKEN_AUSLAUF;
      } else {
        // Keine passende Breite gefunden (sollte nicht vorkommen, wird
        // aber im Test über viele Saaten abgesichert): lieber eine ruhige
        // Strecke als eine Lücke, die nicht zu schaffen ist.
        x += 12;
      }
    } else if (art === 'ruhig') {
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
      // Die Flanke einer breiten Glocke reicht gut zwei Breiten weit: Direkt hinter
      // einer Lücke begänne sie mitten im Landehang.
      if (warLuecke) x += Math.max(0, 2.4 * breite - LUECKEN_AUSLAUF);
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

  const grund: Gelaende = { wellen, kicker, laenge, muenzen: [], pads: [], absprung: [], luecken };
  return { ...grund, ...inhaltBauen(grund) };
}

// ---------------------------------------------------------------
// Münzen und Boost-Streifen
// ---------------------------------------------------------------

/** Punkte je eingesammelter Münze. */
export const MUENZ_PUNKTE = 10;
/** Wie nah das Rad an eine Münze kommen muss (Meter, waagerecht und senkrecht). */
const MUENZ_REICHWEITE_X = 1.0;
const MUENZ_REICHWEITE_Y = 0.95;
/** Ab dieser Breite zählt ein Kicker als „groß" — davor liegt ein Boost-Streifen. */
const GROSS_AB_BREITE = MEGA_BREITE_MIN - 0.5;
/** Punkte für jeden mitgenommenen Boost-Streifen. */
export const PAD_PUNKTE = 15;
/** Der Schub eines Boost-Streifens in Meter je Sekunde. */
export const BOOST_SCHUB = 2.6;
/** Wie weit der Schub über das Höchsttempo hinausreichen darf. */
export const BOOST_UEBER_TEMPO = 2.2;
/** So lange zeigt die Darstellung den Boost an, in Sekunden. */
export const BOOST_ANZEIGE = 1.3;
/** Wie schnell die Zusatzgeschwindigkeit über dem Höchsttempo abklingt (1/s). */
const BOOST_ABKLINGEN = 1.5;

/**
 * Leitet Münzen und Boost-Streifen aus dem fertigen Gelände ab.
 *
 * **Die Münzen über einem Kicker liegen auf der echten Flugbahn.** Ein
 * Bogen aus ausgedachten Zahlen hätte meistens neben der Stelle gelegen, an
 * der man wirklich fliegt — und eine Münze, die man nie erreicht, ist
 * Dekoration, keine Anleitung. Deshalb fährt hier ein Fahrer mit
 * gewöhnlichem Tempo probeweise über jeden Kicker, und die Münzen kommen
 * dorthin, wo er in der Luft war. Wer schneller oder langsamer anfliegt,
 * verpasst ein paar davon; wer die Linie trifft, nimmt alle mit. Das ist die
 * Belohnung für sauberes Tempo-Gefühl, ohne dass ein Wort dazu nötig wäre.
 *
 * Auf langen ebenen Stücken liegt außerdem eine Reihe Münzen am Boden — die
 * Belohnung fürs Durchrollen. Vor jedem **großen** Kicker liegt ein
 * Boost-Streifen: Der Schub bleibt klein, aber er macht den großen Sprung
 * noch ein Stück weiter. Bei kleinen Kickern gibt es keinen, weil dort die
 * Lücke zum nächsten Boden auf das Höchsttempo zugeschnitten ist.
 */
function inhaltBauen(g: Gelaende): { muenzen: Muenze[]; pads: Pad[]; absprung: number[] } {
  const muenzen: Muenze[] = [];
  const pads: Pad[] = [];
  const absprung: number[] = [];
  const sortiert = [...g.kicker].sort((a, b) => a.x - b.x);
  /** Ab hier ist der Boden nach dem letzten Kicker wieder ruhig. */
  let freiAb = ANLAUF + 4;

  for (const k of sortiert) {
    const anfahrt = k.x - k.breite * 2.1;
    const luecke = anfahrt - freiAb;

    // Eine Reihe am Boden in langen ebenen Stücken.
    if (luecke >= 14) {
      const mitte = freiAb + luecke * 0.38;
      for (let i = 0; i < 5; i++) {
        const x = mitte - 3.2 + i * 1.6;
        muenzen.push({ x, y: bodenHoehe(g, x) + 0.95 });
      }
    }
    if (k.breite >= GROSS_AB_BREITE && luecke >= 12) {
      pads.push({ x: anfahrt - 7.5, laenge: 3.5 });
    } else if (luecke >= 28) {
      // In einer langen Rollstrecke **weit** vor dem nächsten Sprung: Der
      // Schub ist bis dahin längst abgeklungen (er halbiert sich in gut
      // einer halben Sekunde), verlängert also keinen Sprung, dessen Landezone
      // auf das Höchsttempo zugeschnitten ist — er ist Tempo-Gefühl und
      // Punkte, kein Risiko.
      pads.push({ x: freiAb + luecke * 0.3, laenge: 3.5 });
    }

    // Der Bogen über dem Kicker — auf der Flugbahn eines Probefahrers.
    const bahn = flugBahn(g, k, PROBE_TEMPO);
    if (bahn.length > 0) absprung.push(bahn[0]!.x);
    let weg = 0;
    let naechste = 0.7;
    let gesetzt = 0;
    for (let i = 1; i < bahn.length - 2 && gesetzt < 8; i++) {
      weg += Math.hypot(bahn[i]!.x - bahn[i - 1]!.x, bahn[i]!.y - bahn[i - 1]!.y);
      if (weg >= naechste) {
        // Der Bezugspunkt des Fahrers liegt eine Handbreit über dem Rad.
        muenzen.push({ x: bahn[i]!.x + 0.1, y: bahn[i]!.y + 0.75 });
        naechste += 1.7;
        gesetzt++;
      }
    }
    freiAb = Math.max(freiAb, k.x + k.breite * 2.1);
  }

  /*
   * --- Lücken ---
   *
   * Erst alles wegnehmen, was die Kicker-Schleife in den Bereich einer Lücke
   * gelegt hat (sie kennt die Lücken nicht, eine Münzreihe quer über einen
   * Graben wäre Unsinn), und **keinen Boost-Streifen vor einer Lücke**: Er
   * machte den Pop überflüssig, und die Lücke ist genau dafür da. Dann die
   * Marke an der Kante und ein Münzbogen auf der Linie eines vollen Pops —
   * wer ihn trifft, sieht, wie der Sprung gemeint ist.
   */
  let sichtbareMuenzen = muenzen;
  let sichtbarePads = pads;
  const bogen: Muenze[] = [];
  for (const l of g.luecken) {
    const von = l.x0 - 4;
    const bis = lueckeEnde(l) + l.hang + 2;
    sichtbareMuenzen = sichtbareMuenzen.filter((m) => m.x < von || m.x > bis);
    sichtbarePads = sichtbarePads.filter((p) => !(p.x + p.laenge > l.x0 - 45 && p.x < bis));
    absprung.push(lueckeKante(l));
    // Wer gelandet ist, bekommt im Auslauf einen Schub — Tempo-Gefühl und Punkte,
    // kein Risiko: Bis zum nächsten Sprung ist er abgeklungen (siehe oben).
    // Nur, wenn danach nicht gleich ein Kicker kommt: Die Kicker-Ketten sind auf
    // Höchsttempo zugeschnitten, ein Schub kurz davor wäre zu viel.
    const padEnde = bis + 4.5;
    // Gemessen an der ganzen Glocke (±3 Breiten), nicht an der Anfahrt: Die Flanke
    // eines breiten Kickers reicht weit, und ein Streifen mitten darin läge schief.
    const kickerNah = g.kicker.some((k) => k.x - 3 * k.breite < padEnde + 25 && k.x + 3 * k.breite > bis + 1);
    if (padEnde < g.laenge - 10 && !kickerNah) sichtbarePads = [...sichtbarePads, { x: bis + 1, laenge: 3.5 }];
    const bahn = lueckenFlug(g, l, 0.1);
    let weg = 0;
    let naechste = 1.2;
    for (let i = 1; i < bahn.length && bahn[i]!.x < lueckeEnde(l) + 3; i++) {
      // Die Probebahn kennt die echte Gegenseite nicht (der Graben ist dort 60 m
      // breit) — sobald sie auf deren Höhe heruntergekommen ist, ist der Bogen zu Ende.
      if (bahn[i]!.x > lueckeEnde(l) && bahn[i]!.y < bodenHoehe(g, bahn[i]!.x) + 0.4) break;
      weg += Math.hypot(bahn[i]!.x - bahn[i - 1]!.x, bahn[i]!.y - bahn[i - 1]!.y);
      if (weg >= naechste) {
        bogen.push({ x: bahn[i]!.x + 0.1, y: bahn[i]!.y + 0.75 });
        naechste += 1.7;
      }
    }
  }
  absprung.sort((a, b) => a - b);

  return {
    muenzen: [...sichtbareMuenzen, ...bogen]
      .filter((m) => m.x > ANLAUF + 3 && m.x < g.laenge - 6)
      .sort((a, b) => a.x - b.x),
    pads: sichtbarePads,
    absprung,
  };
}

/**
 * Die Flugbahn eines Probefahrers über einen Kicker — der **längste**
 * Abschnitt in der Luft. Kurze Hüpfer auf der Anfahrt (siehe
 * `LANDUNG_MIN_LUFT`) gehören nicht dazu.
 */
function flugBahn(g: Gelaende, k: Kicker, tempo: number): { x: number; y: number }[] {
  let l = leererLauf(g, 0);
  l = { ...l, x: k.x - k.breite * 3.2, vx: tempo, y: bodenHoehe(g, k.x - k.breite * 3.2) };
  let aktuell: { x: number; y: number }[] = [];
  let beste: { x: number; y: number }[] = [];
  for (let i = 0; i < 400; i++) {
    l = taktKern(l, 1 / 60, { gas: true, bremse: false, lehnen: 0 });
    if (!l.amBoden) {
      aktuell.push({ x: l.x, y: l.y });
    } else {
      if (aktuell.length > beste.length) beste = aktuell;
      // Nach dem ersten richtigen Sprung ist die Probefahrt zu Ende.
      if (beste.length >= LANDUNG_MIN_LUFT * 60 * 1.5) break;
      aktuell = [];
    }
    if (l.vorbei) break;
  }
  if (aktuell.length > beste.length) beste = aktuell;
  return beste;
}

// ---------------------------------------------------------------
// Lücken im Gelände
// ---------------------------------------------------------------

/** So tief liegt der Boden eines Grabens (absolut, Meter) — tief genug, dass man es als Abgrund liest. */
export const GRABEN_BODEN = -7;
/**
 * Wie die Rampe ansteigt: `t^p` mit `t` von 0 bis 1. Ein Wert über 1 heißt, sie
 * beginnt flach und wird zur Kante hin steiler — der Anstieg ist also kein
 * Knick im Boden, sondern ein Anlauf, und das Rad legt sich weich hinein.
 */
const RAMPEN_POTENZ = 1.8;
/** Punkte für jede geschaffte Lücke. */
export const LUECKEN_PUNKTE = 60;

export const lueckeKante = (l: Luecke) => l.x0 + l.rampe;
export const lueckeEnde = (l: Luecke) => l.x0 + l.rampe + l.breite;

/** Die Lücke, deren Graben an dieser Stelle liegt — sonst nichts. */
export function lueckeBei(g: Gelaende, x: number): Luecke | undefined {
  for (const l of g.luecken) if (x > lueckeKante(l) && x < lueckeEnde(l)) return l;
  return undefined;
}

/**
 * Die Höhe des Geländes **ohne** Lücken: Wellen und Kicker. Die Lücken legen
 * sich in `bodenHoehe` darüber; die Probefahrten beim Bauen brauchen den
 * Boden, auf dem die Lücke später liegt.
 */
function grundHoehe(g: Gelaende, x: number): number {
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
 * Die Bodenhöhe an einer Stelle.
 *
 * Vor `ANLAUF` bewusst genau flach (0), damit der Start immer gleich und
 * ruhig ist. Der Übergang danach wird über `einblenden` weich
 * hochgezogen — ohne das stünde am Ende der Startgeraden eine Stufe.
 *
 * **Im Graben einer Lücke ist der Boden `GRABEN_BODEN`** — und dort springt
 * die Höhe an der Kante absichtlich, statt weich auszulaufen: Eine Kante ist
 * eine Kante. Wer sie überquert, hebt ab (siehe `takt`), niemand rollt je
 * über diese Stelle.
 */
export function bodenHoehe(g: Gelaende, x: number): number {
  let h = grundHoehe(g, x);
  for (const l of g.luecken) {
    const kante = lueckeKante(l);
    const ende = lueckeEnde(l);
    if (x > kante && x < ende) return GRABEN_BODEN;
    if (x >= l.x0 && x <= kante) {
      h += l.hoehe * Math.pow((x - l.x0) / l.rampe, RAMPEN_POTENZ);
    } else if (x >= ende && x < ende + l.hang) {
      const u = (x - ende) / l.hang;
      h += l.hZiel * (1 - u * u * (3 - 2 * u));
    }
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
 * ein zufälliger Absprung. Alle Bausteine (Sinus, Gauß-Glocke, Rampe,
 * Landehang) haben eine bekannte Ableitung, also nehmen wir die.
 */
export function bodenSteigung(g: Gelaende, x: number): number {
  let s = grundSteigung(g, x);
  for (const l of g.luecken) {
    const kante = lueckeKante(l);
    const ende = lueckeEnde(l);
    if (x > kante && x < ende) return 0;
    if (x >= l.x0 && x <= kante) {
      s += (l.hoehe * RAMPEN_POTENZ * Math.pow((x - l.x0) / l.rampe, RAMPEN_POTENZ - 1)) / l.rampe;
    } else if (x >= ende && x < ende + l.hang) {
      const u = (x - ende) / l.hang;
      s += (-l.hZiel * 6 * u * (1 - u)) / l.hang;
    }
  }
  return s;
}

function grundSteigung(g: Gelaende, x: number): number {
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
 * 100°. `10` reichte für spürbar schnelles Kippen, ohne die Regelstrecke
 * unnötig zu verschärfen.
 *
 * **Noch einmal auf 9 gesenkt, als `FlowMtb.tsx` eine Rampe für `lehnen`
 * bekam** (siehe dort): Tasten/Knöpfe springen seitdem nicht mehr
 * schlagartig auf −1/0/1, sondern nähern sich dem Ziel über rund 100 ms
 * an. Das macht Steuern spürbar weicher, kostet aber ein Stück
 * Reaktionsgeschwindigkeit — ein realistischer Spieler-Bot (binäre
 * Entscheidung **plus** dieselbe Rampe) kam bei `10` seltener durch als
 * vorher ohne Rampe. `9` gleicht das aus, ohne die „dreht das Rad in der
 * Luft, wenn man lehnt"-Garantie zu verlieren (die braucht nur
 * `LUFT_DREHUNG > NATUR_NICKEN`, siehe `NATUR_NICKEN`).
 */
export const LUFT_DREHUNG = 9;
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
 * Tests ziehen in entgegengesetzte Richtungen: reines Gasgeben darf nur
 * auf einer Minderheit der 10 Strecken ins Ziel kommen (`kommt mit reinem
 * Gasgeben nicht zuverlässig ins Ziel`), aber ein einfacher **aktiver**
 * Bot muss weiterhin alle 10 schaffen (Fairness). Kleine Werte (2–5)
 * drehen die Nase zwar spürbar, aber zufällig fast immer in dieselbe
 * Richtung, in die ein Kicker-Absprung ohnehin zur Landung hin rotiert —
 * reines Gas gewann damit trotzdem 9–10 von 10 Strecken. Ab etwa 7 kippt
 * das Verhältnis um.
 *
 * **Von 8 auf 7 gesenkt**, im selben Zug wie `LUFT_DREHUNG` (siehe dort):
 * Die neue Lehnen-Rampe in `FlowMtb.tsx` macht Gegenlenken spürbar
 * weicher, aber auch minimal langsamer — ein realistischer Bot mit
 * derselben Rampe kam bei den alten Werten seltener durch. `7` behielt
 * die Mehrheit-scheitert-Anforderung (passiv 5/10) und brachte den
 * realistischen Bot zurück auf ein gutes Niveau, ohne die Fairness-
 * Garantie (aktiver Bot 10/10) zu gefährden — **allein betrachtet**.
 *
 * **Auf 7,5 nachjustiert beim Zusammenführen mit der fünften
 * Geländefassung** (Flow-/Skill-Zonen, siehe dort): Jeder der beiden
 * Branches war für sich genommen validiert, aber kombiniert stieg
 * „reines Gasgeben" wieder auf 6 von 10 Strecken — die neuen, großzügig
 * geschnittenen Flow-Zonen sind für den 7er-Wert etwas zu nachsichtig.
 * `7,5` bringt passiv zurück auf 5/10 (Mehrheit scheitert), ohne den
 * realistischen Bot spürbar zu verschlechtern. **Lehrstück Nummer zwei
 * zum selben Thema wie oben:** Zwei unabhängig validierte Änderungen an
 * physisch benachbarten Stellschrauben (Steuerungsgefühl und
 * Streckenrhythmus) können sich gegenseitig verschieben — nach jedem
 * Zusammenführen erneut mit dem realistischen Bot prüfen, nicht nur mit
 * den bestehenden Tests.
 */
export const NATUR_NICKEN = 7.5;
/**
 * So lange nach dem Abheben wirkt `NATUR_NICKEN` noch **nicht** — reine
 * Reaktionszeit für den Menschen am anderen Ende der Steuerung.
 *
 * Ohne diese Verzögerung ist die Anforderung „Gegenlenken muss nötig
 * sein" zwar erfüllt, aber nur für einen Bot, der jedes Bild neu plant.
 * Ein echter Spieler entscheidet sich binär (Taste oder Knopf, an oder
 * aus — siehe `FlowMtb.tsx`) und braucht eine echte, spürbare
 * Reaktionszeit, bevor die erste Korrektur überhaupt beim Rad ankommt.
 * (Seit der dortigen Lehnen-Rampe kommt `lehnen` bei `takt` selbst zwar
 * als weich ansteigender Analogwert an, nicht mehr als Sprung — das
 * ändert an dieser Reaktionszeit aber nichts, die Entscheidung „welche
 * Richtung" bleibt binär und bleibt verzögert.) Bei kurzen
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
 * Kürzeste Flugzeit, die als **Sprung** zählt, in Sekunden.
 *
 * Auf der Anfahrtsseite eines Kickers hebt das Rad bei hohem Tempo für
 * ein, zwei Bilder ab und setzt sofort wieder auf — die Abhebe-Bedingung
 * (siehe `takt`) ist dort schon erfüllt, die Bahn des Rades liegt aber noch
 * knapp unter der des Bodens. Jedes dieser Hüpferchen zählte vorher als
 * „perfekte Landung": Der Flow-Zähler schoss binnen Sekunden auf Anschlag,
 * jede Landung gab 60 Punkte, das Handy vibrierte im Bildtakt — ohne dass
 * jemand einen Sprung gemacht hätte. Ein Aufsetzen nach weniger als dieser
 * Zeit ist jetzt nur ein Bodenkontakt, keine Landung.
 */
export const LANDUNG_MIN_LUFT = 0.08;

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

/**
 * **Der Pop** — der Absprung-Kick, die Fähigkeit, die zu jedem Kicker gehört.
 *
 * Wer „Hinten" **frisch** antippt, kurz bevor das Rad abhebt (oder in den
 * ersten Augenblicken danach), zieht das Rad hoch und bekommt zusätzlichen
 * Schwung nach oben: höher, länger in der Luft, mehr Zeit für einen Salto.
 * Frisch heißt: Wer „Hinten" schon lange festhält, bekommt nichts — sonst
 * wäre der Pop ein Dauerzustand ohne Können. Die Marken am Boden (siehe
 * `Gelaende.absprung`) zeigen, wo die Kante liegt.
 *
 * Er ist freiwillig: Ein Fahrer, der nie poppt, fährt exakt wie zuvor. Genau
 * deshalb ändert er an der Fairness der Strecken nichts — er kommt obendrauf.
 */
export const POP_FENSTER = 0.3;
/** So kurz nach dem Abheben zählt ein frischer Druck noch als Pop. */
export const POP_NACH = 0.15;
/** Zusätzliche Aufwärtsgeschwindigkeit in m/s. */
export const POP_SCHUB = 2.6;
/** Punkte je gelungenem Pop. */
export const POP_PUNKTE = 30;
/** Ein Pop in dieser Zeit vor der Kante (Sekunden) hat die volle Stärke. */
export const POP_VOLL = 0.2;

/**
 * Wie kräftig ein Pop ist, je nachdem, wie lange vor der Kante er kam
 * (`druck` = Sekunden seit dem frischen Antippen).
 *
 * Wer kurz vor der Kante antippt, bekommt alles; wer am Anfang des Fensters
 * antippt, bekommt noch drei Viertel. Das ist Timing, das sich lohnt, ohne
 * dass ein knapp danebengelegener Druck gar nichts bringt — ein Kind tippt
 * nicht auf die Hundertstelsekunde. Die Lücken sind so gebaut, dass auch der
 * schwächste gültige Pop noch hinüberträgt (siehe `lueckeBauen`).
 */
export function popStaerke(druck: number): number {
  if (druck <= POP_VOLL) return 1;
  return Math.max(0.75, 1 - ((druck - POP_VOLL) / (POP_FENSTER - POP_VOLL)) * 0.25);
}

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
  /** Nummern der schon eingesammelten Münzen in `gelaende.muenzen`. */
  geholt: ReadonlySet<number>;
  muenzenZahl: number;
  /** Nummern der schon befahrenen Boost-Streifen. */
  padsGenommen: ReadonlySet<number>;
  /** Sekunden, die der Boost noch angezeigt wird. */
  boost: number;
  /**
   * Wie weit das Tempo gerade über `TEMPO_MAX` liegen darf. Springt bei einem
   * Boost-Streifen hoch und klingt weich ab — eine harte Kappe bei
   * `TEMPO_MAX` risse das Tempo nach dem Schub schlagartig herunter.
   */
  ueberTempo: number;
  /**
   * Sekunden, seit „Hinten" zuletzt frisch angetippt wurde (auch wenn es
   * schon wieder losgelassen ist); −1, wenn das länger als eine Sekunde her
   * ist. Daran hängt der **Pop**: Wer genau an der Kante antippt, bekommt
   * einen Extra-Schub nach oben (siehe `POP_SCHUB`).
   */
  druck: number;
  /** War „Hinten" im vorigen Bild gedrückt? Daran erkennt man den Beginn eines Drucks. */
  hintenGedrueckt: boolean;
  /** Wie oft der Pop geklappt hat — für Punkte und Missionen. */
  popZahl: number;
  /** Sekunden, die der Pop noch angezeigt wird. */
  popRest: number;
  /** Im laufenden Sprung schon ein Pop gewertet? Verhindert doppelte Wertung. */
  popGenommen: boolean;
  /** Wo der letzte Pop stattfand (Weltkoordinate) — für den Ring in der Darstellung. */
  popX: number;
  /** Alle geschafften Drehungen (Saltos) dieser Fahrt. */
  saltos: number;
  /** Wie viele Lücken diese Fahrt schon hinter sich hat. */
  lueckenZahl: number;
  /** Höchstes Tempo dieser Fahrt in km/h. */
  tempoSpitze: number;
  missionen: readonly Mission[];
  missionZahl: number;
  missionPunkte: number;
  /** Die zuletzt geschaffte Mission — für die Anzeige. */
  letzteMission: Mission | null;
  /** Welche Umgebung (0 bis 3) — rein optisch, siehe `biomVon`. */
  biom: number;
  saat: number;
};

/** Die Eingaben eines Bildes. Alles, was der Spieler beeinflussen kann. */
export type Eingabe = {
  gas: boolean;
  bremse: boolean;
  /** −1 = Gewicht nach hinten, +1 = nach vorne, 0 = nichts. */
  lehnen: number;
  /**
   * Ob „Hinten" gerade gedrückt ist — **roh**, ohne die weiche Rampe von
   * `lehnen`. Der Pop hängt daran, nicht an `lehnen`: Ein kurzes Antippen
   * (60 bis 100 ms) kommt mit der Rampe von 0,1 s Dauer nie über −0,5 und
   * würde sonst gar nicht zählen. Fehlt der Wert (Tests, Bots), gilt
   * `lehnen < −0,5`.
   */
  hinten?: boolean;
  /**
   * Ein **frischer** Absprung in diesem Bild — der Wisch nach oben oder die Taste
   * „hoch", beides ohne zu lehnen. Er zählt als Pop-Druck, ganz gleich, ob
   * „Hinten" gerade gehalten wird: Wer mit dem linken Daumen lehnt und mit dem
   * rechten nach oben wischt, hat `hinten` schon seit Sekunden an, und ein
   * Vergleich „war es vorher nicht gedrückt?" würde den Wisch verschlucken.
   */
  pop?: boolean;
};

export const KEINE_EINGABE: Eingabe = { gas: false, bremse: false, lehnen: 0 };

/** Ein Lauf am Start, ohne Missionen — die Grundlage für `neuesSpiel` und die Probefahrten. */
function leererLauf(gelaende: Gelaende, saat: number): Lauf {
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
    geholt: new Set(),
    muenzenZahl: 0,
    padsGenommen: new Set(),
    boost: 0,
    ueberTempo: 0,
    druck: -1,
    hintenGedrueckt: false,
    popZahl: 0,
    popRest: 0,
    popGenommen: false,
    popX: 0,
    saltos: 0,
    lueckenZahl: 0,
    tempoSpitze: 0,
    missionen: [],
    missionZahl: 0,
    missionPunkte: 0,
    letzteMission: null,
    biom: biomVon(saat),
    saat,
  };
}

export function neuesSpiel(saat: number, laenge = STRECKE_LAENGE): Lauf {
  const lauf = leererLauf(gelaendeBauen(saat, laenge), saat);
  // Drei verschiedene Aufgaben zum Start.
  const arten: Missionsart[] = [];
  const missionen: Mission[] = [];
  for (let i = 0; i < 3; i++) {
    const m = neueMission(lauf, i, arten);
    arten.push(m.art);
    missionen.push(m);
  }
  return { ...lauf, missionen };
}

/**
 * Welche Umgebung diese Strecke bekommt, 0 bis 3 (Wiese, Abendrot, Nacht,
 * Herbst). **Rein optisch** — die Physik kennt sie nicht. Sie hängt allein an
 * der Saat, also sieht dieselbe Strecke überall gleich aus.
 */
export function biomVon(saat: number): number {
  return Math.min(3, Math.floor(schritt(saat ^ 0x5bd1e995).wert * 4));
}

// ---------------------------------------------------------------
// Missionen
// ---------------------------------------------------------------

export type Missionsart = 'muenzen' | 'perfekt' | 'salto' | 'tempo' | 'luft' | 'pop' | 'luecke';

/** `start` ist der Zählerstand beim Beginn der Mission, damit sie nur zählt, was danach passiert. */
export type Mission = { art: Missionsart; ziel: number; start: number };

const MISSIONS_ARTEN: readonly Missionsart[] = ['muenzen', 'perfekt', 'salto', 'tempo', 'luft', 'pop', 'luecke'];
/**
 * Zielwerte der ersten Aufgabe jeder Art und ihr Zuwachs je weiteren drei
 * geschafften Aufgaben. Gemessen am einfachen Bot aus den Fairness-Tests (der
 * schafft die Strecke, fährt aber ohne Absicht): Er soll in einer Fahrt etwa
 * drei bis vier Aufgaben erledigen — mehr hieße, dass sie sich von selbst
 * erledigen und keine Ziele mehr sind.
 */
const MISSION_BASIS: Record<Missionsart, number> = {
  muenzen: 34,
  perfekt: 5,
  salto: 2,
  tempo: 58,
  luft: 8,
  pop: 4,
  luecke: 2,
};
const MISSION_SCHRITT: Record<Missionsart, number> = {
  muenzen: 12,
  perfekt: 1,
  salto: 1,
  tempo: 2,
  luft: 3,
  pop: 1,
  luecke: 1,
};
export const MISSION_NAMEN: Record<Missionsart, (ziel: number) => string> = {
  muenzen: (z) => `Sammle ${z} Münzen`,
  perfekt: (z) => `Lande ${z}× perfekt`,
  salto: (z) => `Springe ${z} Saltos`,
  tempo: (z) => `Fahre ${z} km/h`,
  luft: (z) => `Fliege ${z} s in der Luft`,
  pop: (z) => `Pop ${z}× an der Kante`,
  luecke: (z) => (z === 1 ? 'Springe über 1 Lücke' : `Springe über ${z} Lücken`),
};

/** Bonuspunkte für die n-te geschaffte Mission — wächst langsam. */
export function missionsLohn(n: number): number {
  return 100 + 40 * Math.floor(n / 3);
}

/** Wie weit eine Mission ist, in Einheiten ihres Ziels (kann über `ziel` liegen). */
export function missionFortschritt(l: Lauf, m: Mission): number {
  switch (m.art) {
    case 'muenzen':
      return l.muenzenZahl - m.start;
    case 'perfekt':
      return l.perfekte - m.start;
    case 'salto':
      return l.saltos - m.start;
    case 'luft':
      return l.luftGesamt - m.start;
    case 'pop':
      return l.popZahl - m.start;
    case 'luecke':
      return l.lueckenZahl - m.start;
    case 'tempo':
      return l.tempoSpitze;
  }
}

/**
 * Eine neue Aufgabe. Aus Saat und Zähler gewürfelt, nie aus der Uhr — dieselbe
 * Strecke mit derselben Fahrt ergibt dieselben Aufgaben. Die Tempo-Aufgabe
 * liegt immer **über** dem bisherigen Spitzentempo und wird gar nicht mehr
 * angeboten, wenn die Spitze schon nah am Höchsttempo liegt.
 */
export function neueMission(l: Lauf, index: number, belegt: readonly Missionsart[]): Mission {
  const spitzenGrenze = TEMPO_MAX * 3.6 - 4;
  const frei = MISSIONS_ARTEN.filter(
    (a) => !belegt.includes(a) && !(a === 'tempo' && l.tempoSpitze >= spitzenGrenze),
  );
  const e = schritt(saatAus(l.saat, 'mission', l.missionZahl, index));
  const art = frei[Math.floor(e.wert * frei.length)]!;
  const stufe = Math.floor(l.missionZahl / 3);
  let ziel = MISSION_BASIS[art] + MISSION_SCHRITT[art] * stufe;
  if (art === 'tempo') ziel = Math.min(Math.floor(spitzenGrenze + 2), Math.max(ziel, Math.ceil(l.tempoSpitze) + 4));
  const start =
    art === 'muenzen'
      ? l.muenzenZahl
      : art === 'perfekt'
        ? l.perfekte
        : art === 'salto'
          ? l.saltos
          : art === 'luft'
            ? l.luftGesamt
            : art === 'pop'
              ? l.popZahl
              : art === 'luecke'
                ? l.lueckenZahl
                : 0;
  return { art, ziel, start };
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
  const neu = taktKern(lauf, dt, e);
  // Ein beendeter Lauf sammelt nichts mehr ein.
  if (lauf.vorbei) return neu;
  return inhaltAnwenden(neu, dt);
}

/**
 * Was nach der eigentlichen Fahrphysik passiert: Münzen aufsammeln,
 * Boost-Streifen mitnehmen, Zähler fortschreiben, Missionen prüfen.
 *
 * **Bewusst getrennt von `taktKern`.** Die Fahrphysik hat mehrere Rückgabe-
 * stellen (Landung, Sturz, Ziel, Normalfall), und an jeder einzeln die neuen
 * Dinge nachzutragen, hieße vier Stellen, an denen eine vergessen werden
 * kann. So sieht diese Funktion immer das fertige Ergebnis eines Schrittes.
 * Außerdem können die Probefahrten bei der Münzplatzierung (`flugBahn`) den
 * Kern ohne diesen Teil benutzen.
 */
function inhaltAnwenden(neu: Lauf, dt: number): Lauf {
  let l = neu;
  const mx = l.x + 0.1;
  const my = l.y + 0.75;

  // --- Münzen ---
  let geholt = l.geholt;
  let zahl = l.muenzenZahl;
  const m = l.gelaende.muenzen;
  // Die Münzen sind nach x geordnet genug, um früh abzubrechen; trotzdem
  // linear: bei ein paar Hundert Münzen kostet das nichts.
  for (let i = 0; i < m.length; i++) {
    const c = m[i]!;
    if (c.x < mx - MUENZ_REICHWEITE_X - 0.5) continue;
    if (c.x > mx + MUENZ_REICHWEITE_X + 0.5) break;
    if (geholt.has(i)) continue;
    if (Math.abs(c.x - mx) < MUENZ_REICHWEITE_X && Math.abs(c.y - my) < MUENZ_REICHWEITE_Y) {
      if (geholt === l.geholt) geholt = new Set(l.geholt);
      (geholt as Set<number>).add(i);
      zahl += 1;
    }
  }

  // --- Boost-Streifen (nur am Boden) ---
  let vx = l.vx;
  let ueberTempo = l.ueberTempo;
  let boost = l.boost;
  let padsGenommen = l.padsGenommen;
  if (l.amBoden) {
    const pads = l.gelaende.pads;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i]!;
      if (padsGenommen.has(i)) continue;
      if (l.x >= p.x && l.x <= p.x + p.laenge) {
        padsGenommen = new Set(padsGenommen).add(i);
        ueberTempo = BOOST_UEBER_TEMPO;
        vx = Math.min(TEMPO_MAX + BOOST_UEBER_TEMPO, vx + BOOST_SCHUB);
        boost = BOOST_ANZEIGE;
      }
    }
  }
  boost = Math.max(0, boost - dt);

  // --- Zähler ---
  const tempoSpitze = Math.max(l.tempoSpitze, vx * 3.6);

  l = {
    ...l,
    geholt,
    muenzenZahl: zahl,
    vx,
    ueberTempo,
    boost,
    padsGenommen,
    tempoSpitze,
  };

  // --- Missionen ---
  let missionPunkte = l.missionPunkte;
  let missionZahl = l.missionZahl;
  let letzteMission = l.letzteMission;
  const missionen = [...l.missionen];
  for (let i = 0; i < missionen.length; i++) {
    const mi = missionen[i]!;
    if (missionFortschritt(l, mi) >= mi.ziel) {
      missionPunkte += missionsLohn(missionZahl);
      letzteMission = mi;
      missionZahl += 1;
      const andere = missionen.filter((_, k) => k !== i).map((x) => x.art);
      missionen[i] = neueMission({ ...l, missionZahl }, i, andere);
    }
  }
  if (missionZahl !== l.missionZahl) {
    l = { ...l, missionen, missionZahl, missionPunkte, letzteMission };
  }
  return l;
}

function taktKern(lauf: Lauf, dt: number, e: Eingabe = KEINE_EINGABE): Lauf {
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
    if (!lauf.gewonnen && (lauf.vx !== 0 || lauf.vy !== 0)) {
      const x = lauf.x + lauf.vx * dt;
      const vx = lauf.vx - lauf.vx * 3.2 * dt;
      const boden = bodenHoehe(lauf.gelaende, x);
      /*
       * Wer in einen Graben gestürzt ist, **fällt** noch — sonst sprang das Rad
       * im Moment des Sturzes auf den Grund, und man sähe es nicht fallen.
       * Auf dem Boden bleibt es wie vorher: das Rad rutscht an der Geländelinie
       * entlang aus.
       */
      let y = lauf.y;
      let vy = lauf.vy;
      if (y - boden > 0.05 || vy > 0) {
        vy -= SCHWERKRAFT * dt;
        y += vy * dt;
        if (y <= boden) {
          y = boden;
          vy = 0;
        }
      } else {
        y = boden;
        vy = 0;
      }
      return {
        ...lauf,
        x,
        y,
        vy,
        vx: Math.abs(vx) < 0.05 ? 0 : vx,
        sturzZeit: lauf.sturzZeit + dt,
      };
    }
    return { ...lauf, sturzZeit: lauf.sturzZeit + dt };
  }

  const g = lauf.gelaende;
  let { x, y, vx, vy, winkel, drehen, amBoden, luftZeit, flow } = lauf;

  // „Hinten" frisch gedrückt? Wer es schon festhält, hat keinen frischen Druck.
  /*
   * **`druck` zählt die Zeit seit dem letzten frischen Antippen — auch wenn
   * der Finger schon wieder oben ist.** Zuerst hing der Pop daran, dass
   * „Hinten" im Moment des Abhebens noch gedrückt war: Wer kurz antippt und
   * loslässt (das Natürlichste an einer Kante), bekam gar nichts. Jetzt
   * zählt der Zeitpunkt des Drückens. „Frisch" ergibt sich von selbst:
   * Wer die Taste lange gehalten hat, dessen Druck liegt weiter zurück als
   * `POP_FENSTER`.
   */
  const hinten = e.hinten ?? e.lehnen < -0.5;
  let druck = lauf.druck;
  if (e.pop === true || (hinten && !lauf.hintenGedrueckt)) druck = 0;
  else if (druck >= 0) druck = druck + dt > 1 ? -1 : druck + dt;
  let popZahl = lauf.popZahl;
  const popRest0 = Math.max(0, lauf.popRest - dt);
  let popRest = popRest0;
  let popGenommen = lauf.popGenommen;
  let popX = lauf.popX;
  let lueckenZahl = lauf.lueckenZahl;
  // Die Zusatzgeschwindigkeit des Boosts klingt weich ab (siehe `Lauf.ueberTempo`).
  const ueberTempo = lauf.ueberTempo * Math.exp(-BOOST_ABKLINGEN * dt);
  /** Alles, was nach jedem Schritt in den neuen Lauf muss. */
  const neben = () => ({ druck, hintenGedrueckt: hinten, popZahl, popRest, popGenommen, popX, ueberTempo, lueckenZahl });
  let luftGesamt = lauf.luftGesamt;
  let letzteLandung = lauf.letzteLandung;
  let perfekte = lauf.perfekte;
  let trickPunkte = lauf.trickPunkte;
  let letzterTrick = lauf.letzterTrick;
  let luftDrehStart = lauf.luftDrehStart;

  /**
   * Ein Sturz, der nicht beim Aufsetzen entsteht: gegen die Wand der Gegenseite
   * oder auf den Grund des Grabens. Das Rad behält einen Rest Schwung und
   * fällt weiter (siehe den `vorbei`-Zweig oben), die Darstellung löst den
   * Fahrer vom Rad.
   */
  const abgestuerzt = (sx: number, sy: number, svx: number, svy: number): Lauf => ({
    ...lauf,
    x: sx,
    y: sy,
    vx: svx,
    vy: svy,
    winkel,
    drehen,
    amBoden: false,
    luftZeit,
    luftGesamt,
    letzteLandung: 'sturz',
    meldungRest: 2,
    flow: 1,
    perfekte,
    trickPunkte,
    letzterTrick: 0,
    luftDrehStart,
    zeit: lauf.zeit + dt,
    vorbei: true,
    gewonnen: false,
    sturzZeit: 0,
    ...neben(),
    popGenommen: false,
  });

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
    vx = Math.min(TEMPO_MAX + ueberTempo, Math.max(-RUECKROLL_MAX, vx));

    x += vx * dt;

    /*
     * **Die Kante einer Lücke.** Hinter ihr ist kein Boden mehr: Wer sie
     * überquert, hebt ab — mit dem Winkel, in dem die Rampe endet, und mit dem
     * Tempo, das er dort hat. Das ist kein Abheben aus der Krümmung wie bei
     * einem Kicker (dort entscheidet das Tempo, **wo** man abhebt), sondern
     * eine feste Stelle. Deshalb steht die Regel hier ausdrücklich und hängt
     * nicht an der Fliehkraft-Bedingung weiter unten: Die Kante ist ein Sprung
     * in der Bodenhöhe, und ob ein Bild genau in das schmale Fenster davor
     * fällt, hinge sonst von der Bildrate ab.
     */
    const graben = lueckeBei(g, x);
    if (graben && vx > 0 && lauf.x <= lueckeKante(graben)) {
      const kante = lueckeKante(graben);
      const steigungKante = bodenSteigung(g, kante - 1e-4);
      const winkelKante = Math.atan(steigungKante);
      // Den kleinen Überstand über die Kante entlang der Rampenlinie nehmen,
      // statt das Rad zurückzusetzen.
      y = bodenHoehe(g, kante - 1e-4) + steigungKante * (x - kante);
      amBoden = false;
      vy = Math.sin(winkelKante) * vx;
      luftZeit = 0;
      luftDrehStart = winkel;
      if (!popGenommen && druck >= 0 && druck <= POP_FENSTER) {
        vy += POP_SCHUB * popStaerke(druck);
        popZahl += 1;
        popRest = 0.8;
        popGenommen = true;
        popX = kante;
      }
    } else if (graben) {
      // Von der Gegenseite zurückgerollt oder sonst wie hineingeraten:
      // Im Graben gibt es keinen Boden.
      return abgestuerzt(x, y, vx * 0.2, 0);
    } else {
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
        // Pop: „Hinten" frisch gedrückt, kurz bevor das Rad die Kante verlässt.
        // `popGenommen` wird erst bei einer echten Landung zurückgesetzt, nicht
        // bei jedem Hüpferchen auf der Anfahrt — sonst zählte derselbe Druck
        // mehrfach.
        if (!popGenommen && druck >= 0 && druck <= POP_FENSTER) {
          vy += POP_SCHUB * popStaerke(druck);
          popZahl += 1;
          popRest = 0.8;
          popGenommen = true;
          popX = x;
        }
      }
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
    // Ein frischer Druck in den ersten Augenblicken nach dem Abheben zählt
    // noch als Pop — die Kante ist nie auf den Frame genau zu treffen.
    if (!popGenommen && luftZeit <= POP_NACH && druck >= 0 && druck <= luftZeit) {
      vy += POP_SCHUB * 0.85 * popStaerke(druck);
      popZahl += 1;
      popRest = 0.8;
      popGenommen = true;
      popX = x;
    }
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

    /*
     * **Die Gegenseite einer Lücke.** Wer sie unterhalb ihrer Kante erreicht,
     * prallt gegen die Wand — das ist das „zu kurz" der Lücke. Wer sie
     * oberhalb erreicht, hat die Lücke geschafft, auch wenn er danach noch
     * landen muss. Geprüft wird beim **Überschreiten** der Linie, nicht jedes
     * Bild: Hinter der Kante würde die Bodenhöhe sonst auf die Oberkante
     * springen und aus einem Aufprall eine Landung machen.
     */
    for (const l of g.luecken) {
      const ende = lueckeEnde(l);
      if (lauf.x < ende && x >= ende) {
        if (y < bodenHoehe(g, ende + 1e-6) - 0.05) {
          return abgestuerzt(ende - 0.1, y, vx * 0.15, Math.min(vy, 0));
        }
        lueckenZahl += 1;
      }
    }

    const boden = bodenHoehe(g, x);
    /*
     * Wer im Graben schon so tief ist, dass er die Gegenseite nicht mehr
     * erreichen kann, ist gestürzt — **jetzt**, nicht erst auf dem Grund. Sonst
     * fiele man über eine Sekunde lang sieben Meter, ohne dass etwas passiert,
     * und das Rad schlüge erst ganz unten auf.
     */
    const imGraben = lueckeBei(g, x);
    if (imGraben) {
      const randUnten = Math.min(
        bodenHoehe(g, lueckeKante(imGraben) - 1e-4),
        bodenHoehe(g, lueckeEnde(imGraben) + 1e-6),
      );
      if (y < randUnten - 2.5) return abgestuerzt(x, y, vx * 0.5, vy);
    }
    // Auf den Grund eines Grabens zu fallen ist nie eine Landung.
    if (y <= boden && imGraben) return abgestuerzt(x, boden, 0, 0);
    if (y <= boden && luftZeit < LANDUNG_MIN_LUFT) {
      // Nur ein Aufsetzen im Vorbeigehen (siehe `LANDUNG_MIN_LUFT`): Boden-
      // kontakt, aber keine Landung — keine Wertung, kein Flow, kein Schub.
      y = boden;
      vy = 0;
      amBoden = true;
      luftZeit = 0;
      drehen = 0;
    } else if (y <= boden) {
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
      const saltosNeu = lauf.saltos + letzterTrick;

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
          ...neben(),
          popGenommen: false,
          saltos: saltosNeu,
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
        ...neben(),
        popGenommen: false,
        saltos: saltosNeu,
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
      ...neben(),
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
    ...neben(),
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
  return (
    strecke +
    luft +
    landungen +
    lauf.trickPunkte +
    zielBonus +
    lauf.muenzenZahl * MUENZ_PUNKTE +
    lauf.popZahl * POP_PUNKTE +
    lauf.lueckenZahl * LUECKEN_PUNKTE +
    lauf.padsGenommen.size * PAD_PUNKTE +
    lauf.missionPunkte
  );
}

/** Die Saat einer Strecke. Gleiche Nummer = gleiche Strecke, überall. */
export function streckenSaat(nummer: number): number {
  return saatAus('radfahren', nummer);
}
