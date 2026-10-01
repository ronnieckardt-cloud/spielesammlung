import { bodenHoehe, bodenSteigung } from './logik';
import type { Landung, Lauf } from './logik';
import { fahrerHinten, fahrerSturz, fahrerVorn, skelettBerechnen } from './fahrer';
import type { FahrerGeo, FahrerPose } from './fahrer';
import { mischen } from './farben';
import {
  PALETTEN,
  bodenMuster,
  bodenSteine,
  grasZeichnen,
  himmelZeichnen,
  tor,
  wegmarken,
} from './umgebung';
import type { Buehne, Palette } from './umgebung';
import {
  absprungMarken,
  bildAbschluss,
  muenzenZeichnen,
  padsZeichnen,
  scheinwerfer,
  schattenZeichnen,
  teilchensystemBauen,
  tempoStriche,
} from './effekte';

/**
 * Flow MTB — die Darstellung. **Enthält keine einzige Spielregel.**
 *
 * Sie bekommt einen `Lauf` gereicht und zeichnet ihn. Alles Rechnende
 * steht in `logik.ts` und ist ohne Browser geprüft — dieselbe Trennung wie
 * bei Dash City (`szene.ts`), und aus demselben Grund: Läge die Physik im
 * Zeichencode, wäre sie der Prüfung entzogen.
 *
 * **Warum Canvas und nicht SVG.** Alle anderen Spiele hier zeichnen SVG,
 * und für Raster und Karten ist das richtig. Ein durchgehendes Gelände ist
 * es nicht: Der Geländeumriss allein sind mehrere hundert Punkte, die sich
 * in **jedem** Bild ändern. Als SVG hieße das, sechzigmal je Sekunde einen
 * mehrere Kilobyte langen Pfad-String zu bauen und den DOM-Knoten
 * auszutauschen. `CLAUDE.md` sieht für Spiele mit fortlaufender Bewegung
 * ohnehin Canvas vor — dies ist das erste, das es wirklich braucht.
 *
 * **Wer was zeichnet.** `umgebung.ts` den Himmel, den Boden-Schmuck und die
 * Wegmarken, `effekte.ts` Münzen, Boost-Streifen, Schatten und Teilchen,
 * `fahrer.ts` den Menschen. Hier liegen das Rad, die Kamera, die
 * Reihenfolge — und alles, was einen eigenen Zustand hat und **nicht** in
 * `logik.ts` gehört: Federung, Raddrehung, Haltung des Fahrers. Das ist
 * reine Optik — es beeinflusst nichts, was über Sieg oder Niederlage
 * entscheidet.
 */

export type Zeichner = {
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
};

/*
 * Die Farben des Rades.
 *
 * Das Bike war zuerst schwarz — Rückmeldung: „Das Fahrrad ist ein
 * kompletter Reinfall, das ist ein Fahrrad mit drei Strichen … Macht das
 * Fahrrad rot." Rot ist dabei nicht nur Geschmack: Ein schwarzer Rahmen
 * vor dunklem Hintergrund verschwindet, und alles, was man dann noch
 * sieht, sind die Umrisse — genau der „drei Striche"-Eindruck. Rot trennt
 * das Rad vom Hintergrund, und erst dadurch werden die Einzelteile
 * überhaupt als Fahrrad lesbar.
 *
 * Himmel und Boden stehen seit der Überarbeitung in `umgebung.ts`
 * (vier Paletten, je nach Strecke).
 */
const FARBEN = {
  /** Rahmen in drei Tönen — Grundfläche, Lichtkante, Schattenkante. */
  rahmen: '#d92d20',
  rahmenHell: '#ff6b5e',
  rahmenDunkel: '#8c1710',
  /** Federelemente: helles Standrohr, dunkles Tauchrohr. */
  federHell: '#c9ced6',
  federDunkel: '#3d434d',
  reifen: '#16161a',
  profil: '#26262c',
  felge: '#8d939e',
  nabe: '#c3c8d0',
  akzent: '#38d9a9',
};

/*
 * Wie viele Meter quer ins Bild passen — bei Tempo etwas mehr.
 *
 * **Deutlich weniger als beim ersten Versuch (15 m).** Rückmeldung: „Das
 * ist alles viel zu klein … der Hintergrund so riesig und die Person so
 * klein. Guck dir Hill Climb Racing an." Dort füllt das Fahrzeug einen
 * guten Teil des Bildes, hier war es ein Fleck vor viel Landschaft.
 *
 * Rückmeldung, nachdem die Sprünge größer wurden: „Kameraperspektive ein
 * bisschen weiter nach hinten, dass ich mehr sehe." Bei großen,
 * aneinandergereihten Sprüngen ist Weitsicht keine Kosmetik mehr, sondern
 * Voraussetzung — sonst sieht man die nächste Kuppe nicht mehr rechtzeitig,
 * um sich in der Luft danach auszurichten. Die Spanne zwischen Ruhig und
 * Schnell ist deshalb weit gezogen: gemütlich nah dran, bei Höchsttempo
 * mehr Vorwarnung.
 */
const SICHT_RUHIG = 11.5;
const SICHT_SCHNELL = 17.5;

/**
 * Maße des Rades in Metern.
 *
 * **Bewusst keine echten Maße.** Ein 29-Zoll-Laufrad hat 0,37 m Radius bei
 * 1,20 m Radstand — genau das sah aus wie „ein normales Rennrad", so
 * Ronnis Urteil zur ersten Fassung. Spiele wie Hill Climb Racing
 * übertreiben die Räder deutlich; erst dadurch liest sich ein Fahrzeug
 * auf den ersten Blick als geländegängig. Kleinere Räder (0,84 m) bei
 * größerem Radstand (1,18 m) lassen es erwachsener wirken, ohne die
 * geländegängige Übertreibung ganz aufzugeben.
 */
const RAD_R = 0.42;
const RADSTAND = 1.18;

/**
 * Wie viel größer Rad und Fahrer **gezeichnet** werden als ihre Maße. Auf einem
 * Handy im Hochformat sind es nur 24 bis 34 Bildpunkte je Meter — ein Fahrer
 * von zwei Metern ist dann kaum fünfzig Punkte hoch, und alles, was an ihm
 * realistisch gemacht wurde, bleibt unsichtbar. Das Gelände bleibt in
 * Meterabmessungen, der Fahrer wird vergrößert (die Physik rechnet mit einem
 * Punkt und weiß nichts davon). Hill Climb Racing und jedes andere Spiel
 * dieser Art macht es genauso: Das Fahrzeug füllt das Bild, nicht die Welt.
 */
const FAHRZEUG_GROESSE = 1.55;

/** Wo auf der Strecke das Starttor steht — hinter dem Rad, am linken Bildrand. */
const START_TOR_X = 1.2;

