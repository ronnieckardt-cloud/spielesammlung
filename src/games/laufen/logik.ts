import { saatAus, schritt } from '../../core/rng';

/**
 * Dash City — die Spielregeln. **Ohne three.js, ohne Canvas, ohne React.**
 *
 * Das ist die wichtigste Trennung in diesem Spiel: Gezeichnet wird in 3-D
 * über eine Bibliothek, **gerechnet** wird hier — in reinen Funktionen, die
 * sich ohne Browser durchspielen lassen. Sonst läge die Spiellogik in der
 * Bibliothek und wäre der Prüfung entzogen; genau das wäre der eigentliche
 * Preis von 3-D gewesen, nicht die Dateigröße.
 *
 * Koordinaten: `x` quer (links negativ), `y` hoch, `z` in die Tiefe. Die
 * Figur läuft in +z, alles Übrige kommt ihr entgegen.
 */

/** Drei Spuren, wie beim Vorbild. Mehr wird auf einem Handy unübersichtlich. */
export const SPUREN = 3;

/** Abstand zwischen zwei Spurmitten, in Metern. */
export const SPUR_BREITE = 2.2;

/** Wie lange ein Spurwechsel dauert. */
export const WECHSEL_ZEIT = 0.16;

/** Aufwärtsschwung beim Sprung, in Metern je Sekunde. */
export const SPRUNG_KRAFT = 7.6;

/** Erdanziehung. Ergibt mit der Sprungkraft rund 0,78 s in der Luft. */
export const SCHWERKRAFT = 19.6;

/** Wie lange eine Rutsche dauert. */
export const RUTSCH_ZEIT = 0.55;

/** Kopfhöhe im Stehen und beim Rutschen. */
export const HOEHE_STEHEND = 1.7;
export const HOEHE_RUTSCHEND = 0.75;

/** Halbe Breite der Figur — für die Kollisionsprüfung quer. */
export const FIGUR_HALB = 0.42;

/** Länge eines Abschnitts. Je Abschnitt gibt es höchstens ein Hindernismuster. */
export const ABSCHNITT_LAENGE = 14;

/** Anfangs- und Höchsttempo in Metern je Sekunde. */
export const TEMPO_START = 9;
export const TEMPO_MAX = 22;

/**
 * Nach so vielen Metern ohne Münze fängt die Serie wieder bei null an.
 *
 * Der Münzton hängt an der **Serie**, nicht an der Gesamtzahl. Vorher stieg
 * er mit `muenzenZahl`, und weil er bei zwölf Halbtönen gedeckelt ist, war
 * er nach rund drei Münzreihen für den Rest des Laufs am Anschlag — ab dann
 * klang jede Münze gleich, und aus der Belohnung wurde ein Dauerton.
 *
 * **Metern, nicht Sekunden** — und das ist der Punkt: Das Tempo wächst im
 * Lauf von 9 auf 22 m/s, dieselbe Lücke im Bild wäre in Sekunden am Ende
 * also weniger als halb so lang wie am Anfang. Über die Strecke gemessen
 * bedeutet die Serie überall dasselbe. Zehn Meter liegen zwischen den
 * beiden Fällen, die auseinandergehalten werden müssen: Von der letzten
 * Münze einer Reihe bis zur ersten der nächsten sind es 6,8 m (die Serie
 * läuft weiter), eine ausgelassene Reihe kostet mindestens 14 m (die Serie
 * ist weg).
 */
export const SERIE_ABSTAND = 10;

/** Wie schnell sich das Tempo dem Höchstwert nähert (Metern). */
const TEMPO_KONSTANTE = 900;

/** Was für ein Hindernis steht da? */
export type Hindernisart =
  /** Niedrig — drüberspringen. */
  | 'huerde'
  /** Hoch, unten offen — drunter durchrutschen. */
  | 'balken'
  /** Von oben bis unten dicht — nur die Spur wechseln hilft. */
  | 'mauer';

export type Hindernis = {
  art: Hindernisart;
  /** 0, 1 oder 2. */
  spur: number;
  /** Wo es steht, in Metern. */
  z: number;
};