export function zeichnerBauen(leinwand: HTMLCanvasElement): Zeichner {
  const ctx = leinwand.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar');

  let breite = leinwand.width;
  let hoehe = leinwand.height;
  let pixelDichte = 1;

  /*
   * Der eigene Darstellungszustand. Alles hier ist gedämpft und läuft der
   * Physik hinterher — genau das erzeugt den Eindruck von Masse.
   */
  /** Kameraposition in Weltkoordinaten, folgt dem Rad weich. */
  let kameraX = 0;
  let kameraY = 0;
  /**
   * Beim allerersten Bild springt die Kamera auf ihre Zielposition, statt
   * hinzugleiten. Ohne das stand sie bei null, während das Rad schon bei
   * x = 4 losfährt — im ersten Bild ragte das Rad halb aus dem Bild und
   * glitt erst danach in die Mitte. Ein weiches Nachziehen ist im Lauf
   * richtig, beim Bildaufbau ist es ein Fehler.
   */
  let kameraGesetzt = false;
  /** Einfederung 0 bis 1, vorne und hinten getrennt. */
  let federVorn = 0;
  let federHinten = 0;
  /**
   * Kamera-Wackeln 0 bis 1 — dieselbe Stoß-Erkennung wie die Federung, nur
   * als kurzer Bildschirm-Ruck. Ein Sturz löst denselben Stoß aus wie eine
   * harte Landung (`vy` springt beim Aufsetzen in beiden Fällen auf null),
   * braucht also keinen eigenen Sonderfall.
   */
  let schuettelStaerke = 0;
  /** Gesamtdrehung der Laufräder in Radiant. */
  let radDrehung = 0;
  /**
   * Erdbrocken, Funken, Ringe. **Dezent und in der Farbe des Bodens** — Staub
   * und Rauch waren schon einmal drin und wurden entfernt („sieht komisch
   * aus"). Was jetzt fliegt, sind kleine schwere Krümel in Bogenbahnen, keine
   * Wolke; fällt es wieder unangenehm auf, gilt dasselbe wie damals: ersatzlos
   * raus (`teilchen.leeren()` und die `erde`/`staub`-Aufrufe unten).
   */
  const teilchen = teilchensystemBauen();
  /** Seit dem letzten Erdkrümel hinterm Hinterrad vergangene Zeit. */
  let roostUhr = 0;
  /** Für die Federung: die senkrechte Geschwindigkeit des letzten Bildes. */
  let vyVorher = 0;
  /**
   * Kurzer, sehr dezenter Lichtblitz bei einer perfekten Landung — das
   * optische Gegenstück zum Kamera-Wackeln: Das Wackeln sagt „harter
   * Einschlag", der Blitz sagt „genau richtig gemacht". Bewusst kein Text
   * („PERFEKT!" wurde ausdrücklich entfernt).
   */
  let blitzStaerke = 0;
  /** Für die Blitz-Erkennung: die Landungsart des letzten Bildes. */
  let landungVorher: Landung | null = null;
  /** Haltung des Fahrers, gedämpft: Ein Mensch springt nicht von sitzend auf stehend. */
  let stehenAnim = 0;
  let gewichtAnim = 0;
  /** Laufende Zeit für Flattern, Schimmer, Drehung der Münzen — reine Optik. */
  let uhr = 0;
  /** Was die Darstellung schon als eingesammelt kennt — daraus entstehen die Funken. */
  let bekanntMuenzen = new Set<number>();
  let bekanntPads = new Set<number>();
  let bekanntPops = 0;
  /** Boost-Anzeige, weich ein- und ausgeblendet (die Logik schaltet hart). */
  let boostAnim = 0;
  /**
   * Der gestürzte Fahrer. Beim Sturz löst er sich vom Rad: Er fliegt in einem
   * Bogen weiter, schlägt auf, rutscht aus und bleibt liegen, während das Rad
   * für sich weiterkippt. Das ist **reine Optik** — die Logik hat den Lauf
   * längst beendet und kennt nur das Rad. Rückmeldung: „man soll sehen, wie
   * der Typ stürzt".
   */
  type Sturzfahrer = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    drehung: number;
    drehTempo: number;
    /** 0 = fliegt, 1 = liegt. */
    schlaff: number;
    aufgeschlagen: boolean;
    zeit: number;
  };
  let sturzFahrer: Sturzfahrer | null = null;
  /** Das Tempo des letzten Bildes vor dem Sturz — danach hat die Logik es schon gedrosselt. */
  let letztesVx = 0;
  /** Fester Zahlengenerator für das Kamerazittern, siehe `effekte.ts`. */
  let zittern = 0x1f123bb5;
  const zufall = () => {
    zittern = (Math.imul(zittern, 1664525) + 1013904223) >>> 0;
    return zittern / 4294967296;
  };

  const groesseAendern = (b: number, h: number) => {
    // Bildpunktzahl deckeln — dieselbe Vorsicht wie bei Dash City, ein
    // altes iPad zeichnet sonst viermal so viele Punkte wie nötig.
    pixelDichte = Math.min(window.devicePixelRatio || 1, 2);
    breite = b;
    hoehe = h;
    leinwand.width = Math.round(b * pixelDichte);
    leinwand.height = Math.round(h * pixelDichte);
    leinwand.style.width = `${b}px`;
    leinwand.style.height = `${h}px`;
  };

  const zeichnen = (lauf: Lauf, dt: number) => {
    const g = lauf.gelaende;

    // Nur für Nahaufnahmen am Rechner: Ein Prüfstand zeigt Rad und Fahrer groß
    // auf einfachem Grund, mit einer festgelegten Haltung. Auf einem echten
    // Gerät ist der Wert nie gesetzt.
    const pruef = (globalThis as { __mtbPrueftand?: PrueftandWerte }).__mtbPrueftand;
    if (pruef) {
      prueftandZeichnen(ctx, breite, hoehe, pixelDichte, lauf, pruef);
      return;
    }

    // `__mtbBiom` ist ein Hilfsmittel für Bildschirmfotos am Rechner: Es erzwingt
    // eine Umgebung, ohne die Saat der Strecke zu ändern.
    const erzwungen = (globalThis as { __mtbBiom?: number }).__mtbBiom;
    const biom = erzwungen ?? lauf.biom;
    const palette: Palette = PALETTEN[((biom % PALETTEN.length) + PALETTEN.length) % PALETTEN.length]!;
    uhr += dt;

    // --- Kamera ---------------------------------------------------
    /*
     * Bei Tempo etwas weiter weg. Das ist nicht nur Optik: Wer schnell
     * fährt, braucht mehr Vorwarnung, sonst ist der nächste Kicker nicht
     * mehr rechtzeitig zu sehen. Ronni: „Bei hoher Geschwindigkeit leichte
     * Zoom-Anpassung."
     */
    const tempoAnteil = Math.min(1, Math.max(0, lauf.vx / 16));
    const sicht = SICHT_RUHIG + (SICHT_SCHNELL - SICHT_RUHIG) * tempoAnteil;
    const proMeter = breite / sicht;

    /*
     * Das Rad steht bei 34 % von links, nicht in der Mitte: Nach vorn
     * braucht man Sicht, nach hinten nicht. Die Kamera folgt gedämpft —
     * hart mitzuziehen wirkt hektisch. Faktor 5,5: Bei 7 hatte die Kamera
     * das Rad schon nach einer Zehntelsekunde eingeholt, kaum als eigene
     * Bewegung spürbar, eher wie angeheftet.
     */
    const zielX = (sturzFahrer ? Math.max(lauf.x, sturzFahrer.x) : lauf.x) + sicht * 0.16;
    const zielY = (sturzFahrer ? Math.max(lauf.y, sturzFahrer.y - 1.2) : lauf.y) + 1.1;
    if (!kameraGesetzt) {
      kameraX = zielX;
      kameraY = zielY;
      kameraGesetzt = true;
      // Was beim Start schon eingesammelt ist, soll keine Funken auslösen.
      bekanntMuenzen = new Set(lauf.geholt);
      bekanntPads = new Set(lauf.padsGenommen);
      bekanntPops = lauf.popZahl;
    } else {
      const folgen = Math.min(1, dt * 5.5);
      kameraX += (zielX - kameraX) * folgen;
      kameraY += (zielY - kameraY) * folgen;
    }

    /*
     * Federung und Kamera-Wackeln reagieren auf den **Wechsel** der
     * senkrechten Geschwindigkeit, nicht auf ihren Wert — ein sanftes
     * Abbremsen federt nicht, ein plötzlicher Stopp (Landung, Sturz)
     * schon. Schon hier berechnet, vor dem Gelände: Damit wackelt bei einem
     * harten Einschlag das **ganze** Bild (Boden und Rad zusammen).
     */
    const hintenX = lauf.x - 0.95 * Math.cos(lauf.winkel);
    const vornX = lauf.x + 0.75 * Math.cos(lauf.winkel);
    const stoss = Math.max(0, vyVorher - lauf.vy);
    vyVorher = lauf.vy;
    if (lauf.amBoden && stoss > 1) {
      const kraft = Math.min(1, stoss / 14);
      federVorn = Math.min(1, federVorn + kraft);
      federHinten = Math.min(1, federHinten + kraft * 1.15);
      // Auch eine normale Landung wirft ein paar Krümel auf — nur eine harte
      // lässt das Bild wackeln und weht Staub auf.
      const boden = palette.boden.oben;
      teilchen.erde(hintenX, bodenHoehe(g, hintenX), 2 + Math.round(kraft * 6), lauf.vx, boden, 0.8 + kraft * 0.5);
      teilchen.erde(vornX, bodenHoehe(g, vornX), 2 + Math.round(kraft * 5), lauf.vx, boden, 0.8 + kraft * 0.5);
      if (kraft > 0.35) {
        schuettelStaerke = Math.min(1, schuettelStaerke + kraft);
        teilchen.staub(lauf.x, bodenHoehe(g, lauf.x), 3, mischen(palette.boden.saum, '#ffffff', 0.25));
      }
    }
    // Lichtblitz beim Wechsel auf eine perfekte Landung auslösen — nur
    // beim Wechsel, sonst bliebe er die ganze Landungsanzeige über an.
    if (lauf.letzteLandung === 'perfekt' && landungVorher !== 'perfekt') {
      blitzStaerke = 1;
      teilchen.funken(lauf.x, bodenHoehe(g, lauf.x) + 0.2, 7, '#ffe9a3', 0.8);
    }
    landungVorher = lauf.letzteLandung;

    // --- Ereignisse, die Funken auslösen ---------------------------
    if (lauf.geholt.size < bekanntMuenzen.size) bekanntMuenzen = new Set();
    if (lauf.geholt.size > bekanntMuenzen.size) {
      for (const i of lauf.geholt) {
        if (bekanntMuenzen.has(i)) continue;
        bekanntMuenzen.add(i);
        const c = g.muenzen[i];
        if (c) teilchen.funken(c.x, c.y, 8, '#ffd75a');
      }
    }
    if (lauf.padsGenommen.size < bekanntPads.size) bekanntPads = new Set();
    if (lauf.padsGenommen.size > bekanntPads.size) {
      for (const i of lauf.padsGenommen) {
        if (bekanntPads.has(i)) continue;
        bekanntPads.add(i);
        teilchen.funken(lauf.x + 0.4, lauf.y + 0.3, 12, '#7cf1ff', 1.3);
      }
    }
    if (lauf.popZahl > bekanntPops) {
      // Ein Ring an der Kante und ein paar goldene Funken: der Pop hat geklappt.
      teilchen.ring(lauf.popX, bodenHoehe(g, lauf.popX), '#ffc233');
      teilchen.funken(lauf.popX, bodenHoehe(g, lauf.popX) + 0.1, 9, '#ffd36b', 1);
    }
    bekanntPops = lauf.popZahl;

    // Zurückfedern bzw. Ausklingen.
    federVorn = Math.max(0, federVorn - dt * 3.4);
    federHinten = Math.max(0, federHinten - dt * 3.1);
    schuettelStaerke = Math.max(0, schuettelStaerke - dt * 5);
    // Schnell ausklingend — rund 150 ms, ein Wimpernschlag, kein Dauerglühen.
    blitzStaerke = Math.max(0, blitzStaerke - dt * 6.5);
    const boostZiel = lauf.boost > 0 ? 1 : 0;
    boostAnim += (boostZiel - boostAnim) * Math.min(1, dt * (boostZiel > boostAnim ? 14 : 3.5));

    /*
     * Erdkrümel hinterm Hinterrad bei zügigem Tempo am Boden: Bei Tempo
     * eines alle 0,06 s, mit Boost doppelt so viele. Sie fliegen nach hinten
     * und oben und haben die Farbe der Erde, über die man gerade fährt.
     */
    roostUhr += dt;
    if (lauf.amBoden && lauf.vx > 7 && roostUhr > 0.06) {
      roostUhr = 0;
      teilchen.erde(hintenX, bodenHoehe(g, hintenX), lauf.boost > 0 ? 2 : 1, lauf.vx, palette.boden.oben, 0.65);
    }
    teilchen.schritt(dt);

    // --- Der Sturz: Fahrer löst sich vom Rad -----------------------
    const gestuerzt = lauf.vorbei && !lauf.gewonnen;
    if (!gestuerzt) {
      sturzFahrer = null;
      letztesVx = lauf.vx;
    } else {
      if (!sturzFahrer) {
        // Die Hüfte sitzt rund 1,4 m über dem Boden des Rades, mal Fahrzeuggröße.
        const hx = -0.05 * FAHRZEUG_GROESSE;
        const hy = 1.44 * FAHRZEUG_GROESSE;
        const c = Math.cos(lauf.winkel);
        const sn = Math.sin(lauf.winkel);
        const tempo = Math.min(14, Math.max(4, letztesVx));
        sturzFahrer = {
          x: lauf.x + hx * c - hy * sn,
          y: lauf.y + hx * sn + hy * c,
          vx: tempo * 0.8,
          vy: 2.2 + Math.max(0, lauf.vy),
          drehung: lauf.winkel,
          drehTempo: 4.6,
          schlaff: 0,
          aufgeschlagen: false,
          zeit: 0,
        };
        // Der Aufprall des Rades hat schon Krümel geworfen; der Fahrer
        // bekommt seinen eigenen, wenn er aufschlägt (siehe unten).
      }
      const f = sturzFahrer;
      f.zeit += dt;
      f.vy -= 22 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.drehung += f.drehTempo * dt;
      // Der Körper liegt mit der Zeit flacher auf dem Boden: Der Abstand der
      // Hüfte zum Boden schrumpft von „aufrecht" auf „liegend".
      const abstand = 0.85 + (0.3 - 0.85) * f.schlaff;
      const boden = bodenHoehe(g, f.x) + abstand;
      if (f.y <= boden) {
        f.y = boden;
        if (!f.aufgeschlagen) {
          f.aufgeschlagen = true;
          teilchen.erde(f.x, boden - abstand, 9, f.vx, palette.boden.oben, 1.1);
          teilchen.staub(f.x, boden - abstand, 3, mischen(palette.boden.saum, '#ffffff', 0.2));
          schuettelStaerke = Math.min(1, schuettelStaerke + 0.5);
        }
        f.vy = f.vy < -2 ? -f.vy * 0.28 : 0;
        f.vx *= Math.exp(-2.4 * dt);
        f.drehTempo *= Math.exp(-3.2 * dt);
        f.schlaff = Math.min(1, f.schlaff + dt * 1.8);
        // Zur Ruhe kommen: auf den nächsten liegenden Winkel (Kopf nach vorn).
        if (f.drehTempo < 1.2) {
          const ziel = Math.round((f.drehung - Math.PI / 2) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 2;
          f.drehung += (ziel - f.drehung) * Math.min(1, dt * 6);
        }
      }
    }

    // Reines Bildschirm-Zittern, keine Spielregel — aus dem festen Generator
    // und nicht `Math.random`, damit zwei Läufe dasselbe Bild zeigen.
    const schuettelX = schuettelStaerke > 0 ? (zufall() - 0.5) * schuettelStaerke * 14 : 0;
    const schuettelY = schuettelStaerke > 0 ? (zufall() - 0.5) * schuettelStaerke * 10 : 0;

    /**
     * Weltkoordinaten → Bildpunkte. `y` wird dabei umgedreht.
     *
     * Der Bezugspunkt liegt bei 74 % der Bildhöhe, nicht bei 62 %: Unter
     * dem Rad braucht man nur so viel Boden, dass er nicht abgeschnitten
     * wirkt — darüber dagegen die ganze Flugbahn.
     */
    const bx = (x: number) => (x - kameraX) * proMeter + breite * 0.5 + schuettelX;
    const by = (y: number) => hoehe * 0.74 - (y - kameraY) * proMeter + schuettelY;

    ctx.setTransform(pixelDichte, 0, 0, pixelDichte, 0, 0);
    ctx.clearRect(0, 0, breite, hoehe);

    const buehne: Buehne = { ctx, breite, hoehe, proMeter, kameraX, g, p: palette, uhr, bx, by };

    // --- Himmel: fest am Bildschirm ---------------------------------
    himmelZeichnen(buehne);

    // --- Das Gelände ----------------------------------------------
    /*
     * Der Umriss wird alle vier Bildpunkte abgetastet, nicht je Meter:
     * So ist die Linie immer glatt, egal wie weit die Kamera weg ist,
     * und die Zahl der Punkte hängt an der Bildbreite statt an der
     * Sichtweite.
     */
    const umriss: [number, number, number][] = [];
    for (let px = -12; px <= breite + 12; px += 4) {
      const wx = kameraX + (px - breite * 0.5) / proMeter;
      umriss.push([px, by(bodenHoehe(g, wx)), wx]);
    }

    /*
     * Nah an einem Kicker? Steuert den Grasstrich (setzt an einem Kicker
     * aus, kahle Erde statt Wiese). `1,3×` Breite deckt sowohl die Anfahrt
     * als auch die Landeseite der Glocke ab, nicht nur den Gipfel.
     */
    const aufKicker = (wx: number) => g.kicker.some((k) => Math.abs(wx - k.x) < k.breite * 1.3);

    bodenZeichnen(buehne, umriss, aufKicker);
    bodenSteine(buehne, aufKicker, sicht);
    grasBandZeichnen(buehne, umriss, aufKicker);
    grasZeichnen(buehne, aufKicker, sicht);

    // --- Wegmarken: Start, Distanztafeln, Ziel ----------------------
    if (kameraX - sicht * 0.6 < START_TOR_X + 2) tor(buehne, START_TOR_X, false);
    wegmarken(buehne, sicht);
    if (kameraX + sicht * 0.6 > g.laenge - 4) tor(buehne, g.laenge, true);

    // --- Auf der Strecke: Marken, Boost, Schatten, Münzen -----------
    absprungMarken(buehne, lauf, sicht);
    padsZeichnen(buehne, lauf, sicht);
    schattenZeichnen(buehne, lauf, RADSTAND, FAHRZEUG_GROESSE);
    muenzenZeichnen(buehne, lauf, sicht);

    // Erde hinter dem Rad, vor dem Boden.
    teilchen.zeichnen(buehne, 'boden');

    // --- Räder --------------------------------------------------------
    // Federung und Kamera-Wackeln sind schon berechnet (siehe oben).
    // Räder drehen sich mit dem Tempo — Umfang 2πr. Bei Rückwärtsrollen
    // (negatives `vx`, siehe `logik.ts`) läuft das von selbst rückwärts.
    radDrehung += (lauf.vx / RAD_R) * dt;

    // --- Haltung des Fahrers ---------------------------------------
    /*
     * Wer schnell ist oder in der Luft, steht auf den Pedalen (Angriffs-
     * haltung); wer langsam rollt, sitzt. Der Übergang ist gedämpft, sonst
     * federte der Fahrer bei jeder Temposchwelle ruckartig hoch.
     */
    const stehZiel = !lauf.amBoden ? 1 : lauf.vx > 9 ? 1 : lauf.vx > 5 ? (lauf.vx - 5) / 4 : 0;
    stehenAnim += (stehZiel - stehenAnim) * Math.min(1, dt * 5);
    /*
     * Gewicht: In der Luft folgt es der Drehung — wer „Hinten" gedrückt hat,
     * dreht das Rad nach oben (positive Drehrate) und verlagert sich nach
     * hinten. Am Boden folgt es dem Hang: bergauf nach vorn über den Lenker,
     * bergab nach hinten über das Hinterrad, wie jeder echte Fahrer.
     */
    const gewichtZiel = lauf.amBoden
      ? Math.max(-1, Math.min(1, bodenSteigung(g, lauf.x) * 2.2))
      : Math.max(-1, Math.min(1, -lauf.drehen / 5));
    gewichtAnim += (gewichtZiel - gewichtAnim) * Math.min(1, dt * (lauf.amBoden ? 5 : 9));
    const pose: FahrerPose = {
      stehen: stehenAnim,
      hocke: Math.min(1, (federVorn + federHinten) * 0.5 + (lauf.amBoden ? 0 : 0.4)),
      gewicht: gewichtAnim,
      streck: Math.pow(Math.max(0, lauf.popRest) / 0.8, 1.4),
      kurbel: radDrehung * 0.22,
      wind: Math.max(0, Math.min(1, (lauf.vx - 5) / 13)),
      zeit: uhr,
    };

    // --- Fahrrad und Fahrer ----------------------------------------
    radFahrerZeichnen(ctx, lauf, {
      px: bx(lauf.x),
      py: by(lauf.y),
      proMeter,
      federVorn,
      federHinten,
      radDrehung,
      pose,
      ohneFahrer: sturzFahrer !== null,
    });
    if (sturzFahrer) {
      ctx.save();
      ctx.translate(bx(sturzFahrer.x), by(sturzFahrer.y));
      ctx.rotate(sturzFahrer.drehung);
      ctx.scale(FAHRZEUG_GROESSE, FAHRZEUG_GROESSE);
      fahrerSturz(ctx, proMeter, sturzFahrer.zeit, sturzFahrer.schlaff);
      ctx.restore();
    }

    // --- Licht und Bildabschluss ------------------------------------
    scheinwerfer(buehne, lauf, 1.15, 1.45);
    teilchen.zeichnen(buehne, 'licht');
    tempoStriche(buehne, boostAnim);
    bildAbschluss(buehne);

    // --- Lichtblitz bei perfekter Landung, ganz zum Schluss ---------
    // In Bildschirmkoordinaten (nicht Weltkoordinaten) — er soll das
    // ganze Bild gleichmäßig aufhellen, nicht mit der Kamera mitwandern.
    if (blitzStaerke > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(blitzStaerke * 0.12).toFixed(3)})`;
      ctx.fillRect(0, 0, breite, hoehe);
    }
  };

  return { zeichnen, groesseAendern };
}

// ---------------------------------------------------------------------
// Boden
// ---------------------------------------------------------------------

/**
 * Der Erdkörper in Schichten, mit Körnung und Tiefe.
 *
 * Recherche zu anderen 2D-Bike-Spielen (Trials, Bike Mayhem, Mad Skills BMX 2)
 * zeigt durchgehend **drei bis vier** Farbflächen übereinander, nie nur zwei:
 * ein geschichteter Look statt zweier Aufkleber, dazu ein heller Saum direkt
 * unter der Grasnarbe.
 *
 * **Die Reihenfolge ist hier kein Zufall.** Jede Schicht füllt von ihrem
 * eigenen Versatz bis zum unteren Bildrand — eine später gezeichnete Schicht
 * übermalt also alles darunter. Sichtbar bleibt von jeder Schicht nur das Band
 * bis zur **nächsten**; die Versätze müssen deshalb **aufsteigend** gezeichnet
 * werden, sonst verschluckt eine später gezeichnete, aber weiter oben
 * ansetzende Schicht alle vorherigen sofort wieder.
 *
 * Die obere Schicht wird segmentweise gefüllt, mit dem Ton aus der echten
 * Steigung an der Stelle (`bodenSteigung`, exakt, nicht geschätzt): steile
 * Anstiege liegen dunkler, wie im eigenen Schatten. Nur diese eine, weil sie
 * den größten Teil des sichtbaren Bodens ausmacht.
 *
 * Über allem liegt eine **Körnung**, die mit der Welt wandert (siehe
 * `bodenMuster`), und ein Verlauf nach unten: Je tiefer, desto dunkler. Eine
 * flache Farbfläche ist Pappe; Erde hat Korn und Tiefe.
 */
function bodenZeichnen(
  b: Buehne,
  umriss: readonly (readonly [number, number, number])[],
  _aufKicker: (wx: number) => boolean,
) {
  const { ctx, breite, hoehe, proMeter: m, p, g } = b;

  /** Füllt die Fläche unter dem Umriss, um `versatz` Meter nach unten verschoben. */
  const flaeche = (farbe: string, versatz: number) => {
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.moveTo(umriss[0]![0], umriss[0]![1] + versatz * m);
    for (const [px, py] of umriss) ctx.lineTo(px, py + versatz * m);
    ctx.lineTo(breite + 12, hoehe);
    ctx.lineTo(-12, hoehe);
    ctx.closePath();
    ctx.fill();
  };

  flaeche(p.boden.tief, 0); // Sicherheitsgrund, wird komplett überdeckt
  flaeche(p.boden.saum, 0); // der helle Saum unter dem Gras

  // Obere Schicht, nach Steigung getönt.
  const oben = 0.16;
  for (let i = 0; i < umriss.length - 1; i++) {
    const [px1, py1, wx1] = umriss[i]!;
    const [px2, py2, wx2] = umriss[i + 1]!;
    const steigung = bodenSteigung(g, (wx1 + wx2) / 2);
    const ton = Math.min(0.32, Math.abs(steigung) * 0.16);
    ctx.fillStyle = mischen(p.boden.oben, '#000000', ton);
    ctx.beginPath();
    ctx.moveTo(px1, py1 + oben * m);
    ctx.lineTo(px2, py2 + oben * m);
    ctx.lineTo(px2, hoehe);
    ctx.lineTo(px1, hoehe);
    ctx.closePath();
    ctx.fill();
  }

  flaeche(p.boden.rost, 0.75);
  flaeche(p.boden.tief, 1.45);

  // Die Schichtgrenzen bekommen eine feine dunkle Kante — wie ein
  // Erdprofil im Anschnitt.
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = Math.max(1, 0.03 * m);
  for (const versatz of [0.75, 1.45]) {
    ctx.beginPath();
    ctx.moveTo(umriss[0]![0], umriss[0]![1] + versatz * m);
    for (const [px, py] of umriss) ctx.lineTo(px, py + versatz * m);
    ctx.stroke();
  }

  // Körnung und Tiefe, beides nur innerhalb des Erdkörpers.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(umriss[0]![0], umriss[0]![1]);
  for (const [px, py] of umriss) ctx.lineTo(px, py);
  ctx.lineTo(breite + 12, hoehe);
  ctx.lineTo(-12, hoehe);
  ctx.closePath();
  ctx.clip();

  const kachel = bodenMuster(p);
  const muster = ctx.createPattern(kachel, 'repeat');
  if (muster) {
    const S = kachel.width;
    // Das Muster hängt am Weltursprung (`bx(0)`, `by(0)`), nicht am Bildschirm:
    // So wandert es mit dem Boden und rutscht auch beim Wackeln nicht darüber.
    const ox = (((b.bx(0) % S) + S) % S) - S;
    const oy = (((b.by(0) % S) + S) % S) - S;
    ctx.translate(ox, oy);
    ctx.fillStyle = muster;
    ctx.fillRect(0, 0, breite + 2 * S, hoehe + 2 * S);
    ctx.translate(-ox, -oy);
  }
  const tiefe = ctx.createLinearGradient(0, hoehe * 0.58, 0, hoehe);
  tiefe.addColorStop(0, 'rgba(0,0,0,0)');
  tiefe.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = tiefe;
  ctx.fillRect(0, hoehe * 0.58, breite, hoehe * 0.42);
  ctx.restore();
}

/**
 * Der Grasstreifen obenauf — und der festgefahrene Pfad an den Kickern.
 *
 * **Das Gras setzt an Kickern aus.** Trials, Bike Mayhem und Mad Skills BMX 2
 * zeigen an Sprungschanzen durchgehend kahle Erde statt Gras — in der Fiktion
 * fährt dort ständig jemand drüber. Ohne diesen Unterschied sieht ein Kicker
 * aus wie ein normaler Hügel und ist erst an der eigenen Flugbahn als Sprung
 * zu erkennen, nicht schon vorher am Bild.
 */
function grasBandZeichnen(
  b: Buehne,
  umriss: readonly (readonly [number, number, number])[],
  aufKicker: (wx: number) => boolean,
) {
  const { ctx, proMeter: m, p } = b;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /** Zeichnet eine Linie entlang des Umrisses, nur über Stücke mit `kicker` als Wert. */
  const entlang = (farbe: string, dicke: number, versatz: number, kicker: boolean) => {
    ctx.strokeStyle = farbe;
    ctx.lineWidth = Math.max(2, dicke * m);
    ctx.beginPath();
    let offen = false;
    for (const [px, py, wx] of umriss) {
      if (aufKicker(wx) !== kicker) {
        if (offen) {
          ctx.stroke();
          ctx.beginPath();
          offen = false;
        }
        continue;
      }
      if (!offen) {
        ctx.moveTo(px, py + versatz * m);
        offen = true;
      } else ctx.lineTo(px, py + versatz * m);
    }
    if (offen) ctx.stroke();
  };

  // Gras: dunkles Band, darauf ein heller Streifen — die Kuppe im Sonnenlicht.
  entlang(p.gras[2], 0.17, 0.02, false);
  entlang(p.gras[0], 0.13, -0.005, false);
  entlang(p.gras[1], 0.05, -0.045, false);

  // Festgefahrener Pfad auf den Kickern: heller Saum mit Spurrillen.
  entlang(mischen(p.boden.saum, '#000000', 0.12), 0.15, 0.02, true);
  entlang(p.boden.saum, 0.11, -0.005, true);
  entlang(mischen(p.boden.saum, '#ffffff', 0.25), 0.035, -0.04, true);
}

/**
 * Zeichnet Rad und Fahrer.
 *
 * Ronnis Prioritäten, wörtlich: „1. Fahrrad, 2. Fahrer, 3. Animation."
 *
 * **Die erste Fassung war ein Strichfahrrad — und genau so sah sie aus.**
 * Rückmeldung: „Das ist ein Fahrrad mit drei Strichen. Das ist nicht gut."
 * Der Fehler war, alles mit `stroke` zu zeichnen: Eine Linie hat überall
 * dieselbe Breite und kein Volumen, egal wie dick man sie macht. Jetzt ist
 * jedes Teil eine **gefüllte Fläche** mit eigener Licht- und Schattenkante
 * — Rohre verjüngen sich, Reifen haben Profil, die Federelemente bestehen
 * aus zwei ineinander laufenden Rohren.
 *
 * Die Federung ist dabei kein Beiwerk: „Das Fahrrad soll eine Federung
 * richtig haben, vorne und hinten." Vorn taucht das Standrohr sichtbar ins
 * Tauchrohr ein, hinten schwingt der ganze Hinterbau um das Tretlager und
 * staucht dabei den Dämpfer. Beides bewegt sich bei jeder Landung.
 */
function radFahrerZeichnen(
  ctx: CanvasRenderingContext2D,
  lauf: Pick<Lauf, 'winkel' | 'vorbei' | 'gewonnen' | 'sturzZeit'>,
  o: {
    px: number;
    py: number;
    proMeter: number;
    federVorn: number;
    federHinten: number;
    radDrehung: number;
    pose: FahrerPose;
    /** Beim Sturz fliegt der Fahrer für sich — dann zeichnet nur das Rad. */
    ohneFahrer?: boolean;
  },
) {
  const { px, py, proMeter, federVorn, federHinten, radDrehung, pose } = o;
  const m = proMeter;

  ctx.save();
  ctx.translate(px, py);
  /*
   * Rückmeldung: „Falls man stürzt, soll es nicht im letzten Moment
   * abbrechen, sondern man soll sehen, wie der Typ stürzt." Der erste
   * Versuch drehte schnell auf 1,5 Radiant hoch (in 0,44 s) und blieb
   * dann bis zum Rundenende-Bildschirm bei `FlowMtb.tsx` (1,1 s
   * Verzögerung) einfach stehen — genau das las sich wie ein Abbruch,
   * nicht wie ein Sturz. Jetzt dreht es über die **ganze** Verzögerung
   * weiter, zusammen mit dem Ausrutschen aus `takt`.
   */
  const sturzDreh = lauf.vorbei && !lauf.gewonnen ? Math.min(5.6, lauf.sturzZeit * 5.1) : 0;
  // Bildschirm-y zeigt nach unten, Physik-y nach oben — deshalb das Minus.
  ctx.rotate(-lauf.winkel + sturzDreh);
  ctx.scale(FAHRZEUG_GROESSE, FAHRZEUG_GROESSE);

  const radR = RAD_R * m;
  const hintenX = -RADSTAND * 0.52 * m;
  const vornX = RADSTAND * 0.48 * m;
  const nabeY = -radR;

  /** Federweg vorn: das Standrohr taucht ein, das Vorderrad rückt hoch. */
  const wegVorn = federVorn * 0.11 * m;
  /** Federweg hinten: der Rahmen sinkt, der Hinterbau schwingt. */
  const wegHinten = federHinten * 0.1 * m;

  /**
   * Ein Rohr — mit **Querverlauf**, und genau daran hängt alles.
   *
   * Die erste Fassung füllte einfarbig und setzte eine helle Linie an die
   * Oberkante. Eine einfarbige Fläche ist aber ein Band, kein Rohr, egal
   * wie gut die Geometrie stimmt — das war der eigentliche Grund für den
   * „drei Striche"-Eindruck.
   *
   * Zwei Dinge machen daraus ein rundes Rohr:
   *
   * 1. **Der Verlauf läuft quer zur Rohrachse**, nicht längs. Die
   *    Normale `(−dy, dx)/L` steht senkrecht auf der Achse; entlang dieser
   *    Achse ändert sich der Verlaufswert nicht, quer dazu voll.
   * 2. **Das Glanzband sitzt bei 18 %, nicht am Rand.** Ein Zylinder hat
   *    seinen hellsten Streifen nicht an der Silhouette — dort fällt das
   *    Licht schon wieder ab. Genau diese Asymmetrie liest das Auge als
   *    Wölbung; ein gleichmäßiger Verlauf von hell nach dunkel wirkt
   *    weiter flach, nur schräg beleuchtet.
   *
   * Dazu eine dunkle Kontur: erst den Pfad dick dunkel stricheln, dann
   * die Füllung darüber. Der Strich ragt zur Hälfte nach außen, innen
   * deckt ihn die Füllung ab — das ergibt eine gleichmäßige Umrandung
   * statt zweier sichtbarer Bänder.
   */
  const rohr = (
    ax: number,
    ay: number,
    bx2: number,
    by2: number,
    dickeA: number,
    dickeB: number,
    grund: string,
    kontur = true,
  ) => {
    const dx = bx2 - ax;
    const dy = by2 - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const pfad = () => {
      ctx.beginPath();
      ctx.moveTo(ax + nx * dickeA, ay + ny * dickeA);
      ctx.lineTo(bx2 + nx * dickeB, by2 + ny * dickeB);
      ctx.lineTo(bx2 - nx * dickeB, by2 - ny * dickeB);
      ctx.lineTo(ax - nx * dickeA, ay - ny * dickeA);
      ctx.closePath();
    };

    if (kontur) {
      pfad();
      ctx.strokeStyle = '#0b0d11';
      ctx.lineWidth = Math.max(1.5, dickeA * 0.42);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    /*
     * Die Verlaufsachse wird an der **festen Lichtrichtung** (oben links)
     * ausgerichtet: `seite` ist das Skalarprodukt aus Normale und Licht.
     * Ohne das glänzt jedes Rohr für sich, und das Rad zerfällt in lauter
     * einzeln beleuchtete Teile — dieselbe Regel wie bei den App-Symbolen
     * in `core/AppSymbol.tsx`.
     */
    const seite = nx * -0.55 + ny * -0.84 >= 0 ? 1 : -1;
    const mx = (ax + bx2) / 2;
    const my = (ay + by2) / 2;
    const dM = ((dickeA + dickeB) / 2) * seite;
    const g2 = ctx.createLinearGradient(mx + nx * dM, my + ny * dM, mx - nx * dM, my - ny * dM);
    g2.addColorStop(0, mischen(grund, '#ffffff', 0.1));
    g2.addColorStop(0.18, mischen(grund, '#ffffff', 0.5));
    g2.addColorStop(0.45, grund);
    g2.addColorStop(0.82, mischen(grund, '#000000', 0.42));
    g2.addColorStop(1, mischen(grund, '#000000', 0.6));

    pfad();
    ctx.fillStyle = g2;
    ctx.fill();
  };

  // ---------------------------------------------------------------
  // Laufräder
  // ---------------------------------------------------------------
  const laufrad = (rx: number, ry: number) => {
    // Die Reifenbasis zuerst — die Stollen kommen später obendrauf.
    // Andersherum (Stollen zuerst) verschluckt die breite Lauffläche eine
    // innere Stollenreihe komplett, weil sie darüber gezeichnet würde.
    ctx.strokeStyle = FARBEN.reifen;
    ctx.lineWidth = radR * 0.22;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.87, 0, Math.PI * 2);
    ctx.stroke();

    // Seitenwand: ein schmaler, hellerer Ring zwischen Lauffläche und
    // Felge — ohne ihn ist der Reifen eine reine Silhouette ohne Flanke.
    ctx.strokeStyle = mischen(FARBEN.reifen, '#ffffff', 0.3);
    ctx.lineWidth = Math.max(1, radR * 0.03);
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.81, 0, Math.PI * 2);
    ctx.stroke();

    /*
     * Stollenprofil in **zwei** Reihen statt einer: außen größere
     * Schulterstollen ganz am Rand, innen kleinere, um eine halbe
     * Teilung versetzte Stollen dazwischen. Ein einzelner Kranz aus
     * Zacken liest sich eher wie ein Zahnrad als wie ein Reifen — das
     * Doppelmuster ist, was einen MTB-Reifen von einem glatten Ring
     * unterscheidet.
     */
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(radDrehung);
    ctx.fillStyle = FARBEN.profil;
    const stollen = 16;
    const stollenReihe = (radius: number, versatz: number, laenge: number, breite: number) => {
      for (let i = 0; i < stollen; i++) {
        const w = ((i + versatz) / stollen) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(w) * radius, Math.sin(w) * radius);
        ctx.rotate(w);
        ctx.fillRect(-laenge * 0.25, -breite / 2, laenge, breite);
        ctx.restore();
      }
    };
    // Äußere Reihe: große Schulterstollen, deutlich über die Lauffläche hinaus.
    stollenReihe(radR * 0.96, 0, radR * 0.21, radR * 0.22);
    // Innere Reihe: kleinere, versetzte Mittelstollen.
    stollenReihe(radR * 0.9, 0.5, radR * 0.15, radR * 0.17);
    ctx.restore();

    // Felge.
    ctx.strokeStyle = FARBEN.felge;
    ctx.lineWidth = radR * 0.09;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.74, 0, Math.PI * 2);
    ctx.stroke();

    /*
     * Speichen — **versetzt angesetzt, nicht durch die Mitte.**
     *
     * Der erste Versuch zog sechs Linien als volle Durchmesser durch die
     * Nabe. Das liest sich als Stern, nicht als Laufrad, und beim Drehen
     * passiert optisch fast nichts, weil ein Stern aus Durchmessern
     * punktsymmetrisch ist. Eine echte Speiche läuft **schräg** von der
     * Nabe zur Felge; zehn davon, jede um denselben Winkel versetzt,
     * ergeben das typische Muster.
     */
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(radDrehung);
    ctx.strokeStyle = 'rgba(226,231,238,0.8)';
    ctx.lineWidth = Math.max(0.8, radR * 0.035);
    const speichen = 10;
    ctx.beginPath();
    for (let i = 0; i < speichen; i++) {
      const w = (i / speichen) * Math.PI * 2;
      // Der Versatz von 0,3 Radiant an der Nabe ist die Schrägstellung.
      ctx.moveTo(Math.cos(w + 0.3) * radR * 0.14, Math.sin(w + 0.3) * radR * 0.14);
      ctx.lineTo(Math.cos(w) * radR * 0.72, Math.sin(w) * radR * 0.72);
    }
    ctx.stroke();
    /*
     * Bremsscheibe: gefüllt statt nur ein Kreis-Strich, mit Schlitzen —
     * ein reiner Ring liest sich als dünner Reifenaufkleber, keine Scheibe.
     */
    ctx.fillStyle = '#8a909a';
    ctx.beginPath();
    ctx.arc(0, 0, radR * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c6169';
    ctx.lineWidth = Math.max(0.8, radR * 0.02);
    ctx.stroke();

    const schlitze = 8;
    ctx.strokeStyle = '#3a3d43';
    ctx.lineWidth = Math.max(1, radR * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < schlitze; i++) {
      const w = (i / schlitze) * Math.PI * 2;
      ctx.moveTo(Math.cos(w) * radR * 0.16, Math.sin(w) * radR * 0.16);
      ctx.lineTo(Math.cos(w) * radR * 0.32, Math.sin(w) * radR * 0.32);
    }
    ctx.stroke();

    // Zentrumsloch, wo die Nabe drübersitzt.
    ctx.fillStyle = FARBEN.profil;
    ctx.beginPath();
    ctx.arc(0, 0, radR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Nabe.
    ctx.fillStyle = FARBEN.nabe;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.13, 0, Math.PI * 2);
    ctx.fill();
  };

  const nabeHinten = nabeY + wegHinten * 0.35;
  const nabeVorn = nabeY + wegVorn;
  laufrad(hintenX, nabeHinten);
  laufrad(vornX, nabeVorn);

  // ---------------------------------------------------------------
  // Rahmengeometrie
  // ---------------------------------------------------------------
  /** Das Tretlager — der Punkt, um den der Hinterbau schwingt. */
  const tretlager = { x: -0.08 * m, y: nabeY - 0.05 * m + wegHinten };
  /** Oben am Sattelrohr. */
  const sattel = { x: -0.44 * m, y: tretlager.y - 0.54 * m };
  /** Steuerkopf — hier sitzt die Gabel. */
  const steuerkopf = { x: vornX - 0.1 * m, y: tretlager.y - 0.5 * m };
  /** Oberes Ende der Gabel, knapp unter dem Steuerkopf. */
  const gabelOben = { x: steuerkopf.x + 0.02 * m, y: steuerkopf.y + 0.06 * m };

  /*
   * --- Doppelbrücken-Federgabel ---
   *
   * Ronnis ausdrücklicher Wunsch: „Das Fahrrad soll eine Doppelfedergabel
   * haben." Das ist die Downhill-Bauart: Die Standrohre laufen **oben am
   * Steuerkopf vorbei** und sind dort von *zwei* Brücken gehalten — einer
   * unter und einer über dem Steuerrohr. Genau diese zweite Brücke über
   * dem Steuerkopf unterscheidet sie von jeder normalen Gabel und macht
   * sie auf den ersten Blick erkennbar.
   *
   * Der Aufbau von unten nach oben: dickes Tauchrohr am Rad, darin das
   * dünnere Standrohr, das beim Einfedern darin verschwindet. Der
   * sichtbare Rest des Standrohrs **ist** der Federweg.
   */
  /*
   * Der sichtbare Federweg. Deutlich länger als beim ersten Versuch
   * (0,34 m) — Rückmeldung: „Das Fahrrad soll eine viel größere
   * Federgabel vorne haben." Eine echte Downhill-Gabel hat rund 200 mm
   * Federweg und entsprechend lange Rohre; das ist das Bauteil, an dem
   * man ein Downhill-Rad überhaupt erkennt.
   */
  const gabelOffen = 0.52 * m - wegVorn;
  /** Wo das Standrohr aus dem Tauchrohr kommt. */
  const tauchOben = {
    x: vornX + (gabelOben.x - vornX) * 0.46,
    y: nabeVorn + (gabelOben.y - nabeVorn) * 0.46,
  };
  /** Das obere Ende der Standrohre, über dem Steuerkopf. */
  const standOben = { x: gabelOben.x + 0.02 * m, y: gabelOben.y - gabelOffen * 0.45 };

  // Tauchrohr (unten, dick, dunkel).
  rohr(
    vornX,
    nabeVorn,
    tauchOben.x,
    tauchOben.y,
    0.075 * m,
    0.08 * m,
    FARBEN.federDunkel,
  );
  // Kleiner Decal-Sticker aufs Tauchrohr — reine Markenzeichen-Anmutung,
  // sitzt schräg entlang der Rohrachse wie ein echter Federgabel-Aufkleber.
  {
    const dx = tauchOben.x - vornX;
    const dy = tauchOben.y - nabeVorn;
    ctx.save();
    ctx.translate(vornX + dx * 0.42, nabeVorn + dy * 0.42);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = FARBEN.akzent;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.05 * m, 0.017 * m, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Standrohr (oben, dünner, glänzend hell) — läuft bis über den Steuerkopf.
  rohr(
    tauchOben.x,
    tauchOben.y,
    standOben.x,
    standOben.y,
    0.056 * m,
    0.056 * m,
    FARBEN.federHell,
  );
  // Untere Brücke, direkt unter dem Steuerrohr. Etwas massiver als beim
  // ersten Wurf (0,05 m → 0,062 m dick, ±0,085 m → ±0,095 m breit), damit
  // sie klar als eigenes Bauteil auffällt statt als bloße Rohrverdickung.
  rohr(
    gabelOben.x - 0.095 * m,
    gabelOben.y + 0.02 * m,
    gabelOben.x + 0.095 * m,
    gabelOben.y + 0.005 * m,
    0.062 * m,
    0.062 * m,
    FARBEN.rahmenDunkel,
  );
  // **Obere Brücke** — das Erkennungsmerkmal der Doppelbrückengabel,
  // ebenfalls etwas kräftiger als zuvor.
  rohr(
    standOben.x - 0.095 * m,
    standOben.y + 0.015 * m,
    standOben.x + 0.095 * m,
    standOben.y,
    0.055 * m,
    0.055 * m,
    FARBEN.rahmenDunkel,
  );

  // --- Hinterbau: Kettenstrebe und Sitzstrebe ---
  rohr(
    tretlager.x,
    tretlager.y,
    hintenX,
    nabeHinten,
    0.055 * m,
    0.035 * m,
    FARBEN.rahmenDunkel,
  );
  const sitzstrebeOben = { x: sattel.x + 0.1 * m, y: sattel.y + 0.2 * m };
  rohr(
    hintenX,
    nabeHinten,
    sitzstrebeOben.x,
    sitzstrebeOben.y,
    0.032 * m,
    0.042 * m,
    FARBEN.rahmenDunkel,
  );

  // --- Der Dämpfer, sichtbar gestaucht ---
  /*
   * Er sitzt schräg im Hauptdreieck und wird beim Einfedern kürzer. Weil
   * `sitzstrebeOben` am Hinterbau hängt und der mit `wegHinten` schwingt,
   * ergibt sich die Stauchung von selbst — sie muss nicht extra gerechnet
   * werden.
   */
  const daempferA = { x: tretlager.x - 0.04 * m, y: tretlager.y - 0.14 * m };
  const daempferB = { x: sattel.x + 0.16 * m, y: sattel.y + 0.3 * m };
  // Der Dämpferkörper selbst wird **zwischen** den beiden Federhälften
  // gezeichnet, siehe unten — nicht hier davor.
  /*
   * --- Die Schraubenfeder um den Dämpfer ---
   *
   * Ronni: „hinten eine Spirale." Sie ist als echte Wendel gezeichnet,
   * nicht als Zickzack: Jede Windung ist ein halber Bogen, dessen Breite
   * quer zum Dämpfer steht. Dadurch sieht man beim Einfedern, wie die
   * Windungen **enger zusammenrücken** — genau das macht eine Feder
   * sichtbar, ein Zickzack tut das nicht.
   */
  const fedDx = daempferB.x - daempferA.x;
  const fedDy = daempferB.y - daempferA.y;
  const fedLen = Math.hypot(fedDx, fedDy) || 1;
  const ux = fedDx / fedLen;
  const uy = fedDy / fedLen;
  // Einheitsvektor quer zur Federachse.
  const qx = -uy;
  const qy = ux;
  const fedRadius = 0.1 * m;
  /**
   * **Die Windungszahl ist fest — nur der Abstand ändert sich.**
   *
   * Das ist der ganze Unterschied zwischen „Feder" und „Gummiband". Beim
   * Einfedern rücken die Windungen zusammen, es werden nie weniger. Die
   * erste Fassung interpolierte stattdessen die Punkte über die
   * Dämpferlänge — dabei wurde die Feder beim Einfedern nur kürzer, und
   * genau die Bewegung, die man sehen will, fehlte.
   */
  const windungen = 6;
  const federPunkte: { x: number; y: number; tiefe: number }[] = [];
  const schritte = windungen * 14;
  for (let i = 0; i <= schritte; i++) {
    const t = i / schritte;
    const winkel = t * windungen * Math.PI * 2;
    federPunkte.push({
      x: daempferA.x + ux * (t * fedLen) + qx * Math.cos(winkel) * fedRadius,
      y: daempferA.y + uy * (t * fedLen) + qy * Math.cos(winkel) * fedRadius,
      // Größer null heißt: diese Windung läuft gerade vor dem Dämpfer
      // vorbei, kleiner null dahinter.
      tiefe: Math.sin(winkel),
    });
  }

  /*
   * In drei Lagen zeichnen: hintere Windungshälften, dann der
   * Dämpferkörper, dann die vorderen. Erst dadurch wickelt sich die Feder
   * sichtbar **um** den Dämpfer, statt daneben zu liegen.
   */
  const federTeil = (vorne: boolean, farbe: string, dicke: number) => {
    ctx.strokeStyle = farbe;
    ctx.lineWidth = dicke;
    ctx.lineCap = 'round';
    let offen = false;
    ctx.beginPath();
    for (const p of federPunkte) {
      const dran = vorne ? p.tiefe >= 0 : p.tiefe < 0;
      if (!dran) {
        // Am Vorzeichenwechsel den Strich absetzen, sonst zieht eine
        // Linie quer durch den Dämpfer.
        if (offen) {
          ctx.stroke();
          ctx.beginPath();
          offen = false;
        }
        continue;
      }
      if (!offen) {
        ctx.moveTo(p.x, p.y);
        offen = true;
      } else ctx.lineTo(p.x, p.y);
    }
    if (offen) ctx.stroke();
  };

  // Etwas kräftiger als beim ersten Wurf (Dicke + vorderer Multiplikator
  // beide angehoben, vorderer Bogen zusätzlich leicht aufgehellt) — die
  // Akzentfarbe soll auf den ersten Blick als Feder erkennbar sein, nicht
  // nur bei genauem Hinsehen.
  const federDicke = Math.max(2, 0.034 * m);
  federTeil(false, mischen(FARBEN.akzent, '#000000', 0.42), federDicke);
  rohr(daempferA.x, daempferA.y, daempferB.x, daempferB.y, 0.05 * m, 0.05 * m, FARBEN.federDunkel);
  federTeil(true, mischen(FARBEN.akzent, '#ffffff', 0.08), federDicke * 1.3);

  // Federteller oben und unten — ohne sie schwebt die Wendel frei.
  ctx.fillStyle = '#8d939e';
  for (const p of [daempferA, daempferB]) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, fedRadius * 1.2, 0.03 * m, Math.atan2(fedDy, fedDx), 0, Math.PI * 2);
    ctx.fill();
  }

  /*
   * Der Lenker und der Fahrer-Anteil hinter dem Rahmen. Der Lenker steht hier
   * schon, weil das Skelett die Griffposition braucht (die Hände liegen
   * darauf); gezeichnet wird er weiter unten, **über** dem Rahmen.
   */
  const lenker = { x: standOben.x + 0.06 * m, y: standOben.y - 0.16 * m };
  const geo: FahrerGeo = {
    m,
    tretlager,
    sattel: { x: sattel.x - 0.02 * m, y: sattel.y - 0.085 * m },
    lenker,
  };
  const skelett = skelettBerechnen(geo, pose);
  if (!o.ohneFahrer) fahrerHinten(ctx, geo, skelett, pose);

  // --- Hauptrahmen: Unterrohr, Oberrohr, Sattelrohr ---
  rohr(
    tretlager.x,
    tretlager.y,
    steuerkopf.x,
    steuerkopf.y + 0.14 * m,
    0.07 * m,
    0.055 * m,
    FARBEN.rahmen,
  );
  /*
   * Dünner Teal-Akzentstreifen aufs Unterrohr — sitzt auf derselben
   * Lichtseite wie `rohr()`s Glanzband, damit er wie aufgeklebt wirkt
   * statt wie eine zweite Kontur.
   */
  {
    const ax = tretlager.x;
    const ay = tretlager.y;
    const bx = steuerkopf.x;
    const by = steuerkopf.y + 0.14 * m;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const seite = nx * -0.55 + ny * -0.84 >= 0 ? 1 : -1;
    const off = 0.07 * m * 0.45 * seite;
    ctx.strokeStyle = FARBEN.akzent;
    ctx.lineWidth = Math.max(1.2, 0.07 * m * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax + nx * off, ay + ny * off);
    ctx.lineTo(bx + nx * off, by + ny * off);
    ctx.stroke();
  }
  rohr(
    sattel.x,
    sattel.y,
    steuerkopf.x,
    steuerkopf.y,
    0.055 * m,
    0.05 * m,
    FARBEN.rahmen,
  );
  rohr(
    tretlager.x,
    tretlager.y,
    sattel.x,
    sattel.y,
    0.05 * m,
    0.042 * m,
    FARBEN.rahmen,
  );
  // Steuerrohr.
  rohr(
    steuerkopf.x,
    steuerkopf.y - 0.02 * m,
    gabelOben.x,
    gabelOben.y,
    0.055 * m,
    0.05 * m,
    FARBEN.rahmen,
  );

  /*
   * --- Sattel ---
   * Eine erkennbare Sattelform statt einer reinen Ellipse: hinten breiter
   * für die Sitzfläche, mit rundem Heck, vorn spitz zulaufend zur Nase —
   * die Nase zeigt zum Lenker, wie bei einem echten Sattel.
   */
  {
    const sx = sattel.x - 0.02 * m;
    const sy = sattel.y - 0.04 * m;
    const rot = -0.12;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    // Punkt im sattel-eigenen Koordinatensystem: lx nach vorn (zur Nase),
    // ly quer zur Sitzfläche.
    const pt = (lx: number, ly: number) => ({
      x: sx + lx * cos - ly * sin,
      y: sy + lx * sin + ly * cos,
    });
    const heck = pt(-0.15 * m, 0);
    const hintenO = pt(-0.11 * m, -0.05 * m);
    const hintenU = pt(-0.11 * m, 0.05 * m);
    const mitteO = pt(0.04 * m, -0.045 * m);
    const mitteU = pt(0.04 * m, 0.045 * m);
    const naseO = pt(0.15 * m, -0.014 * m);
    const naseU = pt(0.15 * m, 0.014 * m);
    const naseSpitze = pt(0.19 * m, 0);

    ctx.fillStyle = '#1a1a20';
    ctx.beginPath();
    ctx.moveTo(hintenO.x, hintenO.y);
    ctx.quadraticCurveTo(heck.x, heck.y, hintenU.x, hintenU.y);
    ctx.quadraticCurveTo(mitteU.x, mitteU.y, naseU.x, naseU.y);
    ctx.quadraticCurveTo(naseSpitze.x, naseSpitze.y, naseO.x, naseO.y);
    ctx.quadraticCurveTo(mitteO.x, mitteO.y, hintenO.x, hintenO.y);
    ctx.closePath();
    ctx.fill();
  }

  // --- Lenker und Vorbau ---
  // Der Vorbau sitzt auf der **oberen** Brücke, nicht am Steuerkopf —
  // bei einer Doppelbrückengabel ist das der einzige Platz dafür.
  rohr(
    standOben.x,
    standOben.y - 0.01 * m,
    lenker.x,
    lenker.y,
    0.038 * m,
    0.032 * m,
    FARBEN.federDunkel,
  );
  ctx.fillStyle = '#101014';
  ctx.beginPath();
  ctx.arc(lenker.x, lenker.y, 0.055 * m, 0, Math.PI * 2);
  ctx.fill();

  // --- Antrieb: Kettenblatt, Kurbel, Pedal, Kette ---
  ctx.fillStyle = '#7a8089';
  ctx.beginPath();
  ctx.arc(tretlager.x, tretlager.y, 0.11 * m, 0, Math.PI * 2);
  ctx.fill();
  // Kassette am Hinterrad.
  ctx.fillStyle = '#7a8089';
  ctx.beginPath();
  ctx.arc(hintenX, nabeHinten, 0.07 * m, 0, Math.PI * 2);
  ctx.fill();
  // Die Kette als zwei Trume zwischen beiden.
  ctx.strokeStyle = '#4c525b';
  ctx.lineWidth = Math.max(1, 0.022 * m);
  ctx.beginPath();
  ctx.moveTo(tretlager.x, tretlager.y - 0.1 * m);
  ctx.lineTo(hintenX, nabeHinten - 0.065 * m);
  ctx.moveTo(tretlager.x, tretlager.y + 0.1 * m);
  ctx.lineTo(hintenX, nabeHinten + 0.065 * m);
  ctx.stroke();

  /*
   * Die Kurbel dreht sich mit dem Tempo — mit deutlich kleinerem Faktor
   * als die Laufräder selbst (0,55 → 0,22). Rückmeldung: „Die
   * Beinbewegung kann langsamer sein, das sieht sehr komisch aus, wenn
   * es so megaschnell ist." Bei voller Fahrt drehte die Kurbel vorher
   * über drei Umdrehungen je Sekunde — nach dem Umbau auf die jetzt viel
   * kräftigere, sichtbarere Beinform (siehe unten) las sich das nicht
   * mehr als Treten, sondern als Zittern. Real tritt niemand deutlich
   * über zwei Umdrehungen je Sekunde; 0,22 bleibt selbst bei Höchsttempo
   * knapp darunter.
   */
  /*
   * Die Kurbel dreht sich nur noch, wenn der Fahrer sitzt und tritt. Wer
   * steht (Angriffshaltung, in der Luft, bei Tempo), hält die Pedale
   * waagerecht — das Skelett legt den Kurbelwinkel fest (`skelettBerechnen`),
   * hier wird nur gezeichnet, wohin es das nahe Pedal gesetzt hat.
   */
  const pedalX = skelett.pedalNah.x;
  const pedalY = skelett.pedalNah.y;
  rohr(
    tretlager.x,
    tretlager.y,
    pedalX,
    pedalY,
    0.028 * m,
    0.025 * m,
    '#3a3f47',
  );
  ctx.fillStyle = '#22252a';
  ctx.fillRect(pedalX - 0.055 * m, pedalY - 0.018 * m, 0.11 * m, 0.036 * m);

  // ---------------------------------------------------------------
  // Der Fahrer — siehe `fahrer.ts`
  // ---------------------------------------------------------------
  if (!o.ohneFahrer) fahrerVorn(ctx, geo, skelett, pose);

  ctx.restore();
}

/** Die Werte, die ein Prüfstand festlegen kann (alles optional). */
type PrueftandWerte = Partial<FahrerPose> & {
  /** Wie viele Meter quer ins Bild passen. */
  sicht?: number;
  /** Radwinkel in Radiant, positiv = Vorderrad hoch. */
  winkel?: number;
  federVorn?: number;
  federHinten?: number;
  /** Welche Umgebung (0 bis 3) den Hintergrund stellt. */
  biom?: number;
};

/**
 * Zeichnet Rad und Fahrer groß in der Bildmitte — die Nahaufnahme für den
 * Rechner (`__mtbPrueftand`) und das Titelbild des Startbildschirms.
 */
export function prueftandZeichnen(
  ctx: CanvasRenderingContext2D,
  breite: number,
  hoehe: number,
  pixelDichte: number,
  lauf: Lauf,
  w: PrueftandWerte,
) {
  ctx.setTransform(pixelDichte, 0, 0, pixelDichte, 0, 0);
  const palette = PALETTEN[(w.biom ?? 0) % PALETTEN.length]!;
  const boden = hoehe * 0.86;
  const proMeter = breite / (w.sicht ?? 3.2);
  const buehne: Buehne = {
    ctx,
    breite,
    hoehe,
    proMeter,
    kameraX: 0,
    g: lauf.gelaende,
    p: palette,
    uhr: w.zeit ?? 0.3,
    bx: (x) => x,
    by: (y) => y,
  };
  himmelZeichnen(buehne);
  ctx.fillStyle = palette.boden.oben;
  ctx.fillRect(0, boden, breite, hoehe - boden);
  ctx.fillStyle = palette.boden.rost;
  ctx.fillRect(0, boden + (hoehe - boden) * 0.5, breite, (hoehe - boden) * 0.5);
  ctx.fillStyle = palette.gras[0];
  ctx.fillRect(0, boden - 4, breite, 7);
  ctx.fillStyle = palette.gras[1];
  ctx.fillRect(0, boden - 4, breite, 2);
  // Schatten unter dem Rad, wie im Spiel.
  const sg = ctx.createRadialGradient(breite * 0.5 + proMeter * 0.3, boden + 2, 0, breite * 0.5 + proMeter * 0.3, boden + 2, proMeter * 1.5);
  sg.addColorStop(0, 'rgba(0,0,0,0.38)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(0, boden + 2);
  ctx.scale(1, 0.14);
  ctx.translate(0, -(boden + 2));
  ctx.fillStyle = sg;
  ctx.fillRect(0, boden - proMeter * 12, breite, proMeter * 24);
  ctx.restore();
  radFahrerZeichnen(ctx, { ...lauf, winkel: w.winkel ?? 0, vorbei: false }, {
    px: breite * 0.5,
    py: boden,
    proMeter,
    federVorn: w.federVorn ?? 0,
    federHinten: w.federHinten ?? 0,
    radDrehung: 0.4,
    pose: {
      stehen: w.stehen ?? 1,
      hocke: w.hocke ?? 0,
      gewicht: w.gewicht ?? 0,
      streck: w.streck ?? 0,
      kurbel: w.kurbel ?? 0.6,
      wind: w.wind ?? 0.6,
      zeit: w.zeit ?? 0.3,
    },
  });
  ctx.fillStyle = palette.grading;
  ctx.fillRect(0, 0, breite, hoehe);
}

/**
 * Das Titelbild: Rad und Fahrer groß auf durchsichtigem Grund, in
 * Angriffshaltung mit einer leichten Schräglage — dieselbe Zeichnung wie im
 * Spiel, nicht ein zweites, vereinfachtes Bild. Vorher stand auf dem
 * Startbildschirm ein grobes SVG-Poster; ein Spiel, dessen Titelbild anders
 * aussieht als das Spiel, wirkt wie ein Versprechen, das es nicht hält.
 *
 * Gezeichnet wird einmal (Standbild). Die Leinwand bekommt die doppelte
 * Auflösung, damit es auf einem Retina-Bildschirm scharf bleibt.
 */
export function heldenbildZeichnen(leinwand: HTMLCanvasElement, breiteCss: number, hoeheCss: number) {
  const ctx = leinwand.getContext('2d');
  if (!ctx) return;
  const dichte = Math.min(window.devicePixelRatio || 1, 3);
  leinwand.width = Math.round(breiteCss * dichte);
  leinwand.height = Math.round(hoeheCss * dichte);
  leinwand.style.width = `${breiteCss}px`;
  leinwand.style.height = `${hoeheCss}px`;
  ctx.setTransform(dichte, 0, 0, dichte, 0, 0);
  ctx.clearRect(0, 0, breiteCss, hoeheCss);

  // Rad und Fahrer sind rund 3,4 m breit und 3,5 m hoch — so skalieren, dass
  // beides in die Fläche passt, ganz gleich, welches Seitenverhältnis sie hat.
  const proMeter = Math.min(breiteCss / 3.8, (hoeheCss * 0.9) / 3.5);
  const boden = hoeheCss * 0.93;
  const mitteX = breiteCss * 0.5;

  // Weiches Licht hinter dem Fahrer: macht aus einer Silhouette ein Bild.
  // Der Radius reicht bis zum Rand der Fläche und nicht darüber: Ein Verlauf,
  // der am Rand noch hell ist, zeichnet dort eine sichtbare Kante.
  const hofR = Math.min(breiteCss, hoeheCss) * 0.5;
  const hof = ctx.createRadialGradient(mitteX, hoeheCss * 0.5, 0, mitteX, hoeheCss * 0.5, hofR);
  hof.addColorStop(0, 'rgba(255,255,255,0.2)');
  hof.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hof;
  ctx.fillRect(0, 0, breiteCss, hoeheCss);

  // Schatten auf dem Boden.
  ctx.save();
  ctx.translate(mitteX + proMeter * 0.1, boden + 3);
  ctx.scale(1, 0.12);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, proMeter * 1.9);
  sg.addColorStop(0, 'rgba(0,0,0,0.5)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, 0, proMeter * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  radFahrerZeichnen(
    ctx,
    { winkel: 0.1, vorbei: false, gewonnen: false, sturzZeit: 0 },
    {
      px: mitteX,
      py: boden,
      proMeter,
      federVorn: 0.15,
      federHinten: 0.2,
      radDrehung: 0.4,
      pose: { stehen: 1, hocke: 0.12, gewicht: 0.25, streck: 0, kurbel: 0.6, wind: 0.6, zeit: 0.3 },
    },
  );
}