export type Muenze = { spur: number; z: number; /** Höhe über dem Boden. */ y: number };

/**
 * Ein Schub — Rückmeldung: „ich will 'n paar Sachen einsammeln, zum
 * Beispiel, dass man dann schneller ist, wo man höher springt oder so was,
 * irgendwas Besonderes."
 *
 * Zwei Arten, keine mehr: Mehr Power-ups wollten schnell nach „Feature-
 * Liste" statt nach Spiel aussehen. Beide sind zeitlich befristet und
 * lösen sich gegenseitig nicht ab — wer beide einsammelt, hat beide
 * gleichzeitig aktiv.
 */
export type Schubart = 'turbo' | 'sprung';
export type Schub = { art: Schubart; spur: number; z: number };

/** Wie viel schneller man mit Turbo unterwegs ist. */
export const TURBO_FAKTOR = 1.55;
/** Wie lange Turbo bzw. Sprungschub nach dem Einsammeln wirken, in Sekunden. */
export const TURBO_DAUER = 4;
export const SPRUNGSCHUB_DAUER = 6;
/** Wie oft ein Abschnitt mit freier Spur zusätzlich einen Schub bekommt. */
const SCHUB_CHANCE = 0.22;

export type Lauf = {
  /** Zurückgelegte Strecke in Metern. */
  strecke: number;
  /** Aktuelle Querposition in Metern (gleitet beim Wechsel). */
  x: number;
  /** Spur, auf die gerade gewechselt wird. */
  zielSpur: number;
  /** Spur, von der der Wechsel ausging. */
  vonSpur: number;
  /** Fortschritt des Wechsels, 0 bis 1. */
  wechsel: number;
  /** Höhe über dem Boden. */
  y: number;
  /** Senkrechte Geschwindigkeit. */
  steigen: number;
  /** Restliche Rutschzeit; 0 = steht. */
  rutschRest: number;
  hindernisse: readonly Hindernis[];
  muenzen: readonly Muenze[];
  /** Eingesammelte Münzen. */
  muenzenZahl: number;
  /** Wie viele Münzen ohne größere Lücke hintereinander kamen. */
  muenzSerie: number;
  /** Meter seit der letzten Münze — bricht die Serie ab `SERIE_ABSTAND`. */
  seitMuenze: number;
  schuebe: readonly Schub[];
  /** Eingesammelte Schübe, gleich welcher Art. */
  schubZahl: number;
  /** Restliche Sekunden Turbo; 0 = aus. */
  turboRest: number;
  /** Restliche Sekunden Sprungschub; 0 = aus. */
  sprungRest: number;
  /** Bis zu welchem Abschnitt schon erzeugt wurde. */
  erzeugtBis: number;
  vorbei: boolean;
  saat: number;
};

/** Die Mitte einer Spur in Metern. Spur 1 ist die Mitte. */
export const spurX = (spur: number) => (spur - 1) * SPUR_BREITE;

/**
 * Das Tempo an einer bestimmten Stelle der Strecke.
 *
 * Nähert sich dem Höchstwert an, statt linear zu wachsen — sonst wird das
 * Spiel irgendwann unspielbar, egal wie gut jemand ist, und das fühlt sich
 * nicht nach „schwer" an, sondern nach kaputt.
 */
export function tempoBei(strecke: number): number {
  return TEMPO_START + (TEMPO_MAX - TEMPO_START) * (1 - Math.exp(-strecke / TEMPO_KONSTANTE));
}

/**
 * Wie viel Strecke ein Spieler mindestens braucht, um zu reagieren.
 *
 * Reaktionszeit plus die Zeit für einen Spurwechsel, mal Tempo. Daran
 * hängt, ob ein Abschnitt fair ist — siehe `istPassierbar`.
 */
export function mindestAbstand(tempo: number): number {
  const REAKTION = 0.35;
  return (REAKTION + WECHSEL_ZEIT) * tempo;
}

/**
 * Bleibt in diesem Abschnitt mindestens ein Weg offen?
 *
 * Der wichtigste Fairness-Test des Spiels: Eine Reihe aus drei Mauern wäre
 * unpassierbar, und man stürbe nicht durch eigenen Fehler, sondern durch
 * Zufall. Danach sagt die Bestenliste nichts mehr aus.
 *
 * Eine Hürde und ein Balken sind kein Hindernis für den Weg — man springt
 * oder rutscht. Nur Mauern versperren eine Spur wirklich.
 */
export function istPassierbar(hindernisse: readonly Hindernis[]): boolean {
  const mauern = new Set(hindernisse.filter((h) => h.art === 'mauer').map((h) => h.spur));
  if (mauern.size >= SPUREN) return false;

  // Zusätzlich: Auf einer Spur dürfen Hürde und Balken nicht gleichzeitig
  // stehen — springen und rutschen zugleich geht nicht.
  for (let s = 0; s < SPUREN; s++) {
    const drauf = hindernisse.filter((h) => h.spur === s).map((h) => h.art);
    if (drauf.includes('huerde') && drauf.includes('balken')) return false;
  }
  return true;
}

/**
 * Erzeugt den Inhalt eines Abschnitts — **allein aus seiner Nummer**.
 *
 * Nicht aus der verstrichenen Zeit: Nur so ergibt derselbe Lauf mit
 * derselben Eingabefolge immer dasselbe Ergebnis, und nur so lässt sich
 * überhaupt testen, dass jeder Abschnitt passierbar ist. `Math.random`
 * kommt nirgends vor, wie überall im Projekt.
 */
export function abschnittErzeugen(
  grundsaat: number,
  index: number,
): { hindernisse: Hindernis[]; muenzen: Muenze[]; schuebe: Schub[] } {
  const z = index * ABSCHNITT_LAENGE;
  const hindernisse: Hindernis[] = [];
  const muenzen: Muenze[] = [];
  const schuebe: Schub[] = [];

  // Die ersten Abschnitte bleiben frei — man soll erst ankommen.
  if (index < 3) return { hindernisse, muenzen, schuebe };

  let s = saatAus('laufen', grundsaat, index);

  const a = schritt(s);
  s = a.saat;
  // Wie viele Spuren dieser Abschnitt belegt: 1 oder 2, nie alle drei.
  const belegt = a.wert < 0.62 ? 1 : 2;

  const freieSpuren = [0, 1, 2];
  for (let i = 0; i < belegt; i++) {
    const w = schritt(s);
    s = w.saat;
    const wahl = Math.floor(w.wert * freieSpuren.length);
    const spur = freieSpuren.splice(wahl, 1)[0]!;

    const t = schritt(s);
    s = t.saat;
    // Mauern sind seltener — sie erzwingen einen Spurwechsel und sind damit
    // der härteste Fall.
    const art: Hindernisart = t.wert < 0.42 ? 'huerde' : t.wert < 0.78 ? 'balken' : 'mauer';
    hindernisse.push({ art, spur, z });
  }

  // Auf einer freien Spur eine Münzreihe — die Belohnung fürs Ausweichen
  // liegt damit genau dort, wo man ohnehin hinmuss.
  if (freieSpuren.length > 0) {
    const m = schritt(s);
    s = m.saat;
    const spur = freieSpuren[Math.floor(m.wert * freieSpuren.length)]!;
    for (let k = 0; k < 5; k++) {
      muenzen.push({ spur, z: z + k * 1.8, y: 1 });
    }
  }

  /*
   * Ab und zu ein Schub, seltener als Münzen — sonst wäre er keine
   * Besonderheit mehr, sondern nur eine weitere Münze mit anderer Farbe.
   * `z + 10` liegt hinter der Münzreihe (die endet spätestens bei `z+7.2`),
   * damit sich beide nie überlappen, egal ob sie dieselbe Spur treffen.
   */
  if (freieSpuren.length > 0) {
    const w = schritt(s);
    s = w.saat;
    if (w.wert < SCHUB_CHANCE) {
      const p = schritt(s);
      s = p.saat;
      const spur = freieSpuren[Math.floor(p.wert * freieSpuren.length)]!;
      const a = schritt(s);
      s = a.saat;
      const art: Schubart = a.wert < 0.5 ? 'turbo' : 'sprung';
      schuebe.push({ art, spur, z: z + 10 });
    }
  }

  return { hindernisse, muenzen, schuebe };
}

/** Wie viele Abschnitte im Voraus bereitstehen. */
const VORRAT = 8;

export function neuesSpiel(saat: number): Lauf {
  let lauf: Lauf = {
    strecke: 0,
    x: 0,
    zielSpur: 1,
    vonSpur: 1,
    wechsel: 1,
    y: 0,
    steigen: 0,
    rutschRest: 0,
    hindernisse: [],
    muenzen: [],
    muenzenZahl: 0,
    muenzSerie: 0,
    seitMuenze: 0,
    schuebe: [],
    schubZahl: 0,
    turboRest: 0,
    sprungRest: 0,
    erzeugtBis: 0,
    vorbei: false,
    saat,
  };
  for (let i = 0; i < VORRAT; i++) lauf = nachschieben(lauf);
  return lauf;
}

function nachschieben(lauf: Lauf): Lauf {
  const index = lauf.erzeugtBis;
  const { hindernisse, muenzen, schuebe } = abschnittErzeugen(lauf.saat, index);
  return {
    ...lauf,
    hindernisse: [...lauf.hindernisse, ...hindernisse],
    muenzen: [...lauf.muenzen, ...muenzen],
    schuebe: [...lauf.schuebe, ...schuebe],
    erzeugtBis: index + 1,
  };
}

/** Eine Spur nach links oder rechts. Am Rand passiert nichts. */
export function spurWechseln(lauf: Lauf, richtung: -1 | 1): Lauf {
  if (lauf.vorbei) return lauf;
  const ziel = lauf.zielSpur + richtung;
  if (ziel < 0 || ziel >= SPUREN) return lauf;
  return { ...lauf, vonSpur: lauf.zielSpur, zielSpur: ziel, wechsel: 0 };
}

/** Springen — nur vom Boden aus, kein zweiter Sprung in der Luft. */
export function springen(lauf: Lauf): Lauf {
  if (lauf.vorbei || lauf.y > 0.01) return lauf;
  return { ...lauf, steigen: SPRUNG_KRAFT, rutschRest: 0 };
}

/**
 * Rutschen. In der Luft bricht es den Sprung ab und zieht die Figur
 * herunter — das ist beim Vorbild genauso und fühlt sich richtig an, weil
 * man sonst über einem Balken hilflos in der Luft hängt.
 */
export function rutschen(lauf: Lauf): Lauf {
  if (lauf.vorbei) return lauf;
  if (lauf.y > 0.01) return { ...lauf, steigen: -SPRUNG_KRAFT, rutschRest: RUTSCH_ZEIT };
  return { ...lauf, rutschRest: RUTSCH_ZEIT };
}

/** Die Kopfhöhe gerade — beim Rutschen deutlich niedriger. */
export function kopfhoehe(lauf: Lauf): number {
  return lauf.rutschRest > 0 ? HOEHE_RUTSCHEND : HOEHE_STEHEND;
}

/**
 * Trifft die Figur dieses Hindernis?
 *
 * Drei Achsen nacheinander: Tiefe, quer, Höhe. Erst wenn alle drei
 * überlappen, ist es ein Treffer.
 *
 * `streckeVorher` ist der Stand **vor** diesem Zeitschritt. Ohne ihn prüft
 * die Tiefe nur den Momentanabstand, und das ist bei niedriger Bildrate zu
 * wenig: Ein Zeitschritt ist auf 50 ms gedeckelt, das Tempo läuft gegen 22
 * m/s — ab rund 2500 Metern ist ein Schritt damit länger (1,06 m) als das
 * Prüffenster breit (1,00 m). Das Hindernis lag dann zwischen zwei
 * Prüfungen, wurde nie gesehen und die Figur lief hindurch. Wer bei
 * ruckelndem Bild unsterblich wird, spielt kein Spiel mehr.
 *
 * Geprüft wird deshalb der **zurückgelegte Abschnitt**: Liegt das Hindernis
 * irgendwo zwischen altem und neuem Stand, zählt es. Ohne Angabe verhält
 * sich die Funktion wie vorher (Fenster von einem halben Meter um den
 * aktuellen Stand) — dafür der Vorgabewert.
 */
export function kollision(lauf: Lauf, h: Hindernis, streckeVorher = lauf.strecke): boolean {
  // Tiefe: Das Hindernis ist einen halben Meter dick.
  if (h.z - lauf.strecke > 0.5) return false; // noch davor
  if (h.z - streckeVorher < -0.5) return false; // schon dahinter

  // Quer: Beim Wechseln zählt die tatsächliche Position, nicht die Spur —
  // sonst wäre man mitten im Wechsel schon auf der neuen Spur sicher.
  const abstand = Math.abs(spurX(h.spur) - lauf.x);
  if (abstand > SPUR_BREITE / 2 + FIGUR_HALB - 0.3) return false;

  switch (h.art) {
    case 'huerde':
      // Knapp einen halben Meter hoch — der Sprung trägt darüber.
      return lauf.y < 0.55;
    case 'balken':
      /*
       * Hängt in 1,1 m Höhe. Normal bringt nur Rutschen den Kopf darunter
       * — Springen macht es schlimmer, siehe unten.
       *
       * **Mit Sprungschub gilt stattdessen dieselbe Regel wie bei der
       * Hürde.** Rückmeldung: „dass man dann auch über die Hürden, wo man
       * drunter durchkriegen muss, drüber springen kann, wenn man dann
       * irgendwas einsammelt." Der Schub öffnet also einen zweiten Weg an
       * einem Hindernis, das sonst nur einen kennt — nicht bloß eine
       * höhere Zahl irgendwo.
       */
      if (lauf.sprungRest > 0) return lauf.y < 0.55;
      return kopfhoehe(lauf) + lauf.y > 1.1;
    default:
      // Mauer: hilft nichts außer Ausweichen.
      return true;
  }
}

/** Ein Zeitschritt in Sekunden. Rein — gleiche Eingabe, gleiches Ergebnis. */
export function takt(lauf: Lauf, dt: number): Lauf {
  if (lauf.vorbei) return lauf;

  // Turbo multipliziert das reguläre Tempo, statt es zu ersetzen — dadurch
  // bleibt der Anstieg über die Strecke (`tempoBei`) unverändert, und der
  // Effekt fühlt sich am Anfang des Laufs genauso stark an wie am Ende.
  const tempoGrund = tempoBei(lauf.strecke);
  const tempo = lauf.turboRest > 0 ? tempoGrund * TURBO_FAKTOR : tempoGrund;
  const strecke = lauf.strecke + tempo * dt;

  // Spurwechsel gleitet in fester Zeit, unabhängig vom Tempo.
  const wechsel = Math.min(1, lauf.wechsel + dt / WECHSEL_ZEIT);
  // Weich ein- und ausschwingen, damit es nicht ruckt.
  const weich = wechsel * wechsel * (3 - 2 * wechsel);
  const x = spurX(lauf.vonSpur) + (spurX(lauf.zielSpur) - spurX(lauf.vonSpur)) * weich;

  // Springen und fallen.
  let steigen = lauf.steigen - SCHWERKRAFT * dt;
  let y = lauf.y + steigen * dt;
  if (y <= 0) {
    y = 0;
    steigen = 0;
  }

  const rutschRest = Math.max(0, lauf.rutschRest - dt);
  const turboRest = Math.max(0, lauf.turboRest - dt);
  const sprungRest = Math.max(0, lauf.sprungRest - dt);

  let zwischen: Lauf = {
    ...lauf,
    strecke,
    x,
    wechsel,
    y,
    steigen,
    rutschRest,
    turboRest,
    sprungRest,
  };

  // Münzen einsammeln.
  let muenzenZahl = lauf.muenzenZahl;
  const muenzen = lauf.muenzen.filter((m) => {
    const dz = m.z - strecke;
    if (dz < -1) return false; // hinter uns, weg damit
    // Wie bei den Hindernissen der zurückgelegte Abschnitt, nicht der
    // Momentanabstand: Bei 50 ms Zeitschritt und Höchsttempo ist der Schritt
    // 1,1 m lang, das alte Fenster war 1,2 m breit — die Münze wäre bei der
    // nächsten Bildrate-Verschlechterung durchgerutscht, und ein Kind hätte
    // gesehen, wie es mitten durch sie hindurchläuft.
    if (dz > 0.6 || m.z - lauf.strecke < -0.6) return true;
    const nah = Math.abs(spurX(m.spur) - x) < SPUR_BREITE / 2;
    const hoehe = Math.abs(m.y - (y + 0.6)) < 0.9;
    if (nah && hoehe) {
      muenzenZahl += 1;
      return false;
    }
    return true;
  });

  // Serie: Münzen ohne größere Lücke hintereinander. Siehe `SERIE_ABSTAND`.
  const geholt = muenzenZahl - lauf.muenzenZahl;
  const seitMuenze = geholt > 0 ? 0 : Math.min(SERIE_ABSTAND, lauf.seitMuenze + tempo * dt);
  const muenzSerie =
    geholt > 0 ? lauf.muenzSerie + geholt : seitMuenze >= SERIE_ABSTAND ? 0 : lauf.muenzSerie;

  /*
   * Schübe einsammeln — dieselbe Fensterlogik wie bei den Münzen (siehe
   * dort). Anders als Münzen ohne Höhenprüfung: Ein Schub soll nicht
   * ausgerechnet dann verpasst werden, wenn man gerade springt oder
   * rutscht, um einem Hindernis auszuweichen.
   *
   * Wird **vor** der Hindernisprüfung eingesammelt, in dieselbe `zwischen`
   * geschrieben: Ein Sprungschub, der genau auf der Höhe eines Balkens
   * liegt, hilft noch im selben Bild — sonst bräuchte es ein Bild
   * Verzögerung, in dem man trotz Einsammelns noch getroffen würde.
   */
  let schubZahl = lauf.schubZahl;
  const schuebe = lauf.schuebe.filter((sch) => {
    const dz = sch.z - strecke;
    if (dz < -1) return false;
    if (dz > 0.6 || sch.z - lauf.strecke < -0.6) return true;
    const nah = Math.abs(spurX(sch.spur) - x) < SPUR_BREITE / 2;
    if (nah) {
      schubZahl += 1;
      if (sch.art === 'turbo') zwischen = { ...zwischen, turboRest: TURBO_DAUER };
      else zwischen = { ...zwischen, sprungRest: SPRUNGSCHUB_DAUER };
      return false;
    }
    return true;
  });

  // Hindernisse prüfen und Vergangenes wegwerfen.
  let vorbei = false;
  const hindernisse = lauf.hindernisse.filter((h) => {
    if (kollision(zwischen, h, lauf.strecke)) vorbei = true;
    return h.z - strecke > -3;
  });

  zwischen = {
    ...zwischen,
    muenzen,
    muenzenZahl,
    muenzSerie,
    seitMuenze,
    schuebe,
    schubZahl,
    hindernisse,
    vorbei,
  };

  // Nachschub, solange nicht genug voraus liegt.
  while (zwischen.erzeugtBis * ABSCHNITT_LAENGE < strecke + VORRAT * ABSCHNITT_LAENGE) {
    zwischen = nachschieben(zwischen);
  }

  return zwischen;
}

/**
 * Die Punktzahl: ein Punkt je Meter, zehn je Münze, fünfundzwanzig je Schub.
 *
 * Münzen und Schübe sollen sich lohnen, aber nicht das Rennen ersetzen —
 * wer nur sammelt und langsam ist, kommt trotzdem nicht weit. Ein Schub
 * bringt mehr als eine Münze, weil er seltener ist (siehe `SCHUB_CHANCE`)
 * und man ihn nicht einmal benutzen muss, um die Punkte zu behalten.
 */
export function punkte(lauf: Lauf): number {
  return Math.floor(lauf.strecke) + lauf.muenzenZahl * 10 + lauf.schubZahl * 25;
}
